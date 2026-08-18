let idHistory = [];

EventLifecycle.on(window, "pagehide", event => {
    try {
        flushPendingWrites({
            commitNow: !0
        });
    } catch (error) {
        console.error("Nie udało się zapisać danych przy zamknięciu.", error);
    }
    if (event?.persisted) return;
    !function() {
        idHistory = [];
        const host = $("#idHistory");
        host && (host.replaceChildren());
    }(), SchedulerService.teardown(), EventLifecycle.teardown();
}, {
    capture: !0
});

EventLifecycle.on(window, "pageshow", event => {
    event?.persisted && (checkCalendarReminders(), "function" == typeof renderDataConfidence && renderDataConfidence());
}, { owner: "id-theme-notes", key: "pageshow-bfcache" });

const BASE32_ALPHA = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function rng(n) {
    return rngInt(n);
}

function generateId() {
    const kind = $("#idKind").value;
    let v = "";
    switch (kind) {
      case "uuid":
        v = function() {
            if (crypto?.randomUUID) return crypto.randomUUID();
            const buf = new Uint8Array(16);
            (window.crypto || window.msCrypto).getRandomValues(buf), buf[6] = 15 & buf[6] | 64, 
            buf[8] = 63 & buf[8] | 128;
            const hex = Array.from(buf).map(b => b.toString(16).padStart(2, "0"));
            return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
        }();
        break;

      case "ulid":
        v = function() {
            let s = "", x = Date.now();
            for (let i = 0; i < 10; i++) s = BASE32_ALPHA[x % 32] + s, x = Math.floor(x / 32);
            let r = "";
            for (let i = 0; i < 16; i++) r += BASE32_ALPHA[rng(30)];
            return s + r;
        }();
        break;

      case "order":
        v = function() {
            const y = (new Date).getFullYear();
            let s = "";
            for (let i = 0; i < 4; i++) s += BASE32_ALPHA[rng(30)];
            return `WD-${y}-${s}`;
        }();
        break;

      case "token":
        v = function() {
            let s = "";
            for (let i = 0; i < 16; i++) s += BASE32_ALPHA[rng(30)];
            return s;
        }();
        break;

      case "numeric":
        v = function() {
            let s = "";
            for (let i = 0; i < 8; i++) s += rng(10);
            return s;
        }();
    }
    $("#idValue").value = v, idHistory.unshift({
        kind: kind,
        v: v
    }), idHistory = idHistory.slice(0, StorageLimits.current().idHistoryRecords || 8);
    const historyHost = $("#idHistory");
    SafeDOM.replace(historyHost, idHistory.map(item => SafeDOM.el("div", { className: "h-item" }, [
        SafeDOM.el("span", { className: "h-val", text: item.v, attrs: { title: item.v } }),
        SafeDOM.el("button", { text: "Kopiuj", attrs: { type: "button" }, dataset: { v: item.v } })
    ])));
    delegateEvent(historyHost, "click", "button[data-v]", async (_event, button) => {
        const ok = await copyToClipboard(button.dataset.v);
        toast(ok ? "Skopiowano." : "Nie udało się skopiować.", ok ? "ok" : "err");
    }), $("#idInfo").textContent = "Wygenerowano: " + kind;
}

$("#idGen").addEventListener("click", generateId), $("#idKind").addEventListener("change", generateId), 
$("#idCopy").addEventListener("click", async () => {
    if (!$("#idValue").value) return toast("Najpierw wygeneruj ID.", "err");
    const ok = await copyToClipboard($("#idValue").value);
    toast(ok ? "Skopiowano." : "Nie udało się skopiować.", ok ? "ok" : "err");
}), $("#toolId").addEventListener("click", () => {
    generateId(), showModal("idModal");
});

const THEME_MQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

function detectedTheme() {
    return THEME_MQ && THEME_MQ.matches ? "light" : "dark";
}

function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    const explicit = appState?.modules?.preferences?.theme || null;
    $("#themeLbl") && ($("#themeLbl").textContent = explicit ? t : "system"), function(theme) {
        const src = "light" === theme ? NOTE_PALETTES_LIGHT : NOTE_PALETTES_BASE;
        NOTE_PALETTES.length = 0, src.forEach(p => NOTE_PALETTES.push(p)), window.WorkDeskReady && ModuleRegistry.get("notes")?.render();
    }(t);
}

function effectiveTheme() {
    return appState?.modules?.preferences?.theme || detectedTheme();
}

function resetThemeToSystem() {
    ensureAppState().modules.preferences.theme = null, applyTheme(detectedTheme()), 
    toast("Motyw: według systemu");
}

THEME_MQ && THEME_MQ.addEventListener && THEME_MQ.addEventListener("change", () => {
    appState?.modules?.preferences?.theme || applyTheme(detectedTheme());
});

let themePressTimer = null;

const themeBtn = $("#themeToggle");

themeBtn.addEventListener("click", e => {
    e.altKey ? resetThemeToSystem() : function() {
        const next = "light" === (document.documentElement.getAttribute("data-theme") || effectiveTheme()) ? "dark" : "light";
        ensureAppState().modules.preferences.theme = next, persistData(), applyTheme(next), 
        toast("Motyw: " + ("light" === next ? "jasny" : "ciemny"));
    }();
}), themeBtn.addEventListener("pointerdown", () => {
    themePressTimer = SchedulerService.scheduleTimeout(() => {
        resetThemeToSystem(), themePressTimer = null;
    }, 1e3, {
        owner: "preferences",
        key: "theme-long-press"
    });
}), [ "pointerup", "pointerleave", "pointercancel" ].forEach(ev => themeBtn.addEventListener(ev, () => {
    themePressTimer && (SchedulerService.cancel(themePressTimer), themePressTimer = null);
}));

const NOTE_PALETTES_BASE = NOTE_PALETTES.slice(), NOTE_PALETTES_LIGHT = [ {
    id: "amber",
    bg: "#fff5d6",
    bd: "#e8c98a",
    fg: "#7a5b1a",
    swatch: "#e6c374"
}, {
    id: "mint",
    bg: "#e0f5ec",
    bd: "#a8d8c2",
    fg: "#1a6b4a",
    swatch: "#6bd6a4"
}, {
    id: "blue",
    bg: "#e8efff",
    bd: "#a8baea",
    fg: "#1a4abc",
    swatch: "#7aa2ff"
}, {
    id: "rose",
    bg: "#fae0e3",
    bd: "#d8a8b0",
    fg: "#a04444",
    swatch: "#ff8a8a"
}, {
    id: "slate",
    bg: "#eef1f7",
    bd: "#c0c8d4",
    fg: "#3a4050",
    swatch: "#8a93a8"
} ];

$("#storageLimitsBtn").addEventListener("click", () => {
    renderStorageLimitForm(), showModal("storageLimitsModal");
}), $("#storageLimitsReset").addEventListener("click", () => renderStorageLimitForm(StorageLimits.DEFAULTS)), 
$("#storageLimitsSave").addEventListener("click", function() {
    const next = {};
    $$("#storageLimitGrid [data-limit-key]").forEach(el => next[el.dataset.limitKey] = Number(el.value) * Number(el.dataset.factor)), 
    next.warningPercent = Number($("#limit_warningPercent").value), next.dangerPercent = Number($("#limit_dangerPercent").value), 
    ensureAppState().modules.preferences.storageLimits = StorageLimits.normalize(next), 
    requestFullSnapshot({
        immediate: !0
    }), closeModal(), applyStorageInputLimits(), renderStorageDashboard(), toast("Zapisano limity pamięci.");
}), $("#storageCleanupBtn").addEventListener("click", function() {
    storageCleanupCandidates = function() {
        syncAppStateFromRuntime();
        const l = StorageLimits.current(), c = [], now = Date.now(), protectedTodoIds = new Set, protectedReminderIds = new Set, protectedJournalIds = new Set, pushRecords = (id, category, label, records, apply) => {
            records.length && c.push({
                id: id,
                category: category,
                count: records.length,
                label: label,
                size: byteSize(records),
                apply: apply
            });
        }, oldDoneTodos = todos.filter(todo => {
            const completedAt = parseTimestamp(todo.completedAt || todo.createdAt);
            return todo.done && completedAt !== null && now - completedAt > 864e5 * RETENTION_RULES.todoDays;
        });
        oldDoneTodos.forEach(x => protectedTodoIds.add(x.id)), pushRecords("old-todos", "Wykonane TODO", `Wykonane TODO starsze niż ${RETENTION_RULES.todoDays} dni`, oldDoneTodos, () => {
            const ids = new Set(oldDoneTodos.map(x => x.id));
            replaceArrayContents(todos, todos.filter(x => !ids.has(x.id)));
        });
        const oldRem = calReminders.filter(reminder => {
            const completedAt = parseTimestamp(reminder.doneAt || reminder.createdAt) ?? reminderDateTime(reminder).getTime();
            return reminder.done && Number.isFinite(completedAt) && now - completedAt > 864e5 * RETENTION_RULES.reminderDays;
        });
        oldRem.forEach(x => protectedReminderIds.add(x.id)), pushRecords("old-reminders", "Przypomnienia", `Wykonane przypomnienia starsze niż ${RETENTION_RULES.reminderDays} dni`, oldRem, () => {
            const ids = new Set(oldRem.map(x => x.id));
            replaceArrayContents(calReminders, calReminders.filter(x => !ids.has(x.id)));
        });
        const journalExportedAt = parseTimestamp(getRetentionMeta().journalExportedAt), oldJournal = journal.filter(e => {
            const ts = parseTimestamp(e.createdAt);
            return null !== ts && now - ts > 864e5 * RETENTION_RULES.journalDays && null !== journalExportedAt && ts <= journalExportedAt;
        });
        oldJournal.forEach(x => protectedJournalIds.add(x.id)), oldJournal.length && pushRecords("old-journal", "Journal", `Wpisy journalu starsze niż ${RETENTION_RULES.journalDays} dni (wcześniej wyeksportowane)`, oldJournal, () => {
            const ids = new Set(oldJournal.map(x => x.id));
            replaceArrayContents(journal, journal.filter(x => !ids.has(x.id)));
        });
        const draftRaw = StorageService.get(DRAFT_KEY);
        if (draftRaw) {
            let draft = null;
            try {
                draft = JSON.parse(draftRaw);
            } catch (error) {
                UI_ERROR_REGISTRY.record("retention", "draft-parse", error, { key: DRAFT_KEY });
            }
            const ts = parseTimestamp(draft?.savedAt);
            null !== ts && now - ts > 864e5 * RETENTION_RULES.draftDays && c.push({
                id: "old-draft",
                category: "Draft e-mail",
                count: 1,
                label: `Draft starszy niż ${RETENTION_RULES.draftDays} dni`,
                size: byteSize(draftRaw),
                apply: clearDraft
            });
        }
        [ restorePointAgeCandidate(RESTORE_CURRENT_KEY, "current", now), restorePointAgeCandidate(RESTORE_PREVIOUS_GOOD_KEY, "previous-good", now) ].filter(Boolean).forEach(x => c.push(x));
        const addExcess = (id, category, arr, limit, protectedIds, applyByIds) => {
            const eligible = arr.filter(x => !protectedIds.has(x.id));
            if (eligible.length > limit) {
                const records = eligible.slice(limit), ids = new Set(records.map(x => x.id));
                c.push({
                    id: id,
                    category: category,
                    count: records.length,
                    label: `${category}: najstarsze rekordy ponad limit`,
                    size: byteSize(records),
                    apply: () => applyByIds(ids)
                });
            }
        };
        addExcess("todo-excess", "TODO ponad limit", todos, l.todoRecords, protectedTodoIds, ids => {
            replaceArrayContents(todos, todos.filter(x => !ids.has(x.id)));
        }), addExcess("journal-excess", "Journal ponad limit", journal, l.journalRecords, protectedJournalIds, ids => {
            replaceArrayContents(journal, journal.filter(x => !ids.has(x.id)));
        }), addExcess("notes-excess", "Notatki ponad limit", notes, l.notesRecords, new Set(notes.filter(x => x.pinned).map(x => x.id)), ids => {
            replaceArrayContents(notes, notes.filter(x => !ids.has(x.id)));
        }), addExcess("reminders-excess", "Przypomnienia ponad limit", calReminders, l.remindersRecords, protectedReminderIds, ids => {
            replaceArrayContents(calReminders, calReminders.filter(x => !ids.has(x.id)));
        }), pushRecords("blank-notes", "Puste notatki", "Puste notatki", notes.filter(n => !(n.text || "").trim()), () => {
            replaceArrayContents(notes, notes.filter(n => (n.text || "").trim()));
        });
        const tempKeys = StorageService.keys().filter(k => k.endsWith(".__tmp__"));
        return tempKeys.length && c.push({
            id: "temp-keys",
            category: "Pliki tymczasowe",
            count: tempKeys.length,
            label: "Osierocone zapisy tymczasowe",
            size: tempKeys.reduce((n, k) => n + byteSize(StorageService.get(k, "") || ""), 0),
            apply: () => tempKeys.forEach(k => StorageService.remove(k))
        }), c;
    }();
    const cleanupHost = $("#storageCleanupList");
    SafeDOM.replace(cleanupHost, [
        SafeDOM.el("pre", { className: "code-block", attrs: { id: "storageCleanupReport" }, style: { "white-space": "pre-wrap", "max-height": "none", margin: "0 0 12px" } }),
        ...(storageCleanupCandidates.length ? storageCleanupCandidates.map((candidate, index) => SafeDOM.el("label", { className: "cleanup-row" }, [
            SafeDOM.el("input", { checked: true, attrs: { type: "checkbox" }, dataset: { cleanupIndex: index } }),
            SafeDOM.el("span", {}, [SafeDOM.el("div", { className: "cleanup-title", text: `${candidate.label}: ${candidate.count}` }), SafeDOM.el("div", { className: "cleanup-sub", text: "Operacja dotyczy wyłącznie wskazanych danych; pozostałe moduły pozostaną bez zmian." })]),
            SafeDOM.el("span", { className: "cleanup-size", text: `~${formatBytes(candidate.size)}` })
        ])) : [SafeDOM.empty("cleanup-empty", "Nie znaleziono danych kwalifikujących się do bezpiecznego usunięcia.")])
    ]);
    $$("#storageCleanupList [data-cleanup-index]").forEach(el => el.addEventListener("change", renderCleanupReport)), 
    $("#storageCleanupApply").disabled = !storageCleanupCandidates.length, renderCleanupReport(), 
    showModal("storageCleanupModal");
}), $("#storageCleanupApply").addEventListener("click", async function() {
    const selected = selectedCleanupCandidates();
    if (!selected.length) return toast("Nie zaznaczono danych do usunięcia.", "err");
    const report = cleanupReportText(selected);
    await showConfirmModal(`${report}\n\nUsunąć zaznaczone dane? Tej operacji nie można cofnąć bez backupu.`, {
        confirmLabel: "Usuń dane"
    }) && (selected.forEach(c => c.apply()), saveTodos(todos), saveJournal(journal), 
    saveNotes(notes), saveCalendarReminders(), renderTodos(), renderJournal(), renderNotes(), 
    ModuleRegistry.get("calendarReminders")?.render(), requestFullSnapshot({
        immediate: !0
    }), closeModal(), renderStorageDashboard(), renderBackupList(), toast("Zastosowano politykę retencji i zwolniono miejsce."));
}), applyTheme(effectiveTheme());

const SIGNATURE_PRESETS = {
    SHORT: "—\nImię Nazwisko",
    LONG: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o.\nul. Przykładowa 1, 00-000 Warszawa\ntel. +48 000 000 000 · www.firma.pl",
    OFFICIAL: "Z poważaniem,\n\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o.\nul. Przykładowa 1, 00-000 Warszawa\ntel. +48 000 000 000 · www.firma.pl\n\nNiniejsza wiadomość może zawierać informacje poufne.\nJeśli otrzymali ją Państwo omyłkowo, proszę o jej skasowanie.",
    CASUAL: "Pozdrawiam,\nImię Nazwisko\ntel. +48 000 000 000"
};

function syncSignaturePresetState() {
    const current = EmailComposerState.read().signature;
    $$('[data-signature]').forEach(button => {
        const active = SIGNATURE_PRESETS[button.dataset.signature] === current;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}
$$('[data-signature]').forEach(button => {
    button.addEventListener('click', () => {
        const key = button.dataset.signature;
        if (!SIGNATURE_PRESETS[key]) return;
        EmailComposerState.update({ signature: SIGNATURE_PRESETS[key] });
        syncSignaturePresetState();
        $('#fSig').focus();
        toast('Wstawiono stopkę: ' + key);
    });
});
EventLifecycle.on(document, 'input', event => {
    if (event.target?.id === 'fSig') syncSignaturePresetState();
}, false, { owner: 'email-signature', key: 'sync-preset' });
SchedulerService.scheduleTimeout(syncSignaturePresetState, 0, { owner: 'email-signature', key: 'initial-state' });

