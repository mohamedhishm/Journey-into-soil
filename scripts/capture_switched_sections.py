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
PORT = 9360
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

            async def snap(url, scroll_selector, filename):
                await call("Page.navigate", {"url": url})
                await asyncio.sleep(2.0)
                if scroll_selector:
                    await call("Runtime.evaluate", {
                        "expression": f'''
                            const el = document.querySelector("{scroll_selector}");
                            if (el) {{
                                const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
                                window.scrollTo(0, y);
                            }}
                        '''
                    })
                    await asyncio.sleep(1.0)
                res = await call("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                out = os.path.join(ARTIFACT_DIR, filename)
                with open(out, "wb") as f:
                    f.write(data)
                print(f"Captured {filename} ({len(data)} bytes)")

            # 1. How It Works (now right after hero)
            await snap("http://localhost:3000/landing.html?theme=dark", "#how-it-works", "audit_switched_01_how_dark.png")
            # 2. Battlefield (now after How It Works, with new title)
            await snap("http://localhost:3000/landing.html?theme=dark", "#battlefield", "audit_switched_02_battlefield_dark.png")
            # 3. Battlefield in Light mode
            await snap("http://localhost:3000/landing.html?theme=light", "#battlefield", "audit_switched_02_battlefield_light.png")
            # 4. Arabic mode
            await snap("http://localhost:3000/landing.html?lang=ar&theme=dark", "#battlefield", "audit_switched_02_battlefield_ar.png")

    asyncio.run(capture())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
