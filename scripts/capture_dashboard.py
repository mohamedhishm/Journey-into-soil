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
PORT = 9368
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
    req = urllib.request.urlopen(f"http://localhost:{PORT}/json")
    tabs = json.loads(req.read().decode())
    target_tab = next(t for t in tabs if t.get("type") == "page")
    ws_url = target_tab["webSocketDebuggerUrl"]

    async def capture():
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

            async def snap(url, filename, action_js=None):
                await call("Page.navigate", {"url": url})
                await asyncio.sleep(1.2)
                if action_js:
                    await call("Runtime.evaluate", {
                        "expression": action_js
                    })
                    await asyncio.sleep(1.0)
                res = await call("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                out = os.path.join(ARTIFACT_DIR, filename)
                with open(out, "wb") as f:
                    f.write(data)
                print(f"Captured {filename} ({len(data)} bytes)")

            # 1. Dark Mode Dashboard (The 3 Buttons on Sunny Day Sky)
            await snap("http://localhost:3000/dashboard.html", "audit_dashboard_dark.png")

            # 2. Light Mode Dashboard
            await snap("http://localhost:3000/dashboard.html", "audit_dashboard_light.png", action_js='document.querySelector("#themeToggle")?.click();')

            # 3. Arabic Mode Dashboard
            await snap("http://localhost:3000/dashboard.html", "audit_dashboard_ar.png", action_js='document.querySelector("#langToggle")?.click();')

    asyncio.run(capture())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
