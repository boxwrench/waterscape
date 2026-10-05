import json
from pathlib import Path

import pytest

from pipeline.build_river_registry import build_registry, discover_places, discover_rivers, registry_text


def write_place(root: Path, river: str, place_id: str, *, name=None, capabilities=None):
    path = root / "rivers" / river / "scenes" / "middle" / place_id / "data" / "place.json"
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
    data_root = repo_root / "river-pulse"
    registry = data_root / "registry.json"
    assert registry.read_text(encoding="utf-8") == registry_text(data_root)


def write_river(root: Path, river_id: str, scenes=None, **overrides):
    path = root / "rivers" / river_id / "river.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"schema_version": "river-pulse-river-0.2", "id": river_id,
                "name": "New River", "summary": "Reserved for future work.",
                "status": "planned", "references": [{"url": "https://example.test/"}],
                "scenes": scenes if scenes is not None else [{"slot": "start", "id": "start_to_be_chosen"}]}
    manifest.update(overrides)
    path.write_text(json.dumps(manifest), encoding="utf-8")
    return path


def write_scene(root: Path, river_id: str, slot: str, scene_id: str, **fields):
    path = root / "rivers" / river_id / "scenes" / slot / scene_id / "scene.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = {"schema_version": "river-pulse-scene-0.1", "id": scene_id, "river": river_id,
             "slot": slot, "name": scene_id, "status": "planned"}
    scene.update(fields)
    path.write_text(json.dumps(scene), encoding="utf-8")
    return path


def test_planned_river_discovery_without_fake_places(tmp_path):
    path = write_river(tmp_path, "new_river")
    write_scene(tmp_path, "new_river", "start", "start_to_be_chosen")
    assert build_registry(tmp_path)["places"] == []
    assert discover_rivers(tmp_path)[0]["status"] == "planned"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["id"] = "wrong_directory"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="must match directory"):
        discover_rivers(tmp_path)


def test_every_listed_slot_needs_a_matching_scene_folder(tmp_path):
    write_river(tmp_path, "new_river")
    with pytest.raises(ValueError, match="missing"):
        discover_rivers(tmp_path)
    write_scene(tmp_path, "new_river", "start", "start_to_be_chosen")
    write_scene(tmp_path, "new_river", "end", "unlisted_place")
    with pytest.raises(ValueError, match="not listed"):
        discover_rivers(tmp_path)


def test_built_scene_needs_its_entry_page_and_thumbnail(tmp_path):
    write_river(tmp_path, "new_river", scenes=[{"slot": "middle", "id": "bridge"}])
    scene = write_scene(tmp_path, "new_river", "middle", "bridge", status="built", entry="index.html", thumb="thumb.jpg")
    with pytest.raises(ValueError, match="entry and thumb"):
        discover_rivers(tmp_path)
    (scene.parent / "index.html").write_text("<!doctype html>", encoding="utf-8")
    (scene.parent / "thumb.jpg").write_bytes(b"x")
    assert discover_rivers(tmp_path)[0]["id"] == "new_river"
