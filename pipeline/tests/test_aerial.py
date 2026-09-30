import pytest

from aerial import grid_extent


def test_extent_covers_the_terrain_grid_cell_edges():
    # Cell (0, 0) centre sits at gridOrigin; UTM origin is the scene origin (z south).
    meta = {"cell": [10.0, 10.0], "originUTM": [1000.0, 5000.0], "gridOrigin": [-95.0, -45.0],
            "width": 20, "height": 10}
    left, bottom, right, top = grid_extent(meta)
    assert left == pytest.approx(1000 - 95 - 5)
    assert top == pytest.approx(5000 + 45 + 5)
    assert right - left == pytest.approx(200)
    assert top - bottom == pytest.approx(100)
