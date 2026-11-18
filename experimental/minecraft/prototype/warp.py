"""Close the gap a steeper dam face leaves: slide the canyon below the dam upstream.

A steeper downstream face (rebuild_downstream.py --face-drop) reaches river level closer to the
crest than the browser's gravity profile does, leaving a band where the lidar only recorded the
dam. Rather than fill it, the land below is moved upstream by that gap at the dam, fading
smoothly to no movement LENGTH blocks downstream: a gentle stretch of the canyon, with no seam.
The same mapping is used for terrain and river (sampling) and for mapped roads and buildings
(moving their points), so they stay together. Upstream of the dam nothing moves.
"""
import json
import numpy as np
from pyproj import Transformer

LENGTH = 180     # blocks over which the shift fades out downstream
FADE = 45        # blocks beyond the crest's ends over which it fades sideways (gentle: never folds)


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def profile_toe(face_drop, crest_y, river_y, height_m):
    """Blocks from the crest line where the face reaches river level: browser profile, then steep."""
    # Browser gravity profile: y = crest - (6 + (u_m - 7.5) / 0.75) / 4 for u_m > 7.5 (structures.js).
    drop = crest_y - river_y
    u_old = (7.5 + 0.75 * (drop * 4 - 6)) / 2
    u_new = 3.75 + (drop - 1.5) / face_drop
    return u_old, u_new


class DownstreamWarp:
    def __init__(self, meta, structures, face_drop, water_level=1151.7):
        dam = structures['dams'][0]; river = structures['rivers'][0]
        tx = Transformer.from_crs(32611, 4326, always_xy=True)

        def mc(pt):
            lo, la = tx.transform(*pt)
            return np.array([(lo - meta['minGeoLon']) / (meta['maxGeoLon'] - meta['minGeoLon']) * meta['maxMcX'],
                             (meta['maxGeoLat'] - la) / (meta['maxGeoLat'] - meta['minGeoLat']) * meta['maxMcZ']])

        self.crest = [mc(q) for q in dam['crestUTM']]
        crest_y = int(round(80 + (dam['crestElevation'] - water_level) / 4))
        river_y = int(round(80 + (river['surface'][0] - water_level) / 4))
        self.u_old, self.u_new = profile_toe(face_drop, crest_y, river_y, dam['height'])
        self.shift = self.u_old - self.u_new
        s0 = mc(river['centreUTM'][0])
        _, _, side, _ = self._geom(np.array([s0[0]]), np.array([s0[1]]))
        self.down = float(np.sign(side[0]))
        # One direction for the whole move: square to the crest's chord, pointing downstream. A
        # direction that followed the curved crest would jump between segments and fold the land.
        chord = self.crest[-1] - self.crest[0]; n = np.array([-chord[1], chord[0]]) / np.hypot(*chord)
        if np.dot(s0 - (self.crest[0] + self.crest[-1]) / 2, n) < 0:
            n = -n
        self.dir = n

    def _geom(self, X, Z):
        """Per point: distance to the crest line, unit normal of the nearest segment, signed side,
        and how far beyond the crest's ends (0 within its span)."""
        best = np.full(X.shape, 1e9); nx = np.zeros(X.shape); nz = np.zeros(X.shape)
        side = np.zeros(X.shape); beyond = np.zeros(X.shape)
        c = self.crest
        for k in range(len(c) - 1):
            A, B = c[k], c[k + 1]; v = B - A; L = float(np.hypot(*v))
            tt = ((X - A[0]) * v[0] + (Z - A[1]) * v[1]) / (L * L)
            tc = np.clip(tt, 0, 1)
            d = np.hypot(X - (A[0] + tc * v[0]), Z - (A[1] + tc * v[1]))
            m = d < best
            best[m] = d[m]
            nx[m] = -v[1] / L; nz[m] = v[0] / L
            side[m] = np.sign(v[0] * (Z - A[1]) - v[1] * (X - A[0]))[m]
            over = np.where(k == 0, np.maximum(0, -tt) * L, 0) + np.where(k == len(c) - 2, np.maximum(0, tt - 1) * L, 0)
            beyond[m] = over[m]
        return best, (nx, nz), side, beyond

    def displacement(self, X, Z):
        """Blocks to add to (X, Z) to find where each point's land comes from (downstream)."""
        X = np.asarray(X, float); Z = np.asarray(Z, float)
        d, (nx, nz), side, beyond = self._geom(X, Z)
        downstream = side == self.down
        f = 1 - smooth((d - self.u_new) / LENGTH)
        g = 1 - smooth(beyond / FADE)
        amount = np.where(downstream, self.shift * f * g, 0.0)
        return amount * self.dir[0], amount * self.dir[1]

    def source(self, X, Z):
        dx, dz = self.displacement(X, Z)
        return X + dx, Z + dz

    def move_points(self, P):
        """New positions for mapped points (N x 2): solve p + d(p) = q by fixed-point iteration."""
        Q = np.asarray(P, float); Pn = Q.copy()
        for _ in range(8):
            dx, dz = self.displacement(Pn[:, 0], Pn[:, 1])
            Pn = np.stack([Q[:, 0] - dx, Q[:, 1] - dz], 1)
        return Pn


def load(world, structures_path, face_drop):
    meta = json.loads((world / 'metadata.json').read_text(encoding='utf-8-sig'))
    st = json.loads(open(structures_path).read())
    return DownstreamWarp(meta, st, face_drop)
