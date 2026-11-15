import asyncio
import json
import os
import subprocess
import tempfile
import shutil
import time
import urllib.request
import websockets

temp_dir = tempfile.mkdtemp()
PORT = 9379
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

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
        async with websockets.connect(ws_url) as ws:
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
            await asyncio.sleep(1.5)

            inspect = await call("Runtime.evaluate", {
                "expression": """
                (() => {
                    const sec = document.querySelector('section');
                    const auth = document.querySelector('#heroAuthenticatedContent');
                    const grid = auth.querySelector('.grid');
                    return JSON.stringify({
                        sec: { h: sec.clientHeight, rect: sec.getBoundingClientRect() },
                        auth: { h: auth.clientHeight, rect: auth.getBoundingClientRect() },
                        grid: { h: grid.clientHeight, rect: grid.getBoundingClientRect() }
                    });
                })()
                """
            })
            print("Layout inspect:", inspect)

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
