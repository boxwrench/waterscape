from geo import utm10


def test_central_meridian_on_equator_is_false_easting():
    east, north = utm10(0.0, -123.0)
    assert abs(east - 500000.0) < 1e-6
    assert abs(north) < 1e-6


def test_matches_renderer_inverse_at_calaveras_origin():
    # terrain.js latLon(0, 0) for the committed Calaveras bundle returned this point;
    # the forward projection must land back on its UTM origin.
    east, north = utm10(37.472608030037705, -121.81815953185885)
    assert abs(east - 604503.06) < 0.5
    assert abs(north - 4147958.17) < 0.5
