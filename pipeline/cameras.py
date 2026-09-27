"""Camera placement on a reservoir bundle: line-of-sight viewpoints and flyover keys.

Conventions match the renderer: local metres, x east, z south, y up from the water
surface; yaw 0 looks north (-z) and forward is (sin yaw, -cos yaw)."""

import math

import numpy as np

COMPASS = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"]


class Grid:
    def __init__(self, height, sdf, x0, z0, cell):
        self.h = np.where(sdf < 0, 0.0, height)  # the water surface where flooded
        self.sdf, self.x0, self.z0, self.cell = sdf, x0, z0, cell
        self.rows, self.cols = height.shape

    def ground(self, x, z):
        """Bilinear ground/water height, clamped at the grid edge (as the renderer does)."""
        u = np.clip((np.asarray(x, float) - self.x0) / self.cell, 0, self.cols - 1.001)
        v = np.clip((np.asarray(z, float) - self.z0) / self.cell, 0, self.rows - 1.001)
        iu, iv = u.astype(int), v.astype(int)
        fu, fv = u - iu, v - iv
        h = self.h
        top = h[iv, iu] * (1 - fu) + h[iv, iu + 1] * fu
        bottom = h[iv + 1, iu] * (1 - fu) + h[iv + 1, iu + 1] * fu
        return top * (1 - fv) + bottom * fv

    def shore(self, x, z):
        c = int(np.clip(round((x - self.x0) / self.cell), 0, self.cols - 1))
        r = int(np.clip(round((z - self.z0) / self.cell), 0, self.rows - 1))
        return float(self.sdf[r, c])

    def xz(self, rows, cols):
        return self.x0 + np.asarray(cols) * self.cell, self.z0 + np.asarray(rows) * self.cell


def yaw_towards(x, z, tx, tz):
    return math.atan2(tx - x, -(tz - z))


def turn(a, b):
    """Signed shortest rotation from angle a to angle b."""
    return math.atan2(math.sin(b - a), math.cos(b - a))


def water_targets(grid, count=150, seed=1):
    rows, cols = np.nonzero(grid.sdf < -30)
    pick = np.random.default_rng(seed).choice(len(rows), min(count, len(rows)), replace=False)
    return grid.xz(rows[pick], cols[pick])


def water_centroid(grid):
    rows, cols = np.nonzero(grid.sdf < 0)
    x, z = grid.xz(rows.mean(), cols.mean())
    return float(x), float(z)


def visible_count(grid, x, z, eye, targets):
    """How many water targets the eye (eye metres above ground at x, z) can see."""
    y0 = float(grid.ground(x, z)) + eye
    tx, tz = targets
    s = np.linspace(0, 1, 64)[1:-1]
    px = x + np.outer(tx - x, s)
    pz = z + np.outer(tz - z, s)
    py = y0 * (1 - s)  # straight line down to the water surface at each target
    return int(np.all(py[None, :] > grid.ground(px, pz) + 0.5, axis=1).sum())


def _viewpoint(grid, x, z, label, above=3.0, speed=40):
    cx, cz = water_centroid(grid)
    rise = float(grid.ground(x, z)) + above
    pitch = -min(0.25, max(0.04, math.atan2(rise, math.hypot(cx - x, cz - z))))
    return {
        "x": round(float(x)), "z": round(float(z)), "above": above,
        "yaw": round(yaw_towards(x, z, cx, cz), 3), "pitch": round(pitch, 3),
        "speed": speed, "label": label,
    }


def _compass_label(grid, x, z):
    cx, cz = water_centroid(grid)
    bearing = math.degrees(yaw_towards(cx, cz, x, z)) % 360  # direction from water to point
    return f"{COMPASS[int((bearing + 22.5) // 45) % 8]} ridge"


def search_viewpoints(grid, step=150.0, eye=3.0):
    """Overlook = land point seeing the most open water; ridge = best point at least
    1500 m away looking from a direction at least 60 degrees different; shore = 40-80 m
    offshore, nearest the overlook, facing the open water."""
    targets = water_targets(grid)
    cx, cz = water_centroid(grid)
    stride = max(1, int(step / grid.cell))
    scored = []
    for r in range(0, grid.rows, stride):
        for c in range(0, grid.cols, stride):
            if not 150 <= grid.sdf[r, c] <= 3000:
                continue
            x, z = (float(v) for v in grid.xz(r, c))
            if float(grid.ground(x, z)) < 40:
                continue
            scored.append((visible_count(grid, x, z, eye, targets), x, z))
    if not scored:
        raise ValueError("no land within 3 km of the water rises 40 m above it")
    scored.sort(key=lambda s: -s[0])
    _, ox, oz = scored[0]
    look = yaw_towards(ox, oz, cx, cz)
    ridge = next(
        (s for s in scored[1:]
         if math.hypot(s[1] - ox, s[2] - oz) >= 1500
         and abs(turn(look, yaw_towards(s[1], s[2], cx, cz))) >= math.radians(60)),
        None,
    ) or next((s for s in scored[1:] if math.hypot(s[1] - ox, s[2] - oz) >= 1500), None)
    if ridge is None:
        raise ValueError("no second viewpoint 1500 m from the overlook")
    rows, cols = np.nonzero((grid.sdf <= -40) & (grid.sdf >= -80))
    xs, zs = grid.xz(rows, cols)
    i = int(np.argmin(np.hypot(xs - ox, zs - oz)))
    return {
        "overlook": _viewpoint(grid, ox, oz, _compass_label(grid, ox, oz)),
        "ridge": _viewpoint(grid, ridge[1], ridge[2], _compass_label(grid, ridge[1], ridge[2])),
        "shore": _viewpoint(grid, xs[i], zs[i], "Shoreline", above=1.6, speed=4) | {"pitch": -0.04},
    }


def flyover_keys(grid, vp, duration=10.0, count=5, clearance=25.0):
    """Glide from a viewpoint 35% of the way toward the water centroid, rising 40 m and
    turning to face the water; every point on the path stays `clearance` above ground."""
    cx, cz = water_centroid(grid)
    x0, z0 = vp["x"], vp["z"]
    y0 = float(grid.ground(x0, z0)) + max(vp["above"], clearance)
    yaw_end = vp["yaw"] + turn(vp["yaw"], yaw_towards(x0, z0, cx, cz))
    keys = []
    for i in range(count):
        f = i / (count - 1)
        x, z = x0 + (cx - x0) * 0.35 * f, z0 + (cz - z0) * 0.35 * f
        keys.append({"t": duration * f, "x": x, "y": y0 + 40.0 * f, "z": z,
                     "yaw": vp["yaw"] + (yaw_end - vp["yaw"]) * f, "pitch": vp["pitch"]})
    deficit = 0.0
    for a, b in zip(keys, keys[1:]):
        for f in np.linspace(0, 1, 20):
            x, z = a["x"] + (b["x"] - a["x"]) * f, a["z"] + (b["z"] - a["z"]) * f
            y = a["y"] + (b["y"] - a["y"]) * f
            deficit = max(deficit, clearance - (y - float(grid.ground(x, z))))
    for k in keys:
        k["y"] += deficit
    return {
        "duration": duration,
        "keys": [{k: round(v, 4 if k in ("yaw", "pitch") else 1) for k, v in key.items()} for key in keys],
    }
