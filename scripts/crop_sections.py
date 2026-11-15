import os
import shutil
import subprocess
import time
from PIL import Image

WORKSPACE = r"C:\Users\DELL\Documents\journey-into-soil"
ARTIFACT_DIR = r"C:\Users\DELL\.gemini\antigravity-cli\brain\258286af-a958-4813-babb-3a126c067a30"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 8899

# 1. Capture Arabic Full Page
ar_full = os.path.join(WORKSPACE, "astryx_full_ar.png")
subprocess.run([
    EDGE_EXE,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1440,4200",
    f"--screenshot={ar_full}",
    f"http://localhost:{PORT}/landing.html?lang=ar&theme=dark"
], capture_output=True, timeout=30)

# 2. Capture Light Mode Full Page
light_full = os.path.join(WORKSPACE, "astryx_full_light.png")
subprocess.run([
    EDGE_EXE,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1440,4200",
    f"--screenshot={light_full}",
    f"http://localhost:{PORT}/landing.html?theme=light"
], capture_output=True, timeout=30)

# 3. Crop distinct high-res sections from astryx_landing_full.png
full_im = Image.open(os.path.join(WORKSPACE, "astryx_landing_full.png"))
w, h = full_im.size

sections = {
    "astryx_1_hero_and_metrics.png": (0, 0, w, 920),
    "astryx_2_why_bento.png": (0, 900, w, 1500),
    "astryx_3_battlefield.png": (0, 1480, w, 2180),
    "astryx_4_how_it_works_stepper.png": (0, 2160, w, 2720),
    "astryx_5_crop_talk_ai.png": (0, 2700, w, 3320),
    "astryx_6_egypt_map_and_nodes.png": (0, 3300, w, 4200)
}

for name, box in sections.items():
    cropped = full_im.crop(box)
    target_path = os.path.join(WORKSPACE, name)
    cropped.save(target_path, "PNG")
    artifact_path = os.path.join(ARTIFACT_DIR, name)
    shutil.copy2(target_path, artifact_path)
    print(f"Generated {name} -> size: {cropped.size}, saved to artifact.")

# Copy full Arabic and Light screenshots to artifact
if os.path.exists(ar_full):
    shutil.copy2(ar_full, os.path.join(ARTIFACT_DIR, "astryx_full_ar.png"))
    # Also crop Arabic hero
    ar_im = Image.open(ar_full)
    ar_hero = ar_im.crop((0, 0, w, 920))
    ar_hero_path = os.path.join(ARTIFACT_DIR, "astryx_arabic_hero.png")
    ar_hero.save(ar_hero_path, "PNG")
    print("Arabic captures saved.")

if os.path.exists(light_full):
    shutil.copy2(light_full, os.path.join(ARTIFACT_DIR, "astryx_full_light.png"))
    light_im = Image.open(light_full)
    light_hero = light_im.crop((0, 0, w, 920))
    light_hero_path = os.path.join(ARTIFACT_DIR, "astryx_light_hero.png")
    light_hero.save(light_hero_path, "PNG")
    print("Light captures saved.")

print("All section crops completed successfully.")
