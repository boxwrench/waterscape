import math

import numpy as np

from cameras import Grid, flyover_keys, search_viewpoints, visible_count, water_targets


def bowl(wall=False):
    """A round reservoir (radius 800 m) in a bowl rising 0.15 m/m to 300 m."""
    n, cell = 200, 20.0
    x0 = z0 = -n * cell / 2
    rows, cols = np.mgrid[0:n, 0:n]
    x, z = x0 + cols * cell, z0 + rows * cell
    r = np.hypot(x, z)
    height = np.where(r < 800, 0.0, np.clip((r - 800) * 0.15, 0.1, 300.0))
    if wall:
        height = np.where((r > 850) & (r < 900), 500.0, height)
    return Grid(height, r - 800, x0, z0, cell)


def test_rim_sees_the_whole_bowl():
    g = bowl()
    targets = water_targets(g)
    assert visible_count(g, 0.0, 1400.0, 3.0, targets) == len(targets[0])


def test_wall_blocks_the_view():
    g = bowl(wall=True)
    assert visible_count(g, 0.0, 1400.0, 3.0, water_targets(g)) == 0


def test_search_places_three_distinct_viewpoints():
    g = bowl()
    v = search_viewpoints(g)
    assert set(v) == {"overlook", "ridge", "shore"}
    assert g.shore(v["overlook"]["x"], v["overlook"]["z"]) > 0
    assert g.shore(v["ridge"]["x"], v["ridge"]["z"]) > 0
    assert g.shore(v["shore"]["x"], v["shore"]["z"]) < 0
    gap = math.hypot(v["overlook"]["x"] - v["ridge"]["x"], v["overlook"]["z"] - v["ridge"]["z"])
    assert gap >= 1500
    for p in v.values():
        assert {"x", "z", "above", "yaw", "pitch", "speed", "label"} <= set(p)


def test_flyover_keeps_clearance_and_ordered_times():
    g = bowl()
    fly = flyover_keys(g, search_viewpoints(g)["overlook"])
    keys = fly["keys"]
    assert keys[0]["t"] == 0 and keys[-1]["t"] == fly["duration"]
    assert all(b["t"] > a["t"] for a, b in zip(keys, keys[1:]))
    for a, b in zip(keys, keys[1:]):
        for f in np.linspace(0, 1, 20):
            x = a["x"] + (b["x"] - a["x"]) * f
            z = a["z"] + (b["z"] - a["z"]) * f
            y = a["y"] + (b["y"] - a["y"]) * f
            assert y - float(g.ground(x, z)) >= 24.9
