from locate import anchor_point, inside

SQUARE = [[[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]]


def test_inside_square():
    assert inside(0.5, 0.5, SQUARE)
    assert not inside(1.5, 0.5, SQUARE)


def test_anchor_is_the_middle_of_a_square():
    assert anchor_point(SQUARE, 1.0) == [0.5, 0.5]
