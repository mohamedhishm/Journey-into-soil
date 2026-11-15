import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["PACKS_DIR"] = f"{_tmp}/packs"  # no packs: forces the synthetic climate
os.makedirs(os.environ["PACKS_DIR"], exist_ok=True)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    from app.api.v1.routes import _hits
    _hits.clear()
    yield
    _hits.clear()

