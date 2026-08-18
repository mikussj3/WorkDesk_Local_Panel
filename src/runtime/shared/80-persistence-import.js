
const DATA_SCHEMA_KEYS = Object.freeze(Object.keys(MODULE_BY_ID)), DATA_META_KEYS = Object.freeze([ "appName", "appVersion", "schemaVersion", "buildInfo", "exportedAt", "createdAt", "migratedFrom", "migratedAt", "modules", "partial", "moduleIds", "checksum", "checksumAlgorithm" ]);

function ensureAppState() {
    return appState || (appState = {
        appVersion: APP_VERSION,
        schemaVersion: DATA_SCHEMA_VERSION,
        exportedAt: (new Date).toISOString(),
        partial: !1,
        moduleIds: [ ...DATA_SCHEMA_KEYS ],
        modules: {}
    }, MODULE_REGISTRY.forEach(mod => {
        appState.modules[mod.id] = cloneData(mod.defaultData());
    })), appState;
}

function syncAppStateFromRuntime() {
    const state = ensureAppState();
    state.appVersion = APP_VERSION;
    state.schemaVersion = DATA_SCHEMA_VERSION;
    state.exportedAt = new Date().toISOString();
    state.partial = false;
    state.moduleIds = [...DATA_SCHEMA_KEYS];

    const preferences = normalizePreferences(state.modules.preferences);
    preferences.tileOrder = cloneData(preferences.tileOrder);
    preferences.tilePins = typeof pinnedTiles === "undefined"
        ? preferences.tilePins
        : [...pinnedTiles];
    state.modules.preferences = preferences;
    return state;
}

function getModuleIds(moduleIds) {
    return moduleIds ? (Array.isArray(moduleIds) ? moduleIds : [ moduleIds ]).filter(id => MODULE_BY_ID[id]) : DATA_SCHEMA_KEYS;
}

function defaultDataV3(moduleIds) {
    const snap = function(moduleIds) {
        const ids = getModuleIds(moduleIds), snap = {
            appName: APP_NAME,
            appVersion: APP_VERSION,
            schemaVersion: SCHEMA_VERSION,
            buildInfo: cloneData(BUILD_INFO),
            exportedAt: (new Date).toISOString(),
            partial: ids.length !== DATA_SCHEMA_KEYS.length,
            moduleIds: ids,
            modules: {}
        };
        return ids.forEach(id => {
            snap.modules[id] = cloneData(MODULE_BY_ID[id].defaultData());
        }), snap;
    }(moduleIds);
    return getModuleIds(moduleIds).forEach(id => {
        snap.modules[id] = cloneData(MODULE_BY_ID[id].defaultData());
    }), snap;
}

function exportAppData(moduleIds) {
    syncAppStateFromRuntime();
    const ids = getModuleIds(moduleIds), snap = {
        appName: APP_NAME,
        appVersion: APP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        buildInfo: cloneData(BUILD_INFO),
        exportedAt: (new Date).toISOString(),
        partial: ids.length !== DATA_SCHEMA_KEYS.length,
        moduleIds: ids,
        modules: {}
    };
    return ids.forEach(id => {
        const mod = MODULE_BY_ID[id], exported = mod.export();
        snap.modules[id] = cloneData(void 0 === exported ? mod.defaultData() : exported);
    }), snap;
}

function normalizeCurrentData(raw, opts = {}) {
    const src = raw && "object" == typeof raw ? raw : {}, sourceModules = src.modules && "object" == typeof src.modules ? src.modules : function(raw) {
        const src = raw && "object" == typeof raw ? raw : {};
        return {
            email: {
                sections: src.sections,
                knownMails: src.knownMails
            },
            templates: src.templates,
            tiles: src.tiles,
            frequentLinks: src.frequentLinks,
            todo: src.todos,
            journal: src.journal,
            calendarReminders: src.reminders,
            notes: src.notes,
            fx: src.fx,
            snippets: src.snippets,
            preferences: src.preferences
        };
    }(src), inferredIds = Array.isArray(src.moduleIds) && src.partial ? src.moduleIds : DATA_SCHEMA_KEYS, ids = getModuleIds(opts.moduleIds || inferredIds), data = {
        appVersion: "string" == typeof src.appVersion ? src.appVersion : APP_VERSION,
        schemaVersion: DATA_SCHEMA_VERSION,
        exportedAt: src.exportedAt || (new Date).toISOString(),
        partial: ids.length !== DATA_SCHEMA_KEYS.length,
        moduleIds: ids,
        modules: {}
    };
    return ids.forEach(id => {
        const mod = MODULE_BY_ID[id], migratedBusinessPreferenceKeys = {
            emailProfiles: "emailProfiles",
            checklists: "checklists",
            responseCases: "responseCases",
            phoneLog: "phoneLog",
            procedures: "procedures",
            userConfig: "userConfig"
        }, rawModuleData = Object.prototype.hasOwnProperty.call(sourceModules, id) ? sourceModules[id] : migratedBusinessPreferenceKeys[id] && sourceModules.preferences && Object.prototype.hasOwnProperty.call(sourceModules.preferences, migratedBusinessPreferenceKeys[id]) ? sourceModules.preferences[migratedBusinessPreferenceKeys[id]] : mod.defaultData();
        data.modules[id] = cloneData(mod.migrate(rawModuleData, Number(src.schemaVersion || 1)));
    }), data;
}

function migrateData(raw) {
    if (!raw || "object" != typeof raw) return null;
    const migrated = normalizeCurrentData(raw);
    return Number(raw.schemaVersion) !== DATA_SCHEMA_VERSION && (migrated.migratedFrom = raw.schemaVersion || 1, 
    migrated.migratedAt = (new Date).toISOString()), migrated;
}

function validateCurrentData(data) {
    const errors = [], warnings = [];
    if (!data || "object" != typeof data) return {
        valid: !1,
        errors: [ "Dane nie są obiektem JSON." ],
        warnings: warnings
    };
    data.modules && "object" == typeof data.modules || errors.push("Brak obiektu modules.");
    const ids = getModuleIds(data.moduleIds || Object.keys(data.modules || {}));
    ids.length || errors.push("Brak znanych modułów w danych."), ids.forEach(id => {
        const mod = MODULE_BY_ID[id];
        Object.prototype.hasOwnProperty.call(data.modules || {}, id) ? mod.validate(data.modules[id]).forEach(err => errors.push(`${id}: ${err}`)) : errors.push(`Brak modułu: ${id}`);
    }), Object.keys(data.modules || {}).forEach(id => {
        MODULE_BY_ID[id] || warnings.push(`Nieznany moduł pominięty przy imporcie: ${id}`);
    }), Object.keys(data).forEach(k => {
        DATA_META_KEYS.includes(k) || warnings.push(`Nieznane pole główne pominięte przy imporcie: ${k}`);
    });
    const moduleValidation = validateImportedModules(data);
    return {
        valid: 0 === errors.length && moduleValidation.valid,
        errors: [ ...errors, ...moduleValidation.errors ],
        warnings: warnings,
        moduleValidation: moduleValidation.modules
    };
}

function applyAppData(data) {
    storageLoadBlocked = !1;
    const next = normalizeCurrentData(data);
    if (next.partial && appState) {
        const merged = cloneData(ensureAppState());
        getModuleIds(next.moduleIds).forEach(id => {
            merged.modules[id] = cloneData(next.modules[id]);
        }), appState = normalizeCurrentData(merged);
    } else appState = normalizeCurrentData(next);
    getModuleIds(next.moduleIds).forEach(id => MODULE_BY_ID[id].import(appState.modules[id])),
    persistData(!0);
    try {
        BusinessWorkflow?.reconcileAll({ persist: !0 });
    } catch {}
}

function refreshDataBadge() {
    const el = $("#dataState");
    StorageService.get(DATA_KEY) ? (el.textContent = "edytowane", el.classList.add("dirty")) : (el.textContent = "domyślne", 
    el.classList.remove("dirty"));
}

function persistData(immediate = !1) {
    return immediate ? (WriteQueue.cancel("full-snapshot"), commitFullSnapshotNow()) : (requestFullSnapshot(), 
    !0);
}

function rerenderAllFromData(moduleIds) {
    getModuleIds(moduleIds).forEach(id => safeRender(id)), refreshDataBadge();
}

function buildImportReport(next) {
    const current = exportAppData(next.moduleIds), rows = getModuleIds(next.moduleIds).map(id => {
        const mod = MODULE_BY_ID[id], a = JSON.stringify(current.modules[id] ?? null), b = JSON.stringify(next.modules[id] ?? null);
        return `${a === b ? "=" : "~"} ${mod.label} [${id}]: ${a === b ? "bez zmian" : "zmiana"}`;
    });
    return next.partial && rows.unshift("Import częściowy: zmienione zostaną tylko wymienione moduły."), 
    next.migratedFrom && rows.unshift(`Migracja: v${next.migratedFrom} -> v${DATA_SCHEMA_VERSION}`), 
    rows.join("\n");
}

const RESTORE_CURRENT_KEY = "wd.restore.current", RESTORE_PREVIOUS_GOOD_KEY = "wd.restore.previous-good";

function checksumPayload(snapshot) {
    return JSON.stringify({
        schemaVersion: Number(snapshot.schemaVersion || 0),
        partial: !!snapshot.partial,
        moduleIds: getModuleIds(snapshot.moduleIds),
        modules: snapshot.modules || {}
    });
}

function sha256Fallback(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text))), words = [], bitLength = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 4294967296), low = bitLength >>> 0;
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push(high >>> shift & 255);
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push(low >>> shift & 255);
    for (let index = 0; index < bytes.length; index += 4) words.push(bytes[index] << 24 | bytes[index + 1] << 16 | bytes[index + 2] << 8 | bytes[index + 3]);
    const constants = [];
    let candidate = 2;
    while (constants.length < 64) {
        let prime = true;
        for (let divisor = 2; divisor * divisor <= candidate; divisor++) if (candidate % divisor === 0) { prime = false; break; }
        if (prime) constants.push(Math.floor((Math.cbrt(candidate) % 1) * 4294967296) >>> 0);
        candidate++;
    }
    let hash = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
    const rotate = (value, bits) => value >>> bits | value << 32 - bits;
    for (let offset = 0; offset < words.length; offset += 16) {
        const schedule = words.slice(offset, offset + 16);
        for (let index = 16; index < 64; index++) {
            const a = schedule[index - 15], b = schedule[index - 2], s0 = rotate(a, 7) ^ rotate(a, 18) ^ a >>> 3, s1 = rotate(b, 17) ^ rotate(b, 19) ^ b >>> 10;
            schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = hash;
        for (let index = 0; index < 64; index++) {
            const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25), choice = e & f ^ ~e & g, temp1 = (h + s1 + choice + constants[index] + schedule[index]) >>> 0, s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22), majority = a & b ^ a & c ^ b & c, temp2 = (s0 + majority) >>> 0;
            h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        hash = [a, b, c, d, e, f, g, h].map((value, index) => (value + hash[index]) >>> 0);
    }
    return hash.map(value => value.toString(16).padStart(8, "0")).join("");
}

async function sha256Hex(text) {
    if (globalThis.crypto?.subtle) {
        try {
            const bytes = (new TextEncoder).encode(text), digest = await crypto.subtle.digest("SHA-256", bytes);
            return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        } catch (error) {
            UI_ERROR_REGISTRY.record("persistence", "sha256-webcrypto", error, { fallback: "javascript" });
        }
    }
    return sha256Fallback(text);
}

async function attachChecksum(snapshot) {
    const copy = cloneData(snapshot);
    return copy.checksumAlgorithm = "SHA-256", copy.checksum = await sha256Hex(checksumPayload(copy)), 
    copy.checksum || (copy.checksumAlgorithm = "unavailable", copy.checksum = null), 
    copy;
}

async function verifySnapshotChecksum(snapshot) {
    if (!snapshot?.checksum) return {
        ok: null,
        message: "Plik nie zawiera sumy kontrolnej."
    };
    if ("SHA-256" !== snapshot.checksumAlgorithm) return {
        ok: !1,
        message: "Nieobsługiwany algorytm sumy kontrolnej."
    };
    const actual = await sha256Hex(checksumPayload(snapshot));
    return actual ? actual === snapshot.checksum ? {
        ok: !0,
        message: "Suma kontrolna poprawna."
    } : {
        ok: !1,
        message: "Suma kontrolna nie zgadza się — plik może być uszkodzony lub zmieniony."
    } : {
        ok: null,
        message: "Przeglądarka nie obsługuje weryfikacji SHA-256."
    };
}


async function buildExportArtifact(moduleIds) {
    flushPendingWrites();
    return attachChecksum(exportAppData(moduleIds));
}

async function prepareImportArtifact(raw) {
    const checksum = await verifySnapshotChecksum(raw);
    if (checksum.ok === false) throw Object.assign(new Error(checksum.message), { stage: "checksum" });
    const normalized = normalizeCurrentData(raw);
    if (!normalized) throw Object.assign(new Error("Nie udało się znormalizować danych."), { stage: "normalize" });
    const migrated = migrateData(raw);
    if (!migrated) throw Object.assign(new Error("Nie udało się zmigrować danych."), { stage: "migrate" });
    const sanitized = sanitizeImportData(migrated);
    const validation = validateCurrentData(sanitized.data);
    return Object.freeze({ raw, checksum, normalized, migrated, sanitized, validation });
}

function semanticCanonical(value) {
    if (Array.isArray(value)) return value.map(semanticCanonical);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, semanticCanonical(value[key])]));
}

function semanticCompare(expected, actual, path = "$") {
    const differences = [];
    const walk = (left, right, currentPath) => {
        if (Object.is(left, right)) return;
        if (Array.isArray(left) || Array.isArray(right)) {
            if (!Array.isArray(left) || !Array.isArray(right)) return void differences.push(`${currentPath}: różny typ`);
            if (left.length !== right.length) differences.push(`${currentPath}: długość ${left.length} != ${right.length}`);
            const length = Math.min(left.length, right.length);
            for (let index = 0; index < length && differences.length < 100; index++) walk(left[index], right[index], `${currentPath}[${index}]`);
            return;
        }
        if (left && right && typeof left === "object" && typeof right === "object") {
            const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
            const allKeys = [...new Set([...leftKeys, ...rightKeys])].sort();
            for (const key of allKeys) {
                if (!(key in left)) differences.push(`${currentPath}.${key}: brak po lewej`);
                else if (!(key in right)) differences.push(`${currentPath}.${key}: brak po prawej`);
                else walk(left[key], right[key], `${currentPath}.${key}`);
                if (differences.length >= 100) break;
            }
            return;
        }
        differences.push(`${currentPath}: ${String(left)} != ${String(right)}`);
    };
    walk(semanticCanonical(expected), semanticCanonical(actual), path);
    return Object.freeze({ ok: differences.length === 0, differences: Object.freeze(differences) });
}

function moduleSnapshot() {
    return Object.freeze(Object.fromEntries(ModuleRegistry.all().map(module => [module.id, cloneData(module.serialize())])));
}

function restoreModuleSnapshot(snapshot, { render = false } = {}) {
    ModuleRegistry.all().forEach(module => {
        module.deserialize(cloneData(snapshot[module.id]));
        if (render) module.render({ reason: "persistence-roundtrip-restore", force: true });
    });
}

function storageSnapshot() {
    return Object.freeze(Object.fromEntries(StorageService.keys().sort().map(key => [key, StorageService.get(key)])));
}

function restoreStorageSnapshot(snapshot) {
    StorageService.clear();
    Object.entries(snapshot).forEach(([key, value]) => StorageService.set(key, value));
}

function collectIdIntegrity(modules) {
    const idsByModule = {}, duplicates = [];
    Object.entries(modules || {}).forEach(([moduleId, value]) => {
        const ids = [], seen = new Set();
        const visit = node => {
            if (Array.isArray(node)) return node.forEach(visit);
            if (!node || typeof node !== "object") return;
            if (Object.prototype.hasOwnProperty.call(node, "id") && node.id != null) {
                const id = String(node.id);
                ids.push(id);
                if (seen.has(id)) duplicates.push(`${moduleId}:${id}`);
                seen.add(id);
            }
            Object.values(node).forEach(visit);
        };
        visit(value);
        idsByModule[moduleId] = ids.sort();
    });
    return Object.freeze({ idsByModule: Object.freeze(idsByModule), duplicates: Object.freeze(duplicates) });
}

const PersistenceRoundtrip = Object.freeze({
    async run() {
        flushPendingWrites({ commitNow: true });
        const originalModules = moduleSnapshot();
        const originalStorage = storageSnapshot();
        const originalIds = collectIdIntegrity(originalModules);
        const stages = {};
        let exported = null, prepared = null, importedModules = null, rollbackModules = null;
        const pass = (id, details = {}) => stages[id] = Object.freeze({ status: "PASS", ok: true, details: Object.freeze(details) });
        const fail = (id, error, details = {}) => stages[id] = Object.freeze({ status: "FAIL", ok: false, issues: Object.freeze([error?.message || String(error)]), details: Object.freeze(details) });
        try {
            exported = await buildExportArtifact();
            pass("export", { modules: exported.moduleIds.length, partial: exported.partial });

            const serialized = JSON.stringify(exported);
            const parsed = JSON.parse(serialized);
            pass("import", { bytes: byteSize(serialized), parsed: true });
            const checksum = await verifySnapshotChecksum(parsed);
            if (checksum.ok !== true) throw Object.assign(new Error(checksum.message || "Checksum eksportu nie został potwierdzony."), { stage: "checksum" });
            pass("checksum", { algorithm: parsed.checksumAlgorithm, checksum: parsed.checksum });

            ModuleRegistry.all().forEach(module => module.deserialize(cloneData(module.defaultData())));
            prepared = await prepareImportArtifact(parsed);
            pass("normalize", { moduleIds: prepared.normalized.moduleIds.length });
            pass("migrate", { from: prepared.migrated.migratedFrom || DATA_SCHEMA_VERSION, to: DATA_SCHEMA_VERSION });
            if (!prepared.validation.valid) throw Object.assign(new Error("Walidacja importu nie przeszła: " + prepared.validation.errors.join("; ")), { stage: "validate" });
            pass("validate", { modules: Object.keys(prepared.validation.moduleValidation || {}).length, warnings: prepared.validation.warnings.length, accepted: prepared.sanitized.report.accepted.length, repaired: prepared.sanitized.report.repaired.length, rejected: prepared.sanitized.report.rejected.length });

            getModuleIds(prepared.sanitized.data.moduleIds).forEach(id => MODULE_BY_ID[id].deserialize(cloneData(prepared.sanitized.data.modules[id])));
            importedModules = moduleSnapshot();
            const comparison = semanticCompare(originalModules, importedModules, "modules");
            const importedIds = collectIdIntegrity(importedModules);
            const idComparison = semanticCompare(originalIds.idsByModule, importedIds.idsByModule, "ids");
            if (!comparison.ok || !idComparison.ok || importedIds.duplicates.length) throw new Error([ ...comparison.differences, ...idComparison.differences, ...importedIds.duplicates.map(id => `duplikat id: ${id}`) ].slice(0, 20).join("; "));
            pass("compare", { differences: 0, duplicateIds: 0 });

            restoreModuleSnapshot(originalModules);
            rollbackModules = moduleSnapshot();
            const rollbackComparison = semanticCompare(originalModules, rollbackModules, "rollback");
            if (!rollbackComparison.ok) throw new Error("Rollback różni się od stanu początkowego: " + rollbackComparison.differences.slice(0, 10).join("; "));
            pass("rollback", { differences: 0 });

            const storageAfter = storageSnapshot();
            const storageComparison = semanticCompare(originalStorage, storageAfter, "storage");
            if (!storageComparison.ok) throw new Error("Test zmienił storage: " + storageComparison.differences.slice(0, 10).join("; "));
            pass("storageIntegrity", { keysBefore: Object.keys(originalStorage).length, keysAfter: Object.keys(storageAfter).length, addedKeys: 0 });
        } catch (error) {
            const order = ["export", "import", "checksum", "normalize", "migrate", "validate", "compare", "rollback", "storageIntegrity"];
            const failedStage = error?.stage || order.find(id => !stages[id]) || "unknown";
            fail(failedStage, error);
        } finally {
            try { restoreModuleSnapshot(originalModules, { render: true }); } catch (error) { if (!stages.rollback?.ok) fail("rollback", error); }
            const currentStorage = storageSnapshot();
            if (!semanticCompare(originalStorage, currentStorage, "storage-final").ok) restoreStorageSnapshot(originalStorage);
            refreshDataBadge();
        }
        const required = ["export", "import", "checksum", "normalize", "migrate", "validate", "compare", "rollback", "storageIntegrity"];
        const ok = required.every(id => stages[id]?.ok === true);
        return Object.freeze({
            id: "persistence-roundtrip",
            status: ok ? "PASS" : "FAIL",
            ok,
            stages: Object.freeze(Object.fromEntries(required.map(id => [id, stages[id] || Object.freeze({ status: "NOT_RUN", ok: null })]))),
            metrics: Object.freeze({ modules: ModuleRegistry.all().length, storageKeys: Object.keys(originalStorage).length, duplicateIds: originalIds.duplicates.length }),
            generatedAt: new Date().toISOString()
        });
    }
});

function importMetadataReport(raw, sanitized, checksumResult) {
    const ids = getModuleIds(sanitized.data.moduleIds), counts = ids.map(id => {
        return `${MODULE_BY_ID[id].label}: ${value = sanitized.data.modules[id], Array.isArray(value) ? value.length : value && "object" == typeof value ? Array.isArray(value.sections) ? value.sections.reduce((n, s) => n + (Array.isArray(s.groups) ? s.groups.length : 0), 0) + (Array.isArray(value.knownMails) ? value.knownMails.length : 0) : Object.keys(value).length : null == value ? 0 : 1}`;
        var value;
    }).join(", "), errors = [ ...sanitized.report.rejected.map(x => `${x.module}: ${x.reason}`) ];
    return !1 === checksumResult?.ok && errors.unshift(checksumResult.message), [ `Wersja aplikacji: ${raw.appVersion || "brak"}`, `Schemat: v${raw.schemaVersion || "brak"}`, `Data eksportu: ${raw.exportedAt || raw.createdAt || "brak"}`, `Moduły (${ids.length}): ${ids.join(", ")}`, `Liczba rekordów: ${counts || "0"}`, `Suma kontrolna: ${checksumResult?.message || "brak informacji"}`, `Błędy: ${errors.length ? errors.slice(0, 8).join("; ") : "brak"}` ].join("\n");
}

function downloadJSON(snapshot, filename) {
    const blob = new Blob([ JSON.stringify(snapshot, null, 2) ], {
        type: "application/json"
    }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url, a.download = filename, document.body.appendChild(a), a.click(),
    SchedulerService.scheduleTimeout(() => {
        a.remove(), URL.revokeObjectURL(url);
    }, 2e3, { owner: "persistence", key: "cleanup-download-anchor" });
}

async function exportData(moduleIds) {
    flushPendingWrites();
    const snap = await buildExportArtifact(moduleIds), d = new Date, date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, fname = snap.partial ? `workdesk-partial-${date}-v${DATA_SCHEMA_VERSION}.json` : `workdesk-backup-${date}-v${DATA_SCHEMA_VERSION}.json`;
    return downloadJSON(snap, fname), snap.partial || (StorageService.safeCommit("wd.backup.lastFileExportAt", (new Date).toISOString()), 
    updateWeeklyBackupBanner()), toast("Wyeksportowano: " + fname), snap;
}

function selectModuleIds(actionLabel, {single: single = !1} = {}) {
    return new Promise(resolve => {
        let settled = !1, m = $("#moduleSelectModal");
        m || (m = document.createElement("div"), m.className = "modal lg", m.id = "moduleSelectModal", 
        m.hidden = !0, m.innerHTML = '<div class="modal-h"><h3 id="moduleSelectTitle"></h3><button type="button" class="icon-btn x" data-module-cancel aria-label="Zamknij">✕</button></div><div class="modal-b"><div id="moduleSelectList" class="business-list"></div></div><div class="modal-f"><button type="button" class="btn ghost" data-module-cancel>Anuluj</button><button type="button" class="btn primary" id="moduleSelectApply">Zastosuj</button></div>', 
        $("#overlay").appendChild(m)), $("#moduleSelectTitle").textContent = actionLabel, 
        SafeDOM.replace($("#moduleSelectList"), MODULE_REGISTRY.map(module => SafeDOM.el("label", { className: "checkbox" }, [
            SafeDOM.el("input", { attrs: { type: single ? "radio" : "checkbox", name: "moduleSelect", value: module.id } }),
            SafeDOM.text(" " + module.label)
        ])));
        const finish = value => {
            settled || (settled = !0, closeModal({
                notifyCancel: !1
            }), resolve(value));
        };
        m.querySelectorAll("[data-module-cancel]").forEach(b => bindEvent(b, "click", () => finish([]))), 
        bindEvent($("#moduleSelectApply"), "click", () => finish([ ...m.querySelectorAll("input:checked") ].map(x => x.value))), 
        showModal(m, {
            onCancel: () => finish([])
        });
    });
}

async function exportPartialData() {
    const ids = await selectModuleIds("Eksport częściowy danych");
    ids.length && exportData(ids);
}

function importDataFromFile(file) {
    if (!file) return;
    if (!/\.json$|application\/json/i.test(file.type + " " + file.name)) return toast("Wybierz plik .json", "err");
    const reader = new FileReader;
    reader.onerror = () => toast("Nie udało się odczytać pliku.", "err"), reader.onload = () => {
        (async function(text, srcName = "(schowek)") {
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (err) {
                return void toast(`Plik nie jest poprawnym JSON${err?.message ? ": " + err.message : ""}.`, "err");
            }
            let prepared;
            try {
                prepared = await prepareImportArtifact(parsed);
            } catch (error) {
                return void toast(error?.message || "Nie udało się przygotować importu.", "err");
            }
            const checksumResult = prepared.checksum, migrated = prepared.migrated, sanitized = prepared.sanitized, check = prepared.validation;
            check.warnings.forEach(message => sanitized.report.warnings.push({
                module: "schema",
                index: null,
                message: message
            }));
            const meta = importMetadataReport(parsed, sanitized, checksumResult), changes = buildImportReport(sanitized.data), validation = `Zaakceptowane: ${(report = sanitized.report).accepted.length}\nNaprawione: ${report.repaired.length}\nOdrzucone: ${report.rejected.length}\nOstrzeżenia: ${report.warnings.length}`, rejected = sanitized.report.rejected.slice(0, 5).map(x => `- ${x.module} #${x.index ?? "?"}: ${x.reason}`).join("\n");
            var report;
            if (!check.valid) return void showInfoDialog("Import odrzucony", `${meta}\n\nBłędy schematu:\n${check.errors.join("; ")}`);
            if (!await showConfirmModal(`Zaimportować dane z „${srcName}”?\n\nMETADANE\n${meta}\n\nRÓŻNICE\n${changes}\n\nWALIDACJA\n${validation}${rejected ? `\n\nPierwsze odrzucone rekordy:\n${rejected}` : ""}\n\n${sanitized.data.partial ? "Import częściowy nie ruszy pozostałych modułów." : "Obecne dane zostaną zastąpione."}`, {
                confirmLabel: "Importuj",
                danger: !sanitized.data.partial
            })) return;
            const guard = await savePreviousGoodRestorePoint();
            guard && !1 !== guard.ok && (applyAppData(sanitized.data), rerenderAllFromData(sanitized.data.moduleIds), 
            await saveCurrentRestorePoint(), toast("Zaimportowano dane z: " + srcName + (sanitized.report.rejected.length || sanitized.report.repaired.length ? ` Naprawiono: ${sanitized.report.repaired.length}, odrzucono: ${sanitized.report.rejected.length}.` : "")), 
            renderBackupList());
        })(String(reader.result || ""), file.name).catch(err => toast("Błąd importu: " + (err?.message || err), "err"));
    }, reader.readAsText(file);
}

async function resetData() {
    if (!await showConfirmModal("Przywrócić dane wbudowane w aplikacji?\n\nPrzed zmianą zostanie automatycznie utworzony punkt przywracania. Wszystkie obecne dane modułów zostaną zastąpione.", {
        confirmLabel: "Utwórz punkt i przywróć",
        danger: !0
    })) return;
    const guard = await savePreviousGoodRestorePoint();
    if (!guard || !1 === guard.ok) return void toast("Nie udało się utworzyć punktu bezpieczeństwa. Operacja została anulowana.", "err");
    appState = normalizeCurrentData(defaultDataV3()), applyAppData(appState), LEGACY_SNAPSHOT_KEYS.concat(LEGACY_MODULE_KEYS).forEach(key => StorageService.remove(key)),
    rerenderAllFromData(), await saveCurrentRestorePoint(), renderBackupList(),
    renderDailyStart(), toast("Przywrócono dane wbudowane. Poprzedni stan zachowano w punktach przywracania.");
}

EventLifecycle.on($("#dataExport"), "click", () => exportData(), { owner: "persistence-ui", key: "export" }), EventLifecycle.on($("#emergencyExportBtn"), "click", () => exportData(), { owner: "persistence-ui", key: "emergency-export" }), EventLifecycle.on($("#dataExportPartial"), "click", exportPartialData, { owner: "persistence-ui", key: "export-partial" }), 
EventLifecycle.on($("#dataResetModule"), "click", async function() {
    const ids = await selectModuleIds("Reset pojedynczego modułu", {
        single: !0
    });
    if (!ids.length) return;
    const mod = MODULE_BY_ID[ids[0]];
    if (!await showConfirmModal(`Zresetować moduł „${mod.label}”?\n\nPrzed zmianą zostanie utworzony punkt przywracania. Pozostałe moduły nie zostaną zmienione.`, {
        confirmLabel: "Utwórz punkt i resetuj",
        danger: !0
    })) return;
    const guard = await savePreviousGoodRestorePoint();
    if (!guard || !1 === guard.ok) return void toast("Nie udało się utworzyć punktu bezpieczeństwa. Reset anulowano.", "err");
    (function(moduleId) {
        const mod = MODULE_BY_ID[moduleId];
        if (!mod) return !1;
        safeAction(`reset:${moduleId}`, mod.reset, { fallback: !1, context: { moduleId } }), refreshDataBadge();
    })(ids[0]);
    await saveCurrentRestorePoint(), renderBackupList(), renderDailyStart(), toast("Zresetowano moduł: " + mod.label + ". Poprzedni stan zachowano.");
}, { owner: "persistence-ui", key: "reset-module" }), EventLifecycle.on($("#dataReset"), "click", resetData, { owner: "persistence-ui", key: "reset" }), EventLifecycle.on($("#dataRoundTripTest"), "click", async function() {
    const report = await PersistenceRoundtrip.run();
    const failed = Object.entries(report.stages).filter(([, stage]) => stage.ok === false).map(([id, stage]) => `${id}: ${(stage.issues || []).join("; ")}`).join(" | ");
    report.ok ? toast(`Test persistence-roundtrip: PASS (${report.metrics.modules} modułów).`) : toast("Test persistence-roundtrip: FAIL" + (failed ? " — " + failed : ""), "err");
    return report;
}, { owner: "persistence-ui", key: "roundtrip" }), EventLifecycle.on($("#dataImport"), "click", () => $("#dataFile").click(), { owner: "persistence-ui", key: "open-import" }), EventLifecycle.on($("#dataFile"), "change", e => {
    const f = e.target.files?.[0];
    f && importDataFromFile(f), e.target.value = "";
}, { owner: "persistence-ui", key: "file-change" }), function() {
    const ov = $("#dropOverlay");
    let depth = 0;
    const hasFiles = dt => dt && Array.from(dt.types || []).includes("Files");
    EventLifecycle.on(window, "dragenter", e => {
        hasFiles(e.dataTransfer) && (e.preventDefault(), depth++, ov.classList.add("show"), 
        ov.setAttribute("aria-hidden", "false"));
    }), EventLifecycle.on(window, "dragover", e => {
        hasFiles(e.dataTransfer) && (e.preventDefault(), e.dataTransfer.dropEffect = "copy");
    }), EventLifecycle.on(window, "dragleave", e => {
        hasFiles(e.dataTransfer) && (depth = Math.max(0, depth - 1), 0 === depth && (ov.classList.remove("show"), 
        ov.setAttribute("aria-hidden", "true")));
    }), EventLifecycle.on(window, "drop", e => {
        if (!hasFiles(e.dataTransfer)) return;
        e.preventDefault(), depth = 0, ov.classList.remove("show"), ov.setAttribute("aria-hidden", "true");
        const f = e.dataTransfer.files?.[0];
        f && importDataFromFile(f);
    });
}();

let paletteItems = [], paletteActiveIx = 0;

function openPalette() {
    paletteItems = function() {
        const items = [];
        return items.push({
            cat: "Akcja",
            title: "Otwórz/zwiń pasek e-mail",
            sub: "Pokazuje workspace e-mail",
            icon: "mail",
            run: toggleEmail
        }, {
            cat: "Akcja",
            title: "Wyczyść kompozytor",
            sub: "Czyści wszystkie pola",
            icon: "box",
            run: () => $("#clearBtn").click()
        }, {
            cat: "Akcja",
            title: "Wyślij wiadomość",
            sub: "Otwiera klienta poczty",
            icon: "mail",
            run: () => $("#sendBtn").click()
        }, {
            cat: "Akcja",
            title: "Bulk mail (po przecinku)",
            sub: "Osobny mailto dla każdego",
            icon: "users",
            run: () => $("#bulkBtn").click()
        }, {
            cat: "Akcja",
            title: "Eksport danych JSON",
            sub: "Pobierz aktualny stan",
            icon: "box",
            run: () => exportData()
        }, {
            cat: "Akcja",
            title: "Eksport modułu JSON…",
            sub: "Pobierz wybrany moduł",
            icon: "box",
            run: exportPartialData
        }, {
            cat: "Akcja",
            title: "Importuj dane JSON…",
            sub: "Wczytaj plik z dysku",
            icon: "box",
            run: () => $("#dataImport").click()
        }, {
            cat: "Akcja",
            title: "Przywróć dane domyślne",
            sub: "Cofa zaimportowane zmiany",
            icon: "life",
            run: resetData
        }, {
            cat: "Akcja",
            title: "Dodaj nową grupę…",
            sub: "Otwiera formularz",
            icon: "users",
            run: () => $("#addGroupBtn").click()
        }, {
            cat: "Akcja",
            title: "Generuj kod szablonu",
            sub: "Z aktualnych pól",
            icon: "book",
            run: () => $("#genTmplBtn").click()
        }, {
            cat: "Akcja",
            title: "Wyczyść draft kompozytora",
            sub: "Usuń autosave",
            icon: "box",
            run: () => {
                clearDraft(), toast("Draft skasowany.");
            }
        }), sortedTemplates().forEach(t => items.push({
            cat: "Szablon",
            title: t.name,
            sub: t.subject || "",
            icon: "book",
            run: () => loadTemplateByName(t.name)
        })), runtimeData.sections.forEach(sec => sec.groups.forEach(g => items.push({
            cat: "Grupa",
            title: `${g.name}  ·  ${sec.name}`,
            sub: `${g.emails.length} adresów → dodaj do "Do"`,
            icon: "users",
            run: () => function(secName, grpName) {
                const id = secName + "::" + grpName, grp = findGroupById(id);
                if (!grp) return;
                const inp = fieldFor("To"), merged = uniq([ ...parseEmails(inp.value), ...grp.emails ]);
                inp.value = merged.join("; "), inp.dispatchEvent(new Event("input", { bubbles: true })), groupState.To.add(id), 
                renderGroups($("#grpSearch").value || ""), emailEl.classList.contains("expanded") || toggleEmail(), 
                toast(`Dodano grupę „${grpName}" do „Do".`);
            }(sec.name, g.name)
        }))), runtimeData.tiles.forEach(t => items.push({
            cat: "copy" === t.type ? "Kopiuj" : "Kafelek",
            title: t.title,
            sub: "copy" === t.type ? "Kopiuj do schowka" : t.ie ? "Otwórz w trybie IE" : "Otwórz w nowej karcie",
            icon: t.icon || "globe",
            run: () => function(t) {
                "copy" === t.type ? copyToClipboard(t.value).then(ok => toast(ok ? `Skopiowano: ${t.title}` : "Nie udało się skopiować.", ok ? "ok" : "err")) : window.open(t.ie ? ieUrl(t.url) : t.url, "_blank", "noopener");
            }(t)
        })), runtimeData.frequentLinks.forEach(l => items.push({
            cat: "Link",
            title: l.title,
            sub: l.url,
            icon: "globe",
            run: () => window.open(l.url, "_blank", "noopener")
        })), items;
    }(), paletteActiveIx = 0, $("#cmdQuery").value = "", renderPalette(""), showModal("cmdModal"), 
    SchedulerService.scheduleTimeout(() => $("#cmdQuery").focus(), 30, { owner: "command-palette", key: "focus-query" });
}

function renderPalette(q) {
    const host = $("#cmdList"), query = q.trim().toLowerCase(), filtered = query ? paletteItems.filter(item => (item.title + " " + item.sub + " " + item.cat).toLowerCase().includes(query)) : paletteItems;
    if (filtered.length) paletteActiveIx = Math.min(paletteActiveIx, filtered.length - 1);
    else paletteActiveIx = -1;
    const commandNodes = filtered.map((item, index) => {
        const icon = SafeDOM.el("div", { className: "ci-ic" }, SafeDOM.trustedStaticFragment(getIcon(item.icon)));
        return SafeDOM.el("div", { className: "cmd-item " + (index === paletteActiveIx ? "active" : ""), attrs: { role: "option" }, dataset: { ix: index } }, [
            icon,
            SafeDOM.el("div", { className: "ci-txt" }, [SafeDOM.el("div", { className: "ci-title", text: item.title }), SafeDOM.el("div", { className: "ci-sub", text: item.sub })]),
            SafeDOM.el("div", { className: "ci-cat", text: item.cat })
        ]);
    });
    SafeDOM.replace(host, commandNodes.length ? commandNodes : SafeDOM.empty("cmd-empty", `Brak wyników dla „${q}"`));
}
function refreshPaletteActive() {
    $$(".cmd-item", $("#cmdList")).forEach((el, i) => el.classList.toggle("active", i === paletteActiveIx));
    const active = $(".cmd-item.active", $("#cmdList"));
    active && active.scrollIntoView({
        block: "nearest"
    });
}

function executePaletteItem(it) {
    it && (closeModal(), SchedulerService.scheduleTimeout(() => {
        try {
            it.run();
        } catch (error) {
            UI_ERROR_REGISTRY.record("command-palette", "execute", error, { title: it.title || "" });
            toast("Błąd akcji.", "err");
        }
    }, 50, { owner: "command-palette", key: "execute" }));
}

EventLifecycle.on($("#openPaletteBtn"), "click", openPalette, { owner: "command-palette", key: "open" }), EventLifecycle.on($("#cmdQuery"), "input", e => {
    paletteActiveIx = 0, renderPalette(e.target.value);
}, { owner: "command-palette", key: "query-input" }), EventLifecycle.on($("#cmdQuery"), "keydown", function(e) {
    const q = $("#cmdQuery").value.trim().toLowerCase(), filtered = q ? paletteItems.filter(it => (it.title + " " + it.sub + " " + it.cat).toLowerCase().includes(q)) : paletteItems;
    "ArrowDown" === e.key ? (e.preventDefault(), paletteActiveIx = (paletteActiveIx + 1) % filtered.length, 
    refreshPaletteActive()) : "ArrowUp" === e.key ? (e.preventDefault(), paletteActiveIx = (paletteActiveIx - 1 + filtered.length) % filtered.length, 
    refreshPaletteActive()) : "Enter" === e.key && (e.preventDefault(), executePaletteItem(filtered[paletteActiveIx]));
}, { owner: "command-palette", key: "query-keydown" }), EventLifecycle.on(window, "keydown", e => {
    (e.ctrlKey || e.metaKey) && "k" === e.key.toLowerCase() && (e.preventDefault(), 
    openPalette());
});

const DRAFT_KEY = "wd.draft.v2";

function scheduleDraftSave() {
    WriteQueue.schedule("draft", () => {
        const raw = JSON.stringify(EmailComposerState.draft());
        enforceTextBytes(raw, StorageLimits.current().draftBytes, "Draft e-mail") && (StorageService.set(DRAFT_KEY, raw), 
        renderStorageDashboard());
    }, 500);
}
