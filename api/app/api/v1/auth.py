from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from ...config import get_settings

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleAuthPayload(BaseModel):
    code: str | None = Field(default=None, description="OAuth authorization code returned by Google redirect")
    credential: str | None = Field(default=None, description="Google Identity Services ID token credential")
    redirect_uri: str | None = Field(default=None, description="Redirect URI matching the client request")


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    picture: str | None = None
    verified_email: bool = True


class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserProfile


def _create_token(user: UserProfile, secret: str, ttl_seconds: int = 604800) -> str:
    """Create a tamper-proof signed session token using HMAC-SHA256."""
    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "verified_email": user.verified_email,
        "exp": int(time.time()) + ttl_seconds,
    }
    raw_payload = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    signature = hmac.new(secret.encode("utf-8"), raw_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{raw_payload}.{signature}"


def _verify_token(token: str, secret: str) -> dict | None:
    """Verify and parse a signed session token."""
    parts = token.split(".")
    if len(parts) != 2:
        return None
    raw_payload, signature = parts
    expected_sig = hmac.new(secret.encode("utf-8"), raw_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_sig):
        return None
    try:
        padded = raw_payload + "=" * ((4 - len(raw_payload) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


@router.get("/google/url")
def get_google_auth_url(redirect_uri: str | None = Query(None)) -> dict:
    """Generate the Google OAuth 2.0 authorization URL."""
    settings = get_settings()
    target_redirect = redirect_uri or settings.google_redirect_uri
    client_id = settings.google_client_id

    params = {
        "client_id": client_id,
        "redirect_uri": target_redirect,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {
        "auth_url": auth_url,
        "client_id": client_id,
        "redirect_uri": target_redirect,
        "configured": bool(client_id and settings.google_client_secret),
    }


@router.post("/google/callback", response_model=AuthResponse)
async def google_auth_callback(payload: GoogleAuthPayload) -> AuthResponse:
    """Exchange authorization code or verify ID token with Google and issue a session token."""
    settings = get_settings()
    secret_key = settings.auth_secret_key

    # 1. Verification via Google Identity Services ID token (credential)
    if payload.credential:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(f"{GOOGLE_TOKENINFO_URL}?id_token={payload.credential}")
            except httpx.RequestError as exc:
                raise HTTPException(status_code=502, detail=f"Failed to connect to Google OAuth service: {exc}") from exc

            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google ID token credential")

            info = resp.json()
            user = UserProfile(
                id=str(info.get("sub", "")),
                email=str(info.get("email", "")),
                name=str(info.get("name", info.get("email", "").split("@")[0])),
                picture=info.get("picture"),
                verified_email=bool(info.get("email_verified", True)),
            )
            token = _create_token(user, secret_key)
            return AuthResponse(success=True, token=token, user=user)

    # 2. Verification via OAuth Authorization Code
    if not payload.code:
        raise HTTPException(status_code=400, detail="Missing authorization code or credential")

    target_redirect = payload.redirect_uri or settings.google_redirect_uri

    # In dev/offline mode when credentials aren't set in .env yet, permit dev mock code
    if not settings.google_client_id or not settings.google_client_secret:
        if payload.code.startswith("dev_") or payload.code == "mock_code":
            dev_user = UserProfile(
                id="dev-google-1098234",
                email="ahmed.yasser@shifter.org",
                name="Ahmed Yasser",
                picture="https://lh3.googleusercontent.com/a/default-user",
                verified_email=True,
            )
            token = _create_token(dev_user, secret_key)
            return AuthResponse(success=True, token=token, user=dev_user)
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured on the server (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
        )

    # Real Google Token Exchange
    token_data = {
        "code": payload.code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": target_redirect,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data=token_data)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to communicate with Google token endpoint: {exc}") from exc

        if token_resp.status_code != 200:
            error_data = token_resp.json() if "application/json" in token_resp.headers.get("content-type", "") else {}
            raise HTTPException(
                status_code=401,
                detail=error_data.get("error_description", "Invalid or expired authorization code"),
            )

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Google did not return an access token")

        # Fetch verified profile from Google UserInfo endpoint
        try:
            user_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch user profile from Google: {exc}") from exc

        if user_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to retrieve user profile with Google access token")

        info = user_resp.json()
        user = UserProfile(
            id=str(info.get("sub", "")),
            email=str(info.get("email", "")),
            name=str(info.get("name", info.get("email", "").split("@")[0])),
            picture=info.get("picture"),
            verified_email=bool(info.get("email_verified", True)),
        )
        token = _create_token(user, secret_key)
        return AuthResponse(success=True, token=token, user=user)


@router.get("/me")
def get_current_user(authorization: str | None = Header(None)) -> dict:
    """Retrieve the currently authenticated user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required")

    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    payload = _verify_token(token, settings.auth_secret_key)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    return {
        "authenticated": True,
        "user": {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "picture": payload.get("picture"),
            "verified_email": payload.get("verified_email", True),
        },
    }


@router.post("/logout")
def logout() -> dict:
    """Log out and terminate user session."""
    return {"success": True, "message": "Successfully logged out"}
