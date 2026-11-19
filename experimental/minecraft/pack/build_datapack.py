"""Build the Waterscape server datapack: Sierra colours for the world's biome.

The world is all minecraft:forest. This datapack redefines that biome from the running server's
own copy (so it always matches the game version) with the colours in biome_colours.json. It is
server-side only: players need nothing, the server sends the colours when they join. Needs a full
server restart to take effect (biomes are not reloaded by /reload).

  python build_datapack.py --server-jar ~/mc-server/versions/26.3/server-26.3.jar [--out DIR]
    -> DIR/waterscape-sierra/ (copy into <world>/datapacks/)
"""
import argparse, json, pathlib, zipfile

HERE = pathlib.Path(__file__).parent


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--server-jar', required=True, type=pathlib.Path)
    p.add_argument('--out', type=pathlib.Path, default=HERE / 'build')
    p.add_argument('--biome', default='forest')
    a = p.parse_args()
    colours = json.loads((HERE / 'biome_colours.json').read_text())
    with zipfile.ZipFile(a.server_jar) as z:
        version = json.loads(z.read('version.json'))
        biome = json.loads(z.read(f'data/minecraft/worldgen/biome/{a.biome}.json'))
    biome.setdefault('effects', {}).update(colours['effects'])
    biome.setdefault('attributes', {}).update(colours['attributes'])
    fmt = version['pack_version']['data_major']
    root = a.out / 'waterscape-sierra'
    path = root / f'data/minecraft/worldgen/biome/{a.biome}.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(biome, indent=2) + '\n')
    (root / 'pack.mcmeta').write_text(json.dumps({'pack': {
        'description': f'Waterscape: Sierra colours for {a.biome} (Minecraft {version["id"]})',
        'min_format': fmt, 'max_format': fmt}}, indent=2) + '\n')
    print(f'{root}  (Minecraft {version["id"]}, data format {fmt})')


if __name__ == '__main__':
    main()
