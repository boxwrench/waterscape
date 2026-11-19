"""Plan area-appropriate wildlife for a world and print server commands to summon it.

Gameplay extras, not data. Reads a world (it may be running; only reads) and prints
`forceload` + `summon` commands to paste or send to the server console. Animals are summoned by
the game itself, so their data is always in the running version's format, and they are marked
persistent so they stay.

Hetch Hetchy (lower montane Sierra, about 1,150 m) has mule deer, black bears, mountain lions,
bobcats, squirrels and rattlesnakes. Minecraft has none of them; the stand-ins below are the
closest models, and the Waterscape resource pack (../pack/) repaints and renames the bear (polar
bear), mountain lion (ocelot, summoned larger) and trout (salmon). Without the pack they still
work but look like the vanilla animals. Sierra bighorn live far higher, so no goats. Bears and
lions keep away from the dam, roads, dock and trail (--quiet-from).

Hikers: standing hikers are mannequins (no AI, almost free) at viewpoints, wearing the pack's
skins; walking hikers are villagers (four outfits by villager type, silent, no trades) near the
stable. Both are tagged waterscape_wildlife too.

  python plan_animals.py --world "<world>" > animals.txt
  python plan_animals.py --world "<world>" --only "black bear,mountain lion,hikers" > new.txt
"""
import argparse, collections, math, pathlib, random, sys
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, Y0

# species: (Minecraft id, extra NBT, count, group size range, where)
SCALE = 'attributes:[{{id:"minecraft:scale",base:{}d}}]'
SPECIES = {
    'brush rabbit':        ('minecraft:rabbit', 'RabbitType:0', 30, (1, 3), 'brush'),
    'gray fox':            ('minecraft:fox', 'Type:"red"', 10, (1, 2), 'trees'),
    'coyote':              ('minecraft:wolf', 'variant:"minecraft:chestnut"', 6, (2, 2), 'slopes'),
    'Pacific chorus frog': ('minecraft:frog', 'variant:"minecraft:temperate"', 16, (2, 4), 'shore'),
    'black bear':          ('minecraft:polar_bear', SCALE.format(.85), 3, (1, 1), 'trees far'),
    'mountain lion':       ('minecraft:ocelot', SCALE.format(1.6), 2, (1, 1), 'rock far'),
}
ROCK = ('stone', 'diorite', 'andesite', 'granite', 'tuff', 'calcite')
# Standing hikers: (x, z, skin, pose, held item, face toward: 'water' or (x, z)). Viewpoints in
# Hetch Hetchy block coordinates: dam crest, dam north end, Wapama trail tunnel exit and trail,
# the boat ramp and the fishing dock.
HIKERS = [
    (566, 1336, 'hiker_a', 'standing', 'spyglass', 'water'),
    (588, 1374, 'hiker_c', 'standing', '', 'water'),
    (527, 1306, 'hiker_b', 'crouching', '', 'water'),
    (499, 1203, 'hiker_c', 'standing', '', (511, 1174)),
    (511, 1174, 'hiker_b', 'standing', 'spyglass', 'water'),
    (527, 1150, 'hiker_a', 'standing', '', 'water'),
    (737, 1373, 'hiker_b', 'standing', 'fishing_rod', 'water'),
    (716, 1389, 'hiker_a', 'standing', '', 'water'),
]
WALKERS = ('plains', 'taiga', 'savanna', 'swamp')
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
    p.add_argument('--quiet-from', default='856,1514;524,1310;495,1206;737,1373;713,1392;580,1360',
                   help='x,z points bears and lions keep --quiet-distance from')
    p.add_argument('--quiet-distance', type=float, default=70)
    p.add_argument('--only', default='', help='comma list of species labels (and/or "hikers") to print')
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

    quiet = [tuple(int(v) for v in s.split(',')) for s in a.quiet_from.split(';')]
    far_road = a.quiet_distance / 3

    def road_near(x, z, r):
        for dx in range(-r, r + 1, 3):
            for dz in range(-r, r + 1, 3):
                q = info(x + dx, z + dz)
                if q is not None and any(t in q[1] for t in ('polished_deepslate', 'dirt_path', 'smooth_stone')):
                    return True
        return False

    def where_ok(kind, x, z):
        if kind.endswith(' far'):
            kind = kind[:-4]
            if any(math.hypot(x - qx, z - qz) < a.quiet_distance for qx, qz in quiet) or road_near(x, z, int(far_road)):
                return None
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
        if kind == 'rock' and not any(t in q[1] for t in ROCK):
            return None
        return q[0]

    def stand(x, z):
        """Nearest column within 4 blocks with solid footing (not a wall, water or leaves)."""
        for r in range(0, 5):
            ring = [(x + dx, z + dz) for dx in range(-r, r + 1) for dz in range(-r, r + 1) if max(abs(dx), abs(dz)) == r]
            for hx, hz in ring:
                q = info(hx, hz)
                if q is not None and q[2] is None and not any(t in q[1] for t in ('_wall', 'fence', 'leaves', 'water')):
                    return hx, hz, q[0]
        return None

    def face(x, z, target):
        if target == 'water':                             # nearest open water at lake level
            best = None
            for r in range(2, 60, 2):
                for k in range(0, 360, 10):
                    hx, hz = int(round(x + r * math.cos(math.radians(k)))), int(round(z + r * math.sin(math.radians(k))))
                    q = info(hx, hz)
                    if q is not None and q[2] in (a.water_y, a.river_y):
                        best = (hx, hz); break
                if best:
                    break
            target = best or (x, z + 1)
        dx, dz = target[0] - x, target[1] - z
        return math.degrees(math.atan2(-dx, dz))

    spawns = []
    only = {s.strip() for s in a.only.split(',') if s.strip()}
    for label, (eid, nbt, count, (gmin, gmax), kind) in SPECIES.items():
        if only and label not in only:
            continue
        # Species added later draw from their own stream, so earlier species stay put and a
        # run with --only places them exactly where a full run would.
        sr = random.Random(f'{a.seed}:{label}') if kind.endswith(' far') else rng
        placed = tries = 0
        while placed < count and tries < count * 400:
            tries += 1
            x, z = sr.randint(x0, x1), sr.randint(z0, z1)
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
                        x, z = sr.choice(hits); g = where_ok('shore', x, z); break
            if g is None:
                continue
            for _ in range(sr.randint(gmin, gmax)):
                xx, zz = x + sr.randint(-2, 2), z + sr.randint(-2, 2)
                gg = where_ok(kind, xx, zz) if (xx, zz) != (x, z) else g
                if gg is None:
                    continue
                spawns.append((label, eid, nbt, xx, gg + 1, zz)); placed += 1
                if placed >= count:
                    break
    # Mules and horses beside the stable; bats hanging from the tunnel ceiling.
    sx, sz = (int(v) for v in a.stable.split(','))
    for eid, n in (('minecraft:mule', 3), ('minecraft:horse', 2)) if not only else ():
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
    for s in (np.linspace(12, total - 12, 8) if not only else ()):
        acc = 0
        for p0, p1, l in zip(pts, pts[1:], L):
            if s <= acc + l:
                c = p0 + (p1 - p0) * (s - acc) / l
                spawns.append(('bat', 'minecraft:bat', 'BatFlags:1b', int(round(c[0])), a.tunnel_floor + 3, int(round(c[1]))))
                break
            acc += l
    # Hikers last, so the animals above stay where earlier runs put them.
    if 'hikers' in only or not only:
        for x, z, skin, pose, item, target in HIKERS:
            st = stand(x, z)
            if st is None:
                print(f'# no footing near {x},{z}', file=sys.stderr); continue
            x, z, g = st
            nbt = (f'profile:{{texture:"waterscape:entity/{skin}",model:"wide"}},hide_description:1b,immovable:1b,'
                   f'pose:"{pose}",Invulnerable:1b,Rotation:[{face(x, z, target):.0f}f,0f]')
            if item:
                nbt += f',equipment:{{mainhand:{{id:"minecraft:{item}",count:1}}}}'
            spawns.append(('standing hiker', 'minecraft:mannequin', nbt, x, g + 1, z))
        wr = random.Random(f'{a.seed}:walkers')
        for typ in WALKERS:
            for _ in range(400):
                ang = wr.uniform(0, 2 * math.pi); r = wr.uniform(8, 16)
                x, z = int(round(sx + r * math.cos(ang))), int(round(sz + r * math.sin(ang)))
                q = info(x, z)
                if q is not None and q[2] is None and gentle(x, z, q[0]) and not any(t in q[1] for t in ('_wall', 'fence', 'leaves')):
                    spawns.append(('walking hiker', 'minecraft:villager',
                                   f'VillagerData:{{type:"minecraft:{typ}",profession:"minecraft:none",level:1}},Silent:1b',
                                   x, q[0] + 1, z))
                    break
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
