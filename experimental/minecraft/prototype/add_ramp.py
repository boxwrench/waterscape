"""A concrete boat ramp from a road down into the lake.

Dry run unless --apply; edit only a disposable world copy with Minecraft closed. The ramp runs in
a straight line from --from (a road block) to --to (the water's edge) at an even grade, then
continues --into blocks under water. Concrete with half-slabs for an even slope; trees and ground
in the way are cleared, low ground is filled. Illustrative: placed from the maintainer's map.

  python add_ramp.py --world "<copy>" --from 713,1392 --to 729,1384 [--into 6] [--apply]
"""
import argparse, collections, math, pathlib, sys
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, state, Y0


def xz(s):
    return np.array([float(v) for v in s.split(',')])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--from', dest='a', required=True, type=xz)
    p.add_argument('--to', dest='b', required=True, type=xz)
    p.add_argument('--into', type=int, default=6, help='blocks the ramp continues under water')
    p.add_argument('--width', type=int, default=3)
    p.add_argument('--water-y', type=int, default=80)
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    marker = a.world / 'waterscape-ramp.txt'
    if marker.exists():
        raise SystemExit('A ramp was already added to this world; start from another copy.')
    WY = a.water_y
    v = a.b - a.a; Lland = float(np.hypot(*v)); u = v / Lland
    end = a.b + u * a.into; total = Lland + a.into
    w = World(a.world)
    pad = a.width + 4
    xs = [a.a[0], end[0]]; zs = [a.a[1], end[1]]
    w.load({(cx, cz) for cx in range((int(min(xs)) - pad) >> 4, ((int(max(xs)) + pad) >> 4) + 1)
            for cz in range((int(min(zs)) - pad) >> 4, ((int(max(zs)) + pad) >> 4) + 1)})
    soft = w.flags(lambda s: s.endswith('air') or s.endswith('_leaves') or s.endswith('_log') or s == 'minecraft:water'
                   or ('grass' in s and s != 'minecraft:grass_block') or s.endswith('_bush'))

    def ground(x, z):
        s = ~soft[w.peek(x, z)]
        return int(383 - np.argmax(s[::-1])) + Y0

    y0 = ground(int(round(a.a[0])), int(round(a.a[1])))          # the road surface block
    y_edge = WY                                                    # top block level with the water
    y_end = WY - max(2, round(a.into / 2))
    slab = w.gid(state('smooth_stone_slab', type='bottom', waterlogged='false'))
    slab_wet = w.gid(state('smooth_stone_slab', type='bottom', waterlogged='true'))
    stats = collections.Counter()
    X, Z = np.meshgrid(np.arange(int(min(xs)) - pad, int(max(xs)) + pad + 1),
                       np.arange(int(min(zs)) - pad, int(max(zs)) + pad + 1))
    t = np.clip(((X - a.a[0]) * v[0] + (Z - a.a[1]) * v[1]) / (Lland * total), 0, 1) * total
    px = a.a[0] + u[0] * t; pz = a.a[1] + u[1] * t
    d = np.hypot(X - px, Z - pz)
    for (iz, ix) in np.argwhere(d <= a.width / 2):
        x, z = int(X[iz, ix]), int(Z[iz, ix]); s = t[iz, ix]
        if not w.has(x, z) or s < 1:
            continue
        y = y0 + (y_edge - y0) * min(s, Lland) / Lland if s <= Lland else y_edge + (y_end - y_edge) * (s - Lland) / a.into
        base = int(math.floor(y + 1e-6)); half = (y - base) >= .5
        g = ground(x, z); col = w.column(x, z)
        wet = w.name(col[WY - Y0]) == 'minecraft:water'
        if g < base:
            col[g + 1 - Y0:base - Y0] = w.gid('stone')
        col[base - Y0] = w.gid('smooth_stone')
        above = base + 1
        if wet or base < WY:
            col[base + 1 - Y0:WY + 1 - Y0] = w.gid(state('water', level='0'))
            if half:
                col[base + 1 - Y0] = slab_wet if base + 1 <= WY else slab
            col[WY + 1 - Y0:WY + 8 - Y0] = w.AIR
            stats['under-water ramp cells'] += 1
        else:
            col[above - Y0:above + 8 - Y0] = w.AIR
            if half:
                col[above - Y0] = slab
            stats['ramp cells'] += 1
    n = w.save(a.apply)
    stats['road / water-edge / end heights'] = f'{y0} / {y_edge} / {y_end}'
    for k, val in stats.items():
        print(f'{k}: {val}')
    print(('chunks written: ' if a.apply else 'chunks that would be written: ') + str(n))
    if a.apply:
        marker.write_text('Boat ramp added (add_ramp.py): illustrative, from the maintainer\'s map.\n', encoding='utf-8')


if __name__ == '__main__':
    main()
