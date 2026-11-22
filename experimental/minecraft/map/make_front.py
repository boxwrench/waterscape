"""Build the HetchyCraft front page: a title page that links to each reservoir's web map.

    python make_front.py --out build-site --map hetch_hetchy=build/run/web --map calaveras=build-calaveras/run/web
    python make_front.py ... --serve 8200     # preview locally, with the gzip rules a host needs

Writes <out>/index.html and <out>/front/ (pictures, model data, and the logo, styles and script
from front/), and links each map folder in as <out>/<id>/
(symlinks; copy with rsync -L when hosting). For each reservoir it reads:

- data/<id>/story.json: name, place, headline and facts (each with its source recorded there);
- sites/<id>.json: which facts to show and the diorama settings ("art");
- data/<id>/terrain.*: the diorama itself (voxel_art.py), drawn from the real elevation.

Links that are not part of the project (your blog) come from front.local.json, which is not
committed (see front.example.json). Old links to the single-map site (/#hetch_hetchy:...) are
sent on to /hetch_hetchy/.
"""
import argparse
import html
import json
import os
import shutil
from pathlib import Path

import voxel_art

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
REPO_URL = 'https://github.com/boxwrench/waterscape'
MINECRAFT_URL = f'{REPO_URL}/tree/main/experimental/minecraft'
FONT = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&display=swap'


def esc(s):
    return html.escape(str(s), quote=True)


def card(rid, site, story):
    facts = {f['label']: f['value'] for f in story.get('facts', [])}
    wanted = site.get('facts') or [f['label'] for f in story.get('facts', []) if f.get('featured')]
    chips = ''.join(f'<li><span>{esc(w)}</span> {esc(facts[w])}</li>' for w in wanted if w in facts)
    name = esc(story['name'])
    return f'''
      <article class="card">
        <div class="art">
          <div class="model" data-src="front/{rid}.json">
            <img src="front/{rid}.webp" alt="Voxel model of {name} drawn from its elevation data" loading="lazy">
          </div>
        </div>
        <div class="card-body">
          <h3><a href="./{rid}/">{name}</a></h3>
          <p class="place">{esc(story.get('place', ''))}</p>
          <p>{esc(story['headline'])}</p>
          <ul class="facts">{chips}</ul>
          <p class="src"><a href="{REPO_URL}/blob/main/data/{rid}/story.json">Sources for these facts</a></p>
          <a class="btn" href="./{rid}/">Explore in 3D</a>
        </div>
      </article>'''


BIRD = ('<svg class="bird" viewBox="0 0 9 5" aria-hidden="true" shape-rendering="crispEdges">'
        '<g class="up" fill="#22303d"><rect x="0" y="0" width="1" height="1"/><rect x="1" y="1" width="2" height="1"/>'
        '<rect x="3" y="2" width="3" height="1"/><rect x="6" y="1" width="2" height="1"/><rect x="8" y="0" width="1" height="1"/></g>'
        '<g class="down" fill="#22303d"><rect x="3" y="2" width="3" height="1"/><rect x="1" y="3" width="2" height="1"/>'
        '<rect x="0" y="4" width="1" height="1"/><rect x="6" y="3" width="2" height="1"/><rect x="8" y="4" width="1" height="1"/></g></svg>')


def page(cards, ids, hero_id, hero_name, splash, local):
    blog = local.get('blog')
    blog_name = local.get('blogName', 'Blog')
    blog_link = f' · <a href="{esc(blog)}">{esc(blog_name)}</a>' if blog else ''
    site_url = local.get('siteUrl')
    og = (f'<meta property="og:image" content="{esc(site_url.rstrip("/"))}/front/share.jpg">\n'
          f'<meta property="og:url" content="{esc(site_url)}">\n') if site_url else ''
    leaves = ''.join(f'<i class="leaf l{n}"></i>' for n in range(1, 7))
    return f'''<!doctype html>
<html lang="en" data-time="day">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HetchyCraft</title>
<meta name="description" content="Real reservoirs rebuilt block by block in Minecraft from public elevation and water data. Explore them in your browser.">
<meta property="og:title" content="HetchyCraft">
<meta property="og:description" content="Real reservoirs, rebuilt block by block from public data.">
{og}<link rel="icon" href="front/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONT}">
<link rel="stylesheet" href="front/front.css">
<script>
  // Before the first paint: the sky this visitor chose last time, and links to the old
  // single-map site (/#hetch_hetchy:...) sent on to that map's folder.
  (function () {{
    var d = document.documentElement, t = null;
    d.className = "js";
    try {{ t = localStorage.getItem("hc-time"); }} catch (e) {{}}
    var q = /[?&]sky=(day|sunset|night)/.exec(location.search);
    if (q) t = q[1];
    if (t === "sunset" || t === "night") d.setAttribute("data-time", t);
    var m = /^#([a-z0-9_]+):/.exec(location.hash);
    if (m && {json.dumps(ids)}.indexOf(m[1]) >= 0) location.replace("./" + m[1] + "/" + location.hash);
  }})();
</script>
<script src="front/front.js" defer></script>
</head>
<body>
<header class="hero">
  <div class="sky" aria-hidden="true">
    <div class="stars"></div><div class="sun"></div><div class="moon"></div>
    <div class="cloud a"></div><div class="cloud b"></div><div class="cloud c"></div>
    {BIRD}{leaves}
  </div>
  <button class="time" type="button" aria-label="Change the sky to sunset"><i></i><span>Sunset</span></button>
  <div class="content">
    <h1>HetchyCraft</h1>
    <div class="title">
      <img class="logo" src="front/logo.svg" alt="HetchyCraft" width="2118" height="386">
      <span class="splash" aria-hidden="true" data-lines="{esc(json.dumps(splash))}">{esc(splash[0])}</span>
    </div>
    <p class="tagline">Real reservoirs, rebuilt block by block from public data.</p>
    <div class="actions">
      <a class="btn" href="#maps">Explore the maps</a>
      <a class="btn ghost" href="#about">How it's made</a>
    </div>
    <div class="model" data-src="front/{hero_id}.json">
      <img src="front/hero.webp" alt="Voxel model of {esc(hero_name)}, drawn from USGS elevation data">
    </div>
    <p class="hint">Drag the model to turn it. Click a block to break it; it grows back.</p>
  </div>
</header>
<div class="grass-edge"></div>
<main>
  <section id="maps">
    <h2>Pick a reservoir</h2>
    <p class="lead">Each map opens in your browser: fly over the valley, or drop to the ground and walk
    around in first person. No Minecraft needed.</p>
    <div class="grid">{''.join(cards)}
    </div>
  </section>

  <section id="about">
    <h2>How it's made</h2>
    <p class="lead">HetchyCraft is the Minecraft side of <a href="{REPO_URL}">Waterscape</a>, an open project
    that turns public water data into places you can explore. These are not hand-built: a script reads each
    reservoir's data and places every block.</p>
    <div class="how">
      <div><span class="tag t1">Ground</span><p>Every hill and canyon comes from USGS 3DEP elevation surveys,
      about one block per few metres.</p></div>
      <div><span class="tag t2">Water</span><p>The lake sits at its real level. Dams are traced from USGS aerial
      photos and checked against the National Inventory of Dams.</p></div>
      <div><span class="tag t3">Land</span><p>Grass, rock and trees follow the same rules as the Waterscape
      browser scenes, so woodland grows where the landscape says it should.</p></div>
    </div>
    <p class="note">Some things are illustrative, such as lake beds nobody has surveyed and the shape of each
    tree, and every map says which. The models on this page are drawn from the same elevation data, shrunk
    down with the height stretched so the hills show.</p>
  </section>

  <section>
    <div class="play">
      <h2>Play it in Minecraft</h2>
      <p>The worlds are Minecraft Java Edition saves made by open scripts. The Waterscape repository explains
      how to build one, open it in single player, or run it on your own server.</p>
      <a class="btn" href="{MINECRAFT_URL}">Build and play</a>
    </div>
  </section>
</main>
<footer>
  <div class="links"><a href="{REPO_URL}">Waterscape on GitHub</a>{blog_link}</div>
  <p>Elevation: USGS 3DEP. Aerial imagery for tracing: USGS NAIP. Dam facts: USACE National Inventory of
  Dams. Roads and buildings at Hetch Hetchy: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
  contributors. 3D viewer: <a href="https://bluemap.bluecolored.de/">BlueMap</a>.</p>
  <p>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
</footer>
</body>
</html>
'''


def icon(path):
    """A 32 px favicon: one gold grass block over stone."""
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(16, 2), (30, 9), (16, 16), (2, 9)], fill=(226, 192, 112, 255))
    d.polygon([(2, 9), (16, 16), (16, 30), (2, 23)], fill=(150, 112, 70, 255))
    d.polygon([(16, 16), (30, 9), (30, 23), (16, 30)], fill=(112, 84, 54, 255))
    d.polygon([(2, 9), (16, 16), (16, 19), (2, 12)], fill=(190, 160, 90, 255))
    d.polygon([(16, 16), (30, 9), (30, 12), (16, 19)], fill=(160, 132, 72, 255))
    img.save(path)


def serve(root, port):
    """Static server with the rules the host needs (see Caddyfile.example): gzip tiles, 204 past the edge."""
    import http.server
    import functools

    class Handler(http.server.SimpleHTTPRequestHandler):
        def send_head(self):
            path = self.translate_path(self.path.split('?')[0])
            if self.path.endswith('.prbm') or self.path.split('?')[0].endswith('/textures.json'):
                gz = path + '.gz'
                if not os.path.exists(gz):
                    self.send_response(204); self.end_headers(); return None
                f = open(gz, 'rb')
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream' if self.path.endswith('.prbm') else 'application/json')
                self.send_header('Content-Encoding', 'gzip')
                self.send_header('Content-Length', str(os.path.getsize(gz)))
                self.end_headers()
                return f
            if '/tiles/' in self.path and not os.path.exists(path):
                self.send_response(204); self.end_headers(); return None
            return super().send_head()

        def log_message(self, *a):
            pass

    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=str(root)))
    print(f'Serving {root} on http://127.0.0.1:{port} (Ctrl+C to stop)')
    httpd.serve_forever()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--map', action='append', default=[], metavar='ID=WEBDIR',
                    help='a rendered map: the reservoir id and its BlueMap web folder (repeat, in page order)')
    ap.add_argument('--hero', help='reservoir drawn large at the top (default: the first --map)')
    ap.add_argument('--local', type=Path, default=HERE / 'front.local.json',
                    help='personal links not kept in the repository (default: front.local.json, optional)')
    ap.add_argument('--serve', type=int, metavar='PORT', help='afterwards, serve the folder locally')
    a = ap.parse_args()
    if not a.map:
        ap.error('give at least one --map ID=WEBDIR')

    out = a.out.resolve()
    (out / 'front').mkdir(parents=True, exist_ok=True)
    local = json.loads(a.local.read_text()) if a.local.exists() else {}
    maps = []
    for m in a.map:
        rid, web = m.split('=', 1)
        web = Path(web).resolve()
        info = web / 'waterscape-site.json'
        if not info.exists() or json.loads(info.read_text())['id'] != rid:
            raise SystemExit(f'{web} is not the rendered map for {rid} (no matching waterscape-site.json)')
        maps.append((rid, web))

    cards, names = [], {}
    for rid, web in maps:
        site = json.loads((HERE / 'sites' / f'{rid}.json').read_text())
        story = json.loads((REPO / 'data' / rid / 'story.json').read_text())
        cols = voxel_art.from_site(rid, site.get('art', {}))
        voxel_art.render(cols, 620).save(out / 'front' / f'{rid}.webp', quality=88, method=6)
        (out / 'front' / f'{rid}.json').write_text(json.dumps(voxel_art.export(cols), separators=(',', ':')))
        cards.append(card(rid, site, story))
        names[rid] = story['name']
        link = out / rid
        if link.is_symlink() or link.is_file():
            link.unlink()
        elif link.is_dir():
            shutil.rmtree(link)
        link.symlink_to(web, target_is_directory=True)
        print(f'{story["name"]}: card, model, ./{rid}/ -> {web}')

    hero_id = a.hero or maps[0][0]
    hero_site = json.loads((HERE / 'sites' / f'{hero_id}.json').read_text())
    hero = voxel_art.render(voxel_art.from_site(hero_id, hero_site.get('art', {})), 1000)
    hero.save(out / 'front' / 'hero.webp', quality=88, method=6)
    hero.convert('RGB').save(out / 'front' / 'share.jpg', quality=85)  # link previews
    icon(out / 'front' / 'icon.png')
    for asset in ('logo.svg', 'front.css', 'front.js'):
        shutil.copyfile(HERE / 'front' / asset, out / 'front' / asset)
    newest = names[maps[-1][0]].replace(' Reservoir', '')
    splash = [f'Now with {newest}!', 'Every block from real data!', 'No Minecraft needed!',
              'Built by a script, not by hand!', 'Water at its real level!', 'Try breaking a block!',
              'Drag a model to turn it!']
    ids = [rid for rid, _ in maps]
    (out / 'index.html').write_text(page(cards, ids, hero_id, names[hero_id], splash, local))
    print(f'Front page: {out / "index.html"}')
    if a.serve:
        serve(out, a.serve)


if __name__ == '__main__':
    main()
