import asyncio
import json
import os
import subprocess
import tempfile
import shutil
import time
import urllib.request
import base64
import websockets

temp_dir = tempfile.mkdtemp()
PORT = 9378
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ARTIFACT_DIR = r"C:\Users\DELL\.gemini\antigravity-cli\brain\258286af-a958-4813-babb-3a126c067a30"

proc = subprocess.Popen([
    EDGE_EXE,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    f"--user-data-dir={temp_dir}",
    f"--remote-debugging-port={PORT}",
    "about:blank"
])

time.sleep(1.5)

try:
    tabs = json.loads(urllib.request.urlopen(f"http://localhost:{PORT}/json").read().decode())
    target_tab = next(t for t in tabs if t.get("type") == "page")
    ws_url = target_tab["webSocketDebuggerUrl"]

    async def run_test():
        async with websockets.connect(ws_url, max_size=20000000) as ws:
            msg_id = 0
            async def call(method, params=None):
                nonlocal msg_id
                msg_id += 1
                cur_id = msg_id
                await ws.send(json.dumps({"id": cur_id, "method": method, "params": params or {}}))
                while True:
                    resp = json.loads(await ws.recv())
                    if resp.get("id") == cur_id:
                        return resp.get("result")

            await call("Emulation.setDeviceMetricsOverride", {
                "width": 1440,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False
            })

            # Navigate to landing.html with email already set
            await call("Page.navigate", {"url": "http://localhost:3000/landing.html"})
            await asyncio.sleep(1.0)
            await call("Runtime.evaluate", {
                "expression": """
                localStorage.setItem('shifter_user', JSON.stringify({ email: 'ahmed.yasser@shifter.org', name: 'Ahmed Yasser' }));
                location.reload();
                """
            })
            await asyncio.sleep(1.5)

            # Check bounding box of the three buttons
            rect = await call("Runtime.evaluate", {
                "expression": """
                (() => {
                    const el = document.querySelector('#btnStartSimulation');
                    const b = el ? el.getBoundingClientRect() : null;
                    return JSON.stringify(b);
                })()
                """
            })
            print("Current btnStartSimulation rect:", rect)

            res = await call("Page.captureScreenshot", {"format": "png"})
            data = base64.b64decode(res["data"])
            out = os.path.join(ARTIFACT_DIR, "audit_current_buttons_pos.png")
            with open(out, "wb") as f:
                f.write(data)
            print("Captured current position screenshot.")

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
