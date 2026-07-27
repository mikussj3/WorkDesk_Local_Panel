EventLifecycle.on(window, "error", event => {
    UI_ERROR_REGISTRY.record("runtime", "window", event.error || new Error(event.message));
}), EventLifecycle.on(window, "unhandledrejection", event => {
    UI_ERROR_REGISTRY.record("promise", "window", event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
}), EventLifecycle.on(window, "beforeunload", () => MODULE_LIFECYCLE.all().forEach(c => c.teardown({
    reason: "beforeunload"
})), {
    once: !0
}), function() {
    "use strict";
    function normalizeA11y(root = document) {
        root.querySelectorAll?.(".icon-btn,.pin-btn,.qr-btn,.pomo-x,.note-x").forEach(btn => {
            "BUTTON" !== btn.tagName || btn.type || (btn.type = "button"), function(btn) {
                if (btn.getAttribute("aria-label")) return;
                const title = btn.getAttribute("title")?.trim(), text = (btn.textContent || "").replace(/\s+/g, " ").trim(), action = btn.dataset.action || btn.dataset.act || void 0 !== btn.dataset.close && "Zamknij";
                btn.setAttribute("aria-label", title || text || action || "Akcja");
            }(btn), btn.title || (btn.title = btn.getAttribute("aria-label"));
        }), root.querySelectorAll?.('input[type="checkbox"]').forEach(input => {
            input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`) || input.closest("label") || input.getAttribute("aria-label") || input.setAttribute("aria-label", "Przełącz opcję");
        }), root.querySelectorAll?.(".modal").forEach(modal => {
            modal.setAttribute("role", "dialog"), modal.setAttribute("aria-modal", "true");
            const heading = modal.querySelector("h1,h2,h3,h4");
            heading && (heading.id || (heading.id = modal.id ? modal.id + "Title" : "dialogTitle" + Math.random().toString(36).slice(2)), 
            modal.setAttribute("aria-labelledby", heading.id));
        });
    }
    (() => {
        if (document.querySelector(".skip-link")) return;
        const main = document.querySelector("main.main");
        if (!main) return;
        main.id || (main.id = "mainContent"), main.tabIndex = -1;
        const link = document.createElement("a");
        link.className = "skip-link", link.href = "#" + main.id, link.textContent = "Przejdź do głównej treści", 
        document.body.prepend(link), link.addEventListener("click", () => requestAnimationFrame(() => main.focus({
            preventScroll: !0
        })));
    })(), normalizeA11y();
    EmailSubsystem = {
        id: "email",
        root: () => document.querySelector(".email-main"),
        state: () => EmailComposerState.state(),
        readForm: () => EmailComposerState.read(),
        writeForm: form => EmailComposerState.update(form),
        syncGroups: () => EmailComposerState.state().selectedGroups,
        render() {
            EmailComposerState.render(), renderGroups($("#grpSearch")?.value || ""), renderEmailSelections?.(), 
            normalizeA11y(this.root());
        },
        clearField(name) {
            const key = {
                fTo: "to",
                fCc: "cc",
                fBcc: "bcc",
                fSubject: "subject",
                fBody: "body",
                fSig: "signature"
            }[name] || name;
            EmailComposerState.update({
                [key]: ""
            }), scheduleDraftSave?.();
        },
        replacePlaceholders: (text, ctx = {}) => String(text ?? "").replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => ctx[k] ?? ""),
        diagnostics() {
            return {
                root: !!this.root(),
                groups: runtimeData?.sections?.reduce((n, s) => n + (s.groups?.length || 0), 0) || 0,
                templates: runtimeData?.templates?.length || 0,
                form: this.readForm()
            };
        }
    };
    EmailSubsystem = EmailSubsystem;
    const TilesSubsystem = {
        id: "tiles",
        normalize(raw, index = 0) {
            const t = validateTile?.(raw, new Set)?.value || raw || {}, type = t.type || (t.url ? "link" : void 0 !== t.value ? "copy" : "custom");
            return {
                ...t,
                id: t.id || `tile_${index}_${String(t.title || "").toLowerCase().replace(/\W+/g, "_")}`,
                type: type,
                hidden: Boolean(t.hidden)
            };
        },
        models() {
            return (runtimeData.tiles || []).map((t, i) => this.normalize(t, i));
        },
        visible({query: query = tileSearchQuery || "", filter: filter = activeTileFilter || "all"} = {}) {
            const q = String(query).toLowerCase();
            return this.models().filter(t => !t.hidden).filter(t => !q || `${t.title} ${t.desc || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q)).filter(t => "all" === filter || "pinned" === filter ? "all" === filter || pinnedTiles.has(t.id) : (t.tags || []).includes(filter));
        },
        sort(list = this.visible()) {
            const order = new Map(loadTileOrder().map((id, i) => [ id, i ]));
            return [ ...list ].sort((a, b) => Number(pinnedTiles.has(b.id)) - Number(pinnedTiles.has(a.id)) || (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999) || a.title.localeCompare(b.title, "pl"));
        },
        render() {
            renderTiles(), normalizeA11y($("#tilesHost") || document);
        },
        diagnostics() {
            return {
                total: this.models().length,
                visible: this.visible().length,
                pinned: pinnedTiles.size,
                types: [ ...new Set(this.models().map(x => x.type)) ]
            };
        }
    };
    
    const TaskPipeline = {
        normalize: t => ({
            id: t.id || businessUid(),
            text: String(t.text || "").trim(),
            priority: [ "low", "normal", "high" ].includes(t.priority) ? t.priority : "normal",
            dueDate: t.dueDate || "",
            done: Boolean(t.done),
            duplicate: Boolean(t.duplicate),
            archivedAt: Number(t.archivedAt) || 0,
            createdAt: Number(t.createdAt) || Date.now()
        }),
        list(filter = $("#todoFilter")?.value || "all") {
            const today = dateKeyLocal(new Date);
            return todos.map(x => this.normalize(x)).filter(t => "all" === filter || "today" === filter && t.dueDate === today || "high" === filter && "high" === t.priority && !t.done || "overdue" === filter && t.dueDate && t.dueDate < today && !t.done || "done" === filter && t.done);
        },
        command(action, id, payload = {}) {
            const item = todos.find(x => x.id === id);
            return "archive" === action && item ? "function" == typeof deleteTodo && deleteTodo(item) : !("toggle" !== action || !item || (item.done = payload.done ?? !item.done, 
            saveTodos(todos), renderTodos(), 0));
        }
    }, JournalPipeline = {
        list({query: query = "", type: type = "all"} = {}) {
            const q = query.toLowerCase();
            return journal.filter(x => ("all" === type || x.type === type) && (!q || x.text.toLowerCase().includes(q))).sort((a, b) => b.createdAt - a.createdAt);
        },
        groups(opts = {}) {
            return Object.groupBy ? Object.groupBy(this.list(opts), x => dateKeyLocal(new Date(x.createdAt))) : this.list(opts).reduce((a, x) => ((a[dateKeyLocal(new Date(x.createdAt))] ||= []).push(x), 
            a), {});
        },
        summary(opts = {}) {
            const rows = this.list(opts);
            return {
                count: rows.length,
                days: new Set(rows.map(x => dateKeyLocal(new Date(x.createdAt)))).size,
                characters: rows.reduce((n, x) => n + x.text.length, 0)
            };
        }
    }, ModuleCommands = {
        noteToTodo(id) {
            const n = notes.find(x => x.id === id);
            return !!n && (DomainServices.todo.create({
                text: n.text
            }), !0);
        },
        noteToJournal(id) {
            const n = notes.find(x => x.id === id);
            return !!n && (DomainServices.journal.create({
                text: n.text,
                type: "note"
            }), !0);
        },
        reminderDone: id => removeCalendarReminder(id),
        reminderSnooze: (id, minutes = 10) => !!CoreModuleState.calendarReminders.snooze(id, minutes)
    };
    
    const CalendarSubsystem = {
        parse(r) {
            const time = /^\d{2}:\d{2}$/.test(r.time || "") ? r.time : "00:00", date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : dateKeyLocal(new Date);
            return new Date(`${date}T${time}:00`);
        },
        normalize: r => ({
            ...r,
            date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : dateKeyLocal(new Date),
            time: /^\d{2}:\d{2}$/.test(r.time || "") ? r.time : "",
            done: Boolean(r.done),
            snoozedUntil: Number(r.snoozedUntil) || 0
        }),
        renderCalendar() {
            ModuleRegistry.get("calendarReminders")?.render();
        },
        renderList() {
            renderCalendarReminderList();
        },
        renderDayMenu(ev, date) {
            showCalendarDayMenu(ev, date, ev?.currentTarget || ev?.target || document.activeElement);
        },
        upcoming(days = 7) {
            const now = Date.now(), cut = now + 864e5 * days;
            return calReminders.map(r => this.normalize(r)).filter(r => !r.done).filter(r => {
                const t = r.snoozedUntil || this.parse(r).getTime();
                return t >= now && t <= cut;
            }).sort((a, b) => (a.snoozedUntil || this.parse(a)) - (b.snoozedUntil || this.parse(b)));
        },
        snooze: (id, minutes) => ModuleCommands.reminderSnooze(id, minutes),
        done: id => ModuleCommands.reminderDone(id),
        diagnostics() {
            const rows = CoreModuleState.calendarReminders.list();
            return {
                total: rows.length,
                upcoming: this.upcoming().length,
                withoutTime: rows.filter(x => !x.time).length
            };
        }
    };
    
}(), (() => {
    const ImportUX = {
        last: null,
        status(kind, summary, details = {}) {
            return this.last = {
                kind: kind,
                summary: summary,
                details: details,
                at: Date.now()
            }, this.render(), this.last;
        },
        ensureUI() {
            const anchor = document.querySelector("#dataPanel .panel-b,#dataImport")?.closest(".panel-b") || document.querySelector("#dataImport")?.parentElement;
            if (!anchor || document.querySelector("#importStatusPanel")) return;
            const tools = document.createElement("div");
            tools.className = "row", SafeDOM.append(tools, SafeDOM.el("button", { className: "btn sm", text: "Suchy test importu…", attrs: { id: "dataDryRun", type: "button" } })), 
            anchor.appendChild(tools);
            const panel = document.createElement("section");
            panel.id = "importStatusPanel", panel.className = "import-status-panel", panel.hidden = !0, 
            panel.setAttribute("aria-live", "polite"), anchor.appendChild(panel);
            EventLifecycle.on(document.querySelector("#dataDryRun"), "click", () => this.pickDryRun(), { owner: "import-ux", key: "dry-run" });
            const blocked = document.createElement("div");
            blocked.id = "storageBlockedBanner", blocked.className = "storage-blocked-banner", 
            blocked.hidden = !0, blocked.setAttribute("role", "alert"), SafeDOM.append(blocked, [SafeDOM.el("b", { text: "Pamięć przeglądarki jest niedostępna." }), SafeDOM.text(" Zmiany mogą nie zostać zapisane. Eksportuj dane przed zamknięciem aplikacji.")]), 
            document.body.prepend(blocked);
        },
        classifyValidation: result => result?.rejectedRecords?.length || result?.rejected ? "partial" : result?.repairedRecords?.length || result?.repaired ? "repaired" : "ok",
        dryRun(raw, srcName = "plik") {
            let parsed;
            try {
                parsed = "string" == typeof raw ? JSON.parse(raw) : cloneData(raw);
            } catch (error) {
                return this.status("error", "Plik nie jest poprawnym JSON-em.", {
                    error: String(error)
                });
            }
            try {
                const migrated = migrateData(parsed), validation = validateCurrentData(migrated), modules = getModuleIds(migrated.moduleIds || Object.keys(migrated.modules || {})).map(id => ({
                    id: id,
                    label: MODULE_BY_ID[id]?.label || id,
                    records: Array.isArray(migrated.modules?.[id]) ? migrated.modules[id].length : 1,
                    valid: !(validation.errors || []).some(x => String(x).includes(id))
                })), checksumResult = verifySnapshotChecksum(parsed), kind = checksumResult.ok || checksumResult.missing ? validation.valid ? "ok" : "partial" : "checksum";
                return this.status(kind, "ok" === kind ? `Suchy test „${srcName}” zakończony pomyślnie.` : "checksum" === kind ? "Niezgodna suma kontrolna — import nie powinien być wykonany bez świadomej decyzji." : "Import częściowy: część danych wymaga naprawy lub odrzucenia.", {
                    srcName: srcName,
                    modules: modules,
                    errors: validation.errors || [],
                    checksum: checksumResult,
                    partial: Boolean(migrated.partial)
                });
            } catch (error) {
                return this.status("error", "Nie udało się przygotować podglądu importu.", {
                    error: String(error)
                });
            }
        },
        pickDryRun() {
            const input = document.createElement("input");
            input.type = "file", input.accept = ".json,application/json", bindEvent(input, "change", () => {
                const file = input.files?.[0];
                if (!file) return;
                const r = new FileReader;
                r.onload = () => this.dryRun(String(r.result || ""), file.name), r.readAsText(file);
            }), input.click();
        },
        render() {
            this.ensureUI();
            const panel = document.querySelector("#importStatusPanel");
            if (!panel || !this.last) return;
            panel.hidden = !1;
            const tone = {
                ok: "ok",
                repaired: "warn",
                partial: "warn",
                checksum: "error",
                error: "error",
                blocked: "error"
            }[this.last.kind] || "warn", mods = this.last.details.modules || [], errors = this.last.details.errors || [];
            SafeDOM.replace(panel, [
                SafeDOM.el("div", { className: "import-status-head" }, [SafeDOM.el("div", { className: "import-status-title", text: "Status danych" }), SafeDOM.el("span", { className: "status-pill", text: this.last.kind.toUpperCase(), dataset: { tone } })]),
                SafeDOM.el("div", { className: "import-status-summary", text: this.last.summary }),
                mods.length ? SafeDOM.el("div", { className: "import-module-grid" }, mods.map(module => SafeDOM.el("div", { className: "import-module-item" }, [SafeDOM.el("b", { text: module.label }), SafeDOM.el("small", { text: `${module.valid ? "zostanie nadpisany" : "wymaga uwagi"} · rekordy: ${module.records}` })]))) : null,
                errors.length ? SafeDOM.el("details", {}, [SafeDOM.el("summary", { text: `Błędy i ostrzeżenia (${errors.length})` }), SafeDOM.el("div", { className: "code-block", text: errors.slice(0, 50).join("\n") })]) : null
            ]);
        },
        storageProbe() {
            try {
                const k = "__wd_pf1620_probe__";
                return GuardedStorage.setItem(k, "1"), GuardedStorage.removeItem(k), document.querySelector("#storageBlockedBanner")?.setAttribute("hidden", ""), 
                !0;
            } catch (error) {
                return document.querySelector("#storageBlockedBanner")?.removeAttribute("hidden"), 
                this.status("blocked", "Przeglądarka zablokowała StorageBackend.", {
                    error: String(error)
                }), !1;
            }
        },

    };
    ImportUX.ensureUI(), ImportUX.storageProbe(), 
    Object.freeze([ {
        id: "tokens-base-layout",
        kind: "css",
        description: "Tokens, reset, typography and layout"
    }, {
        id: "components",
        kind: "css+js",
        description: "Buttons, cards, lists, modals, sheets and popovers"
    }, {
        id: "modules-core",
        kind: "js",
        description: "Email, tiles, TODO, journal, notes and calendar"
    }, {
        id: "modules-business",
        kind: "js",
        description: "Profiles, checklists, cases, phone log, procedures and configuration"
    }, {
        id: "storage-schema-import",
        kind: "js",
        description: "Schema, validation, migrations, snapshot and restore"
    }, {
        id: "utilities-tests",
        kind: "js",
        description: "Utilities and operational tools"
    } ]);
    const initializeBusinessRuntime = () => {
        ImportUX.ensureUI(), ImportUX.storageProbe();
    };
    "loading" === document.readyState ? EventLifecycle.once(document, "DOMContentLoaded", initializeBusinessRuntime, {
        owner: "business-runtime",
        key: "dom-ready"
    }) : queueMicrotask(initializeBusinessRuntime);})();
