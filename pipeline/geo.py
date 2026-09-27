"""WGS84 -> UTM zone 10N (EPSG:32610), Snyder's series; sub-millimetre here."""
import math


def utm10(lat, lon):
    """WGS84 lat/lon -> UTM zone 10N easting/northing (Snyder's series, < 1 mm here)."""
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi, lam = math.radians(lat), math.radians(lon)
    lam0 = math.radians(-123.0)
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2
    c = ep2 * math.cos(phi) ** 2
    A = math.cos(phi) * (lam - lam0)
    m = a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * phi)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * phi)
        - (35 * e2**3 / 3072) * math.sin(6 * phi)
    )
    east = k0 * n * (
        A + (1 - t + c) * A**3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * A**5 / 120
    ) + 500000.0
    north = k0 * (
        m
        + n
        * math.tan(phi)
        * (
            A * A / 2
            + (5 - t + 9 * c + 4 * c * c) * A**4 / 24
            + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * A**6 / 720
        )
    )
    return east, north
