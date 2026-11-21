"""Build the Waterscape server datapack: Sierra colours for the world's biome.

The world is all minecraft:forest. This datapack redefines that biome from the running server's
own copy (so it always matches the game version) with the colours in biome_colours.json. It is
server-side only: players need nothing, the server sends the colours when they join. Needs a full
server restart to take effect (biomes are not reloaded by /reload).

  python build_datapack.py --server-jar ~/mc-server/versions/26.3/server-26.3.jar [--out DIR]
    -> DIR/waterscape-sierra/ (copy into <world>/datapacks/)

Other sites pass their own colours and name, e.g. Calaveras (build_reservoir.py does this itself):
  --colours ../palettes/diablo-oak.json --biome savanna --name waterscape-diablo
"""
import argparse, json, pathlib, zipfile

HERE = pathlib.Path(__file__).parent


def make_datapack(server_jar, biome_name, colours, root, label):
    """Write a datapack at `root` redefining minecraft:<biome_name> with `colours`
    ({'effects': {...}, 'attributes': {...}}); returns the game version id."""
    with zipfile.ZipFile(server_jar) as z:
        version = json.loads(z.read('version.json'))
        biome = json.loads(z.read(f'data/minecraft/worldgen/biome/{biome_name}.json'))
    biome.setdefault('effects', {}).update(colours['effects'])
    biome.setdefault('attributes', {}).update(colours['attributes'])
    fmt = version['pack_version']['data_major']
    path = root / f'data/minecraft/worldgen/biome/{biome_name}.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(biome, indent=2) + '\n')
    (root / 'pack.mcmeta').write_text(json.dumps({'pack': {
        'description': f'Waterscape: {label} colours for {biome_name} (Minecraft {version["id"]})',
        'min_format': fmt, 'max_format': fmt}}, indent=2) + '\n')
    return version['id']


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--server-jar', required=True, type=pathlib.Path)
    p.add_argument('--out', type=pathlib.Path, default=HERE / 'build')
    p.add_argument('--biome', default='forest')
    p.add_argument('--colours', type=pathlib.Path, default=HERE / 'biome_colours.json',
                   help='biome_colours.json, or a palette file with a "biomeColours" entry')
    p.add_argument('--name', default='waterscape-sierra')
    a = p.parse_args()
    colours = json.loads(a.colours.read_text())
    colours = colours.get('biomeColours', colours)
    root = a.out / a.name
    version = make_datapack(a.server_jar, a.biome, colours, root, a.name.replace('waterscape-', '').title())
    print(f'{root}  (Minecraft {version})')


if __name__ == '__main__':
    main()
