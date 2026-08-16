#!/usr/bin/env python3
"""Weryfikacja poprawek Fazy 3 (audyt 2026-08-15) — walidatory, cascade, sortowanie, narzędzia.

Pokrycie: S30 (zakresy daty/godziny + przypięte notatki), S6 (createdAt ISO zachowane),
S5 (whitelista pól importu), S24 (mailto: kodowanie `to` + walidacja bulk),
S25 (dedup między Do/DW/UDW), S26 (apostrof ochronny CSV w round-tripie),
S27 (rngInt + kontrakt długości hasła), S20 (cascade linków + reconcile po imporcie),
S29 (sortowanie TODO + spójność filtrów), S13/S24a (naprawione latentne referencje).

Uzycie: python3 tools/phase3_verify.py [sciezka_html] [sciezka_chromium]
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


CSV_OWN_EXPORT = "Sekcja;Grupa;E-mail\r\n'-Dział;Grupa A;a@x.pl\r\n'-Dział;Grupa A;b@x.pl\r\n"


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

        # --- S30: zakresy daty/godziny przy tworzeniu przypomnienia ---
        s30 = await page.evaluate("""() => ({
            badDate: CoreModuleState.calendarReminders.create({text: 'x', date: '2026-13-40', time: '10:00'}),
            badTime: CoreModuleState.calendarReminders.create({text: 'x', date: '2026-08-15', time: '99:99'}),
            ok: CoreModuleState.calendarReminders.create({text: 'AUDYT zakresy', date: '2026-08-15', time: '10:30'})
        })""")
        check("(S30) przypomnienie z datą 13-40 / godziną 99:99 odrzucone",
              s30["badDate"] is None and s30["badTime"] is None and bool(s30["ok"]))
        await page.evaluate("s30_ok && CoreModuleState.calendarReminders.remove(s30_ok)".replace("s30_ok", json.dumps(s30["ok"]["id"])))

        # --- S6: ISO createdAt zachowane jako znacznik epoki ---
        s6 = await page.evaluate("""() => {
            const iso = '2024-05-01T10:00:00Z';
            const r = validateTodoItem({text: 'x', done: true, id: 't1', createdAt: iso});
            return {valid: r.valid, preserved: r.value.createdAt === Date.parse(iso), value: r.value.createdAt};
        }""")
        check("(S6) ISO-daty w createdAt konwertowane, nie nadpisywane Date.now()",
              s6["valid"] and s6["preserved"], f"createdAt: {s6['value']}")

        # --- S5: whitelista pól importu ---
        s5 = await page.evaluate("""() => {
            const r = validateTodoItem({text: 'x', done: true, id: 't1', createdAt: 1, injected: 'Payload', junk: 42});
            return {clean: !('injected' in r.value) && !('junk' in r.value),
                    warned: r.warnings.some(w => w.includes('nieznane pola') && w.includes('injected')),
                    known: ['id','text','done','archived','priority','dueDate','createdAt','updatedAt','completedAt'].every(k => k in r.value)};
        }""")
        check("(S5) nieznane pola rekordu importu usuwane i raportowane",
              s5["clean"] and s5["warned"] and s5["known"], json.dumps(s5, ensure_ascii=False))

        # --- S24: kodowanie części `to` w mailto: ---
        s24 = await page.evaluate("""() => {
            const uri = EmailComposerState.mailto('a@b.pl?x=1&y=2', {cc: '', bcc: '', subject: 's', body: 'b'});
            const head = uri.slice(0, uri.indexOf('?'));
            return {uri, head, oneQuerySeparator: (uri.match(/\\?/g) || []).length === 1, encoded: head.includes('%3F') && head.includes('%26')};
        }""")
        check("(S24) `to` kodowane URI — znaki ? i & nie łamią struktury mailto:",
              s24["oneQuerySeparator"] and s24["encoded"], f"head: {s24['head'][:50]}")

        # --- S25: dedup między polami Do/DW/UDW ---
        s25 = await page.evaluate("""() => {
            EmailComposerState.update({to: 'wspolny@x.pl, a@x.pl', cc: 'WSPOLNY@x.pl, c@x.pl', bcc: 'wspolny@x.pl', subject: 's', body: 'b'});
            const uri = EmailComposerState.mailto(EmailComposerState.read().to);
            return {toCount: (uri.match(/wspolny%40x\\.pl/gi) || []).length + (uri.match(/WSPOLNY%40x\\.pl/g) || []).length,
                    ccCount: (uri.match(/c%40x\\.pl/g) || []).length};
        }""")
        check("(S25) adres wspólny dla Do/DW/UDW trafia do URI dokładnie raz",
              s25["toCount"] == 1 and s25["ccCount"] == 1, json.dumps(s25))

        # --- S24b: walidacja adresów w ścieżce bulk ---
        s24b = await page.evaluate("""() => {
            EmailComposerState.update({to: 'ok1@x.pl, zly-adres', cc: '', bcc: ''});
            document.getElementById('bulkBtn').click();
            const opened = !!document.getElementById('bulkMailModal') && !document.getElementById('bulkMailModal').hidden;
            const toast = [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join('|');
            return {opened, toast: toast.slice(0, 90)};
        }""")
        check("(S24) bulk mail odrzuca nieprawidłowe adresy przed otwarciem",
              s24b["opened"] is False and "nieprawidłowe adresy".lower() in s24b["toast"].lower(), s24b["toast"])

        # --- S26: apostrof ochronny CSV usuwany przy imporcie ---
        # Uwaga: ścieżka w $HOME — snap-Chromium nie otwiera plików z /tmp dla rendererа.
        csv_path = HTML.parent / "wd-audit-own-export.csv"
        csv_path.write_text(CSV_OWN_EXPORT, encoding="utf-8")
        await page.set_input_files("#csvImportFile", str(csv_path))
        await page.wait_for_timeout(700)
        s26 = await page.evaluate("""() => {
            const modal = document.getElementById('csvImportModal');
            const text = modal ? modal.textContent : '';
            return {visible: modal ? !modal.hidden : false,
                    unguarded: text.includes('-Dział') && !text.includes("'-Dział"),
                    rows: text.includes('a@x.pl')};
        }""")
        check("(S26) round-trip własnego CSV: apostrof ochronny zdekodowany, sekcja \"-Dział\"",
              s26["visible"] and s26["unguarded"] and s26["rows"], json.dumps(s26, ensure_ascii=False))
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)

        # --- S27: rngInt (rejection sampling) + kontrakt długości hasła ---
        s27 = await page.evaluate("""() => {
            const counts = {"0": 0, "1": 0};
            for (let i = 0; i < 400; i++) counts[String(rngInt(2))]++;
            document.getElementById('pwdLen').value = '6';
            generatePassword();
            const len6 = document.getElementById('pwdValue').value.length;
            document.getElementById('pwdLen').value = '12';
            generatePassword();
            const len12 = document.getElementById('pwdValue').value.length;
            return {counts, len6, len12};
        }""")
        check("(S27) rngInt bez modulo bias (oba wyniki obecne w 400 losowań)",
              s27["counts"]["0"] > 0 and s27["counts"]["1"] > 0 and abs(s27["counts"]["0"] - 200) < 60,
              f"rozkład: {s27['counts']}")
        check("(S27) wygenerowane hasło ma dokładnie żądaną długość",
              s27["len6"] == 6 and s27["len12"] == 12, f"len6: {s27['len6']}, len12: {s27['len12']}")

        # --- S20: cascade linków przy usuwaniu rekordu ---
        s20 = await page.evaluate("""() => {
            const todo = CoreModuleState.todo.create({text: 'AUDYT cascade'});
            const created = AppServices.responseCases.create({subject: 'AUDYT cascade case', from: 'a'});
            BusinessWorkflow.link('responseCases', created.id, 'todos', todo.id);
            const before = (ensureAppState().modules.responseCases.find(c => c.id === created.id).links.todos || []).includes(todo.id);
            CoreModuleState.todo.remove(todo.id);
            const after = (ensureAppState().modules.responseCases.find(c => c.id === created.id).links.todos || []).includes(todo.id);
            AppServices.responseCases.remove(created.id);
            return {before, after};
        }""")
        check("(S20) usunięcie TODO czyści link ze sprzężonej sprawy",
              s20["before"] is True and s20["after"] is False, json.dumps(s20))

        # --- S20b: reconcileAll({persist}) po imporcie usuwa martwe linki ---
        s20b = await page.evaluate("""async () => {
            const created = AppServices.responseCases.create({subject: 'AUDYT stale link', from: 'a'});
            const artifact = await buildExportArtifact();
            artifact.modules.responseCases = artifact.modules.responseCases.map(c => c.id === created.id
                ? {...c, links: {todos: ['nieistniejace-todo-1'], cases: [], reminders: [], journal: []}} : c);
            artifact.modules.todo = [];
            const signed = await attachChecksum(artifact);   // mutacja unieważniła sumę — podpisz ponownie
            const file = new File([JSON.stringify(signed)], 'stale-links.json', {type: 'application/json'});
            importDataFromFile(file);
            return created.id;
        }""")
        await page.wait_for_timeout(600)
        await page.click("#unifiedConfirmYes")
        await page.wait_for_timeout(900)
        stale = await page.evaluate("""(id) => {
            const c = ensureAppState().modules.responseCases.find(r => r.id === id);
            return c ? {todos: (c.links?.todos || []).length} : {missing: true};
        }""", s20b)
        check("(S20) import z martwymi linkami czyści je po replenish (reconcileAll persist)",
              stale.get("todos") == 0, json.dumps(stale))

        # --- S29: sortowanie TODO + spójność filtrów ---
        s29 = await page.evaluate("""() => {
            const mk = (text, priority, dueDate, done) => {
                const item = CoreModuleState.todo.create({text, priority, dueDate});
                done && CoreModuleState.todo.complete(item.id);
                return item.id;
            };
            const ids = {
                low: mk('AUDYT low', 'low', ''),
                high: mk('AUDYT high', 'high', '2030-01-01'),
                doneHigh: null
            };
            document.getElementById('todoFilter').value = 'all';
            renderTodos();
            const first = document.querySelector('#todoList .todo-item');
            const firstIsHigh = first?.className.includes('priority-high');
            const firstIsDone = first?.className.includes(' done');
            const todayKey = dateKeyLocal(new Date());
            const todayTodo = CoreModuleState.todo.create({text: 'AUDYT today done', priority: 'normal', dueDate: todayKey});
            CoreModuleState.todo.complete(todayTodo.id);
            document.getElementById('todoFilter').value = 'today';
            renderTodos();
            const todayVisible = [...document.querySelectorAll('#todoList .todo-item .text')].some(el => el.textContent === 'AUDYT today done');
            document.getElementById('todoFilter').value = 'all';
            renderTodos();
            Object.values(ids).forEach(id => id && CoreModuleState.todo.remove(id));
            CoreModuleState.todo.remove(todayTodo.id);
            renderTodos();
            return {firstIsHigh, firstIsDone, todayVisible};
        }""")
        check("(S29) PILNY na początku listy, ukończone na końcu",
              s29["firstIsHigh"] and s29["firstIsDone"] is False, json.dumps(s29))
        check("(S29) filtr dzisiaj nie pokazuje ukończonych (spójność z high/overdue)",
              s29["todayVisible"] is False, json.dumps(s29))

        # --- S30b: przypięte notatki chronione przy oczyszczaniu ponad limit ---
        s30b = await page.evaluate("""() => {
            const ids = [];
            for (let i = 0; i < 4; i++) ids.push(AppServices.note.create({text: 'AUDYT unpinned ' + i}).id);
            const pinned1 = AppServices.note.create({text: 'AUDYT pinned STARA', pinned: true}).id;
            ensureAppState().modules.preferences.storageLimits = StorageLimits.normalize({
                ...StorageLimits.DEFAULTS, notesRecords: 3
            });
            requestFullSnapshot({immediate: true});
            document.getElementById('storageCleanupBtn').click();
            const candidate = storageCleanupCandidates.find(c => c.id === 'notes-excess');
            let applied = false, pinnedSurvived = false, removedId = null;
            if (candidate) {
                removedId = candidate.apply() !== undefined ? null : null;
                applied = true;
                pinnedSurvived = (ensureAppState().modules.notes || []).some(n => n.id === pinned1);
            }
            ensureAppState().modules.preferences.storageLimits = StorageLimits.normalize(StorageLimits.DEFAULTS);
            ids.forEach(id => CoreModuleState.notes.remove(id));
            try { CoreModuleState.notes.remove(pinned1); } catch (e) {}
            renderNotes();
            requestFullSnapshot({immediate: true});
            return {candidateFound: !!candidate, applied, pinnedSurvived};
        }""")
        check("(S30) notatki przypięte chronione przy oczyszczaniu ponad limit",
              s30b["candidateFound"] and s30b["pinnedSurvived"], json.dumps(s30b))

        check("Faza 3: 0 błędów strony", not errors, "; ".join(errors[:3]) if errors else "")
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
