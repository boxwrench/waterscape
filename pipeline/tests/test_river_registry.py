import json
from pathlib import Path

import pytest

from pipeline.build_river_registry import build_registry, discover_places, discover_rivers, registry_text


def write_place(root: Path, river: str, place_id: str, *, name=None, capabilities=None):
    path = root / river / "places" / place_id / "place.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "schema_version": "river-pulse-place-0.1",
                "minimum_engine_version": "0.1.0",
                "id": place_id,
                "river_pack": river,
                "name": name or place_id,
                "hydrologic_context": "river_reach",
                "anchor": {"latitude": 38.5, "longitude": -122.9},
                "horizontal_crs": "EPSG:32610",
                "supported_capabilities": capabilities or ["observed_discharge"],
            }
        ),
        encoding="utf-8",
    )
    return path


def test_registry_changes_when_place_package_is_added_or_removed(tmp_path):
    write_place(tmp_path, "russian_river", "hacienda_bridge")
    one = build_registry(tmp_path)
    assert [place["id"] for place in one["places"]] == ["hacienda_bridge"]

    jenner = write_place(
        tmp_path,
        "russian_river",
        "jenner",
        capabilities=["estuary_context", "observed_water_surface_elevation"],
    )
    two = build_registry(tmp_path)
    assert [place["id"] for place in two["places"]] == ["hacienda_bridge", "jenner"]

    jenner.unlink()
    back_to_one = build_registry(tmp_path)
    assert [place["id"] for place in back_to_one["places"]] == ["hacienda_bridge"]


def test_registry_is_deterministic_and_capabilities_are_sorted(tmp_path):
    write_place(
        tmp_path,
        "russian_river",
        "z_place",
        capabilities=["weather", "history", "weather"],
    )
    write_place(tmp_path, "russian_river", "a_place")
    first = registry_text(tmp_path)
    second = registry_text(tmp_path)
    assert first == second
    parsed = json.loads(first)
    assert [place["id"] for place in parsed["places"]] == ["a_place", "z_place"]
    assert parsed["places"][1]["supported_capabilities"] == ["history", "weather"]


def test_manifest_identity_must_match_directory(tmp_path):
    path = write_place(tmp_path, "russian_river", "folder_name")
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["id"] = "different_id"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="must match directory"):
        discover_places(tmp_path)


def test_committed_registry_matches_current_place_packages():
    repo_root = Path(__file__).resolve().parents[2]
    data_root = repo_root / "river-pulse" / "data"
    registry = data_root / "registry.json"
    assert registry.read_text(encoding="utf-8") == registry_text(data_root)


def test_planned_river_discovery_without_fake_places(tmp_path):
    path = tmp_path / "new_river" / "river.json"
    path.parent.mkdir()
    manifest = {"schema_version": "river-pulse-river-0.1", "id": "new_river",
                "name": "New River", "summary": "Reserved for future work.",
                "status": "planned", "references": [{"url": "https://example.test/"}]}
    path.write_text(json.dumps(manifest), encoding="utf-8")
    assert build_registry(tmp_path)["places"] == []
    assert discover_rivers(tmp_path)[0]["status"] == "planned"
    manifest["id"] = "wrong_directory"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="must match directory"):
        discover_rivers(tmp_path)
