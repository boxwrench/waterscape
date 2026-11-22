"""A gated spillway beside a dam: drum gates, a dry channel, an arch under the road and a rock run-out.

Dry run unless --apply; edit only a disposable world copy with Minecraft closed.

- Gates: --gates-from (at the dam) and --gates-to give the line of the gate crest in block x,z;
  the downstream side is to the right of that direction unless --flip. Along it: --bays drum
  gates between round-nosed piers with railings, a stepped spill face, and a dry rock channel
  that runs back along the gates to the dam, narrowing to stay clear of the road (--channel-far).
- Arch: the channel passes under the dam road through an arched opening and comes out at
  --portal, on the far side of the road, in a concrete headwall.
- Rock: --face-edge (two points, from the crest down) is where the dam's downstream face meets
  the canyon wall. Dam face on the portal's side of that line becomes a granite slope that
  rises from the face to the ground beyond. The dam face on the other side is left as it is.
- Run-out: --falls points lead the spill route from the portal down the rock to the canyon as
  a rough gully that drops in ledges.

Water cut off behind the gates is filled as ground, and the script refuses to write if the lake
would leak. The gates are drawn closed and the spillway dry.

Placed from the USGS NAIP aerial image and the maintainer's photos; the number of gates is what
both show, everything else (sizes, heights, materials, the run-out's course) is illustrative and
not surveyed.

  python add_spillway.py --world "<copy>" --gates-from 594,1401.5 --gates-to 626,1389.5 \\
      --portal 587.5,1409 --face-edge 587,1403 --face-edge 565,1373.5 \\
      --falls 578,1406 --falls 567,1399 [--apply]
"""
import argparse, collections, pathlib, sys
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, state, Y0

ROCK = ['stone', 'stone', 'diorite', 'andesite', 'calcite', 'tuff']
WORN = ['diorite', 'polished_diorite', 'calcite', 'diorite', 'stone']      # water-worn gully floor
DIRS = {'north': (0, -1), 'south': (0, 1), 'west': (-1, 0), 'east': (1, 0)}


def xz(s):
    return np.array([float(v) for v in s.split(',')])


def polyline(pts, X, Z):
    """Distance to a polyline and position along it, for every column centre."""
    d = np.full(X.shape, 1e9); t = np.zeros(X.shape); cum = 0.0
    for P, Q in zip(pts[:-1], pts[1:]):
        sv = Q - P; sl = float(np.hypot(*sv))
        tt = np.clip(((X - P[0]) * sv[0] + (Z - P[1]) * sv[1]) / sl ** 2, 0, 1)
        dd = np.hypot(X - (P[0] + tt * sv[0]), Z - (P[1] + tt * sv[1]))
        m = dd < d; d[m] = dd[m]; t[m] = (cum + tt * sl)[m]; cum += sl
    return d, t, cum


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--gates-from', required=True, type=xz, help='gate line start, at the dam')
    p.add_argument('--gates-to', required=True, type=xz)
    p.add_argument('--flip', action='store_true', help='downstream is to the left of the gate line')
    p.add_argument('--bays', type=int, default=3)
    p.add_argument('--channel-far', type=xz, default=np.array([12.0, 6.8]),
                   help='far edge of the channel, blocks downstream of the gate line, at the dam end and at '
                        'the far end (keep it clear of the road)')
    p.add_argument('--portal', required=True, type=xz, help='mouth of the arch on the far side of the road')
    p.add_argument('--arch-half', type=float, default=3.0, help='half width of the arch, blocks')
    p.add_argument('--face-edge', action='append', default=[], type=xz,
                   help='two points, crest first: where the dam face meets the rock')
    p.add_argument('--falls', action='append', default=[], type=xz,
                   help='points the spill route follows from the portal down the rock to the canyon')
    p.add_argument('--falls-half', type=float, default=2.0)
    p.add_argument('--water-y', type=int, default=80, help='lake surface block y')
    p.add_argument('--crest-y', type=int, default=83, help='dam crest (road) block y')
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    if len(a.face_edge) != 2:
        p.error('give --face-edge twice (crest end first)')
    marker = a.world / 'waterscape-spillway.txt'
    if marker.exists():
        raise SystemExit('A spillway was already added to this world; start from another copy.')
    WY, CY = a.water_y, a.crest_y
    FLOOR = WY - 4                       # channel floor below the gates
    A, B = a.gates_from, a.gates_to
    L = float(np.hypot(*(B - A))); v = (B - A) / L
    n = np.array([-v[1], v[0]]) * (-1 if a.flip else 1)            # downstream
    S_GATE0, S_GATE1, S_FACE1 = -0.5, 1.5, 4.5                     # cross-section, blocks downstream

    def far(u):
        return a.channel_far[0] + (a.channel_far[1] - a.channel_far[0]) * np.clip(u / L, 0, 1)
    centre = A + n * (S_FACE1 + far(0)) / 2
    E0, E1 = a.face_edge
    E1 = E1 + (E1 - E0) * 0.5                                         # run the edge on past the toe

    w = World(a.world)
    allp = np.array([A, B, A + n * (far(0) + 3), B + n * (far(L) + 3), A - n * 3, B - n * 3,
                     a.portal, E0, E1] + a.falls)
    x0, z0 = np.floor(allp.min(axis=0)).astype(int) - 14
    x1, z1 = np.ceil(allp.max(axis=0)).astype(int) + 14
    w.load({(cx, cz) for cx in range(x0 >> 4, (x1 >> 4) + 1) for cz in range(z0 >> 4, (z1 >> 4) + 1)})
    water = w.gid('water')                # 26.3 stores the default state as a bare name
    # Register every state this script places before building the lookup tables below.
    for f_ in ('north', 'south', 'east', 'west'):
        w.gid(state('polished_andesite_stairs', facing=f_, half='bottom', shape='straight', waterlogged='false'))
    for bits in range(16):
        w.gid(state('iron_bars', waterlogged='false',
                    **{d: str(bool(bits >> i & 1)).lower() for i, d in enumerate(DIRS)}))
    for b in ROCK + WORN + ['smooth_stone', 'polished_andesite', 'light_gray_concrete', 'coarse_dirt']:
        w.gid(b)
    soft = w.flags(lambda s: s.endswith('air') or s.endswith('_leaves') or s.endswith('_log') or s == 'minecraft:water'
                   or ('grass' in s and s != 'minecraft:grass_block') or s.endswith('_bush') or s == 'minecraft:snow')
    tree = w.flags(lambda s: s.endswith('_leaves') or s.endswith('_log') or s.endswith('_bush')
                   or ('grass' in s and s != 'minecraft:grass_block'))
    concrete = w.gid('smooth_stone'); face = w.gid('polished_andesite'); steel = w.gid('light_gray_concrete')

    def ground(col):
        s = ~soft[col]
        return int(383 - np.argmax(s[::-1])) + Y0

    X, Z = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(z0, z1 + 1) + .5)
    U = (X - A[0]) * v[0] + (Z - A[1]) * v[1]
    S = (X - A[0]) * n[0] + (Z - A[1]) * n[1]
    dpass, tpass, Lpass = polyline([centre, a.portal], X, Z)
    pdir = (a.portal - centre) / Lpass
    beyond = (X - a.portal[0]) * pdir[0] + (Z - a.portal[1]) * pdir[1] > 0.5     # past the portal
    in_arch = (dpass <= a.arch_half + 1) & ~beyond
    dfall, tfall, Lfall = polyline([a.portal] + a.falls, X, Z) if a.falls else (np.full(X.shape, 1e9), X * 0, 0)
    bay = L / a.bays
    piers = [k * bay for k in range(a.bays + 1)]
    rng = np.random.default_rng(47)
    rock = [w.gid(r) for r in ROCK]
    worn = [w.gid(r) for r in WORN]
    stats = collections.Counter()

    def rock_fill(col, ylo, yhi, pal=rock):
        for y in range(ylo, yhi + 1):
            col[y - Y0] = pal[int(rng.integers(len(pal)))]

    def clear_trees(col, above):
        m = tree[col]; m[:above - Y0] = False
        if m.any():
            col[m] = w.AIR; stats['tree blocks cleared'] += int(m.sum())

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

    # Trees in and just around the works go entirely.
    for (iz, ix) in np.argwhere(((U > -2) & (U < L + 4) & (S > S_GATE0 - 4) & (S < far(U) + 3)) |
                                (dpass <= a.arch_half + 3) | (dfall <= a.falls_half + 3)):
        x, z = int(X[iz, ix]), int(Z[iz, ix])
        if w.has(x, z):
            clear_trees(w.column(x, z), WY)

    # Pass 1: the canyon wall beside the dam. Dam face on the portal's side of the face edge
    # becomes rock, rising from the face height at the edge to the ground beyond.
    ev = E1 - E0
    side = np.sign(ev[0] * (a.portal[1] - E0[1]) - ev[1] * (a.portal[0] - E0[0]))
    q = side * (ev[0] * (Z - E0[1]) - ev[1] * (X - E0[0])) / np.hypot(*ev)          # blocks onto the rock side
    along = ((X - E0[0]) * ev[0] + (Z - E0[1]) * ev[1]) / (ev @ ev)
    top = np.zeros(X.shape, int); kind = np.zeros(X.shape, int)        # 1 dam face, 2 land
    for (iz, ix) in np.ndindex(X.shape):
        x, z = int(X[iz, ix]), int(Z[iz, ix])
        if not w.has(x, z):
            continue
        col = w.peek(x, z); g = ground(col); top[iz, ix] = g
        if col[g + 1 - Y0] == water:
            continue
        if col[g - Y0] == concrete and g < CY - 1:
            kind[iz, ix] = 1
        elif not (U[iz, ix] > -1.5 and S[iz, ix] > S_GATE0 - 1.5 and S[iz, ix] < far(U[iz, ix]) + 1.5):
            kind[iz, ix] = 2
    R = (kind == 1) & (q > 0) & (along < 1)
    land = kind == 2
    dland, (li, lj) = distance_transform_edt(~land, return_indices=True)
    noise = gaussian_filter(rng.standard_normal(X.shape), 2.0)
    noise /= max(1e-6, np.abs(noise).max())
    for (iz, ix) in np.argwhere(R):
        x, z = int(X[iz, ix]), int(Z[iz, ix])
        hb = top[iz, ix]                                   # the dam profile here: the face height at the edge
        hl = top[li[iz, ix], lj[iz, ix]]; dl = dland[iz, ix]; qq = q[iz, ix]
        h = hb + (max(hl, hb) - hb) * qq / (qq + dl)
        h += noise[iz, ix] * 2.5 * min(1.0, qq / 3)       # ledges and bulges, flush with the face at the edge
        if rng.random() < 0.04:
            h += 1                                         # a loose boulder
        h = int(round(min(h, CY - 1)))
        col = w.column(x, z)
        rock_fill(col, h - 8, h)
        col[h + 1 - Y0:max(h, hb) + 4 - Y0] = w.AIR
        top[iz, ix] = h
        stats['dam face turned to rock'] += 1

    # Pass 2: the gate structure and the channel beside it.
    rails = []
    for (iz, ix) in np.argwhere((U > -1.5) & (U < L + 3) & (S > S_GATE0 - 1.5) & (S < far(U) + 1.5)):
        x, z = int(X[iz, ix]), int(Z[iz, ix]); u, s = U[iz, ix], S[iz, ix]
        if not w.has(x, z):
            continue
        col = w.column(x, z)
        if u < 0 and ground(col) >= CY - 1:
            continue                                         # the dam itself
        k = pier_at(u, s)
        if k is not None:
            ptop = CY if s < S_GATE1 + 1 else WY + 1
            col[WY - 12 - Y0:ptop + 1 - Y0] = concrete
            col[ptop + 1 - Y0:ptop + 12 - Y0] = w.AIR
            if s < S_GATE1 + 1:
                rails.append((x, ptop + 1, z))
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
            ftop = WY - step
            col[WY - 12 - Y0:ftop + 1 - Y0] = face
            col[ftop + 1 - Y0:WY + 14 - Y0] = w.AIR
            col[ftop + 1 - Y0] = w.gid(state('polished_andesite_stairs', facing=facing(-n), half='bottom',
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
            col[max(g, WY + 1) + 1 - Y0:WY + 14 - Y0] = w.AIR
            stats['channel bank cells'] += 1

    # Pass 3: the arch under the road, from the channel's dam end to the portal. Inside, a round
    # vault under a two-block road deck; at the portal a concrete headwall frames the opening.
    def vault(d):
        return FLOOR + 5 if d <= 1.2 else FLOOR + 4 if d <= 2.2 else FLOOR + 3
    for (iz, ix) in np.argwhere(in_arch & (tpass > 0.5)):
        x, z = int(X[iz, ix]), int(Z[iz, ix]); d = dpass[iz, ix]; t = tpass[iz, ix]
        if not w.has(x, z) or (U[iz, ix] >= 0 and S[iz, ix] < far(U[iz, ix]) + 1.5 and U[iz, ix] <= L):
            continue
        col = w.column(x, z); g = ground(col)
        under_road = g >= CY - 1
        at_portal = t >= Lpass - 1.5
        if d > a.arch_half:                                   # outside the opening
            if at_portal:
                col[FLOOR - Y0:min(g, CY) + 1 - Y0] = concrete
                stats['headwall cells'] += 1
            continue
        col[FLOOR - 3 - Y0:FLOOR + 1 - Y0] = concrete
        if under_road or at_portal:
            col[FLOOR + 1 - Y0:vault(d) + 1 - Y0] = w.AIR
            if at_portal:
                col[vault(d) + 1 - Y0:max(g, CY - 2) + 1 - Y0] = concrete
            stats['arch cells'] += 1
        else:
            col[FLOOR + 1 - Y0:max(g, FLOOR) + 12 - Y0] = w.AIR
            stats['open channel cells by the road'] += 1

    # Pass 4: the run-out down the rock, a rough gully dropping in ledges to the canyon.
    if a.falls:
        end = a.falls[-1]
        toe = ground(w.peek(int(np.floor(end[0])), int(np.floor(end[1]))))
        for (iz, ix) in np.argwhere((dfall <= a.falls_half + 1.5) & (tfall > 0.3) & ~in_arch):
            x, z = int(X[iz, ix]), int(Z[iz, ix]); d = dfall[iz, ix]; t = tfall[iz, ix]
            if not w.has(x, z):
                continue
            col = w.column(x, z); g = ground(col)
            if g >= CY - 1:
                continue                                      # never under the road
            frac = min(1.0, t / Lfall)
            f = FLOOR - int(np.floor((FLOOR - toe) * frac / 2 + 0.5)) * 2          # two-block ledges
            f = max(f, toe)
            if d <= a.falls_half:
                rock_fill(col, f - 3, f - 1)
                col[f - Y0] = worn[int(rng.integers(len(worn)))]
                col[f + 1 - Y0:max(g, f) + 10 - Y0] = w.AIR
                stats['run-out cells'] += 1
            elif g < f + 2:                                   # keep a rock lip either side
                rock_fill(col, g, f + 1 + int(rng.integers(2)))
                stats['run-out bank cells'] += 1

    # Pass 5: lake water now cut off behind the gates becomes ground; check the lake is sealed.
    def wet(x, z):
        return w.has(x, z) and w.get(x, WY, z) == water
    seed = A + v * L / 2 - n * 6                             # open water off the middle of the gates
    seed = (int(np.floor(seed[0])), int(np.floor(seed[1])))
    if not wet(*seed):
        raise SystemExit(f'No lake water at y={WY} upstream of the gates (looked at {seed}); check the gate line.')
    lake, todo = set(), [seed]
    while todo:
        c = todo.pop()
        if c in lake or not (x0 <= c[0] <= x1 and z0 <= c[1] <= z1) or not wet(*c):
            continue
        lake.add(c)
        todo += [(c[0] + dx, c[1] + dz) for dx, dz in DIRS.values()]
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
            c = (x + dx, z + dz)
            if c in lake or not w.has(*c):
                continue
            if soft[w.get(c[0], WY, c[1])] and w.get(c[0], WY, c[1]) != water:
                leaks += 1
    stats['lake leaks (must be 0)'] = leaks
    if leaks and a.apply:
        raise SystemExit('The lake would leak at the gates; nothing written.')

    # Railings round the pier tops (offline blocks do not connect themselves).
    rs = set(rails)
    edge = {(x, y, z) for x, y, z in rails if any((x + dx, y, z + dz) not in rs for dx, dz in DIRS.values())}
    for x, y, z in edge:
        sides = {d: ('true' if (x + dx, y, z + dz) in edge else 'false') for d, (dx, dz) in DIRS.items()}
        w.set(x, y, z, state('iron_bars', waterlogged='false', **sides))
        stats['railing blocks'] += 1
    nch = w.save(a.apply)
    stats['gate line length (blocks)'] = round(L)
    for k_, val in stats.items():
        print(f'{k_}: {val}')
    print(('chunks written: ' if a.apply else 'chunks that would be written: ') + str(nch))
    if a.apply:
        marker.write_text('Spillway added (add_spillway.py): drum gates, piers, channel, arch and rock run-out; '
                          'illustrative, placed from the USGS NAIP image and the maintainer\'s photos.\n',
                          encoding='utf-8')


def facing(d):
    """Stair facing whose tall side points along d (the way up)."""
    dx, dz = float(d[0]), float(d[1])
    if abs(dx) > abs(dz):
        return 'east' if dx > 0 else 'west'
    return 'south' if dz > 0 else 'north'


if __name__ == '__main__':
    main()
