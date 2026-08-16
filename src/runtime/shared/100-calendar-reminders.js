
const ReminderTimeService = (() => {
    const timestamp = reminder => [ Number(reminder?.snoozedUntil), Number(reminder?.dueAt) ].find(Number.isFinite) || new Date(`${reminder?.date || dateKeyLocal(new Date())}T${reminder?.time || ensureAppState().modules.userConfig?.defaultReminder || "09:00"}:00`).getTime();
    return Object.freeze({
        dueAt: timestamp,
        snooze: function(reminder, minutes = 10) {
            return reminder.snoozedUntil = Math.max(Date.now(), timestamp(reminder)) + 6e4 * Math.max(1, Number(minutes) || 10), 
            reminder;
        },
        addLocalDays(date, days) {
            const value = new Date(date);
            return value.setDate(value.getDate() + Number(days || 0)), value;
        },
        shouldNotify: (reminder, now = Date.now(), cooldown = 6e4) => timestamp(reminder) <= now && (!reminder.lastNotifiedAt || now - reminder.lastNotifiedAt > cooldown),
        audit: () => ({
            ok: !0,
            integrated: !0
        })
    });
})();

let calDayMenu = null, calReminders = bootstrapModule("calendarReminders", []);


function dateKeyLocal(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function datePL(date) {
    return pad(date.getDate()) + "." + pad(date.getMonth() + 1) + "." + date.getFullYear();
}


function addDaysLocal(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function reminderDateTime(r) {
    return new Date(ReminderTimeService.dueAt(r));
}

function activeRemindersForDate(key) {
    return calReminders.filter(r => r.date === key && !r.done).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function createCalendarDayMenu() {
    const el = document.createElement("div");
    return el.id = "calDayMenu", el.className = "cal-day-menu", document.body.appendChild(el), 
    UIRuntime.register({
        id: el.id,
        el: el,
        priority: 45,
        modal: !1,
        opener: $("#calGrid")
    }), el;
}

function hideCalendarDayMenu() {
    calDayMenu && UIRuntime.close(calDayMenu.id, {
        reason: "calendar-close",
        restoreFocus: !1
    });
}

async function copyCalculatedDate(label, date) {
    const value = datePL(date), ok = await copyToClipboard(value);
    toast(ok ? `${label}: ${value} skopiowano.` : "Nie udało się skopiować daty.", ok ? "ok" : "err");
}

function showCalendarDayMenu(ev, date, opener = null) {
    const menu = calDayMenu || (calDayMenu = createCalendarDayMenu());
    const reminders = activeRemindersForDate(dateKeyLocal(date));
    const actionButton = (action, text) => SafeDOM.el("button", {
        className: "menu-item", text, attrs: { type: "button" }, dataset: { act: action }
    });
    SafeDOM.replace(menu, [
        SafeDOM.el("div", { className: "menu-head" }, [
            SafeDOM.el("div", { className: "menu-date", text: datePL(date) }),
            SafeDOM.el("div", { className: "menu-sub", text: date.toLocaleDateString("pl-PL", {
                weekday: "long", day: "2-digit", month: "long", year: "numeric"
            }) })
        ]),
        reminders.length ? SafeDOM.el("div", { className: "menu-reminders" }, reminders.map(reminder =>
            SafeDOM.el("div", { className: "menu-reminder", text: `🔔 ${reminder.time} — ${reminder.text}` })
        )) : null,
        actionButton("copy", "📋 Kopiuj datę"), actionButton("email", "✉️ Dodaj do treści email"),
        actionButton("todo", "✅ Dodaj do TO DO"), actionButton("note", "📝 Utwórz notatkę"),
        actionButton("journal", "📓 Dodaj do Journal"), actionButton("reminder", "🔔 Ustaw przypomnienie"),
        SafeDOM.el("div", { className: "menu-sep" }), actionButton("plus7", "📅 +7 dni"),
        actionButton("plus14", "📅 +14 dni"), actionButton("eom", "📅 Koniec miesiąca")
    ]);
    delegateEvent(menu, "click", "[data-act]", async (_event, button) => {
        const act = button.dataset.act, ds = datePL(date);
        if (act === "copy") {
            const ok = await copyToClipboard(ds); toast(ok ? `Skopiowano datę: ${ds}` : "Nie udało się skopiować daty.", ok ? "ok" : "err"); hideCalendarDayMenu();
        } else if (act === "email") {
            const body = $("#fBody"); emailEl.classList.contains("expanded") || toggleEmail(); body.focus();
            const from = body.selectionStart ?? body.value.length, to = body.selectionEnd ?? body.value.length;
            body.value = body.value.slice(0, from) + ds + body.value.slice(to); body.setSelectionRange(from + ds.length, from + ds.length);
            updateCharBadge(); scheduleDraftSave(); toast(`Dodano datę do treści email: ${ds}`); hideCalendarDayMenu();
        } else if (act === "todo") {
            const input = $("#todoInput"); if (input) { input.value = `Termin: ${ds} — `; input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            toast("Wstawiono datę do pola TO DO — dopisz szczegóły i zatwierdź."); hideCalendarDayMenu();
        } else if (act === "note") {
            const text = `${ds}\n\n`; if (canAddRecord("notes", notes.length) && enforceTextBytes(text, StorageLimits.current().noteBytes, "Notatka")) {
                AppServices.note.create({ color: NOTE_PALETTES[notes.length % NOTE_PALETTES.length].id, text, createdAt: Date.now() });
            }
            toast("Utworzono notatkę z datą."); hideCalendarDayMenu();
        } else if (act === "journal") {
            const input = $("#journalInput"); if (input) { input.value = `${ds} — `; input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            toast("Wstawiono datę do pola Journal — dopisz szczegóły i zatwierdź."); hideCalendarDayMenu();
        } else if (act === "reminder") {
            showReminderForm(date);
        } else if (act === "plus7") { await copyCalculatedDate("+7 dni", addDaysLocal(date, 7)); hideCalendarDayMenu();
        } else if (act === "plus14") { await copyCalculatedDate("+14 dni", addDaysLocal(date, 14)); hideCalendarDayMenu();
        } else if (act === "eom") { await copyCalculatedDate("Koniec miesiąca", new Date(date.getFullYear(), date.getMonth() + 1, 0)); hideCalendarDayMenu(); }
    });
    positionCalendarMenu(ev, opener || ev?.currentTarget || ev?.target);
}

function showReminderForm(date) {
    const menu = calDayMenu || (calDayMenu = createCalendarDayMenu());
    const dateLabel = datePL(date), now = new Date;
    const defaultTime = pad(Math.max(8, now.getHours())) + ":" + pad(now.getMinutes());
    const time = SafeDOM.el("input", { attrs: { id: "calRemTime", type: "time" }, value: defaultTime });
    const text = SafeDOM.el("input", { attrs: { id: "calRemText", type: "text", placeholder: "Np. Zadzwonić do przewoźnika", maxlength: StorageLimits.current().reminderTextChars } });
    const cancel = SafeDOM.el("button", { className: "btn sm ghost", text: "Anuluj", attrs: { type: "button" } });
    const save = SafeDOM.el("button", { className: "btn sm primary", text: "Zapisz", attrs: { type: "button" } });
    SafeDOM.replace(menu, [
        SafeDOM.el("div", { className: "menu-head" }, [SafeDOM.el("div", { className: "menu-date", text: `🔔 Przypomnienie: ${dateLabel}` }), SafeDOM.el("div", { className: "menu-sub", text: "Wpisz godzinę i krótką notatkę." })]),
        SafeDOM.el("div", { className: "cal-rem-form" }, [
            SafeDOM.el("div", {}, [SafeDOM.el("label", { text: "Godzina", attrs: { for: "calRemTime" } }), time]),
            SafeDOM.el("div", {}, [SafeDOM.el("label", { text: "Treść", attrs: { for: "calRemText" } }), text]),
            SafeDOM.el("div", { className: "form-actions" }, [cancel, save])
        ])
    ]);
    bindEvent(cancel, "click", hideCalendarDayMenu);
    bindEvent(save, "click", () => {
        const value = text.value.trim(), limits = StorageLimits.current();
        if (!value) return toast("Wpisz treść przypomnienia.", "err");
        if (!canAddRecord("calendarReminders", calReminders.length)) return;
        if (value.length > limits.reminderTextChars) return toast(`Tekst przypomnienia przekracza limit ${limits.reminderTextChars} znaków.`, "err");
        if (AppServices.reminder.create({ date: dateKeyLocal(date), time: time.value || ensureAppState().modules.userConfig?.defaultReminder || "09:00", text: value, done: false, createdAt: Date.now() })) {
            hideCalendarDayMenu(); checkCalendarReminders(); toast(`Dodano przypomnienie: ${dateLabel} ${time.value}`);
        }
    });
    SchedulerService.scheduleTimeout(() => text.focus(), 30, { owner: "reminder-editor", key: "focus-text" });
}

function openReminderEditor(reminder) {
    let modal = document.getElementById("reminderEditorModal");
    if (!modal) {
        modal = SafeDOM.el("section", { className: "modal", attrs: { id: "reminderEditorModal", hidden: true, role: "dialog", "aria-label": "Edytuj przypomnienie" } });
        document.getElementById("overlay")?.append(modal);
    }
    const dateInput = SafeDOM.el("input", { value: reminder.date || dateKeyLocal(new Date()), attrs: { type: "date", "aria-label": "Data przypomnienia" } });
    const timeInput = SafeDOM.el("input", { value: reminder.time || "09:00", attrs: { type: "time", "aria-label": "Godzina przypomnienia" } });
    const textInput = SafeDOM.el("input", { value: reminder.text || "", attrs: { type: "text", maxlength: StorageLimits.current().reminderTextChars, "aria-label": "Treść przypomnienia" } });
    const cancel = SafeDOM.el("button", { className: "btn ghost", text: "Anuluj", attrs: { type: "button", "data-close": "reminderEditorModal" } });
    const save = SafeDOM.el("button", { className: "btn primary", text: "Zapisz", attrs: { type: "button" } });
    SafeDOM.replace(modal, [
        SafeDOM.el("div", { className: "modal-h" }, [SafeDOM.el("h3", { text: "Edytuj przypomnienie" }), SafeDOM.el("button", { className: "icon-btn x", text: "✕", attrs: { type: "button", "aria-label": "Zamknij", "data-close": "reminderEditorModal" } })]),
        SafeDOM.el("div", { className: "modal-b form-grid" }, [
            SafeDOM.el("label", {}, [SafeDOM.el("span", { text: "Data" }), dateInput]),
            SafeDOM.el("label", {}, [SafeDOM.el("span", { text: "Godzina" }), timeInput]),
            SafeDOM.el("label", {}, [SafeDOM.el("span", { text: "Treść" }), textInput])
        ]),
        SafeDOM.el("div", { className: "modal-f" }, [cancel, save])
    ]);
    bindEvent(save, "click", () => {
        const text = textInput.value.trim();
        if (!text || !validDateISO(dateInput.value) || !validTime(timeInput.value)) return toast("Uzupełnij poprawną datę, godzinę i treść.", "err");
        CoreModuleState.calendarReminders.update(reminder.id, { text, date: dateInput.value, time: timeInput.value, snoozedUntil: 0, lastNotifiedAt: 0 });
        closeModal("reminderEditorModal"); toast("Zapisano przypomnienie.");
    });
    showModal(modal); SchedulerService.scheduleTimeout(() => textInput.focus(), 20, {owner:"reminder-editor",key:"focus"});
}

function positionCalendarMenu(event, opener) {
    const menu = calDayMenu || (calDayMenu = createCalendarDayMenu());
    const anchor = opener instanceof Element ? opener : document.getElementById("calGrid");
    menu.style.left = "0px";
    menu.style.top = "0px";
    UIRuntime.open("calendar-menu", menu, { opener: anchor, priority: 45 });
    const menuRect = menu.getBoundingClientRect();
    const anchorRect = anchor?.getBoundingClientRect?.();
    const pointerX = Number(event?.clientX);
    const pointerY = Number(event?.clientY);
    const x = Number.isFinite(pointerX) && pointerX > 0 ? pointerX : (anchorRect?.left || 8) + Math.min(anchorRect?.width || 0, 24);
    const y = Number.isFinite(pointerY) && pointerY > 0 ? pointerY : (anchorRect?.bottom || 8);
    menu.style.left = `${Math.max(8, Math.min(x + 8, window.innerWidth - menuRect.width - 12))}px`;
    menu.style.top = `${Math.max(8, Math.min(y + 8, window.innerHeight - menuRect.height - 12))}px`;
}




function checkCalendarReminders() {
    const now = Date.now();
    let changed = !1;
    const rows = ensureAppState()?.modules?.calendarReminders || calReminders;
    rows.forEach(r => {
        if (r.done) return;
        const due = ReminderTimeService.dueAt(r);
        Number.isFinite(due) && due <= now && ReminderTimeService.shouldNotify(r, now, 6e4) && (r.lastNotifiedAt = now, 
        changed = !0, function(r) {
            const wrap = $("#toasts");
            if (!wrap) return;
            wrap.querySelector(`[data-reminder-toast="${CSS.escape(r.id)}"]`)?.remove();
            const el = document.createElement("div");
            el.className = "toast reminder ok", el.dataset.reminderToast = r.id;
            const content = document.createElement("div");
            content.className = "toast-content";
            const title = document.createElement("span");
            title.className = "toast-title", title.textContent = `Przypomnienie · ${r.time || new Date(ReminderTimeService.dueAt(r)).toLocaleTimeString("pl-PL", {
                hour: "2-digit",
                minute: "2-digit"
            })}`;
            const message = document.createElement("span");
            message.className = "toast-text", message.textContent = r.text || "";
            const actions = document.createElement("span");
            actions.className = "toast-actions";
            const snooze = document.createElement("button");
            snooze.className = "toast-action", snooze.type = "button", snooze.textContent = "Odłóż 10 min";
            const done = document.createElement("button");
            done.className = "toast-action", done.type = "button", done.textContent = "Zrobione", 
            snooze.addEventListener("click", () => {
                CoreModuleState.calendarReminders.snooze(r.id, 10), el.remove(), toast("Odłożono przypomnienie o 10 minut.");
            }), done.addEventListener("click", () => {
                CoreModuleState.calendarReminders.done(r.id), el.remove(), toast("Przypomnienie oznaczone jako wykonane.");
            }), actions.append(snooze, done), content.append(title, message, actions), el.append(content),
            wrap.append(el), SchedulerService.scheduleTimeout(() => el.remove(), 1e4, { owner: "reminder-toast", key: `auto-remove-${r.id}` });
        }(r));
    }), changed && (saveCalendarReminders(rows), renderCalendarReminderList());
}

let calCursor = function() {
    const d = new Date;
    return {
        y: d.getFullYear(),
        m: d.getMonth()
    };
}();

function polishHolidays(year) {
    const holidays = new Set([ "01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-25", "12-26" ]), easter = function(year) {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), h = (19 * a + b - d - Math.floor((b - f + 1) / 3) + 15) % 30, L = (32 + 2 * e + 2 * Math.floor(c / 4) - h - c % 4) % 7, mm = Math.floor((a + 11 * h + 22 * L) / 451), month = Math.floor((h + L - 7 * mm + 114) / 31);
        return new Date(year, month - 1, (h + L - 7 * mm + 114) % 31 + 1);
    }(year), add = date => holidays.add(pad(date.getMonth() + 1) + "-" + pad(date.getDate()));
    return add(easter), add(new Date(easter.getTime() + 864e5)), add(new Date(easter.getTime() + 42336e5)), 
    add(new Date(easter.getTime() + 5184e6)), holidays;
}

function renderCalendar() {
    const grid = $("#calGrid"), today = new Date;
    const todayKey = dateKeyLocal(today), holidays = polishHolidays(calCursor.y), first = new Date(calCursor.y, calCursor.m, 1);
    const monthLabel = first.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
    $("#calTitle").textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    $("#calLabel").textContent = first.toLocaleDateString("pl-PL", { month: "short" });
    const cells = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map(text => SafeDOM.el("div", { className: "dow", text }));
    const startOffset = (first.getDay() + 6) % 7, daysInMonth = new Date(calCursor.y, calCursor.m + 1, 0).getDate(), prevDays = new Date(calCursor.y, calCursor.m, 0).getDate();
    for (let index = startOffset - 1; index >= 0; index--) cells.push(SafeDOM.el("div", { className: "day muted", text: prevDays - index }));
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(calCursor.y, calCursor.m, day), fullKey = dateKeyLocal(date), mmdd = pad(calCursor.m + 1) + "-" + pad(day);
        const classes = ["day"], hasReminder = activeRemindersForDate(fullKey).length > 0, dow = date.getDay();
        if (todayKey === fullKey) classes.push("today");
        if (holidays.has(mmdd)) classes.push("hol"); else if (dow === 0 || dow === 6) classes.push("weekend");
        if (hasReminder) classes.push("has-reminder");
        const title = date.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" }) + (hasReminder ? " — przypomnienie" : "");
        cells.push(SafeDOM.el("button", { className: classes.join(" "), attrs: { type: "button", title }, dataset: { day } }, [
            SafeDOM.el("span", { text: day }), hasReminder ? SafeDOM.el("span", { className: "cal-rem-bell", text: "🔔", attrs: { "aria-hidden": "true" } }) : null
        ]));
    }
    const tail = (7 - (startOffset + daysInMonth) % 7) % 7;
    for (let day = 1; day <= tail; day++) cells.push(SafeDOM.el("div", { className: "day muted", text: day }));
    SafeDOM.replace(grid, cells);
}


"1" !== new URLSearchParams(location.search).get("pf148_matrix") && SchedulerService.scheduleInterval(checkCalendarReminders, 3e4, {
    owner: "reminders",
    key: "ui-check"
});
