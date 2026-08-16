#!/usr/bin/env python3
"""Weryfikacja Fazy 4 (audyt 2026-08-15) — rozwój ponad naprawy.

Pokrycie: awaryjny eksport w navbarze, zgłaszanie błędów w AttentionCenter
(szczegóły + kopiowanie zgłoszenia), fundament i18n (t()), auto-backup
(graceful brak API), wersjonowanie z jednego źródła (build-manifest.json).

Uzycie: python3 tools/phase4_verify.py [sciezka_html] [sciezka_chromium]
"""
import asyncio
import json
import shutil
import subprocess
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "dist" / "index_KF64.html")
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else "/snap/bin/chromium"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
        context = await browser.new_context()
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(HTML.as_uri())
        await page.wait_for_function("window.WorkDeskReady === true", timeout=15000)
        await page.wait_for_timeout(300)

        # --- awaryjny eksport w navbarse ---
        emergency = await page.evaluate("""() => {
            const btn = document.getElementById('emergencyExportBtn');
            return {exists: !!btn, inNavbar: !!btn?.closest('header.navbar'), visible: btn ? !!(btn.offsetWidth || btn.offsetHeight) : false};
        }""")
        check("(F4.5) przycisk awaryjnego eksportu w navbarze, widoczny",
              emergency["exists"] and emergency["inNavbar"] and emergency["visible"], json.dumps(emergency))

        # --- zgłaszanie błędów w UI ---
        error_notice = await page.evaluate("""async () => {
            window.dispatchEvent(new ErrorEvent('error', {message: 'AUDYT F4: celowy błąd'}));
            await new Promise(r => setTimeout(r, 300));
            const notice = document.querySelector('#attentionCenter .attention-notice[data-notice-id="ui-error"]');
            return {
                shown: !!notice,
                title: notice?.querySelector('.attention-title')?.textContent,
                hasDetails: !!notice?.querySelector('[data-attention-action="details"]'),
                hasCopy: !!notice?.querySelector('[data-attention-action="copy"]')
            };
        }""")
        check("(F4.3) błąd runtime pokazuje notice ze szczegółami i kopiowaniem",
              error_notice["shown"] and error_notice["hasDetails"] and error_notice["hasCopy"],
              f"tytuł: {error_notice['title']}")

        # Kopiuj zgłoszenie jako pierwszy (keepOpen: true — notice przetrwa)
        copied = await page.evaluate("""async () => {
            document.querySelector('#attentionCenter [data-notice-id="ui-error"] [data-attention-action="copy"]')?.click();
            await new Promise(r => setTimeout(r, 1200));
            return [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join('|');
        }""")
        check("(F4.3) przycisk Skopiuj do zgłoszenia produkuje potwierdzenie",
              "skopiowany" in copied.lower(), copied[:70])

        # Szczegóły — otwiera dialog i zamyka notice (jednokrotny test)
        details = await page.evaluate("""async () => {
            document.querySelector('#attentionCenter [data-notice-id="ui-error"] [data-attention-action="details"]')?.click();
            await new Promise(r => setTimeout(r, 300));
            const dialog = document.getElementById('infoDialogModal');
            return {open: dialog ? !dialog.hidden : false, text: dialog?.textContent || ''};
        }""")
        await page.wait_for_timeout(300)
        check("(F4.3) raport szczegółów zawiera wersję i opis błędu",
              details["open"] and "1.66.3" in details["text"] and "celowy błąd" in details["text"],
              f"długość raportu: {len(details['text'])} znaków")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(200)

        # --- i18n: słownik i bezpieczny fallback ---
        i18n = await page.evaluate("""() => ({
            known: t('storage.degraded.title'),
            fallback: t('nieistniejacy.klucz', 'WARTOSC-FALLBACK'),
            rawKey: t('nieistniejacy.klucz'),
            confirmTitle: t('confirm.title')
        })""")
        check("(F4.4) t() zwraca tłumaczenie, fallback i klucz awaryjnie",
              i18n["known"] == "Dane nie są zapisywane na dysk" and i18n["fallback"] == "WARTOSC-FALLBACK" and i18n["rawKey"] == "nieistniejacy.klucz",
              json.dumps(i18n, ensure_ascii=False))
        confirm_pl = await page.evaluate("""async () => {
            const promise = showConfirmModal('AUDYT i18n');
            const title = document.getElementById('unifiedConfirmTitle')?.textContent;
            const label = document.getElementById('unifiedConfirmYes')?.textContent;
            document.getElementById('unifiedConfirmModal').querySelector('[data-answer="false"]').click();
            await promise;
            return {title, label};
        }""")
        check("(F4.4) domyślne etykiety confirm nadal z słownika PL",
              confirm_pl["title"] == "Potwierdź operację" and confirm_pl["label"] == "Potwierdź", json.dumps(confirm_pl, ensure_ascii=False))

        # --- auto-backup: graceful brak API ---
        auto_backup = await page.evaluate("""() => {
            const btn = document.getElementById('autoBackupBtn');
            const hasApi = 'function' == typeof window.showDirectoryPicker;
            btn?.click();
            const toast = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join('|');
            return {btnExists: !!btn, hasApi, toast: toast.slice(0, 90)};
        }""")
        check("(F4.8) przycisk auto-backup; brak API -> czytelny komunikat (nie wyjątek)",
              auto_backup["btnExists"] and (auto_backup["hasApi"] or "nie obsługuje" in auto_backup["toast"]),
              json.dumps(auto_backup, ensure_ascii=False))

        check("Faza 4: 0 błędów strony", not errors, "; ".join(errors[:3]) if errors else "")
        await context.close()
        await browser.close()

    # --- wersjonowanie z jednego źródła (poza przeglądarką) ---
    manifest = ROOT / "build-manifest.json"
    original = manifest.read_text(encoding="utf-8")
    tmp_dist = ROOT / "dist-tmp"
    try:
        bumped = json.loads(original)
        bumped["appVersion"] = "9.9.9"
        bumped["buildTag"] = "KFTEST"
        manifest.write_text(json.dumps(bumped, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        subprocess.run([sys.executable, str(ROOT / "tools/build.py"), "--kind", "production", "--out-dir", str(tmp_dist)],
                       check=True, capture_output=True)
        built = (tmp_dist / "index_KF64.html").read_text(encoding="utf-8")
        ok = "<title>WorkDesk 9.9.9-KFTEST — Panel pracy lokalny</title>" in built and 'version: "9.9.9"' in built
        check("(F4.6) zmiana wersji TYLKO w build-manifest.json trafia do tytułu i APP_META", ok)
    finally:
        manifest.write_text(original, encoding="utf-8")
        shutil.rmtree(tmp_dist, ignore_errors=True)

    print()
    failed = [r for r in results if not r[1]]
    if failed:
        print(f"WYNIK: FAIL ({len(failed)}/{len(results)} testów nie przeszło)")
        sys.exit(1)
    print(f"WYNIK: PASS — wszystkie {len(results)} testów")


if __name__ == "__main__":
    asyncio.run(run())
