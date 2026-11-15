import http.server
import socketserver
import subprocess
import threading
import time
import os
import shutil

PORT = 8899
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

targets = [
    {
        "name": "astryx_hero_bento.png",
        "url": f"http://localhost:{PORT}/landing.html?theme=dark",
        "width": 1440,
        "height": 1150,
    },
    {
        "name": "astryx_battlefield_stepper.png",
        "url": f"http://localhost:{PORT}/landing.html?theme=dark#battlefield",
        "width": 1440,
        "height": 1200,
    },
    {
        "name": "astryx_map_section.png",
        "url": f"http://localhost:{PORT}/landing.html?theme=dark#map-section",
        "width": 1440,
        "height": 1250,
    },
    {
        "name": "astryx_croptalk_demo.png",
        "url": f"http://localhost:{PORT}/landing.html?theme=dark#crop-talk",
        "width": 1440,
        "height": 1200,
    },
    {
        "name": "astryx_arabic_rtl.png",
        "url": f"http://localhost:{PORT}/landing.html?lang=ar&theme=dark",
        "width": 1440,
        "height": 1200,
    },
    {
        "name": "astryx_light_theme.png",
        "url": f"http://localhost:{PORT}/landing.html?theme=light",
        "width": 1440,
        "height": 1150,
    },
]

for t in targets:
    out_local = os.path.join(WORKSPACE, t["name"])
    args = [
        EDGE_EXE,
        "--headless=new",
        "--disable-gpu",
        f"--window-size={t['width']},{t['height']}",
        f"--screenshot={out_local}",
        t["url"]
    ]
    print(f"Capturing {t['name']}...")
    res = subprocess.run(args, capture_output=True, timeout=30)
    if os.path.exists(out_local):
        dest_artifact = os.path.join(ARTIFACT_DIR, t["name"])
        shutil.copy2(out_local, dest_artifact)
        print(f"Captured {t['name']} ({os.path.getsize(dest_artifact)} bytes)")

print("All captures completed.")
