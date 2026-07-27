#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ("production", ROOT / "dist" / "index_KF64.html"),
    ("diagnostic", ROOT / "dist" / "index_KF64_DIAG.html"),
]
SELECTORS = {
    "tiles": ("#tilesHost > *", 1),
    "calendar": ("#calGrid .day", 28),
    "email-groups": (".group", 1),
    "todo": ("#todoList > *", 1),
    "notes": ("#notesHost > *", 1),
    "journal": ("#journalList > *", 1),
}

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-gpu"],
    )
    try:
        for kind, path in CASES:
            errors = []
            page = browser.new_page()
            page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
            page.set_content(path.read_text(encoding="utf-8"), wait_until="load", timeout=30000)
            page.wait_for_timeout(1800)
            if errors:
                raise SystemExit(f"{kind} browser errors: {errors}")
            counts = {name: page.locator(selector).count() for name, (selector, _) in SELECTORS.items()}
            missing = [name for name, count in counts.items() if count < SELECTORS[name][1]]
            if missing:
                raise SystemExit(f"{kind} missing UI: {missing}; counts={counts}")
            print(f"{kind} browser smoke: PASS {counts}")
            page.close()
    finally:
        browser.close()
