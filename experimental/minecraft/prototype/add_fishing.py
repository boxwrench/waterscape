"""Gameplay extras: fishing docks with a boat and rods, and schools of fish in the lake.

Not map data. Dry run unless --apply; edit only a disposable world copy with Minecraft closed.
Minecraft has no trout, so the fish are salmon (trout are in the salmon family). They are marked
as bucket-caught so they do not despawn. Each spot gets a short dock, a moored spruce boat, a
chest of fishing rods, a bench and a lantern. Real Hetch Hetchy allows fishing from the shore
only, with no boats; the boats are a game liberty.

  python add_fishing.py --world "<copy>" --spot 731,1386 --spot 513,1228 --fish 150 [--apply]
"""
import argparse, collections, math, pathlib, random, sys
import numpy as np
from nbtlib import Compound, String, List, Double, Float, Byte, Int, Short, IntArray
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, state, Y0

DIRS = {'east': (1, 0), 'west': (-1, 0), 'south': (0, 1), 'north': (0, -1)}
OPP = {'east': 'west', 'west': 'east', 'south': 'north', 'north': 'south'}
YAW = {'south': 0.0, 'west': 90.0, 'north': 180.0, 'east': -90.0}    # Minecraft yaw facing each way


def uuid_ints(rng):
    return IntArray([rng.randint(-2**31, 2**31 - 1) for _ in range(4)])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--spot', action='append', default=[], help='x,z of a gentle shore block; repeatable')
    p.add_argument('--fish', type=int, default=150)
    p.add_argument('--water-y', type=int, default=80, help='lake surface block y')
    p.add_argument('--seed', type=int, default=7)
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    marker = a.world / 'waterscape-fishing.txt'
    if marker.exists():
        raise SystemExit('Fishing extras already added to this world; start from another copy.')
    spots = [tuple(int(v) for v in s.split(',')) for s in a.spot] or [(731, 1386), (513, 1228)]
    rng = random.Random(a.seed)
    w = World(a.world)
    WY = a.water_y
    stats = collections.Counter()

    def load_near(x, z, r):
        w.load({(cx, cz) for cx in range((x - r) >> 4, ((x + r) >> 4) + 1) for cz in range((z - r) >> 4, ((z + r) >> 4) + 1)})

    def info(x, z):
        """(ground y ignoring water and plants, is lake water at the surface)."""
        if not w.has(x, z):
            load_near(x, z, 0)
            if not w.has(x, z):
                return None, False
        col = w.peek(x, z)
        names = [w.name(int(i)) for i in col[WY - Y0 - 60:WY - Y0 + 40]]
        g = None
        for i in range(len(names) - 1, -1, -1):
            n = names[i]
            if not (n.endswith('air') or n == 'minecraft:water' or n.endswith('_leaves') or n.endswith('_log')
                    or 'grass' in n and n != 'minecraft:grass_block' or n.endswith('_bush')):
                g = WY - 60 + i; break
        return g, names[60] == 'minecraft:water'

    def clear_above(x, z, y0, h=5):
        col = w.column(x, z)
        col[y0 - Y0:y0 + h - Y0] = w.AIR

    for sx, sz in spots:
        load_near(sx, sz, 24)
        g0, wet0 = info(sx, sz)
        if g0 is None or wet0:
            print(f'spot {sx},{sz}: not a shore block (ground {g0}, water {wet0}); skipped'); continue
        # The water direction: the axis with the most deep-enough lake within 10 blocks.
        best = None
        for name, (dx, dz) in DIRS.items():
            n = 0
            for i in range(1, 11):
                g, wet = info(sx + dx * i, sz + dz * i)
                n += wet and g is not None and g <= WY - 2
            if best is None or n > best[0]:
                best = (n, name)
        if best[0] < 5:
            print(f'spot {sx},{sz}: no open water in front; skipped'); continue
        face = best[1]; dx, dz = DIRS[face]; px, pz = -dz, dx          # along and across the dock
        L, half = 9, 1
        deck_top = state('spruce_slab', type='top', waterlogged='true')
        post_wet = state('spruce_fence', waterlogged='true', east='false', west='false', north='false', south='false')
        post_dry = state('spruce_fence', waterlogged='false', east='false', west='false', north='false', south='false')
        end = None
        for i in range(0, L):
            for j in range(-half, half + 1):
                x, z = sx + dx * i + px * j, sz + dz * i + pz * j
                g, wet = info(x, z)
                if g is None:
                    continue
                if wet:
                    w.set(x, WY, z, deck_top)
                    clear_above(x, z, WY + 1)
                    if abs(j) == half and i % 3 == 0:
                        for y in range(g + 1, WY):
                            w.set(x, y, z, post_wet)
                else:
                    w.set(x, max(g, WY), z, 'spruce_planks')
                    for y in range(g + 1, WY):
                        w.set(x, y, z, 'spruce_planks')
                    clear_above(x, z, max(g, WY) + 1)
                stats['dock blocks'] += 1
            end = (sx + dx * (L - 1), sz + dz * (L - 1))
        # A lantern on a post at the far corner.
        lx, lz = end[0] + px * half, end[1] + pz * half
        w.set(lx, WY + 1, lz, post_dry); w.set(lx, WY + 2, lz, state('lantern', hanging='false', waterlogged='false'))
        # The boat, moored alongside the outer half of the dock.
        bx = sx + dx * (L - 3) - px * (half + 1) + .5; bz = sz + dz * (L - 3) - pz * (half + 1) + .5
        w.add_entity(Compound({
            'id': String('minecraft:spruce_boat'), 'UUID': uuid_ints(rng),
            'Pos': List[Double]([Double(bx), Double(WY + .6), Double(bz)]),
            'Motion': List[Double]([Double(0), Double(0), Double(0)]),
            'Rotation': List[Float]([Float(YAW[face]), Float(0)]), 'Invulnerable': Byte(0)}))
        stats['boats'] += 1
        # On the shore behind the dock: a chest of rods on one side, a bench on the other.
        back = [(sx - dx * k, sz - dz * k) for k in (1, 2)]
        for side, what in ((1, 'chest'), (-1, 'bench')):
            for k, (cx_, cz_) in enumerate(back):
                x, z = cx_ + px * (half + 1) * side, cz_ + pz * (half + 1) * side
                g, wet = info(x, z)
                if g is None or wet:
                    continue
                clear_above(x, z, g + 1)
                if what == 'chest' and k == 0:
                    w.set(x, g + 1, z, state('chest', facing=face, type='single', waterlogged='false'))
                    w.add_block_entity(Compound({
                        'id': String('minecraft:chest'), 'x': Int(x), 'y': Int(g + 1), 'z': Int(z),
                        'Items': List[Compound]([Compound({'Slot': Byte(s), 'id': String('minecraft:fishing_rod'),
                                                           'count': Int(1)}) for s in range(4)])}))
                    stats['chests of rods'] += 1
                elif what == 'bench':
                    # Stairs whose back is to the land, so a seat looks over the water.
                    w.set(x, g + 1, z, state('spruce_stairs', facing=OPP[face], half='bottom', shape='straight',
                                             waterlogged='false'))
                    stats['bench blocks'] += 1
        print(f'spot {sx},{sz}: dock {L} blocks {face}, boat, chest, bench, lantern')

    # Fish: schools of 4-7 salmon, most near the spots, the rest across the lake.
    placed = 0; tries = 0
    xs = [s[0] for s in spots]; zs = [s[1] for s in spots]
    while placed < a.fish and tries < a.fish * 40:
        tries += 1
        if rng.random() < .6:
            cx, cz = rng.choice(spots); cx += rng.randint(-180, 180); cz += rng.randint(-180, 180)
        else:
            cx, cz = rng.randint(min(xs) - 50, 2500), rng.randint(min(zs) - 700, max(zs) + 150)
        if cx < 0 or cz < 0:
            continue
        g, wet = info(cx, cz)
        if not wet or g is None or WY - g < 5:
            continue
        for _ in range(rng.randint(4, 7)):
            fx, fz = cx + rng.uniform(-3, 3), cz + rng.uniform(-3, 3)
            gg, ww = info(int(math.floor(fx)), int(math.floor(fz)))
            if not ww or gg is None or WY - gg < 3:
                continue
            fy = rng.uniform(gg + 1.5, WY - .8)
            w.add_entity(Compound({
                'id': String('minecraft:salmon'), 'UUID': uuid_ints(rng),
                'Pos': List[Double]([Double(fx), Double(fy), Double(fz)]),
                'Motion': List[Double]([Double(0), Double(0), Double(0)]),
                'Rotation': List[Float]([Float(rng.uniform(-180, 180)), Float(0)]),
                'Health': Float(3.0), 'Air': Short(300), 'FromBucket': Byte(1), 'PersistenceRequired': Byte(1),
                'type': String(rng.choice(['small', 'medium', 'medium', 'large']))}))
            placed += 1
            if placed >= a.fish:
                break
    stats['salmon'] = placed

    n = w.save(a.apply)
    for k, v in stats.items():
        print(f'{k}: {v}')
    print(('chunks written: ' if a.apply else 'chunks that would be written: ') + str(n))
    if a.apply:
        marker.write_text('Fishing extras (add_fishing.py): docks, boats, rods, salmon. Gameplay props, not map data.\n',
                          encoding='utf-8')


if __name__ == '__main__':
    main()
