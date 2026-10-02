import gzip

import numpy as np
import pytest

import detail


def test_coarse_at_matches_the_grid_on_its_cell_lines():
    plane = np.arange(30.0).reshape(5, 6) ** 1.5
    fine = detail.coarse_at(plane, 1, 1, 3, sub=4)
    assert fine.shape == (13, 13)
    for a in range(4):
        for b in range(4):
            assert fine[a * 4, b * 4] == pytest.approx(plane[1 + a, 1 + b])
    # Along a cell line the patch is linear between the grid's two vertices.
    assert fine[0, 2] == pytest.approx((plane[1, 1] + plane[1, 2]) / 2)


def test_feather_is_zero_on_the_edge_and_one_inside():
    w = detail.feather_weight(101, 1.0, width=20)
    assert w[0].max() == 0 and w[:, -1].max() == 0
    assert w[20:81, 20:81].min() == pytest.approx(1.0)
    assert 0 < w[10, 50] < 1


def test_combine_keeps_the_bundle_on_the_edge_and_the_lidar_inside():
    n = 161
    h10 = np.full((n, n), 5.0)
    s10 = np.full((n, n), 30.0)
    v10 = np.full((n, n), 0.5)
    h1 = np.full((n, n), 7.0)
    h1[:, :60] = -0.04            # lake at the survey level, just under the bundle's
    h, s, v, w = detail.combine(h1, h10, s10, v10, 1.0)
    assert h[0, 80] == pytest.approx(5.0) and s[80, 0] == pytest.approx(30.0)
    assert h[80, 100] == pytest.approx(7.0)
    assert h[80, 55] == 0.0 and s[80, 55] < 0          # water: height 0, offshore
    assert s[80, 59] < 0 < s[80, 61]                   # the waterline follows the 1 m data
    assert np.array_equal(v, v10)


def test_unsurveyed_points_fall_back_to_the_bundle():
    n = 61
    h1 = np.full((n, n), np.nan)
    h, s, v, w = detail.combine(h1, np.full((n, n), 3.0), np.full((n, n), 12.0),
                                np.zeros((n, n)), 1.0)
    assert np.allclose(h, 3.0)


def test_pack_round_trips_four_channels(tmp_path):
    rng = np.random.default_rng(1)
    h = rng.uniform(0, 80, (7, 9))
    s = rng.uniform(-50, 50, (7, 9))
    v = rng.uniform(0, 1, (7, 9))
    w = rng.uniform(0, 1, (7, 9))
    body = detail.pack(h, s, v, w)
    path = tmp_path / "p.bin.gz"
    detail.demlib.write_gzip(path, body)
    raw = gzip.open(path).read()
    planes = []
    for c in range(4):
        d = np.frombuffer(raw, "<u2", 63, c * 126).reshape(7, 9).astype(np.int64)
        planes.append(np.cumsum(d, axis=0) % 65536)
    codecs = [detail.demlib.HEIGHT, detail.demlib.SHORE, detail.demlib.VALLEY, detail.WEIGHT]
    out = [p * c["scale"] + c["offset"] for p, c in zip(planes, codecs)]
    assert np.allclose(out[0], h, atol=0.026) and np.allclose(out[1], s, atol=0.126)
    assert np.allclose(out[3], w, atol=1e-4)


def test_tile_name_uses_the_north_west_corner():
    assert detail.tile_name(10, 604503, 4147958) == "x60y415"
    assert detail.tile_name(11, 257095, 4205317) == "x25y421"
