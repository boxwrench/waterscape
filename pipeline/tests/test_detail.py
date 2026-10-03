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


def test_hollows_are_dark_and_edges_light_in_blue():
    dem = np.zeros((40, 40), np.float32)
    dem[18:22, 18:22] = -1.0  # a 4 m pit
    dem[5:9, 5:9] = 1.0  # a 4 m knob
    rgb = encode_normals(dem, 1.0)
    assert rgb[20, 20, 2] < 100 and rgb[7, 7, 2] > 156 and abs(int(rgb[30, 30, 2]) - 128) <= 2
