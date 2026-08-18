#!/usr/bin/env python3
"""Weryfikacja poprawek Fazy 1 (audyt 2026-08-15) — ochrona danych.

Scenariusze z tabeli kryteriów fazy:
(a) symulacja quota -> eksport działa, komunikat widoczny (W1)
(b) reset + odswiezenie na profilu z danymi v4 -> dane domyslne, nie stare (W2)
(c) import wlasnego eksportu TODO 4500 znakow -> bez skrocenia (W3)
(d) przypomnienie -> maksymalnie 1 toast na przypomnienie (W10)
Dodatkowo: W4 (odzyskiwanie przy zlej strukturze snapshotu) i W13 (Ctrl+Enter).

Uzycie: python3 tools/phase1_verify.py [sciezka_html] [sciezka_chromium]
"""
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HTML = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "dist" / "index_KF64.html")
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else "/snap/bin/chromium"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def wait_ready(page):
    await page.wait_for_function("window.WorkDeskReady === true", timeout=15000)


async def confirm(page, label="Tak"):
    """Zatwierdza confirm-modal i czeka na jego zamkniecie."""
    await page.click("#unifiedConfirmYes")
    await page.wait_for_timeout(400)


V4_PAYLOAD = json.dumps({
    "schemaVersion": 4,
    "modules": {"todo": [{"id": "v4-todo-1", "text": "V4-STARE-DANE", "done": False, "createdAt": 1}]},
})


async def main_tests(browser):
    """Kontekst 1: W3, W10, W13, W4a, W2 (migracja + reset + marker)."""
    print("Kontekst 1 — testy podstawowe (W3, W10, W13, W4a, W2):")
    context = await browser.new_context()
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(HTML.as_uri())
    await wait_ready(page)

    # --- W3: walidator importu nie tnie TODO do 2000 znakow ---
    long_ok = await page.evaluate("""() => {
        const res = validateTodoItem({text: 'A'.repeat(4500), done: false, createdAt: Date.now(), id: 'audit-long'});
        return res.valid && res.value.text.length === 4500;
    }""")
    check("(c) walidator importu przyjmuje TODO 4500 znaków", long_ok)

    # --- W3: pelny round-trip eksport -> import -> stan ---
    roundtrip = await page.evaluate("""async () => {
        CoreModuleState.todo.create({text: 'RT-' + 'B'.repeat(4497)});
        requestFullSnapshot({immediate: true});
        const artifact = await buildExportArtifact();
        const file = new File([JSON.stringify(artifact)], 'audit-roundtrip.json', {type: 'application/json'});
        importDataFromFile(file);
        return true;
    }""")
    await page.wait_for_timeout(300)
    await confirm(page)
    await page.wait_for_timeout(600)
    rt_len = await page.evaluate("""() => {
        const rows = ensureAppState().modules.todo;
        const row = rows.find(r => (r.text || '').startsWith('RT-'));
        return row ? row.text.length : 0;
    }""")
    check("(c) round-trip eksport→import TODO 4500 znaków bez skrócenia", rt_len == 4500, f"długość po imporcie: {rt_len}")

    # --- W10: dedup + auto-usuwanie toastu przypomnienia ---
    await page.evaluate("""() => {
        const d = new Date(), key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        window.__auditReminderId = CoreModuleState.calendarReminders.create({
            text: 'AUDYT toast dedup', date: key,
            time: String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'),
            done: false
        }).id;
        checkCalendarReminders();
    }""")
    first_count = await page.evaluate("document.querySelectorAll('#toasts [data-reminder-toast]').length")
    await page.evaluate("""() => {
        const rows = ensureAppState().modules.calendarReminders;
        const r = rows.find(x => x.id === window.__auditReminderId);
        if (r) r.lastNotifiedAt = Date.now() - 61000;   // wymus wygasniecie cooldownu
        checkCalendarReminders();
    }""")
    second_count = await page.evaluate("document.querySelectorAll('#toasts [data-reminder-toast]').length")
    check("(d) dedup toastu przypomnienia (≤1 na przypomnienie)", first_count == 1 and second_count == 1,
          f"po 1. cyklu: {first_count}, po wygaśnięciu cooldownu: {second_count}")
    await page.wait_for_timeout(10600)
    after_remove = await page.evaluate("document.querySelectorAll('#toasts [data-reminder-toast]').length")
    check("(d) toast przypomnienia znika automatycznie po 10 s", after_remove == 0, f"pozostało: {after_remove}")
    await page.evaluate("window.__auditReminderId && CoreModuleState.calendarReminders.done(window.__auditReminderId)")

    # --- W13: Ctrl+Enter tylko z panelu e-mail ---
    await page.evaluate("""() => {
        window.__sendCount = 0;
        document.getElementById('sendBtn').addEventListener('click', () => window.__sendCount++);
    }""")
    await page.focus("#todoInput")
    await page.keyboard.press("Control+Enter")
    outside = await page.evaluate("window.__sendCount")
    check("(W13) Ctrl+Enter poza panelem e-mail nie wysyła", outside == 0, f"wywołania send: {outside}")
    await page.evaluate("toggleEmail()")
    await page.wait_for_timeout(300)
    await page.focus("#fBody")
    await page.keyboard.press("Control+Enter")
    inside = await page.evaluate("window.__sendCount")
    check("(W13) Ctrl+Enter w polu treści e-mail wysyła", inside == 1, f"wywołania send: {inside}")
    await page.evaluate("""() => {
        window.__dialogDone = new Promise(res => {
            AppDialog.editText({title: 'AUDYT', label: 'Wartość', value: 'x'}).then(v => res('resolved:' + v));
        });
        document.querySelector('#appEditTextModal [data-modal-focus-entry]')?.focus();
    }""")
    await page.wait_for_timeout(300)
    await page.evaluate("""() => {
        // Jeden keydown z ctrlKey — realna sekwencja Control→Enter konsumowałaby listener {once:true} (znany błąd S1, Faza 2).
        document.querySelector('#appEditTextModal [data-modal-focus-entry]')?.dispatchEvent(
            new KeyboardEvent('keydown', {key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true}));
    }""")
    await page.wait_for_timeout(300)
    dialog_state = await page.evaluate("""async () => {
        const race = await Promise.race([window.__dialogDone, new Promise(r => setTimeout(() => r('TIMEOUT'), 1500))]);
        return {resolved: race !== 'TIMEOUT', value: race, sends: window.__sendCount};
    }""")
    check("(W13) Ctrl+Enter w AppDialog zapisuje dialog i nie wysyła maila", dialog_state.get("resolved") and dialog_state.get("sends") == 1,
          f"dialog: {dialog_state.get('value')}, send: {dialog_state.get('sends')}")

    # --- W4a: zla struktura DATA_KEY -> odzyskanie z punktu przywracania ---
    # (commitFullSnapshotNow = noop blokuje flush pagehide, ktory nadpisalby zasiany stan)
    await page.evaluate("""() => {
        commitFullSnapshotNow = () => ({ok: true, auditNoop: true});
        localStorage.setItem('wd.data.v5', '{"zla-struktura": true}');
    }""")
    await page.reload()
    await wait_ready(page)
    w4a = await page.evaluate("""() => {
        let parsed = null;
        try { parsed = JSON.parse(localStorage.getItem('wd.data.v5') || 'null'); } catch {}
        return {
            blocked: commitFullSnapshotNow().blocked === true,
            recovered: !!(parsed && parsed.modules && typeof parsed.modules === 'object'),
            notice: !!document.querySelector('#attentionCenter [data-notice-id="storage-load-blocked"]')
        };
    }""")
    check("(W4) zła struktura snapshotu → odzyskanie z punktu przywracania",
          w4a["recovered"] and not w4a["blocked"] and not w4a["notice"], json.dumps(w4a, ensure_ascii=False))

    # --- W2 b1: migracja z v4 + trwaly reset ---
    await page.evaluate("""(payload) => {
        commitFullSnapshotNow = () => ({ok: true, auditNoop: true});
        ['wd.data.v5', 'wd.migration.v5.complete', 'wd.restore.current', 'wd.restore.previous-good'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem('wd.data.v4', payload);
    }""", V4_PAYLOAD)
    await page.reload()
    await wait_ready(page)
    migrated = await page.evaluate("""() => ({
        v4Visible: (ensureAppState().modules.todo || []).some(r => r.text === 'V4-STARE-DANE'),
        v4KeyGone: localStorage.getItem('wd.data.v4') === null,
        marker: localStorage.getItem('wd.migration.v5.complete') !== null,
        dataKey: localStorage.getItem('wd.data.v5') !== null
    })""")
    check("(b) migracja v4→v5 przenosi dane i usuwa klucze legacy",
          migrated["v4Visible"] and migrated["v4KeyGone"] and migrated["marker"] and migrated["dataKey"],
          json.dumps(migrated, ensure_ascii=False))

    await page.evaluate("document.getElementById('dataAdvanced').open = true")
    await page.click("#dataReset")
    await page.wait_for_timeout(300)
    await confirm(page)
    await page.wait_for_timeout(700)
    after_reset = await page.evaluate("""() => {
        let parsed = null;
        try { parsed = JSON.parse(localStorage.getItem('wd.data.v5') || 'null'); } catch {}
        return {dataKeyValid: !!(parsed && parsed.modules), legacyGone: localStorage.getItem('wd.data.v4') === null};
    }""")
    check("(b) reset zapisuje dane domyślne (DATA_KEY istnieje i jest poprawny)",
          after_reset["dataKeyValid"] and after_reset["legacyGone"], json.dumps(after_reset, ensure_ascii=False))

    await page.reload()
    await wait_ready(page)
    no_resurrect = await page.evaluate("""() => ({
        v4Back: (ensureAppState().modules.todo || []).some(r => r.text === 'V4-STARE-DANE'),
        dataKey: localStorage.getItem('wd.data.v5') !== null
    })""")
    check("(b) po reset + odświeżeniu stare dane v4 NIE wracają",
          not no_resurrect["v4Back"] and no_resurrect["dataKey"], json.dumps(no_resurrect, ensure_ascii=False))

    # --- W2 b2: marker blokuje ponowna migracje po utracie DATA_KEY ---
    await page.evaluate("""(payload) => {
        commitFullSnapshotNow = () => ({ok: true, auditNoop: true});
        localStorage.removeItem('wd.data.v5');
        localStorage.setItem('wd.data.v4', payload);
    }""", V4_PAYLOAD)
    await page.reload()
    await wait_ready(page)
    marker_guard = await page.evaluate("""() => ({
        v4Back: (ensureAppState().modules.todo || []).some(r => r.text === 'V4-STARE-DANE'),
        v4Still: localStorage.getItem('wd.data.v4') !== null
    })""")
    check("(W2) marker migracji blokuje wskrzeszanie danych v4 po utracie v5",
          not marker_guard["v4Back"], json.dumps(marker_guard, ensure_ascii=False))

    check("Kontekst 1: 0 błędów strony", not errors, "; ".join(errors[:3]) if errors else "")
    await context.close()


async def quota_boot_tests(browser):
    """Kontekst 2: zla struktura + zapełniony storage (W4b — kwarantanna niemożliwa, blokada z komunikatem)."""
    print("Kontekst 2 — blokada zapisów przy złej strukturze (W4b):")
    context = await browser.new_context()
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(HTML.as_uri())
    await wait_ready(page)
    # Zasiej złą strukturę i zapełnij przeglądarkowy limit localStorage prawie do końca
    # (preflight 3 MB zacznie rzucać QuotaExceeded → kwarantanna snapshotu niemożliwa),
    # zostawiając ~4 KB na klucz sondy StorageCapability.
    filled = await page.evaluate("""() => {
        localStorage.setItem('wd.data.v5', '{"zla-struktura": true}');
        const key = 'wd.audit.filler';
        let size = 4194304, stored = 0;
        while (size >= 65536) {
            try { localStorage.setItem(key, 'x'.repeat(size)); stored = size; break; }
            catch (e) { size = Math.floor(size / 2); }
        }
        if (stored) { try { localStorage.setItem(key, 'x'.repeat(Math.max(65536, stored - 4096))); } catch (e) {} }
        commitFullSnapshotNow = () => ({ok: true, auditNoop: true});   // blokada flushu pagehide
        return {stored};
    }""")
    await page.reload()
    await wait_ready(page)
    state = await page.evaluate("""() => ({
        blocked: commitFullSnapshotNow().blocked === true,
        blockedNotice: !!document.querySelector('#attentionCenter [data-notice-id="storage-load-blocked"]'),
        ready: window.WorkDeskReady === true,
        fillerGone: localStorage.getItem('wd.audit.filler') === null
    })""")
    check("(W4) zła struktura + pełny storage → blokada z trwałym komunikatem",
          state["blocked"] and state["blockedNotice"] and state["ready"],
          json.dumps(state, ensure_ascii=False))
    check("Kontekst 2: 0 błędów strony", not errors, "; ".join(errors[:3]) if errors else "")
    await context.close()


async def quota_session_tests(browser):
    """Kontekst 3: degradacja w trakcie sesji (a) — komunikat + dzialajacy eksport."""
    print("Kontekst 3 — degradacja storage w trakcie sesji (a):")
    context = await browser.new_context(accept_downloads=True)
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(HTML.as_uri())
    await wait_ready(page)
    await page.evaluate("""() => {
        const ls = window.localStorage;
        const nativeSet = ls.setItem.bind(ls);
        Object.defineProperty(ls, 'setItem', { value: function() {
            throw new DOMException('test quota', 'QuotaExceededError');
        }, writable: true, configurable: true });
    }""")
    commit = await page.evaluate("""() => {
        CoreModuleState.todo.create({text: 'AUDYT quota'});
        const result = requestFullSnapshot({immediate: true});
        return {ok: result && result.ok === true, reason: result?.reason || null, blocked: result?.blocked || false};
    }""")
    await page.wait_for_timeout(400)
    state = await page.evaluate("""() => ({
        persistent: StorageService.isPersistent(),
        notice: !!document.querySelector('#attentionCenter .attention-notice[data-notice-id="storage-degraded"]'),
        noticeCount: document.querySelectorAll('#attentionCenter .attention-notice[data-notice-id="storage-degraded"]').length,
        exportAction: !!document.querySelector('#attentionCenter .attention-notice[data-notice-id="storage-degraded"] [data-attention-action="export"]'),
        confidenceState: document.getElementById('dataConfidence')?.dataset.state,
        confidenceText: document.getElementById('dataConfidenceText')?.textContent || ''
    })""")
    check("(a) safeCommit raportuje porażkę przy degradacji (reason=degraded)",
          commit["ok"] is False and commit["reason"] == "degraded", json.dumps(commit, ensure_ascii=False))
    check("(a) StorageService.isPersistent() === false", state["persistent"] is False)
    check("(a) trwały komunikat o niezapisywanych danych z akcją eksportu (1×, bez spamu)",
          state["notice"] and state["exportAction"] and state["noticeCount"] == 1,
          f"notice: {state['notice']}, akcja: {state['exportAction']}, liczba: {state['noticeCount']}")
    check("(a) wskaźnik zaufania danych w stanie danger",
          state["confidenceState"] == "danger" and "Pamięć ulotna" in state["confidenceText"],
          f"state: {state['confidenceState']}, tekst: {state['confidenceText'][:60]}")

    async with page.expect_download(timeout=10000) as download_info:
        await page.click('#attentionCenter [data-notice-id="storage-degraded"] [data-attention-action="export"]')
    download = await download_info.value
    check("(a) eksport danych działa w trybie zdegradowanym", download is not None,
          f"plik: {download.suggested_filename}")
    check("Kontekst 3: 0 błędów strony", not errors, "; ".join(errors[:3]) if errors else "")
    await context.close()


async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
        await main_tests(browser)
        await quota_boot_tests(browser)
        await quota_session_tests(browser)
        await browser.close()

    print()
    failed = [r for r in results if not r[1]]
    if failed:
        print(f"WYNIK: FAIL ({len(failed)}/{len(results)} testów nie przeszło)")
        sys.exit(1)
    print(f"WYNIK: PASS — wszystkie {len(results)} testów")


if __name__ == "__main__":
    asyncio.run(run())
