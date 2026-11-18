"""Load chunks of a copied modern Java world as full 384-high block columns, edit, and save.

Every block state is kept with its properties through a global palette. Saving rebuilds each
section's palette, recomputes all four heightmaps and drops stored light so the game relights
the chunk on load. Use only on a disposable copy with Minecraft closed.
"""
import collections, pathlib, sys
import numpy as np
from nbtlib import Compound, String, List, LongArray, Byte
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import region_edit as R

Y0 = -64
AIR = {'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'}
PLANTS = {'minecraft:short_grass', 'minecraft:tall_grass', 'minecraft:short_dry_grass',
          'minecraft:tall_dry_grass', 'minecraft:fern', 'minecraft:dead_bush'}


def state(name, **props):
    c = Compound({'Name': String(name if ':' in name else 'minecraft:' + name)})
    if props:
        c['Properties'] = Compound({k: String(str(v).lower()) for k, v in props.items()})
    return c


def longpack(vals, bits):
    per = 64 // bits
    v = np.asarray(vals, dtype=np.uint64).ravel()
    v = np.pad(v, (0, (-len(v)) % per)).reshape(-1, per)
    words = np.bitwise_or.reduce(v << (np.arange(per, dtype=np.uint64) * np.uint64(bits)), axis=1)
    return LongArray(words.view(np.int64))


class World:
    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.region_dir = self.path / 'dimensions/minecraft/overworld/region'
        if not self.region_dir.is_dir():
            self.region_dir = self.path / 'region'
        self.names, self.index = [], {}
        self.cols, self.chunk, self.where, self.regions = {}, {}, {}, {}
        self.dirty = set()
        self.AIR = self.gid(state('air'))

    def gid(self, c):
        if isinstance(c, str):
            c = state(c)
        k = str(c)
        if k not in self.index:
            self.index[k] = len(self.names)
            self.names.append(c)
        return self.index[k]

    def name(self, i):
        return str(self.names[i]['Name'])

    def flags(self, test):
        """Boolean lookup over the global palette: test(name) for every state id."""
        return np.array([test(self.name(i)) for i in range(len(self.names))], dtype=bool)

    def load(self, keys):
        """Load chunks (cx, cz) that exist in the world."""
        by_region = collections.defaultdict(set)
        for cx, cz in keys:
            by_region[(cx >> 5, cz >> 5)].add((cx, cz))
        for (rx, rz), want in by_region.items():
            path = self.region_dir / f'r.{rx}.{rz}.mca'
            if not path.exists() or path.stat().st_size < 8192:
                continue
            if path not in self.regions:
                self.regions[path] = R.read_region(path)
            chunks, _ = self.regions[path]
            for cx, cz in want:
                k = (cx & 31) + (cz & 31) * 32
                if k not in chunks or (cx, cz) in self.cols:
                    continue
                c = R.decode_chunk(chunks[k])
                full = np.full((384, 16, 16), self.AIR, dtype=np.int32)
                for s in c['sections']:
                    if 'block_states' not in s or not -4 <= int(s['Y']) < 20:
                        continue
                    sy = int(s['Y'])
                    lut = np.array([self.gid(e) for e in s['block_states']['palette']], dtype=np.int32)
                    full[(sy + 4) * 16:(sy + 5) * 16] = lut[R.unpack(s).reshape(16, 16, 16)]
                self.cols[(cx, cz)] = full
                self.chunk[(cx, cz)] = c
                self.where[(cx, cz)] = (path, k)

    def has(self, x, z):
        return (x >> 4, z >> 4) in self.cols

    def column(self, x, z):
        """A writable view of one column (index 0 is y = -64). Marks the chunk dirty."""
        self.dirty.add((x >> 4, z >> 4))
        return self.cols[(x >> 4, z >> 4)][:, z & 15, x & 15]

    def peek(self, x, z):
        return self.cols[(x >> 4, z >> 4)][:, z & 15, x & 15]

    def get(self, x, y, z):
        return int(self.cols[(x >> 4, z >> 4)][y - Y0, z & 15, x & 15])

    def set(self, x, y, z, b):
        if not self.has(x, z) or not 0 <= y - Y0 < 384:
            return False
        self.cols[(x >> 4, z >> 4)][y - Y0, z & 15, x & 15] = b if isinstance(b, (int, np.integer)) else self.gid(b)
        self.dirty.add((x >> 4, z >> 4))
        return True

    def save(self, apply):
        n = len(self.names)
        hm = {
            'WORLD_SURFACE': self.flags(lambda s: s not in AIR),
            'MOTION_BLOCKING': self.flags(lambda s: s not in AIR and s not in PLANTS),
            'MOTION_BLOCKING_NO_LEAVES': self.flags(lambda s: s not in AIR and s not in PLANTS and not s.endswith('_leaves')),
            'OCEAN_FLOOR': self.flags(lambda s: s not in AIR and s not in PLANTS and s != 'minecraft:water'),
        }
        touched = collections.defaultdict(list)
        for key in self.dirty:
            c = self.chunk[key]; full = self.cols[key]
            by_y = {int(s['Y']): s for s in c['sections']}
            out = []
            for sy in range(-4, 20):
                ids = full[(sy + 4) * 16:(sy + 5) * 16]
                present, inv = np.unique(ids, return_inverse=True)
                sec = Compound({'Y': Byte(sy)})
                old = by_y.get(sy)
                sec['biomes'] = old['biomes'] if old is not None and 'biomes' in old else \
                    Compound({'palette': List[String]([String('minecraft:forest')])})
                sec['block_states'] = Compound({'palette': List[Compound]([self.names[j] for j in present])})
                if len(present) > 1:
                    sec['block_states']['data'] = longpack(inv.reshape(-1), max(4, (len(present) - 1).bit_length()))
                out.append(sec)
            c['sections'] = List[Compound](out)
            for name, ok in hm.items():
                m = ok[full]
                top = np.where(m.any(0), 384 - np.argmax(m[::-1], 0), 0)
                c['Heightmaps'][name] = longpack(top.reshape(-1).astype(np.int64), 9)
            for k in ('block_ticks', 'fluid_ticks'):
                if k in c:
                    c[k] = List[Compound]([])
            R.mark_relight(c)
            path, k = self.where[key]
            self.regions[path][0][k] = R.encode_chunk(c)
            touched[path].append(key)
        if apply:
            for path in touched:
                chunks, times = self.regions[path]
                R.write_region(path, chunks, times)
        return sum(len(v) for v in touched.values())
