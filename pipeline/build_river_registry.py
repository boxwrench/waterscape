#!/usr/bin/env python3
"""Generate the River Pulse build-time content registry from place manifests."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PLACE_SCHEMA = "river-pulse-place-0.1"
REGISTRY_SCHEMA = "river-pulse-registry-0.1"
RIVER_SCHEMA = "river-pulse-river-0.2"
SCENE_SCHEMA = "river-pulse-scene-0.1"
SLOTS = ("start", "middle", "end", "extra")
REQUIRED_FIELDS = (
    "schema_version",
    "minimum_engine_version",
    "id",
    "river_pack",
    "name",
    "hydrologic_context",
    "anchor",
    "horizontal_crs",
    "supported_capabilities",
)


def _load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_place_manifest(manifest: dict, path: Path) -> None:
    missing = [field for field in REQUIRED_FIELDS if field not in manifest]
    if missing:
        raise ValueError(f"{path}: missing required fields: {', '.join(missing)}")
    if manifest["schema_version"] != PLACE_SCHEMA:
        raise ValueError(f"{path}: unsupported schema_version {manifest['schema_version']!r}")
    if not isinstance(manifest["supported_capabilities"], list):
        raise ValueError(f"{path}: supported_capabilities must be a list")
    anchor = manifest["anchor"]
    if not isinstance(anchor, dict) or not all(key in anchor for key in ("latitude", "longitude")):
        raise ValueError(f"{path}: anchor requires latitude and longitude")

    place_dir = path.parents[1].name
    river_dir = path.parents[4].name
    if manifest["id"] != place_dir:
        raise ValueError(f"{path}: manifest id {manifest['id']!r} must match directory {place_dir!r}")
    if manifest["river_pack"] != river_dir:
        raise ValueError(
            f"{path}: river_pack {manifest['river_pack']!r} must match river directory {river_dir!r}"
        )


def discover_places(root: Path) -> list[dict]:
    """Find built places at rivers/<river>/scenes/<slot>/<place>/data/place.json."""
    root = Path(root)
    entries: list[dict] = []
    identities: set[tuple[str, str]] = set()

    for path in sorted(root.glob("rivers/*/scenes/*/*/data/place.json")):
        manifest = _load_json(path)
        validate_place_manifest(manifest, path)
        identity = (manifest["river_pack"], manifest["id"])
        if identity in identities:
            raise ValueError(f"Duplicate place identity: {identity[0]}/{identity[1]}")
        identities.add(identity)

        entries.append(
            {
                "river_pack": manifest["river_pack"],
                "id": manifest["id"],
                "name": manifest["name"],
                "hydrologic_context": manifest["hydrologic_context"],
                "manifest": path.relative_to(root).as_posix(),
                "supported_capabilities": sorted(set(manifest["supported_capabilities"])),
            }
        )

    return sorted(entries, key=lambda entry: (entry["river_pack"], entry["id"]))


def build_registry(data_root: Path) -> dict:
    """data_root is the river-pulse directory."""
    return {
        "schema_version": REGISTRY_SCHEMA,
        "rivers": discover_rivers(data_root),
        "places": discover_places(data_root),
    }


def validate_scenes(river_path: Path, manifest: dict) -> None:
    """Every river lists its slots in order; each slot folder holds a matching scene.json."""
    river_dir = river_path.parent
    seen = set()
    if not manifest.get("scenes"):
        raise ValueError(f"{river_path}: scenes[] is required (use planned placeholders for empty slots)")
    for entry in manifest["scenes"]:
        slot, scene_id = entry.get("slot"), entry.get("id")
        if slot not in SLOTS or not scene_id:
            raise ValueError(f"{river_path}: scene entries need a slot from {SLOTS} and an id")
        if (slot, scene_id) in seen:
            raise ValueError(f"{river_path}: duplicate scene {slot}/{scene_id}")
        seen.add((slot, scene_id))
        folder = river_dir / "scenes" / slot / scene_id
        scene_path = folder / "scene.json"
        if not scene_path.exists():
            raise ValueError(f"{river_path}: missing {scene_path.relative_to(river_dir.parent)}")
        scene = _load_json(scene_path)
        if scene.get("schema_version") != SCENE_SCHEMA:
            raise ValueError(f"{scene_path}: unsupported scene schema")
        for key, expected in (("id", scene_id), ("river", river_dir.name), ("slot", slot)):
            if scene.get(key) != expected:
                raise ValueError(f"{scene_path}: {key} must be {expected!r}")
        if scene.get("status") not in ("built", "planned"):
            raise ValueError(f"{scene_path}: status must be built or planned")
        if scene["status"] == "built":
            for name in (scene.get("entry"), scene.get("thumb")):
                if not name or not (folder / name).exists():
                    raise ValueError(f"{scene_path}: built scenes need existing entry and thumb files")
    extra = {p.parent.parent.name + "/" + p.parent.name for p in (river_dir / "scenes").glob("*/*/scene.json")}
    unlisted = extra - {f"{slot}/{scene_id}" for slot, scene_id in seen}
    if unlisted:
        raise ValueError(f"{river_path}: scene folders not listed in river.json: {sorted(unlisted)}")


def discover_rivers(root: Path) -> list[dict]:
    entries = []
    for path in sorted(Path(root).glob("rivers/*/river.json")):
        manifest = _load_json(path)
        if manifest.get("schema_version") != RIVER_SCHEMA:
            raise ValueError(f"{path}: unsupported river schema")
        if manifest.get("id") != path.parent.name:
            raise ValueError(f"{path}: river id must match directory")
        for field in ("name", "summary", "status"):
            if not isinstance(manifest.get(field), str) or not manifest[field].strip():
                raise ValueError(f"{path}: {field} is required")
        if manifest["status"] not in ("available", "in_development", "planned"):
            raise ValueError(f"{path}: unsupported river status")
        if not manifest.get("references"):
            raise ValueError(f"{path}: references are required")
        validate_scenes(path, manifest)
        entries.append({"id": manifest["id"], "name": manifest["name"],
                        "status": manifest["status"],
                        "manifest": path.relative_to(root).as_posix()})
    return entries


def registry_text(data_root: Path) -> str:
    return json.dumps(build_registry(data_root), indent=2, sort_keys=False) + "\n"


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-root",
        type=Path,
        default=repo_root / "river-pulse",
        help="River Pulse directory (holds rivers/ and registry.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repo_root / "river-pulse" / "registry.json",
        help="Generated registry path",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail instead of writing when the generated registry differs from --output",
    )
    args = parser.parse_args()

    generated = registry_text(args.data_root)
    if args.check:
        existing = args.output.read_text(encoding="utf-8") if args.output.exists() else ""
        if existing != generated:
            print(f"River Pulse registry is stale: {args.output}")
            return 1
        print(f"River Pulse registry is current: {args.output}")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(generated, encoding="utf-8")
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
