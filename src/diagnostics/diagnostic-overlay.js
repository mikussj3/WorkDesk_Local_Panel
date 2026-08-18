
(() => {
  "use strict";

  const api = window.WorkDesk;
  if (!api) throw new Error("WorkDesk shared runtime is not initialized");

  const Diagnostics = api.diagnostics;
  const asResult = (id, ok, details = {}) => Object.freeze({ id, ok: Boolean(ok), status: ok ? "PASS" : "FAIL", details });

  const withModuleSnapshot = async (ids, task) => {
    const snapshots = Object.fromEntries(ids.map(id => [id, api.modules.get(id)?.serialize?.()]));
    try {
      return await task();
    } finally {
      ids.forEach(id => {
        const module = api.modules.get(id);
        if (module && Object.prototype.hasOwnProperty.call(snapshots, id)) {
          module.deserialize(snapshots[id]);
          module.render({ reason: "diagnostic-restore" });
        }
      });
    }
  };


  const BUSINESS_MODULE_IDS = Object.freeze(["checklists", "responseCases", "phoneLog", "procedures"]);
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

  async function runBusinessModulesCertification() {
    const snapshots = Object.fromEntries(BUSINESS_MODULE_IDS.map(id => [id, api.modules.get(id).serialize()]));
    const storageKeysBefore = api.storage.keys().slice().sort();
    const storageSnapshotBefore = Object.fromEntries(storageKeysBefore.map(key => [key, api.storage.get(key, null)]));
    const ownerStatsBefore = api.runtime.events.stats().active;
    const marker = `business-cert-${Date.now()}`;
    const stages = {};
    const openAction = async action => {
      document.querySelector(`[data-business-action="${action}"]`)?.click();
      await nextFrame();
    };
    const closeModal = id => api.runtime.ui.close(id, { restoreFocus: false, reason: "business-certification" });
    try {
      const today = dateKeyLocal(new Date());

      const checklist = AppServices.checklists.create({
        name: `${marker}-checklist`,
        items: [{ id: `${marker}-a`, text: "Pierwsza" }, { id: `${marker}-b`, text: "Druga" }],
        daily: {}
      });
      AppServices.checklists.toggle(checklist.id, today, checklist.items[1].id, true);
      const checklistBeforeEdit = cloneData(api.modules.get("checklists").serialize().find(item => item.id === checklist.id));
      const checklistEdited = AppServices.checklists.update(checklist.id, { name: `${marker}-checklist-edit`, items: checklistBeforeEdit.items });
      const checklistAfterEdit = api.modules.get("checklists").serialize().find(item => item.id === checklist.id);
      await openAction("checklists");
      document.querySelector(`#clList [data-edit-cl="${CSS.escape(checklist.id)}"]`)?.click();
      await nextFrame();
      const checklistEditMode = clAdd?.dataset.edit === checklist.id && !clCancel?.hidden;
      clCancel?.click();
      closeModal("checklistsModal");
      await openAction("checklists");
      const checklistReopenClean = !clAdd?.dataset.edit && clCancel?.hidden === true;
      closeModal("checklistsModal");
      AppServices.checklists.remove(checklist.id);
      stages.checklist = {
        ok: Boolean(checklist && checklistEdited && checklistAfterEdit &&
          checklistBeforeEdit.items.map(item => item.id).join("|") === checklistAfterEdit.items.map(item => item.id).join("|") &&
          JSON.stringify(checklistBeforeEdit.daily) === JSON.stringify(checklistAfterEdit.daily) &&
          checklistEditMode && checklistReopenClean &&
          !api.modules.get("checklists").serialize().some(item => item.id === checklist.id)),
        editMode: checklistEditMode, reopenClean: checklistReopenClean, daily: checklistAfterEdit?.daily
      };

      const responseCase = AppServices.responseCases.create({ from: "Diagnostyka", subject: `${marker}-case`, status: "waiting", due: today });
      const responseEdited = AppServices.responseCases.update(responseCase.id, { subject: `${marker}-case-edit` });
      const responseDone = AppServices.responseCases.setStatus(responseCase.id, "done");
      await openAction("responseCases");
      caseFilter.value = "done"; caseFilter.dispatchEvent(new Event("change", { bubbles: true }));
      await nextFrame();
      const caseVisible = Boolean(document.querySelector(`#caseList [data-edit-case="${CSS.escape(responseCase.id)}"]`));
      document.querySelector(`#caseList [data-edit-case="${CSS.escape(responseCase.id)}"]`)?.click();
      await nextFrame();
      const caseEditMode = caseAdd?.dataset.edit === responseCase.id && !caseCancel?.hidden;
      closeModal("casesModal");
      await openAction("responseCases");
      const caseReopenClean = !caseAdd?.dataset.edit && caseCancel?.hidden === true;
      closeModal("casesModal");
      AppServices.responseCases.remove(responseCase.id);
      stages.responseCases = {
        ok: Boolean(responseCase && responseEdited?.updatedAt && responseDone?.status === "done" && responseDone?.closedAt && caseVisible && caseEditMode && caseReopenClean && !api.modules.get("responseCases").serialize().some(item => item.id === responseCase.id)),
        caseVisible, editMode: caseEditMode, reopenClean: caseReopenClean, status: responseDone?.status
      };

      const phone = AppServices.phoneLog.create({
        phoneNumber: "+48 600 200 300", contactName: `${marker}-contact`, organization: "Oddział testowy",
        direction: "incoming", status: "completed", durationSec: 120, callbackRequired: false, note: "Test", at: Date.now()
      });
      const phoneEdited = AppServices.phoneLog.update(phone.id, { status: "callback", callbackRequired: true, durationSec: 180 });
      await openAction("phoneLog");
      phFilter.value = "callback"; phFilter.dispatchEvent(new Event("change", { bubbles: true }));
      await nextFrame();
      const phoneVisible = Boolean(document.querySelector(`#phList [data-edit-ph="${CSS.escape(phone.id)}"]`));
      document.querySelector(`#phList [data-edit-ph="${CSS.escape(phone.id)}"]`)?.click();
      await nextFrame();
      const phoneEditMode = phAdd?.dataset.edit === phone.id && !phCancel?.hidden;
      closeModal("phoneModal");
      await openAction("phoneLog");
      const phoneReopenClean = !phAdd?.dataset.edit && phCancel?.hidden === true;
      closeModal("phoneModal");
      AppServices.phoneLog.remove(phone.id);
      stages.phoneLog = {
        ok: Boolean(phone && phoneEdited?.callbackRequired && phoneEdited?.status === "callback" && phoneEdited?.durationSec === 180 && phoneVisible && phoneEditMode && phoneReopenClean && !api.modules.get("phoneLog").serialize().some(item => item.id === phone.id)),
        phoneVisible, editMode: phoneEditMode, reopenClean: phoneReopenClean, status: phoneEdited?.status
      };

      const procedure = AppServices.procedures.create({ title: `${marker}-procedure`, body: "Krok pierwszy", category: "Test", pinned: false });
      const procedurePinned = AppServices.procedures.togglePinned(procedure.id);
      const procedureEdited = AppServices.procedures.update(procedure.id, { body: "Krok pierwszy\nKrok drugi" });
      await openAction("procedures");
      const procedureVisible = Boolean(document.querySelector(`#prList [data-edit-pr="${CSS.escape(procedure.id)}"]`));
      document.querySelector(`#prList [data-edit-pr="${CSS.escape(procedure.id)}"]`)?.click();
      await nextFrame();
      const procedureEditMode = prAdd?.dataset.edit === procedure.id && !prCancel?.hidden;
      closeModal("proceduresModal");
      await openAction("procedures");
      const procedureReopenClean = !prAdd?.dataset.edit && prCancel?.hidden === true;
      closeModal("proceduresModal");
      AppServices.procedures.remove(procedure.id);
      stages.procedures = {
        ok: Boolean(procedure && procedurePinned?.pinned && procedureEdited?.updatedAt >= procedure.updatedAt && procedureEdited?.body.includes("Krok drugi") && procedureVisible && procedureEditMode && procedureReopenClean && !api.modules.get("procedures").serialize().some(item => item.id === procedure.id)),
        procedureVisible, editMode: procedureEditMode, reopenClean: procedureReopenClean, pinned: procedurePinned?.pinned
      };

      await api.storage.flush();
      stages.lifecycle = {
        ok: api.runtime.events.stats().active === ownerStatsBefore && api.runtime.ui.opened().every(surface => !["checklistsModal", "casesModal", "phoneModal", "proceduresModal"].includes(surface.id)),
        eventsBefore: ownerStatsBefore, eventsAfter: api.runtime.events.stats().active, openSurfaces: api.runtime.ui.opened().map(surface => surface.id)
      };
      stages.storage = {
        ok: storageKeysBefore.every(key => api.storage.keys().includes(key)),
        keysBefore: storageKeysBefore.length, keysDuring: api.storage.keys().length
      };
    } catch (error) {
      stages.runtime = { ok: false, error: String(error?.stack || error?.message || error) };
    } finally {
      BUSINESS_MODULE_IDS.forEach(id => {
        const module = api.modules.get(id);
        module.deserialize(snapshots[id]);
        module.render({ reason: "business-certification-restore" });
      });
      ["checklistsModal", "casesModal", "phoneModal", "proceduresModal"].forEach(closeModal);
      await api.storage.flush();
      const currentKeys = api.storage.keys();
      currentKeys.filter(key => !Object.prototype.hasOwnProperty.call(storageSnapshotBefore, key)).forEach(key => api.storage.remove(key));
      Object.entries(storageSnapshotBefore).forEach(([key, value]) => api.storage.set(key, value));
    }
    const restored = BUSINESS_MODULE_IDS.every(id => semanticCompare(api.modules.get(id).serialize(), snapshots[id], `business.`).ok);
    const storageKeysAfter = api.storage.keys().slice().sort();
    stages.rollback = { ok: restored, modules: BUSINESS_MODULE_IDS };
    stages.storageIntegrity = {
      ok: storageKeysAfter.length === storageKeysBefore.length && storageKeysAfter.every((key, index) => key === storageKeysBefore[index]),
      keysBefore: storageKeysBefore, keysAfter: storageKeysAfter
    };
    const ok = Object.values(stages).every(stage => stage?.ok === true);
    return Object.freeze({ ok, status: ok ? "PASS" : "FAIL", stages });
  }

  const ScenarioGate = Object.freeze({
    async runAll() {
      const reports = [];
      const push = (id, ok, details = {}) => reports.push(asResult(id, ok, details));
      const storageKeysBefore = api.storage.keys().slice().sort();
      const storageSnapshotBefore = Object.fromEntries(storageKeysBefore.map(key => [key, api.storage.get(key, null)]));

      push("bootstrap", window.WorkDeskReady === true && api.modules.list().length === ModuleRegistry.all().length && api.modules.list().length > 0, {
        ready: window.WorkDeskReady,
        modules: api.modules.list().length,
        registry: ModuleRegistry.all().length
      });

      await withModuleSnapshot(["todo", "notes", "journal", "calendarReminders"], async () => {
        const marker = `diag-${Date.now()}`;
        const todo = api.modules.get("todo");
        const notes = api.modules.get("notes");
        const journal = api.modules.get("journal");

        todo.deserialize([{ id: marker, text: marker, done: false, createdAt: Date.now() }]);
        notes.deserialize([{ id: marker, text: marker, color: "yellow", createdAt: Date.now() }]);
        journal.deserialize([{ id: marker, text: marker, type: "note", createdAt: Date.now() }]);
        todo.render({ reason: "diagnostic" });
        notes.render({ reason: "diagnostic" });
        journal.render({ reason: "diagnostic" });

        push("core-state-roundtrip",
          todo.serialize().some(item => item.id === marker) &&
          notes.serialize().some(item => item.id === marker) &&
          journal.serialize().some(item => item.id === marker),
          { marker }
        );
      });

      const events = api.runtime.events;
      const eventCounters = { rebind: 0, once: 0, removed: 0, owner: 0 };
      events.on(document, "diagnostic-rebind", () => eventCounters.rebind++, { owner: "diagnostic-events", key: "rebind" });
      const rebindToken = events.on(document, "diagnostic-rebind", () => eventCounters.rebind++, { owner: "diagnostic-events", key: "rebind" });
      document.dispatchEvent(new Event("diagnostic-rebind"));
      events.once(document, "diagnostic-once", () => eventCounters.once++, { owner: "diagnostic-events-once", key: "once" });
      document.dispatchEvent(new Event("diagnostic-once"));
      document.dispatchEvent(new Event("diagnostic-once"));
      const removable = events.on(document, "diagnostic-remove", () => eventCounters.removed++, { owner: "diagnostic-events-remove", key: "remove" });
      events.remove(removable);
      document.dispatchEvent(new Event("diagnostic-remove"));
      events.on(document, "diagnostic-owner-a", () => eventCounters.owner++, { owner: "diagnostic-events-owner", key: "a" });
      events.on(window, "diagnostic-owner-b", () => eventCounters.owner++, { owner: "diagnostic-events-owner", key: "b" });
      const removedOwner = events.removeOwner("diagnostic-events-owner");
      document.dispatchEvent(new Event("diagnostic-owner-a"));
      window.dispatchEvent(new Event("diagnostic-owner-b"));
      events.remove(rebindToken);
      const eventStats = events.stats();
      push("event-lifecycle", eventCounters.rebind === 1 && eventCounters.once === 1 && eventCounters.removed === 0 && eventCounters.owner === 0 && removedOwner === 2 && !eventStats.byOwner["diagnostic-events"] && !eventStats.byOwner["diagnostic-events-once"] && !eventStats.byOwner["diagnostic-events-remove"] && !eventStats.byOwner["diagnostic-events-owner"], { eventCounters, removedOwner, eventStats });

      const quarantineTestKey = `wd.diagnostic.corrupt.${Date.now()}`, quarantineKeysBefore = new Set(api.storage.keys().filter(key => key.startsWith("wd.corrupt.")));
      api.storage.set(quarantineTestKey, "{broken-json");
      const firstCorruptRead = api.storage.getJSON(quarantineTestKey, null, {
        notify: false
      }), quarantineCountAfterFirst = api.storage.keys().filter(key => !quarantineKeysBefore.has(key) && key.startsWith("wd.corrupt.")).length, secondCorruptRead = api.storage.getJSON(quarantineTestKey, null, {
        notify: false
      }), quarantineCountAfterSecond = api.storage.keys().filter(key => !quarantineKeysBefore.has(key) && key.startsWith("wd.corrupt.")).length, marker = firstCorruptRead.markerKey ? api.storage.getJSON(firstCorruptRead.markerKey, null, {
        notify: false
      }) : null;
      push("storage-quarantine-once", !firstCorruptRead.ok && firstCorruptRead.sourceRemoved === true && secondCorruptRead.ok && secondCorruptRead.exists === false && quarantineCountAfterFirst === 2 && quarantineCountAfterSecond === quarantineCountAfterFirst && marker?.ok === true, {
        quarantineKey: firstCorruptRead.quarantineKey,
        markerKey: firstCorruptRead.markerKey,
        quarantineCountAfterFirst,
        quarantineCountAfterSecond,
        sourceExists: api.storage.get(quarantineTestKey, null) !== null
      });
      api.storage.keys().filter(key => !quarantineKeysBefore.has(key) && key.startsWith("wd.corrupt.")).forEach(key => api.storage.remove(key));
      api.storage.remove(quarantineTestKey);

      const beforeScheduler = api.runtime.scheduler.stats();
      api.runtime.scheduler.pauseOnHidden();
      const paused = api.runtime.scheduler.stats();
      api.runtime.scheduler.resume();
      const resumed = api.runtime.scheduler.stats();
      push("scheduler-pause-resume", paused.paused === true && resumed.paused === false && beforeScheduler.size === resumed.size, {
        before: beforeScheduler,
        paused,
        resumed
      });

      const transientId = `diagnostic-surface-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const transient = document.createElement("div");
      transient.id = transientId;
      transient.hidden = true;
      document.body.appendChild(transient);
      api.runtime.ui.register({ id: transientId, el: transient, modal: false, priority: 99 });
      api.runtime.ui.open("surface", transientId, { reason: "diagnostic" });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const opened = api.runtime.ui.opened().some(surface => surface.id === transientId);
      api.runtime.ui.close(transientId, { reason: "diagnostic", restoreFocus: false });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const closed = !api.runtime.ui.opened().some(surface => surface.id === transientId);
      api.runtime.ui.unregister(transientId);
      transient.remove();
      push("transient-ui", opened && closed, { opened, closed });

      const initialModalSurfaces = api.runtime.ui.opened().filter(surface => surface.modal).map(surface => surface.id);
      push("startup-nonblocking", !document.getElementById("breakModal") && initialModalSurfaces.length === 0 && Boolean(api.runtime.attention), {
        initialModalSurfaces,
        attention: api.runtime.attention?.stats?.()
      });

      api.runtime.attention.notify({ id: "diagnostic:attention", title: "Test", message: "Nieblokujący komunikat" });
      const attentionVisible = Boolean(document.querySelector('[data-notice-id="diagnostic:attention"]'));
      const attentionDidNotOpenModal = api.runtime.ui.opened().every(surface => !surface.modal || surface.id !== "diagnostic:attention");
      api.runtime.attention.dismiss("diagnostic:attention");
      push("attention-flow", attentionVisible && attentionDidNotOpenModal && !document.querySelector('[data-notice-id="diagnostic:attention"]'), {
        attentionVisible,
        attentionDidNotOpenModal
      });

      api.runtime.bulkMail.open(["diag-a@example.com", "diag-b@example.com"]);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const bulkStats = api.runtime.bulkMail.stats();
      const bulkBcc = api.runtime.bulkMail.bccUrl();
      const bulkModalOpen = api.runtime.ui.top()?.id === "bulkMailModal";
      api.runtime.ui.close("bulkMailModal", { reason: "diagnostic", restoreFocus: false });
      push("bulk-mail-gesture-flow", bulkModalOpen && bulkStats.total === 2 && bulkStats.opened === 0 && /bcc=diag-a%40example.com%2Cdiag-b%40example.com/.test(bulkBcc), {
        bulkModalOpen, bulkStats, bulkBcc
      });

      const composerBefore = EmailComposerState.read();
      const recipientInputs = { to: document.getElementById("fTo"), cc: document.getElementById("fCc"), bcc: document.getElementById("fBcc") };
      recipientInputs.to.value = "hr@firma.pl; rekrutacja@firma.pl; kadry@firma.pl";
      recipientInputs.cc.value = "cc1@firma.pl; cc2@firma.pl";
      recipientInputs.bcc.value = "bcc@firma.pl";
      Object.values(recipientInputs).forEach(input => input.dispatchEvent(new Event("input", { bubbles: true })));
      const preparedSend = prepareEmailSend({ navigate: false });
      const emailUri = preparedSend.uri;
      const recipientFlow = {
        stateTo: EmailComposerState.read().to,
        preparedSendOk: preparedSend.ok,
        parsedWithoutTrailingSeparator: parseEmails("last@example.com").length === 1,
        uri: emailUri,
        noSemicolonInUriRecipients: !/^mailto:[^?]*;/.test(emailUri) && !/[?&](cc|bcc)=[^&]*%3B/i.test(emailUri),
        commaSeparatedTo: emailUri.startsWith("mailto:hr@firma.pl,rekrutacja@firma.pl,kadry@firma.pl?"),
        commaSeparatedCc: /[?&]cc=cc1%40firma.pl%2Ccc2%40firma.pl(?:&|$)/.test(emailUri),
        commaSeparatedBcc: /[?&]bcc=bcc%40firma.pl(?:&|$)/.test(emailUri)
      };
      push("email-recipient-mailto", recipientFlow.preparedSendOk && recipientFlow.parsedWithoutTrailingSeparator && recipientFlow.noSemicolonInUriRecipients && recipientFlow.commaSeparatedTo && recipientFlow.commaSeparatedCc && recipientFlow.commaSeparatedBcc, recipientFlow);
      EmailComposerState.update(composerBefore, { render: true, persist: false });

      const emailModuleBefore = cloneData(api.modules.get("email").serialize()), preferencesBefore = cloneData(api.modules.get("preferences").serialize()), emailUiBefore = cloneData(ensureAppState().modules.emailUI);
      let emailIntegrity = {};
      try {
        const marker = `email-integrity-${Date.now()}`;
        api.modules.get("email").deserialize({
          sections: [{ name: marker, groups: [
            { name: "Zespół 2", emails: ["alpha@example.com", "shared@example.com"] },
            { name: "Druga", emails: ["beta@example.com", "shared@example.com"] }
          ] }],
          knownMails: []
        });
        ensureAppState().modules.preferences = { ...preferencesBefore, recentEmailGroups: [{ id: `${marker}::Zespół 22`, label: "Zespół 22", at: Date.now() }] };
        EmailComposerState.clear();
        api.modules.get("email").render({ reason: "diagnostic-email-integrity" });
        document.querySelector("#grpSearch")?.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 20));
        const recentButton = document.querySelector("#recentEmailGroups [data-id]");
        const cleanRecentLabel = recentButton?.textContent === "Zespół 2";
        recentButton?.click();
        await nextFrame();
        const recentFound = document.querySelector("#grpSearch")?.value === "Zespół 2" && [ ...document.querySelectorAll("#groupsHost [data-group-id]") ].some(row => row.dataset.groupId === `${marker}::Zespół 2`);
        document.querySelector("#grpSearch").value = "";
        renderGroups("");
        const first = document.querySelector(`#groupsHost input[data-key="${CSS.escape(`${marker}::Zespół 2`)}"][data-kind="To"]`), second = document.querySelector(`#groupsHost input[data-key="${CSS.escape(`${marker}::Druga`)}"][data-kind="To"]`);
        first?.click(); second?.click(); first?.click();
        const afterOverlap = parseEmails(EmailComposerState.read().to);
        const overlapPreserved = !afterOverlap.includes("alpha@example.com") && afterOverlap.includes("beta@example.com") && afterOverlap.includes("shared@example.com");
        api.modules.get("email").render({ reason: "diagnostic-email-rerender" });
        const selectionPreservedAfterRender = EmailComposerState.hasGroup("To", `${marker}::Druga`);
        const edited = AppServices.emailGroups.update(`${marker}::Druga`, { section: marker, name: "Druga zmieniona", emails: ["shared@example.com", "new@example.com"] });
        const afterEdit = parseEmails(EmailComposerState.read().to);
        const editSynchronized = edited.ok && EmailComposerState.hasGroup("To", `${marker}::Druga zmieniona`) && !afterEdit.includes("beta@example.com") && afterEdit.includes("shared@example.com") && afterEdit.includes("new@example.com");
        const delimiterRejected = AppServices.emailGroups.create({ section: `${marker}::bad`, name: "Nazwa", emails: ["x@example.com"] }).ok === false;
        const removed = AppServices.emailGroups.remove(`${marker}::Druga zmieniona`), afterDelete = parseEmails(EmailComposerState.read().to);
        const deleteSynchronized = Boolean(removed) && !EmailComposerState.hasGroup("To", `${marker}::Druga zmieniona`) && !afterDelete.includes("new@example.com");
        const restored = AppServices.emailGroups.restore(removed), afterRestore = parseEmails(EmailComposerState.read().to);
        const undoRestoredSelection = restored && EmailComposerState.hasGroup("To", `${marker}::Druga zmieniona`) && afterRestore.includes("new@example.com");
        emailIntegrity = { cleanRecentLabel, recentFound, overlapPreserved, selectionPreservedAfterRender, editSynchronized, delimiterRejected, deleteSynchronized, undoRestoredSelection };
      } catch (error) {
        emailIntegrity = { ok: false, error: String(error?.stack || error) };
      } finally {
        api.modules.get("email").deserialize(emailModuleBefore);
        api.modules.get("preferences").deserialize(preferencesBefore);
        ensureAppState().modules.emailUI = emailUiBefore;
        api.modules.get("email").render({ reason: "diagnostic-email-restore" });
        EmailComposerState.render();
      }
      push("email-module-integrity", Object.values(emailIntegrity).every(value => value === true), emailIntegrity);

      const calendarDay = document.querySelector("#calGrid .day:not(.muted)[data-day]");
      calendarDay?.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const calendarMenu = document.getElementById("calDayMenu");
      const calendarMenuFlow = {
        dayFound: Boolean(calendarDay),
        menuFound: Boolean(calendarMenu),
        visible: Boolean(calendarMenu && getComputedStyle(calendarMenu).display !== "none" && calendarMenu.getAttribute("aria-hidden") === "false"),
        registeredOpen: api.runtime.ui.opened().some(surface => surface.id === "calDayMenu")
      };
      push("calendar-day-menu-chromium", Object.values(calendarMenuFlow).every(Boolean), calendarMenuFlow);
      api.runtime.ui.close("calDayMenu", { reason: "diagnostic", restoreFocus: false });

      const rendererSecurity = await withModuleSnapshot(["todo", "notes", "journal", "calendarReminders"], async () => {
        const marker = `renderer-security-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const scriptProbe = "<scr" + "ipt>window.__rendererSecurityExecuted=1</scr" + "ipt>";
        const payload = `<img src=x onerror="window.__rendererSecurityExecuted=1"><svg onload="window.__rendererSecurityExecuted=1"></svg>${scriptProbe}${marker}`;
        window.__rendererSecurityExecuted = 0;
        const now = Date.now();
        api.store.replaceModule("todo", [{ id: marker, text: payload, done: false, createdAt: now, priority: "normal", dueDate: "" }], { snapshot: false });
        api.store.replaceModule("notes", [{ id: marker, title: payload, text: payload, color: "amber", pinned: false, createdAt: now }], { snapshot: false });
        api.store.replaceModule("journal", [{ id: marker, text: payload, type: "info", createdAt: now }], { snapshot: false });
        api.store.replaceModule("calendarReminders", [{ id: marker, text: payload, date: new Date(now + 3600000).toISOString().slice(0, 10), time: "23:59", done: false, createdAt: now }], { snapshot: false });
        for (const id of ["todo", "notes", "journal", "calendarReminders"]) api.modules.render(id);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const hosts = ["#todoList", "#notesHost", "#journalList", "#calReminderList"].map(selector => document.querySelector(selector));
        const dangerousNodes = hosts.reduce((sum, host) => sum + (host?.querySelectorAll("img,script,svg[onload],[onerror]").length || 0), 0);
        const literalText = hosts.filter(Boolean).every(host => host.textContent.includes(marker) || host.querySelector("textarea")?.value.includes(marker) || host.querySelector("input")?.value.includes(marker));
        const executed = Number(window.__rendererSecurityExecuted || 0);
        delete window.__rendererSecurityExecuted;
        return { ok: dangerousNodes === 0 && executed === 0 && literalText, dangerousNodes, executed, literalText };
      });
      push("renderer-security", rendererSecurity.ok, rendererSecurity);

      const tileOpenCalls = [];
      const originalWindowOpen = window.open;
      let tileOpenFlow;
      try {
        window.open = (url, target, features) => {
          tileOpenCalls.push({ url: String(url), target, features });
          return null;
        };
        renderTiles();
        const ieTile = (runtimeData.tiles || []).find(tile => tile.type === "link" && tile.ie);
        const regularTile = (runtimeData.tiles || []).find(tile => tile.type === "link" && !tile.ie);
        const tileElement = id => [...document.querySelectorAll("#tilesHost .tile")].find(element => element.dataset.tileId === id);
        const ieElement = ieTile ? tileElement(ieTile.id) : null;
        const regularElement = regularTile ? tileElement(regularTile.id) : null;
        ieElement?.querySelector('[data-tile-action="open"]')?.click();
        ieElement?.click();
        ieElement?.focus();
        ieElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        regularElement?.click();
        const expectedIeUrl = ieTile ? tileOpenUrl(ieTile) : "";
        const expectedRegularUrl = regularTile ? tileOpenUrl(regularTile) : "";
        tileOpenFlow = {
          ok: Boolean(ieTile && regularTile && ieElement && regularElement) &&
            tileOpenCalls.length === 4 &&
            tileOpenCalls.slice(0, 3).every(call => call.url === expectedIeUrl) &&
            tileOpenCalls[3]?.url === expectedRegularUrl &&
            ieElement.getAttribute("role") === "link" &&
            ieElement.tabIndex === 0,
          expectedIeUrl,
          expectedRegularUrl,
          calls: tileOpenCalls,
          role: ieElement?.getAttribute("role"),
          tabIndex: ieElement?.tabIndex
        };
      } finally {
        window.open = originalWindowOpen;
      }
      push("tile-open-flow", tileOpenFlow.ok, tileOpenFlow);

      const localPathCopies = [];
      const localPathOpenCalls = [];
      const originalLocalWindowOpen = window.open;
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
      let localPathFlow;
      try {
        window.open = (...args) => {
          localPathOpenCalls.push(args.map(String));
          return null;
        };
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: async text => localPathCopies.push(String(text)) }
        });
        const fileResult = await openTile({ type: "link", title: "Folder Windows", url: "file:///C:/Windows" });
        const driveResult = await openTile({ type: "link", title: "Dysk lokalny", url: "C:\\Temp" });
        const uncResult = await openTile({ type: "link", title: "Udział sieciowy", url: "\\\\server\\share\\docs" });
        localPathFlow = {
          ok: fileResult.kind === "local-path" && driveResult.kind === "local-path" && uncResult.kind === "local-path" &&
            localPathOpenCalls.length === 0 &&
            localPathCopies[0] === "C:\\Windows" &&
            localPathCopies[1] === "C:\\Temp" &&
            localPathCopies[2] === "\\\\server\\share\\docs" &&
            isLocalPath("file:///C:/Windows") && isLocalPath("C:\\Temp") && isLocalPath("\\\\server\\share") &&
            !isLocalPath("https://example.com"),
          copies: localPathCopies,
          openCalls: localPathOpenCalls,
          results: [fileResult, driveResult, uncResult]
        };
      } catch (error) {
        localPathFlow = { ok: false, error: String(error?.message || error), copies: localPathCopies, openCalls: localPathOpenCalls };
      } finally {
        window.open = originalLocalWindowOpen;
        if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
        else delete navigator.clipboard;
      }
      push("local-path-fallback", localPathFlow.ok, localPathFlow);

      const tileSnapshot = api.modules.get("tiles").serialize();
      const emailSnapshot = api.modules.get("email").serialize();
      let managementFlow = { ok: false };
      try {
        const marker = `diag-management-${Date.now()}`;
        const createdTile = AppServices.tiles.create({ title: marker, desc: "test", type: "link", url: "https://example.com", tags: ["TEST"] });
        const tileId = createdTile.value?.id;
        const editedTile = tileId ? AppServices.tiles.update(tileId, { title: marker + "-edit" }) : { ok: false };
        const removedTile = tileId ? AppServices.tiles.remove(tileId) : null;
        const restoredTile = AppServices.tiles.restore(removedTile);
        const createdGroup = AppServices.emailGroups.create({ section: "Diagnostyka", name: marker, emails: ["diag@example.com"] });
        const originalGroupId = createdGroup.id;
        const editedGroup = originalGroupId ? AppServices.emailGroups.update(originalGroupId, { section: "Diagnostyka", name: marker + "-edit", emails: ["diag@example.com", "two@example.com"] }) : { ok: false };
        const removedGroup = editedGroup.id ? AppServices.emailGroups.remove(editedGroup.id) : null;
        const restoredGroup = AppServices.emailGroups.restore(removedGroup);
        managementFlow = {
          ok: createdTile.ok && editedTile.ok && Boolean(removedTile) && restoredTile && createdGroup.ok && editedGroup.ok && Boolean(removedGroup) && restoredGroup,
          tileId, originalGroupId, editedGroupId: editedGroup.id
        };
      } catch (error) {
        managementFlow = { ok: false, error: String(error?.message || error) };
      } finally {
        api.modules.get("tiles").deserialize(tileSnapshot); api.modules.get("tiles").render({ reason: "diagnostic-restore" });
        api.modules.get("email").deserialize(emailSnapshot); api.modules.get("email").render({ reason: "diagnostic-restore" });
      }
      push("tile-group-management", managementFlow.ok, managementFlow);


      const coreSnapshot = {
        todo: api.modules.get("todo").serialize(), notes: api.modules.get("notes").serialize(), calendarReminders: api.modules.get("calendarReminders").serialize(), emailUI: cloneData(ensureAppState().modules.emailUI)
      };
      let interactionRegression = { ok: false };
      try {
        api.modules.get("todo").deserialize([]); api.modules.get("notes").deserialize([]); api.modules.get("calendarReminders").deserialize([]);
        const todoRows = ["high","normal","low"].map((priority,index) => CoreModuleState.todo.create({text:`diag-${index}`,priority}));
        CoreModuleState.todo.update(todoRows[1].id,{text:"diag-middle"}); CoreModuleState.todo.complete(todoRows[1].id,true);
        const note = CoreModuleState.notes.create({title:"",text:""});
        CoreModuleState.notes.update(note.id,{title:"abcdefghijklmnop"},{render:false}); CoreModuleState.notes.update(note.id,{text:"abcdefghijklmnop"},{render:false});
        const day = dateKeyLocal(new Date());
        const reminders = [0,1,2].map(index => CoreModuleState.calendarReminders.create({text:`rem-${index}`,date:day,time:`23:5${index}`}));
        CoreModuleState.calendarReminders.snooze(reminders[1].id,10); CoreModuleState.calendarReminders.done(reminders[2].id);
        EmailComposerState.update({to:"first@example.com,second@example.com",signature:"custom"}); EmailComposerState.clear();
        interactionRegression = {
          ok: CoreModuleState.todo.list().length===3 && CoreModuleState.todo.list().find(x=>x.id===todoRows[1].id)?.done===true && CoreModuleState.notes.list().find(x=>x.id===note.id)?.title==="abcdefghijklmnop" && Number(CoreModuleState.calendarReminders.list().find(x=>x.id===reminders[1].id)?.snoozedUntil)>0 && EmailComposerState.read().signature===DEFAULT_EMAIL_SIGNATURE && parseEmails("last@example.com").length===1,
          todoCount:CoreModuleState.todo.list().length, signature:EmailComposerState.read().signature
        };
      } catch(error) { interactionRegression={ok:false,error:String(error?.message||error)}; }
      finally {
        api.modules.get("todo").deserialize(coreSnapshot.todo); api.modules.get("todo").render();
        api.modules.get("notes").deserialize(coreSnapshot.notes); api.modules.get("notes").render();
        api.modules.get("calendarReminders").deserialize(coreSnapshot.calendarReminders); api.modules.get("calendarReminders").render();
        ensureAppState().modules.emailUI=coreSnapshot.emailUI; EmailComposerState.render();
      }
      push("core-multirecord-focus-email", interactionRegression.ok, interactionRegression);
      const businessUndoSearchSnapshots = Object.fromEntries(["checklists", "responseCases", "phoneLog", "procedures"].map(id => [id, api.modules.get(id).serialize()]));
      let businessUndoSearch = { ok: false };
      try {
        const marker = `diag-undo-search-${Date.now()}`;
        const created = {
          checklists: AppServices.checklists.create({ name: marker + " checklist", items: ["A"], daily: {} }),
          responseCases: AppServices.responseCases.create({ subject: marker + " case", from: "diag", status: "waiting" }),
          phoneLog: AppServices.phoneLog.create({ phoneNumber: "+48123456789", contactName: marker + " phone", status: "completed" }),
          procedures: AppServices.procedures.create({ title: marker + " procedure", body: "Step", category: "diag" })
        };
        const snapshots = {
          checklists: AppServices.checklists.remove(created.checklists.id),
          responseCases: AppServices.responseCases.remove(created.responseCases.id),
          phoneLog: AppServices.phoneLog.remove(created.phoneLog.id),
          procedures: AppServices.procedures.remove(created.procedures.id)
        };
        const restored = {
          checklists: AppServices.checklists.restore(snapshots.checklists),
          responseCases: AppServices.responseCases.restore(snapshots.responseCases),
          phoneLog: AppServices.phoneLog.restore(snapshots.phoneLog),
          procedures: AppServices.procedures.restore(snapshots.procedures)
        };
        buildGlobalSearchIndex();
        const categories = new Set(globalSearchIndex.filter(item => item.title.includes(marker)).map(item => item.category));
        businessUndoSearch = {
          ok: Object.values(restored).every(Boolean) && ["Checklisty", "Sprawy", "Telefony", "Procedury"].every(category => categories.has(category)),
          restored, categories: [...categories]
        };
      } catch (error) { businessUndoSearch = { ok: false, error: String(error?.message || error) }; }
      finally {
        Object.entries(businessUndoSearchSnapshots).forEach(([id, snapshot]) => { api.modules.get(id).deserialize(snapshot); api.modules.get(id).render({ reason: "diagnostic-restore" }); });
      }
      push("business-undo-global-search", businessUndoSearch.ok, businessUndoSearch);

      let globalSearchQuality = { ok: false };
      try {
        const marker = `Żółć-${Date.now()}`;
        const snapshot = api.modules.get("todo").serialize();
        try {
          CoreModuleState.todo.create({ text: `${marker} pilne rozliczenie`, priority: "high" });
          const exact = findGlobalSearchResults(marker, 10);
          const withoutDiacritics = findGlobalSearchResults(normalizeSearchText(marker), 10);
          const multiToken = findGlobalSearchResults("pilne rozliczenie", 10);
          renderGlobalSearch("pilne rozliczenie");
          await nextFrame();
          const input = document.getElementById("globalSearch");
          input?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
          const activeAfterArrow = document.querySelector("#globalResults .global-result[aria-selected='true']");
          globalSearchQuality = {
            ok: Boolean(exact[0]?.title.includes(marker) && withoutDiacritics.some(item => item.title.includes(marker)) && multiToken[0]?.title.includes(marker) && activeAfterArrow && input?.getAttribute("aria-activedescendant")),
            exactTop: exact[0]?.title || null,
            diacriticMatches: withoutDiacritics.length,
            multiTokenTop: multiToken[0]?.title || null,
            activeDescendant: input?.getAttribute("aria-activedescendant") || null,
            indexedCategories: [...new Set(buildGlobalSearchIndex().map(item => item.category))]
          };
        } finally {
          api.modules.get("todo").deserialize(snapshot);
          api.modules.get("todo").render({ reason: "diagnostic-restore" });
          renderGlobalSearch("");
        }
      } catch (error) { globalSearchQuality = { ok: false, error: String(error?.message || error) }; }
      push("global-search-quality", globalSearchQuality.ok, globalSearchQuality);

      const tooltipReport = TooltipRuntime.audit(document);
      push("tooltip-coverage", tooltipReport.ok, tooltipReport);

      let tooltipPortalReport = { ok: false };
      await withModuleSnapshot(["todo", "calendarReminders"], async () => {
        const marker = `tooltip-${Date.now()}`, now = Date.now(), due = new Date(now + 3600000);
        api.modules.get("todo").deserialize([{ id: `${marker}-todo`, text: "Tooltip TODO", priority: "high", done: false, createdAt: now }]);
        api.modules.get("calendarReminders").deserialize([{ id: `${marker}-reminder`, text: "Tooltip reminder", date: due.toISOString().slice(0, 10), time: due.toTimeString().slice(0, 5), done: false, createdAt: now }]);
        api.modules.get("todo").render({ reason: "tooltip-diagnostic" });
        api.modules.get("calendarReminders").render({ reason: "tooltip-diagnostic" });
        TooltipRuntime.normalize(document);
        const selectors = [
          `#todoList [data-todo-id="${marker}-todo"] [data-action="reminder"]`,
          `#todoList [data-todo-id="${marker}-todo"] [data-action="delete"]`,
          `#calReminderList [data-reminder-id="${marker}-reminder"] [data-action="snooze"]`,
          `#calReminderList [data-reminder-id="${marker}-reminder"] [data-action="delete"]`
        ];
        const checks = selectors.map(selector => {
          const button = document.querySelector(selector);
          if (!button || !TooltipRuntime.show(button)) return { selector, ok: false, reason: "missing" };
          const tooltip = document.getElementById("workdeskTooltip"), rect = tooltip?.getBoundingClientRect();
          const ok = Boolean(tooltip && tooltip.parentElement === document.body && !tooltip.hidden && rect && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight && Number(getComputedStyle(tooltip).zIndex) > 1000000);
          TooltipRuntime.hide();
          return { selector, ok, label: button.getAttribute("aria-label") || "", bodyPortal: tooltip?.parentElement === document.body };
        });
        tooltipPortalReport = { ok: checks.every(check => check.ok), checks };
      });
      push("tooltip-portal", tooltipPortalReport.ok, tooltipPortalReport);

      const businessToolsReport = await runBusinessModulesCertification();
      push("business-tools-lifecycle", businessToolsReport.ok, businessToolsReport);

      push("public-runtime-singletons",
        api.store === window.WorkDesk.store &&
        api.runtime.scheduler === window.WorkDesk.runtime.scheduler &&
        api.runtime.ui === window.WorkDesk.runtime.ui,
        { apiVersion: api.apiVersion }
      );

      api.runtime.scheduler.cancelOwner("toast");
      document.querySelectorAll("#toastWrap .toast").forEach(toast => toast.remove());
      const currentKeys = api.storage.keys();
      currentKeys.filter(key => !Object.prototype.hasOwnProperty.call(storageSnapshotBefore, key)).forEach(key => api.storage.remove(key));
      Object.entries(storageSnapshotBefore).forEach(([key, value]) => api.storage.set(key, value));

      return Object.freeze({
        status: reports.every(report => report.ok) ? "PASS" : "FAIL",
        ok: reports.every(report => report.ok),
        reports
      });
    }
  });

  Diagnostics.register("business-modules", async () => {
    const report = await runBusinessModulesCertification();
    return {
      ok: report.ok,
      metrics: { total: Object.keys(report.stages).length, passed: Object.values(report.stages).filter(stage => stage?.ok).length },
      details: report,
      issues: Object.entries(report.stages).filter(([, stage]) => !stage?.ok).map(([id]) => id)
    };
  }, { category: "business", release: true });

  Diagnostics.register("scenarios", async () => {
    const report = await ScenarioGate.runAll();
    return { ok: report.ok, metrics: { total: report.reports.length, passed: report.reports.filter(item => item.ok).length }, details: report, issues: report.reports.filter(item => !item.ok).map(item => item.id) };
  }, { category: "scenarios", release: true });

  function ensureDiagnosticUI() {
    const anchor = document.querySelector("#dataPanel .panel-b,#dataImport")?.closest(".panel-b") || document.querySelector("#dataImport")?.parentElement;
    if (!anchor || document.querySelector("#diagnosticsRunBtn")) return;
    const row = document.createElement("div");
    row.className = "row";
    const button = document.createElement("button");
    button.className = "btn sm";
    button.id = "diagnosticsRunBtn";
    button.type = "button";
    button.textContent = "Raport wydania";
    row.appendChild(button);
    anchor.appendChild(row);
    EventLifecycle.on(button, "click", async () => {
      button.disabled = true;
      try {
        const report = await Diagnostics.release();
        const text = JSON.stringify(report, null, 2);
        let modal = document.getElementById("diagnosticsReportModal");
        if (!modal) {
          modal = document.createElement("section");
          modal.id = "diagnosticsReportModal";
          modal.className = "modal lg";
          modal.setAttribute("role", "dialog");
          modal.innerHTML = '<div class="modal-h"><h3 id="diagnosticsReportTitle">Raport wydania</h3><button type="button" class="icon-btn x" data-close="diagnosticsReportModal" aria-label="Zamknij">✕</button></div><div class="modal-b"><pre class="code-block" id="diagnosticsReportBody"></pre></div><div class="modal-f"><button type="button" class="btn" data-close="diagnosticsReportModal">Zamknij</button></div>';
          modal.setAttribute("aria-labelledby", "diagnosticsReportTitle");
          document.getElementById("overlay")?.appendChild(modal);
        }
        modal.querySelector("#diagnosticsReportBody").textContent = text;
        api.runtime.ui.register({ id: modal.id, el: modal, modal: true, priority: 90 });
        api.runtime.ui.open("modal", modal.id, { opener: button, modal: true });
      } finally { button.disabled = false; }
    }, { owner: "diagnostics-ui", key: "release" });
  }

  if (document.readyState === "loading") EventLifecycle.once(document, "DOMContentLoaded", ensureDiagnosticUI, { owner: "diagnostics-ui", key: "ready" });
  else queueMicrotask(ensureDiagnosticUI);

  window.WorkDeskDebug = Object.freeze({
    diagnostics: Diagnostics,
    runtime: api,
    run: id => Diagnostics.run(id),
    runAll: () => Diagnostics.runAll(),
    release: () => Diagnostics.release()
  });
})();
