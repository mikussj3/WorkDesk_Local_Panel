
const CoreModuleHelpers = (() => {
    const clone = value => cloneData(value);
    const now = () => Date.now();
    const getModuleState = id => ensureAppState().modules[id];
    const setModuleState = (id, value, {persist = true} = {}) => {
        const normalized = Array.isArray(value) ? clone(value) : value;
        const state = ensureAppState();
        if (id === "todo") { replaceArrayContents(todos, normalized); state.modules.todo = todos; }
        else if (id === "notes") { replaceArrayContents(notes, normalized); state.modules.notes = notes; }
        else if (id === "journal") { replaceArrayContents(journal, normalized); state.modules.journal = journal; }
        else if (id === "calendarReminders") { replaceArrayContents(calReminders, normalized); state.modules.calendarReminders = calReminders; }
        else state.modules[id] = normalized;
        if (persist) requestFullSnapshot();
        return normalized;
    };
    const updateArray = (id, mutator, {render = true, immediate = false} = {}) => {
        const current = clone(Array.isArray(getModuleState(id)) ? getModuleState(id) : []);
        const next = mutator(current) || current;
        setModuleState(id, next, {persist: false});
        requestFullSnapshot({immediate});
        if (render) ModuleRegistry.get(id)?.render();
        return next;
    };
    const find = (id, itemId) => Array.isArray(getModuleState(id)) ? getModuleState(id).find(item => item.id === itemId) : null;
    return Object.freeze({clone, now, getModuleState, setModuleState, updateArray, find});
})();

const ModuleRenderMetrics = (() => {
    const counts = new Map();
    const last = new Map();
    return Object.freeze({
        mark(id) { counts.set(id, (counts.get(id) || 0) + 1); last.set(id, performance.now()); },
        all: () => Object.fromEntries([...counts].map(([id, count]) => [id, {count, last: last.get(id) || 0}]))
    });
})();

const {clone: cloneCoreState, now: coreNow, getModuleState, setModuleState, updateArray, find: findCoreRecord} = CoreModuleHelpers;

CoreModuleState = Object.freeze({
        todo: {
            list: () => getModuleState("todo") || [],
            create(payload) {
                const text = String(payload?.text || "").trim();
                if (!text) return null;
                const item = {
                    id: payload.id || businessUid(),
                    text: text,
                    done: !1,
                    archived: !1,
                    priority: payload.priority || "normal",
                    dueDate: payload.dueDate || "",
                    createdAt: Number(payload.createdAt) || coreNow(),
                    updatedAt: coreNow()
                };
                return updateArray("todo", rows => [ item, ...rows ]), item;
            },
            update(id, patch) {
                let changed = null;
                return updateArray("todo", rows => rows.map(record => record.id === id ? changed = {
                    ...record,
                    ...patch,
                    id: record.id,
                    updatedAt: coreNow()
                } : record)), changed;
            },
            complete(id, done = !0) {
                return this.update(id, {
                    done: !!done,
                    completedAt: done ? coreNow() : null
                });
            },
            remove(id) {
                let removed = null;
                return updateArray("todo", rows => rows.filter(record => record.id !== id || (removed = record, 
                !1))), removed;
            },
            archive(id) {
                const item = findCoreRecord("todo", id);
                if (!item) return null;
                const prefs = businessPrefs();
                return prefs.todoArchive = Array.isArray(prefs.todoArchive) ? prefs.todoArchive : [], 
                prefs.todoArchive.unshift({
                    ...cloneCoreState(item),
                    archivedAt: coreNow()
                }), this.remove(id), requestFullSnapshot(), item;
            },
            export() {
                return cloneCoreState(this.list());
            },
            toJournal(id) {
                const x = findCoreRecord("todo", id);
                return x ? CoreModuleState.journal.create({
                    text: x.text,
                    type: "todo"
                }) : null;
            },
            toReminder(id, date, time) {
                const x = findCoreRecord("todo", id);
                return x ? CoreModuleState.calendarReminders.create({
                    text: x.text,
                    date: date,
                    time: time
                }) : null;
            }
        },
        notes: {
            list: () => getModuleState("notes") || [],
            create(payload = {}) {
                const item = {
                    id: payload.id || businessUid(),
                    title: String(payload.title || "").slice(0, 100),
                    text: String(payload.text || ""),
                    color: payload.color || NOTE_PALETTES[0].id,
                    pinned: !!payload.pinned,
                    createdAt: Number(payload.createdAt) || coreNow(),
                    updatedAt: coreNow()
                };
                return byteSize(item.text) > StorageLimits.current().noteBytes ? (toast("Notatka przekracza limit rozmiaru.", "err"), 
                null) : (updateArray("notes", rows => [ item, ...rows ]), item);
            },
            update(id, patch, {render = true, immediate = false} = {}) {
                let changed = null;
                return updateArray("notes", rows => rows.map(record => {
                    if (record.id !== id) return record;
                    const candidate = {
                        ...record,
                        ...patch,
                        id: record.id,
                        updatedAt: coreNow()
                    };
                    return byteSize(candidate.text || "") > StorageLimits.current().noteBytes ? (toast("Notatka przekracza limit rozmiaru.", "err"), 
                    record) : (changed = candidate, candidate);
                }), {render, immediate}), changed;
            },
            remove(id) {
                let removed = null;
                return updateArray("notes", rows => rows.filter(record => record.id !== id || (removed = record, 
                !1))), removed;
            },
            setColor(id, color) {
                return this.update(id, {
                    color: color
                });
            },
            toTodo(id) {
                const x = findCoreRecord("notes", id);
                return x ? CoreModuleState.todo.create({
                    text: (x.title ? x.title + ": " : "") + x.text
                }) : null;
            },
            toJournal(id) {
                const x = findCoreRecord("notes", id);
                return x ? CoreModuleState.journal.create({
                    text: (x.title ? x.title + ": " : "") + x.text,
                    type: "note"
                }) : null;
            },
            export() {
                return cloneCoreState(this.list());
            }
        },
        journal: {
            list: () => getModuleState("journal") || [],
            create(payload) {
                const text = String(payload?.text || "").trim();
                if (!text) return null;
                const item = {
                    id: payload.id || businessUid(),
                    text: text,
                    type: payload.type || "info",
                    createdAt: Number(payload.createdAt) || coreNow()
                };
                return updateArray("journal", rows => [ item, ...rows ]), item;
            },
            remove(id) {
                let removed = null;
                return updateArray("journal", rows => rows.filter(record => record.id !== id || (removed = record, 
                !1))), removed;
            },
            clear: () => (setModuleState("journal", []), MODULE_LIFECYCLE.get("journal")?.render(), 
            !0),
            search(query = "") {
                const q = String(query).trim().toLowerCase();
                return q ? this.list().filter(record => (record.text + " " + (record.type || "")).toLowerCase().includes(q)) : this.list();
            },
            export() {
                return cloneCoreState(this.list());
            }
        },
        calendarReminders: {
            list: () => getModuleState("calendarReminders") || [],
            create(payload) {
                const text = String(payload?.text || "").trim(), date = String(payload?.date || "").trim(), time = String(payload?.time || "09:00").trim();
                if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
                const item = {
                    id: payload.id || businessUid(),
                    text: text,
                    date: date,
                    time: time,
                    done: !1,
                    createdAt: Number(payload.createdAt) || coreNow(),
                    lastNotifiedAt: 0,
                    snoozedUntil: 0
                };
                return updateArray("calendarReminders", rows => [ ...rows, item ]), item;
            },
            update(id, patch) {
                let changed = null;
                return updateArray("calendarReminders", rows => rows.map(record => record.id === id ? changed = {
                    ...record,
                    ...patch,
                    id: record.id
                } : record)), changed;
            },
            done(id) {
                return this.update(id, {
                    done: !0,
                    doneAt: coreNow()
                });
            },
            remove(id) {
                let removed = null;
                return updateArray("calendarReminders", rows => rows.filter(record => record.id !== id || (removed = record, 
                !1))), removed;
            },
            snooze(id, minutes = 10) {
                const item = findCoreRecord("calendarReminders", id);
                if (!item) return null;
                const next = cloneCoreState(item);
                return ReminderTimeService.snooze(next, minutes), this.update(id, {
                    snoozedUntil: next.snoozedUntil,
                    lastNotifiedAt: 0
                });
            },
            upcoming(limit = Infinity) {
                return this.list()
                    .filter(reminder => !reminder.done)
                    .sort((first, second) => ReminderTimeService.dueAt(first) - ReminderTimeService.dueAt(second))
                    .slice(0, Number.isFinite(limit) ? limit : undefined);
            },
            retain(days = 30) {
                const cutoff = coreNow() - 864e5 * days;
                return updateArray("calendarReminders", rows => rows.filter(reminder => !reminder.done || Number(reminder.doneAt || reminder.createdAt) >= cutoff)), 
                !0;
            },
            export() {
                return cloneCoreState(this.list());
            }
        }
    });

function renderTodos() {
    ModuleRenderMetrics.mark("todo");
    const host = $("#todoList");
    if (!host) return;

    const allItems = CoreModuleState.todo.list();
    const activeFilter = $("#todoFilter")?.value || "all";
    const todayKey = dateKeyLocal(new Date());
    const visibleItems = allItems.filter(todoItem => {
        if (activeFilter === "today") return todoItem.dueDate === todayKey;
        if (activeFilter === "high") return todoItem.priority === "high" && !todoItem.done;
        if (activeFilter === "overdue") return Boolean(todoItem.dueDate) && todoItem.dueDate < todayKey && !todoItem.done;
        if (activeFilter === "done") return todoItem.done;
        return true;
    });

    const actionButton = (action, label, text) => SafeDOM.el("button", {
        className: "icon-btn",
        text,
        attrs: { type: "button", "aria-label": label },
        dataset: { action }
    });

    const nodes = visibleItems.map(todoItem => {
        const checkbox = SafeDOM.el("input", {
            checked: Boolean(todoItem.done),
            attrs: { type: "checkbox", "aria-label": "Oznacz wykonane" },
            dataset: { action: "complete" }
        });
        const priority = ["high", "normal", "low"].includes(todoItem.priority) ? todoItem.priority : "normal";
        const priorityLabels = { high: "PILNY", normal: "NORMALNY", low: "NISKI" };
        const metadata = [new Date(todoItem.createdAt).toLocaleString("pl-PL")];
        metadata.push(priorityLabels[priority]);
        if (todoItem.dueDate) metadata.push("termin " + String(todoItem.dueDate));

        return SafeDOM.el("div", {
            className: `todo-item priority-${priority}${todoItem.done ? " done" : ""}${todoItem.dueDate && todoItem.dueDate < todayKey && !todoItem.done ? " overdue" : ""}`,
            dataset: { todoId: todoItem.id }
        }, [
            SafeDOM.el("label", { className: "todo-check-target", attrs: { title: "Oznacz wykonane" } }, checkbox),
            SafeDOM.el("div", { className: "ui-row__content" }, [
                SafeDOM.el("div", { className: "text", text: todoItem.text, dataset: { field: "text" } }),
                SafeDOM.el("div", { className: "meta" }, [
                    SafeDOM.el("span", { className: `todo-priority-badge priority-${priority}`, text: priorityLabels[priority] }),
                    SafeDOM.text(" · " + metadata.filter(value => value !== priorityLabels[priority]).join(" · "))
                ])
            ]),
            SafeDOM.el("div", { className: "acts ui-row__actions" }, [
                actionButton("duplicate", "Duplikuj zadanie", "⧉"),
                actionButton("journal", "Dodaj do Journal", "J"),
                actionButton("reminder", "Utwórz przypomnienie", "🔔"),
                actionButton("edit", "Edytuj", "✎"),
                actionButton("archive", "Archiwizuj", "⌄"),
                actionButton("delete", "Usuń", "✕")
            ])
        ]);
    });

    SafeDOM.replace(host, nodes.length ? nodes : SafeDOM.empty("todo-empty", "Brak zadań — dodaj pierwsze powyżej ✓"));
    $("#todoCount").textContent = allItems.filter(todoItem => !todoItem.done).length;
    MODULE_LIFECYCLE?.run("todo", "afterRender", { root: host, state: visibleItems });
}

function renderNotes() {
    ModuleRenderMetrics.mark("notes");
    const host = $("#notesHost");
    if (!host) return;
    const rows = [...CoreModuleState.notes.list()].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.createdAt) - Number(a.createdAt));
    const actionButton = (action, text, ariaLabel, className = "btn sm ghost") => SafeDOM.el("button", {
        className, text, attrs: { type: "button", "aria-label": ariaLabel, title: ariaLabel }, dataset: { action }
    });
    const nodes = rows.map(note => {
        const palette = NOTE_PALETTES.find(item => item.id === note.color) || NOTE_PALETTES[0];
        const colors = NOTE_PALETTES.map(color => SafeDOM.el("button", {
            className: "note-color " + (color.id === note.color ? "active" : ""),
            attrs: { type: "button", "aria-label": "Kolor " + color.id, title: "Kolor " + color.id, "aria-pressed": String(color.id === note.color) },
            dataset: { action: "color", color: color.id }, style: { background: color.swatch }
        }));
        const options = SafeDOM.el("details", { className: "note-options" }, [
            SafeDOM.el("summary", { className: "note-options-toggle", text: "Opcje notatki" }),
            SafeDOM.el("div", { className: "note-colors", attrs: { "aria-label": "Wybierz kolor notatki" } }, colors),
            SafeDOM.el("div", { className: "note-actions" }, [
                actionButton("pin", note.pinned ? "Odepnij" : "Przypnij", note.pinned ? "Odepnij notatkę" : "Przypnij notatkę"),
                actionButton("todo", "→ TODO", "Przenieś do TODO"),
                actionButton("journal", "→ Journal", "Dodaj do Journal"),
                actionButton("delete", "Usuń", "Usuń notatkę", "btn sm danger")
            ])
        ]);
        return SafeDOM.el("article", {
            className: "note-card" + (note.pinned ? " pinned" : ""), dataset: { noteId: note.id },
            style: { "--note-bg": palette.bg, "--note-bd": palette.bd, "--note-fg": palette.fg }
        }, [
            SafeDOM.el("input", { className: "note-title", value: note.title || "", attrs: { maxlength: "100", placeholder: "Tytuł notatki", "aria-label": "Tytuł notatki" }, dataset: { field: "title" } }),
            SafeDOM.el("textarea", { value: note.text || "", attrs: { placeholder: "Treść notatki…", "aria-label": "Treść notatki" }, dataset: { field: "text" } }),
            options
        ]);
    });
    SafeDOM.replace(host, nodes.length ? nodes : SafeDOM.empty("business-empty", "Brak notatek."));
    $("#notesCount").textContent = rows.length;
    MODULE_LIFECYCLE?.run("notes", "afterRender", { root: host, state: rows });
}

function renderJournal(entries) {
        ModuleRenderMetrics.mark("journal");
        const host = $("#journalList");
        if (!host) return;
        const source = Array.isArray(entries) ? entries : CoreModuleState.journal.list(), range = $("#journalRange")?.value || "all", type = $("#journalFilterType")?.value || "all", query = String($("#journalSearch")?.value || "").trim().toLowerCase(), startToday = (() => {
            const d = new Date;
            return d.setHours(0, 0, 0, 0), d.getTime();
        })(), rows = source.filter(x => ("today" === range ? Number(x.createdAt) >= startToday : "all" === range || Number(x.createdAt) >= Date.now() - 864e5 * Number(range)) && ("all" === type || x.type === type) && (!query || String(x.text || "").toLowerCase().includes(query))), resultHost = $("#journalResult");
        resultHost && (resultHost.textContent = `Wyniki: ${rows.length}`);
        if (!rows.length) {
            SafeDOM.replace(host, SafeDOM.empty("journal-empty", "Brak wpisów — zacznij wpisem o tym, co teraz robisz."));
            $("#journalCount").textContent = "0";
            return;
        }
        let last = "";
        const today = (new Date).toDateString(), nodes = [];
        for (const entry of rows) {
            const date = new Date(entry.createdAt), day = date.toDateString();
            if (day !== last) {
                nodes.push(SafeDOM.el("div", { className: "journal-day-head" }, [
                    SafeDOM.el("span", { text: day === today ? "Dziś" : date.toLocaleDateString("pl-PL", { weekday: "long", day: "2-digit", month: "long" }) }),
                    SafeDOM.el("span", { className: "line" })
                ]));
                last = day;
            }
            const textChildren = [];
            entry.type && textChildren.push(SafeDOM.el("span", { className: "badge", text: entry.type }), SafeDOM.text(" "));
            textChildren.push(SafeDOM.text(entry.text || ""));
            nodes.push(SafeDOM.el("div", { className: "journal-item", dataset: { journalId: entry.id } }, [
                SafeDOM.el("span", { className: "ts", text: `${pad(date.getHours())}:${pad(date.getMinutes())}` }),
                SafeDOM.el("span", { className: "text" }, textChildren),
                SafeDOM.el("span", { className: "acts" }, SafeDOM.el("button", { className: "icon-btn", text: "✕", attrs: { type: "button", "aria-label": "Usuń wpis" }, dataset: { action: "delete" } }))
            ]));
        }
        SafeDOM.replace(host, nodes);
        $("#journalCount").textContent = rows.filter(x => new Date(x.createdAt).toDateString() === today).length;
        MODULE_LIFECYCLE?.run("journal", "afterRender", { root: host, state: rows });
    }

function reminderGroup(reminder, now = new Date()) {
    const due = new Date(ReminderTimeService.dueAt(reminder));
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const delta = Math.round((dueDay - start) / 86400000);
    if (due.getTime() < now.getTime()) return "Zaległe";
    if (delta === 0) return "Dziś";
    if (delta === 1) return "Jutro";
    if (delta <= 7) return "W tym tygodniu";
    return "Później";
}
function effectiveReminderLabel(reminder) {
    const due = new Date(ReminderTimeService.dueAt(reminder));
    return due.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function renderCalendarReminderList() {
    ModuleRenderMetrics.mark("calendarReminders");
    const host = $("#calReminderList");
    if (!host) return;
    const allRows = CoreModuleState.calendarReminders.upcoming();
    const displayLimit = 12;
    const rows = allRows.slice(0, displayLimit);
    const groups = new Map();
    rows.forEach(reminder => {
        const label = reminderGroup(reminder);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(reminder);
    });
    const nodes = [];
    for (const [label, reminders] of groups) {
        nodes.push(SafeDOM.el("div", { className: "cal-reminder-group-title", text: label }));
        reminders.forEach(reminder => {
            const snoozed = Number(reminder.snoozedUntil) > Date.now();
            nodes.push(SafeDOM.el("div", {
                className: "cal-reminder-item" + (snoozed ? " snoozed" : "") + (reminderGroup(reminder) === "Zaległe" ? " overdue" : ""),
                dataset: { reminderId: reminder.id }
            }, [
                SafeDOM.el("span", { className: "date", text: effectiveReminderLabel(reminder) }),
                SafeDOM.el("span", { className: "text" }, [
                    snoozed ? SafeDOM.el("span", { className: "badge", text: "ODŁOŻONE" }) : null,
                    SafeDOM.text((snoozed ? " " : "") + String(reminder.text || ""))
                ]),
                SafeDOM.el("span", { className: "actions" }, [
                    SafeDOM.el("button", { className: "icon-btn", text: "+10", attrs: { type: "button", "aria-label": "Odłóż 10 minut", title: "Odłóż 10 min" }, dataset: { action: "snooze" } }),
                    SafeDOM.el("button", { className: "icon-btn", text: "✎", attrs: { type: "button", "aria-label": "Edytuj przypomnienie", title: "Edytuj" }, dataset: { action: "edit" } }),
                    SafeDOM.el("button", { className: "icon-btn", text: "✓", attrs: { type: "button", "aria-label": "Oznacz jako zrobione", title: "Zrobione" }, dataset: { action: "done" } }),
                    SafeDOM.el("button", { className: "icon-btn danger", text: "✕", attrs: { type: "button", "aria-label": "Usuń przypomnienie", title: "Usuń" }, dataset: { action: "delete" } })
                ])
            ]));
        });
    }
    if (allRows.length > displayLimit) nodes.push(SafeDOM.el("button", { className: "btn sm ghost cal-show-all", text: `Pokaż wszystkie (+${allRows.length - displayLimit})`, attrs: { type: "button" }, dataset: { action: "show-all" } }));
    SafeDOM.replace(host, nodes.length ? nodes : SafeDOM.empty("cal-reminder-empty", "Brak aktywnych przypomnień."));
    MODULE_LIFECYCLE?.run("calendarReminders", "afterRender", { root: host, state: rows });
}

function addTodo() {
        const input = $("#todoInput"), item = CoreModuleState.todo.create({
            text: input?.value,
            priority: $("#todoPriority")?.value || "normal",
            dueDate: $("#todoDue")?.value || ""
        });
        return item && input && (input.value = ""), item;
    }

function addNote() {
        const item = CoreModuleState.notes.create({
            color: NOTE_PALETTES[CoreModuleState.notes.list().length % NOTE_PALETTES.length].id
        });
        return item && SchedulerService.scheduleTimeout(() => $('#notesHost [data-note-id="' + CSS.escape(item.id) + '"] textarea')?.focus(), 20), 
        item;
    }

function addJournalEntry() {
        const input = $("#journalInput"), item = CoreModuleState.journal.create({
            text: input?.value,
            type: $("#journalType")?.value || "info"
        });
        return item && input && (input.value = ""), item;
    }

function removeCalendarReminder(id) {
    return !!CoreModuleState.calendarReminders.remove(id);
}

function saveTodos(rows) { return setModuleState("todo", Array.isArray(rows) ? rows : CoreModuleState.todo.list()); }
function saveNotes(rows) { return setModuleState("notes", Array.isArray(rows) ? rows : CoreModuleState.notes.list()); }
function saveJournal(rows) { return setModuleState("journal", Array.isArray(rows) ? rows : CoreModuleState.journal.list()); }
function saveCalendarReminders(rows) { return setModuleState("calendarReminders", Array.isArray(rows) ? rows : CoreModuleState.calendarReminders.list()); }
