import numpy as np

from detail import encode_normals


def test_flat_ground_encodes_straight_up():
    rgb = encode_normals(np.zeros((8, 8), np.float32), 1.0)
    assert (rgb[..., 0] == 128).all() and (rgb[..., 1] == 128).all()


def test_a_slope_rising_east_tilts_the_normal_west():
    dem = np.tile(np.arange(8, dtype=np.float32), (8, 1))  # +1 m per metre eastward
    rgb = encode_normals(dem, 1.0)
    # nx = -1/sqrt(2) -> about 37 of 255; nz (south) unchanged.
    assert abs(int(rgb[4, 4, 0]) - 37) <= 2 and abs(int(rgb[4, 4, 1]) - 128) <= 1
