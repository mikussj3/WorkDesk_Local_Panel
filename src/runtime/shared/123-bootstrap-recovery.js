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
            return validateCurrentData(parsed).valid ? parsed : (toast("Bieżący snapshot ma nieprawidłową strukturę i nie został nadpisany.", "err"), 
            storageLoadBlocked = !0, null);
        }
        const migrated = function() {
            for (const key of [ "wd.data.v4", "wd.data.v3", "wd.data.v2", "wd.data.v1" ]) {
                const parsed = StorageService.getJSON(key, null, {
                    notify: !1
                });
                if (parsed.exists && parsed.ok && parsed.value) return migrateData(parsed.value);
            }
            const base = defaultDataV3(), readArray = (key, fallback = []) => {
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
        return saved && !1 !== saved.ok && StorageService.safeCommitJSON("wd.migration.v5.complete", {
            completedAt: (new Date).toISOString(),
            appVersion: APP_VERSION,
            fromKeys: [ "wd.data.v4", "wd.data.v3", "wd.data.v2", "wd.data.v1" ]
        }), appState;
    } catch (error) {
        return storageLoadBlocked = !0, console.error("Migracja do wd.data.v5 nie powiodła się", error), 
        toast("Nie udało się wczytać danych. Poprzedni zapis pozostaje nienaruszony.", "err"), 
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
