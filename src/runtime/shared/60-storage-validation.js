
function enforceTextBytes(text, maxBytes, label) {
    return byteSize(text) <= maxBytes || (toast(`${label} przekracza limit ${formatBytes(maxBytes)}.`, "err"), 
    !1);
}

function renderStorageDashboard() {
    const root = $("#storageSummary");
    if (!root) return;
    const info = function() {
        const usage = StorageService.usage(), limits = StorageService.limits();
        return {
            usage: usage,
            limits: limits,
            pct: usage.percent,
            status: usage.level === "warning" ? "warn" : usage.level
        };
    }(), sizes = function() {
        syncAppStateFromRuntime();
        const out = {};
        return MODULE_REGISTRY.forEach(m => out[m.id] = byteSize(ensureAppState().modules[m.id])), 
        out.draft = byteSize(StorageService.get(DRAFT_KEY, "") || ""), out.backups = [ RESTORE_CURRENT_KEY, RESTORE_PREVIOUS_GOOD_KEY ].reduce((sum, k) => sum + byteSize(StorageService.get(k, "") || ""), 0), 
        out;
    }();
    root.classList.remove("warn", "danger"), "ok" !== info.status && root.classList.add(info.status), 
    $("#storageTotal").textContent = `${formatBytes(info.usage.usedBytes)} zajęte`, $("#storageCaption").textContent = `${Math.min(999, info.pct).toFixed(1)}% z ${formatBytes(info.usage.budgetBytes)}`, 
    $("#storageBarFill").style.width = Math.min(100, info.pct) + "%";
    const labels = {
        email: "E-mail",
        templates: "Szablony",
        tiles: "Kafelki",
        frequentLinks: "Linki",
        todo: "TODO",
        journal: "Journal",
        calendarReminders: "Przypomnienia",
        notes: "Notatki",
        fx: "FX",
        snippets: "Snippety",
        preferences: "Preferencje",
        emailProfiles: "Profile e-mail",
        checklists: "Checklisty",
        responseCases: "Sprawy",
        phoneLog: "Telefony",
        procedures: "Procedury",
        userConfig: "Konfiguracja",
        draft: "Draft",
        backups: "Backupy"
    };
    SafeDOM.replace($("#storageModules"), Object.entries(sizes).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).flatMap(([key, value]) => [
        SafeDOM.el("span", { text: labels[key] || key }),
        SafeDOM.el("span", { className: "v", text: formatBytes(value) })
    ])), "function" == typeof renderDataConfidence && renderDataConfidence();
}

function renderStorageLimitForm(limits = StorageLimits.current()) {
    SafeDOM.replace($("#storageLimitGrid"), STORAGE_LIMIT_FIELDS.map(([key, label, factor, min, max]) => SafeDOM.el("div", { className: "storage-limit-field" }, [
        SafeDOM.el("label", { text: label, attrs: { for: `limit_${key}` } }),
        SafeDOM.el("input", { value: Math.round(limits[key] / factor), attrs: { id: `limit_${key}`, type: "number", min, max }, dataset: { limitKey: key, factor } })
    ])));
}

function applyStorageInputLimits() {
    const l = StorageLimits.current(), todo = $("#todoInput"), journalEl = $("#journalInput");
    todo && (todo.maxLength = l.todoTextChars), journalEl && (journalEl.maxLength = Math.max(1, Math.floor(l.journalEntryBytes / 2)));
}

const RETENTION_RULES = Object.freeze({
    draftDays: 14,
    reminderDays: 30,
    todoDays: 60,
    journalDays: 90,
    restorePointDays: 7
});

function getRetentionMeta() {
    const prefs = ensureAppState().modules.preferences;
    return prefs.retentionMeta && "object" == typeof prefs.retentionMeta || (prefs.retentionMeta = {
        journalExportedAt: null
    }), prefs.retentionMeta;
}


function restorePointAgeCandidate(key, label, now) {
    const read = StorageService.getJSON(key, null, {
        notify: !1
    });
    if (!read.exists) return null;
    if (!read.ok) return {
        id: `restore-corrupt-${label}`,
        category: "Punkt przywracania",
        count: 1,
        label: `Uszkodzony punkt ${label}`,
        size: byteSize(StorageService.get(key) || ""),
        apply: () => StorageService.remove(key)
    };
    const snap = read.value, ts = parseTimestamp(snap.createdAt || snap.exportedAt);
    return null !== ts && now - ts <= 864e5 * RETENTION_RULES.restorePointDays ? null : {
        id: `restore-old-${label}`,
        category: "Punkt przywracania",
        count: 1,
        label: `Punkt ${label} ${null === ts ? "bez znacznika czasu" : `starszy niż ${RETENTION_RULES.restorePointDays} dni`}`,
        size: byteSize(StorageService.get(key) || ""),
        apply: () => StorageService.remove(key)
    };
}

let storageCleanupCandidates = [];

function selectedCleanupCandidates() {
    return $$("#storageCleanupList [data-cleanup-index]:checked").map(el => storageCleanupCandidates[Number(el.dataset.cleanupIndex)]).filter(Boolean);
}

function cleanupReportText(selected = selectedCleanupCandidates()) {
    if (!selected.length) return "Do usunięcia:\n— nic nie zaznaczono —\n\nOdzyskane miejsce: około 0 B";
    const lines = selected.map(c => `${c.count} × ${c.category}`), total = selected.reduce((n, c) => n + (c.size || 0), 0);
    return `Do usunięcia:\n${lines.join("\n")}\n\nOdzyskane miejsce: około ${formatBytes(total)}`;
}

function renderCleanupReport() {
    const el = $("#storageCleanupReport");
    el && (el.textContent = cleanupReportText());
}

function normalizePreferences(raw) {
    const src = raw && "object" == typeof raw ? raw : {}, text = (v, max = 5e3) => String(v ?? "").trim().slice(0, max);
    return {
        theme: "string" == typeof src.theme ? src.theme : null,
        tileOrder: Array.isArray(src.tileOrder) ? cloneData(src.tileOrder).slice(0, 2e3) : [],
        tilePins: Array.isArray(src.tilePins) ? cloneData(src.tilePins).slice(0, 2e3) : [],
        storageLimits: StorageLimits.normalize(src.storageLimits),
        retentionMeta: {
            journalExportedAt: null === parseTimestamp(src.retentionMeta?.journalExportedAt) ? null : new Date(parseTimestamp(src.retentionMeta.journalExportedAt)).toISOString()
        },
        todoArchive: Array.isArray(src.todoArchive) ? cloneData(src.todoArchive).slice(0, 500) : [],
        recentActions: Array.isArray(src.recentActions) ? cloneData(src.recentActions).slice(0, 20) : [],
        recentEmailGroups: Array.isArray(src.recentEmailGroups) ? src.recentEmailGroups.map(v => ({
            id: text("string" == typeof v ? v : v?.id, 240),
            label: text("string" == typeof v ? v : v?.label, 160),
            at: Number(v?.at) || 0
        })).filter(v => v.id).slice(0, 5) : [],
        favoriteTemplates: Array.isArray(src.favoriteTemplates) ? src.favoriteTemplates.map(v => text(v, 120)).filter(Boolean).slice(0, 30) : []
    };
}

function stableBusinessId(value, prefix = "item") {
    return String(value || "").trim().slice(0, 120) || `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEmailProfilesModule(data) {
    return (Array.isArray(data) ? data : []).slice(0, 50).map(x => ({
        id: stableBusinessId(x?.id, "profile"),
        label: String(x?.label || "").trim().slice(0, 120),
        template: String(x?.template || "").trim().slice(0, 120),
        signature: String(x?.signature || "").slice(0, 5e3),
        to: String(x?.to || "").slice(0, 2e4),
        cc: String(x?.cc || "").slice(0, 2e4),
        bcc: String(x?.bcc || "").slice(0, 2e4),
        subject: String(x?.subject || "").slice(0, 5e3),
        body: String(x?.body || "").slice(0, 1e5),
        createdAt: Number.isFinite(Number(x?.createdAt)) ? Number(x.createdAt) : Date.now()
    })).filter(x => x.label);
}

function normalizeChecklistsModule(data) {
    return (Array.isArray(data) ? data : []).slice(0, 100).map(x => {
        const listId = stableBusinessId(x?.id, "check"), items = (Array.isArray(x?.items) ? x.items : []).map((v, index) => {
            const text = String(v && "object" == typeof v ? v.text : v || "").trim().slice(0, 500);
            return {
                id: stableBusinessId(v && "object" == typeof v ? v.id : null, `cli-${listId}-${index}`),
                text: text
            };
        }).filter(v => v.text).slice(0, 100), dailyEntries = Object.entries(x?.daily && "object" == typeof x.daily ? x.daily : {}).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v)).sort(([a], [b]) => a.localeCompare(b)).slice(-31).map(([k, v]) => [ k, [ ...new Set(v.map(value => "string" == typeof value ? value : items[Number(value)]?.id).filter(id => items.some(item => item.id === id))) ] ]);
        return {
            id: listId,
            name: String(x?.name || "").trim().slice(0, 160),
            items: items,
            daily: Object.fromEntries(dailyEntries)
        };
    }).filter(x => x.name && x.items.length);
}


function normalizeWorkflowLinks(value) {
    const source = value && typeof value === "object" ? value : {};
    const clean = list => [...new Set((Array.isArray(list) ? list : []).map(id => String(id || "").trim().slice(0, 120)).filter(Boolean))].slice(0, 50);
    return {
        cases: clean(source.cases),
        todos: clean(source.todos),
        reminders: clean(source.reminders),
        journal: clean(source.journal)
    };
}

function normalizeResponseCasesModule(data) {
    return (Array.isArray(data) ? data : []).slice(0, 1e3).map(x => ({
        id: stableBusinessId(x?.id, "case"),
        from: String(x?.from || "").trim().slice(0, 300),
        subject: String(x?.subject || "").trim().slice(0, 1e3),
        due: /^\d{4}-\d{2}-\d{2}$/.test(String(x?.due || "")) ? String(x.due) : "",
        status: [ "open", "waiting", "done", "cancelled" ].includes(x?.status) ? x.status : "open",
        createdAt: Number.isFinite(Number(x?.createdAt)) ? Number(x.createdAt) : Date.now(),
        updatedAt: Number.isFinite(Number(x?.updatedAt)) ? Number(x.updatedAt) : (Number.isFinite(Number(x?.createdAt)) ? Number(x.createdAt) : Date.now()),
        closedAt: x?.closedAt && Number.isFinite(Number(x.closedAt)) ? Number(x.closedAt) : null,
        source: x?.source && typeof x.source === "object" ? { module: String(x.source.module || "").slice(0, 40), id: String(x.source.id || "").slice(0, 120) } : null,
        links: normalizeWorkflowLinks(x?.links)
    })).filter(x => x.subject);
}

function normalizePhoneLogModule(data) {
    return (Array.isArray(data) ? data : []).slice(0, 500).map(record => {
        const contactName = String(record?.contactName || record?.who || "").trim().slice(0, 300);
        const phoneNumber = String(record?.phoneNumber || record?.phone || "").trim().slice(0, 60);
        return {
            id: stableBusinessId(record?.id, "phone"),
            phoneNumber,
            contactName,
            organization: String(record?.organization || "").trim().slice(0, 300),
            direction: [ "incoming", "outgoing", "missed" ].includes(record?.direction) ? record.direction : "outgoing",
            status: [ "completed", "callback", "noAnswer" ].includes(record?.status) ? record.status : "completed",
            durationSec: Math.min(86400, Math.max(0, Number(record?.durationSec) || 0)),
            callbackRequired: Boolean(record?.callbackRequired || record?.status === "callback"),
            note: String(record?.note || "").trim().slice(0, 5e3),
            at: Number.isFinite(Number(record?.at)) ? Number(record.at) : Date.now(),
            links: normalizeWorkflowLinks(record?.links)
        };
    }).filter(record => record.phoneNumber || record.contactName || record.note);
}

function normalizeProceduresModule(data) {
    return (Array.isArray(data) ? data : []).slice(0, 300).map(record => {
        const createdAt = Number.isFinite(Number(record?.createdAt)) ? Number(record.createdAt) : Date.now();
        return {
            id: stableBusinessId(record?.id, "proc"),
            title: String(record?.title || "").trim().slice(0, 200),
            body: String(record?.body || record?.text || "").trim().slice(0, 3e4),
            category: String(record?.category || "").trim().slice(0, 100),
            pinned: Boolean(record?.pinned),
            createdAt,
            updatedAt: Number.isFinite(Number(record?.updatedAt)) ? Number(record.updatedAt) : createdAt
        };
    }).filter(record => record.title && record.body);
}

function normalizeUserConfigModule(data) {
    const cfg = data && "object" == typeof data ? data : {};
    return {
        appName: String(cfg.appName || "WorkDesk").trim().slice(0, 80) || "WorkDesk",
        workStart: /^\d{2}:\d{2}$/.test(cfg.workStart) ? cfg.workStart : "08:00",
        workEnd: /^\d{2}:\d{2}$/.test(cfg.workEnd) ? cfg.workEnd : "16:00",
        pomodoro: Math.min(120, Math.max(5, Number(cfg.pomodoro) || 25)),
        defaultReminder: /^\d{2}:\d{2}$/.test(cfg.defaultReminder) ? cfg.defaultReminder : "09:00",
        vat: Math.min(100, Math.max(0, Number(cfg.vat) || 23))
    };
}

function normalizeFxState(raw) {
    const fx = {
        ...DEFAULT_FX,
        ...raw && "object" == typeof raw ? raw : {}
    };
    return [ "EUR", "USD", "GBP", "CHF" ].forEach(code => {
        const n = Number(fx[code]);
        fx[code] = Number.isFinite(n) && n > 0 ? n : DEFAULT_FX[code];
    }), fx.asOf = String(fx.asOf || "ręcznie ustawione"), fx;
}

const IMPORT_LIMITS = Object.freeze({
    id: 120,
    todoText: StorageLimits.DEFAULTS.todoTextChars,
    journalText: 5e3,
    reminderText: 2e3,
    noteText: 2e4,
    title: 180,
    name: 180,
    subject: 500,
    body: 5e4,
    footer: 2e4,
    description: 4e3,
    url: 4096,
    email: 320
}), ALLOWED_TILE_TYPES = Object.freeze([ "link", "copy" ]), ALLOWED_NOTE_COLORS = Object.freeze([ "amber", "mint", "blue", "rose", "slate" ]);

function validationResult(value) {
    return {
        valid: !0,
        value: cloneData(value),
        repaired: !1,
        errors: [],
        warnings: []
    };
}

function invalidResult(value, message) {
    const r = validationResult(value);
    return r.valid = !1, r.errors.push(message), r;
}

function cleanString(value, max, required = !1) {
    if ("string" != typeof value) return {
        valid: !1,
        value: "",
        repaired: !1,
        error: "wartość nie jest tekstem"
    };
    const trimmed = value.trim();
    if (required && !trimmed) return {
        valid: !1,
        value: "",
        repaired: trimmed !== value,
        error: "wymagana wartość jest pusta"
    };
    const next = trimmed.slice(0, max);
    return {
        valid: !0,
        value: next,
        repaired: next !== value,
        warning: value.length > max ? `skrócono do ${max} znaków` : null
    };
}


function droppedFieldsWarning(value, knownFields) {
    const dropped = Object.keys(value || {}).filter(key => !knownFields.includes(key));
    return dropped.length ? `usunięto nieznane pola: ${dropped.join(", ")}` : null;
}



function createImportId(prefix, seed) {
    let h = 2166136261;
    const text = String(seed || "");
    for (let i = 0; i < text.length; i++) h ^= text.charCodeAt(i), h = Math.imul(h, 16777619);
    return `${prefix}_${Date.now().toString(36)}_${(h >>> 0).toString(36)}`.slice(0, IMPORT_LIMITS.id);
}

function validateUrl(value, opts = {}) {
    const r = validationResult(value), c = cleanString(value, IMPORT_LIMITS.url, !!opts.required);
    if (!c.valid) return invalidResult(value, c.error);
    if (r.value = c.value, r.repaired = c.repaired, c.warning && r.warnings.push(c.warning), 
    !r.value && !opts.required) return r;
    try {
        const url = new URL(r.value, location.href);
        if (!(opts.allowedProtocols || [ "http:", "https:", "mailto:", "file:", "microsoft-edge:" ]).includes(url.protocol)) return invalidResult(value, `niedozwolony protokół URL: ${url.protocol}`);
    } catch {
        return invalidResult(value, "niepoprawny URL");
    }
    return r;
}

function validateKnownMail(value) {
    const r = validationResult(value), c = cleanString(value, IMPORT_LIMITS.email, !0);
    if (!c.valid) return invalidResult(value, c.error);
    const email = c.value.toLowerCase();
    return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) ? (r.value = email, r.repaired = c.repaired || email !== value, 
    c.warning && r.warnings.push(c.warning), r) : invalidResult(value, "niepoprawny adres e-mail");
}

const TODO_KNOWN_FIELDS = Object.freeze([ "id", "text", "done", "archived", "priority", "dueDate", "createdAt", "updatedAt", "completedAt" ]);

function validateTodoItem(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "rekord TODO musi być obiektem");
    const r = validationResult({}), text = cleanString(value.text, IMPORT_LIMITS.todoText, !0);
    if (!text.valid) return invalidResult(value, `TODO.text: ${text.error}`);
    r.value.text = text.value, r.repaired |= text.repaired, text.warning && r.warnings.push(text.warning);
    const dropped = droppedFieldsWarning(value, TODO_KNOWN_FIELDS);
    dropped && (r.repaired = !0, r.warnings.push(dropped));
    r.value.done = !!value.done, "boolean" != typeof value.done && (r.repaired = !0,
    r.warnings.push("naprawiono pole done"));
    r.value.archived = !!value.archived;
    r.value.priority = [ "low", "normal", "high" ].includes(value.priority) ? value.priority : "normal";
    void 0 !== value.priority && r.value.priority !== value.priority && (r.repaired = !0, r.warnings.push("naprawiono priorytet"));
    r.value.dueDate = validDateISO(value.dueDate) ? value.dueDate : "", value.dueDate && !r.value.dueDate && (r.repaired = !0,
    r.warnings.push("naprawiono termin"));
    const created = normalizeTimestamp(value.createdAt);
    null === created ? (r.value.createdAt = Date.now(), r.repaired = !0, r.warnings.push("naprawiono createdAt")) : r.value.createdAt = created;
    const updated = normalizeTimestamp(value.updatedAt);
    r.value.updatedAt = null !== updated ? updated : r.value.createdAt;
    r.value.completedAt = normalizeTimestamp(value.completedAt);
    if ("string" == typeof value.id && value.id.trim() && value.id.length <= IMPORT_LIMITS.id) r.value.id = value.id; else r.value.id = createImportId("todo", text.value + r.value.createdAt),
    r.repaired = !0, r.warnings.push("nadano poprawne ID");
    return r;
}

const JOURNAL_KNOWN_FIELDS = Object.freeze([ "id", "text", "type", "createdAt" ]);

function validateJournalEntry(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "wpis journalu musi być obiektem");
    const r = validationResult({}), text = cleanString(value.text, IMPORT_LIMITS.journalText, !0);
    if (!text.valid) return invalidResult(value, `journal.text: ${text.error}`);
    r.value.text = text.value, r.repaired |= text.repaired, text.warning && r.warnings.push(text.warning);
    const dropped = droppedFieldsWarning(value, JOURNAL_KNOWN_FIELDS);
    dropped && (r.repaired = !0, r.warnings.push(dropped));
    const type = cleanString(value.type, 32, !1);
    r.value.type = type.value || "info", type.value !== (value.type || "") && (r.repaired = !0, r.warnings.push("naprawiono typ wpisu"));
    const created = normalizeTimestamp(value.createdAt);
    null === created ? (r.value.createdAt = Date.now(), r.repaired = !0, r.warnings.push("naprawiono createdAt")) : r.value.createdAt = created;
    if ("string" == typeof value.id && value.id.trim() && value.id.length <= IMPORT_LIMITS.id) r.value.id = value.id; else r.value.id = createImportId("journal", text.value + r.value.createdAt),
    r.repaired = !0, r.warnings.push("nadano poprawne ID");
    return r;
}

const REMINDER_KNOWN_FIELDS = Object.freeze([ "id", "text", "date", "time", "done", "doneAt", "createdAt", "lastNotifiedAt", "snoozedUntil" ]);

function validateReminder(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "przypomnienie musi być obiektem");
    const r = validationResult({}), text = cleanString(value.text, IMPORT_LIMITS.reminderText, !0);
    if (!text.valid) return invalidResult(value, `reminder.text: ${text.error}`);
    if (!validDateISO(value.date)) return invalidResult(value, "reminder.date ma niepoprawny format lub datę");
    r.value.text = text.value, r.repaired |= text.repaired, text.warning && r.warnings.push(text.warning);
    const dropped = droppedFieldsWarning(value, REMINDER_KNOWN_FIELDS);
    dropped && (r.repaired = !0, r.warnings.push(dropped));
    r.value.date = value.date;
    r.value.time = validTime(value.time) ? value.time : "09:00", validTime(value.time) || (r.repaired = !0,
    r.warnings.push("naprawiono godzinę na 09:00"));
    r.value.done = !!value.done, "boolean" != typeof value.done && (r.repaired = !0,
    r.warnings.push("naprawiono pole done"));
    r.value.doneAt = normalizeTimestamp(value.doneAt);
    [ "createdAt", "lastNotifiedAt", "snoozedUntil" ].forEach(k => {
        const ts = normalizeTimestamp(value[k]);
        null === ts ? (r.value[k] = "createdAt" === k ? Date.now() : 0, r.repaired = !0,
        r.warnings.push(`naprawiono ${k}`)) : r.value[k] = ts;
    });
    if ("string" == typeof value.id && value.id.trim() && value.id.length <= IMPORT_LIMITS.id) r.value.id = value.id; else r.value.id = createImportId("rem", value.date + value.time + text.value),
    r.repaired = !0, r.warnings.push("nadano poprawne ID");
    return r;
}

const NOTE_KNOWN_FIELDS = Object.freeze([ "id", "title", "text", "color", "pinned", "createdAt", "updatedAt" ]);

function validateNote(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "notatka musi być obiektem");
    const r = validationResult({}), text = cleanString(value.text, IMPORT_LIMITS.noteText, !1);
    if (!text.valid) return invalidResult(value, `note.text: ${text.error}`);
    r.value.text = text.value, r.repaired |= text.repaired, text.warning && r.warnings.push(text.warning);
    const dropped = droppedFieldsWarning(value, NOTE_KNOWN_FIELDS);
    dropped && (r.repaired = !0, r.warnings.push(dropped));
    const title = cleanString(value.title, 100, !1);
    r.value.title = title.value;
    ALLOWED_NOTE_COLORS.includes(value.color) || (r.value.color = "amber", r.repaired = !0,
    r.warnings.push("naprawiono kolor notatki")), ALLOWED_NOTE_COLORS.includes(value.color) && (r.value.color = value.color);
    r.value.pinned = !!value.pinned;
    const created = normalizeTimestamp(value.createdAt);
    null === created ? (r.value.createdAt = Date.now(), r.repaired = !0, r.warnings.push("naprawiono createdAt")) : r.value.createdAt = created;
    const updated = normalizeTimestamp(value.updatedAt);
    r.value.updatedAt = null !== updated ? updated : r.value.createdAt;
    if ("string" == typeof value.id && value.id.trim() && value.id.length <= IMPORT_LIMITS.id) r.value.id = value.id; else r.value.id = createImportId("note", (title.value || text.value) + r.value.createdAt),
    r.repaired = !0, r.warnings.push("nadano poprawne ID");
    return r;
}

function validateTile(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "kafelek musi być obiektem");
    const r = validationResult(value), title = cleanString(value.title, IMPORT_LIMITS.title, !0);
    if (!title.valid) return invalidResult(value, `tile.title: ${title.error}`);
    if (r.value.title = title.value, r.repaired |= title.repaired, !ALLOWED_TILE_TYPES.includes(value.type)) return invalidResult(value, "tile.type musi mieć wartość link albo copy");
    if ("link" === value.type) {
        const u = validateUrl(value.url, {
            required: !0
        });
        if (!u.valid) return invalidResult(value, `tile.url: ${u.errors.join(", ")}`);
        r.value.url = u.value, r.repaired |= u.repaired, r.warnings.push(...u.warnings);
    } else {
        const v = cleanString(value.value, IMPORT_LIMITS.body, !0);
        if (!v.valid) return invalidResult(value, `tile.value: ${v.error}`);
        r.value.value = v.value, r.repaired |= v.repaired;
    }
    if (null != value.desc) {
        const d = cleanString(String(value.desc), IMPORT_LIMITS.description, !1);
        r.value.desc = d.value, r.repaired |= d.repaired;
    }
    return null == value.tags || Array.isArray(value.tags) || (r.value.tags = [], r.repaired = !0, 
    r.warnings.push("naprawiono tags")), null != value.ie && "boolean" != typeof value.ie && (r.value.ie = !!value.ie, 
    r.repaired = !0), r;
}

function validateTemplate(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "szablon musi być obiektem");
    const r = validationResult(value), name = cleanString(value.name, IMPORT_LIMITS.name, !0);
    if (!name.valid) return invalidResult(value, `template.name: ${name.error}`);
    r.value.name = name.value, r.repaired |= name.repaired;
    for (const k of [ "to", "cc", "bcc" ]) {
        if (null == value[k]) {
            r.value[k] = "", r.repaired = !0;
            continue;
        }
        if ("string" != typeof value[k]) return invalidResult(value, `template.${k} musi być tekstem`);
        const addresses = value[k].split(/[;,]/).map(x => x.trim()).filter(Boolean);
        for (const address of addresses) if (!validateKnownMail(address).valid) return invalidResult(value, `template.${k}: ${address} jest niepoprawny`);
        const next = addresses.join(", ");
        next !== value[k] && (r.value[k] = next, r.repaired = !0);
    }
    for (const [k, max] of [ [ "subject", IMPORT_LIMITS.subject ], [ "body", IMPORT_LIMITS.body ], [ "footer", IMPORT_LIMITS.footer ] ]) {
        const c = cleanString(value[k] ?? "", max, !1);
        if (!c.valid) return invalidResult(value, `template.${k}: ${c.error}`);
        r.value[k] = c.value, r.repaired |= c.repaired;
    }
    return r;
}

function validateGroup(value) {
    if (!value || "object" != typeof value || Array.isArray(value)) return invalidResult(value, "grupa musi być obiektem");
    const r = validationResult(value), name = cleanString(value.name, IMPORT_LIMITS.name, !0);
    if (!name.valid) return invalidResult(value, `group.name: ${name.error}`);
    if (!Array.isArray(value.emails)) return invalidResult(value, "group.emails musi być tablicą");
    r.value.name = name.value, r.repaired |= name.repaired, r.value.emails = [];
    const seen = new Set;
    return value.emails.forEach((mail, i) => {
        const m = validateKnownMail(mail);
        return m.valid ? seen.has(m.value) ? (r.warnings.push(`usunięto duplikat ${m.value}`), 
        void (r.repaired = !0)) : (seen.add(m.value), r.value.emails.push(m.value), void (r.repaired |= m.repaired)) : (r.warnings.push(`pominięto błędny email #${i + 1}`), 
        void (r.repaired = !0));
    }), r.value.emails.length || r.warnings.push("grupa nie zawiera poprawnych adresów"), 
    r;
}

function validateRecordList(moduleId, list, validator, duplicateKey) {
    const report = {
        accepted: [],
        rejected: [],
        repaired: [],
        warnings: []
    }, output = [];
    if (!Array.isArray(list)) return report.rejected.push({
        module: moduleId,
        index: null,
        reason: "moduł musi być tablicą"
    }), {
        data: [],
        report: report
    };
    const seen = new Set;
    return list.forEach((item, index) => {
        const result = validator(item, index);
        if (!result.valid) return void report.rejected.push({
            module: moduleId,
            index: index,
            reason: result.errors.join("; "),
            record: cloneData(item)
        });
        const key = duplicateKey ? duplicateKey(result.value) : result.value?.id;
        if (null != key && seen.has(String(key).toLowerCase())) return void report.rejected.push({
            module: moduleId,
            index: index,
            reason: `duplikat: ${key}`,
            record: cloneData(item)
        });
        null != key && seen.add(String(key).toLowerCase()), output.push(result.value);
        const entry = {
            module: moduleId,
            index: index,
            id: result.value?.id || null,
            key: key || null
        };
        result.repaired ? report.repaired.push({
            ...entry,
            warnings: result.warnings
        }) : report.accepted.push(entry), result.warnings.forEach(w => report.warnings.push({
            module: moduleId,
            index: index,
            message: w
        }));
    }), {
        data: output,
        report: report
    };
}

function mergeValidationReport(target, source) {
    return [ "accepted", "rejected", "repaired", "warnings" ].forEach(k => target[k].push(...source[k])), 
    target;
}

function sanitizeImportData(data) {
    const next = cloneData(data), report = {
        accepted: [],
        rejected: [],
        repaired: [],
        warnings: []
    }, mods = next.modules || {}, map = {
        todo: [ validateTodoItem, x => x.id ],
        journal: [ validateJournalEntry, x => x.id ],
        calendarReminders: [ validateReminder, x => x.id ],
        notes: [ validateNote, x => x.id ],
        templates: [ validateTemplate, x => x.name ],
        tiles: [ validateTile, x => x.title ]
    };
    if (Object.entries(map).forEach(([id, [validator, key]]) => {
        if (!Object.prototype.hasOwnProperty.call(mods, id)) return;
        const checked = validateRecordList(id, mods[id], validator, key);
        mods[id] = checked.data, mergeValidationReport(report, checked.report);
    }), mods.email && "object" == typeof mods.email) {
        const known = validateRecordList("email.knownMails", mods.email.knownMails, validateKnownMail, x => x);
        mods.email.knownMails = known.data, mergeValidationReport(report, known.report);
        const sections = [], sectionNames = new Set;
        (Array.isArray(mods.email.sections) ? mods.email.sections : []).forEach((section, si) => {
            if (!section || "object" != typeof section || Array.isArray(section)) return void report.rejected.push({
                module: "email.sections",
                index: si,
                reason: "sekcja musi być obiektem"
            });
            const name = cleanString(section.name, IMPORT_LIMITS.name, !0);
            if (!name.valid) return void report.rejected.push({
                module: "email.sections",
                index: si,
                reason: `section.name: ${name.error}`
            });
            const nk = name.value.toLowerCase();
            if (sectionNames.has(nk)) return void report.rejected.push({
                module: "email.sections",
                index: si,
                reason: `duplikat sekcji: ${name.value}`
            });
            sectionNames.add(nk);
            const groups = validateRecordList(`email.sections[${si}].groups`, section.groups, validateGroup, x => x.name);
            mergeValidationReport(report, groups.report), sections.push({
                ...section,
                name: name.value,
                groups: groups.data
            });
            const entry = {
                module: "email.sections",
                index: si,
                key: name.value
            };
            name.repaired ? report.repaired.push(entry) : report.accepted.push(entry);
        }), mods.email.sections = sections;
    }
    if (Array.isArray(mods.frequentLinks)) {
        const checked = validateRecordList("frequentLinks", mods.frequentLinks, item => {
            if (!item || "object" != typeof item || Array.isArray(item)) return invalidResult(item, "link musi być obiektem");
            const r = validationResult(item), title = cleanString(item.title, IMPORT_LIMITS.title, !0), url = validateUrl(item.url, {
                required: !0
            });
            if (!title.valid) return invalidResult(item, `title: ${title.error}`);
            if (!url.valid) return invalidResult(item, `url: ${url.errors.join("; ")}`);
            if (r.value.title = title.value, r.value.url = url.value, r.repaired = title.repaired || url.repaired, 
            null != item.note) {
                const n = cleanString(String(item.note), IMPORT_LIMITS.description, !1);
                r.value.note = n.value, r.repaired |= n.repaired;
            }
            return r;
        }, x => x.title);
        mods.frequentLinks = checked.data, mergeValidationReport(report, checked.report);
    }
    return {
        data: next,
        report: report
    };
}

function validateUniqueBusinessRecords(data, label, validateOne) {
    if (!Array.isArray(data)) return [ `${label} musi być tablicą.` ];
    const errors = [], ids = new Set;
    return data.forEach((item, index) => {
        (validateOne(item, index) || []).forEach(e => errors.push(`[${index}] ${e}`));
        const id = String(item?.id || "").trim();
        id ? ids.has(id) ? errors.push(`[${index}] zduplikowane ID: ${id}`) : ids.add(id) : errors.push(`[${index}] brak ID.`);
    }), errors;
}

const UI_ERROR_REGISTRY = (() => {
    const rows = [];
    return Object.freeze({
        record: function(scope, name, error, extra = {}) {
            const item = {
                at: (new Date).toISOString(),
                scope: String(scope || "ui"),
                name: String(name || "unknown"),
                message: String(error?.message || error || "Nieznany błąd"),
                stack: String(error?.stack || ""),
                extra: cloneData(extra)
            };
            rows.unshift(item), rows.splice(100);
            try {
                StorageService.recordDiagnostic(scope, name, error instanceof Error ? error : new Error(item.message), extra);
            } catch {}
            return console.error(`[${item.scope}:${item.name}]`, error, extra), 
            item;
        },
        list: () => cloneData(rows),
        clear: () => {
            rows.length = 0;
        }
    });
})();

function safeAction(name, fn, {fallback: fallback = null, rethrow: rethrow = !1, context: context = {}} = {}) {
    if ("function" != typeof fn) {
        const error = new TypeError(`Brak wymaganej akcji: ${name}`);
        if (UI_ERROR_REGISTRY.record("contract", name, error, context), rethrow) throw error;
        return fallback;
    }
    try {
        return fn();
    } catch (error) {
        if (UI_ERROR_REGISTRY.record("action", name, error, context), rethrow) throw error;
        return fallback;
    }
}
