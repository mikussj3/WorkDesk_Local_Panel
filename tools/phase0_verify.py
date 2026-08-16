#!/usr/bin/env python3
"""Weryfikacja poprawek Fazy 0 (audyt 2026-08-15) na zbudowanym pliku dist/.

Testuje 7 ścieżek z tabeli weryfikacyjnej audytu:
0.1  stary punkt przywracania -> panel oczyszczania dziala
0.2  link workflow TODO z sprawy -> nawigacja + podswietlenie (bez ReferenceError)
0.3  szybkie daty w przypomnieniach -> menu dnia
0.4  akcja Kopiuj na kafelku -> toast + schowek
0.5  edytor przypomnienia bez daty -> nie pada
0.6  karta "Dzisiaj" -> liczniki TODO != 0
0.7  confirm / AppDialog: klik w tlo / Esc -> Promise rozstrzygniety (false/null)

Uzycie: python3 tools/phase0_verify.py [sciezka_do_html] [sciezka_chromium]
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HTML = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "dist" / "index_KF64.html")
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else "/snap/bin/chromium"

results, page_errors = [], []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
        context = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
        page = context.new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.goto(HTML.as_uri())
        page.wait_for_function("window.WorkDeskReady === true", timeout=15000)

        # --- 0.1 stary punkt przywracania -> panel oczyszczania ---
        page.evaluate("""() => {
            StorageService.safeCommitJSON('wd.restore.current', {
                createdAt: '2025-01-01T00:00:00.000Z', schemaVersion: 5, modules: {}
            });
        }""")
        page.click("#storageCleanupBtn")
        page.wait_for_timeout(300)
        candidates = page.evaluate("storageCleanupCandidates.length")
        check("0.1 stary punkt przywracania jest kandydatem (bez ReferenceError)", candidates >= 1, f"kandydatów: {candidates}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # --- 0.6 karta Dzisiaj: todo na dzis -> licznik != 0 ---
        todo = page.evaluate("""() => {
            const d = new Date(), key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const item = CoreModuleState.todo.create({text: 'AUDYT-FAZA0 dzisiaj', dueDate: key, priority: 'normal'});
            renderDailyStart();
            return item;
        }""")
        today_count = page.evaluate("""() => {
            const cards = [...document.querySelectorAll('#dailyStart .daily-card')];
            return cards.length ? cards[0].querySelector('.v').textContent : '';
        }""")
        check("0.6 karta 'Dzisiaj' liczy zadania z dueDate", today_count not in ("0", "", None), f"zadania na dziś: {today_count}")

        # --- 0.2 link workflow: sprawa -> TODO ---
        case_id = page.evaluate("""(todoId) => {
            const created = AppServices.responseCases.create({subject: 'AUDYT Faza0 sprawa', from: 'Audyt'});
            if (created) BusinessWorkflow.link('responseCases', created.id, 'todos', todoId);
            return created ? created.id : null;
        }""", todo["id"])
        page.evaluate("BusinessActions.run('responseCases')")
        page.wait_for_timeout(300)
        link_count = page.locator(".workflow-link").count()
        page.locator(".workflow-link").first.click()
        page.wait_for_timeout(400)
        highlighted = page.evaluate("(id) => !!document.querySelector(`[data-todo-id=\\\"${id}\\\"].workflow-highlight`)", todo["id"])
        modal_closed = page.evaluate("!UIRuntime.top()?.modal")
        check("0.2 link workflow TODO zamyka modal i podświetla rekord", link_count >= 1 and highlighted and modal_closed,
              f"linków: {link_count}, podświetlony: {highlighted}, modal zamknięty: {modal_closed}")

        # --- 0.3 szybkie daty w przypomnieniach ---
        page.click("#calendarReminderTools [data-days='1']")
        page.wait_for_timeout(300)
        menu = page.evaluate("""() => {
            const el = document.querySelector('#calDayMenu');
            if (!el) return null;
            const d = new Date(); d.setDate(d.getDate() + 1);
            const want = d.getDate() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear();
            return {visible: getComputedStyle(el).display !== 'none' && 'true' !== el.getAttribute('aria-hidden'), date: el.querySelector('.menu-date')?.textContent, want};
        }""")
        ok = bool(menu) and menu["visible"] and menu["date"] == menu["want"]
        check("0.3 'Jutro' otwiera menu dnia z poprawną datą", ok, f"menu: {menu['date'] if menu else 'brak'}, oczekiwano: {menu['want'] if menu else '?'}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # --- 0.4 kopiowanie kafelka ---
        page.evaluate("UIRuntime.closeAll({reason: 'test', modal: true})")
        page.wait_for_timeout(200)
        copy_btn = page.locator("[data-tile-action='copy']").first
        copy_btn.click()
        page.wait_for_timeout(400)
        toast_text = page.evaluate("""() => {
            const els = [...document.querySelectorAll('#toasts .toast')];
            return els.map(e => e.textContent).join(' | ');
        }""")
        check("0.4 akcja 'Kopiuj' na kafelku działa (toast, bez błędu)", "Skopiowano" in toast_text or "Brak wartości" in toast_text, f"toast: {toast_text[:80] or 'brak'}")

        # --- 0.5 edytor przypomnienia bez daty ---
        editor_ok = page.evaluate("""() => {
            openReminderEditor({id: 'audit-no-date', time: '10:00', text: 'bez daty', done: false});
            const modal = document.getElementById('reminderEditorModal');
            return !!modal && !modal.hidden;
        }""")
        check("0.5 edytor przypomnienia bez daty otwiera się bez błędu", editor_ok)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # --- 0.7a confirm: klik w tlo rozstrzyga Promise na false ---
        bg_result = page.evaluate("""async () => {
            const promise = showConfirmModal('AUDYT: klik w tło');
            const overlay = document.getElementById('overlay');
            overlay.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
            const race = await Promise.race([promise.then(v => 'resolved:' + v),
                new Promise(r => setTimeout(() => r('TIMEOUT'), 2000))]);
            return race;
        }""")
        check("0.7a confirm po kliknięciu w tło zwraca false (bez zawieszenia)", bg_result == "resolved:false", f"wynik: {bg_result}")

        # --- 0.7b confirm: Esc rozstrzyga Promise na false ---
        esc_result = page.evaluate("""async () => {
            const promise = showConfirmModal('AUDYT: escape');
            document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            const race = await Promise.race([promise.then(v => 'resolved:' + v),
                new Promise(r => setTimeout(() => r('TIMEOUT'), 2000))]);
            return race;
        }""")
        check("0.7b confirm po Esc zwraca false (bez zawieszenia)", esc_result == "resolved:false", f"wynik: {esc_result}")

        # --- 0.7c AppDialog: Esc rozstrzyga Promise na null ---
        dialog_result = page.evaluate("""async () => {
            const promise = AppDialog.editText({title: 'AUDYT', label: 'Wartość', value: ''});
            document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            const race = await Promise.race([promise.then(v => 'resolved:' + v),
                new Promise(r => setTimeout(() => r('TIMEOUT'), 2000))]);
            return race;
        }""")
        check("0.7c AppDialog po Esc zwraca null (bez zawieszenia)", dialog_result == "resolved:null", f"wynik: {dialog_result}")

        # --- porzadki: usun rekordy audytowe ---
        page.evaluate("""(ids) => {
            try {
                AppServices.responseCases.remove(ids.caseId);
                CoreModuleState.todo.remove && CoreModuleState.todo.remove(ids.todoId);
                StorageService.remove('wd.restore.current');
                renderDailyStart();
            } catch (e) {}
        }""", {"caseId": case_id, "todoId": todo["id"]})

        browser.close()

    print()
    failed = [r for r in results if not r[1]]
    if page_errors:
        print(f"Błędy strony (pageerror): {len(page_errors)}")
        for err in page_errors[:5]:
            print("  !", err[:200])
    if failed or page_errors:
        print(f"WYNIK: FAIL ({len(failed)}/{len(results)} testów nie przeszło, pageerror: {len(page_errors)})")
        sys.exit(1)
    print(f"WYNIK: PASS — wszystkie {len(results)} testów, 0 błędów strony")


if __name__ == "__main__":
    run()
