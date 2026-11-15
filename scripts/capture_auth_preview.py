import http.server
import socketserver
import subprocess
import threading
import time
import os

PORT = 8998
WORKSPACE = r"C:\Users\DELL\Documents\journey-into-soil"
ARTIFACT_DIR = r"C:\Users\DELL\.gemini\antigravity-cli\brain\258286af-a958-4813-babb-3a126c067a30"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_server():
    os.chdir(WORKSPACE)
    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
time.sleep(1)

os.makedirs(ARTIFACT_DIR, exist_ok=True)

jobs = [
    ("astryx_google_auth_modal.png", f"http://localhost:{PORT}/landing.html?theme=dark&auth=1"),
    ("astryx_google_auth_modal_light.png", f"http://localhost:{PORT}/landing.html?theme=light&auth=1"),
    ("astryx_google_auth_modal_ar.png", f"http://localhost:{PORT}/landing.html?theme=dark&lang=ar&auth=1"),
    ("astryx_account_page.png", f"http://localhost:{PORT}/account.html?theme=dark"),
    ("astryx_account_page_light.png", f"http://localhost:{PORT}/account.html?theme=light"),
    ("astryx_account_page_ar.png", f"http://localhost:{PORT}/account.html?theme=dark&lang=ar"),
]

for filename, url in jobs:
    outpath = os.path.join(ARTIFACT_DIR, filename)
    subprocess.run([
        EDGE_EXE,
        "--headless=new",
        "--disable-gpu",
        "--window-size=1440,900",
        f"--screenshot={outpath}",
        url
    ], check=True)
    print(f"Captured: {filename}")

print("All screenshots done.")
