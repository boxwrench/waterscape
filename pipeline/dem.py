"""USGS 3DEP elevation: fetch, reservoir detection, derived channels and packing."""

import gzip
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
HEIGHT = {"offset": -250.0, "scale": 0.05}  # -250 .. 3026 m at 5 cm
SHORE = {"offset": -4000.0, "scale": 0.25}  # -4000 .. 12383 m at 25 cm
VALLEY = {"offset": 0, "scale": 1 / 65472}


def fetch_dem(rid, bbox, size, cache_dir, zone):
    """Float32 UTM elevation grid in the given zone; returns (dem, cell_x, cell_y, left, top)."""
    cache = Path(cache_dir) / f"{rid}_z{zone}.tif"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = (
            f"{SERVICE}/exportImage?bbox={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}&bboxSR=4326"
            f"&imageSR=326{zone:02d}&size={size[0]},{size[1]}&format=tiff&pixelType=F32"
            "&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image"
        )
        with urllib.request.urlopen(url, timeout=120) as r:
            cache.write_bytes(r.read())
    img = Image.open(cache)
    scale, tie = img.tag_v2[33550], img.tag_v2[33922]
    return np.array(img, dtype=np.float32), float(scale[0]), float(scale[1]), tie[3], tie[4]


def detect_water(dem, anchor=None, min_area_cells=5000, extra=()):
    """Lidar hydro-flattens water: the reservoir is the largest connected region at the
    most common elevation, or (with an anchor) the flat region containing the anchor.
    `extra` anchors add further flat regions at the same level (a reservoir split by a
    causeway). Returns (mask, water_level)."""
    if anchor is not None:
        r, c = anchor
        anchor_level = float(dem[r, c])
        neighbourhood = dem[max(r - 1, 0):r + 2, max(c - 1, 0):c + 2]
        if not np.all(np.abs(neighbourhood - anchor_level) < 0.15):
            raise ValueError(f"anchor {anchor} is not on lidar-flattened water")
        level = round(anchor_level * 10) / 10
        labels, _ = ndimage.label(np.abs(dem - level) < 0.15)
        for er, ec in extra:
            if abs(float(dem[er, ec]) - level) >= 0.15:
                raise ValueError(f"extra anchor {(er, ec)} is not at the water level {level}")
        water = ndimage.binary_closing(np.isin(labels, [labels[r, c]] + [labels[er, ec] for er, ec in extra]),
                                       iterations=2)
    else:
        vals, counts = np.unique(np.round(dem * 10) / 10, return_counts=True)
        level = float(vals[counts.argmax()])
        labels, _ = ndimage.label(np.abs(dem - level) < 0.15)
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        water = ndimage.binary_closing(labels == sizes.argmax(), iterations=2)
    if water.sum() < min_area_cells:
        raise ValueError(f"no reservoir found (largest flat region {int(water.sum())} cells)")
    return water, level


def burn_dams(water, crests, reach=4.0, always=0.0, below=None):
    """Extend the water up to each dam's upstream face. Lidar flattens the lake only to a
    cell or two short of a dam, leaving the smeared dam top as shore; the concrete sits on
    the crest line. `crests` are polylines in raster (col, row) units; on the side where the
    water already is and within the crest's span, cells within `always` become water, and
    cells within `reach` where `below` (a mask, e.g. lower than the crest) allows."""
    out = water.copy()
    for crest in crests:
        dist, side, within = _crest_frame(water.shape, crest)
        wet = water & (dist <= reach)
        up = 1 if (side[wet] > 0).sum() >= (side[wet] < 0).sum() else -1
        upstream = (side == up) & within
        out |= upstream & (dist <= always)
        out |= upstream & (dist <= reach) & (True if below is None else below)
    return out


def _crest_frame(shape, crest):
    """Distance (raster units) to a crest polyline and the side (+1/-1) of each cell."""
    rows, cols = np.mgrid[0:shape[0], 0:shape[1]]
    best = np.full(shape, np.inf)
    side = np.zeros(shape)
    # Whether the nearest point lies within the crest's span (not beyond either end).
    within = np.zeros(shape, bool)
    last = len(crest) - 2
    for i, ((c0, r0), (c1, r1)) in enumerate(zip(crest, crest[1:])):
        dc, dr = c1 - c0, r1 - r0
        length = np.hypot(dc, dr)
        if length == 0:
            continue
        raw = ((cols - c0) * dc + (rows - r0) * dr) / length**2
        t = np.clip(raw, 0, 1)
        dist = np.hypot(cols - (c0 + t * dc), rows - (r0 + t * dr))
        closer = dist < best
        best[closer] = dist[closer]
        side[closer] = np.sign((cols - c0) * dr - (rows - r0) * dc)[closer]
        inside = ~(((i == 0) & (raw < 0)) | ((i == last) & (raw > 1)))
        within[closer] = inside[closer]
    return best, side, within


def carve_dams(dem, water, crests, crest_elevations, cell, heights=None):
    """Lower the lidar under each dam's downstream face (renderer/land/structures.js
    gravityProfile: 7.5 m crest, face from 6 m below it at 0.75 horizontal per vertical) to 6 m
    beneath the concrete, so the modelled dam is not pierced by the survey's smeared dam (the
    land mesh's 10 m triangles interpolate across the footprint's edge, hence the margin).
    Returns (carved dem, footprint mask)."""
    out = dem.copy()
    footprint = np.zeros(dem.shape, bool)
    for i, (crest, top) in enumerate(zip(crests, crest_elevations)):
        dist, side, within = _crest_frame(dem.shape, crest)
        wet = water & (dist * cell < 40)
        up = 1 if (side[wet] > 0).sum() >= (side[wet] < 0).sum() else -1
        u = dist * cell
        face = np.where(u <= 7.5, top - 1.0, top - 6.0 - (u - 7.5) / 0.75)
        # The base width of the profile (its footing 12 m below the recorded height).
        width = 7.5 + 0.75 * ((heights[i] if heights else 90.0) + 12.0 - 6.0)
        foot = (side == -up) & within & (u <= width)
        out[foot] = np.minimum(out[foot], face[foot] - 6.0)
        footprint |= foot
        # The crest line itself: the survey smears the dam top over a cell or two either side,
        # which would ramp land up the upstream face. Sink it to the toe; the lake side stays
        # water (not in the footprint).
        line = within & (u <= 1.6 * cell)
        out[line] = np.minimum(out[line], top - (heights[i] if heights else 90.0))
    return out, footprint


def carve_river(dem, centre, widths, surfaces, cell, depth=1.5, clear=0.0):
    """Cut a river below its surface so a ribbon of water at `surfaces` shows over the 10 m
    grid, which smears a narrow channel. `centre` is a polyline in raster (col, row) units;
    `widths` (metres) and `surfaces` (elevations) are per point and interpolated along it.
    Returns (carved dem, footprint mask); the footprint extends `clear` metres past the banks
    (the canyon kept free of trees)."""
    rows, cols = np.mgrid[0:dem.shape[0], 0:dem.shape[1]]
    best = np.full(dem.shape, np.inf)
    width = np.zeros(dem.shape)
    surface = np.zeros(dem.shape)
    for i, ((c0, r0), (c1, r1)) in enumerate(zip(centre, centre[1:])):
        dc, dr = c1 - c0, r1 - r0
        t = np.clip(((cols - c0) * dc + (rows - r0) * dr) / max(dc * dc + dr * dr, 1e-9), 0, 1)
        dist = np.hypot(cols - (c0 + t * dc), rows - (r0 + t * dr)) * cell
        closer = dist < best
        best[closer] = dist[closer]
        width[closer] = (widths[i] + (widths[i + 1] - widths[i]) * t)[closer]
        surface[closer] = (surfaces[i] + (surfaces[i + 1] - surfaces[i]) * t)[closer]
    # Half the width plus half a cell, so the grid's samples straddle both banks.
    channel = best <= width / 2 + cell / 2
    out = dem.copy()
    out[channel] = np.minimum(out[channel], surface[channel] - depth)
    return out, best <= width / 2 + cell / 2 + clear


def channels(dem, water, level, cell):
    """(height above water, signed shoreline distance in metres, valley-ness 0..1)."""
    sdf = ndimage.distance_transform_edt(~water) * cell - ndimage.distance_transform_edt(water) * cell
    height = dem - level
    height[water] = 0.0
    lap = ndimage.laplace(ndimage.gaussian_filter(height, 6.0)) / (cell * cell)
    spread = np.percentile(np.abs(lap[~water]), 95)
    valley = np.clip(0.5 + 0.5 * lap / spread, 0.0, 1.0)
    return height, sdf, valley


def pack(height, sdf, valley):
    """Planar uint16 channels, each row delta-coded from the row above (mod 65536)."""
    planes = [
        np.clip(np.round((height - HEIGHT["offset"]) / HEIGHT["scale"]), 0, 65535).astype(np.int64),
        np.clip(np.round((sdf - SHORE["offset"]) / SHORE["scale"]), 0, 65535).astype(np.int64),
        np.round(valley * 1023).astype(np.int64) * 64,
    ]
    body = b""
    for plane in planes:
        delta = plane.copy()
        delta[1:] = (plane[1:] - plane[:-1]) % 65536
        body += delta.astype("<u2").tobytes()
    return body


def write_gzip(path, body):
    with gzip.GzipFile(path, "wb", compresslevel=9, mtime=0) as g:
        g.write(body)
