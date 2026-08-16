const BusinessWorkflow = Object.freeze({
    collections() {
        const modules = ensureAppState().modules;
        return {
            cases: modules.responseCases || [],
            todos: modules.todo || [],
            reminders: modules.calendarReminders || [],
            journal: modules.journal || []
        };
    },
    existingLinks(record) {
        const links = normalizeWorkflowLinks(record?.links), collections = this.collections();
        return Object.fromEntries(Object.entries(links).map(([type, ids]) => [type, ids.filter(id => collections[type]?.some(item => item.id === id))]));
    },
    reconcile(moduleId, recordId, {persist = true} = {}) {
        const service = AppServices[moduleId], record = (ensureAppState().modules[moduleId] || []).find(item => item.id === recordId);
        if (!record) return null;
        const links = this.existingLinks(record), changed = JSON.stringify(links) !== JSON.stringify(normalizeWorkflowLinks(record.links));
        if (changed && persist && service?.update) service.update(recordId, {links});
        return {links, changed};
    },
    reconcileAll({persist = true} = {}) {
        const reports = [];
        for (const moduleId of ["phoneLog", "responseCases"]) {
            for (const record of ensureAppState().modules[moduleId] || []) reports.push({moduleId, recordId: record.id, ...this.reconcile(moduleId, record.id, {persist})});
        }
        return reports;
    },
    link(moduleId, recordId, type, targetId) {
        const service = AppServices[moduleId], record = (ensureAppState().modules[moduleId] || []).find(item => item.id === recordId);
        if (!service?.update || !record || !targetId) return false;
        const links = this.existingLinks(record);
        links[type] = [...new Set([...(links[type] || []), targetId])].slice(0, 50);
        service.update(recordId, {links});
        return true;
    },
    unlink(moduleId, recordId, type, targetId) {
        const service = AppServices[moduleId], record = (ensureAppState().modules[moduleId] || []).find(item => item.id === recordId);
        if (!service?.update || !record) return false;
        const links = this.existingLinks(record), before = links[type]?.length || 0;
        links[type] = (links[type] || []).filter(id => id !== targetId);
        if (links[type].length === before) return false;
        service.update(recordId, {links});
        return true;
    },
    removeReferences(linkType, id) {
        let changed = 0;
        for (const moduleId of ["phoneLog", "responseCases"]) {
            const service = AppServices[moduleId];
            if (!service?.update) continue;
            for (const record of [...(ensureAppState().modules[moduleId] || [])]) {
                const links = normalizeWorkflowLinks(record.links);
                if (!(links[linkType] || []).includes(id)) continue;
                const next = Object.fromEntries(Object.entries(links).map(([type, ids]) => [type, ids.filter(x => x !== id)]));
                service.update(record.id, {links: next}), changed += 1;
            }
        }
        return changed;
    },
    phoneToCase(phoneId) {
        const phone = (ensureAppState().modules.phoneLog || []).find(item => item.id === phoneId);
        if (!phone) return null;
        const existing = this.existingLinks(phone).cases[0];
        if (existing) return (ensureAppState().modules.responseCases || []).find(item => item.id === existing) || null;
        const subject = [phone.contactName || phone.phoneNumber || "Telefon", phone.organization].filter(Boolean).join(" — ");
        const note = String(phone.note || "").trim();
        const created = AppServices.responseCases.create({
            from: phone.contactName || phone.phoneNumber || phone.organization || "Telefon",
            subject: note ? `${subject}: ${note}`.slice(0, 1000) : subject.slice(0, 1000),
            status: phone.callbackRequired ? "open" : "waiting",
            source: {module: "phoneLog", id: phone.id}
        });
        if (created) this.link("phoneLog", phone.id, "cases", created.id);
        return created;
    },
    caseToTodo(caseId) {
        const item = (ensureAppState().modules.responseCases || []).find(row => row.id === caseId);
        if (!item) return null;
        const created = CoreModuleState.todo.create({text: `Sprawa: ${item.subject}`, dueDate: item.due || "", priority: item.due ? "high" : "normal"});
        if (created) this.link("responseCases", item.id, "todos", created.id);
        return created;
    },
    caseToReminder(caseId) {
        const item = (ensureAppState().modules.responseCases || []).find(row => row.id === caseId);
        if (!item) return null;
        const created = CoreModuleState.calendarReminders.create({text: `Sprawa: ${item.subject}`, date: item.due || dateKeyLocal(new Date()), time: ensureAppState().modules.userConfig?.defaultReminder || "09:00"});
        if (created) this.link("responseCases", item.id, "reminders", created.id);
        return created;
    },
    caseToJournal(caseId) {
        const item = (ensureAppState().modules.responseCases || []).find(row => row.id === caseId);
        if (!item) return null;
        const created = CoreModuleState.journal.create({text: `Sprawa ${item.subject}${item.from ? ` · ${item.from}` : ""} · status: ${item.status}`, type: "case"});
        if (created) this.link("responseCases", item.id, "journal", created.id);
        return created;
    },
    summary(record) {
        const links = this.existingLinks(record);
        return [links.cases.length && `${links.cases.length} spraw`, links.todos.length && `${links.todos.length} TODO`, links.reminders.length && `${links.reminders.length} przyp.`, links.journal.length && `${links.journal.length} wpisów`].filter(Boolean).join(" · ");
    },
    linksView(record, {moduleId = "", recordId = ""} = {}) {
        const links = this.existingLinks(record), labels = {cases: "Sprawy", todos: "TODO", reminders: "Przypomnienia", journal: "Dziennik"};
        const buttons = Object.entries(links).flatMap(([type, ids]) => ids.map((id, index) => SafeDOM.el("button", {
            className: "workflow-link", text: `${labels[type]} ${index + 1}`,
            attrs: {type: "button", title: `Pokaż powiązany rekord: ${labels[type]}`},
            dataset: {workflowOpen: type, workflowTarget: id, workflowOwnerModule: moduleId, workflowOwnerId: recordId}
        })));
        return buttons.length ? SafeDOM.el("div", {className: "workflow-links", attrs: {"aria-label": "Powiązane rekordy"}}, buttons) : null;
    },
    open(type, id) {
        const selectors = {cases: `[data-business-record-id="${CSS.escape(id)}"]`, todos: `[data-todo-id="${CSS.escape(id)}"]`, reminders: `[data-reminder-id="${CSS.escape(id)}"]`, journal: `[data-journal-id="${CSS.escape(id)}"]`};
        if (type === "cases") BusinessActions.run("responseCases");
        else {
            UIRuntime.closeAll({reason: "workflow-open", modal: !0});
            ModuleRegistry.get(type === "todos" ? "todo" : type === "reminders" ? "calendarReminders" : "journal")?.render?.();
        }
        SchedulerService.scheduleTimeout(() => {
            const target = document.querySelector(selectors[type] || "");
            if (!target) return toast("Powiązany rekord już nie istnieje.", "err");
            target.scrollIntoView({behavior: "smooth", block: "center"});
            target.classList.add("workflow-highlight");
            SchedulerService.scheduleTimeout(() => target.classList.remove("workflow-highlight"), 1800, {owner: "business-workflow", key: `highlight-${type}-${id}`});
        }, 40, {owner: "business-workflow", key: `open-${type}-${id}`});
    }
});

EventLifecycle.delegate(document, "click", "[data-workflow-open]", (event, button) => {
    event.preventDefault();
    BusinessWorkflow.open(button.dataset.workflowOpen, button.dataset.workflowTarget);
}, {owner: "business-workflow", key: "open-linked-record"});
