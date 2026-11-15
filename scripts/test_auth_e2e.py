import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9228

async def main():
    # 1. Launch Edge headless with remote debugging
    proc = subprocess.Popen([
        EDGE_EXE,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--disable-gpu",
        "http://localhost:3000/landing.html"
    ])
    await asyncio.sleep(2)

    try:
        # 2. Get target webSocketDebuggerUrl
        req = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json")
        targets = json.loads(req.read().decode())
        page = next(t for t in targets if t["type"] == "page" and "landing.html" in t["url"])
        ws_url = page["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url) as ws:
            msg_id = 0
            async def call(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    resp = json.loads(await ws.recv())
                    if resp.get("id") == msg_id:
                        return resp.get("result", {})

            async def eval_js(expression):
                res = await call("Runtime.evaluate", {"expression": expression, "returnByValue": True})
                return res.get("result", {}).get("value")

            # 3. Verify clean logged-out state
            await eval_js("localStorage.removeItem('shifter_user')")
            await eval_js("renderHeaderAuth()")

            is_modal_hidden = await eval_js("document.getElementById('authModal').classList.contains('opacity-0')")
            print("Modal initially hidden:", is_modal_hidden)
            assert is_modal_hidden is True

            btn_text = await eval_js("document.getElementById('btnHeroTryCropTalkLaunch').innerText.trim()")
            print("Hero button text:", btn_text)
            assert "try crop talk ai and launch simulation" in btn_text.lower()

            # 4. Click hero button while logged out -> Modal should open!
            await eval_js("document.getElementById('btnHeroTryCropTalkLaunch').click()")
            await asyncio.sleep(0.5)

            is_modal_visible = await eval_js("document.getElementById('authModal').classList.contains('opacity-100')")
            print("Modal visible after clicking hero CTA:", is_modal_visible)
            assert is_modal_visible is True

            # 5. Verify fields inside modal
            email_val = await eval_js("document.getElementById('authEmailInput').value")
            pwd_type = await eval_js("document.getElementById('authPasswordInput').getAttribute('type')")
            print("Default email in input:", email_val, "| password type:", pwd_type)

            # Test password visibility toggle
            await eval_js("document.getElementById('togglePasswordBtn').click()")
            pwd_type_toggled = await eval_js("document.getElementById('authPasswordInput').getAttribute('type')")
            print("Password type after eye toggle:", pwd_type_toggled)
            assert pwd_type_toggled == "text"

            # 6. Test Quick Demo login
            await eval_js("document.getElementById('btnQuickDemoAuth').click()")
            await asyncio.sleep(0.5)

            stored_user = await eval_js("JSON.parse(localStorage.getItem('shifter_user') || 'null')")
            print("Stored user in localStorage:", stored_user)
            assert stored_user is not None
            assert stored_user["name"] == "Ahmed Yasser"

            # 7. Verify Header updated with user profile badge
            header_text = await eval_js("document.getElementById('headerAuthContainer').innerText")
            print("Header Auth container when logged in:", header_text)
            assert "Ahmed Yasser" in header_text

            # 8. Test Sign Out
            await eval_js("document.getElementById('headerSignOutBtn').click()")
            await asyncio.sleep(0.3)
            user_after_logout = await eval_js("localStorage.getItem('shifter_user')")
            print("User after logout:", user_after_logout)
            assert user_after_logout is None

            print("ALL E2E CHECKS PASSED SUCCESSFULLY!")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
