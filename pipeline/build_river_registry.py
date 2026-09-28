#!/usr/bin/env python3
"""Generate the River Pulse build-time content registry from place manifests."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PLACE_SCHEMA = "river-pulse-place-0.1"
REGISTRY_SCHEMA = "river-pulse-registry-0.1"
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

    place_dir = path.parent.name
    river_dir = path.parents[2].name
    if manifest["id"] != place_dir:
        raise ValueError(f"{path}: manifest id {manifest['id']!r} must match directory {place_dir!r}")
    if manifest["river_pack"] != river_dir:
        raise ValueError(
            f"{path}: river_pack {manifest['river_pack']!r} must match river directory {river_dir!r}"
        )


def discover_places(data_root: Path) -> list[dict]:
    data_root = Path(data_root)
    entries: list[dict] = []
    identities: set[tuple[str, str]] = set()

    for path in sorted(data_root.glob("*/places/*/place.json")):
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
                "manifest": path.relative_to(data_root).as_posix(),
                "supported_capabilities": sorted(set(manifest["supported_capabilities"])),
            }
        )

    return sorted(entries, key=lambda entry: (entry["river_pack"], entry["id"]))


def build_registry(data_root: Path) -> dict:
    return {
        "schema_version": REGISTRY_SCHEMA,
        "places": discover_places(data_root),
    }


def registry_text(data_root: Path) -> str:
    return json.dumps(build_registry(data_root), indent=2, sort_keys=False) + "\n"


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-root",
        type=Path,
        default=repo_root / "river-pulse" / "data",
        help="River Pulse data directory",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repo_root / "river-pulse" / "data" / "registry.json",
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
