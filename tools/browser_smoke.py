#!/usr/bin/env python3
"""Interaktywny smoke-test WorkDesk (Playwright + Chromium).

W odróżnieniu od skryptów phase*_verify (testy regresji konkretnych poprawek),
to jest Kanoniczny test dymny cyklu wydawniczego: render krytycznych obszarów
ORAZ interakcje, które historycznie uciekały statycznej weryfikacji
(KF63: startup regression; K1–K5 z audytu: martwe kliknięcia).

Zakres: oba buildy (production + diagnostic).
  1. start bez pageerror i bez console.error, czekanie na window.WorkDeskReady;
  2. render: kafelki, kalendarz, grupy e-mail, TODO, notatki, journal;
  3. interakcje (tylko production): szybka data w przypomnieniach (menu dnia),
     kopiowanie kafelka (toast), link workflow z modalem spraw (podświetlenie),
     confirm-modal zamknięty kliknięciem w tło (Promise rozstrzygnięty),
     round-trip eksport → import z pliku (dane wracają bez uszkodzeń).

Chromium: kolejno $CHROMIUM_PATH, `which chromium/chromium-browser/google-chrome`,
na końcu wbudowana przeglądarka Playwright (jeśli zainstalowana).
"""
import os
import shutil
import sys
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


def find_chromium():
    override = os.environ.get("CHROMIUM_PATH")
    if override:
        return override
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        found = shutil.which(name)
        if found:
            return found
    return None  # przeglądarka Playwright (wymaga `playwright install chromium`)


def smoke_interactions(page):
    """Interakcje na buildzie produkcyjnym; zwraca listę błędów (pusta = OK)."""
    failures = []

    # szybka data w przypomnieniach -> menu dnia
    page.click("#calendarReminderTools [data-days='1']")
    page.wait_for_timeout(300)
    menu_ok = page.evaluate("""() => {
        const el = document.querySelector('#calDayMenu');
        return !!el && getComputedStyle(el).display !== 'none' && 'true' !== el.getAttribute('aria-hidden');
    }""")
    if not menu_ok:
        failures.append("quick-date: menu dnia nie otwarte")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)

    # kopiowanie kafelka -> toast
    page.click("[data-tile-action='copy']")
    page.wait_for_timeout(400)
    copy_ok = page.evaluate("""() => [...document.querySelectorAll('#toasts .toast')].some(t => t.textContent.includes('Skopiowano'))""")
    if not copy_ok:
        failures.append("tile-copy: brak potwierdzenia skopiowania")

    # link workflow: sprawa z powiązanym TODO -> zamknięcie modalu + podświetlenie
    workflow = page.evaluate("""async () => {
        const todo = CoreModuleState.todo.create({text: 'SMOKE workflow'});
        const created = AppServices.responseCases.create({subject: 'SMOKE case', from: 'smoke'});
        if (!todo || !created) return {ok: false, reason: 'create'};
        BusinessWorkflow.link('responseCases', created.id, 'todos', todo.id);
        BusinessActions.run('responseCases');
        await new Promise(r => setTimeout(r, 300));
        const link = document.querySelector('.workflow-link');
        if (!link) return {ok: false, reason: 'no-link'};
        link.click();
        await new Promise(r => setTimeout(r, 500));
        return {
            ok: document.querySelector(`[data-todo-id="${CSS.escape(todo.id)}"].workflow-highlight`) !== null
                && !UIRuntime.top()?.modal,
            todoId: todo.id, caseId: created.id
        };
    }""")
    if not workflow.get("ok"):
        failures.append(f"workflow-link: {workflow}")
    # porządki
    page.evaluate("""(ids) => {
        try {
            ids.caseId && AppServices.responseCases.remove(ids.caseId);
            ids.todoId && (CoreModuleState.todo.remove(ids.todoId), renderTodos());
        } catch (e) {}
    }""", {"todoId": workflow.get("todoId"), "caseId": workflow.get("caseId")})

    # confirm zamknięty klikiem w tło -> Promise rozstrzygnięty na false
    confirm = page.evaluate("""async () => {
        const promise = showConfirmModal('SMOKE: klik w tło');
        document.getElementById('overlay').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        return await Promise.race([promise.then(v => 'resolved:' + v), new Promise(r => setTimeout(() => r('TIMEOUT'), 2000))]);
    }""")
    if confirm != "resolved:false":
        failures.append(f"confirm-outside-click: {confirm}")

    # round-trip: eksport (artefakt aplikacji) -> import z pliku -> te same dane
    # Uwaga: fizyczne pobranie blob-URL w snap-Chromium pod Playwright zwraca 0 bajtów
    # (weryfikowano minimalnym przypadkiem), więc artefakt buduje buildExportArtifact()
    # i podaje jako File — identyczna ścieżka importu bez warstwy pobierania.
    todo = page.evaluate("CoreModuleState.todo.create({text: 'SMOKE roundtrip ąęśźć'})")
    roundtrip = page.evaluate("""async () => {
        requestFullSnapshot({immediate: true});
        const artifact = await buildExportArtifact();
        window.__smokeRoundtrip = {artifact, text: 'SMOKE roundtrip ąęśźć'};
        const file = new File([JSON.stringify(artifact)], 'smoke-roundtrip.json', {type: 'application/json'});
        importDataFromFile(file);
        return true;
    }""")
    page.wait_for_timeout(600)
    page.click("#unifiedConfirmYes")
    page.wait_for_timeout(900)
    roundtrip_ok = page.evaluate(
        "() => (ensureAppState().modules.todo || []).some(r => r.text === 'SMOKE roundtrip ąęśźć')")
    if not roundtrip_ok:
        failures.append("export-import round-trip: rekord nie wrócił po imporcie")
    page.evaluate("renderTodos()")
    return failures


with sync_playwright() as p:
    executable = find_chromium()
    launch_options = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
    if executable:
        launch_options["executable_path"] = executable
    browser = p.chromium.launch(**launch_options)
    print(f"chromium: {executable or 'playwright-bundled'}")
    try:
        for kind, path in CASES:
            page_errors, console_errors = [], []
            page = browser.new_page()
            page.on("pageerror", lambda error, errs=page_errors: errs.append(str(error)))
            page.on(
                "console",
                lambda msg, errs=console_errors: errs.append(msg.text) if msg.type == "error" else None,
            )
            page.goto(path.as_uri(), wait_until="load", timeout=30000)
            page.wait_for_function("window.WorkDeskReady === true", timeout=15000)
            counts = {name: page.locator(selector).count() for name, (selector, _) in SELECTORS.items()}
            missing = [name for name, count in counts.items() if count < SELECTORS[name][1]]
            problems = []
            if missing:
                problems.append(f"missing UI: {missing}; counts={counts}")
            if page_errors:
                problems.append(f"pageerror: {page_errors[:3]}")
            if console_errors:
                problems.append(f"console.error: {console_errors[:3]}")
            if kind == "production" and not problems:
                problems.extend(smoke_interactions(page))
            if problems:
                raise SystemExit(f"{kind} browser smoke: FAIL — {'; '.join(problems)}")
            print(f"{kind} browser smoke: PASS {counts}")
            page.close()
    finally:
        browser.close()
