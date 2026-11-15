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
PORT = 9382
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ARTIFACT_DIR = r"C:\Users\DELL\.gemini\antigravity-cli\brain\258286af-a958-4813-babb-3a126c067a30"

proc = subprocess.Popen([
    EDGE_EXE,
    "--headless=new",
    "--disable-gpu",
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
            mid = 0
            async def call(method, params=None):
                nonlocal mid
                mid += 1
                cur_id = mid
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

            await call("Page.navigate", {"url": "http://localhost:3000/landing.html"})
            await asyncio.sleep(1.0)
            await call("Runtime.evaluate", {
                "expression": """
                localStorage.setItem('shifter_user', JSON.stringify({ email: 'ahmed.yasser@shifter.org', name: 'Ahmed Yasser' }));
                location.reload();
                """
            })
            await asyncio.sleep(1.2)

            # Test 3: pb-56 sm:pb-72
            await call("Runtime.evaluate", {
                "expression": """
                const auth = document.querySelector('#heroAuthenticatedContent');
                auth.className = "relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center items-center transition-all duration-300 pb-56 sm:pb-72";
                const grid = auth.querySelector('.grid');
                grid.classList.remove('my-auto');
                """
            })
            await asyncio.sleep(0.5)

            r3 = await call("Runtime.evaluate", {
                "expression": "JSON.stringify(document.querySelector('#btnStartSimulation').getBoundingClientRect())"
            })
            print("Test 3 rect:", r3)

            res = await call("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACT_DIR, "test_pos_3.png"), "wb") as f:
                f.write(base64.b64decode(res["data"]))

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
