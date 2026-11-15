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
PORT = 9375
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

            async def snap(filename):
                res = await call("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                out = os.path.join(ARTIFACT_DIR, filename)
                with open(out, "wb") as f:
                    f.write(data)
                print(f"Captured {filename} ({len(data)} bytes)")

            # Step 1: Navigate to landing.html as Guest (ensure localStorage is cleared)
            await call("Page.navigate", {"url": "http://localhost:3000/landing.html"})
            await asyncio.sleep(1.2)
            await call("Runtime.evaluate", {"expression": "localStorage.removeItem('shifter_user'); location.reload();"})
            await asyncio.sleep(1.5)

            # Capture guest state (headline visible, three buttons hidden)
            await snap("audit_email_step1_guest_hero.png")

            # Step 2: Click "crop talk ai and launch simulation"
            print("Clicking 'crop talk ai and launch simulation' button (unauthenticated)...")
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#btnHeroTryCropTalkLaunch')?.click();"
            })
            await asyncio.sleep(1.5)

            # User is now on the account page!
            cur_url = await call("Runtime.evaluate", {"expression": "window.location.pathname"})
            print("Current URL after click:", cur_url)
            await snap("audit_email_step2_account_page.png")

            # Step 3: Test validation - click submit with empty email
            print("Testing email validation...")
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#btnSubmitEmail')?.click();"
            })
            await asyncio.sleep(0.5)
            await snap("audit_email_step3_validation_error.png")

            # Step 4: Enter valid email and submit
            print("Entering email 'farmer.delta@egyptsoil.org' and submitting...")
            await call("Runtime.evaluate", {
                "expression": """
                const input = document.querySelector('#inputEmail');
                input.value = 'farmer.delta@egyptsoil.org';
                document.querySelector('#emailAuthForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                """
            })
            await asyncio.sleep(1.8)

            # Now back on landing.html!
            cur_url2 = await call("Runtime.evaluate", {"expression": "window.location.pathname"})
            print("Current URL after email submit:", cur_url2)
            # The headline disappeared, and the three buttons appear with active email badge!
            await snap("audit_email_step4_hero_unlocked.png")

            # Step 5: Test in Dark Mode
            print("Testing Dark Mode...")
            await call("Runtime.evaluate", {"expression": "applyTheme('dark');"})
            await asyncio.sleep(0.6)
            await snap("audit_email_step5_hero_unlocked_dark.png")
            await call("Runtime.evaluate", {"expression": "applyTheme('light');"})
            await asyncio.sleep(0.5)

            # Step 6: Test Sign Out
            print("Testing Sign Out...")
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#btnSignOut')?.click();"
            })
            await asyncio.sleep(0.8)
            # Headline and details reappear, three buttons disappear
            await snap("audit_email_step6_after_signout.png")

            # Step 7: Test in Arabic RTL mode
            print("Testing Arabic RTL mode...")
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#langToggle')?.click();"
            })
            await asyncio.sleep(0.6)
            # Click Arabic button
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#btnHeroTryCropTalkLaunch')?.click();"
            })
            await asyncio.sleep(1.5)
            # On account page in Arabic, click Ahmed Yasser 1-tap account
            await call("Runtime.evaluate", {
                "expression": "document.querySelector('#btnGooglePrimaryAccount')?.click();"
            })
            await asyncio.sleep(1.8)
            # Now back on landing.html in Arabic with three buttons unlocked
            await snap("audit_email_step7_hero_unlocked_ar.png")

    asyncio.run(run_test())
finally:
    proc.terminate()
    shutil.rmtree(temp_dir, ignore_errors=True)
