import { test } from "node:test";
import assert from "node:assert/strict";
import {
  majorRiverQueryUrl,
  parseMajorRiverGeometry,
} from "../../river-pulse/adapters/dwr-hydrography.js";

test("DWR major-river query requests Russian River geometry in Hacienda UTM zone", () => {
  const url = new URL(majorRiverQueryUrl("Russian River", { outWkid: 32610 }));
  assert.equal(url.origin, "https://gis.water.ca.gov");
  assert.match(url.pathname, /NHD_Major_Rivers\/FeatureServer\/0\/query$/);
  assert.equal(url.searchParams.get("where"), "gnis_name = 'Russian River'");
  assert.equal(url.searchParams.get("returnGeometry"), "true");
  assert.equal(url.searchParams.get("outSR"), "32610");
  assert.equal(url.searchParams.get("f"), "json");
});

test("DWR geometry parser preserves reach identity, projected paths, and provenance", () => {
  const layer = parseMajorRiverGeometry(
    {
      spatialReference: { wkid: 32610 },
      features: [
        {
          attributes: {
            permanent_identifier: "nhd-feature-1",
            OBJECTID: 17,
            gnis_id: "267200",
            gnis_name: "Russian River",
            lengthkm: 8.25,
            reachcode: "18010110000123",
            flowdir: 1,
            mainpath: 1,
          },
          geometry: {
            paths: [
              [
                [506000.5, 4262500.25],
                [506050.5, 4262475.25],
                [506110.5, 4262400.25],
              ],
            ],
          },
        },
      ],
    },
    { requestedName: "Russian River", retrievalTime: "2026-09-28T02:00:00Z", outWkid: 32610 },
  );

  assert.equal(layer.kind, "river-centerline-layer");
  assert.equal(layer.horizontal_crs, "EPSG:32610");
  assert.equal(layer.features.length, 1);
  const feature = layer.features[0];
  assert.equal(feature.feature_id, "nhd-feature-1");
  assert.equal(feature.name, "Russian River");
  assert.equal(feature.reachcode, "18010110000123");
  assert.equal(feature.length_km, 8.25);
  assert.deepEqual(feature.paths[0][1], [506050.5, 4262475.25]);
  assert.equal(feature.provenance.agency, "California Department of Water Resources");
  assert.equal(feature.provenance.retrieval_time, "2026-09-28T02:00:00.000Z");
});

test("DWR geometry parser drops malformed and one-point paths", () => {
  const layer = parseMajorRiverGeometry({
    spatialReference: { latestWkid: 32610 },
    features: [
      {
        attributes: { OBJECTID: 1, gnis_name: "Russian River" },
        geometry: { paths: [[[1, 2]], [[1, 2], ["bad", 3]]] },
      },
      {
        attributes: { OBJECTID: 2, gnis_name: "Russian River" },
        geometry: { paths: [[[10, 20], [30, 40]]] },
      },
    ],
  });
  assert.equal(layer.features.length, 1);
  assert.equal(layer.features[0].feature_id, "dwr-major-river:2");
});
