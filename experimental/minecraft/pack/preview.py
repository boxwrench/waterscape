"""Preview sheet for the resource pack: each repainted model drawn from its box list, front and back.

A tiny orthographic box renderer (no game needed), plus swatches of the datapack's biome colours.

  python preview.py [--pack build/waterscape-hetch-pack] [--out build/preview.png]
"""
import argparse, json, math, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
PI2 = math.pi / 2

# part: (texOffs u, v), box (x, y, z, w, h, d), inflate, pivot (x, y, z), xRot
BEAR = [((0, 0), (-3.5, -3, -3, 7, 7, 7), 0, (0, 10, -16), 0),
        ((0, 44), (-2.5, 1, -6, 5, 3, 3), 0, (0, 10, -16), 0),
        ((26, 0), (-4.5, -4, -1, 2, 2, 1), 0, (0, 10, -16), 0),
        ((26, 0), (2.5, -4, -1, 2, 2, 1), 0, (0, 10, -16), 0),
        ((0, 19), (-5, -13, -7, 14, 14, 11), 0, (-2, 9, 12), PI2),
        ((39, 0), (-4, -25, -7, 12, 12, 10), 0, (-2, 9, 12), PI2)] + \
       [((50, 22), (-2, 0, -2, 4, 10, 8), 0, (x, 14, 6), 0) for x in (-4.5, 4.5)] + \
       [((50, 40), (-2, 0, -2, 4, 10, 6), 0, (x, 14, -8), 0) for x in (-3.5, 3.5)]
LION = [((0, 0), (-2.5, -2, -3, 5, 4, 5), 0, (0, 15, -9), 0),
        ((0, 24), (-1.5, 0, -4, 3, 2, 2), 0, (0, 15, -9), 0),
        ((0, 10), (-2, -3, 0, 1, 1, 2), 0, (0, 15, -9), 0),
        ((6, 10), (1, -3, 0, 1, 1, 2), 0, (0, 15, -9), 0),
        ((20, 0), (-2, 3, -8, 4, 16, 6), 0, (0, 12, -10), PI2),
        ((0, 15), (-.5, 0, 0, 1, 8, 1), 0, (0, 15, 8), .9),
        ((4, 15), (-.5, 0, 0, 1, 8, 1), 0, (0, 20, 14), .3)] + \
       [((8, 13), (-1, 0, 1, 2, 6, 2), 0, (x, 18, 5), 0) for x in (-1.1, 1.1)] + \
       [((40, 0), (-1, 0, 0, 2, 10, 2), 0, (x, 14.1, -5), 0) for x in (-1.2, 1.2)]
TROUT = [((0, 0), (-1.5, -2.5, 0, 3, 5, 8), 0, (0, 20, -7.2), 0),
         ((0, 13), (-1.5, -2.5, 0, 3, 5, 8), 0, (0, 20, .8), 0),
         ((22, 0), (-1, -2, -3, 2, 4, 3), 0, (0, 20, -7.2), 0),
         ((20, 10), (0, -2.5, 0, 0, 5, 6), 0, (0, 20, 8.8), 0),
         ((2, 1), (0, 0, 0, 0, 2, 3), 0, (0, 15.5, -2.2), 0),
         ((0, 2), (0, 0, 0, 0, 2, 4), 0, (0, 15.5, -.2), 0)]
VILLAGER = [((0, 0), (-4, -10, -4, 8, 10, 8), 0, (0, 0, 0), 0),
            ((32, 0), (-4, -10, -4, 8, 10, 8), .51, (0, 0, 0), 0),
            ((24, 0), (-1, -1, -6, 2, 4, 2), 0, (0, -2, 0), 0),
            ((16, 20), (-4, 0, -3, 8, 12, 6), 0, (0, 0, 0), 0),
            ((0, 38), (-4, 0, -3, 8, 20, 6), .5, (0, 0, 0), 0),
            ((44, 22), (-8, -2, -2, 4, 8, 4), 0, (0, 3, -1), -.75),
            ((44, 22), (4, -2, -2, 4, 8, 4), 0, (0, 3, -1), -.75),
            ((40, 38), (-4, 2, -2, 8, 4, 4), 0, (0, 3, -1), -.75)] + \
           [((0, 22), (-2, 0, -2, 4, 12, 4), 0, (x, 12, 0), 0) for x in (-2, 2)]
PLAYER = [((0, 0), (-4, -8, -4, 8, 8, 8), 0, (0, 0, 0), 0), ((32, 0), (-4, -8, -4, 8, 8, 8), .5, (0, 0, 0), 0),
          ((16, 16), (-4, 0, -2, 8, 12, 4), 0, (0, 0, 0), 0), ((16, 32), (-4, 0, -2, 8, 12, 4), .25, (0, 0, 0), 0),
          ((40, 16), (-3, -2, -2, 4, 12, 4), 0, (-5, 2, 0), 0), ((40, 32), (-3, -2, -2, 4, 12, 4), .25, (-5, 2, 0), 0),
          ((32, 48), (-1, -2, -2, 4, 12, 4), 0, (5, 2, 0), 0), ((48, 48), (-1, -2, -2, 4, 12, 4), .25, (5, 2, 0), 0),
          ((0, 16), (-2, 0, -2, 4, 12, 4), 0, (-1.9, 12, 0), 0), ((0, 32), (-2, 0, -2, 4, 12, 4), .25, (-1.9, 12, 0), 0),
          ((16, 48), (-2, 0, -2, 4, 12, 4), 0, (1.9, 12, 0), 0), ((0, 48), (-2, 0, -2, 4, 12, 4), .25, (1.9, 12, 0), 0)]


def face_list(part):
    (u, v), (x, y, z, w, h, d), g, piv, xr = part
    x0, y0, z0, x1, y1, z1 = x - g, y - g, z - g, x + w + g, y + h + g, z + d + g
    # corners as (texture top-left, along u, along v) with matching texture rectangles
    F = [((x0, y0, z0), (x1, y0, z0), (x0, y1, z0), (u + d, v + d, w, h)),      # front (north)
         ((x1, y0, z1), (x0, y0, z1), (x1, y1, z1), (u + 2 * d + w, v + d, w, h)),  # back
         ((x0, y0, z1), (x0, y0, z0), (x0, y1, z1), (u, v + d, d, h)),           # right (x0)
         ((x1, y0, z0), (x1, y0, z1), (x1, y1, z0), (u + d + w, v + d, d, h)),   # left (x1)
         ((x0, y0, z1), (x1, y0, z1), (x0, y0, z0), (u + d, v, w, d)),           # top
         ((x0, y1, z0), (x1, y1, z0), (x0, y1, z1), (u + d + w, v, w, d))]       # bottom
    c, s = math.cos(xr), math.sin(xr)

    def tf(p):
        px, py, pz = p
        return np.array([px + piv[0], py * c - pz * s + piv[1], py * s + pz * c + piv[2]])
    return [(tf(a), tf(b), tf(e), r) for a, b, e, r in F]


def render(parts, tex, yaw, scale=10, pitch=.42):
    tex = np.asarray(tex.convert('RGBA'))
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)

    def view(p):
        x, y, z = p
        x, z = x * cy - z * sy, x * sy + z * cy
        y, z = y * cp - z * sp, y * sp + z * cp
        return np.array([x, y, z])
    faces = []
    for part in parts:
        for a, b, e, r in face_list(part):
            A, B, E = view(a), view(b), view(e)
            n = np.cross(B - A, E - A)
            if r[2] == 0 or r[3] == 0:
                continue
            faces.append(((A + B + E + (B + E - A)) [2] / 4, A, B, E, r, n[2]))
    pts = np.array([f[i][:2] for f in faces for i in (1, 2, 3)])
    lo = pts.min(0) - 2; hi = pts.max(0) + 4
    W, H = (int(v) for v in (hi - lo) * scale)
    img = np.zeros((H, W, 4), np.uint8)
    zbuf = np.full((H, W), 1e9)
    gy, gx = np.mgrid[0:H, 0:W]
    P = np.stack([gx / scale + lo[0], gy / scale + lo[1]], -1)
    for depth, A, B, E, (tu, tv, tw, th), nz in faces:
        e1, e2 = (B - A)[:2], (E - A)[:2]
        M = np.array([e1, e2]).T
        if abs(np.linalg.det(M)) < 1e-9:
            continue
        st = (P - A[:2]) @ np.linalg.inv(M).T
        s, t = st[..., 0], st[..., 1]
        inside = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
        zz = A[2] + s * (B - A)[2] + t * (E - A)[2]
        tx = np.clip((tu + s * tw).astype(int), 0, tex.shape[1] - 1)
        ty = np.clip((tv + t * th).astype(int), 0, tex.shape[0] - 1)
        col = tex[ty, tx]
        m = inside & (col[..., 3] > 0) & (zz < zbuf)
        shade = 1.0 if abs(np.cross(B - A, E - A)[1]) > abs(np.cross(B - A, E - A)[0]) else .8
        img[m] = np.concatenate([(col[m][:, :3] * shade).astype(np.uint8), col[m][:, 3:]], 1)
        zbuf[m] = zz[m]
    return Image.fromarray(img)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--pack', type=pathlib.Path, default=HERE / 'build' / 'waterscape-hetch-pack')
    p.add_argument('--colours', type=pathlib.Path, default=HERE / 'biome_colours.json')
    p.add_argument('--out', type=pathlib.Path, default=HERE / 'build' / 'preview.png')
    p.add_argument('--vanilla', type=pathlib.Path, help='client jar, to show the vanilla block beside each (preview only)')
    a = p.parse_args()
    T = a.pack / 'assets/minecraft/textures/entity'
    vb = Image.open(T / 'villager/villager.png').convert('RGBA')
    rows = [
        ('Black bear (polar bear)', BEAR, Image.open(T / 'bear/polarbear.png'), 6),
        ('Mountain lion (ocelot, summoned 1.6x)', LION, Image.open(T / 'cat/ocelot.png'), 12),
        ('Rainbow trout (salmon)', TROUT, Image.open(T / 'fish/salmon.png'), 16),
    ]
    for typ in ('plains', 'taiga', 'savanna', 'swamp'):
        rows.append((f'Walking hiker ({typ} villager)', VILLAGER,
                     Image.alpha_composite(vb, Image.open(T / f'villager/type/{typ}.png').convert('RGBA')), 6))
    for name in ('hiker_a', 'hiker_b', 'hiker_c'):
        rows.append((f'Standing hiker ({name}, mannequin)', PLAYER,
                     Image.open(a.pack / f'assets/waterscape/textures/entity/{name}.png'), 6))
    cells = []
    for label, parts, tex, sc in rows:
        cells.append((label, render(parts, tex, math.radians(210), sc), render(parts, tex, math.radians(30), sc)))
    font = ImageFont.load_default(size=18) if hasattr(ImageFont, 'load_default') else None
    cw = max(f.width + b.width for _, f, b in cells) + 40
    ch = max(max(f.height, b.height) for _, f, b in cells) + 34
    cols = 3
    nrows = math.ceil(len(cells) / cols)
    blocks = ['diorite', 'andesite', 'calcite', 'stone', 'coarse_dirt', 'spruce_log', 'spruce_log_top',
              'dark_oak_log', 'dark_oak_log_top', 'spruce_leaves']
    bh = 2 * (3 * 16 * 4 + 60)
    sheet = Image.new('RGBA', (cw * cols, ch * nrows + 120 + bh), '#d9d6cf')
    d = ImageDraw.Draw(sheet)
    for i, (label, f, b) in enumerate(cells):
        x, y = (i % cols) * cw, (i // cols) * ch
        d.text((x + 12, y + 8), label, fill='#222', font=font)
        sheet.alpha_composite(f, (x + 10, y + 30))
        sheet.alpha_composite(b, (x + 20 + f.width, y + 30))
    colours = json.loads(a.colours.read_text())
    y = ch * nrows + 10
    d.text((12, y), 'Biome colours (datapack): new   [vanilla forest]', fill='#222', font=font)
    for i, (k, (new, old)) in enumerate(colours['compare'].items()):
        x = 12 + i * 200
        d.rectangle((x, y + 32, x + 120, y + 92), fill=new)
        d.rectangle((x + 124, y + 32, x + 160, y + 92), fill=old)
        d.text((x, y + 94), k, fill='#222', font=ImageFont.load_default(size=14))
    y += 130
    d.text((12, y), 'Blocks: new, tiled 3 x 3   [vanilla]', fill='#222', font=font)
    import zipfile
    jar = zipfile.ZipFile(a.vanilla) if a.vanilla else None
    for i, b in enumerate(blocks):
        x = 12 + (i % 5) * 390; yy = y + 30 + (i // 5) * (3 * 64 + 60)
        im = Image.open(a.pack / f'assets/minecraft/textures/block/{b}.png').convert('RGBA')
        tile = Image.new('RGBA', (48, 48), '#8a9a7a' if 'leaves' in b else (0, 0, 0, 0))
        for k in range(9):
            tile.alpha_composite(im, ((k % 3) * 16, (k // 3) * 16))
        sheet.alpha_composite(tile.resize((192, 192), Image.NEAREST), (x, yy))
        if jar:
            import io
            v = Image.open(io.BytesIO(jar.read(f'assets/minecraft/textures/block/{b}.png'))).convert('RGBA')
            if b == 'spruce_leaves':        # vanilla tint
                px = np.asarray(v).astype(float); px[..., :3] *= np.array([0x61, 0x99, 0x61]) / 255
                v = Image.fromarray(px.astype(np.uint8))
            bg = Image.new('RGBA', (16, 16), '#8a9a7a' if 'leaves' in b else (0, 0, 0, 0)); bg.alpha_composite(v)
            sheet.alpha_composite(bg.resize((64, 64), Image.NEAREST), (x + 200, yy))
        d.text((x, yy + 196), b, fill='#222', font=ImageFont.load_default(size=14))
    a.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert('RGB').save(a.out)
    print(a.out, sheet.size)


if __name__ == '__main__':
    main()
