"""Build the HetchyCraft front page: a title page that links to each reservoir's web map.

    python make_front.py --out build-site --map hetch_hetchy=build/run/web --map calaveras=build-calaveras/run/web
    python make_front.py ... --serve 8200     # preview locally, with the gzip rules a host needs

Writes <out>/index.html and <out>/front/*.png, and links each map folder in as <out>/<id>/
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


def card(rid, site, story, img):
    facts = {f['label']: f['value'] for f in story.get('facts', [])}
    wanted = site.get('facts') or [f['label'] for f in story.get('facts', []) if f.get('featured')]
    chips = ''.join(f'<li><span>{esc(w)}</span> {esc(facts[w])}</li>' for w in wanted if w in facts)
    return f'''
      <article class="card">
        <a class="art" href="./{rid}/" aria-label="Explore {esc(story['name'])}">
          <img src="front/{img}" alt="Voxel model of {esc(story['name'])} drawn from its elevation data" loading="lazy">
        </a>
        <div class="card-body">
          <h3>{esc(story['name'])}</h3>
          <p class="place">{esc(story.get('place', ''))}</p>
          <p>{esc(story['headline'])}</p>
          <ul class="facts">{chips}</ul>
          <p class="src"><a href="{REPO_URL}/blob/main/data/{rid}/story.json">Sources for these facts</a></p>
          <a class="btn" href="./{rid}/">Explore in 3D</a>
        </div>
      </article>'''


def page(cards, ids, hero, logo, local):
    blog = local.get('blog')
    blog_name = local.get('blogName', 'Blog')
    blog_link = f' · <a href="{esc(blog)}">{esc(blog_name)}</a>' if blog else ''
    site_url = local.get('siteUrl')
    og = (f'<meta property="og:image" content="{esc(site_url.rstrip("/"))}/front/{hero}">'
          f'<meta property="og:url" content="{esc(site_url)}">') if site_url else ''
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HetchyCraft</title>
<meta name="description" content="Real reservoirs rebuilt block by block in Minecraft from public elevation and water data. Explore them in your browser.">
<meta property="og:title" content="HetchyCraft">
<meta property="og:description" content="Real reservoirs, rebuilt block by block from public data.">
{og}
<link rel="icon" href="front/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONT}">
<script>
  // Links to the old single-map site (/#hetch_hetchy:...) go on to that map's folder.
  (function () {{
    var m = /^#([a-z0-9_]+):/.exec(location.hash);
    if (m && {json.dumps(ids)}.indexOf(m[1]) >= 0) location.replace("./" + m[1] + "/" + location.hash);
  }})();
</script>
<style>
:root {{
  --sky-top: #5d93e0; --sky-low: #a9cdf2; --gold: #d8b765; --gold-dark: #9c7d36;
  --soil: #2a231c; --soil-2: #362d24; --panel: #3d3329; --edge: #17120d; --text: #f1e9d8;
  --muted: #c9bda6; --water: #3b7f95; --link: #9fd3ff;
}}
* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
body {{ margin: 0; background: var(--soil); color: var(--text);
  font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
h1, h2, h3, .btn, .tag {{ font-family: "Pixelify Sans", "Courier New", monospace; letter-spacing: .02em; }}
a {{ color: var(--link); }}
img {{ image-rendering: auto; }}

/* Sky and hero */
.hero {{ position: relative; overflow: hidden; text-align: center; padding: 56px 16px 0;
  background: linear-gradient(var(--sky-top), var(--sky-low) 78%, #cfe3f5); }}
.logo {{ display: block; width: min(860px, 92vw); height: auto; margin: 0 auto;
  filter: drop-shadow(0 6px 0 rgba(0,0,0,.18)); }}
h1 {{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }}
.tagline {{ margin: 18px auto 0; max-width: 640px; font: 600 clamp(18px, 2.6vw, 24px)/1.35 "Pixelify Sans", monospace;
  color: #14304f; }}
.actions {{ margin: 22px 0 8px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }}
.diorama {{ display: block; width: min(980px, 100%); height: auto; margin: 10px auto -6px;
  position: relative; z-index: 1; animation: bob 6s ease-in-out infinite; }}
@keyframes bob {{ 50% {{ transform: translateY(-8px); }} }}
.hero > :not(.cloud) {{ position: relative; z-index: 1; }}
.cloud {{ position: absolute; z-index: 0; height: 22px; background: #fff; opacity: .92;
  box-shadow: 22px -22px 0 #fff, 44px 0 0 #fff, 66px -22px 0 #fff, 88px 0 0 #fff;
  animation: drift linear infinite; }}
.cloud.a {{ width: 66px; top: 300px; left: -200px; animation-duration: 95s; }}
.cloud.b {{ width: 44px; top: 380px; left: -200px; animation-duration: 140s; animation-delay: -60s; transform: scale(.7); }}
.cloud.c {{ width: 88px; top: 460px; left: -200px; animation-duration: 120s; animation-delay: -30s; opacity: .8; }}
@keyframes drift {{ to {{ left: 110%; }} }}
.grass-edge {{ height: 18px; background:
  repeating-linear-gradient(90deg, var(--gold) 0 18px, var(--gold-dark) 18px 36px, #c9a854 36px 54px);
  box-shadow: inset 0 -6px 0 rgba(0,0,0,.25); }}

/* Buttons, Minecraft-style bevel */
.btn {{ display: inline-block; padding: 10px 20px; font-size: 18px; color: #1f1a12; text-decoration: none;
  background: var(--gold); border: 3px solid var(--edge);
  box-shadow: inset 3px 3px 0 rgba(255,255,255,.45), inset -3px -3px 0 rgba(0,0,0,.28); }}
.btn:hover, .btn:focus-visible {{ background: #e7c879; }}
.btn.ghost {{ background: #d9e4ee; }}
.btn.ghost:hover {{ background: #eef4f9; }}

/* Sections */
main {{ max-width: 1120px; margin: 0 auto; padding: 0 16px; }}
section {{ padding: 56px 0 8px; }}
h2 {{ font-size: clamp(26px, 4vw, 36px); margin: 0 0 18px; color: var(--gold); }}
.lead {{ max-width: 760px; color: var(--text); }}
.grid {{ display: grid; gap: 28px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); }}
.card {{ background: var(--panel); border: 4px solid var(--edge); display: flex; flex-direction: column;
  box-shadow: inset 4px 4px 0 rgba(255,255,255,.06), inset -4px -4px 0 rgba(0,0,0,.3), 0 8px 0 rgba(0,0,0,.25); }}
.card .art {{ display: block; padding: 18px 18px 0;
  background: linear-gradient(#7fb0e8, #c5def4); border-bottom: 4px solid var(--edge); }}
.card .art img {{ display: block; width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: contain;
  object-position: center bottom; transition: transform .25s ease; }}
.card .art:hover img {{ transform: translateY(-6px); }}
.card-body {{ padding: 18px 20px 22px; display: flex; flex-direction: column; flex: 1; }}
.card h3 {{ margin: 0; font-size: 26px; }}
.place {{ margin: 2px 0 10px; color: var(--muted); font-size: 15px; }}
.card p {{ margin: 0 0 10px; }}
.facts {{ list-style: none; padding: 0; margin: 4px 0 6px; display: grid; gap: 6px; }}
.facts li {{ background: var(--soil-2); border-left: 4px solid var(--water); padding: 6px 10px; font-size: 15px; }}
.facts span {{ color: var(--gold); font-weight: 600; }}
.src {{ font-size: 14px; color: var(--muted); }}
.card .btn {{ align-self: flex-start; margin-top: auto; }}

.how {{ display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); margin: 22px 0; }}
.how div {{ background: var(--soil-2); border: 3px solid var(--edge); padding: 14px 16px; }}
.how .tag {{ display: inline-block; font-size: 15px; padding: 2px 8px; margin-bottom: 6px; color: #1f1a12; }}
.how p {{ margin: 0; font-size: 15.5px; color: var(--muted); }}
.t1 {{ background: #a9a39a; }} .t2 {{ background: #6fb0c6; }} .t3 {{ background: var(--gold); }}
.note {{ color: var(--muted); max-width: 760px; }}
.play {{ background: var(--panel); border: 4px solid var(--edge); padding: 22px 24px; margin-top: 8px;
  box-shadow: inset 4px 4px 0 rgba(255,255,255,.06), inset -4px -4px 0 rgba(0,0,0,.3); }}
.play h2 {{ margin-bottom: 8px; }}
.play p {{ max-width: 760px; }}

footer {{ margin-top: 64px; padding: 28px 16px 40px; background: #1d1813; border-top: 6px solid #120e0a;
  color: var(--muted); font-size: 14px; text-align: center; }}
footer .links {{ font-size: 16px; margin-bottom: 10px; }}
footer p {{ max-width: 860px; margin: 6px auto; }}

@media (max-width: 560px) {{
  .hero {{ padding-top: 36px; }}
  section {{ padding-top: 40px; }}
}}
@media (prefers-reduced-motion: reduce) {{
  .diorama, .cloud {{ animation: none; }}
  .card .art img {{ transition: none; }}
}}
</style>
</head>
<body>
<header class="hero">
  <div class="cloud a"></div><div class="cloud b"></div><div class="cloud c"></div>
  <h1>HetchyCraft</h1>
  {logo}
  <p class="tagline">Real reservoirs, rebuilt block by block from public data.</p>
  <div class="actions">
    <a class="btn" href="#maps">Explore the maps</a>
    <a class="btn ghost" href="#about">How it's made</a>
  </div>
  <img class="diorama" src="front/{hero}" alt="Voxel model of Hetch Hetchy's granite canyon and reservoir, drawn from USGS elevation data">
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

    cards = []
    for rid, web in maps:
        site = json.loads((HERE / 'sites' / f'{rid}.json').read_text())
        story = json.loads((REPO / 'data' / rid / 'story.json').read_text())
        art = site.get('art', {})
        voxel_art.render(voxel_art.from_site(rid, art), 620, out / 'front' / f'{rid}.png')
        cards.append(card(rid, site, story, f'{rid}.png'))
        link = out / rid
        if link.is_symlink() or link.is_file():
            link.unlink()
        elif link.is_dir():
            shutil.rmtree(link)
        link.symlink_to(web, target_is_directory=True)
        print(f'{story["name"]}: card, diorama, ./{rid}/ -> {web}')

    hero_id = a.hero or maps[0][0]
    hero_site = json.loads((HERE / 'sites' / f'{hero_id}.json').read_text())
    voxel_art.render(voxel_art.from_site(hero_id, hero_site.get('art', {})), 1000, out / 'front' / 'hero.png')
    icon(out / 'front' / 'icon.png')
    ids = [rid for rid, _ in maps]
    (out / 'index.html').write_text(page(cards, ids, 'hero.png', voxel_art.logo_svg(), local))
    print(f'Front page: {out / "index.html"}')
    if a.serve:
        serve(out, a.serve)


if __name__ == '__main__':
    main()
