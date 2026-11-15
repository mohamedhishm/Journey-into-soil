#!/usr/bin/env python3
"""Automated visual verification using Playwright with Angle / SwiftShader.
Captures screenshots of .scene-container at 1280px and 390px, en/ar, light/dark,
with cutaway + explode + inspector open.
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT_DIR = Path("docs/screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROMIUM_ARGS = [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=EDGE_PATH,
            args=CHROMIUM_ARGS,
            headless=True,
        )

        configs = [
            ("1280px", 1280, 800, "en", "light"),
            ("1280px", 1280, 800, "ar", "light"),
            ("1280px", 1280, 800, "en", "dark"),
            ("1280px", 1280, 800, "ar", "dark"),
            ("390px", 390, 844, "en", "light"),
            ("390px", 390, 844, "ar", "light"),
            ("390px", 390, 844, "en", "dark"),
            ("390px", 390, 844, "ar", "dark"),
        ]

        for width_label, w, h, lang, theme in configs:
            context = browser.new_context(
                viewport={"width": w, "height": h},
                locale="ar-EG" if lang == "ar" else "en-US",
            )
            page = context.new_page()

            # Set localStorage before loading page
            page.goto("http://localhost:5173")
            page.evaluate(f"""() => {{
                localStorage.setItem("lang", "{lang}");
                localStorage.setItem("theme", "{theme}");
            }}""")
            page.reload()
            page.wait_for_load_state("networkidle")

            # Click sample button to load result if not already on results page
            sample_btn = page.locator("button.ghost", has_text="sample")
            if sample_btn.count() == 0:
                # Arabic sample text: "بيانات العينة"
                sample_btn = page.locator("button.ghost").filter(has_text="العينة")
            if sample_btn.count() == 0:
                sample_btn = page.locator(".actions button.ghost")

            if sample_btn.count() > 0:
                sample_btn.first.click()
                page.wait_for_timeout(1000)

            # Wait for scene container to be visible
            scene = page.locator(".scene-container")
            scene.wait_for(state="visible", timeout=10000)
            page.wait_for_timeout(1500) # Wait for Babylon WebGL initialization

            # Activate Cutaway preset
            # Find cutaway button (index 1 in scene-toolbar)
            cutaway_btn = page.locator(".scene-toolbar .scene-btn").nth(1)
            if cutaway_btn.count() > 0:
                cutaway_btn.click()
                page.wait_for_timeout(400)

            # Activate Explode toggle
            explode_btn = page.locator(".scene-toolbar .scene-btn").nth(3)
            if explode_btn.count() > 0:
                explode_btn.click()
                page.wait_for_timeout(600)

            # Open Inspector
            # On desktop: click a depth tick (e.g. index 2: 50 cm)
            # On mobile: depth ruler is hidden, click directly on canvas center or call inspectLayer via page.evaluate
            if w > 640:
                depth_tick = page.locator(".scene-depth-tick").nth(2)
                if depth_tick.count() > 0:
                    depth_tick.click()
                    page.wait_for_timeout(400)
            else:
                canvas = page.locator(".scene-container canvas")
                box = canvas.bounding_box()
                if box:
                    page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.6)
                    page.wait_for_timeout(600)

            # Ensure rendered frames settle
            page.wait_for_timeout(800)

            screenshot_path = OUT_DIR / f"scene_{width_label}_{lang}_{theme}.png"
            scene.screenshot(path=str(screenshot_path))
            print(f"Captured: {screenshot_path}")

            # Also capture individual excavation dive stages on desktop en light
            if width_label == "1280px" and lang == "en" and theme == "light":
                # Stage 1: Field Surface
                page.locator(".scene-stage-btn").nth(0).click()
                page.wait_for_timeout(800)
                scene.screenshot(path=str(OUT_DIR / "stage_1_field_surface.png"))
                print(f"Captured: {OUT_DIR / 'stage_1_field_surface.png'}")

                # Stage 2: Underground Core
                page.locator(".scene-stage-btn").nth(1).click()
                page.wait_for_timeout(800)
                scene.screenshot(path=str(OUT_DIR / "stage_2_underground_core.png"))
                print(f"Captured: {OUT_DIR / 'stage_2_underground_core.png'}")

                # Stage 3: Stratified Layers
                page.locator(".scene-stage-btn").nth(2).click()
                page.wait_for_timeout(800)
                scene.screenshot(path=str(OUT_DIR / "stage_3_stratified_layers.png"))
                print(f"Captured: {OUT_DIR / 'stage_3_stratified_layers.png'}")

            context.close()

        # Capture Map Farmland Parcel Selection
        map_context = browser.new_context(viewport={"width": 1280, "height": 800})
        map_page = map_context.new_page()
        map_page.goto("http://localhost:5173")
        map_page.wait_for_load_state("networkidle")
        map_page.wait_for_timeout(2000)
        map_wrap = map_page.locator(".map-wrap")
        if map_wrap.count() > 0:
            map_wrap.first.screenshot(path=str(OUT_DIR / "map_parcel_selection.png"))
            print(f"Captured: {OUT_DIR / 'map_parcel_selection.png'}")
        map_context.close()

        browser.close()
        print("Visual verification run complete!")

if __name__ == "__main__":
    run()
