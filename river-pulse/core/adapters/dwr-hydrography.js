export const DWR_MAJOR_RIVERS_LAYER =
  "https://gis.water.ca.gov/arcgis/rest/services/InlandWaters/NHD_Major_Rivers/FeatureServer/0";
export const RUSSIAN_RIVER_NAME = "Russian River";

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function majorRiverQueryUrl(name, { outWkid = 32610 } = {}) {
  const url = new URL(`${DWR_MAJOR_RIVERS_LAYER}/query`);
  url.searchParams.set("where", `gnis_name = ${sqlString(name)}`);
  url.searchParams.set(
    "outFields",
    "permanent_identifier,gnis_id,gnis_name,lengthkm,reachcode,flowdir,mainpath,OBJECTID",
  );
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", String(outWkid));
  url.searchParams.set("resultRecordCount", "1000");
  url.searchParams.set("f", "json");
  return url.toString();
}

function normalizePath(path) {
  if (!Array.isArray(path)) return [];
  return path
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])))
    .map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])]);
}

export function parseMajorRiverGeometry(
  payload,
  { retrievalTime = new Date().toISOString(), requestedName = null, outWkid = 32610 } = {},
) {
  if (payload?.error) throw new Error(`DWR hydrography error: ${payload.error.message ?? "unknown error"}`);
  const spatialReference = payload?.spatialReference ?? {},
    wkid = spatialReference.latestWkid ?? spatialReference.wkid ?? outWkid,
    features = [];

  for (const feature of payload?.features ?? []) {
    const attributes = feature?.attributes ?? {},
      paths = (feature?.geometry?.paths ?? []).map(normalizePath).filter((path) => path.length >= 2);
    if (!paths.length) continue;
    features.push({
      feature_id: attributes.permanent_identifier ?? `dwr-major-river:${attributes.OBJECTID ?? features.length}`,
      name: attributes.gnis_name ?? requestedName,
      gnis_id: attributes.gnis_id ?? null,
      reachcode: attributes.reachcode ?? null,
      length_km: Number.isFinite(Number(attributes.lengthkm)) ? Number(attributes.lengthkm) : null,
      flow_direction: attributes.flowdir ?? null,
      main_path: attributes.mainpath ?? null,
      paths,
      provenance: {
        agency: "California Department of Water Resources",
        dataset: "NHD Major Rivers",
        source_layer: DWR_MAJOR_RIVERS_LAYER,
        source_object_id: attributes.OBJECTID ?? null,
        retrieval_time: new Date(retrievalTime).toISOString(),
        source_note: "DWR cartographic extraction from USGS National Hydrography Dataset",
      },
    });
  }

  return Object.freeze({
    kind: "river-centerline-layer",
    requested_name: requestedName,
    horizontal_crs: `EPSG:${wkid}`,
    features: Object.freeze(features),
  });
}

export async function fetchMajorRiverGeometry(
  name,
  { outWkid = 32610, fetchImpl = fetch } = {},
) {
  const retrievalTime = new Date().toISOString(),
    url = majorRiverQueryUrl(name, { outWkid }),
    response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`DWR NHD Major Rivers ${response.status}`);
  return {
    url,
    retrieval_time: retrievalTime,
    layer: parseMajorRiverGeometry(await response.json(), { retrievalTime, requestedName: name, outWkid }),
  };
}
