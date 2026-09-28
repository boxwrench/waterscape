import numpy as np

import build_river_terrain as river


def decode(body, shape):
    h, w = shape
    delta = np.frombuffer(body, dtype="<u2").reshape(h, w).astype(np.int64)
    plane = np.empty_like(delta)
    plane[0] = delta[0]
    for row in range(1, h):
        plane[row] = (plane[row - 1] + delta[row]) % 65536
    return plane * river.ELEVATION["scale"] + river.ELEVATION["offset"]


def test_pack_elevation_roundtrip_within_quantization():
    source = np.array(
        [
            [5.12, 5.18, 5.26],
            [5.34, 5.41, 5.49],
            [6.02, 6.11, 6.19],
        ],
        dtype=np.float32,
    )
    decoded = decode(river.pack_elevation(source), source.shape)
    assert np.max(np.abs(decoded - source)) <= river.ELEVATION["scale"] / 2 + 1e-6


def test_metadata_is_absolute_and_has_no_reservoir_water_level():
    config = {
        "id": "test_reach",
        "name": "Test Reach",
        "anchor": [38.5, -122.9],
        "bbox": [-122.91, 38.49, -122.89, 38.51],
        "size": [3, 2],
    }
    dem = np.array([[10, 11, 12], [13, 14, 15]], dtype=np.float32)
    meta = river.terrain_metadata(config, dem, 10.0, 10.0, 500000.0, 4262000.0, 10, 500010.0, 4261990.0)

    assert meta["schemaVersion"] == "river-pulse-terrain-0.1"
    assert meta["verticalDatum"] == "NAVD88 metres (3DEP)"
    assert meta["verticalOrigin"]["type"] == "absolute"
    assert meta["channels"] == {"elevation": river.ELEVATION}
    assert "waterLevel" not in meta
    assert "shoreDistance" not in meta["channels"]
    assert meta["width"] == 3
    assert meta["height"] == 2


def test_validate_config_rejects_incomplete_source():
    try:
        river.validate_config({"id": "x"})
    except ValueError as exc:
        assert "source config lacks" in str(exc)
    else:
        raise AssertionError("expected incomplete source config to fail")
