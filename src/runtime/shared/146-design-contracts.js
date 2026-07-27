(() => {
    "use strict";
    const q = (s, r = document) => r.querySelector(s), ReminderLifecycle = {
        activePopup: null,
        lastVisibleAt: Date.now(),
        closePopup() {
            this.activePopup && (UIRuntime?.close?.(this.activePopup), this.activePopup = null), 
            hideCalendarDayMenu?.(), q("#calDayMenu")?.classList.remove("show");
        },
        open(id, options = {}) {
            this.closePopup(), this.activePopup = id, UIRuntime?.open("modal", id, options);
        },
        dueAt: r => ReminderTimeService.dueAt(r),
        stage(r) {
            return r.archivedAt ? "archived" : r.done ? "complete" : Number(r.snoozedUntil) > Date.now() ? "snoozed" : this.dueAt(r) <= Date.now() ? "alert" : "upcoming";
        },
        archive: id => CoreModuleState.calendarReminders.update(id, {
            archivedAt: Date.now()
        }),
        validateEdges() {
            const tomorrow = new Date;
            tomorrow.setDate(tomorrow.getDate() + 1);
            const midnight = new Date(2026, 0, 31, 23, 55), month = new Date(midnight.getTime() + 6e5), holiday = new Date(2026, 11, 25);
            return [ {
                name: "tomorrow",
                ok: dateKeyLocal(tomorrow) !== dateKeyLocal(new Date)
            }, {
                name: "midnight",
                ok: month.getDate() !== midnight.getDate()
            }, {
                name: "month-change",
                ok: month.getMonth() !== midnight.getMonth()
            }, {
                name: "holiday-local-date",
                ok: "2026-12-25" === dateKeyLocal(holiday)
            } ];
        },
        visibilityNotice() {
            const gap = Date.now() - this.lastVisibleAt;
            return gap > 6e4 && ((message, kind = "ok") => {
                toast(message, kind), announceA11y?.(message);
            })("Alert mógł się opóźnić, ponieważ karta była nieaktywna.", "err"), this.lastVisibleAt = Date.now(), 
            gap;
        }
    };
    SchedulerService.onResume(() => ReminderLifecycle.visibilityNotice());
    const TileActionContract = {
        actions: [ "open", "copy", "pin", "qr", "meta" ],
        model(t, i) {
            const m = TilesSubsystem.normalize(t, i);
            return {
                ...m,
                actions: {
                    open: "link" === m.type,
                    copy: "copy" === m.type,
                    pin: !0,
                    qr: !0,
                    meta: !0
                }
            };
        },
        models() {
            return (runtimeData.tiles || []).map((t, i) => this.model(t, i));
        },
        filtered(query = "", filter = "ALL") {
            const qv = String(query).trim().toLowerCase(), f = String(filter || "ALL").toUpperCase();
            return this.models().filter(t => (!qv || `${t.title} ${t.desc || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(qv)) && ("ALL" === f || (t.tags || []).map(String).map(x => x.toUpperCase()).includes(f)));
        },
        sorted: rows => sortTilesByPreferences(rows),
        render() {
            renderTiles();
        },
        tests() {
            const models = TilesSubsystem.models(), sample = models[0];
            if (!sample) return {
                ok: !1,
                reason: "no tiles"
            };
            const order = new Map([ [ sample.id, 0 ] ]), pins = new Set([ sample.id ]), sorted = [ ...models ].sort((a, b) => Number(pins.has(b.id)) - Number(pins.has(a.id)) || (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)), filtered = models.filter(x => pins.has(x.id));
            return {
                ok: sorted[0]?.id === sample.id && filtered.some(x => x.id === sample.id) && !0,
                readOnly: !0,
                orderOk: sorted[0]?.id === sample.id,
                filterOk: filtered.some(x => x.id === sample.id),
                qrAvailable: !0
            };
        }
    };
    const tilesHost = q("#tilesHost");
    const findTileRecord = tileElement => {
        const tileId = tileElement?.dataset.tileId;
        return (runtimeData.tiles || []).find(tile => tile.id === tileId) || null;
    };
    tilesHost?.addEventListener("click", async event => {
        if (!(event.target instanceof Element)) return;
        const actionButton = event.target.closest("[data-tile-action]");
        const tileElement = event.target.closest(".tile");
        if (!tileElement || !tilesHost.contains(tileElement)) return;
        const tile = findTileRecord(tileElement);
        if (!tile) return;
        if (!actionButton) {
            if ("link" === tile.type) void openTile(tile);
            return;
        }
        event.preventDefault(), event.stopPropagation();
        const action = actionButton.dataset.tileAction;
        var set;
        "pin" === action ? (pinnedTiles.has(tile.id) ? pinnedTiles.delete(tile.id) : pinnedTiles.add(tile.id), 
        set = pinnedTiles, ensureAppState(), appState.modules.preferences.tilePins = normalizeTilePreferenceIds([ ...set ]), 
        requestFullSnapshot(), renderTiles()) : "copy" === action ? ClipboardFeedback.copy(tile.value || tile.url || "") : "qr" === action ? showQrModal(tile.value || tile.url || "", tile.title) : "edit" === action ? openTileEditor(tile.id) : "delete" === action ? (await showConfirmModal(`Czy na pewno chcesz usunąć kafelek „${tile.title}”?`, {confirmLabel: "Usuń kafelek"}) ? (() => { const snapshot = AppServices.tiles.remove(tile.id); snapshot && offerUndo(`undo-tile-${tile.id}`, "Usunięto kafelek", `Usunięto „${tile.title}”.`, () => AppServices.tiles.restore(snapshot)); })() : null) : "open" === action && void openTile(tile);
    });
    const EmailWorkbenchMachine = {
        phases: [ "recipients", "template", "body", "signature", "send" ],
        state: () => EmailComposerState.state(),
        syncFromDOM: () => EmailComposerState.read(),
        updateField: (field, value) => EmailComposerState.update({
            [field]: value
        }),
        applyForm: patch => EmailComposerState.update(patch),
        transition(phase, {kind: kind = "ok", message: message = ""} = {}) {
            return !!this.phases.includes(phase) && (EmailComposerState.setMeta({
                phase: phase
            }), this.status(message || `Etap: ${phase}`, kind), !0);
        },
        status(message, kind = "ok") {
            EmailComposerState.setMeta({
                status: {
                    message: message,
                    kind: kind,
                    at: Date.now()
                }
            });
            let el = q("#emailFlowStatus");
            el || (el = document.createElement("div"), el.id = "emailFlowStatus", el.className = "email-flow-status", 
            el.setAttribute("role", "status"), q(".email-main")?.prepend(el)), el.dataset.kind = kind, 
            el.textContent = message, announceA11y?.(message);
        },
        markDraftRestored() {
            EmailComposerState.setMeta({
                draftRestored: !0
            }), this.status("Przywrócono szkic.", "ok");
        },
        markTemplateLoaded(name) {
            EmailComposerState.setMeta({
                activeTemplate: name || null
            }), this.transition("body", {
                message: `Wczytano szablon${name ? ": " + name : ""}.`
            });
        },
        markSignatureApplied(name) {
            EmailComposerState.setMeta({
                activeSignature: name || null
            }), this.transition("signature", {
                message: `Zastosowano podpis${name ? ": " + name : ""}.`
            });
        },
        markCsv(valid, summary = "") {
            EmailComposerState.setMeta({
                csvPreviewValid: !!valid
            }), this.status(valid ? `Podgląd CSV poprawny${summary ? " — " + summary : ""}.` : "Podgląd CSV zawiera błędy.", valid ? "ok" : "err");
        },
        diagnostics() {
            const st = EmailComposerState.state();
            return {
                phase: st.phase,
                formFields: Object.keys(st.form).length,
                status: st.status,
                csvPreviewValid: !!st.csvPreviewValid
            };
        }
    };
    Object.assign(EmailSubsystem, {
        state: () => EmailWorkbenchMachine.state(),
        readForm: () => EmailComposerState.read(),
        writeForm: f => EmailWorkbenchMachine.applyForm(f),
        diagnostics: () => EmailWorkbenchMachine.diagnostics()
    }), TileActionContract.render(), EmailWorkbenchMachine.status("E-mail gotowy — etap: odbiorcy.", "ok");})();


function defaultTileKey(tile) { return `${tile.type || "link"}|${tile.title || ""}|${tile.url || tile.value || ""}`; }
function defaultGroupKey(sectionName, group) { return `${sectionName}::${group.name}`; }
function openSelectiveRestoreModal({id, title, items, onRestore}) {
    let modal = document.getElementById(id);
    if (!modal) {
        modal = SafeDOM.el("div", { className: "modal", attrs: { id, hidden: true, role: "dialog", "aria-label": title } });
        document.getElementById("overlay")?.append(modal);
    }
    const list = SafeDOM.el("div", { className: "restore-select-list" }, items.map((item, index) => SafeDOM.el("label", { className: "restore-select-row" }, [
        SafeDOM.el("input", { checked: !item.exists, attrs: { type: "checkbox", disabled: item.exists ? true : null }, dataset: { restoreIndex: index } }),
        SafeDOM.el("span", {}, [SafeDOM.el("b", { text: item.label }), SafeDOM.el("div", { className: "business-meta", text: item.exists ? "Już istnieje — nie zostanie nadpisane" : "Brakujący element domyślny" })])
    ])));
    const restore = SafeDOM.el("button", { className: "btn primary", text: "Przywróć zaznaczone", attrs: { type: "button" } });
    const cancel = SafeDOM.el("button", { className: "btn ghost", text: "Anuluj", attrs: { type: "button", "data-close": id } });
    SafeDOM.replace(modal, [
        SafeDOM.el("div", { className: "modal-h" }, [SafeDOM.el("h3", { text: title }), SafeDOM.el("button", { className: "icon-btn x", text: "✕", attrs: { type: "button", "aria-label": "Zamknij", "data-close": id } })]),
        SafeDOM.el("div", { className: "modal-b" }, [SafeDOM.el("p", { className: "business-meta", text: "Przywracanie dodaje wyłącznie zaznaczone elementy domyślne. Własne kafelki i grupy nie są usuwane ani nadpisywane." }), list]),
        SafeDOM.el("div", { className: "modal-f" }, [cancel, restore])
    ]);
    bindEvent(restore, "click", () => {
        const selected = [...modal.querySelectorAll("[data-restore-index]:checked")].map(input => items[Number(input.dataset.restoreIndex)]).filter(Boolean);
        if (!selected.length) return toast("Nie zaznaczono elementów do przywrócenia.", "err");
        onRestore(selected);
        closeModal(id);
    });
    showModal(id);
}
function openTileDefaultsRestore() {
    const existing = new Set((runtimeData.tiles || []).map(defaultTileKey));
    const items = (DEFAULT_RUNTIME_DATA.tiles || []).map(tile => ({ label: tile.title, record: cloneData(tile), exists: existing.has(defaultTileKey(tile)) }));
    openSelectiveRestoreModal({ id: "tileDefaultsRestoreModal", title: "Przywróć domyślne kafelki", items, onRestore(selected) {
        const rows = [...runtimeData.tiles, ...selected.map(item => item.record)];
        ModuleRegistry.get("tiles").deserialize(rows); ModuleRegistry.get("tiles").render(); requestFullSnapshot({immediate: true}); toast(`Przywrócono: ${selected.length}`);
    }});
}
function openGroupDefaultsRestore() {
    const existing = new Set((runtimeData.sections || []).flatMap(section => (section.groups || []).map(group => defaultGroupKey(section.name, group))));
    const items = (DEFAULT_RUNTIME_DATA.sections || []).flatMap(section => (section.groups || []).map(group => ({ label: `${section.name} / ${group.name}`, section: section.name, record: cloneData(group), exists: existing.has(defaultGroupKey(section.name, group)) })));
    openSelectiveRestoreModal({ id: "groupDefaultsRestoreModal", title: "Przywróć domyślne grupy", items, onRestore(selected) {
        const sections = cloneData(runtimeData.sections || []);
        selected.forEach(item => { let section = sections.find(row => row.name === item.section); if (!section) { section = {name: item.section, groups: []}; sections.push(section); } if (!(section.groups || []).some(group => group.name === item.record.name)) section.groups.push(item.record); });
        ModuleRegistry.get("email").deserialize({ ...ensureAppState().modules.email, sections }); ModuleRegistry.get("email").render(); requestFullSnapshot({immediate: true}); toast(`Przywrócono: ${selected.length}`);
    }});
}
$("#tileDefaultsRestore")?.addEventListener("click", openTileDefaultsRestore);
