"""Convert a Blender model of a structure into a compact mesh for the browser
(renderer/land/landmarks.js): quantised positions, normals, a material class and baked ambient
occlusion per vertex, gzip-compressed. Run inside Blender (it needs bpy and mathutils):

  blender -b <model.blend> --python pipeline/structure_mesh.py -- \
      --out data/<id>/<name>.mesh.gz --unit <metres per model unit> [--rays 24]

The model's own frame is kept: Blender X and Y across, Z up, centred on the bounding box in X
and Y, its lowest point at y = 0. Output axes are three.js's: x = Blender X, y = Blender Z,
z = -Blender Y, in metres (model units times --unit). Only visible mesh objects are written.

Material classes (by Blender material name): 0 stone, 1 ornament (raised or relief), 2
terracotta, 3 recess (set back, darker). The browser picks a colour per class.

File layout (little-endian): b"WSMESH1\\0", uint32 vertex count V, uint32 index count I,
float32 min[3], float32 size[3]; uint16 position[3V] (min + q / 65535 * size); int8 normal[3V]
(/127); uint8 class[V]; uint8 occlusion[V] (/255, 1 = open sky); uint32 index[I]. Each array
starts on a 4-byte boundary.
"""

import argparse
import gzip
import math
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def material_class(name):
    n = (name or '').lower()
    if 'terracotta' in n:
        return 2
    if 'recess' in n:
        return 3
    if 'ornament' in n or 'relief' in n:
        return 1
    return 0


def gather():
    """Every visible mesh triangle corner: position, corner normal and material class."""
    dg = bpy.context.evaluated_depsgraph_get()
    pos, nor, cls = [], [], []
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH' or ob.hide_get() or ob.hide_render:
            continue
        m = ob.evaluated_get(dg).to_mesh()
        m.calc_loop_triangles()
        if not m.loop_triangles:
            continue
        mw = ob.matrix_world
        nm = mw.to_3x3().inverted_safe().transposed()
        verts = np.array([mw @ v.co for v in m.vertices])
        corner = np.array([(nm @ c.vector).normalized() for c in m.corner_normals])
        names = [s.material.name if s.material else '' for s in ob.material_slots] or ['']
        for tri in m.loop_triangles:
            c = material_class(names[min(tri.material_index, len(names) - 1)])
            for vi, li in zip(tri.vertices, tri.loops):
                pos.append(verts[vi])
                nor.append(corner[li])
                cls.append(c)
        ob.to_mesh_clear()
    return np.array(pos), np.array(nor), np.array(cls, np.uint8)


def occlusion(P, N, tris, rays, reach, seed=1934):
    """Share of a cosine-weighted hemisphere of `rays` that escapes within `reach` metres,
    counting the ground plane (y < 0) as solid."""
    tree = BVHTree.FromPolygons([Vector(p) for p in tris.reshape(-1, 3)], [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(tris))])
    rng = np.random.default_rng(seed)
    u1, u2 = rng.random(rays), rng.random(rays)
    local = np.stack([np.sqrt(u1) * np.cos(2 * math.pi * u2), np.sqrt(1 - u1), np.sqrt(u1) * np.sin(2 * math.pi * u2)], 1)
    out = np.empty(len(P), np.float32)
    for i, (p, n) in enumerate(zip(P, N)):
        a = np.array([1.0, 0, 0]) if abs(n[0]) < .9 else np.array([0, 0, 1.0])
        t = np.cross(n, a)
        t /= np.linalg.norm(t)
        b = np.cross(n, t)
        dirs = local[:, 0:1] * t + local[:, 1:2] * n + local[:, 2:3] * b
        origin = p + n * 0.05
        free = 0
        for d in dirs:
            if d[1] < 0 and origin[1] + d[1] * reach < 0:
                continue                                  # reaches the ground
            hit = tree.ray_cast(Vector(origin), Vector(d), reach)
            if hit[0] is None:
                free += 1
        out[i] = free / rays
    return out


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--unit', type=float, required=True, help='metres per model unit')
    ap.add_argument('--rays', type=int, default=24)
    ap.add_argument('--reach', type=float, default=3.0, help='occlusion ray length, metres')
    a = ap.parse_args(argv)

    pos, nor, cls = gather()
    # A few parts carry corner normals that point against their faces' winding (the drum wall):
    # turn those to agree with the triangle, so lighting and occlusion see the outside.
    tri = pos.reshape(-1, 3, 3)
    face = np.repeat(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), 3, axis=0)
    against = np.sum(face * nor, 1) < 0
    nor[against] *= -1
    print(f'{int(against.sum())} of {len(nor)} corner normals turned to match their faces', flush=True)
    lo, hi = pos.min(0), pos.max(0)
    cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
    # Blender (X, Y, Z) -> three.js (x, y, z) = (X, Z, -Y), metres, centred, standing on y = 0.
    P = np.stack([pos[:, 0] - cx, pos[:, 2] - lo[2], -(pos[:, 1] - cy)], 1) * a.unit
    N = np.stack([nor[:, 0], nor[:, 2], -nor[:, 1]], 1)
    tris = P.reshape(-1, 3, 3)
    pmin = P.min(0)
    size = np.maximum(P.max(0) - pmin, 1e-6)
    qp = np.rint((P - pmin) / size * 65535).astype(np.uint16)
    qn = np.rint(np.clip(N, -1, 1) * 127).astype(np.int8)
    key = np.concatenate([qp.view(np.uint8).reshape(len(P), -1), qn.view(np.uint8).reshape(len(P), -1), cls[:, None]], 1)
    uniq, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inverse = inverse.ravel()
    V, I = len(uniq), len(inverse)
    vp, vn, vc = qp[first], qn[first], cls[first]
    print(f'{len(tris)} triangles, {V} vertices; size {np.round(size, 2)} m', flush=True)
    ao = occlusion(pmin + vp / 65535 * size, vn / 127, tris, a.rays, a.reach)
    print(f'occlusion: mean {ao.mean():.2f}, min {ao.min():.2f}; up-facing {ao[vn[:, 1] > 100].mean():.2f}; by class ' + str([round(float(ao[vc == c].mean()), 2) for c in range(4) if (vc == c).any()]), flush=True)

    def pad(b):
        return b + bytes(-len(b) % 4)

    blob = b'WSMESH1\0' + struct.pack('<II3f3f', V, I, *pmin, *size)
    blob += pad(vp.astype('<u2').tobytes()) + pad(vn.tobytes()) + pad(vc.tobytes())
    blob += pad(np.rint(ao * 255).astype(np.uint8).tobytes()) + inverse.astype('<u4').tobytes()
    with open(a.out, 'wb') as f:
        f.write(gzip.compress(blob, 9, mtime=0))
    print(f'wrote {a.out}: {len(blob)} bytes, {len(gzip.compress(blob, 9, mtime=0))} gzip', flush=True)


main()
