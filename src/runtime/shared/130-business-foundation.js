
function businessPrefs() {
    const state = ensureAppState();
    return state.modules.preferences = normalizePreferences(state.modules.preferences), 
    state.modules.preferences;
}

function recordRecentAction(type, label) {
    const p = businessPrefs();
    p.recentActions.unshift({
        type: String(type),
        label: String(label).slice(0, 180),
        at: Date.now()
    }), p.recentActions = p.recentActions.slice(0, 20), requestFullSnapshot(), renderDailyStart();
}

function downloadText(name, text, type = "text/plain;charset=utf-8") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ text ], {
        type: type
    })), a.download = name, document.body.appendChild(a), a.click(), SchedulerService.scheduleTimeout(() => {
        URL.revokeObjectURL(a.href), a.remove();
    }, 0);
}

function latestBackupAge() {
    const vals = [ StorageService.get("wd.restore.current"), StorageService.get("wd.restore.previous-good") ].filter(Boolean).map(v => {
        try {
            const parsed = JSON.parse(v), stamp = Date.parse(parsed.exportedAt || parsed.createdAt || "");
            return Number.isFinite(stamp) ? Date.now() - stamp : 1 / 0;
        } catch {
            return 1 / 0;
        }
    });
    return vals.length ? Math.floor(Math.min(...vals) / 864e5) : null;
}

function dataConfidenceState() {
    const usage = StorageService.usage(), age = latestBackupAge(), blocked = !!storageLoadBlocked;
    const state = blocked || usage.level === "danger" ? "danger" : age === null || age >= 7 || usage.level === "warning" ? "warning" : "ok";
    const saved = lastFullSnapshotAt ? new Date(lastFullSnapshotAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : "w tej sesji jeszcze nie zapisano zmian";
    const backup = age === null ? "brak punktu przywracania" : age === 0 ? "backup dzisiaj" : `backup ${age} dni temu`;
    return { state, age, usage, text: blocked ? "Zapis zablokowany — sprawdź komunikaty o danych" : `Dane zapisane: ${saved} · ${backup} · pamięć ${Math.round(usage.percent)}%` };
}

function renderDataConfidence() {
    const root = $("#dataConfidence"), text = $("#dataConfidenceText"), action = $("#dataConfidenceBackup");
    if (!root || !text) return;
    const info = dataConfidenceState();
    root.dataset.state = info.state, text.textContent = info.text;
    if (action) action.hidden = !(info.age === null || info.age >= 7);
}

function renderDailyStart() {
    if (!$("#dailyStart")) return;
    const now = new Date(), today = now.toDateString(), activeRows = todos.filter(x => !x.done), overdue = activeRows.filter(x => x.due && new Date(x.due).getTime() < now.setHours(0, 0, 0, 0)).length, todayTodos = activeRows.filter(x => x.due && new Date(x.due).toDateString() === today).length, rem = (calReminders || []).filter(x => !x.done && new Date(x.date).toDateString() === today).length, age = latestBackupAge(), draft = !!readMeaningfulDraft(), usage = StorageService.usage();
    const card = (value, label, alert = false) => SafeDOM.el("div", { className: `daily-card${alert ? " is-alert" : ""}` }, [ SafeDOM.el("div", { className: "v", text: value }), SafeDOM.el("div", { className: "l", text: label }) ]);
    SafeDOM.replace($("#dailyStart"), [
        card(todayTodos, "zadania na dziś", overdue > 0),
        card(overdue, "zadań po terminie", overdue > 0),
        card(rem, "przypomnienia dziś", rem > 0),
        card(draft ? "tak" : "nie", "niewysłany draft", draft),
        card(null === age ? "brak" : age === 0 ? "dzisiaj" : age + " dni", "ostatni backup", age === null || age >= 7)
    ]), renderDataConfidence();
}

_draft && (pendingDraftRestore = _draft, AttentionCenter.notify({
    id: "startup:draft", title: "Znaleziono wersję roboczą", message: "Możesz przywrócić niewysłaną wiadomość albo odrzucić zapisany draft.", priority: "info", rank: 20,
    actions: [
        { id: "restore", label: "Przywróć", primary: true, run: () => restorePendingDraft() },
        { id: "discard", label: "Odrzuć", run: () => discardPendingDraft() }
    ]
})), EventLifecycle.on(window, "keydown", e => {
    "cmdModal" !== UIRuntime.top()?.id && ((e.ctrlKey || e.metaKey) && "Enter" === e.key ? (e.preventDefault(), 
    $("#sendBtn").click()) : !e.ctrlKey && !e.metaKey || "e" !== e.key.toLowerCase() || e.shiftKey || [ "INPUT", "TEXTAREA" ].includes(document.activeElement?.tagName) || (e.preventDefault(), 
    toggleEmail()));
});
