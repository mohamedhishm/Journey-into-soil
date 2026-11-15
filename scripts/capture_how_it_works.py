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
PORT = 9377
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

            await call("Page.navigate", {"url": "http://localhost:3000/landing.html#how-it-works"})
            await asyncio.sleep(1.5)

            # Scroll into how-it-works view
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'instant', block: 'start' });"
            })
            await asyncio.sleep(1.0)

            # 1. Light Mode
            res = await call("Page.captureScreenshot", {"format": "png"})
            data = base64.b64decode(res["data"])
            out = os.path.join(ARTIFACT_DIR, "audit_how_it_works_container2_light.png")
            with open(out, "wb") as f:
                f.write(data)
            print(f"Captured audit_how_it_works_container2_light.png ({len(data)} bytes)")

            # 2. Dark Mode
            await call("Runtime.evaluate", {"expression": "applyTheme('dark');"})
            await asyncio.sleep(0.6)
            res2 = await call("Page.captureScreenshot", {"format": "png"})
            data2 = base64.b64decode(res2["data"])
            out2 = os.path.join(ARTIFACT_DIR, "audit_how_it_works_container2_dark.png")
            with open(out2, "wb") as f:
                f.write(data2)
            print(f"Captured audit_how_it_works_container2_dark.png ({len(data2)} bytes)")

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
