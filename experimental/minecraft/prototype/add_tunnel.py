"""A walking tunnel through rock between two points, with hanging lights and concrete portals.

Dry run unless --apply; edit only a disposable world copy with Minecraft closed. The route is a
polyline (--from, optional --via, --to) in block x,z; the floor runs at a straight grade between
the ground heights at the two ends (or --floor-from/--floor-to). Inside: rough rock walls, a
gravel floor and lanterns hanging from the ceiling on one side. Where the hill above is too thin
at the world's vertical scale, rock is added over the tunnel with sloped sides. The portals get a
concrete frame and a short cleared approach. Positions, size and finish are illustrative, from
the maintainer's photos and map; they are not surveyed.

  python add_tunnel.py --world "<copy>" --from 524,1310 --via 501,1263 --to 495,1206 [--apply]
"""
import argparse, collections, math, pathlib, sys
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, state, Y0

ROCK = ['stone', 'stone', 'andesite', 'tuff', 'diorite']


def xz(s):
    return np.array([float(v) for v in s.split(',')])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--from', dest='a', required=True, type=xz)
    p.add_argument('--via', action='append', default=[], type=xz)
    p.add_argument('--to', dest='b', required=True, type=xz)
    p.add_argument('--floor-from', type=int)
    p.add_argument('--floor-to', type=int)
    p.add_argument('--width', type=int, default=3)
    p.add_argument('--height', type=int, default=3, help='clear height inside, blocks')
    p.add_argument('--light-every', type=int, default=7)
    p.add_argument('--water-y', type=int, default=80, help='lake surface block y')
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    marker = a.world / 'waterscape-tunnel.txt'
    if marker.exists():
        raise SystemExit('A tunnel was already added to this world; start from another copy.')
    pts = [a.a] + a.via + [a.b]
    seg = [pts[i + 1] - pts[i] for i in range(len(pts) - 1)]
    L = [float(np.hypot(*v)) for v in seg]
    total = sum(L)
    w = World(a.world)
    xs = [q[0] for q in pts]; zs = [q[1] for q in pts]
    pad = a.width + 8
    w.load({(cx, cz) for cx in range((int(min(xs)) - pad) >> 4, ((int(max(xs)) + pad) >> 4) + 1)
            for cz in range((int(min(zs)) - pad) >> 4, ((int(max(zs)) + pad) >> 4) + 1)})
    soft = w.flags(lambda s: s.endswith('air') or s.endswith('_leaves') or s.endswith('_log') or s == 'minecraft:water'
                   or ('grass' in s and s != 'minecraft:grass_block') or s.endswith('_wall') or s.endswith('_bush'))

    def ground(x, z):
        col = w.peek(x, z)
        s = ~soft[col]
        return int(383 - np.argmax(s[::-1])) + Y0

    f0 = a.floor_from if a.floor_from is not None else ground(int(round(a.a[0])), int(round(a.a[1])))
    f1 = a.floor_to if a.floor_to is not None else ground(int(round(a.b[0])), int(round(a.b[1])))
    # For every column near the route: distance across, position along, and the floor height there.
    x0, x1 = int(min(xs)) - pad, int(max(xs)) + pad
    z0, z1 = int(min(zs)) - pad, int(max(zs)) + pad
    X, Z = np.meshgrid(np.arange(x0, x1 + 1), np.arange(z0, z1 + 1))
    best = np.full(X.shape, 1e9); along = np.zeros(X.shape); side = np.zeros(X.shape); cum = 0.0
    for i, (P, v) in enumerate(zip(pts, seg)):
        t = np.clip(((X - P[0]) * v[0] + (Z - P[1]) * v[1]) / (L[i] ** 2), 0, 1)
        dx = X - (P[0] + t * v[0]); dz = Z - (P[1] + t * v[1]); d = np.hypot(dx, dz)
        m = d < best
        best[m] = d[m]; along[m] = (cum + t * L[i])[m]
        side[m] = np.sign(v[0] * dz - v[1] * dx)[m]          # which side of the route
        cum += L[i]
    floor = np.rint(f0 + (f1 - f0) * along / total).astype(int)
    half = a.width / 2
    inside = best <= half
    ring = (best > half) & (best <= half + 1.2)
    top_needed = floor + a.height + 3                         # ceiling + 2 blocks of rock
    rng = np.random.default_rng(31)
    rock = [w.gid(r) for r in ROCK]
    stats = collections.Counter()
    def near_end_of(s):
        return min(s, total - s) < 3

    for (iz, ix) in np.argwhere(best <= half + 8):
        x, z = int(X[iz, ix]), int(Z[iz, ix]); f = int(floor[iz, ix]); d = best[iz, ix]
        if not w.has(x, z):
            continue
        g = ground(x, z)
        if w.name(w.peek(x, z)[a.water_y - Y0]) == 'minecraft:water':
            if inside[iz, ix]:
                stats['tunnel cells over water (check the route)'] += 1
            continue                     # never build into the lake
        col = w.column(x, z)
        # A trail mapped over the top of the rock really runs through the tunnel: make it rock.
        if best[iz, ix] <= half + 8 and not near_end_of(along[iz, ix]) and \
                w.name(col[g - Y0]) == 'minecraft:dirt_path':
            col[g - Y0] = rock[int(rng.integers(len(rock)))]
            stats['trail blocks over the tunnel removed'] += 1
        # Cover: raise thin ground over the tunnel, sloping away 1:1 beyond the walls.
        need = top_needed[iz, ix] - max(0, int(math.ceil(d - half - 1)))
        near_end = near_end_of(along[iz, ix])
        if g < need and not near_end and d <= half + 5:
            for y in range(g + 1, need + 1):
                col[y - Y0] = rock[int(rng.integers(len(rock)))]
            stats['cover blocks added'] += need - g
        if inside[iz, ix]:
            col[f - Y0] = w.gid('gravel')
            col[f - 1 - Y0] = w.gid('stone')
            col[f + 1 - Y0:f + 1 + a.height - Y0] = w.AIR
            # Rough rock ceiling.
            col[f + 1 + a.height - Y0] = rock[int(rng.integers(len(rock)))]
            stats['tunnel cells'] += 1
            if near_end:     # open approach at the portals: clear the hill above
                col[f + 1 + a.height - Y0:f + 12 - Y0] = w.AIR
        elif ring[iz, ix] and not near_end:
            for y in range(f, f + 2 + a.height):
                col[y - Y0] = rock[int(rng.integers(len(rock)))]
    # Hanging lights along one side of the ceiling, as in the photos.
    lamp = state('lantern', hanging='true', waterlogged='false')
    s = 2.0
    while s < total - 1:
        acc = 0.0
        for i, (P, v) in enumerate(zip(pts, seg)):
            if s <= acc + L[i]:
                t = (s - acc) / L[i]; c = P + v * t; n = np.array([-v[1], v[0]]) / L[i]
                q = c + n * (half - 1 if a.width > 2 else 0)
                x, z = int(round(q[0])), int(round(q[1]))
                f = int(round(f0 + (f1 - f0) * s / total))
                w.set(x, f + a.height, z, lamp)
                stats['lanterns'] += 1
                break
            acc += L[i]
        s += a.light_every
    # Concrete portal frames at both ends.
    for end, nxt in ((pts[0], pts[1]), (pts[-1], pts[-2])):
        v = (end - nxt) / np.hypot(*(end - nxt)); n = np.array([-v[1], v[0]])
        f = f0 if end is pts[0] else f1
        for k in range(-int(half) - 1, int(half) + 2):
            q = end + n * k
            x, z = int(round(q[0])), int(round(q[1]))
            for y in range(f + 1, f + a.height + 2):
                edge = abs(k) == int(half) + 1 or y == f + a.height + 1
                if edge:
                    w.set(x, y, z, 'smooth_stone'); stats['portal blocks'] += 1
    n = w.save(a.apply)
    stats['floor from/to'] = f'{f0} -> {f1}'
    stats['length (blocks)'] = round(total)
    for k, v in stats.items():
        print(f'{k}: {v}')
    print(('chunks written: ' if a.apply else 'chunks that would be written: ') + str(n))
    if a.apply:
        marker.write_text('Tunnel added (add_tunnel.py): illustrative, from the maintainer\'s photos and map.\n',
                          encoding='utf-8')


if __name__ == '__main__':
    main()
