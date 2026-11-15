
from fastapi.testclient import TestClient

from app.main import app
from app.services.soil import parse_soilgrids

client = TestClient(app)
BODY = {"reference_date": "2026-11-01"}


def test_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_crops_and_sources_and_demo_sites():
    crops = client.get("/api/v1/crops").json()
    assert any(c["id"] == "wheat" and c["reviewed"] is False for c in crops)
    assert "power" in client.get("/api/v1/knowledge/sources").json()
    sites = client.get("/api/v1/demo-sites").json()
    assert len(sites) >= 3 and {"lat", "lon", "preset"} <= set(sites[0])


def test_create_then_share_link_roundtrip():
    r = client.post("/api/v1/analyses", json=BODY)
    assert r.status_code == 200
    result = r.json()
    assert len(result["strategies"]) == 3
    got = client.get(f"/api/v1/analyses/{result['request_id']}")
    assert got.status_code == 200 and got.json()["request_id"] == result["request_id"]


def test_same_request_same_id():
    a = client.post("/api/v1/analyses", json=BODY).json()["request_id"]
    b = client.post("/api/v1/analyses", json=BODY).json()["request_id"]
    assert a == b


def test_unknown_id_404():
    assert client.get("/api/v1/analyses/doesnotexist").status_code == 404


def test_scenario_recomputes_with_new_id():
    base = client.post("/api/v1/analyses", json=BODY).json()
    hot = client.post(f"/api/v1/analyses/{base['request_id']}/scenario", json={"dT": 3, "dP": -20})
    assert hot.status_code == 200
    assert hot.json()["request_id"] != base["request_id"]
    assert hot.json()["climate"]["scenario"] == {"dT": 3.0, "dP": -20.0}


def test_validation_errors_are_422():
    assert client.post("/api/v1/analyses", json={"lat": 80}).status_code == 422
    assert client.post("/api/v1/analyses", json={"texture": "moon_dust"}).status_code == 422
    assert client.post("/api/v1/analyses/x/scenario", json={"dT": 99}).status_code == 422


def test_geo_lookup_without_network():
    r = client.get("/api/v1/geo/lookup", params={"lat": 30.8, "lon": 31.0})
    j = r.json()
    assert r.status_code == 200 and j["in_delta_area"] and j["climate"]["source"] == "synthetic"
    assert 10 < j["climate"]["mean_tmax"] < 40


def test_soilgrids_parser():
    payload = {"properties": {"layers": [
        {"name": "sand", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 400}}]},
        {"name": "clay", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 300}}]},
        {"name": "soc", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 150}}]},
        {"name": "phh2o", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 78}}]}]}}
    assert parse_soilgrids(payload) == {"sand": 40.0, "clay": 30.0, "om": 2.59, "ph": 7.8}
    assert parse_soilgrids({}) is None


def test_every_demo_site_returns_200_with_own_region_and_preset():
    import yaml

    from app.config import ROOT

    sites = yaml.safe_load((ROOT / "knowledge" / "demo_sites.yaml").read_text(encoding="utf-8"))["sites"]
    for site in sites:
        payload = {
            "lat": site["lat"],
            "lon": site["lon"],
            "region": site.get("region"),
            **site.get("preset", {}),
        }
        resp = client.post("/api/v1/analyses", json=payload)
        assert resp.status_code == 200, f"Site {site['id']} failed with HTTP {resp.status_code}: {resp.text}"

