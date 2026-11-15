from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # repo root locally, /srv in the container


def _load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    values: dict[str, str] = {}
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()  # later lines win inside the file
    for k, v in values.items():
        os.environ.setdefault(k, v)  # real environment still wins


def _dir(env_key: str, default: Path) -> Path:
    """Configured directory, or the repo-local default when the configured one is absent.

    `.env` may hold container paths (for example /srv/knowledge). Running the API or the tests
    outside the container should still work, so an unreachable path falls back to the repo copy.
    """
    configured = os.environ.get(env_key)
    if configured:
        path = Path(configured)
        if path.exists():
            return path
    return default


class Settings:
    def __init__(self) -> None:
        _load_dotenv()
        self.knowledge_dir = _dir("KNOWLEDGE_DIR", ROOT / "knowledge")
        self.contracts_dir = _dir("CONTRACTS_DIR", ROOT / "contracts")
        self.packs_dir = _dir("PACKS_DIR", ROOT / "data" / "packs")
        db = os.environ.get("DATABASE_URL", f"sqlite:///{ROOT / 'data' / 'app.db'}")
        self.db_path = db.replace("sqlite:///", "", 1)
        if not Path(self.db_path).parent.exists():
            self.db_path = str(ROOT / "data" / "app.db")
        self.cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
        self.google_client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
        self.google_client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
        self.google_redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5173")
        self.auth_secret_key = os.environ.get("AUTH_SECRET_KEY", "journey-into-the-soil-secret-key-2026")
        self.meteomatics_username = os.environ.get("METEOMATICS_USERNAME", "")
        self.meteomatics_password = os.environ.get("METEOMATICS_PASSWORD", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
