const LEGACY_SNAPSHOT_KEYS = Object.freeze([ "wd.data.v4", "wd.data.v3", "wd.data.v2", "wd.data.v1" ]), LEGACY_MODULE_KEYS = Object.freeze([ "wd.todos.v1", "wd.journal.v1", "wd.calendar.reminders.v1", "wd.notes.v2", "wd.theme.v1", "wd.tileOrder.v1", "wd.tilePins.v1" ]), MIGRATION_MARKER_KEY = "wd.migration.v5.complete";

function notifyStorageLoadBlocked() {
    try {
        AttentionCenter.notify({
            id: "storage-load-blocked",
            priority: "danger",
            rank: 110,
            title: t("storage.blocked.title"),
            message: t("storage.blocked.message"),
            actions: [ {
                id: "open-data",
                label: t("storage.blocked.openData"),
                primary: !0,
                run: () => {
                    document.getElementById("dataPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            } ]
        });
    } catch {}
}

function quarantineStructuredSnapshot(raw) {
    try {
        let hash = 2166136261;
        for (let index = 0; index < raw.length; index++) hash ^= raw.charCodeAt(index), hash = Math.imul(hash, 16777619);
        const fingerprint = (hash >>> 0).toString(16).padStart(8, "0"), quarantineKey = `wd.corrupt.${fingerprint}.wd_data_v5`;
        if (StorageService.get(quarantineKey, null) === raw) return !0;
        const committed = StorageService.safeCommit(quarantineKey, raw);
        return !!committed && !1 !== committed.ok;
    } catch {
        return !1;
    }
}

function recoverSnapshotAfterQuarantine() {
    for (const key of [ RESTORE_CURRENT_KEY, RESTORE_PREVIOUS_GOOD_KEY ]) {
        const candidate = StorageService.getJSON(key, null, {
            notify: !1
        });
        if (!candidate.ok || !candidate.value) continue;
        const normalized = normalizeCurrentData(candidate.value);
        if (!validateCurrentData(normalized).valid) continue;
        const committed = StorageService.safeCommitJSON(DATA_KEY, normalized);
        if (committed && !1 !== committed.ok) return storageLoadBlocked = !1, toast(`Odzyskano dane z punktu „${key === RESTORE_CURRENT_KEY ? "current" : "previous-good"}”.`, "ok"),
        normalized;
    }
    return storageLoadBlocked = !1, null;
}

const _stored = function() {
    try {
        const current = StorageService.getJSON(DATA_KEY, null);
        if (current.exists) {
            if (!current.ok) return recoverSnapshotAfterQuarantine();
            const parsed = normalizeCurrentData(current.value);
            if (validateCurrentData(parsed).valid) return parsed;
            const raw = StorageService.get(DATA_KEY) || "", quarantined = quarantineStructuredSnapshot(raw), recovered = quarantined ? recoverSnapshotAfterQuarantine() : null;
            if (recovered) return recovered;
            if (quarantined) return toast("Bieżący snapshot ma nieprawidłową strukturę — przeniesiono go do kwarantanny i wczytano dane domyślne.", "err"), null;
            return toast("Bieżący snapshot ma nieprawidłową strukturę i nie został nadpisany.", "err"), notifyStorageLoadBlocked(),
            storageLoadBlocked = !0, null;
        }
        const marker = StorageService.getJSON(MIGRATION_MARKER_KEY, null, {
            notify: !1
        }), migrationDone = marker.exists && marker.ok && !!marker.value, migrated = function() {
            if (!migrationDone) for (const key of LEGACY_SNAPSHOT_KEYS) {
                const parsed = StorageService.getJSON(key, null, {
                    notify: !1
                });
                if (parsed.exists && parsed.ok && parsed.value) return migrateData(parsed.value);
            }
            const base = defaultDataV3();
            if (migrationDone) return base;
            const readArray = (key, fallback = []) => {
                const r = StorageService.getJSON(key, fallback);
                return Array.isArray(r.value) ? r.value : fallback;
            };
            return base.modules.todo = readArray("wd.todos.v1", []), base.modules.journal = readArray("wd.journal.v1", []),
            base.modules.calendarReminders = readArray("wd.calendar.reminders.v1", []), base.modules.notes = readArray("wd.notes.v2", []),
            base.modules.preferences = normalizePreferences({
                theme: StorageService.get("wd.theme.v1") || null,
                tileOrder: readArray("wd.tileOrder.v1", []),
                tilePins: readArray("wd.tilePins.v1", [])
            }), base;
        }();
        if (!migrated) return null;
        if (migrated.migratedFrom = Number(migrated.schemaVersion || 3), migrated.schemaVersion = DATA_SCHEMA_VERSION,
        migrated.migratedAt = (new Date).toISOString(), !validateCurrentData(migrated).valid) return null;
        appState = normalizeCurrentData(migrated);
        const saved = StorageService.safeCommitJSON(DATA_KEY, appState);
        return saved && !1 !== saved.ok && (StorageService.safeCommitJSON(MIGRATION_MARKER_KEY, {
            completedAt: (new Date).toISOString(),
            appVersion: APP_VERSION,
            fromKeys: LEGACY_SNAPSHOT_KEYS
        }), LEGACY_SNAPSHOT_KEYS.concat(LEGACY_MODULE_KEYS).forEach(key => StorageService.remove(key))), appState;
    } catch (error) {
        return storageLoadBlocked = !0, console.error("Migracja do wd.data.v5 nie powiodła się", error),
        toast("Nie udało się wczytać danych. Poprzedni zapis pozostaje nienaruszony.", "err"), notifyStorageLoadBlocked(),
        null;
    }
}();

_stored ? applyAppData(_stored) : (appState = normalizeCurrentData(defaultDataV3()), 
syncAppStateFromRuntime()), EmailComposerState.read().signature || EmailComposerState.update({
    signature: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o.\nul. Przykładowa 1, 00-000 Warszawa\ntel. +48 000 000 000 · www.firma.pl\n\nNiniejsza wiadomość może zawierać informacje poufne.\nJeśli otrzymali ją Państwo omyłkowo, proszę o jej skasowanie."
}), updateCharBadge(), validateAllRecipients(), refreshDataBadge(), applyStorageInputLimits(), 
renderStorageDashboard(), async function() {
    StorageService.keys().filter(k => /^wd\.backup\.\d{4}-\d{2}-\d{2}$/.test(k)).forEach(k => StorageService.remove(k)), 
    StorageService.get(RESTORE_CURRENT_KEY) || await saveCurrentRestorePoint(), updateWeeklyBackupBanner(), 
    renderStorageDashboard();
}();

const _draft = readMeaningfulDraft();
