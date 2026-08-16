const DomainServices = Object.freeze({
    todo: {
        create(input = {}) {
            const limits = StorageLimits.current();
            if (todos.length >= limits.todoRecords) return toast("Osiągnięto limit TODO.", "err"), 
            null;
            const candidate = {
                id: input.id || businessUid(),
                text: String(input.text || "").trim(),
                done: !!input.done,
                createdAt: Number(input.createdAt) || Date.now(),
                priority: [ "low", "normal", "high" ].includes(input.priority) ? input.priority : "normal",
                dueDate: validDateISO(input.dueDate) ? input.dueDate : ""
            }, v = validateTodoItem(candidate, new Set(todos.map(x => x.id)));
            return v.valid ? (todos.unshift(v.value || candidate), saveTodos(todos), renderTodos(), 
            todos[0]) : (toast(v.errors.join("; "), "err"), null);
        },
        update(id, patch = {}) {
            const item = todos.find(x => x.id === id);
            if (!item) return null;
            const next = {
                ...item,
                ...patch,
                id: item.id
            }, v = validateTodoItem(next, new Set(todos.filter(x => x.id !== id).map(x => x.id)));
            return v.valid ? (Object.assign(item, v.value || next), saveTodos(todos), renderTodos(), 
            item) : (toast(v.errors.join("; "), "err"), null);
        },
        duplicate(id) {
            const item = todos.find(x => x.id === id);
            return item ? this.create({
                ...cloneData(item),
                id: void 0,
                done: !1,
                createdAt: Date.now()
            }) : null;
        }
    },
    journal: {
        create(input = {}) {
            const limits = StorageLimits.current();
            if (journal.length >= limits.journalRecords) return toast("Osiągnięto limit journalu.", "err"), 
            null;
            const candidate = {
                id: input.id || businessUid(),
                text: String(input.text || "").trim(),
                createdAt: Number(input.createdAt) || Date.now(),
                type: String(input.type || "info")
            }, v = validateJournalEntry(candidate, new Set(journal.map(x => x.id)));
            return v.valid ? (journal.unshift(v.value || candidate), saveJournal(journal), renderJournal(), 
            journal[0]) : (toast(v.errors.join("; "), "err"), null);
        }
    },
    reminder: {
        create(input = {}) {
            const limits = StorageLimits.current();
            if (calReminders.length >= limits.reminderRecords) return toast("Osiągnięto limit przypomnień.", "err"), 
            null;
            const candidate = {
                id: input.id || businessUid(),
                date: validDateISO(input.date) ? input.date : dateKeyLocal(new Date),
                time: validTime(input.time) ? input.time : ensureAppState().modules.userConfig?.defaultReminder || "09:00",
                text: String(input.text || "").trim(),
                done: !!input.done,
                createdAt: Number(input.createdAt) || Date.now(),
                lastNotifiedAt: 0,
                snoozedUntil: 0
            }, v = validateReminder(candidate, new Set(calReminders.map(x => x.id)));
            return v.valid ? (calReminders.unshift(v.value || candidate), saveCalendarReminders(), 
            ModuleRegistry.get("calendarReminders")?.render(), calReminders[0]) : (toast(v.errors.join("; "), "err"), null);
        }
    },
    note: {
        create(input = {}) {
            const limits = StorageLimits.current();
            if (notes.length >= limits.notesRecords) return toast("Osiągnięto limit notatek.", "err"), 
            null;
            const candidate = {
                id: input.id || businessUid(),
                title: String(input.title || "").slice(0, 100),
                text: String(input.text || ""),
                color: ALLOWED_NOTE_COLORS.includes(input.color) ? input.color : NOTE_PALETTES[0]?.id || "amber",
                pinned: !!input.pinned,
                createdAt: Number(input.createdAt) || Date.now()
            };
            if (byteSize(candidate.text) > limits.noteBytes) return toast("Treść notatki przekracza limit.", "err"), 
            null;
            const v = validateNote(candidate);
            return v.valid ? (notes.unshift(v.value || candidate), saveNotes(notes), renderNotes(), 
            notes[0]) : (toast(v.errors.join("; "), "err"), null);
        },
        update(id, patch = {}) {
            const item = notes.find(x => x.id === id);
            if (!item) return null;
            const next = {
                ...item,
                ...patch,
                id: item.id
            }, v = validateNote(next);
            return v.valid ? (Object.assign(item, v.value || next), saveNotes(notes), renderNotes(), 
            item) : (toast(v.errors.join("; "), "err"), null);
        }
    }
});
