const BusinessActions = (() => {
    const actions = new Map, host = () => document.getElementById("businessActions"), render = () => {
        const root = host();
        root && root.replaceChildren(...[ ...actions.values() ].map(action => {
            const button = document.createElement("button");
            return button.type = "button", button.className = action.className || "btn sm", 
            button.dataset.businessAction = action.id, button.textContent = action.label, button.title = action.title || "", 
            button;
        }));
    };
    var callback;
    return callback = () => delegateEvent(host(), "click", "[data-business-action]", (event, button) => actions.get(button.dataset.businessAction)?.run(event)), 
    "loading" === document.readyState ? EventLifecycle.on(document, "DOMContentLoaded", callback, {
        once: !0
    }) : queueMicrotask(callback), Object.freeze({
        register: action => {
            if (!action?.id || "function" != typeof action.run) throw new TypeError("BusinessActions.register: wymagane id i run");
            actions.set(action.id, Object.freeze({
                ...action
            })), render();
        },
        render: render,
        run: (id, event) => actions.get(id)?.run(event),
        ids: () => [ ...actions.keys() ]
    });
})();

!function() {
    const profiles = () => {
        const state = ensureAppState();
        return state.modules.emailProfiles = normalizeEmailProfilesModule(state.modules.emailProfiles), 
        state.modules.emailProfiles;
    };
    function render() {
        !function() {
            if ($("#emailProfilesModal")) return;
            const m = document.createElement("div");
            m.className = "modal lg", m.id = "emailProfilesModal", m.hidden = !0, m.setAttribute("role", "dialog"), m.setAttribute("aria-label", "Profile wysyłki"), 
            m.innerHTML = '<div class="modal-h"><h3>Profile wysyłki</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="form-grid"><div class="field"><label>Nazwa profilu</label><input id="epName"></div><div class="field"><label>Szablon</label><select id="epTemplate"></select></div><button type="button" class="btn primary" id="epSave">Zapisz bieżący układ</button><div id="epList" class="business-list"></div></div></div>', 
            $("#overlay").appendChild(m);
        }(), SafeDOM.replace($("#epTemplate"), [SafeDOM.el("option", { text: "— bez szablonu —", attrs: { value: "" } }), ...(runtimeData.templates || []).map(template => SafeDOM.el("option", { text: template.name }))]),
        SafeDOM.replace($("#epList"), profiles().length ? profiles().map(profile => SafeDOM.el("div", { className: "business-row", dataset: { emailProfileId: profile.id } }, [
            SafeDOM.el("div", {}, [SafeDOM.el("b", { text: profile.label }), SafeDOM.el("div", { className: "business-meta", text: profile.template || "bez szablonu" })]),
            SafeDOM.el("div", { className: "actions" }, [
                SafeDOM.el("button", { className: "btn sm", text: "Wczytaj", attrs: { type: "button" }, dataset: { load: profile.id } }),
                SafeDOM.el("button", { className: "btn sm", text: "Nadpisz", attrs: { type: "button" }, dataset: { updateProfile: profile.id } }),
                SafeDOM.el("button", { className: "btn sm danger", text: "Usuń", attrs: { type: "button" }, dataset: { del: profile.id } })
            ])
        ])) : SafeDOM.empty("business-empty", "Brak profili.")),
        delegateEvent($("#epList"), "click", "[data-load],[data-update-profile],[data-del]", async (event, b) => {
            b.dataset.load ? function(id) {
                const x = requireBusinessRecord("emailProfiles", id);
                if (!x) return;
                const current = EmailComposerState.read();
                x.template && loadTemplateByName(x.template), EmailComposerState.update({
                    to: x.to || "",
                    cc: x.cc || "",
                    bcc: x.bcc || "",
                    subject: Object.prototype.hasOwnProperty.call(x, "subject") ? x.subject : current.subject,
                    body: Object.prototype.hasOwnProperty.call(x, "body") ? x.body : current.body,
                    signature: Object.prototype.hasOwnProperty.call(x, "signature") ? x.signature : current.signature
                }), EmailComposerState.setMeta({
                    activeProfile: id
                }), scheduleDraftSave(), closeModal(), toast("Wczytano profil.");
            }(b.dataset.load) : b.dataset.updateProfile ? await showConfirmModal("Nadpisać profil bieżącymi ustawieniami?", {
                confirmLabel: "Nadpisz",
                danger: !1
            }) && (AppServices.emailProfiles.update(b.dataset.updateProfile, {
                ...EmailComposerState.read(),
                template: $("#epTemplate").value
            }), render(), toast("Zaktualizowano profil.")) : b.dataset.del && await showConfirmModal("Usunąć profil?", {
                confirmLabel: "Usuń"
            }) && (AppServices.emailProfiles.remove(b.dataset.del), render());
        });
    }
    function save() {
        const label = $("#epName").value.trim();
        if (!label) return toast("Podaj nazwę profilu.", "err");
        AppServices.emailProfiles.create({
            label: label,
            template: $("#epTemplate").value,
            ...EmailComposerState.read()
        }), render(), toast("Zapisano profil.");
    }
    function replaceVars(text) {
        const d = new Date, tom = new Date(Date.now() + 864e5);
        return String(text || "").replace(/\{\{date\}\}/g, d.toLocaleDateString("pl-PL")).replace(/\{\{time\}\}/g, d.toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit"
        })).replace(/\{\{weekday\}\}/g, d.toLocaleDateString("pl-PL", {
            weekday: "long"
        })).replace(/\{\{tomorrow\}\}/g, tom.toLocaleDateString("pl-PL"));
    }
    renderEmailProfilesModule = render;
    const tools = document.createElement("div");
    tools.className = "business-tools", SafeDOM.append(tools, [
        SafeDOM.el("button", { className: "btn sm", text: "Profile wysyłki", attrs: { type: "button", id: "emailProfilesBtn" } }),
        SafeDOM.el("button", { className: "btn sm ghost", text: "Sprawdź wiadomość", attrs: { type: "button", id: "emailPreviewBtn" } })
    ]), 
    $(".email-main")?.prepend(tools), bindEvent($("#emailProfilesBtn"), "click", () => {
        ModuleRegistry.get("emailProfiles").render(), showModal("emailProfilesModal"), SchedulerService.scheduleTimeout(() => bindEvent($("#epSave"), "click", save));
    }), bindEvent($("#emailPreviewBtn"), "click", function() {
        const form = EmailComposerState.read(), previewValues_subject = replaceVars(form.subject), previewValues_body = replaceVars(form.body), emails = (replaceVars(form.signature), 
        [ ...parseEmails(form.to), ...parseEmails(form.cc), ...parseEmails(form.bcc) ]), bad = emails.filter(x => !isValidEmail(x)), placeholders = (form.subject + " " + form.body).match(/\{\{[^}]+\}\}|\[[^\]]+\]/g) || [];
        showInfoDialog("Kontrola wiadomości", `Odbiorcy: ${new Set(emails.map(x => x.toLowerCase())).size}\nBłędne adresy: ${bad.length}\nTemat: ${form.subject ? "jest" : "BRAK"}\nTreść: ${form.body.trim() ? "jest" : "BRAK"}\nPozostawione placeholdery: ${placeholders.length}\n\nTemat po podstawieniu:\n` + previewValues_subject + "\n\nTreść po podstawieniu:\n" + previewValues_body);
    });
}(), delegateEvent($("#calendarReminderTools"), "click", "[data-days]", (event, button) => {
    const d = new Date;
    d.setDate(d.getDate() + Number(button.dataset.days)), openCalendarDayMenu?.(d, button);
}), $("#upcomingBtn")?.addEventListener("click", () => {
    !function() {
        if ($("#upcomingModal")) return;
        const m = document.createElement("div");
        m.className = "modal", m.id = "upcomingModal", m.hidden = !0, m.innerHTML = '<div class="modal-h"><h3>Nadchodzące przypomnienia</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div id="upcomingList" class="business-list"></div></div>', 
        $("#overlay").appendChild(m);
    }();
    const now = Date.now(), cut = now + 6048e5, rows = (calReminders || []).filter(x => {
        const due = ReminderTimeService.dueAt(x);
        return !x.done && due >= now && due <= cut;
    }).sort((a, b) => ReminderTimeService.dueAt(a) - ReminderTimeService.dueAt(b)), host = $("#upcomingList");
    SafeDOM.replace(host, rows.length ? rows.map(reminder => SafeDOM.el("div", { className: "cal-reminder-item", dataset: { reminderId: reminder.id } }, [
        SafeDOM.el("span", { className: "date", text: new Date(ReminderTimeService.dueAt(reminder)).toLocaleString("pl-PL") }),
        SafeDOM.el("span", { className: "text", text: reminder.text }),
        SafeDOM.el("button", { className: "btn sm", text: "+10 min", attrs: { type: "button" }, dataset: { action: "snooze" } })
    ])) : SafeDOM.empty("cal-reminder-empty", "Brak przypomnień w ciągu 7 dni.")),
    bindEvent(host, "click", e => {
        const row = e.target.closest("[data-reminder-id]");
        row && e.target.closest('[data-action="snooze"]') && (CoreModuleState.calendarReminders.snooze(row.dataset.reminderId, 10), 
        $("#upcomingBtn").click());
    });
}), function() {
    const b = document.createElement("button");
    b.className = "btn sm ghost", b.textContent = "Jakość kontaktów", bindEvent(b, "click", function() {
        !function() {
            if ($("#contactQualityModal")) return;
            const m = document.createElement("div");
            m.className = "modal lg", m.id = "contactQualityModal", m.hidden = !0, m.innerHTML = '<div class="modal-h"><h3>Jakość danych kontaktowych</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div id="contactQualityBody"></div></div>', 
            $("#overlay").appendChild(m);
        }();
        const refs = new Map, domains = new Map;
        (runtimeData.sections || []).forEach(s => (s.groups || []).forEach(g => (g.emails || []).forEach(e => {
            const k = e.toLowerCase();
            refs.has(k) || refs.set(k, []), refs.get(k).push(`${s.name}/${g.name}`);
            const d = k.split("@")[1] || "(błędny)";
            domains.set(d, (domains.get(d) || 0) + 1);
        })));
        const dup = [ ...refs ].filter(([, v]) => v.length > 1), typo = [ ...domains ].filter(([d]) => /gmial|outlok|gmai\.com/.test(d));
        SafeDOM.replace($("#contactQualityBody"), [
            SafeDOM.el("div", { className: "business-grid" }, [
                SafeDOM.el("div", { className: "business-card" }, [SafeDOM.el("h4", { text: "Unikalne adresy" }), SafeDOM.text(refs.size)]),
                SafeDOM.el("div", { className: "business-card" }, [SafeDOM.el("h4", { text: "W wielu grupach" }), SafeDOM.text(dup.length)]),
                SafeDOM.el("div", { className: "business-card" }, [SafeDOM.el("h4", { text: "Podejrzane domeny" }), SafeDOM.text(typo.length)])
            ]),
            SafeDOM.el("h4", { text: "Domeny" }),
            SafeDOM.el("div", { className: "business-list" }, [...domains].sort((a, b) => b[1] - a[1]).map(([domain, count]) => SafeDOM.el("div", { className: "business-row" }, [SafeDOM.el("span", { text: domain }), SafeDOM.el("b", { text: count })]))),
            SafeDOM.el("h4", { text: "Powtórzenia" }),
            SafeDOM.el("div", { className: "business-list" }, dup.length ? dup.slice(0, 50).map(([email, groups]) => SafeDOM.el("div", { className: "business-card" }, [SafeDOM.el("b", { text: email }), SafeDOM.el("div", { className: "business-meta", text: groups.join(", ") })])) : SafeDOM.empty("business-empty", "Brak."))
        ]),
        showModal("contactQualityModal");
    }), $(".email-side")?.appendChild(b);
}(), function() {
    const sec = document.createElement("section");
    function render() {
        const today = (new Date).toISOString().slice(0, 10), items = [], overdue = todos.filter(x => !x.done && x.dueDate && x.dueDate < today).length;
        overdue && items.push(`${overdue} zadań po terminie`);
        const rem = (calReminders || []).filter(x => !x.done && x.date === today).length;
        rem && items.push(`${rem} przypomnienia na dziś`), readMeaningfulDraft() && items.push("Niewysłany draft wiadomości");
        const age = latestBackupAge();
        (null === age || age >= 7) && items.push(null === age ? "Brak backupu plikowego" : `Backup sprzed ${age} dni`);
        const usage = StorageService.usage(), pct = Math.round(usage.percent);
        pct >= 70 && items.push(`Storage ${pct}%`), SafeDOM.replace($("#attentionList"), (items.length ? items : ["Brak elementów wymagających uwagi."]).map(text => SafeDOM.el("div", { className: "attention-item", text })));
    }
    sec.className = "business-card", sec.id = "attentionPanel", sec.innerHTML = '<h4>Wymaga uwagi</h4><div class="attention-list" id="attentionList"></div><button type="button" class="btn sm primary" id="startDayBtn">Rozpocznij dzień</button>', 
    $("#dailyStart")?.insertAdjacentElement("afterend", sec), bindEvent($("#startDayBtn"), "click", () => {
        $("#todoPanel")?.scrollIntoView({
            behavior: "smooth"
        }), readMeaningfulDraft() && !emailEl.classList.contains("expanded") && toggleEmail(), 
        toast("Widok dnia przygotowany.");
    }), registerModuleHook("todo", "afterRender", render, "attention-panel"), registerModuleHook("calendarReminders", "afterRender", render, "attention-panel"), 
    render();
}(), function() {
    const cfg = () => ensureAppState().modules.userConfig;
    function apply() {
        const c = cfg();
        applyBuildMetadata();
        const b = document.querySelector(".brand .name b");
        b && (b.textContent = c.appName || APP_NAME), 
        POMO_WORK = 60 * c.pomodoro, pomoRunning || (pomoLeft = POMO_WORK, pomoRender());
        const timer = document.querySelector("#timer");
        timer && (timer.title = `Godziny pracy: ${c.workStart}–${c.workEnd}`);
        const vat = document.querySelector("#vatRate");
        if (vat && !vat.matches(":focus")) {
            if (![ ...vat.options ].some(o => Number(o.value) === Number(c.vat))) {
                const o = document.createElement("option");
                o.value = String(c.vat), o.textContent = String(c.vat), vat.appendChild(o);
            }
            vat.value = String(c.vat), recalcVat?.();
        }
    }
    renderUserConfigModule = apply, apply(), BusinessActions.register({
        id: "settings",
        label: "Ustawienia",
        run: function() {
            !function() {
                if ($("#configModal")) return;
                const m = document.createElement("div");
                m.className = "modal lg", m.id = "configModal", m.hidden = !0, m.innerHTML = '<div class="modal-h"><h3>Konfiguracja aplikacji</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="form-grid"><div class="field"><label>Nazwa aplikacji</label><input id="cfgName" maxlength="80"></div><div class="business-grid"><div class="field"><label>Początek pracy</label><input id="cfgStart" type="time"></div><div class="field"><label>Koniec pracy</label><input id="cfgEnd" type="time"></div><div class="field"><label>Pomodoro (min)</label><input id="cfgPomo" type="number" min="5" max="120"></div><div class="field"><label>Domyślna godzina przypomnienia</label><input id="cfgReminder" type="time"></div><div class="field"><label>VAT %</label><input id="cfgVat" type="number" min="0" max="100"></div></div><div class="business-tools"><button type="button" class="btn primary" id="cfgSave">Zapisz</button><button type="button" class="btn" id="cfgExport">Eksport konfiguracji</button><button type="button" class="btn" id="tileEditor">Dodaj kafelek</button></div></div></div>', 
                $("#overlay").appendChild(m);
            }();
            const c = cfg();
            $("#cfgName").value = c.appName, $("#cfgStart").value = c.workStart, $("#cfgEnd").value = c.workEnd, 
            $("#cfgPomo").value = c.pomodoro, $("#cfgReminder").value = c.defaultReminder, $("#cfgVat").value = c.vat, 
            showModal("configModal"), bindEvent($("#cfgSave"), "click", () => {
                const next = {
                    appName: $("#cfgName").value.trim() || "WorkDesk",
                    workStart: $("#cfgStart").value || "08:00",
                    workEnd: $("#cfgEnd").value || "16:00",
                    pomodoro: Math.min(120, Math.max(5, Number($("#cfgPomo").value) || 25)),
                    defaultReminder: $("#cfgReminder").value || "09:00",
                    vat: Math.min(100, Math.max(0, Number($("#cfgVat").value) || 23))
                };
                ensureAppState().modules.userConfig = normalizeUserConfigModule(next), apply(), 
                requestFullSnapshot(), toast("Zapisano konfigurację.");
            }), bindEvent($("#cfgExport"), "click", () => downloadText(`workdesk-config-v${DATA_SCHEMA_VERSION}.json`, JSON.stringify({
                schemaVersion: DATA_SCHEMA_VERSION,
                exportedAt: (new Date).toISOString(),
                config: {
                    email: {
                        sections: runtimeData.sections,
                        templates: runtimeData.templates
                    },
                    tiles: runtimeData.tiles,
                    frequentLinks: runtimeData.frequentLinks,
                    userConfig: cfg(),
                    preferences: {
                        storageLimits: StorageLimits.current()
                    }
                }
            }, null, 2), "application/json")), bindEvent($("#tileEditor"), "click", () => openTileEditor());
        }
    });
}();

let tileEditorId = null;
function ensureTileEditorModal() {
                !function() {
                    if ($("#tileEditModal")) return;
                    const m = document.createElement("div");
                    m.className = "modal", m.id = "tileEditModal", m.hidden = !0, m.innerHTML = '<div class="modal-h"><h3>Nowy kafelek</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="form-grid"><div class="field"><label>Nazwa</label><input id="teTitle" maxlength="120"></div><div class="field"><label>Opis</label><input id="teDesc" maxlength="300"></div><div class="field"><label>Typ</label><select id="teType"><option value="copy">Kopiuj tekst</option><option value="link">Link lokalny / adres</option></select></div><div class="field"><label>Wartość</label><textarea id="teValue" maxlength="20000"></textarea></div><div class="field"><label>Kategoria</label><input id="teTag" maxlength="60"></div><button type="button" class="btn primary" id="teSave">Dodaj</button></div></div>', 
                    $("#overlay").appendChild(m);
                }();
    bindEvent($("#teSave"), "click", () => {
        const type = $("#teType").value, payload = {
            title: $("#teTitle").value.trim(), desc: $("#teDesc").value.trim(), type,
            tags: [$("#teTag").value.trim()].filter(Boolean),
            ..."link" === type ? { url: $("#teValue").value.trim() } : { value: $("#teValue").value }
        };
        const result = tileEditorId ? AppServices.tiles.update(tileEditorId, payload) : AppServices.tiles.create(payload);
        if (!result.ok) return toast(result.errors.join("; "), "err");
        closeModal(), toast(tileEditorId ? "Zapisano kafelek." : "Dodano kafelek.");
    });
}
function openTileEditor(id = null) {
    ensureTileEditorModal(); tileEditorId = id;
    const tile = id ? AppServices.tiles.list().find(x => x.id === id) : null;
    $("#tileEditModal h3").textContent = tile ? "Edytuj kafelek" : "Nowy kafelek";
    $("#teSave").textContent = tile ? "Zapisz" : "Dodaj";
    $("#teTitle").value = tile?.title || ""; $("#teDesc").value = tile?.desc || "";
    $("#teType").value = tile?.type || "copy"; $("#teValue").value = tile?.type === "link" ? tile.url || "" : tile?.value || "";
    $("#teTag").value = tile?.tags?.[0] || ""; showModal("tileEditModal");
}

function offerUndo(id, title, message, undo) {
    AttentionCenter.notify({ id, title, message, priority: "warning", rank: 70, autoDismissMs: 12000,
        actions: [{ id: "undo", label: "Cofnij", primary: true, run: () => { undo(); AttentionCenter.dismiss(id); toast("Przywrócono element."); } }]
    });
}

!function() {
    const today = () => dateKeyLocal(new Date);
    function reconcileChecklistItems(currentItems, texts) {
        const existing = Array.isArray(currentItems) ? currentItems : [], used = new Set();
        return texts.map((text, index) => {
            let matchIndex = existing.findIndex((item, candidateIndex) => !used.has(candidateIndex) && item.text === text);
            if (matchIndex < 0 && existing[index] && !used.has(index)) matchIndex = index;
            if (matchIndex < 0) return { text };
            used.add(matchIndex);
            return { id: existing[matchIndex].id, text };
        });
    }
    function resetFormMode() {
        const addButton = $("#clAdd");
        if (!addButton) return;
        $("#clName").value = "";
        $("#clItems").value = "";
        delete addButton.dataset.edit;
        addButton.textContent = "Dodaj";
        $("#clCancel").hidden = true;
    }
    function ensureModal() {
        let modal = $("#checklistsModal");
        if (modal) return modal;
        modal = document.createElement("div");
        modal.className = "modal lg";
        modal.id = "checklistsModal";
        modal.hidden = true;
        modal.innerHTML = '<div class="modal-h"><h3>Checklisty</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="business-tools"><input id="clName" class="business-input" maxlength="160" placeholder="Nazwa checklisty"><textarea id="clItems" class="business-input" maxlength="10000" placeholder="Jedna pozycja w wierszu"></textarea><button type="button" class="btn primary" id="clAdd">Dodaj</button><button type="button" class="btn ghost" id="clCancel" hidden>Anuluj edycję</button></div><div id="clList" class="business-list"></div></div>';
        $("#overlay").appendChild(modal);
        bindEvent($("#clCancel"), "click", resetFormMode);
        bindEvent(modal, "click", event => { if (event.target.closest("[data-close]")) resetFormMode(); });
        delegateEvent($("#clList"), "change", "[data-c]", (event, checkbox) => {
            AppServices.checklists.toggle(checkbox.dataset.c, today(), String(checkbox.dataset.i), checkbox.checked);
            toast("Zapisano checklistę.");
        });
        delegateEvent($("#clList"), "click", "[data-del-cl],[data-edit-cl]", async (event, button) => {
            if (button.dataset.delCl) {
                const record = requireBusinessRecord("checklists", button.dataset.delCl);
                if (!record || !await showConfirmModal(`Usunąć checklistę „${record.name}”?`, { confirmLabel: "Usuń" })) return;
                const snapshot = AppServices.checklists.remove(record.id);
                if ($("#clAdd").dataset.edit === record.id) resetFormMode();
                snapshot && offerUndo(`undo-checklist-${record.id}`, "Usunięto checklistę", `Usunięto „${record.name}”.`, () => AppServices.checklists.restore(snapshot));
                return;
            }
            const record = requireBusinessRecord("checklists", button.dataset.editCl);
            if (!record) return;
            $("#clName").value = record.name;
            $("#clItems").value = record.items.map(item => item.text).join("\n");
            $("#clAdd").textContent = "Zapisz";
            $("#clAdd").dataset.edit = record.id;
            $("#clCancel").hidden = false;
        });
        bindEvent($("#clAdd"), "click", () => {
            const name = $("#clName").value.trim();
            const texts = $("#clItems").value.split(/\n|;/).map(value => value.trim()).filter(Boolean).slice(0, 100);
            if (!name || !texts.length) return toast("Podaj nazwę i pozycje.", "err");
            const editId = $("#clAdd").dataset.edit;
            if (editId) {
                const current = requireBusinessRecord("checklists", editId);
                if (!current) return resetFormMode();
                const items = reconcileChecklistItems(current.items, texts);
                AppServices.checklists.update(editId, { name, items, daily: current.daily || {} });
                toast("Zaktualizowano checklistę.");
            } else {
                if (!AppServices.checklists.create({ name, items: texts, daily: {} })) return;
                toast("Dodano checklistę.");
            }
            resetFormMode(); render();
        });
        return modal;
    }
    function cleanupHistory() {
        const cutoff = dateKeyLocal(new Date(Date.now() - 2592e6));
        let changed = false;
        ensureAppState().modules.checklists.forEach(checklist => {
            Object.keys(checklist.daily || {}).filter(date => date < cutoff).forEach(date => { delete checklist.daily[date]; changed = true; });
        });
        if (changed) requestFullSnapshot();
    }
    function render() {
        ensureModal();
        const date = today();
        const rows = ensureAppState().modules.checklists;
        SafeDOM.replace($("#clList"), rows.length ? rows.map(checklist => SafeDOM.el("div", { className: "business-card", dataset: { businessRecordId: checklist.id } }, [
            SafeDOM.el("div", { className: "business-row" }, [
                SafeDOM.el("h4", { text: checklist.name }),
                SafeDOM.el("div", { className: "actions" }, [
                    SafeDOM.el("button", { className: "btn sm", text: "Edytuj", attrs: { type: "button" }, dataset: { editCl: checklist.id } }),
                    SafeDOM.el("button", { className: "btn sm danger", text: "Usuń", attrs: { type: "button" }, dataset: { delCl: checklist.id } })
                ])
            ]),
            SafeDOM.el("div", { className: "checklist-items" }, checklist.items.map(item => SafeDOM.el("label", { className: "checkbox" }, [
                SafeDOM.el("input", { checked: (checklist.daily?.[date] || []).includes(item.id), attrs: { type: "checkbox" }, dataset: { c: checklist.id, i: item.id } }),
                SafeDOM.text(item.text)
            ])))
        ])) : SafeDOM.empty("business-empty", "Brak checklist."));
    }
    renderChecklistsModule = render;
    BusinessActions.register({ id: "checklists", label: "Checklisty", run() { ensureModal(); resetFormMode(); cleanupHistory(); ModuleRegistry.get("checklists").render(); showModal("checklistsModal"); } });
}(), function() {
    let filter = "open";
    const STATUS_LABELS = { open: "otwarta", waiting: "oczekuje", done: "zakończona", cancelled: "anulowana" };
    function resetFormMode() {
        const addButton = $("#caseAdd");
        if (!addButton) return;
        $("#caseFrom").value = "";
        $("#caseSubject").value = "";
        $("#caseDue").value = "";
        $("#caseStatus").value = "open";
        delete addButton.dataset.edit;
        addButton.textContent = "Dodaj";
        $("#caseCancel").hidden = true;
    }
    function ensureModal() {
        let modal = $("#casesModal");
        if (modal) return modal;
        modal = document.createElement("div"); modal.className = "modal lg"; modal.id = "casesModal"; modal.hidden = true;
        modal.innerHTML = '<div class="modal-h"><h3>Sprawy wymagające odpowiedzi</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="business-tools"><input id="caseFrom" class="business-input" maxlength="300" placeholder="Od kogo"><input id="caseSubject" class="business-input" maxlength="1000" placeholder="Temat"><input id="caseDue" class="business-input" type="date"><select id="caseStatus" class="business-input"><option value="open">Otwarta</option><option value="waiting">Oczekuje</option><option value="done">Zakończona</option><option value="cancelled">Anulowana</option></select><button type="button" id="caseAdd" class="btn primary">Dodaj</button><button type="button" id="caseCancel" class="btn ghost" hidden>Anuluj edycję</button><select id="caseFilter" class="business-input"><option value="open">Otwarte</option><option value="waiting">Oczekujące</option><option value="done">Zakończone</option><option value="cancelled">Anulowane</option><option value="all">Wszystkie</option></select></div><div id="caseList" class="business-list"></div></div>';
        $("#overlay").appendChild(modal);
        bindEvent($("#caseFilter"), "change", () => { filter = $("#caseFilter").value; render(); });
        bindEvent($("#caseCancel"), "click", resetFormMode);
        bindEvent(modal, "click", event => { if (event.target.closest("[data-close]")) resetFormMode(); });
        bindEvent($("#caseAdd"), "click", () => {
            const subject = $("#caseSubject").value.trim();
            if (!subject) return toast("Podaj temat sprawy.", "err");
            const payload = { from: $("#caseFrom").value.trim(), subject, due: $("#caseDue").value, status: $("#caseStatus").value };
            const editId = $("#caseAdd").dataset.edit;
            const saved = editId ? AppServices.responseCases.update(editId, payload) : (ensureAppState().modules.responseCases.length >= 1000 ? null : AppServices.responseCases.create(payload));
            if (!saved) return toast(editId ? "Nie udało się zaktualizować sprawy." : "Osiągnięto limit spraw.", "err");
            filter = saved.status; $("#caseFilter").value = filter;
            toast(editId ? "Zaktualizowano sprawę." : `Dodano sprawę w kategorii „${STATUS_LABELS[saved.status]}”.`);
            resetFormMode(); render();
        });
        delegateEvent($("#caseList"), "click", "[data-edit-case],[data-status-case],[data-del-case],[data-case-todo],[data-case-reminder],[data-case-journal]", async (event, button) => {
            const id = button.dataset.editCase || button.dataset.statusCase || button.dataset.delCase || button.dataset.caseTodo || button.dataset.caseReminder || button.dataset.caseJournal;
            const record = requireBusinessRecord("responseCases", id); if (!record) return;
            if (button.dataset.caseTodo) { const created = BusinessWorkflow.caseToTodo(record.id); render(); return toast(created ? "Utworzono powiązane TODO." : "Nie udało się utworzyć TODO.", created ? "ok" : "err"); }
            if (button.dataset.caseReminder) { const created = BusinessWorkflow.caseToReminder(record.id); render(); return toast(created ? "Utworzono powiązane przypomnienie." : "Nie udało się utworzyć przypomnienia.", created ? "ok" : "err"); }
            if (button.dataset.caseJournal) { const created = BusinessWorkflow.caseToJournal(record.id); render(); return toast(created ? "Dodano powiązany wpis do dziennika." : "Nie udało się dodać wpisu.", created ? "ok" : "err"); }
            if (button.dataset.editCase) {
                $("#caseFrom").value = record.from; $("#caseSubject").value = record.subject; $("#caseDue").value = record.due; $("#caseStatus").value = record.status;
                $("#caseAdd").dataset.edit = record.id; $("#caseAdd").textContent = "Zapisz"; $("#caseCancel").hidden = false; return;
            }
            if (button.dataset.statusCase) { AppServices.responseCases.setStatus(record.id, button.dataset.nextStatus); render(); toast("Zmieniono status sprawy."); return; }
            if (await showConfirmModal(`Usunąć sprawę „${record.subject}”?`, { confirmLabel: "Usuń" })) {
                const snapshot = AppServices.responseCases.remove(record.id);
                if ($("#caseAdd").dataset.edit === record.id) resetFormMode();
                snapshot && offerUndo(`undo-case-${record.id}`, "Usunięto sprawę", `Usunięto „${record.subject}”.`, () => AppServices.responseCases.restore(snapshot));
            }
        });
        return modal;
    }
    function render() {
        ensureModal();
        const todayKey = dateKeyLocal(new Date());
        const statusOrder = { open: 0, waiting: 1, done: 2, cancelled: 3 };
        const rows = ensureAppState().modules.responseCases
            .filter(item => filter === "all" || item.status === filter)
            .sort((a, b) => {
                const aOverdue = Boolean(a.due && a.due < todayKey && !["done", "cancelled"].includes(a.status));
                const bOverdue = Boolean(b.due && b.due < todayKey && !["done", "cancelled"].includes(b.status));
                if (aOverdue !== bOverdue) return Number(bOverdue) - Number(aOverdue);
                const dueCompare = (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31");
                if (dueCompare) return dueCompare;
                const statusCompare = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
                return statusCompare || Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt);
            });
        SafeDOM.replace($("#caseList"), rows.length ? rows.map(item => SafeDOM.el("div", { className: `business-row ${!["done", "cancelled"].includes(item.status) && item.due && item.due < todayKey ? "business-overdue" : ""}`.trim(), dataset: { businessRecordId: item.id } }, [
            SafeDOM.el("div", {}, [SafeDOM.el("b", { text: item.subject }), SafeDOM.el("div", { className: "business-meta", text: `${item.from || ""} · ${item.due || "bez terminu"} · ${STATUS_LABELS[item.status]} · zmiana ${new Date(item.updatedAt || item.createdAt).toLocaleString("pl-PL")}` }), BusinessWorkflow.linksView(item, {moduleId: "responseCases", recordId: item.id})]),
            SafeDOM.el("div", { className: "actions" }, [
                SafeDOM.el("button", { className: "btn sm", text: "→ TODO", attrs: { type: "button" }, dataset: { caseTodo: item.id } }),
                SafeDOM.el("button", { className: "btn sm", text: "→ Przypomnienie", attrs: { type: "button" }, dataset: { caseReminder: item.id } }),
                SafeDOM.el("button", { className: "btn sm", text: "→ Dziennik", attrs: { type: "button" }, dataset: { caseJournal: item.id } }),
                SafeDOM.el("button", { className: "btn sm", text: "Edytuj", attrs: { type: "button" }, dataset: { editCase: item.id } }),
                ...item.status !== "waiting" ? [SafeDOM.el("button", { className: "btn sm", text: "Oczekuje", attrs: { type: "button" }, dataset: { statusCase: item.id, nextStatus: "waiting" } })] : [],
                ...item.status !== "done" ? [SafeDOM.el("button", { className: "btn sm", text: "Zakończ", attrs: { type: "button" }, dataset: { statusCase: item.id, nextStatus: "done" } })] : [],
                ...item.status !== "cancelled" ? [SafeDOM.el("button", { className: "btn sm", text: "Anuluj", attrs: { type: "button" }, dataset: { statusCase: item.id, nextStatus: "cancelled" } })] : [],
                ...item.status !== "open" ? [SafeDOM.el("button", { className: "btn sm", text: "Otwórz", attrs: { type: "button" }, dataset: { statusCase: item.id, nextStatus: "open" } })] : [],
                SafeDOM.el("button", { className: "btn sm danger", text: "Usuń", attrs: { type: "button" }, dataset: { delCase: item.id } })
            ])
        ])) : SafeDOM.empty("business-empty", "Brak spraw dla wybranego filtra."));
    }
    renderResponseCasesModule = render;
    BusinessActions.register({ id: "responseCases", label: "Sprawy", run() { ensureModal(); resetFormMode(); $("#caseFilter").value = filter; ModuleRegistry.get("responseCases").render(); showModal("casesModal"); } });
}();
