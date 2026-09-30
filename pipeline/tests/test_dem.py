import numpy as np
import pytest

from dem import detect_water


def two_lakes():
    """Sloped ground with a big flat lake (level 50) and a smaller one (level 80)."""
    rows, cols = np.mgrid[0:300, 0:300]
    dem = 100.0 + rows * 0.5 + cols * 0.3
    dem[20:120, 20:170] = 50.0   # 15,000 cells: the larger lake
    dem[180:260, 180:260] = 80.0  # 6,400 cells: the smaller lake
    return dem


def test_without_anchor_picks_the_largest_lake():
    mask, level = detect_water(two_lakes())
    assert level == pytest.approx(50.0)
    assert mask[60, 60] and not mask[220, 220]


def test_anchor_selects_its_own_lake_even_if_smaller():
    mask, level = detect_water(two_lakes(), anchor=(220, 220))
    assert level == pytest.approx(80.0)
    assert mask[220, 220] and not mask[60, 60]


def test_anchor_on_dry_land_fails_loudly():
    with pytest.raises(ValueError, match="not on lidar-flattened water"):
        detect_water(two_lakes(), anchor=(5, 290))


def two_lakes_same_level():
    """Two flat lakes at level 50, split by a dry causeway."""
    dem = two_lakes()
    dem[180:260, 180:260] = 50.0
    return dem


def test_extra_anchor_adds_a_separate_lake_at_the_same_level():
    mask, level = detect_water(two_lakes_same_level(), anchor=(60, 60), extra=[(220, 220)])
    assert level == pytest.approx(50.0)
    assert mask[60, 60] and mask[220, 220]


def test_extra_anchor_at_another_level_fails_loudly():
    with pytest.raises(ValueError, match="not at the water level"):
        detect_water(two_lakes(), anchor=(60, 60), extra=[(220, 220)])


def test_dams_extend_the_water_to_their_upstream_face():
    from dem import burn_dams
    # A lake (rows 0-39) ends 3 cells short of a dam crest along row 43; land beyond.
    water = np.zeros((80, 60), bool)
    water[:40, :] = True
    # Crest in raster (col, row) coordinates, cell size 1.
    out = burn_dams(water, [[(0.0, 43.0), (60.0, 43.0)]], reach=6)
    assert out[41:43, 5:55].all(), "cells between the lake and the crest become water"
    assert not out[45:, :].any(), "nothing downstream of the crest"


def test_dams_carve_the_lidar_below_their_downstream_face():
    from dem import carve_dams
    # Water rows 0-39, crest along row 43 at elevation 100; smeared lidar falls 1 m per row.
    water = np.zeros((120, 20), bool)
    water[:40, :] = True
    dem = np.full((120, 20), 50.0)
    dem[40:, :] = (100 - (np.arange(80) * 1.0))[:, None]
    out, foot = carve_dams(dem, water, [[(2.0, 43.0), (18.0, 43.0)]], [100.0], cell=1.0, heights=[60.0])
    assert foot[73, 10] and not foot[73, 0] and not foot[119, 10]
    # 30 m downstream the face stands 100 - 6 - (30 - 7.5) / 0.75 = 64 m; ground 6 m below it.
    assert out[73, 10] <= 58.0 + 1e-6
    assert (out[:40] == dem[:40]).all(), "the lake side is untouched"
    assert out[119, 10] == dem[119, 10], "beyond the toe is untouched"
    assert out[73, 0] == dem[73, 0], "beyond the crest's ends is untouched"


def test_dams_flood_their_upstream_face_even_over_smeared_high_ground():
    from dem import burn_dams
    water = np.zeros((80, 60), bool)
    water[:40, :] = True
    out = burn_dams(water, [[(5.0, 43.0), (55.0, 43.0)]], reach=6, always=3)
    assert out[41:43, 10:50].all()
    assert not out[41:43, 0].any(), "not beyond the crest's ends"


def test_rivers_are_carved_below_their_surface_within_their_width():
    from dem import carve_river
    dem = np.full((40, 60), 100.0)
    # A river along row 20 from col 5 to 55, 6 cells wide, surface falling 50 -> 40.
    out, foot = carve_river(dem, [(5.0, 20.0), (55.0, 20.0)], [6.0, 6.0], [50.0, 40.0], cell=1.0)
    assert out[20, 5] <= 50.0 - 1.5 and out[20, 55] <= 40.0 - 1.5
    assert abs(out[20, 30] - (45.0 - 1.5)) < 0.2, "surface interpolated along the river"
    assert out[20 + 5, 30] == 100.0, "outside the banks untouched"
    assert foot[20, 30] and not foot[30, 30]
