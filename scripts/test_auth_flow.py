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
PORT = 9369
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

            # Navigate to landing.html
            await call("Page.navigate", {"url": "http://localhost:3000/landing.html"})
            await asyncio.sleep(1.5)

            # 1. Click Sign In button in header
            print("Clicking header sign-in button...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#headerAuthBtn")?.click();'
            })
            await asyncio.sleep(0.8)

            # Snap auth modal open
            res = await call("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACT_DIR, "audit_auth_modal_open.png"), "wb") as f:
                f.write(base64.b64decode(res["data"]))
            print("Captured audit_auth_modal_open.png")

            # 2. Click Primary Google account (Ahmed Yasser)
            print("Clicking Google sign-in...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnGooglePrimaryAccount")?.click();'
            })
            await asyncio.sleep(1.5)

            # 3. Check current URL and localStorage
            eval_res = await call("Runtime.evaluate", {
                "expression": 'JSON.stringify({ url: window.location.href, user: localStorage.getItem("shifter_user") })'
            })
            print("Result after sign-in:", eval_res.get("result", {}).get("value"))

            # Snap landing page after sign-in (showing authenticated header, staying on landing.html)
            res2 = await call("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACT_DIR, "audit_after_signin.png"), "wb") as f:
                f.write(base64.b64decode(res2["data"]))
            print("Captured audit_after_signin.png")

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
