#!/usr/bin/env python3
"""Weryfikacja poprawek Fazy 2 (audyt 2026-08-15) — stabilność runtime i modali.

Pokrycie: W8 (izolacja bootstrapu), W9 (BFCache), W7/S23 (priorytety i polityki modali),
S9 (zamknięcie confirm po id), S10 (live region nie ukryty), S11 (fallback fokusu),
W12 (tabele QR v9/v10), S21 (martwy kod usunięty), S16 (EventLifecycle), S17 (cap UI_ERRORS),
S18 (scalony kontrakt Enter/Space), W14 (jeden szablon — weryfikowane przez build).

Uzycie: python3 tools/phase2_verify.py [sciezka_html] [sciezka_chromium]
"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HTML = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "dist" / "index_KF64.html")
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else "/snap/bin/chromium"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def qr_matrix_size(page, text):
    """Generuje QR i zwraca rozmiar macierzy (liczba modułów) z viewBox."""
    return await page.evaluate("""(t) => {
        showQrModal(t);
        const svg = document.querySelector('#qrHost svg');
        if (!svg) return 0;
        const vb = (svg.getAttribute('viewBox') || '').split(/\\s+/).map(Number);
        return vb.length === 4 ? vb[2] / 8 - 8 : 0;
    }""", text)


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

        # --- W8: izolacja błędów bootstrapu ---
        w8 = await page.evaluate("""() => {
            const original = updateTileFilterBadges;
            updateTileFilterBadges = () => { throw new Error('AUDYT: celowa awaria kroku'); };
            let threw = false;
            try { bootstrapRegisteredModules(); } catch (e) { threw = true; }
            updateTileFilterBadges = original;
            const recorded = UI_ERROR_REGISTRY.list().some(r => r.scope === 'bootstrap');
            bootstrapRegisteredModules();
            return {threw, recorded, ready: window.WorkDeskReady === true};
        }""")
        check("(W8) awaria kroku bootstrapu nie przerywa pozostałych (błąd rejestrowany)",
              w8["threw"] is False and w8["recorded"] and w8["ready"],
              f"wyjątek propagowany: {w8['threw']}, błąd zarejestrowany: {w8['recorded']}")

        # --- W9: pagehide persisted (BFCache) nie rozbiera runtime ---
        w9 = await page.evaluate("""() => {
            window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
            const afterPersistedHide = {torn: EventLifecycle.stats().tornDown, active: EventLifecycle.stats().active};
            window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
            return {afterPersistedHide, stillAlive: EventLifecycle.stats().active > 50 && !EventLifecycle.stats().tornDown};
        }""")
        check("(W9) pagehide z persisted=true nie usuwa listenerów (BFCache)",
              w9["afterPersistedHide"]["torn"] is False and w9["stillAlive"],
              f"tornDown: {w9['afterPersistedHide']['torn']}, aktywnych: {w9['afterPersistedHide']['active']}")

        # --- W7/S23/S9: confirm nad modalem roboczym; ESC zamyka confirm, nie modal roboczy ---
        w7 = await page.evaluate("""async () => {
            BusinessActions.run('phoneLog');
            const phoneOpen = () => !!UIRuntime.get('phoneModal') && !UIRuntime.get('phoneModal').el.hidden;
            const before = {phoneOpen: phoneOpen()};
            const promise = showConfirmModal('AUDYT: usuń wpis z telefonów?');
            await new Promise(r => setTimeout(r, 250));
            const withConfirm = {phoneOpen: phoneOpen(), top: UIRuntime.top()?.id};
            document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            const answer = await Promise.race([promise.then(v => 'resolved:' + v), new Promise(r => setTimeout(() => r('TIMEOUT'), 2000))]);
            await new Promise(r => setTimeout(r, 250));
            const afterEsc = {phoneOpen: phoneOpen(), top: UIRuntime.top()?.id};
            UIRuntime.close('phoneModal');
            return {before, withConfirm, answer, afterEsc};
        }""")
        check("(W7) confirm nad modalem roboczym nie zamyka tego modalu",
              w7["before"]["phoneOpen"] and w7["withConfirm"]["phoneOpen"] and w7["withConfirm"]["top"] == "unifiedConfirmModal",
              f"top po otwarciu confirm: {w7['withConfirm']['top']}, phoneModal otwarty: {w7['withConfirm']['phoneOpen']}")
        check("(S9/W7) Esc zamyka wyłącznie confirm; modal roboczy zostaje",
              w7["answer"] == "resolved:false" and w7["afterEsc"]["phoneOpen"],
              f"confirm: {w7['answer']}, phoneModal po Esc: {w7['afterEsc']['phoneOpen']}")

        # --- S23: polityki modali biznesowych (focus + outsideClick) ---
        s23 = await page.evaluate("""() => {
            const policyIds = ['phoneModal','casesModal','checklistsModal','proceduresModal','configModal','tileEditModal','emailProfilesModal','messageGenModal','reminderEditorModal','unifiedConfirmModal','upcomingModal','contactQualityModal','todoArchiveModal','infoDialogModal'];
            const missing = policyIds.filter(id => !MODAL_POLICIES[id]);
            const confirmPolicy = MODAL_POLICIES.unifiedConfirmModal;
            return {missing, confirmPriority: confirmPolicy?.priority, confirmKeepsOthers: confirmPolicy?.contextCloseOthers === false};
        }""")
        check("(S23) MODAL_POLICIES pokrywają 14 modali biznesowych", not s23["missing"],
              f"brakujące: {s23['missing'] or '—'}")
        check("(W7) polityka confirm: priorytet 95, nie zamyka innych",
              s23["confirmPriority"] == 95 and s23["confirmKeepsOthers"],
              f"priority: {s23['confirmPriority']}, contextCloseOthers: {s23['confirmKeepsOthers']}")

        # --- S10: live region i tooltip nie są ukrywane przy modalu ---
        s10 = await page.evaluate("""() => {
            BusinessActions.run('phoneLog');
            const live = document.getElementById('a11yLive');
            const state = {ariaHidden: live?.getAttribute('aria-hidden'), inert: !!live?.inert};
            announceA11y('AUDYT komunikat przy otwartym modalu');
            UIRuntime.close('phoneModal');
            return state;
        }""")
        announced = await page.evaluate("""async () => {
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));
            return (document.getElementById('a11yLive')?.textContent || '').includes('AUDYT komunikat');
        }""")
        check("(S10) #a11yLive nie ukryty przy otwartym modalu (aria-hidden/inert)",
              s10["ariaHidden"] != "true" and s10["inert"] is False and announced,
              f"aria-hidden: {s10['ariaHidden']}, inert: {s10['inert']}, ogłoszony: {announced}")

        # --- S11: fallback fokusu po zamknięciu (opener usunięty) ---
        await page.evaluate("""async () => {
            const temp = document.createElement('button');
            temp.type = 'button'; temp.textContent = 'AUDYT opener';
            document.body.appendChild(temp); temp.focus();
            const promise = showConfirmModal('AUDYT: fokus');
            temp.remove();
            document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            await promise.catch(() => {});
            return true;
        }""")
        try:
            await page.wait_for_function(
                "document.activeElement && document.activeElement.tagName === 'MAIN'", timeout=3000)
            focused = True
        except Exception:
            focused = False
        active = await page.evaluate(
            "document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : '')")
        check("(S11) fokus wraca do treści głównej gdy opener zniknął", focused, f"activeElement: {active}")

        # --- W12: tabele QR v9/v10 (ISO 18004, poziom M) ---
        # pojemności byte-mode (M): v7 ~122, v8 ~152, v9 ~180, v10 dokładnie 213 bajtów
        v8 = await qr_matrix_size(page, "C" * 145)
        v9 = await qr_matrix_size(page, "A" * 175)
        v10 = await qr_matrix_size(page, "B" * 210)
        check("(W12) QR v8 (145 znaków) → macierz 49×49 (bez regresji)", v8 == 49, f"rozmiar: {v8}")
        check("(W12) QR v9 (175 znaków) → macierz 53×53", v9 == 53, f"rozmiar: {v9}")
        check("(W12) QR v10 (210 znaków) → macierz 57×57", v10 == 57, f"rozmiar: {v10}")
        qr_boundary = await page.evaluate("""() => {
            const limit = QR.capacityBytes;
            let ok213 = false;
            try { QR.make('A'.repeat(limit)); ok213 = true; } catch (e) {}
            let rejected214 = false;
            try { QR.make('B'.repeat(limit + 1)); } catch (e) { rejected214 = true; }
            return {limit, ok213, rejected214};
        }""")
        check("(W12) granica pojemności QR: limit bajtów przyjęty, limit+1 odrzucony",
              qr_boundary["limit"] == 213 and qr_boundary["ok213"] and qr_boundary["rejected214"],
              f"limit: {qr_boundary['limit']}, {qr_boundary['limit']} bajtów OK: {qr_boundary['ok213']}, {qr_boundary['limit']+1} odrzucone: {qr_boundary['rejected214']}")
        await page.keyboard.press("Escape")

        # --- S21: martwy kod usunięty, aplikacja działa ---
        s21 = await page.evaluate("""() => {
            const gone = name => { try { eval(name); return false; } catch (e) { return true; } };
            return {
                tiles: gone('TilesSubsystem'), pipeline: gone('TaskPipeline'),
                journal: gone('JournalPipeline'), calendar: gone('CalendarSubsystem'),
                render: gone('RenderContractRuntime'), ready: window.WorkDeskReady === true
            };
        }""")
        check("(S21) martwe podsystemy i RenderContractRuntime usunięte",
              all(s21[k] for k in ("tiles", "pipeline", "journal", "calendar", "render")) and s21["ready"],
              f"{s21}")

        # --- S16: bindowania przez EventLifecycle (ownerzy) ---
        s16 = await page.evaluate("""() => {
            const rows = EventLifecycle.audit().rows.map(r => r.owner);
            const owners = ['email-panel', 'tile-actions', 'combobox-sync', 'command-palette'];
            return {present: owners.filter(o => rows.includes(o)), raw: document.querySelectorAll('body *').length > 0};
        }""")
        check("(S16) emailBar/kafelki/comboboxy bindowane przez EventLifecycle",
              len(s16["present"]) == 4, f"ownerzy obecni: {s16['present']}")

        # --- S17: cap UI_ERRORS ---
        s17 = await page.evaluate("""() => {
            for (let i = 0; i < 150; i++) window.dispatchEvent(new ErrorEvent('error', {message: 'AUDYT overflow ' + i}));
            return {length: UI_ERRORS.length, capped: UI_ERRORS.length <= 100};
        }""")
        check("(S17) UI_ERRORS z limitem 100 wpisów", s17["capped"], f"długość: {s17['length']}")

        # --- S18: scalony kontrakt Enter/Space (1 klik, nie 2) ---
        s18 = await page.evaluate("""() => {
            const probe = document.createElement('div');
            probe.setAttribute('role', 'button'); probe.tabIndex = 0;
            probe.textContent = 'AUDYT aktywowany';
            let clicks = 0;
            probe.addEventListener('click', () => clicks++);
            document.body.appendChild(probe); probe.focus();
            probe.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
            const roleBased = clicks;
            probe.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true}));
            const withSpace = clicks;
            probe.remove();
            return {roleBased, withSpace};
        }""")
        check("(S18) Enter i Space aktywują element [role=button] dokładnie raz",
              s18["roleBased"] == 1 and s18["withSpace"] == 2, f"po Enter: {s18['roleBased']}, po Space: {s18['withSpace']}")

        # --- S19: etykietowanie dialogów przez jeden właściciika (UIRuntime.open) ---
        s19 = await page.evaluate("""() => {
            BusinessActions.run('phoneLog');
            const modal = document.getElementById('phoneModal');
            const labelled = modal?.getAttribute('aria-labelledby'), described = modal?.getAttribute('aria-describedby');
            const labelledByExists = labelled && !!document.getElementById(labelled);
            UIRuntime.close('phoneModal');
            return {labelled, described, labelledByExists};
        }""")
        check("(S19) modal ma aria-labelledby/describedby z jednego źródła (UIRuntime)",
              bool(s19["labelled"]) and bool(s19["described"]) and s19["labelledByExists"],
              f"labelledby: {s19['labelled']}, describedby: {s19['described']}")

        check("Faza 2: 0 błędów strony", not errors, "; ".join(errors[:3]) if errors else "")
        await context.close()
        await browser.close()

    print()
    failed = [r for r in results if not r[1]]
    if failed:
        print(f"WYNIK: FAIL ({len(failed)}/{len(results)} testów nie przeszło)")
        sys.exit(1)
    print(f"WYNIK: PASS — wszystkie {len(results)} testów")


if __name__ == "__main__":
    asyncio.run(run())
