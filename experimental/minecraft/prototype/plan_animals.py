"""Plan area-appropriate wildlife for a world and print server commands to summon it.

Gameplay extras, not data. Reads a world (it may be running; only reads) and prints
`forceload` + `summon` commands to paste or send to the server console. Animals are summoned by
the game itself, so their data is always in the running version's format, and they are marked
persistent so they stay.

Hetch Hetchy (lower montane Sierra, about 1,150 m) has mule deer, black bears, mountain lions,
bobcats, squirrels and rattlesnakes, none of which Minecraft has; they are left out rather than
faked. The stand-ins below are the closest honest matches. Sierra bighorn live far higher, so no
goats.

  python plan_animals.py --world "<world>" > animals.txt
"""
import argparse, collections, math, pathlib, random, sys
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, Y0

# species: (Minecraft id, extra NBT, count, group size range, where)
SPECIES = {
    'brush rabbit':        ('minecraft:rabbit', 'RabbitType:0', 30, (1, 3), 'brush'),
    'gray fox':            ('minecraft:fox', 'Type:"red"', 10, (1, 2), 'trees'),
    'coyote':              ('minecraft:wolf', 'variant:"minecraft:chestnut"', 6, (2, 2), 'slopes'),
    'Pacific chorus frog': ('minecraft:frog', 'variant:"minecraft:temperate"', 16, (2, 4), 'shore'),
}
SOIL = {'minecraft:gravel', 'minecraft:coarse_dirt', 'minecraft:grass_block', 'minecraft:dirt'}
NO_GO = ('polished_deepslate', 'dirt_path', 'smooth_stone', 'planks', 'stone_bricks', 'cobblestone_wall',
         'andesite_wall', 'glass', 'spruce_slab', 'chest', 'stairs')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--area', default='150,700,1300,1700', help='x0,z0,x1,z1 where animals go')
    p.add_argument('--stable', default='856,1514', help='x,z of the stable (mules and horses)')
    p.add_argument('--tunnel', default='524,1310;501,1263;495,1206', help='tunnel route for roosting bats')
    p.add_argument('--tunnel-floor', type=int, default=83)
    p.add_argument('--water-y', type=int, default=80)
    p.add_argument('--river-y', type=int, default=59)
    p.add_argument('--seed', type=int, default=11)
    a = p.parse_args()
    rng = random.Random(a.seed)
    x0, z0, x1, z1 = (int(v) for v in a.area.split(','))
    w = World(a.world)
    cache = {}

    def col(x, z):
        if not w.has(x, z):
            w.load({(x >> 4, z >> 4)})
        return w.peek(x, z) if w.has(x, z) else None

    def info(x, z):
        """(ground y, top block name, water at the surface y or None, a log within 4 blocks?)"""
        if (x, z) in cache:
            return cache[(x, z)]
        c = col(x, z)
        if c is None:
            cache[(x, z)] = None; return None
        names = [w.name(int(i)) for i in c]
        g = None; wet = None
        for i in range(383, 0, -1):
            n = names[i]
            if n == 'minecraft:water' and wet is None:
                wet = i + Y0
            if not (n.endswith('air') or n == 'minecraft:water' or n.endswith('_leaves') or n.endswith('_log')
                    or 'grass' in n and n != 'minecraft:grass_block' or n.endswith('_bush') or n == 'minecraft:lantern'):
                g = i + Y0; break
        r = (g, names[g - Y0], wet if wet is not None and wet > g else None)
        cache[(x, z)] = r
        return r

    def gentle(x, z, g):
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = info(x + dx, z + dz)
            if q is None or q[2] is not None or abs(q[0] - g) > 1:
                return False
        return True

    def near_log(x, z, g):
        for dx in range(-4, 5):
            for dz in range(-4, 5):
                c = col(x + dx, z + dz)
                if c is not None and any(w.name(int(c[y - Y0])).endswith('_log') for y in range(g + 1, g + 4)):
                    return True
        return False

    def ok_land(q):
        return q is not None and q[2] is None and not any(t in q[1] for t in NO_GO) and q[0] > a.water_y

    def where_ok(kind, x, z):
        q = info(x, z)
        if kind == 'shore':
            if q is None or q[2] is not None or any(t in q[1] for t in NO_GO):
                return None
            for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = info(x + dx, z + dz)
                if n is not None and n[2] in (a.water_y, a.river_y):
                    return q[0]
            return None
        if not ok_land(q) or not gentle(x, z, q[0]):
            return None
        if kind == 'brush' and q[1] not in SOIL:
            return None
        if kind == 'trees' and not near_log(x, z, q[0]):
            return None
        return q[0]

    spawns = []
    for label, (eid, nbt, count, (gmin, gmax), kind) in SPECIES.items():
        placed = tries = 0
        while placed < count and tries < count * 400:
            tries += 1
            x, z = rng.randint(x0, x1), rng.randint(z0, z1)
            g = where_ok(kind, x, z)
            if g is None and kind == 'shore':     # look around for the water's edge
                q = info(x, z)
                if q is None or q[0] > a.water_y + 6:
                    continue
                for r in range(1, 7):
                    hits = [(x + dx, z + dz) for dx in range(-r, r + 1) for dz in (-r, r)] + \
                           [(x + dx, z + dz) for dz in range(-r + 1, r) for dx in (-r, r)]
                    hits = [(hx, hz) for hx, hz in hits if where_ok('shore', hx, hz) is not None]
                    if hits:
                        x, z = rng.choice(hits); g = where_ok('shore', x, z); break
            if g is None:
                continue
            for _ in range(rng.randint(gmin, gmax)):
                xx, zz = x + rng.randint(-2, 2), z + rng.randint(-2, 2)
                gg = where_ok(kind, xx, zz) if (xx, zz) != (x, z) else g
                if gg is None:
                    continue
                spawns.append((label, eid, nbt, xx, gg + 1, zz)); placed += 1
                if placed >= count:
                    break
    # Mules and horses beside the stable; bats hanging from the tunnel ceiling.
    sx, sz = (int(v) for v in a.stable.split(','))
    for eid, n in (('minecraft:mule', 3), ('minecraft:horse', 2)):
        placed = tries = 0
        while placed < n and tries < 400:
            tries += 1
            ang = rng.uniform(0, 2 * math.pi); r = rng.uniform(6, 10)
            x, z = int(round(sx + r * math.cos(ang))), int(round(sz + r * math.sin(ang)))
            q = info(x, z)
            if ok_land(q) and gentle(x, z, q[0]):
                label = 'pack mule' if 'mule' in eid else 'horse'
                spawns.append((label, eid, 'Variant:0' if 'horse' in eid else '', x, q[0] + 1, z)); placed += 1
    pts = [np.array([float(v) for v in s.split(',')]) for s in a.tunnel.split(';')]
    L = [np.hypot(*(q - p)) for p, q in zip(pts, pts[1:])]; total = sum(L)
    for s in np.linspace(12, total - 12, 8):
        acc = 0
        for p0, p1, l in zip(pts, pts[1:], L):
            if s <= acc + l:
                c = p0 + (p1 - p0) * (s - acc) / l
                spawns.append(('bat', 'minecraft:bat', 'BatFlags:1b', int(round(c[0])), a.tunnel_floor + 3, int(round(c[1]))))
                break
            acc += l
    chunks = sorted({(x >> 4, z >> 4) for _, _, _, x, _, z in spawns})
    for cx, cz in chunks:
        print(f'forceload add {cx * 16} {cz * 16}')
    for label, eid, nbt, x, y, z in spawns:
        tags = 'PersistenceRequired:1b,Tags:["waterscape_wildlife"]' + (',' + nbt if nbt else '')
        print(f'summon {eid} {x + .5:.1f} {y} {z + .5:.1f} {{{tags}}}')
    print('forceload remove all')
    counts = collections.Counter(s[0] for s in spawns)
    print('# ' + ', '.join(f'{k}: {v}' for k, v in counts.items()), file=sys.stderr)


if __name__ == '__main__':
    main()
