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
PORT = 9371
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
            await call("Runtime.enable")
            await call("Log.enable")

            async def snap(filename):
                res = await call("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                out = os.path.join(ARTIFACT_DIR, filename)
                with open(out, "wb") as f:
                    f.write(data)
                print(f"Captured {filename} ({len(data)} bytes)")

            # Navigate to landing.html
            await call("Page.navigate", {"url": "http://localhost:3000/landing.html"})
            await asyncio.sleep(1.5)

            # 1. Capture Initial State: Headline visible, "crop talk ai and launch simulation" button visible, NO Google sign-in button
            await snap("audit_hero_initial.png")

            # 2. Click "crop talk ai and launch simulation" button
            print("Clicking 'crop talk ai and launch simulation' button...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnHeroTryCropTalkLaunch")?.click();'
            })
            await asyncio.sleep(0.8)

            # 3. Capture Three Buttons revealed state (Headline disappeared!)
            await snap("audit_hero_three_buttons.png")

            # 3b. Dark mode for three buttons
            await call("Runtime.evaluate", {
                "expression": 'applyTheme("dark");'
            })
            await asyncio.sleep(0.5)
            await snap("audit_hero_three_buttons_dark.png")
            await call("Runtime.evaluate", {
                "expression": 'applyTheme("light");'
            })
            await asyncio.sleep(0.5)

            # 4. Click Button 2: Print PDF
            print("Opening PDF modal...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnPrintPdf")?.click();'
            })
            await asyncio.sleep(0.8)
            await snap("audit_pdf_modal.png")

            # Close PDF modal
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnClosePdfModal")?.click();'
            })
            await asyncio.sleep(0.5)

            # 5. Click Button 3: Compare with NASA's data
            print("Opening NASA modal...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnCompareNasa")?.click();'
            })
            await asyncio.sleep(0.8)
            await snap("audit_nasa_modal.png")

            # Close NASA modal
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnCloseNasaModal")?.click();'
            })
            await asyncio.sleep(0.5)

            # 6. Click Back to Overview
            print("Clicking Back to Overview...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnBackToHeroOverview")?.click();'
            })
            await asyncio.sleep(0.6)
            await snap("audit_hero_back_to_initial.png")

            # 7. Test in Arabic RTL mode
            print("Testing Arabic RTL mode...")
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#langToggle")?.click();'
            })
            await asyncio.sleep(0.5)
            await call("Runtime.evaluate", {
                "expression": 'document.querySelector("#btnHeroTryCropTalkLaunch")?.click();'
            })
            await asyncio.sleep(0.6)
            await snap("audit_hero_three_buttons_ar.png")

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
