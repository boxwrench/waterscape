"""A gated spillway beside a dam: drum gates between piers, a spill face, a dry channel and a chute.

Dry run unless --apply; edit only a disposable world copy with Minecraft closed. --gates-from (at
the dam) and --gates-to give the line of the gate crest in block x,z; the downstream side is to
the right of that direction unless --flip. Along the line: --bays drum gates between round-nosed
piers with railings, a stepped spill face, and a dry rock channel that runs back along the gates
to the dam. --chute points carry the channel under the dam road (which becomes a bridge deck)
and down the dam's downstream face. Water cut off behind the gates is filled as ground, and the
lake is checked to stay watertight. The gates are drawn closed and the channel dry.

Placed from the USGS NAIP aerial image and the maintainer's photo; the number of gates is what
both show, everything else (sizes, heights, materials) is illustrative and not surveyed.

  python add_spillway.py --world "<copy>" --gates-from 594,1401.5 --gates-to 626,1389.5 \\
      --chute 588,1407 --chute 570,1405 [--apply]
"""
import argparse, collections, pathlib, sys
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, state, Y0

ROCK = ['stone', 'stone', 'diorite', 'andesite', 'calcite', 'tuff']
DIRS = {'north': (0, -1), 'south': (0, 1), 'west': (-1, 0), 'east': (1, 0)}


def xz(s):
    return np.array([float(v) for v in s.split(',')])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--gates-from', required=True, type=xz, help='gate line start, at the dam')
    p.add_argument('--gates-to', required=True, type=xz)
    p.add_argument('--flip', action='store_true', help='downstream is to the left of the gate line')
    p.add_argument('--bays', type=int, default=3)
    p.add_argument('--chute', action='append', default=[], type=xz,
                   help='points the channel follows from the gates\' dam end down to the canyon')
    p.add_argument('--channel-far', type=xz, default=np.array([12.0, 6.8]),
                   help='far edge of the channel, blocks downstream of the gate line, at the dam end and at '
                        'the far end (keep it clear of the road)')
    p.add_argument('--chute-half', type=float, default=2.5, help='half width of the chute, blocks')
    p.add_argument('--water-y', type=int, default=80, help='lake surface block y')
    p.add_argument('--crest-y', type=int, default=83, help='dam crest (road) block y')
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    marker = a.world / 'waterscape-spillway.txt'
    if marker.exists():
        raise SystemExit('A spillway was already added to this world; start from another copy.')
    WY, CY = a.water_y, a.crest_y
    FLOOR = WY - 4                       # channel floor below the gates
    A, B = a.gates_from, a.gates_to
    L = float(np.hypot(*(B - A))); v = (B - A) / L
    n = np.array([-v[1], v[0]]) * (-1 if a.flip else 1)            # downstream
    # Cross-section, in blocks downstream of the gate line.
    S_GATE0, S_GATE1, S_FACE1 = -0.5, 1.5, 4.5
    def far(u):
        return a.channel_far[0] + (a.channel_far[1] - a.channel_far[0]) * np.clip(u / L, 0, 1)
    centre = A + n * (S_FACE1 + far(0)) / 2
    route = [centre] + a.chute
    seg = [route[i + 1] - route[i] for i in range(len(route) - 1)]
    segL = [float(np.hypot(*s)) for s in seg]
    CH_HALF = a.chute_half

    w = World(a.world)
    allp = np.array([A, B, A + n * (far(0) + 3), B + n * (far(L) + 3), A - n * 3, B - n * 3] + list(route))
    x0, z0 = np.floor(allp.min(axis=0)).astype(int) - 6
    x1, z1 = np.ceil(allp.max(axis=0)).astype(int) + 6
    w.load({(cx, cz) for cx in range(x0 >> 4, (x1 >> 4) + 1) for cz in range(z0 >> 4, (z1 >> 4) + 1)})
    water = w.gid('water')                # 26.3 stores the default state as a bare name
    # Register every state this script places before building the lookup tables below.
    for f_ in ('north', 'south', 'east', 'west'):
        w.gid(state('polished_andesite_stairs', facing=f_, half='bottom', shape='straight', waterlogged='false'))
    for bits in range(16):
        w.gid(state('iron_bars', waterlogged='false',
                    **{d: str(bool(bits >> i & 1)).lower() for i, d in enumerate(DIRS)}))
    for b in ROCK + ['smooth_stone', 'polished_andesite', 'light_gray_concrete', 'coarse_dirt']:
        w.gid(b)
    soft = w.flags(lambda s: s.endswith('air') or s.endswith('_leaves') or s.endswith('_log') or s == 'minecraft:water'
                   or ('grass' in s and s != 'minecraft:grass_block') or s.endswith('_bush') or s == 'minecraft:snow')
    tree = w.flags(lambda s: s.endswith('_leaves') or s.endswith('_log') or s.endswith('_bush')
                   or ('grass' in s and s != 'minecraft:grass_block'))

    def ground(col):
        s = ~soft[col]
        return int(383 - np.argmax(s[::-1])) + Y0

    X, Z = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(z0, z1 + 1) + .5)
    U = (X - A[0]) * v[0] + (Z - A[1]) * v[1]
    S = (X - A[0]) * n[0] + (Z - A[1]) * n[1]
    # Distance to the chute route and position along it.
    dch = np.full(X.shape, 1e9); tch = np.zeros(X.shape); cum = 0.0
    for P, sv, sl in zip(route, seg, segL):
        t = np.clip(((X - P[0]) * sv[0] + (Z - P[1]) * sv[1]) / sl ** 2, 0, 1)
        d = np.hypot(X - (P[0] + t * sv[0]), Z - (P[1] + t * sv[1]))
        m = d < dch; dch[m] = d[m]; tch[m] = (cum + t * sl)[m]; cum += sl
    bay = L / a.bays
    piers = [k * bay for k in range(a.bays + 1)]
    rng = np.random.default_rng(47)
    rock = [w.gid(r) for r in ROCK]
    stats = collections.Counter()
    concrete = w.gid('smooth_stone'); face = w.gid('polished_andesite'); steel = w.gid('light_gray_concrete')

    def rock_fill(col, ylo, yhi):
        for y in range(ylo, yhi + 1):
            col[y - Y0] = rock[int(rng.integers(len(rock)))]

    def pier_at(u, s):
        """Pier footprint: two blocks thick, a round nose upstream, running down the spill face."""
        for k, pu in enumerate(piers):
            du = u - pu
            lo = -1.0 if k else 0.0                      # the dam-end pier stays on the dam side
            hi = 1.0 if k < a.bays else 2.0               # the far abutment is thicker
            if lo <= du <= hi and S_GATE0 <= s <= S_FACE1:
                return k
            if S_GATE0 - 1.3 <= s < S_GATE0 and k and k < a.bays and np.hypot(du, s - S_GATE0) <= 1.3:
                return k
        return None

    rails = []
    # Trees in and just around the works go entirely.
    for (iz, ix) in np.argwhere(((U > -2) & (U < L + 4) & (S > S_GATE0 - 4) & (S < far(U) + 3)) |
                                ((dch <= CH_HALF + 4) & (tch >= 0.5))):
        x, z = int(X[iz, ix]), int(Z[iz, ix])
        if w.has(x, z):
            col = w.column(x, z)
            m = tree[col]; m[:WY - Y0] = False
            if m.any():
                col[m] = w.AIR; stats['tree blocks cleared'] += int(m.sum())

    # Pass 1: the gate structure and the channel beside it.
    for (iz, ix) in np.argwhere((U > -1.5) & (U < L + 3) & (S > S_GATE0 - 1.5) & (S < far(U) + 1.5)):
        x, z = int(X[iz, ix]), int(Z[iz, ix]); u, s = U[iz, ix], S[iz, ix]
        if not w.has(x, z):
            continue
        col = w.column(x, z)
        if u < 0 and ground(col) >= CY - 1:
            continue                                         # the dam itself
        k = pier_at(u, s)
        if k is not None:
            top = CY if s < S_GATE1 + 1 else WY + 1
            col[WY - 12 - Y0:top + 1 - Y0] = concrete
            col[top + 1 - Y0:top + 12 - Y0] = w.AIR
            if s < S_GATE1 + 1:
                rails.append((x, top + 1, z))
            stats['pier cells'] += 1
        elif u < 0 or u > L or s < S_GATE0:
            continue                                         # the dam, the land beyond, or the lake
        elif S_GATE0 <= s < S_GATE1:                          # drum gate, raised: its top just clears the lake
            col[WY - 12 - Y0:WY - 2 - Y0] = concrete
            col[WY - 2 - Y0:WY + 2 - Y0] = steel
            col[WY + 2 - Y0:WY + 14 - Y0] = w.AIR
            stats['gate cells'] += 1
        elif S_GATE1 <= s < S_FACE1:                          # stepped spill face down to the channel
            step = int((s - S_GATE1) // 1)                    # 0, 1, 2
            top = WY - step
            col[WY - 12 - Y0:top + 1 - Y0] = face
            col[top + 1 - Y0:WY + 14 - Y0] = w.AIR
            col[top + 1 - Y0] = w.gid(state('polished_andesite_stairs', facing=facing(-n), half='bottom',
                                            shape='straight', waterlogged='false'))
            stats['spill face cells'] += 1
        elif S_FACE1 <= s < far(u):                           # channel floor, rough rock, falling to the dam
            if u > L - 1:
                col[FLOOR - Y0:WY + 2 - Y0] = concrete        # the far end is closed
                continue
            fl = FLOOR + (1 if u > L / 2 else 0)
            rock_fill(col, FLOOR - 4, fl)
            col[fl + 1 - Y0:WY + 14 - Y0] = w.AIR
            stats['channel cells'] += 1
        else:                                                 # far bank: rock up to the ground
            g = ground(col)
            rock_fill(col, FLOOR - 4, max(g, WY + 1))
            col[max(g, WY + 1) + 1 - Y0:WY + 14 - Y0][tree[col[max(g, WY + 1) + 1 - Y0:WY + 14 - Y0]]] = w.AIR
            stats['channel bank cells'] += 1

    # Pass 2: the chute under the road and down the dam face, past the gates' dam end. The floor
    # follows the ground along the route, two blocks down, never rising, ending level with the toe.
    def top_at(q):
        x, z = int(np.floor(q[0])), int(np.floor(q[1]))
        return ground(w.peek(x, z)) if w.has(x, z) else None
    toe = top_at(route[-1])
    prof = []; run = FLOOR; past_road = False
    for P, sv, sl in zip(route, seg, segL):
        for t in np.arange(0, sl, 1.0):
            g = top_at(P + sv * t / sl)
            if g is not None and g >= CY - 1:
                past_road = True
            elif g is not None and past_road:
                run = min(run, g - 2)
            prof.append(max(run, toe))
    prof.append(max(run, toe))
    floors = {}
    for (iz, ix) in np.argwhere((dch <= CH_HALF + 1) & (tch >= 0.5)):
        x, z = int(X[iz, ix]), int(Z[iz, ix])
        if not w.has(x, z) or (U[iz, ix] >= 0 and S[iz, ix] < far(U[iz, ix]) + 1.5 and U[iz, ix] <= L):
            continue
        g = ground(w.peek(x, z))
        f = prof[min(len(prof) - 1, int(round(tch[iz, ix])))]
        floors[(x, z)] = (f if dch[iz, ix] <= CH_HALF else None, tch[iz, ix], g)
    f_at = {q: f for q, (f, t, g) in floors.items() if f is not None}
    for (x, z), (f, t, g) in floors.items():
        col = w.column(x, z)
        if f is None:                                         # side wall: concrete up to a low kerb
            near = [f_at[q] for q in ((x + dx, z + dz) for dx, dz in DIRS.values()) if q in f_at]
            if not near or g >= CY - 1:
                continue                                      # under the road the dam is the wall
            fl = min(near)
            top = max(g + 1, fl + 3)
            col[fl - Y0:top + 1 - Y0] = concrete
            col[top + 1 - Y0:top + 10 - Y0][tree[col[top + 1 - Y0:top + 10 - Y0]]] = w.AIR
            stats['chute wall cells'] += 1
            continue
        f = f_at[(x, z)]
        col[f - 2 - Y0:f + 1 - Y0] = face
        if g >= CY - 1:                                       # under the road: keep a two-block deck
            col[f + 1 - Y0:CY - 1 - Y0] = w.AIR
            stats['cells under the road bridge'] += 1
        else:
            col[f + 1 - Y0:max(g, f) + 12 - Y0] = w.AIR
            stats['chute cells'] += 1
    for (x, z), f in f_at.items():                            # half steps where the floor drops one block
        for dx, dz in DIRS.values():
            if f_at.get((x + dx, z + dz)) == f + 1 and w.name(w.get(x, f + 1, z)) == 'minecraft:air':
                w.set(x, f + 1, z, state('polished_andesite_stairs', facing=facing(np.array([dx, dz])),
                                         half='bottom', shape='straight', waterlogged='false'))
                stats['chute steps'] += 1
                break

    # Pass 3: lake water now cut off behind the gates becomes ground; check the lake is sealed.
    def wet(x, z):
        return w.has(x, z) and w.get(x, WY, z) == water
    seed = A + v * L / 2 - n * 6                             # open water off the middle of the gates
    seed = (int(np.floor(seed[0])), int(np.floor(seed[1])))
    if not wet(*seed):
        raise SystemExit(f'No lake water at y={WY} upstream of the gates (looked at {seed}); check the gate line.')
    lake, todo = set(), [seed]
    while todo:
        q = todo.pop()
        if q in lake or not (x0 <= q[0] <= x1 and z0 <= q[1] <= z1) or not wet(*q):
            continue
        lake.add(q)
        todo += [(q[0] + dx, q[1] + dz) for dx, dz in DIRS.values()]
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if wet(x, z) and (x, z) not in lake:
                col = w.column(x, z)
                ys = [y for y in range(WY - 12, WY + 1) if col[y - Y0] == water]
                rock_fill(col, min(ys), WY)
                col[WY + 1 - Y0] = w.gid('coarse_dirt') if rng.random() < .4 else rock[int(rng.integers(len(rock)))]
                stats['cut-off water columns filled'] += 1
    leaks = 0
    for (x, z) in lake:
        for dx, dz in DIRS.values():
            q = (x + dx, z + dz)
            if q in lake or not w.has(*q):
                continue
            if soft[w.get(q[0], WY, q[1])] and w.get(q[0], WY, q[1]) != water:
                leaks += 1
    stats['lake leaks (must be 0)'] = leaks
    if leaks and a.apply:
        raise SystemExit('The lake would leak at the gates; nothing written.')

    # Railings round the pier tops (offline blocks do not connect themselves).
    rs = set(rails)
    edge = {(x, y, z) for x, y, z in rails if any((x + dx, y, z + dz) not in rs for dx, dz in DIRS.values())}
    for x, y, z in edge:                                      # only the edge of each pier top
        sides = {d: ('true' if (x + dx, y, z + dz) in edge else 'false') for d, (dx, dz) in DIRS.items()}
        w.set(x, y, z, state('iron_bars', waterlogged='false', **sides))
        stats['railing blocks'] += 1
    nch = w.save(a.apply)
    stats['gate line length (blocks)'] = round(L)
    for k_, val in stats.items():
        print(f'{k_}: {val}')
    print(('chunks written: ' if a.apply else 'chunks that would be written: ') + str(nch))
    if a.apply:
        marker.write_text('Spillway added (add_spillway.py): drum gates, piers, channel and chute; illustrative, '
                          'placed from the USGS NAIP image and the maintainer\'s photo.\n', encoding='utf-8')


def facing(d):
    """Stair facing whose tall side points along d (the way up)."""
    dx, dz = float(d[0]), float(d[1])
    if abs(dx) > abs(dz):
        return 'east' if dx > 0 else 'west'
    return 'south' if dz > 0 else 'north'


if __name__ == '__main__':
    main()
