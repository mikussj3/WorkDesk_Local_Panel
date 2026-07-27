
function safeRender(moduleId) {
    const mod = MODULE_BY_ID?.[moduleId];
    return mod ? !1 !== safeAction(`render:${moduleId}`, mod.render, {
        fallback: !1,
        context: {
            moduleId: moduleId
        }
    }) : safeAction(`render:${moduleId}`, null, {
        fallback: !1,
        context: {
            moduleId: moduleId
        }
    });
}

function bindCoreModuleContract(moduleId, root, moduleDef) {
    const host = root || document.querySelector(moduleDef.hostSelector);
    if (!host) return !1;
    const core = () => CoreModuleState, rowId = (event, selector, key) => event.target.closest(selector)?.dataset?.[key] || null;
    if ("todo" === moduleId) {
        const addButton = document.querySelector("#todoAddBtn");
        const input = document.querySelector("#todoInput");
        moduleDef.on(addButton, "click", addTodo);
        moduleDef.on(input, "keydown", event => { if (event.key === "Enter") addTodo(); });
        moduleDef.on(document.querySelector("#todoFilter"), "change", () => moduleDef.render());
    } else if ("notes" === moduleId) {
        moduleDef.on(document.querySelector("#noteAddBtn"), "click", addNote);
    } else if ("journal" === moduleId) {
        const addButton = document.querySelector("#journalAdd");
        const input = document.querySelector("#journalInput");
        moduleDef.on(addButton, "click", addJournalEntry);
        moduleDef.on(input, "keydown", event => { if (event.key === "Enter") addJournalEntry(); });
        moduleDef.on(document.querySelector("#journalRange"), "change", () => moduleDef.render());
        moduleDef.on(document.querySelector("#journalFilterType"), "change", () => moduleDef.render());
        moduleDef.on(document.querySelector("#journalSearch"), "input", () => moduleDef.render());
        moduleDef.on(document.querySelector("#journalSummary"), "click", showJournalSummary);
        moduleDef.on(document.querySelector("#journalExport"), "click", exportJournal);
        moduleDef.on(document.querySelector("#journalClear"), "click", clearJournal);
    } else if ("calendarReminders" === moduleId) {
        moduleDef.on(document.querySelector("#calPrev"), "click", () => {
            calCursor.m--;
            if (calCursor.m < 0) { calCursor.m = 11; calCursor.y--; }
            moduleDef.render();
        });
        moduleDef.on(document.querySelector("#calNext"), "click", () => {
            calCursor.m++;
            if (calCursor.m > 11) { calCursor.m = 0; calCursor.y++; }
            moduleDef.render();
        });
        moduleDef.on(document.querySelector("#calToday"), "click", () => {
            const date = new Date();
            calCursor.y = date.getFullYear();
            calCursor.m = date.getMonth();
            moduleDef.render();
        });
        const activateCalendarDay = event => {
            const path = typeof event.composedPath === "function" ? event.composedPath() : [];
            const day = path.find(node => node instanceof Element && node.matches?.(".day:not(.muted)[data-day]")) ||
                (event.target instanceof Element ? event.target.closest(".day:not(.muted)[data-day]") : null);
            if (!day) return;
            event.preventDefault();
            showCalendarDayMenu(event, new Date(calCursor.y, calCursor.m, Number(day.dataset.day)), day);
        };
        moduleDef.on(document.querySelector("#calGrid"), "pointerup", event => {
            if (event.button !== 0) return;
            activateCalendarDay(event);
        });
        moduleDef.on(document.querySelector("#calGrid"), "click", event => {
            if (event.detail !== 0) return;
            activateCalendarDay(event);
        });
    }
    return "todo" === moduleId ? (moduleDef.on(host, "click", async event => {
        const id = rowId(event, "[data-todo-id]", "todoId"), action = event.target.closest("[data-action]")?.dataset.action;
        if (!id || !action) return;
        const api = core()?.todo;
        if (api) if ("delete" === action) api.remove(id); else if ("archive" === action) api.archive(id); else if ("duplicate" === action) {
            const item = api.list().find(x => x.id === id);
            item && api.create({
                ...item,
                id: businessUid(),
                text: item.text + " (kopia)"
            });
        } else if ("journal" === action) api.toJournal(id); else if ("reminder" === action) {
            const date = new Date;
            date.setDate(date.getDate() + 1), api.toReminder(id, dateKeyLocal(date), ensureAppState().modules.userConfig?.defaultReminder || "09:00");
        } else if ("edit" === action) {
            const item = api.list().find(x => x.id === id);
            if (item) {
                const value = await AppDialog.editText({
                    id: "todoEditModal",
                    title: "Edytuj zadanie TODO",
                    description: "Zmień treść zadania i zapisz.",
                    label: "Treść zadania",
                    value: item.text || "",
                    maxLength: StorageLimits.current().todoTextChars || 1e3,
                    confirmLabel: "Zapisz"
                });
                null !== value && value.trim() && api.update(id, {
                    text: value.trim()
                });
            }
        }
    }), moduleDef.on(host, "change", event => {
        const id = rowId(event, "[data-todo-id]", "todoId");
        id && event.target.matches('[data-action="complete"]') && core()?.todo?.complete(id, event.target.checked);
    })) : "notes" === moduleId ? (moduleDef.on(host, "click", event => {
        const id = rowId(event, "[data-note-id]", "noteId"), button = event.target.closest("[data-action]");
        if (!id || !button) return;
        const api = core()?.notes;
        if (!api) return;
        const action = button.dataset.action;
        if ("delete" === action) api.remove(id); else if ("pin" === action) {
            const item = api.list().find(x => x.id === id);
            api.update(id, {
                pinned: !item?.pinned
            });
        } else "todo" === action ? api.toTodo(id) : "journal" === action ? api.toJournal(id) : "color" === action && api.setColor(id, button.dataset.color);
    }), moduleDef.on(host, "input", event => {
        const id = rowId(event, "[data-note-id]", "noteId"), api = core()?.notes;
        id && api && (event.target.matches('[data-field="text"]') ? api.update(id, {
            text: event.target.value
        }, {render: false}) : event.target.matches('[data-field="title"]') && api.update(id, {
            title: event.target.value.slice(0, 100)
        }, {render: false}));
    })) : "journal" === moduleId ? moduleDef.on(host, "click", event => {
        const id = rowId(event, "[data-journal-id]", "journalId");
        id && event.target.closest('[data-action="delete"]') && core()?.journal?.remove(id);
    }) : "calendarReminders" === moduleId && moduleDef.on(host, "click", async event => {
        const id = rowId(event, "[data-reminder-id]", "reminderId"), action = event.target.closest("[data-action]")?.dataset.action, api = core()?.calendarReminders;
        if (action === "show-all") return document.querySelector("#upcomingBtn")?.click();
        if (!id || !action || !api) return;
        if (action === "done") api.done(id);
        else if (action === "snooze") api.snooze(id, 10);
        else if (action === "delete") {
            const item = api.list().find(record => record.id === id);
            if (item && await showConfirmModal(`Czy na pewno chcesz usunąć przypomnienie „${item.text}”?`, {confirmLabel: "Usuń"})) {
                const removed = api.remove(id);
                removed && offerUndo(`undo-reminder-${id}`, "Usunięto przypomnienie", `Usunięto „${removed.text}”.`, () => api.create(removed));
            }
        } else if (action === "edit") {
            const item = api.list().find(record => record.id === id);
            if (item) openReminderEditor(item);
        }
    }), !0;
}

const MODULE_REGISTRY = Object.freeze([ {
    id: "email",
    label: "Email / grupy / znane adresy",
    storageKey: "email",
    defaultData: () => ({
        sections: cloneData(DEFAULT_RUNTIME_DATA.sections || []),
        knownMails: cloneData(DEFAULT_RUNTIME_DATA.knownMails || [])
    }),
    validate(data) {
        const errors = [];
        return data && "object" == typeof data ? (Array.isArray(data.sections) || errors.push("email.sections musi być tablicą."), 
        Array.isArray(data.knownMails) || errors.push("email.knownMails musi być tablicą.")) : errors.push("Moduł email musi być obiektem."), 
        errors;
    },
    migrate(data) {
        return {
            ...this.defaultData(),
            ...data && "object" == typeof data ? data : {}
        };
    },
    export: () => cloneData(ensureAppState().modules.email),
    import(data) {
        ensureAppState().modules.email = cloneData(data);
    },
    render() {
        reconcileSelectedEmailGroups(), renderGroups($("#grpSearch")?.value || "");
    },
    reset() {
        EmailComposerState.clearGroups(), this.import(this.defaultData()), this.render(), persistData();
    }
}, {
    id: "templates",
    label: "Szablony",
    storageKey: "templates",
    defaultData: () => cloneData(DEFAULT_RUNTIME_DATA.templates || []),
    validate: data => Array.isArray(data) ? [] : [ "templates musi być tablicą." ],
    migrate(data) {
        return Array.isArray(data) ? cloneData(data) : this.defaultData();
    },
    export: () => cloneData(ensureAppState().modules.templates),
    import(data) {
        ensureAppState().modules.templates = cloneData(data || []);
    },
    render() {
        renderTemplateList();
    },
    reset() {
        this.import(this.defaultData()), this.render(), persistData();
    }
}, {
    id: "tiles",
    label: "Kafelki",
    storageKey: "tiles",
    defaultData: () => cloneData(DEFAULT_RUNTIME_DATA.tiles || []),
    validate: data => Array.isArray(data) ? [] : [ "tiles musi być tablicą." ],
    migrate(data) {
        return Array.isArray(data) ? cloneData(data) : this.defaultData();
    },
    export: () => cloneData(ensureAppState().modules.tiles),
    import(data) {
        ensureAppState().modules.tiles = cloneData(data || []);
    },
    render() {
        renderTiles();
    },
    reset() {
        this.import(this.defaultData()), this.render(), persistData();
    }
}, {
    id: "frequentLinks",
    label: "Częste linki",
    storageKey: "frequentLinks",
    defaultData: () => cloneData(DEFAULT_RUNTIME_DATA.frequentLinks || []),
    validate: data => Array.isArray(data) ? [] : [ "frequentLinks musi być tablicą." ],
    migrate(data) {
        return Array.isArray(data) ? cloneData(data) : this.defaultData();
    },
    export: () => cloneData(ensureAppState().modules.frequentLinks),
    import(data) {
        ensureAppState().modules.frequentLinks = cloneData(data || []);
    },
    render() {
        renderFlinks();
    },
    reset() {
        this.import(this.defaultData()), this.render(), persistData();
    }
}, {
    id: "todo",
    label: "TODO",
    storageKey: "todos",
    defaultData: () => [],
    validate: data => Array.isArray(data) ? [] : [ "todo musi być tablicą." ],
    migrate: data => Array.isArray(data) ? cloneData(data) : [],
    export: () => cloneData(ensureAppState().modules.todo),
    import(data) {
        replaceArrayContents(todos, data), ensureAppState().modules.todo = todos;
    },
    bind(root) {
        return bindCoreModuleContract("todo", root, this);
    },
    render() {
        renderTodos();
    },
    reset() {
        this.import([]), this.render(), persistData();
    }
}, {
    id: "journal",
    label: "Journal",
    storageKey: "journal",
    defaultData: () => [],
    validate: data => Array.isArray(data) ? [] : [ "journal musi być tablicą." ],
    migrate: data => Array.isArray(data) ? cloneData(data) : [],
    export: () => cloneData(ensureAppState().modules.journal),
    import(data) {
        replaceArrayContents(journal, data), ensureAppState().modules.journal = journal;
    },
    bind(root) {
        return bindCoreModuleContract("journal", root, this);
    },
    render() {
        renderJournal();
    },
    reset() {
        this.import([]), this.render(), persistData();
    }
}, {
    id: "calendarReminders",
    label: "Kalendarz / przypomnienia",
    storageKey: "reminders",
    defaultData: () => [],
    validate: data => Array.isArray(data) ? [] : [ "calendarReminders musi być tablicą." ],
    migrate: data => Array.isArray(data) ? cloneData(data) : [],
    export: () => cloneData(ensureAppState().modules.calendarReminders),
    import(data) {
        replaceArrayContents(calReminders, data), ensureAppState().modules.calendarReminders = calReminders;
    },
    bind(root) {
        return bindCoreModuleContract("calendarReminders", root, this);
    },
    render() {
        renderCalendar();
        renderCalendarReminderList();
    },
    reset() {
        this.import([]), this.render(), persistData();
    }
}, {
    id: "notes",
    label: "Notatki",
    storageKey: "notes",
    defaultData: () => [],
    validate: data => Array.isArray(data) ? [] : [ "notes musi być tablicą." ],
    migrate: data => Array.isArray(data) ? cloneData(data) : [],
    export: () => cloneData(ensureAppState().modules.notes),
    import(data) {
        replaceArrayContents(notes, data), ensureAppState().modules.notes = notes;
    },
    bind(root) {
        return bindCoreModuleContract("notes", root, this);
    },
    render() {
        renderNotes();
    },
    reset() {
        this.import([]), this.render(), persistData();
    }
}, {
    id: "fx",
    label: "Kursy FX / konwerter",
    storageKey: "fx",
    defaultData: () => normalizeFxState(DEFAULT_RUNTIME_DATA.fx || DEFAULT_FX),
    validate: data => data && "object" == typeof data ? [] : [ "fx musi być obiektem." ],
    migrate: data => normalizeFxState(data),
    export: () => normalizeFxState(ensureAppState().modules.fx),
    import(data) {
        ensureAppState().modules.fx = normalizeFxState(data);
    },
    render() {
        syncFxInputsFromData(), recalcConv(), recalcVat();
    },
    reset() {
        this.import(this.defaultData()), this.render(), persistData();
    }
}, {
    id: "snippets",
    label: "Snippety",
    storageKey: "snippets",
    defaultData: () => cloneData(DEFAULT_RUNTIME_DATA.snippets || []),
    validate: data => Array.isArray(data) ? [] : [ "snippets musi być tablicą." ],
    migrate(data) {
        return Array.isArray(data) ? cloneData(data) : this.defaultData();
    },
    export: () => cloneData(ensureAppState().modules.snippets),
    import(data) {
        ensureAppState().modules.snippets = cloneData(data || []);
    },
    render() {},
    reset() {
        this.import(this.defaultData()), this.render(), persistData();
    }
}, {
    id: "emailProfiles",
    label: "Profile e-mail",
    hostSelector: "#emailProfilesModal",
    storageKey: "emailProfiles",
    defaultData: () => [],
    validate: data => function(data) {
        return validateUniqueBusinessRecords(data, "emailProfiles", x => {
            const e = [];
            return x && "object" == typeof x ? (String(x.label || "").trim() || e.push("brak nazwy profilu."), 
            String(x.label || "").length > 120 && e.push("nazwa przekracza 120 znaków."), String(x.body || "").length > 1e5 && e.push("treść przekracza 100000 znaków."), 
            e) : [ "rekord nie jest obiektem." ];
        });
    }(data),
    migrate: data => normalizeEmailProfilesModule(data),
    export: () => cloneData(ensureAppState().modules.emailProfiles || []),
    import(data) {
        ensureAppState().modules.emailProfiles = this.migrate(data);
    },
    render() { return renderEmailProfilesModule(); },
    reset() {
        this.import([]), this.render(), persistData(!0);
    }
}, {
    id: "checklists",
    label: "Checklisty",
    hostSelector: "#checklistsModal",
    storageKey: "checklists",
    defaultData: () => [],
    validate: data => function(data) {
        return validateUniqueBusinessRecords(data, "checklists", x => {
            const e = [];
            if (!x || "object" != typeof x) return [ "rekord nie jest obiektem." ];
            String(x.name || "").trim() || e.push("brak nazwy."), Array.isArray(x.items) && x.items.length || e.push("brak pozycji.");
            const ids = new Set;
            return (x.items || []).forEach(item => {
                item && "object" == typeof item && String(item.id || "") && String(item.text || "").trim() ? ids.has(item.id) ? e.push(`duplikat ID pozycji: ${item.id}`) : ids.add(item.id) : e.push("błędna pozycja checklisty.");
            }), Object.entries(x.daily || {}).forEach(([d, v]) => {
                /^\d{4}-\d{2}-\d{2}$/.test(d) || e.push(`błędna data historii: ${d}`), Array.isArray(v) && !v.some(id => "string" != typeof id || !ids.has(id)) || e.push(`błędne ID historii: ${d}`);
            }), e;
        });
    }(data),
    migrate: data => normalizeChecklistsModule(data),
    export: () => cloneData(ensureAppState().modules.checklists || []),
    import(data) {
        ensureAppState().modules.checklists = this.migrate(data);
    },
    render() { return renderChecklistsModule(); },
    reset() {
        this.import([]), this.render(), persistData(!0);
    }
}, {
    id: "responseCases",
    label: "Sprawy wymagające odpowiedzi",
    hostSelector: "#casesModal",
    storageKey: "responseCases",
    defaultData: () => [],
    validate: data => function(data) {
        return validateUniqueBusinessRecords(data, "responseCases", x => {
            const e = [];
            return x && "object" == typeof x ? (String(x.subject || "").trim() || e.push("brak tematu."), 
            x.due && !/^\d{4}-\d{2}-\d{2}$/.test(x.due) && e.push("błędny termin."), [ "open", "waiting", "done", "cancelled" ].includes(x.status) || e.push("błędny status."), 
            Number.isFinite(Number(x.createdAt)) || e.push("błędna data utworzenia."), e) : [ "rekord nie jest obiektem." ];
        });
    }(data),
    migrate: data => normalizeResponseCasesModule(data),
    export: () => cloneData(ensureAppState().modules.responseCases || []),
    import(data) {
        ensureAppState().modules.responseCases = this.migrate(data);
    },
    render() { return renderResponseCasesModule(); },
    reset() {
        this.import([]), this.render(), persistData(!0);
    }
}, {
    id: "phoneLog",
    label: "Kontakty telefoniczne",
    hostSelector: "#phoneModal",
    storageKey: "phoneLog",
    defaultData: () => [],
    validate: data => function(data) {
        return validateUniqueBusinessRecords(data, "phoneLog", x => {
            const e = [];
            return x && "object" == typeof x ? (String(x.phoneNumber || "").trim() || String(x.contactName || "").trim() || String(x.note || "").trim() || e.push("brak numeru, kontaktu i notatki."),
            x.direction && ![ "incoming", "outgoing", "missed" ].includes(x.direction) && e.push("błędny kierunek połączenia."),
            x.status && ![ "completed", "callback", "noAnswer" ].includes(x.status) && e.push("błędny status połączenia."),
            Number(x.durationSec) < 0 && e.push("błędny czas rozmowy."), String(x.note || "").length > 5e3 && e.push("notatka przekracza 5000 znaków."),
            Number.isFinite(Number(x.at)) || e.push("błędny timestamp."), e) : [ "rekord nie jest obiektem." ];
        });
    }(data),
    migrate: data => normalizePhoneLogModule(data),
    export: () => cloneData(ensureAppState().modules.phoneLog || []),
    import(data) {
        ensureAppState().modules.phoneLog = this.migrate(data);
    },
    render() { return renderPhoneLogModule(); },
    reset() {
        this.import([]), this.render(), persistData(!0);
    }
}, {
    id: "procedures",
    label: "Procedury",
    hostSelector: "#proceduresModal",
    storageKey: "procedures",
    defaultData: () => [],
    validate: data => function(data) {
        return validateUniqueBusinessRecords(data, "procedures", x => {
            const e = [];
            return x && "object" == typeof x ? (String(x.title || "").trim() || e.push("brak tytułu."), 
            String(x.body || "").trim() || e.push("brak treści."), String(x.body || "").length > 3e4 && e.push("treść przekracza 30000 znaków."), 
            e) : [ "rekord nie jest obiektem." ];
        });
    }(data),
    migrate: data => normalizeProceduresModule(data),
    export: () => cloneData(ensureAppState().modules.procedures || []),
    import(data) {
        ensureAppState().modules.procedures = this.migrate(data);
    },
    render() { return renderProceduresModule(); },
    reset() {
        this.import([]), this.render(), persistData(!0);
    }
}, {
    id: "userConfig",
    label: "Konfiguracja użytkownika",
    hostSelector: "#userConfigModal",
    storageKey: "userConfig",
    defaultData: () => normalizeUserConfigModule({}),
    validate: data => function(data) {
        const e = [];
        if (!data || "object" != typeof data) return [ "userConfig musi być obiektem." ];
        String(data.appName || "").trim() || e.push("brak nazwy aplikacji.");
        for (const k of [ "workStart", "workEnd", "defaultReminder" ]) /^\d{2}:\d{2}$/.test(String(data[k] || "")) || e.push(`${k}: błędny format czasu.`);
        return Number(data.pomodoro) >= 5 && Number(data.pomodoro) <= 120 || e.push("pomodoro poza zakresem 5–120."), 
        Number(data.vat) >= 0 && Number(data.vat) <= 100 || e.push("VAT poza zakresem 0–100."), 
        e;
    }(data),
    migrate: data => normalizeUserConfigModule(data),
    export() {
        return cloneData(ensureAppState().modules.userConfig || this.defaultData());
    },
    import(data) {
        ensureAppState().modules.userConfig = this.migrate(data);
    },
    render() { return renderUserConfigModule(); },
    reset() {
        this.import(this.defaultData()), this.render(), persistData(!0);
    }
}, {
    id: "preferences",
    label: "Preferencje / UI state",
    storageKey: "preferences",
    defaultData: () => ({
        theme: null,
        tileOrder: [],
        tilePins: [],
        storageLimits: cloneData(StorageLimits.DEFAULTS)
    }),
    validate(data) {
        const errors = [];
        return data && "object" == typeof data ? (null !== data.theme && "string" != typeof data.theme && errors.push("preferences.theme musi być string albo null."), 
        Array.isArray(data.tileOrder) || errors.push("preferences.tileOrder musi być tablicą."), 
        Array.isArray(data.tilePins) || errors.push("preferences.tilePins musi być tablicą."), 
        null != data.storageLimits && "object" != typeof data.storageLimits && errors.push("preferences.storageLimits musi być obiektem.")) : errors.push("preferences musi być obiektem."), 
        errors;
    },
    migrate: data => normalizePreferences(data),
    export: () => normalizePreferences(ensureAppState().modules.preferences),
    import(data) {
        const prefs = normalizePreferences(data);
        ensureAppState().modules.preferences = cloneData(prefs), void 0 !== pinnedTiles && (pinnedTiles = new Set(prefs.tilePins));
    },
    render() {
        applyTheme(ensureAppState().modules.preferences.theme || detectedTheme()), renderTiles();
    },
    reset() {
        this.import(this.defaultData()), this.render(), persistData();
    }
} ]), MODULE_CONTRACT_METHODS = Object.freeze([ "id", "init", "bind", "render", "serialize", "deserialize", "reset", "teardown", "smokeTest", "getStats" ]);
ModuleRegistry = (() => {
    const definitions = new Map, hosts = new Map, listeners = new Map, register = def => {
        const normalized = (def => {
            if (!def || "string" != typeof def.id || !def.id.trim()) throw new TypeError("ModuleRegistry.register: wymagane id");
            const id = def.id.trim(), hostSelector = def.hostSelector || {
                email: "#email",
                templates: "#email",
                tiles: "#tilesHost",
                frequentLinks: "#flinksHost",
                fx: "#fxEUR",
                snippets: "#snipList",
                todo: "#todoList",
                journal: "#journalList",
                notes: "#notesHost",
                calendarReminders: ".cal-reminders"
            }[id] || `[data-module-host="${id}"]`, wrapped = {
                ...def,
                id: id,
                hostSelector: hostSelector,
                version: Number(def.version) || 1
            };
            return wrapped.init = "function" == typeof def.init ? def.init.bind(wrapped) : () => !0, 
            wrapped.bind = "function" == typeof def.bind ? def.bind.bind(wrapped) : root => (hosts.set(id, root || document.querySelector(hostSelector) || document), 
            !0), wrapped.render = "function" == typeof def.render ? def.render.bind(wrapped) : () => !0, 
            wrapped.serialize = "function" == typeof def.serialize ? def.serialize.bind(wrapped) : "function" == typeof def.export ? def.export.bind(wrapped) : () => cloneData(ensureAppState().modules[id]), 
            wrapped.deserialize = "function" == typeof def.deserialize ? def.deserialize.bind(wrapped) : "function" == typeof def.import ? def.import.bind(wrapped) : data => {
                ensureAppState().modules[id] = cloneData(data);
            }, wrapped.validateImportedState = "function" == typeof def.validateImportedState ? def.validateImportedState.bind(wrapped) : data => {
                const errors = "function" == typeof def.validate ? def.validate(data) : [];
                return {
                    valid: !errors.length,
                    errors: errors
                };
            }, wrapped.teardown = "function" == typeof def.teardown ? def.teardown.bind(wrapped) : () => ((listeners.get(id) || []).forEach(x => x.target.removeEventListener(x.type, x.handler, x.options)), 
            listeners.set(id, []), !0), wrapped.smokeTest = "function" == typeof def.smokeTest ? def.smokeTest.bind(wrapped) : () => {
                const state = wrapped.serialize(), validation = wrapped.validateImportedState(state), hostRequired = ![ "emailProfiles", "checklists", "responseCases", "phoneLog", "procedures", "userConfig", "preferences", "snippets" ].includes(id);
                return {
                    ok: validation.valid && (!hostRequired || !!document.querySelector(hostSelector) || "#email" === hostSelector),
                    id: id,
                    stateValid: validation.valid,
                    hostPresent: !!document.querySelector(hostSelector),
                    hostRequired: hostRequired
                };
            }, wrapped.getStats = "function" == typeof def.getStats ? def.getStats.bind(wrapped) : () => {
                const value = ensureAppState()?.modules?.[id];
                return {
                    id: id,
                    version: wrapped.version,
                    records: Array.isArray(value) ? value.length : value && "object" == typeof value ? Object.keys(value).length : 0,
                    bytes: byteSize(JSON.stringify(value ?? null)),
                    hostPresent: !!document.querySelector(hostSelector)
                };
            }, wrapped.on = (target, type, handler, options) => !(!target || "function" != typeof target.addEventListener || (target.addEventListener(type, handler, options), 
            listeners.has(id) || listeners.set(id, []), listeners.get(id).push({
                target: target,
                type: type,
                handler: handler,
                options: options
            }), 0)), wrapped.export = wrapped.serialize, wrapped.import = wrapped.deserialize, 
            Object.freeze(wrapped);
        })(def);
        if (definitions.has(normalized.id)) throw new Error(`Moduł ${normalized.id} jest już zarejestrowany`);
        return definitions.set(normalized.id, normalized), normalized;
    };
    return MODULE_REGISTRY.forEach(register), Object.freeze({
        register: register,
        get: id => definitions.get(id),
        has: id => definitions.has(id),
        all: () => [ ...definitions.values() ],
        ids: () => [ ...definitions.keys() ],
        contract: MODULE_CONTRACT_METHODS
    });
})(), REGISTERED_MODULES = Object.freeze(ModuleRegistry.all());

!function(modules = REGISTERED_MODULES) {
    const ids = new Set, errors = [];
    if (modules.forEach((mod, index) => {
        Object.isFrozen(mod) || errors.push(`Moduł ${mod?.id || index} nie jest zamrożony.`), 
        ids.has(mod.id) ? errors.push(`Duplikat modułu: ${mod.id}.`) : ids.add(mod.id), 
        MODULE_CONTRACT_METHODS.forEach(key => {
            ("id" === key ? "string" == typeof mod.id && mod.id : "function" == typeof mod[key]) || errors.push(`Moduł ${mod.id || index}: brak kontraktu ${key}.`);
        });
    }), modules.length !== MODULE_REGISTRY.length && errors.push(`Zarejestrowano ${modules.length}/${MODULE_REGISTRY.length} modułów.`), 
    errors.length) throw new Error(`ModuleRegistry contract validation failed\n${errors.join("\n")}`);
}();

const MODULE_BY_ID = Object.freeze(Object.fromEntries(REGISTERED_MODULES.map(mod => [ mod.id, mod ]))), MODULE_PERSISTENCE_MAP = Object.freeze(Object.fromEntries(REGISTERED_MODULES.map(mod => [ mod.id, Object.freeze({
    moduleId: mod.id,
    version: mod.version,
    serialize: () => mod.serialize(),
    deserialize: data => mod.deserialize(data),
    validateImportedState: data => mod.validateImportedState(data)
}) ])));

function validateImportedModules(data) {
    const report = {
        valid: !0,
        modules: {},
        errors: []
    };
    return REGISTERED_MODULES.forEach(mod => {
        if (!Object.prototype.hasOwnProperty.call(data?.modules || {}, mod.id)) return;
        const result = mod.validateImportedState(data.modules[mod.id]), normalized = Array.isArray(result) ? {
            valid: !result.length,
            errors: result
        } : result;
        report.modules[mod.id] = {
            valid: !1 !== normalized.valid,
            errors: normalized.errors || [],
            version: mod.version
        }, report.modules[mod.id].valid || (report.valid = !1, report.modules[mod.id].errors.forEach(error => report.errors.push(`${mod.id}: ${error}`)));
    }), report;
}

