"""Build the Waterscape Hetch Hetchy resource pack: Sierra animals and hikers, all painted here.

Minecraft has no black bear, mountain lion or trout, so the pack repaints the closest models and
renames them. The game is unchanged; only how it looks and what things are called. Every texture
is painted from code, box by box (paint.py), so the pack holds no Mojang art and can be shared.

  black bear     <- polar bear (Sierra black bears are mostly brown or cinnamon)
  mountain lion  <- ocelot (summoned at a larger scale)
  rainbow trout  <- salmon
  coyote         <- wolf (the chestnut wolf already looks right; renamed only)
  hikers         <- villagers (walking; four outfits by villager type) and mannequins (standing)

  python build_pack.py [--out DIR]     -> DIR/waterscape-hetch-pack.zip and its sha1
"""
import argparse, hashlib, json, pathlib, zipfile
from paint import Tex, faces

HERE = pathlib.Path(__file__).parent
TEX = 'assets/minecraft/textures/entity/'
RESOURCE_FORMAT = 97          # Minecraft 26.3 (resource pack 97.1)


# ---------------------------------------------------------------- black bear (polar bear model)
def black_bear():
    t = Tex(128, 64, seed=3)
    fur, dark, light = '#3b2a1f', '#2a1e16', '#4a3626'
    n = .12
    h = t.box(0, 0, 7, 7, 7, fur, n)                       # head
    x, y, _, _ = h['front']
    t.rect(x, y + 1, 7, 3, light, n)                       # brow, around the eyes
    for ex in (x + 1, x + 5):
        t.dot(ex, y + 2, '#0d0907')
    m = t.box(0, 44, 5, 3, 3, '#a68562', .08)              # tan muzzle
    x, y, _, _ = m['front']
    t.rect(x + 1, y, 3, 1, '#141010', 0); t.rect(x + 2, y + 1, 1, 1, '#141010', 0)
    t.box(26, 0, 2, 2, 1, dark, n)                         # ears
    b = t.box(0, 19, 14, 14, 11, fur, n)                   # body (front face is the belly)
    t.rect(*b['back'], dark, n)
    t.box(39, 0, 12, 12, 10, fur, n)                       # shoulder hump
    for u, v, d in ((50, 22, 8), (50, 40, 6)):             # legs, darker paws
        f = t.box(u, v, 4, 10, d, fur, n)
        for k in ('right', 'front', 'left', 'back'):
            fx, fy, fw, fh = f[k]
            t.rect(fx, fy + fh - 3, fw, 3, dark, n)
        t.rect(*f['bottom'], '#1c140e', n)
    return t


# ---------------------------------------------------------------- mountain lion (ocelot model)
def mountain_lion():
    t = Tex(64, 32, seed=5)
    tawny, cream, dark, spine = '#b48a5c', '#e6d8c0', '#3a2a20', '#9e774c'
    n = .07
    h = t.box(0, 0, 5, 4, 5, tawny, n)                     # head
    x, y, _, _ = h['front']
    t.dot(x + 1, y + 1, '#c9a23a', 0); t.dot(x + 3, y + 1, '#c9a23a', 0)   # amber eyes
    t.dot(x + 1, y, '#efe3cf', 0); t.dot(x + 3, y, '#efe3cf', 0)           # pale marks above
    t.rect(x, y + 2, 5, 2, cream, n)
    t.rect(*h['bottom'], cream, n)
    s = t.box(0, 24, 3, 2, 2, cream, .04)                  # muzzle
    x, y, _, _ = s['front']
    t.dot(x + 1, y, '#a5665b', 0)                          # nose
    for side, col in (('right', 1), ('left', 0)):          # dark whisker patches
        fx, fy, _, _ = s[side]
        t.dot(fx + col, fy, dark)
    for u in (0, 6):                                       # ears, dark backs
        e = t.box(u, 10, 1, 1, 2, tawny, n)
        t.rect(*e['back'], dark, 0); t.rect(*e['top'], dark, 0)
    b = t.box(20, 0, 4, 16, 6, tawny, n)                   # body (front face is the belly)
    t.rect(*b['front'], cream, n); t.rect(*b['back'], spine, n)
    for side, col in (('right', 5), ('left', 0)):          # pale lower flanks
        fx, fy, fw, fh = b[side]
        t.rect(fx + col, fy, 1, fh, '#d2b893', n)
    t.box(0, 15, 1, 8, 1, tawny, n)                        # tail
    f = t.box(4, 15, 1, 8, 1, tawny, n)
    for k in ('right', 'front', 'left', 'back'):           # black tip
        fx, fy, fw, fh = f[k]
        t.rect(fx, fy + fh - 3, fw, 3, '#241a14', .05)
    t.rect(*f['bottom'], '#241a14', 0)
    for u, v, hh in ((8, 13, 6), (40, 0, 10)):             # legs
        t.box(u, v, 2, hh, 2, tawny, n)
    return t


# ---------------------------------------------------------------- rainbow trout (salmon model)
def rainbow_trout():
    t = Tex(32, 32, seed=7)
    back, spots, stripe, flank, belly = '#5f6a3c', '#1d1c14', '#c7646e', '#c9c6b4', '#ece8dc'
    rows = [back, back, stripe, flank, belly]

    def side(fx, fy, fw, fh, spot_rows=2, density=.18):
        for j in range(fh):
            t.rect(fx, fy + j, fw, 1, rows[min(j, 4)], .06)
        for j in range(spot_rows):
            for i in range(fw):
                if t.rng.random() < density:
                    t.dot(fx + i, fy + j, spots, 0)

    for u, v in ((0, 0), (0, 13)):                         # front and back body
        f = faces(u, v, 3, 5, 8)
        for k in ('right', 'left'):
            side(*f[k])
        t.rect(*f['top'], back, .06); t.rect(*f['bottom'], belly, .04)
        for k in ('front', 'back'):
            fx, fy, fw, fh = f[k]
            for j in range(fh):
                t.rect(fx, fy + j, fw, 1, rows[min(j, 4)], .05)
        fx, fy, fw, fh = f['top']
        for _ in range(4):
            t.dot(fx + t.rng.randrange(fw), fy + t.rng.randrange(fh), spots, 0)
    f = faces(22, 0, 2, 4, 3)                              # head
    for k, eye in (('right', 1), ('left', 1)):
        fx, fy, fw, fh = f[k]
        for j, c in enumerate((back, back, '#d07a7e', flank)):
            t.rect(fx, fy + j, fw, 1, c, .05)
        t.dot(fx + (fw - 1 - eye if k == 'right' else eye), fy + 1, '#101010', 0)
    t.rect(*f['top'], back, .05); t.rect(*f['bottom'], belly, .03)
    for k in ('front', 'back'):
        fx, fy, fw, fh = f[k]
        for j, c in enumerate((back, back, '#d07a7e', flank)):
            t.rect(fx, fy + j, fw, 1, c, .05)
    for fx, fy, fw, fh in ((20, 16, 6, 5), (26, 16, 6, 5)):   # tail fin, spotted
        t.rect(fx, fy, fw, fh, '#6c6a44', .08)
        for _ in range(4):
            t.dot(fx + t.rng.randrange(fw), fy + t.rng.randrange(fh), spots, 0)
    for fx, fy, fw, fh in ((2, 4, 3, 2), (5, 4, 3, 2), (0, 6, 4, 2), (4, 6, 4, 2)):   # dorsal fins
        t.rect(fx, fy, fw, fh, '#5a5a38', .08)
    t.rect(0, 0, 6, 2, '#b9a68c', .06)                     # side fins
    return t


# ---------------------------------------------------------------- hikers
SKIN = {'light': ('#e3b896', '#c9987a'), 'medium': ('#c08a64', '#a5724f'),
        'tan': ('#a87250', '#8d5c3e'), 'dark': ('#6e4a33', '#5a3b28')}
HAIR = {'brown': '#4a3122', 'black': '#1e1814', 'blond': '#b08a4e', 'grey': '#8a8580', 'red': '#7a3a20'}


def villager_base():
    """Shared parts of every walking hiker: shirt, trousers and boots. Heads and jackets come
    from the type overlays, so the four outfits differ."""
    t = Tex(64, 64, seed=11)
    skin, shade = SKIN['medium']
    t.box(0, 0, 8, 10, 8, skin, .03)
    t.box(24, 0, 2, 4, 2, shade, .03)
    t.box(16, 20, 8, 12, 6, '#7d8471', .05)                # shirt
    f = t.box(0, 22, 4, 12, 4, '#a39270', .06)             # trousers
    for k in ('right', 'front', 'left', 'back'):
        fx, fy, fw, fh = f[k]
        t.rect(fx, fy + fh - 3, fw, 3, '#4b3424', .06)     # boots
    t.rect(*f['bottom'], '#2b1f17', 0)
    a = t.box(44, 22, 4, 8, 4, '#7d8471', .05)             # arms
    t.box(40, 38, 8, 4, 4, skin, .03)                      # crossed forearms and hands
    return t


def head(t, u, v, w, h, d, skin, hair, eyes_row, hair_rows=2):
    """Skin and hair on a head box; face on the front."""
    f = t.box(u, v, w, h, d, skin[0], .03)
    for k in ('right', 'left', 'back'):
        fx, fy, fw, fh = f[k]
        t.rect(fx, fy, fw, hair_rows + (fh // 2 if k == 'back' else 1), hair, .06)
    t.rect(*f['top'], hair, .06)
    fx, fy, fw, fh = f['front']
    t.rect(fx, fy, fw, hair_rows, hair, .06)
    e = fy + eyes_row
    for c in (1, fw - 2):
        t.dot(fx + c, e, '#f2f0ea', 0)
    t.dot(fx + 2, e, '#2a2420', 0); t.dot(fx + fw - 3, e, '#2a2420', 0)
    t.rect(fx + 1, e - 1, 2, 1, hair, 0); t.rect(fx + fw - 3, e - 1, 2, 1, hair, 0)
    return f


def cap(t, f, colour, rows=3, brim=True):
    """A hat on a hat layer: crown and band; brim as a darker row on the front."""
    t.rect(*f['top'], colour, .05)
    for k in ('right', 'left', 'back', 'front'):
        fx, fy, fw, fh = f[k]
        t.rect(fx, fy, fw, rows, colour, .05)
    if brim:
        fx, fy, fw, _ = f['front']
        t.rect(fx, fy + rows, fw, 1, '#2a2420', .1)


def villager_outfit(seed, skin, hair, jacket, hat, pack='#3a3a34'):
    """A villager type overlay: own face and skin, jacket, backpack and hat."""
    t = Tex(64, 64, seed=seed)
    head(t, 0, 0, 8, 10, 8, SKIN[skin], HAIR[hair], eyes_row=5, hair_rows=2)
    t.box(24, 0, 2, 4, 2, SKIN[skin][1], .03)              # nose
    t.box(40, 38, 8, 4, 4, SKIN[skin][0], .03)             # hands
    j = faces(0, 38, 8, 20, 6)                             # jacket over the torso only
    for k in ('right', 'front', 'left', 'back'):
        fx, fy, fw, _ = j[k]
        t.rect(fx, fy, fw, 12, jacket, .06)
    t.rect(*j['top'], jacket, .06)
    fx, fy, fw, _ = j['front']
    t.rect(fx + 3, fy, 1, 12, '#20201c', .05)              # zip
    for c in (1, 6):                                       # pack straps
        t.rect(fx + c, fy, 1, 7, pack, .05)
    fx, fy, fw, _ = j['back']
    t.rect(fx + 1, fy + 1, 6, 10, pack, .08)               # backpack
    t.rect(fx + 2, fy + 3, 4, 1, '#55554c', .05)
    a = faces(44, 22, 4, 8, 4)                             # sleeves
    for k in a:
        t.rect(*a[k], jacket, .06)
    cap(t, faces(32, 0, 8, 10, 8), hat)
    return t


def player_hiker(seed, skin, hair, jacket, trousers, hat, hat_rows=3, brim=True, pack='#3a3a34'):
    """A full player-layout skin (64 x 64, wide arms) for standing hikers (mannequins)."""
    t = Tex(64, 64, seed=seed)
    head(t, 0, 0, 8, 8, 8, SKIN[skin], HAIR[hair], eyes_row=4)
    fx, fy, _, _ = faces(0, 0, 8, 8, 8)['front']
    t.rect(fx + 3, fy + 6, 2, 1, SKIN[skin][1], 0)         # mouth
    b = t.box(16, 16, 8, 12, 4, jacket, .06)               # torso
    fx, fy, _, _ = b['front']
    t.rect(fx + 3, fy, 1, 12, '#20201c', .05)
    for c in (1, 6):
        t.rect(fx + c, fy, 1, 7, pack, .05)
    fx, fy, _, _ = b['back']
    t.rect(fx + 1, fy + 1, 6, 9, pack, .08)
    jl = faces(16, 32, 8, 12, 4)                           # backpack stands out on the layer
    fx, fy, _, _ = jl['back']
    t.rect(fx + 1, fy + 1, 6, 9, pack, .08)
    t.rect(fx + 2, fy + 3, 4, 1, '#55554c', .05)
    for u, v in ((40, 16), (32, 48)):                      # arms: sleeves, hands
        f = t.box(u, v, 4, 12, 4, jacket, .06)
        for k in ('right', 'front', 'left', 'back'):
            ax, ay, aw, ah = f[k]
            t.rect(ax, ay + ah - 2, aw, 2, SKIN[skin][0], .03)
        t.rect(*f['bottom'], SKIN[skin][0], .03)
    for u, v in ((0, 16), (16, 48)):                       # legs: trousers, boots
        f = t.box(u, v, 4, 12, 4, trousers, .06)
        for k in ('right', 'front', 'left', 'back'):
            lx, ly, lw, lh = f[k]
            t.rect(lx, ly + lh - 3, lw, 3, '#4b3424', .06)
        t.rect(*f['bottom'], '#2b1f17', 0)
    cap(t, faces(32, 0, 8, 8, 8), hat, hat_rows, brim)
    return t


OUTFITS = {   # villager type -> (seed, skin, hair, jacket, hat)
    'plains':  (21, 'light', 'brown', '#b23b2f', '#c8b48a'),
    'taiga':   (22, 'dark', 'black', '#3f6b3a', '#5b5f63'),
    'savanna': (23, 'tan', 'black', '#d4802c', '#9c8a62'),
    'swamp':   (24, 'medium', 'red', '#2f5d9e', '#b23b2f'),
}
MANNEQUINS = {   # waterscape:entity/<name> -> player_hiker arguments
    'hiker_a': dict(seed=31, skin='light', hair='blond', jacket='#b23b2f', trousers='#a39270', hat='#c8b48a'),
    'hiker_b': dict(seed=32, skin='dark', hair='black', jacket='#2f5d9e', trousers='#55595e', hat='#3a3a3a',
                    hat_rows=3, brim=False),
    'hiker_c': dict(seed=33, skin='medium', hair='grey', jacket='#3f6b3a', trousers='#8a7a5a', hat='#7a6a4a'),
}

LANG = {
    'entity.minecraft.polar_bear': 'Black Bear',
    'item.minecraft.polar_bear_spawn_egg': 'Black Bear Spawn Egg',
    'subtitles.entity.polar_bear.ambient': 'Black Bear groans',
    'subtitles.entity.polar_bear.ambient_baby': 'Bear cub hums',
    'subtitles.entity.polar_bear.death': 'Black Bear dies',
    'subtitles.entity.polar_bear.hurt': 'Black Bear hurts',
    'subtitles.entity.polar_bear.warning': 'Black Bear huffs',
    'entity.minecraft.ocelot': 'Mountain Lion',
    'item.minecraft.ocelot_spawn_egg': 'Mountain Lion Spawn Egg',
    'entity.minecraft.salmon': 'Rainbow Trout',
    'item.minecraft.salmon': 'Raw Trout',
    'item.minecraft.cooked_salmon': 'Cooked Trout',
    'item.minecraft.salmon_bucket': 'Bucket of Trout',
    'item.minecraft.salmon_spawn_egg': 'Rainbow Trout Spawn Egg',
    'subtitles.entity.salmon.death': 'Trout dies',
    'subtitles.entity.salmon.flop': 'Trout flops',
    'subtitles.entity.salmon.hurt': 'Trout hurts',
    'entity.minecraft.wolf': 'Coyote',
    'item.minecraft.wolf_spawn_egg': 'Coyote Spawn Egg',
    'entity.minecraft.villager': 'Hiker',
    'entity.minecraft.villager.none': 'Hiker',
    'item.minecraft.villager_spawn_egg': 'Hiker Spawn Egg',
    'entity.minecraft.mannequin': 'Hiker',
    'entity.minecraft.mannequin.label': 'Hiker',
}


def icon():
    """Pack icon: a granite dome over blue water under a deep sky."""
    t = Tex(64, 64, seed=41)
    t.rect(0, 0, 64, 64, '#6a9be0', .02)
    for y in range(64):
        for x in range(64):
            if (x - 38) ** 2 / 26 ** 2 + (y - 46) ** 2 / 30 ** 2 < 1 and y < 46:
                t.dot(x, y, '#b9ad9c', .07)
            if y >= 44:
                t.dot(x, y, '#2f6a88', .05)
    for x in range(0, 30):
        for y in range(40 - x // 3, 46):
            t.dot(x, y, '#3f5a34', .1)
    return t


def build(out):
    root = out / 'waterscape-hetch-pack'
    files = {
        TEX + 'bear/polarbear.png': black_bear(),
        TEX + 'cat/ocelot.png': mountain_lion(),
        TEX + 'fish/salmon.png': rainbow_trout(),
        TEX + 'villager/villager.png': villager_base(),
        'pack.png': icon(),
    }
    for typ, (seed, skin, hair, jacket, hat) in OUTFITS.items():
        files[TEX + f'villager/type/{typ}.png'] = villager_outfit(seed, skin, hair, jacket, hat)
    for name, kw in MANNEQUINS.items():
        files[f'assets/waterscape/textures/entity/{name}.png'] = player_hiker(**kw)
    texts = {
        'pack.mcmeta': json.dumps({'pack': {
            'description': 'Waterscape: Hetch Hetchy animals and hikers',
            'min_format': RESOURCE_FORMAT, 'max_format': RESOURCE_FORMAT}}, indent=2),
        'assets/minecraft/lang/en_us.json': json.dumps(LANG, indent=2, ensure_ascii=False),
        'LICENSE.txt': 'Waterscape Hetch Hetchy resource pack. Textures painted from code by '
                       'experimental/minecraft/pack/build_pack.py; no Mojang assets included.\n'
                       'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.\n',
    }
    for rel, tex in files.items():
        tex.save(root / rel)
    for rel, s in texts.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(s + '\n', encoding='utf-8')
    zpath = out / 'waterscape-hetch-pack.zip'
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:      # fixed dates: same bytes, same sha1
        for p in sorted(root.rglob('*')):
            if p.is_file():
                info = zipfile.ZipInfo(p.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, p.read_bytes())
    sha1 = hashlib.sha1(zpath.read_bytes()).hexdigest()
    (out / 'waterscape-hetch-pack.sha1').write_text(sha1 + '\n')
    return zpath, sha1, files


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--out', type=pathlib.Path, default=HERE / 'build')
    a = p.parse_args()
    z, sha1, _ = build(a.out)
    print(f'{z}  ({z.stat().st_size // 1024} KB)\nsha1 {sha1}')
