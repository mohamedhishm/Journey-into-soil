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
PORT = 9335
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

time.sleep(2)

try:
    req = urllib.request.urlopen(f"http://localhost:{PORT}/json")
    tabs = json.loads(req.read().decode())
    # find blank or target tab
    target_tab = [t for t in tabs if t.get("type") == "page"][0]
    ws_url = target_tab["webSocketDebuggerUrl"]

    async def capture_all():
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

            async def snap(url, scroll_selector, filename, wait=1.2):
                await call("Page.navigate", {"url": url})
                await asyncio.sleep(wait)
                if scroll_selector:
                    await call("Runtime.evaluate", {
                        "expression": f'''
                            const el = document.querySelector("{scroll_selector}");
                            if (el) el.scrollIntoView({{ behavior: "instant", block: "start" }});
                        '''
                    })
                    await asyncio.sleep(0.8)
                res = await call("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                out = os.path.join(ARTIFACT_DIR, filename)
                with open(out, "wb") as f:
                    f.write(data)
                print(f"Captured {filename} ({len(data)} bytes)")

            # 1. Landing Hero (Cleaned: no NASA 2026, no Astryx badge, single unified CTA)
            await snap("http://localhost:3000/landing.html?theme=dark", None, "astryx_interface_01_hero.png")

            # 2. Why Choose Us (Bento values, NASA + root zone physics)
            await snap("http://localhost:3000/landing.html?theme=dark", "#why-journey", "astryx_interface_02_why.png")

            # 3. Underground Battlefield (Salinity, Nutrients, Moisture)
            await snap("http://localhost:3000/landing.html?theme=dark", "#battlefield", "astryx_interface_03_battlefield.png")

            # 4. How It Works (4-step agronomic pipeline)
            await snap("http://localhost:3000/landing.html?theme=dark", "#how-it-works", "astryx_interface_04_how_it_works.png")

            # 5. Crop Talk AI Companion (Interactive prompts & chat UI)
            await snap("http://localhost:3000/landing.html?theme=dark", "#crop-talk", "astryx_interface_05_crop_talk.png")

            # 6. Interactive Egypt Agroclimatology Map
            await snap("http://localhost:3000/landing.html?theme=dark", "#map-section", "astryx_interface_06_egypt_map.png")

            # 7. Google Account Sign-In Modal (Screenshot background, enlarged logo, Google-only)
            await snap("http://localhost:3000/landing.html?theme=dark&auth=1", None, "astryx_interface_07_google_auth_modal.png")

            # 8. Standalone Google Account Page (Dark mode)
            await snap("http://localhost:3000/account.html?theme=dark", None, "astryx_interface_08_account_page_dark.png")

            # 9. Standalone Google Account Page (Light mode)
            await snap("http://localhost:3000/account.html?theme=light", None, "astryx_interface_09_account_page_light.png")

            # 10. Standalone Google Account Page (Arabic RTL)
            await snap("http://localhost:3000/account.html?theme=dark&lang=ar", None, "astryx_interface_10_account_page_ar.png")

            # 11. Physics Simulation & Advisory Interface
            await snap("http://localhost:3000/index.html", None, "astryx_interface_11_simulator.png", wait=2.5)

    asyncio.run(capture_all())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)

print("All screenshots successfully captured!")
