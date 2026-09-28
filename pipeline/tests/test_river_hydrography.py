import build_river_hydrography as hydro
import geo


def test_query_url_requests_all_flowline_types_and_geojson():
    url = hydro.query_url([-122.96, 38.49, -122.90, 38.53])
    assert "FeatureServer%2F50" not in url
    assert "where=1%3D1" in url
    assert "featuretype%3D1" not in url
    assert "geometryType=esriGeometryEnvelope" in url
    assert "outSR=4326" in url
    assert "f=geojson" in url


def test_localize_feature_pins_anchor_to_local_origin():
    anchor = [38.508482040255636, -122.9277345330354]
    zone = geo.utm_zone(anchor[1])
    origin_e, origin_n = geo.utm(anchor[0], anchor[1], zone)
    feature = {
        "id": "1",
        "type": "Feature",
        "properties": {
            "id3dhp": "abc1234",
            "gnisidlabel": "Russian River",
            "featuretype": 5,
            "featuretypelabel": "Waterbody Connector",
            "flowdirectionlabel": "With digitized",
            "streamorder": 5,
            "lengthkm": 2.5,
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [anchor[1], anchor[0]],
                [anchor[1] + 0.001, anchor[0]],
            ],
        },
    }
    localized = hydro.localize_feature(feature, origin_e, origin_n, zone)
    assert localized["id"] == "abc1234"
    assert localized["name"] == "Russian River"
    assert localized["featureTypeCode"] == 5
    assert localized["featureType"] == "Waterbody Connector"
    assert localized["streamOrder"] == 5
    x0, z0 = localized["lines"][0][0]
    assert abs(x0) <= 0.01
    assert abs(z0) <= 0.01
    assert localized["lines"][0][1][0] > 0


def test_build_document_is_stable_and_carries_source_contract():
    config = {
        "id": "hacienda_bridge",
        "name": "Hacienda Bridge",
        "anchor": [38.508482040255636, -122.9277345330354],
        "bbox": [-122.96, 38.49, -122.90, 38.53],
    }
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "id": "2",
                "properties": {"id3dhp": "b", "gnisidlabel": "Tributary", "featuretype": 1},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-122.928, 38.508], [-122.927, 38.509]],
                },
            },
            {
                "id": "1",
                "properties": {"id3dhp": "a", "gnisidlabel": "Russian River", "featuretype": 5},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-122.929, 38.507], [-122.928, 38.508]],
                },
            },
        ],
    }
    doc = hydro.build_document(config, payload, "https://example.test/query")
    assert doc["schemaVersion"] == "river-pulse-hydrography-0.1"
    assert doc["source"].startswith("U.S. Geological Survey")
    assert doc["crs"] == "EPSG:32610"
    assert doc["featureFilter"].startswith("all 3DHP Flowline")
    assert [feature["id"] for feature in doc["features"]] == ["a", "b"]
    assert "velocity" not in doc
    assert "depth" not in doc
