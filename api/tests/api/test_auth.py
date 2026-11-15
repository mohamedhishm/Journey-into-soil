from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api.v1.auth import UserProfile, _create_token, _verify_token
from app.config import get_settings
from app.main import app

client = TestClient(app)


def test_get_google_auth_url():
    res = client.get("/api/v1/auth/google/url?redirect_uri=http://localhost:5173/auth/callback")
    assert res.status_code == 200
    data = res.json()
    assert "auth_url" in data
    assert "https://accounts.google.com/o/oauth2/v2/auth" in data["auth_url"]
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback" in data["auth_url"]
    assert "response_type=code" in data["auth_url"]
    assert "scope=openid+email+profile" in data["auth_url"]


def test_token_creation_and_verification():
    secret = "test-secret-123456"
    user = UserProfile(
        id="usr-123",
        email="test@shifter.org",
        name="Test User",
        picture="https://example.com/pic.jpg",
        verified_email=True,
    )
    token = _create_token(user, secret)
    assert "." in token

    # Valid token
    payload = _verify_token(token, secret)
    assert payload is not None
    assert payload["sub"] == "usr-123"
    assert payload["email"] == "test@shifter.org"
    assert payload["name"] == "Test User"

    # Tampered token
    tampered = token[:-4] + "abcd"
    assert _verify_token(tampered, secret) is None

    # Invalid secret
    assert _verify_token(token, "wrong-secret") is None


@pytest.mark.anyio
async def test_auth_credential_success():
    mock_tokeninfo = {
        "sub": "google-sub-998877",
        "email": "farmer.nile@gmail.com",
        "name": "Nile Farmer",
        "picture": "https://lh3.googleusercontent.com/a/photo.jpg",
        "email_verified": True,
    }

    class MockResponse:
        status_code = 200

        def json(self):
            return mock_tokeninfo

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = MockResponse()
        res = client.post("/api/v1/auth/google/callback", json={"credential": "mock_id_token"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["user"]["email"] == "farmer.nile@gmail.com"
        assert data["user"]["name"] == "Nile Farmer"
        assert data["user"]["picture"] == "https://lh3.googleusercontent.com/a/photo.jpg"
        assert "token" in data

        # Test /me endpoint with the issued token
        me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["authenticated"] is True
        assert me_data["user"]["email"] == "farmer.nile@gmail.com"


@pytest.mark.anyio
async def test_auth_code_success():
    settings = get_settings()
    settings.google_client_id = "test-client-id.apps.googleusercontent.com"
    settings.google_client_secret = "test-client-secret"

    class MockTokenResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def json(self):
            return {"access_token": "mock_access_token_12345", "token_type": "Bearer"}

    class MockUserinfoResponse:
        status_code = 200

        def json(self):
            return {
                "sub": "google-user-112233",
                "email": "ahmed.yasser@shifter.org",
                "name": "Ahmed Yasser",
                "picture": "https://lh3.googleusercontent.com/a/ahmed.png",
                "email_verified": True,
            }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, patch(
        "httpx.AsyncClient.get", new_callable=AsyncMock
    ) as mock_get:
        mock_post.return_value = MockTokenResponse()
        mock_get.return_value = MockUserinfoResponse()

        res = client.post(
            "/api/v1/auth/google/callback",
            json={"code": "valid_oauth_code", "redirect_uri": "http://localhost:5173/auth/callback"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["user"]["email"] == "ahmed.yasser@shifter.org"
        assert data["user"]["name"] == "Ahmed Yasser"
        assert "token" in data


def test_auth_missing_payload():
    res = client.post("/api/v1/auth/google/callback", json={})
    assert res.status_code == 400


def test_me_without_token():
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_logout():
    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert res.json()["success"] is True
