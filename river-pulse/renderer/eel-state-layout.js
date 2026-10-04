// Geographic context only. Local equirectangular projection, north up; no flood model.
export function watershedMap(unit, area, source) {
  const rings = feature => {
    const geometry = feature.geometry;
    if (geometry.type === "Polygon") return geometry.coordinates;
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
    throw new Error("CalWater context requires polygon geometry");
  };
  const outer = rings(unit.features[0]), lower = rings(area.features[0]), points = outer.flat(),
    west = Math.min(...points.map(p => p[0])), east = Math.max(...points.map(p => p[0])),
    south = Math.min(...points.map(p => p[1])), north = Math.max(...points.map(p => p[1])),
    aspect = Math.cos((south + north) / 2 * Math.PI / 180),
    scale = Math.min(288 / ((east - west) * aspect), 188 / (north - south)),
    dx = (340 - (east - west) * aspect * scale) / 2,
    dy = (240 - (north - south) * scale) / 2,
    project = ([lon, lat]) => [dx + (lon - west) * aspect * scale, dy + (north - lat) * scale],
    path = polygons => polygons.map(ring => ring.map((point, index) =>
      (index ? "L" : "M") + project(point).map(v => v.toFixed(2)).join(",")).join(" ") + "Z").join(" ");
  const [w, s, e, n] = source.bbox;
  return {
    unitPath: path(outer), areaPath: path(lower),
    extentPath: path([[[w, s], [e, s], [e, n], [w, n], [w, s]]]),
    anchor: project([source.anchor[1], source.anchor[0]]),
    unitName: unit.features[0].properties.HUNAME,
    unitCode: String(unit.features[0].properties.IDNUM),
    areaName: area.features[0].properties.FIRST_HANAME,
    areaCode: String(area.features[0].properties.RBUA),
  };
}
