let journal = bootstrapModule("journal", []);



function exportJournal() {
    WriteQueue.flush("journal");
    if (!journal.length) return toast("Brak wpisów do eksportu.", "err");
    const rows = [["Data", "Godzina", "Wpis"]];
    journal.slice().reverse().forEach(entry => {
        const date = new Date(entry.createdAt);
        rows.push([
            date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()),
            pad(date.getHours()) + ":" + pad(date.getMinutes()),
            entry.text
        ]);
    });
    const csv = "\ufeff" + rows.map(row => row.map(value => csvEscape(value, ",")).join(",")).join("\n");
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    SchedulerService.scheduleTimeout(() => URL.revokeObjectURL(url), 1000, { owner: "journal-backup", key: "revoke-export-url" });
    getRetentionMeta().journalExportedAt = new Date().toISOString();
    requestFullSnapshot({immediate: true});
    toast(`Wyeksportowano ${journal.length} wpisów. Starsze wpisy mogą teraz podlegać retencji.`);
}

async function clearJournal() {
    if (!journal.length) return;
    if (await showConfirmModal(`Skasować wszystkie wpisy journala (${journal.length})?`, {confirmLabel: "Skasuj"})) {
        CoreModuleState.journal.clear();
        toast("Journal wyczyszczony.");
    }
}

function showJournalSummary() {
    const today = new Date().toDateString();
    const rows = journal.filter(entry => new Date(entry.createdAt).toDateString() === today);
    const counts = {};
    rows.forEach(entry => counts[entry.type || "info"] = (counts[entry.type || "info"] || 0) + 1);
    showInfoDialog("Podsumowanie journalu", `Wpisy dziś: ${rows.length}\n` + Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join("\n"));
}


const RESTORE_POINTS = [ {
    key: RESTORE_CURRENT_KEY,
    label: "bieżący"
}, {
    key: RESTORE_PREVIOUS_GOOD_KEY,
    label: "poprzedni poprawny"
} ];

async function saveCurrentRestorePoint() {
    const snap = await async function() {
        const snap = exportAppData();
        return snap.createdAt = (new Date).toISOString(), attachChecksum(snap);
    }();
    return StorageService.safeCommitJSON(RESTORE_CURRENT_KEY, snap);
}

async function savePreviousGoodRestorePoint() {
    flushPendingWrites();
    const current = StorageService.getJSON(DATA_KEY, exportAppData(), {
        notify: !1
    });
    let raw, snap = current.ok && current.value ? current.value : exportAppData();
    snap.createdAt = (new Date).toISOString(), snap = await attachChecksum(snap);
    try {
        raw = JSON.stringify(snap);
    } catch (error) {
        return {
            ok: !1,
            reason: "serialize",
            error: error
        };
    }
    const usage = StorageService.usage(), previousBytes = byteSize(StorageService.get(RESTORE_PREVIOUS_GOOD_KEY, "") || ""), budget = StorageLimits.current().totalBudgetBytes, needed = 2 * byteSize(raw) + 65536;
    return usage.usedBytes - previousBytes + needed > budget ? (toast("Brak bezpiecznego miejsca na previous-good. Pobierz backup do pliku lub zwolnij miejsce przed importem.", "err"), 
    {
        ok: !1,
        reason: "space"
    }) : StorageService.safeCommitJSON(RESTORE_PREVIOUS_GOOD_KEY, snap);
}

function renderBackupList() {
    const host = $("#backupList"), items = RESTORE_POINTS.map(point => {
        const raw = StorageService.get(point.key);
        if (!raw) return null;
        let meta = {};
        try {
            meta = JSON.parse(raw);
        } catch (error) {
            UI_ERROR_REGISTRY.record("backup", "metadata", error, { key: point.key });
        }
        return {
            key: point.key,
            date: meta.createdAt || meta.exportedAt || "—",
            label: point.label,
            size: byteSize(raw)
        };
    }).filter(Boolean);
    items.length ? SafeDOM.replace(host, items.map(backup => SafeDOM.el("div", { className: "b-row " + (backup.key === RESTORE_CURRENT_KEY ? "is-today" : "") }, [
        SafeDOM.el("span", { className: "b-date" }, [SafeDOM.text(backup.label), SafeDOM.el("br"), SafeDOM.el("small", { text: String(backup.date) })]),
        SafeDOM.el("span", { className: "b-size", text: formatBytes(backup.size) }),
        SafeDOM.el("span", { className: "b-acts" }, [
            SafeDOM.el("button", { className: "btn sm", text: "Przywróć", attrs: { type: "button" }, dataset: { act: "restore", k: backup.key } }),
            SafeDOM.el("button", { className: "btn sm ghost", text: "Pobierz", attrs: { type: "button" }, dataset: { act: "download", k: backup.key } })
        ])
    ]))) : SafeDOM.replace(host, SafeDOM.empty("backup-empty", "Brak punktów przywracania."));
}

async function handleBackupAction(button) {
    const key = button?.dataset?.k, action = button?.dataset?.act;
    if (!key || !action) return;
    const raw = StorageService.get(key);
    if (!raw) return toast("Punkt przywracania nie istnieje.", "err");
    let snapshot;
    try {
        snapshot = JSON.parse(raw);
    } catch (error) {
        UI_ERROR_REGISTRY.record("backup", action === "restore" ? "restore-parse" : "download-parse", error, { key });
        return toast("Punkt przywracania jest uszkodzony.", "err");
    }
    if (action === "download") {
        try {
            const checked = await attachChecksum(snapshot), d = new Date;
            downloadJSON(checked, `workdesk-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-v${DATA_SCHEMA_VERSION}.json`);
        } catch (error) {
            UI_ERROR_REGISTRY.record("backup", "download", error, { key });
            toast("Nie udało się przygotować pliku backupu.", "err");
        }
        return;
    }
    try {
        const checksum = await verifySnapshotChecksum(snapshot);
        if (!1 === checksum.ok) return toast(checksum.message, "err");
        const sanitized = sanitizeImportData(migrateData(snapshot)), check = validateCurrentData(sanitized.data);
        if (!check.valid) return toast("Nieprawidłowa struktura: " + check.errors.join("; "), "err");
        const meta = importMetadataReport(snapshot, sanitized, checksum), report = buildImportReport(sanitized.data);
        if (!await showConfirmModal(`Przywrócić punkt „${key === RESTORE_CURRENT_KEY ? "bieżący" : "poprzedni poprawny"}”?\n\n${meta}\n\nRÓŻNICE\n${report}`, { confirmLabel: "Przywróć" })) return;
        const guard = await savePreviousGoodRestorePoint();
        if (!guard || !1 === guard.ok) return;
        applyAppData(sanitized.data), rerenderAllFromData(), await saveCurrentRestorePoint(), renderBackupList(), toast("Przywrócono punkt danych.");
    } catch (error) {
        UI_ERROR_REGISTRY.record("backup", "restore", error, { key });
        toast("Nie udało się przywrócić punktu danych.", "err");
    }
}

function updateWeeklyBackupBanner() {
    const last = Date.parse(StorageService.get("wd.backup.lastFileExportAt") || ""), due = !Number.isFinite(last) || Date.now() - last >= 6048e5;
    if (!due) return AttentionCenter.dismiss("startup:weekly-backup");
    const days = Number.isFinite(last) ? Math.floor((Date.now() - last) / 864e5) : null;
    AttentionCenter.notify({
        id: "startup:weekly-backup", title: "Warto zapisać kopię danych",
        message: null === days ? "Nie zapisano jeszcze zewnętrznej kopii plikowej." : `Ostatnia kopia plikowa: ${days} dni temu.`,
        priority: "warning", rank: 10,
        actions: [ { id: "export", label: "Eksportuj kopię", primary: true, run: () => exportData() } ]
    });
}

EventLifecycle.on($("#backupList"), "click", event => {
    const button = event.target instanceof Element ? event.target.closest("[data-act][data-k]") : null;
    button && handleBackupAction(button);
}, { owner: "journal-backup", key: "backup-list-actions" });
EventLifecycle.on($("#dataBackups"), "click", () => {
    renderBackupList(), showModal("backupModal");
}, { owner: "journal-backup", key: "open-backups" });
EventLifecycle.on($("#backupNow"), "click", async () => {
    const result = await saveCurrentRestorePoint();
    renderBackupList(), renderStorageDashboard(), toast(!1 === result?.ok ? "Nie udało się zapisać punktu bieżącego." : "Odświeżono punkt bieżący.", !1 === result?.ok ? "err" : "ok");
}, { owner: "journal-backup", key: "save-current" });


EventLifecycle.on($("#dataConfidenceBackup"), "click", async () => {
    const result = await saveCurrentRestorePoint();
    renderBackupList(), renderStorageDashboard(), renderDailyStart();
    toast(!1 === result?.ok ? "Nie udało się utworzyć punktu przywracania." : "Utworzono punkt przywracania.", !1 === result?.ok ? "err" : "ok");
}, { owner: "journal-backup", key: "confidence-backup" });
