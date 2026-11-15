# Implementation Plan: Backend Google OAuth Integration

**Date:** 2026-11-14  
**Task:** Design and implement real Google OAuth endpoints on the FastAPI backend, remove client-side hardcoded demo accounts, and link the web app to the live backend authentication flow.  
**Scope:** `api/app/config.py`, `api/app/api/v1/auth.py`, `api/app/main.py`, `api/tests/api/test_auth.py`, `web/src/api/client.ts`, `web/src/state/store.ts`, `web/src/features/landing/LandingPage.tsx`.

---

## 1. Context & Objectives
Previously, the frontend used a mock/demo account structure (`ahmed.yasser@shifter.org`) saved locally in `localStorage`. 
The objective is to replace the mock account with a real OAuth lifecycle backed by FastAPI endpoints:
1. **Google OAuth Config & URL Generation**:
   - Backend endpoint `GET /api/v1/auth/google/url` constructs the Google OAuth 2.0 authorization URL using configured `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, and standard scopes (`openid email profile`).
2. **Secure Token Exchange & Verification**:
   - Backend endpoint `POST /api/v1/auth/google/callback`:
     - Accepts authorization `code` (standard redirect flow) or Google ID token `credential` (Google Identity Services).
     - Exchanges authorization code for Google access token + ID token via Google's OAuth token endpoint (`https://oauth2.googleapis.com/token`) using `httpx`.
     - Validates and parses the authenticated user profile (`id`, `email`, `name`, `picture`, `verified_email`).
     - Issues a signed session/JWT token or session response for the frontend.
3. **Session Verification & Logout**:
   - `GET /api/v1/auth/me`: Verifies the active token and returns the current user profile.
   - `POST /api/v1/auth/logout`: Revokes / invalidates session tokens.
4. **Resilient Offline / Demo Fallback Mode**:
   - In hackathon or offline testing environments where `GOOGLE_CLIENT_SECRET` is not yet set in `.env`, the endpoint returns a clear, structured notice while providing a testable development session so tests and offline demos never break (Rule #6 & Rule #2).
5. **Frontend Lifecycle Integration**:
   - Update `web/src/api/client.ts` with `getGoogleAuthUrl()`, `verifyGoogleAuth(code)`, `getCurrentUser()`, and `logout()`.
   - Update `web/src/state/store.ts` to manage real user state (`user: { id, email, name, picture } | null`).
   - In `LandingPage.tsx`, initiate real Google OAuth redirect/popup, handle `?code=` query parameters on callback, exchange with backend, and display the authenticated Google profile picture and name.

---

## 2. Technical Architecture & Endpoints

### 2.1 Backend Routes (`/api/v1/auth`)
- `GET /api/v1/auth/google/url`:
  - Query parameter: `redirect_uri` (optional override).
  - Returns: `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?...", "client_id": "..." }`.
- `POST /api/v1/auth/google/callback`:
  - Request body: `{ "code"?: string, "credential"?: string, "redirect_uri"?: string }`.
  - Response:
    ```json
    {
      "success": true,
      "token": "<bearer_token>",
      "user": {
        "id": "1098234...",
        "email": "farmer@example.com",
        "name": "Ahmed Yasser",
        "picture": "https://lh3.googleusercontent.com/...",
        "verified_email": true
      }
    }
    ```
- `GET /api/v1/auth/me`:
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "authenticated": true, "user": { ... } }`
- `POST /api/v1/auth/logout`:
  - Response: `{ "success": true, "message": "Logged out" }`

### 2.2 Configuration (`api/app/config.py`)
- `google_client_id: str | None` (from `os.environ.get("GOOGLE_CLIENT_ID")`)
- `google_client_secret: str | None` (from `os.environ.get("GOOGLE_CLIENT_SECRET")`)
- `google_redirect_uri: str` (default `http://localhost:5173`)
- `jwt_secret: str` (for signing internal session tokens)

---

## 3. Verification & Quality Gates
- **Unit Tests**: `api/tests/api/test_auth.py` covering:
  - Generation of Google OAuth URL.
  - Successful authorization code exchange with mocked Google endpoints.
  - Verification of ID tokens.
  - Rejection of invalid codes / tokens with appropriate HTTP status codes (400, 401).
  - Session verification via `/me` and logout.
- **DoD Checks**:
  - `pytest api -q` green (107 existing + new auth tests).
  - `ruff check api` clean.
  - `npm --prefix web run build` clean.
  - `scripts/check_i18n.py` clean.
