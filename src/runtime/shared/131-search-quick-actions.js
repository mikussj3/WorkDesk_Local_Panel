let globalSearchIndex = [];
let globalSearchActiveIndex = -1;

function normalizeSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[łŁ]/g, "l")
        .replace(/[đĐ]/g, "d")
        .toLocaleLowerCase("pl-PL")
        .replace(/\s+/g, " ")
        .trim();
}

function searchTokens(value) {
    return normalizeSearchText(value).split(" ").filter(Boolean);
}

function createSearchEntry({ id, category, title, subtitle = "", keywords = "", action }) {
    const safeTitle = String(title || "").trim();
    if (!safeTitle || typeof action !== "function") return null;
    const safeCategory = String(category || "Inne").trim();
    const safeSubtitle = String(subtitle || "").trim();
    return {
        id: String(id || `${safeCategory}:${safeTitle}`),
        category: safeCategory,
        title: safeTitle,
        subtitle: safeSubtitle,
        action,
        normalizedTitle: normalizeSearchText(safeTitle),
        normalizedSubtitle: normalizeSearchText(safeSubtitle),
        normalizedCategory: normalizeSearchText(safeCategory),
        normalizedKeywords: normalizeSearchText(keywords)
    };
}

function addSearchEntry(rows, entry) {
    entry && rows.push(entry);
}

function openBusinessSearchResult(actionId, recordId, prepare) {
    BusinessActions.run(actionId);
    SchedulerService.scheduleTimeout(() => {
        prepare?.();
        ModuleRegistry.get(actionId)?.render({ reason: "global-search" });
        SchedulerService.scheduleTimeout(() => focusSearchResult(`[data-business-record-id="${CSS.escape(recordId)}"]`, `#${actionId}`), 0, { owner: "global-search", key: `focus-${actionId}` });
    }, 0, { owner: "global-search", key: `open-${actionId}` });
}

function buildGlobalSearchIndex() {
    const rows = [];
    todos.forEach(todoItem => addSearchEntry(rows, createSearchEntry({
        id: `todo:${todoItem.id}`,
        category: "TODO",
        title: todoItem.text,
        subtitle: [todoItem.done ? "wykonane" : "aktywne", todoItem.priority, todoItem.due || ""].filter(Boolean).join(" · "),
        keywords: `zadanie ${todoItem.done ? "zrobione zakonczone" : "otwarte"}`,
        action: () => focusSearchResult(`[data-todo-id="${CSS.escape(todoItem.id)}"]`, "#todoList")
    })));
    journal.forEach(entry => addSearchEntry(rows, createSearchEntry({
        id: `journal:${entry.id}`,
        category: "Journal",
        title: entry.text,
        subtitle: new Date(entry.createdAt).toLocaleString("pl-PL"),
        keywords: entry.type || "wpis dziennik",
        action: () => focusSearchResult(`[data-journal-id="${CSS.escape(entry.id)}"]`, "#journalList")
    })));
    notes.forEach(note => addSearchEntry(rows, createSearchEntry({
        id: `note:${note.id}`,
        category: "Notatki",
        title: note.title || note.text || "Notatka",
        subtitle: note.title && note.text ? note.text.slice(0, 120) : "notatka",
        keywords: note.pinned ? "przypieta ulubiona" : "",
        action: () => focusSearchResult(`[data-note-id="${CSS.escape(note.id)}"]`, "#notesHost")
    })));
    (calReminders || []).filter(reminder => !reminder.done).forEach(reminder => addSearchEntry(rows, createSearchEntry({
        id: `reminder:${reminder.id}`,
        category: "Przypomnienia",
        title: reminder.text,
        subtitle: `${reminder.date || ""} ${reminder.time || ""}`.trim(),
        keywords: reminder.snoozedUntil ? "odlozone snooze" : "kalendarz termin",
        action: () => focusSearchResult(`[data-reminder-id="${CSS.escape(reminder.id)}"]`, "#calReminderList")
    })));
    (runtimeData.sections || []).forEach(section => (section.groups || []).forEach(group => addSearchEntry(rows, createSearchEntry({
        id: `group:${group.id || section.name + ":" + group.name}`,
        category: "Grupy",
        title: group.name,
        subtitle: section.name,
        keywords: (group.emails || []).join(" "),
        action: () => {
            emailEl.classList.contains("expanded") || toggleEmail();
            $("#grpSearch").value = group.name;
            renderGroups(group.name);
            focusSearchResult(`[data-group-id="${CSS.escape(group.id || "")}"]`, "#groupsHost");
        }
    }))));
    (runtimeData.templates || []).forEach(template => addSearchEntry(rows, createSearchEntry({
        id: `template:${template.id || template.name}`,
        category: "Szablony",
        title: template.name,
        subtitle: template.subject || "",
        keywords: template.body || "",
        action: () => {
            emailEl.classList.contains("expanded") || toggleEmail();
            $("#tmplSearch").value = template.name;
            loadTemplateByName(template.name);
        }
    })));
    (ensureAppState().modules.emailProfiles || []).forEach(profile => addSearchEntry(rows, createSearchEntry({
        id: `email-profile:${profile.id}`,
        category: "Profile e-mail",
        title: profile.label,
        subtitle: [profile.to, profile.subject].filter(Boolean).join(" · "),
        keywords: `${profile.cc || ""} ${profile.bcc || ""}`,
        action: () => {
            $("#emailProfilesBtn")?.click();
            SchedulerService.scheduleTimeout(() => focusSearchResult(`[data-email-profile-id="${CSS.escape(profile.id)}"]`, "#epList"), 0, { owner: "global-search", key: "profile-focus" });
        }
    })));
    (ensureAppState().modules.checklists || []).forEach(item => addSearchEntry(rows, createSearchEntry({
        id: `checklist:${item.id}`,
        category: "Checklisty",
        title: item.name,
        subtitle: `${item.items?.length || 0} pozycji`,
        keywords: (item.items || []).map(row => row.text).join(" "),
        action: () => openBusinessSearchResult("checklists", item.id)
    })));
    (ensureAppState().modules.responseCases || []).forEach(item => addSearchEntry(rows, createSearchEntry({
        id: `case:${item.id}`,
        category: "Sprawy",
        title: item.subject,
        subtitle: `${item.from || "bez nadawcy"} · ${item.status}`,
        keywords: `${item.note || ""} ${item.due || ""}`,
        action: () => openBusinessSearchResult("responseCases", item.id, () => {
            const field = $("#caseFilter");
            if (field) {
                field.value = "all";
                field.dispatchEvent(new Event("change", { bubbles: true }));
            }
        })
    })));
    (ensureAppState().modules.phoneLog || []).forEach(item => addSearchEntry(rows, createSearchEntry({
        id: `phone:${item.id}`,
        category: "Telefony",
        title: item.contactName || item.phoneNumber || "Wpis telefonu",
        subtitle: [item.phoneNumber, item.organization, item.status].filter(Boolean).join(" · "),
        keywords: `${item.note || ""} ${item.direction || ""}`,
        action: () => openBusinessSearchResult("phoneLog", item.id, () => {
            const search = $("#phSearch"), filter = $("#phFilter");
            if (search) search.value = "";
            if (filter) filter.value = "all";
        })
    })));
    (ensureAppState().modules.procedures || []).forEach(item => addSearchEntry(rows, createSearchEntry({
        id: `procedure:${item.id}`,
        category: "Procedury",
        title: item.title,
        subtitle: item.category || "bez kategorii",
        keywords: item.body || "",
        action: () => openBusinessSearchResult("procedures", item.id, () => {
            const search = $("#prSearch");
            if (search) search.value = "";
        })
    })));
    (runtimeData.tiles || []).forEach(tile => addSearchEntry(rows, createSearchEntry({
        id: `tile:${tile.id}`,
        category: "Kafelki",
        title: tile.title,
        subtitle: tile.desc || "",
        keywords: `${(tile.tags || []).join(" ")} ${tile.ie ? "ie mode" : ""}`,
        action: () => {
            tileSearchQuery = tile.title.toLocaleLowerCase("pl-PL");
            $("#tileSearch").value = tile.title;
            applyTileFilter();
            focusSearchResult(`[data-tile-id="${CSS.escape(tile.id)}"]`, "#tilesHost");
        }
    })));
    (runtimeData.frequentLinks || []).forEach((link, index) => addSearchEntry(rows, createSearchEntry({
        id: `link:${link.id || index}`,
        category: "Linki",
        title: link.title,
        subtitle: link.note || link.url || "",
        keywords: link.url || "",
        action: () => focusSearchResult(`#flinksHost .flink:nth-child(${index + 1})`, "#flinksHost")
    })));
    (runtimeData.snippets || []).forEach(snippet => addSearchEntry(rows, createSearchEntry({
        id: `snippet:${snippet.id || snippet.name}`,
        category: "Snippety",
        title: snippet.name,
        subtitle: String(snippet.text || snippet.value || "").slice(0, 120),
        keywords: snippet.trigger || "",
        action: () => {
            emailEl.classList.contains("expanded") || toggleEmail();
            $("#fBody")?.focus();
            toast(`Snippet: ${snippet.name}`);
        }
    })));
    globalSearchIndex = rows;
    return rows;
}

function searchScore(entry, queryTokens, normalizedQuery) {
    let score = 0;
    if (entry.normalizedTitle === normalizedQuery) score += 120;
    else if (entry.normalizedTitle.startsWith(normalizedQuery)) score += 80;
    else if (entry.normalizedTitle.includes(normalizedQuery)) score += 55;
    if (entry.normalizedCategory === normalizedQuery) score += 45;
    else if (entry.normalizedCategory.startsWith(normalizedQuery)) score += 25;
    for (const token of queryTokens) {
        if (entry.normalizedTitle.startsWith(token)) score += 24;
        else if (entry.normalizedTitle.includes(token)) score += 16;
        if (entry.normalizedSubtitle.includes(token)) score += 8;
        if (entry.normalizedCategory.includes(token)) score += 6;
        if (entry.normalizedKeywords.includes(token)) score += 4;
        if (![entry.normalizedTitle, entry.normalizedSubtitle, entry.normalizedCategory, entry.normalizedKeywords].some(field => field.includes(token))) return -1;
    }
    return score;
}

function findGlobalSearchResults(query, limit = 30) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return [];
    const tokens = searchTokens(normalizedQuery);
    return buildGlobalSearchIndex()
        .map((entry, sourceIndex) => ({ entry, sourceIndex, score: searchScore(entry, tokens, normalizedQuery) }))
        .filter(result => result.score >= 0)
        .sort((left, right) => right.score - left.score || left.entry.category.localeCompare(right.entry.category, "pl") || left.sourceIndex - right.sourceIndex)
        .slice(0, limit)
        .map(result => result.entry);
}

function setGlobalSearchActive(index) {
    const host = $("#globalResults");
    const rows = Array.from(host?.querySelectorAll(".global-result") || []);
    globalSearchActiveIndex = rows.length ? Math.max(0, Math.min(index, rows.length - 1)) : -1;
    rows.forEach((row, rowIndex) => {
        const active = rowIndex === globalSearchActiveIndex;
        row.classList.toggle("active", active);
        row.setAttribute("aria-selected", String(active));
        if (active) {
            row.id ||= `globalSearchResult-${rowIndex}`;
            $("#globalSearch")?.setAttribute("aria-activedescendant", row.id);
            row.scrollIntoView({ block: "nearest" });
        }
    });
    if (globalSearchActiveIndex < 0) $("#globalSearch")?.removeAttribute("aria-activedescendant");
}

function runGlobalSearchResult(index) {
    const host = $("#globalResults");
    const item = host?._rows?.[index];
    if (!item) return false;
    item.action();
    UIRuntime.close(host.id, { reason: "selection", restoreFocus: false });
    $("#globalSearch")?.removeAttribute("aria-activedescendant");
    recordRecentAction("search.open", `${item.category}: ${item.title}`);
    return true;
}

function renderGlobalSearch(query) {
    const host = $("#globalResults");
    if (!host) return;
    if (!query.trim()) {
        UIRuntime.close(host.id, { reason: "search-empty", restoreFocus: false });
        SafeDOM.clear(host);
        host._rows = [];
        globalSearchActiveIndex = -1;
        $("#globalSearch")?.removeAttribute("aria-activedescendant");
        return;
    }
    const rows = findGlobalSearchResults(query);
    host._rows = rows;
    const counts = new Map();
    rows.forEach(item => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    SafeDOM.replace(host, rows.length ? rows.map((item, index) => SafeDOM.el("div", {
        className: "global-result",
        attrs: { role: "option", "aria-selected": "false" },
        dataset: { i: index, category: item.category }
    }, [
        SafeDOM.el("div", { className: "cat", text: `${item.category} · ${counts.get(item.category)}` }),
        SafeDOM.el("div", { className: "title", text: item.title }),
        SafeDOM.el("div", { className: "sub", text: item.subtitle })
    ])) : SafeDOM.empty("cmd-empty", "Brak wyników."));
    UIRuntime.open("global-search", host, { opener: $("#globalSearch"), priority: 30 });
    setGlobalSearchActive(rows.length ? 0 : -1);
}

function firstActiveTodo() {
    return todos.find(x => !x.done);
}

function setAccessibleFieldError(field, message = "") {
    if (!field) return;
    const fieldBox = field.closest(".field") || field.parentElement;
    let error = fieldBox?.querySelector(`.field-error[data-for="${field.id}"]`);
    !error && fieldBox && (error = document.createElement("div"), error.className = "field-error", 
    error.dataset.for = field.id, error.id = `${field.id}-error`, error.setAttribute("role", "alert"), 
    fieldBox.appendChild(error)), error && (error.textContent = message), field.setAttribute("aria-invalid", message ? "true" : "false"), 
    error && field.setAttribute("aria-describedby", error.id);
}

$("#todoArchiveBtn")?.addEventListener("click", () => {
    !function() {
        const list = $("#todoArchiveList"), cutoff = Date.now() - 2592e6, rows = businessPrefs().todoArchive.filter(x => Number(x.archivedAt) >= cutoff);
        SafeDOM.replace(list, rows.length ? rows.map(item => SafeDOM.el("div", { className: "archive-row" }, [SafeDOM.el("div", { text: item.text || "" }), SafeDOM.el("div", { className: "meta", text: new Date(item.archivedAt).toLocaleString("pl-PL") })])) : SafeDOM.empty("todo-empty", "Brak zarchiwizowanych zadań z ostatnich 30 dni."));
    }(), showModal("todoArchiveModal");
}), $("#todoArchiveCsv")?.addEventListener("click", function() {
    const csv = "Tekst;Utworzono;Zarchiwizowano\n" + businessPrefs().todoArchive.filter(x => Date.now() - Number(x.archivedAt) <= 2592e6).map(x => [ x.text, new Date(x.createdAt).toISOString(), new Date(x.archivedAt).toISOString() ].map(csvEscape).join(";")).join("\n");
    downloadText(`workdesk-todo-archive-${(new Date).toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8"), 
    recordRecentAction("todo.archive.export", "Eksport archiwum TODO");
});

const renderGlobalSearchDebounced = SchedulerService.debounce("global-search", "input", renderGlobalSearch, 90);

$("#globalSearch")?.addEventListener("input", event => {
    renderGlobalSearchDebounced(event.target.value);
});

$("#globalSearch")?.addEventListener("keydown", event => {
    const rows = $("#globalResults")?._rows || [];
    if (event.key === "ArrowDown" && rows.length) {
        event.preventDefault();
        setGlobalSearchActive(globalSearchActiveIndex + 1);
    } else if (event.key === "ArrowUp" && rows.length) {
        event.preventDefault();
        setGlobalSearchActive(globalSearchActiveIndex - 1);
    } else if (event.key === "Home" && rows.length) {
        event.preventDefault();
        setGlobalSearchActive(0);
    } else if (event.key === "End" && rows.length) {
        event.preventDefault();
        setGlobalSearchActive(rows.length - 1);
    } else if (event.key === "Enter" && rows.length) {
        event.preventDefault();
        runGlobalSearchResult(globalSearchActiveIndex < 0 ? 0 : globalSearchActiveIndex);
    } else if (event.key === "Escape") {
        event.preventDefault();
        UIRuntime.close("globalResults", { reason: "escape" });
        event.currentTarget.removeAttribute("aria-activedescendant");
    }
});

delegateEvent($("#globalResults"), "click", ".global-result", (event, row) => {
    runGlobalSearchResult(Number(row.dataset.i));
});
$("#quickActionsBtn")?.addEventListener("click", () => showModal("quickActionsModal")), 
$("#dayReportBtn")?.addEventListener("click", function() {
    const now = new Date, day = now.toDateString(), done = todos.filter(todo => todo.done && todo.completedAt && new Date(todo.completedAt).toDateString() === day), open = todos.filter(todo => !todo.done), j = journal.filter(x => new Date(x.createdAt).toDateString() === day), r = (calReminders || []).filter(x => new Date(x.date).toDateString() === day), text = [ `WorkDesk — raport dnia ${now.toLocaleDateString("pl-PL")}`, `Zadania wykonane: ${done.length}`, ...done.map(x => `- ${x.text}`), "", `Zadania otwarte: ${open.length}`, ...open.map(x => `- ${x.text}`), "", `Wpisy journalu: ${j.length}`, ...j.map(x => `- ${x.text}`), "", `Przypomnienia: ${r.length}`, ...r.map(x => `- ${x.time || ""} ${x.text}`), "", `Sesje Pomodoro: ${pomoSessions}` ].join("\n");
    downloadText(`workdesk-day-report-${now.toISOString().slice(0, 10)}.txt`, text), 
    recordRecentAction("day.report.export", "Eksport raportu dnia");
}), $("#recentActionsBtn")?.addEventListener("click", () => {
    !function() {
        const rows = businessPrefs().recentActions;
        SafeDOM.replace($("#recentActionsList"), rows.length ? rows.map(action => SafeDOM.el("div", { className: "recent-action" }, [SafeDOM.el("b", { text: action.label }), SafeDOM.el("div", { className: "meta", text: `${action.type} · ${new Date(action.at).toLocaleString("pl-PL")}` })])) : SafeDOM.empty("todo-empty", "Brak ostatnich akcji."));
    }(), showModal("recentActionsModal");
}), $("#qaTemplate")?.addEventListener("click", function() {
    closeModal(), emailEl.classList.contains("expanded") || toggleEmail(), $("#tmplSearch").focus();
}), $("#qaSelectionTodo")?.addEventListener("click", function() {
    const text = String(window.getSelection?.().toString() || "").trim();
    if (!text) return toast("Najpierw zaznacz tekst na stronie.", "err");
    $("#todoInput").value = text.slice(0, StorageLimits.current().todoTextChars), addTodo(), 
    recordRecentAction("todo.from-selection", text), closeModal();
}), $("#qaTodoJournal")?.addEventListener("click", function() {
    const t = firstActiveTodo();
    if (!t) return toast("Brak aktywnego TODO.", "err");
    DomainServices.journal.create({
        text: t.text,
        type: "info"
    }), recordRecentAction("todo.to-journal", t.text), closeModal(), toast("Dodano TODO do journalu.");
}), $("#qaTodoReminder")?.addEventListener("click", function() {
    const t = firstActiveTodo();
    if (!t) return toast("Brak aktywnego TODO.", "err");
    const tomorrow = new Date;
    tomorrow.setDate(tomorrow.getDate() + 1), DomainServices.reminder.create({
        date: dateKeyLocal(tomorrow),
        time: ensureAppState().modules.userConfig?.defaultReminder || "09:00",
        text: t.text
    }), recordRecentAction("todo.to-reminder", t.text), closeModal(), toast("Utworzono przypomnienie na jutro.");
}), registerModuleHook("todo", "afterRender", () => {
    renderDailyStart(), buildGlobalSearchIndex();
}, "daily-search"), registerModuleHook("journal", "afterRender", () => {
    renderDailyStart(), buildGlobalSearchIndex();
}, "daily-search"), renderDailyStart(), buildGlobalSearchIndex(), $$("#overlay > .modal").forEach(modal => {
    modal.setAttribute("aria-modal", "true"), modal.hidden && modal.setAttribute("aria-hidden", "true");
}), Object.entries({
    groupsHost: "Brak grup adresowych.",
    tmplList: "Brak szablonów.",
    todoList: "Brak zadań.",
    notesHost: "Brak notatek.",
    flinksHost: "Brak częstych linków.",
    tilesHost: "Brak kafelków spełniających kryteria.",
    calReminderList: "Brak aktywnych przypomnień.",
    journalList: "Brak wpisów journalu.",
    backupList: "Brak punktów przywracania.",
    idHistory: "Brak historii w tej sesji."
}).forEach(([id, msg]) => {
    const el = $("#" + id);
    el && (el.dataset.emptyMessage = msg);
}), $$("button").forEach(btn => {
    const label = btn.getAttribute("aria-label") || btn.textContent.trim();
    !btn.title && label && (btn.title = label.replace(/\s+/g, " ")), btn.getAttribute("aria-label") || btn.textContent.trim() || !btn.title || btn.setAttribute("aria-label", btn.title);
}), $$(".panel-h").forEach(head => {
    head.hasAttribute("tabindex") || (head.tabIndex = 0), head.setAttribute("role", "button");
    const panel = head.closest(".panel");
    head.setAttribute("aria-expanded", panel?.classList.contains("open") ? "true" : "false"), 
    head.addEventListener("keydown", e => {
        "Enter" !== e.key && " " !== e.key || (e.preventDefault(), head.click());
    });
}), EventLifecycle.on(document, "invalid", e => {
    const field = e.target;
    (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) && (e.preventDefault(), 
    setAccessibleFieldError(field, field.validationMessage || "Sprawdź poprawność tego pola."), 
    field.focus());
}, !0), EventLifecycle.on(document, "input", e => {
    const field = e.target;
    (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) && field.checkValidity() && setAccessibleFieldError(field, "");
}, !0), document.getElementById("storageIntegrityTest")?.addEventListener("click", async function() {
    const goodKey = "wd.test.integrity.good", badKey = "wd.test.integrity.bad", beforeGood = StorageService.get(goodKey, null), beforeBad = StorageService.get(badKey, null), beforeKeys = new Set(StorageService.keys());
    try {
        if (!StorageService.safeCommitJSON(goodKey, {
            ok: !0,
            value: 1
        }).ok) throw new Error("nie udało się zapisać wartości kontrolnej");
        StorageService.safeCommit(badKey, "{broken-json");
        const parsed = StorageService.getJSON(badKey, null, {
            notify: !1
        });
        if (parsed.ok || !parsed.quarantineKey || "{broken-json" !== StorageService.get(parsed.quarantineKey)) throw new Error("kwarantanna nie działa");
        if (null !== StorageService.get(badKey, null) || !parsed.sourceRemoved) throw new Error("uszkodzone źródło nie zostało usunięte");
        if (!parsed.markerKey || !StorageService.getJSON(parsed.markerKey, null, {
            notify: !1
        }).ok) throw new Error("marker kwarantanny nie został zapisany");
        const quarantinesBefore = StorageService.keys().filter(key => key.startsWith("wd.corrupt.")).length, secondRead = StorageService.getJSON(badKey, null, {
            notify: !1
        }), quarantinesAfter = StorageService.keys().filter(key => key.startsWith("wd.corrupt.")).length;
        if (!secondRead.ok || secondRead.exists || quarantinesAfter !== quarantinesBefore) throw new Error("kwarantanna została utworzona ponownie");
        const cyc = {};
        cyc.self = cyc;
        const failed = StorageService.safeCommitJSON(goodKey, cyc);
        if (failed.ok || "serialize" !== failed.reason) throw new Error("błąd serializacji nie został wykryty");
        const still = StorageService.getJSON(goodKey, null, {
            notify: !1
        });
        if (!still.ok || 1 !== still.value?.value) throw new Error("rollback nie zachował dobrej wartości");
        toast("Test integralności storage zakończony poprawnie.");
    } catch (error) {
        console.error(error), toast("Test integralności nieudany: " + error.message, "err");
    } finally {
        StorageService.keys().filter(k => !beforeKeys.has(k) && k.startsWith("wd.corrupt.")).forEach(k => StorageService.remove(k)), 
        null === beforeGood ? StorageService.remove(goodKey) : StorageService.safeCommit(goodKey, beforeGood), 
        null === beforeBad ? StorageService.remove(badKey) : StorageService.safeCommit(badKey, beforeBad);
    }
}), function() {
    const overlay = document.getElementById("overlay");
    overlay?.querySelectorAll(".modal").forEach(m => {
        if (!m || !m.classList.contains("modal")) return;
        m.setAttribute("role", "dialog"), m.setAttribute("aria-modal", "true");
        const h = m.querySelector(".modal-h h3");
        h && (h.id || (h.id = m.id + "Title"), m.setAttribute("aria-labelledby", h.id)), 
        m.querySelectorAll(".icon-btn").forEach(b => {
            b.getAttribute("aria-label") || b.setAttribute("aria-label", b.title || "Akcja");
        });
    });
}(), function() {
    const prefs = () => {
        const preferences = businessPrefs(), current = Array.isArray(preferences.recentEmailGroups) ? preferences.recentEmailGroups : [], normalized = normalizeRecentEmailGroups(current);
        if (JSON.stringify(current) !== JSON.stringify(normalized)) preferences.recentEmailGroups = normalized, requestFullSnapshot();
        return preferences;
    };
    function canonicalRecentEmailGroup(entry) {
        const direct = findEmailGroupRecord(entry?.id);
        if (direct) return { id: direct.id, label: direct.group.name, at: Number(entry?.at) || 0 };
        const {sectionName, groupName} = parseEmailGroupId(entry?.id), label = String(entry?.label || "").trim();
        const section = runtimeData.sections.find(item => item.name === sectionName);
        if (!section) return null;
        const exact = section.groups.find(item => item.name === label || item.name === groupName);
        if (exact) return { id: makeEmailGroupId(section.name, exact.name), label: exact.name, at: Number(entry?.at) || 0 };
        const legacyCandidates = section.groups.filter(item => {
            const legacyLabel = item.name + String(item.emails?.length || 0);
            return legacyLabel === label || legacyLabel === groupName;
        });
        const group = 1 === legacyCandidates.length ? legacyCandidates[0] : null;
        return group ? { id: makeEmailGroupId(section.name, group.name), label: group.name, at: Number(entry?.at) || 0 } : null;
    }
    function normalizeRecentEmailGroups(entries) {
        const seen = new Set, normalized = [];
        for (const entry of Array.isArray(entries) ? entries : []) {
            const current = canonicalRecentEmailGroup(entry);
            if (!current || seen.has(current.id)) continue;
            seen.add(current.id), normalized.push(current);
            if (normalized.length >= 5) break;
        }
        return normalized;
    }
    renameRecentEmailGroup = (oldId, newId) => {
        const preferences = businessPrefs(), target = findEmailGroupRecord(newId);
        preferences.recentEmailGroups = normalizeRecentEmailGroups((preferences.recentEmailGroups || []).map(entry => entry.id === oldId && target ? { ...entry, id: target.id, label: target.group.name } : entry));
        requestFullSnapshot();
    };
    removeRecentEmailGroup = id => {
        const preferences = businessPrefs();
        preferences.recentEmailGroups = normalizeRecentEmailGroups((preferences.recentEmailGroups || []).filter(entry => entry.id !== id));
        requestFullSnapshot();
    };
    const input = $("#grpSearch");
    if (!input) return;
    const searchBox = input.closest(".search"), clear = document.createElement("button");
    clear.type = "button", clear.className = "search-clear-btn", clear.textContent = "✕", 
    clear.setAttribute("aria-label", "Wyczyść wyszukiwanie grup"), clear.title = "Wyczyść wyszukiwanie grup", 
    searchBox.appendChild(clear);
    const count = document.createElement("div");
    count.className = "mini-count", count.id = "grpVisibleCount", count.setAttribute("aria-live", "polite"), count.setAttribute("aria-atomic", "true"), searchBox.parentElement.insertBefore(count, searchBox.nextSibling);
    const recent = document.createElement("div");
    function refresh() {
        clear.classList.toggle("show", !!input.value);
        const rows = $$(".group", "#groupsHost").filter(item => "none" !== getComputedStyle(item).display), all = (runtimeData.sections || []).reduce((total, section) => total + (section.groups || []).length, 0);
        count.textContent = `Widoczne: ${rows.length} z ${all} grup`, renderRecent();
    }
    function renderRecent() {
        const preferences = prefs();
        SafeDOM.replace(recent, preferences.recentEmailGroups.length ? [SafeDOM.el("span", { className: "business-meta", text: "Ostatnio:" }), ...preferences.recentEmailGroups.map(group => SafeDOM.el("button", { className: "btn sm ghost recent-email-group", text: group.label, attrs: { type: "button", title: group.label, "aria-label": `Pokaż grupę ${group.label}` }, dataset: { id: group.id } }))] : []);
    }
    recent.className = "business-tools", recent.id = "recentEmailGroups", count.insertAdjacentElement("afterend", recent), 
    delegateEvent(recent, "click", "[data-id]", (event, button) => {
        const record = findEmailGroupRecord(button.dataset.id);
        if (!record) return removeRecentEmailGroup(button.dataset.id), renderRecent();
        input.value = record.group.name, renderGroups(input.value), refresh();
        const target = $$(".group", "#groupsHost").find(row => row.dataset.groupId === record.id);
        target?.scrollIntoView({ behavior: "smooth", block: "center" }), target?.classList.add("search-highlight"), SchedulerService.scheduleTimeout(() => target?.classList.remove("search-highlight"), 1600, { owner: "email", key: `recent-highlight-${record.id}` }), 
        input.focus();
    }), bindEvent(clear, "click", () => {
        input.value = "", renderGroups(""), refresh(), input.focus();
    }), input.addEventListener("keydown", event => {
        "Escape" === event.key && input.value && (event.preventDefault(), clear.click());
    }), input.addEventListener("input", () => SchedulerService.scheduleTimeout(refresh, 0, { owner: "email", key: "groups-refresh" })), $("#groupsHost")?.addEventListener("change", event => {
        const row = event.target.closest(".group"), record = row ? findEmailGroupRecord(row.dataset.groupId) : null;
        if (!record) return;
        const preferences = prefs();
        preferences.recentEmailGroups = [ { id: record.id, label: record.group.name, at: Date.now() }, ...preferences.recentEmailGroups.filter(entry => entry.id !== record.id) ].slice(0, 5), requestFullSnapshot(), renderRecent();
    });
    const clearRecipients = document.createElement("button");
    clearRecipients.className = "btn sm ghost", clearRecipients.textContent = "Wyczyść odbiorców", 
    bindEvent(clearRecipients, "click", () => {
        EmailComposerState.update({
            to: "",
            cc: "",
            bcc: ""
        }), EmailComposerState.clearGroups(), renderGroups(input.value), scheduleDraftSave(), 
        toast("Wyczyszczono odbiorców.");
    }), $(".email-main .row")?.appendChild(clearRecipients), SchedulerService.scheduleTimeout(refresh, 0, {
        owner: "email",
        key: "groups-refresh"
    });
}();

