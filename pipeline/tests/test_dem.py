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
