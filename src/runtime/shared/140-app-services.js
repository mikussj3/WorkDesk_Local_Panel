
function removeBusinessModuleRecord(moduleId, id) {
    const module = MODULE_BY_ID[moduleId], rows = module?.serialize?.() || [], index = rows.findIndex(record => record.id === id);
    if (!module || index < 0) return null;
    const snapshot = { record: cloneData(rows[index]), index };
    module.deserialize(rows.filter(record => record.id !== id));
    module.render({ reason: "business-remove" });
    requestFullSnapshot({ immediate: true });
    return snapshot;
}

function restoreBusinessModuleRecord(moduleId, snapshot) {
    const module = MODULE_BY_ID[moduleId];
    if (!module || !snapshot?.record) return false;
    const rows = module.serialize().filter(record => record.id !== snapshot.record.id);
    rows.splice(Math.min(Number(snapshot.index) || 0, rows.length), 0, cloneData(snapshot.record));
    module.deserialize(rows);
    module.render({ reason: "business-restore" });
    requestFullSnapshot({ immediate: true });
    return true;
}

const AppServices = Object.freeze({
    todo: DomainServices.todo,
    journal: DomainServices.journal,
    reminder: DomainServices.reminder,
    note: DomainServices.note,
    tiles: {
        list() { return ensureAppState().modules.tiles || []; },
        create(input) {
            const rows = this.list(), checked = validateTile({ ...input, id: input?.id || `custom_${businessUid()}` }, new Set(rows.map(x => x.title)));
            if (!checked.valid) return { ok: false, errors: checked.errors || ["Niepoprawny kafelek."] };
            const next = checked.value || input;
            MODULE_BY_ID.tiles.import([ ...rows, next ]), requestFullSnapshot({ immediate: true }), MODULE_BY_ID.tiles.render();
            return { ok: true, value: next };
        },
        update(id, patch) {
            const rows = this.list(), index = rows.findIndex(x => x.id === id);
            if (index < 0) return { ok: false, errors: ["Kafelek nie istnieje."] };
            const checked = validateTile({ ...rows[index], ...patch, id }, new Set(rows.filter(x => x.id !== id).map(x => x.title)));
            if (!checked.valid) return { ok: false, errors: checked.errors || ["Niepoprawny kafelek."] };
            const nextRows = rows.slice(); nextRows[index] = checked.value || { ...rows[index], ...patch, id };
            MODULE_BY_ID.tiles.import(nextRows), requestFullSnapshot({ immediate: true }), MODULE_BY_ID.tiles.render();
            return { ok: true, value: nextRows[index] };
        },
        remove(id) {
            const rows = this.list(), index = rows.findIndex(x => x.id === id);
            if (index < 0) return null;
            const removed = cloneData(rows[index]);
            MODULE_BY_ID.tiles.import(rows.filter(x => x.id !== id));
            pinnedTiles.delete(id);
            const prefs = normalizePreferences(ensureAppState().modules.preferences);
            prefs.tilePins = [ ...pinnedTiles ]; prefs.tileOrder = (prefs.tileOrder || []).filter(x => x !== id);
            ensureAppState().modules.preferences = prefs;
            requestFullSnapshot({ immediate: true }), MODULE_BY_ID.tiles.render();
            return { record: removed, index };
        },
        restore(snapshot) {
            if (!snapshot?.record) return false;
            const restored = cloneData(snapshot.record), identity = tile => [ tile.type || "link", String(tile.title || "").trim().toLowerCase(), String(tile.url || tile.value || "").trim().toLowerCase() ].join("|");
            const rows = this.list().slice();
            if (rows.some(tile => tile.id === restored.id || identity(tile) === identity(restored))) return false;
            rows.splice(Math.min(snapshot.index ?? rows.length, rows.length), 0, restored);
            MODULE_BY_ID.tiles.import(rows), requestFullSnapshot({ immediate: true }), MODULE_BY_ID.tiles.render();
            return true;
        }
    },
    emailGroups: {
        list() { return ensureAppState().modules.email?.sections || []; },
        create(input) { return this.update(null, input); },
        update(originalId, input) {
            const sectionName = String(input?.section || "").trim(), groupName = String(input?.name || "").trim();
            if (sectionName.includes(EMAIL_GROUP_ID_SEPARATOR) || groupName.includes(EMAIL_GROUP_ID_SEPARATOR)) return { ok: false, errors: ["Nazwa sekcji i grupy nie może zawierać znaków ::."] };
            const checked = validateGroup({ name: groupName, emails: uniq(input?.emails || []) });
            if (!sectionName || !checked.valid || !checked.value.emails.length) return { ok: false, errors: ["Uzupełnij sekcję, nazwę i poprawne adresy e-mail."] };
            const sections = cloneData(this.list()), originalRecord = originalId ? findEmailGroupRecord(originalId) : null, originalParts = parseEmailGroupId(originalId);
            let targetSection = sections.find(section => section.name === sectionName);
            if (!targetSection) sections.push(targetSection = { name: sectionName, groups: [] });
            const duplicate = sections.some(section => section.groups.some(group => makeEmailGroupId(section.name, group.name) !== originalId && section.name.toLowerCase() === sectionName.toLowerCase() && group.name.toLowerCase() === checked.value.name.toLowerCase()));
            if (duplicate) return { ok: false, errors: ["Grupa o tej nazwie już istnieje w sekcji."] };
            if (originalId) {
                const sourceSection = sections.find(section => section.name === originalParts.sectionName), index = sourceSection?.groups.findIndex(group => group.name === originalParts.groupName) ?? -1;
                if (index < 0) return { ok: false, errors: ["Grupa nie istnieje."] };
                sourceSection.groups.splice(index, 1);
                if (!sourceSection.groups.length && sourceSection !== targetSection) sections.splice(sections.indexOf(sourceSection), 1);
            }
            targetSection = sections.find(section => section.name === sectionName) || (sections.push({ name: sectionName, groups: [] }), sections.at(-1));
            targetSection.groups.push(checked.value);
            const newId = makeEmailGroupId(sectionName, checked.value.name);
            originalId && reconcileSelectedGroupMutation(originalId, originalRecord?.group.emails || [], newId, checked.value.emails);
            MODULE_BY_ID.email.import({ ...ensureAppState().modules.email, sections });
            originalId && originalId !== newId && renameRecentEmailGroup(originalId, newId);
            requestFullSnapshot({ immediate: true }), MODULE_BY_ID.email.render();
            return { ok: true, value: checked.value, id: newId };
        },
        remove(id) {
            const sections = cloneData(this.list()), {sectionName, groupName} = parseEmailGroupId(id), sectionIndex = sections.findIndex(section => section.name === sectionName);
            if (sectionIndex < 0) return null;
            const groupIndex = sections[sectionIndex].groups.findIndex(group => group.name === groupName);
            if (groupIndex < 0) return null;
            const record = cloneData(sections[sectionIndex].groups[groupIndex]), selectedKinds = [ "To", "Cc", "Bcc" ].filter(kind => EmailComposerState.hasGroup(kind, id)), recentEntry = cloneData((businessPrefs().recentEmailGroups || []).find(entry => entry.id === id) || null);
            reconcileSelectedGroupMutation(id, record.emails);
            sections[sectionIndex].groups.splice(groupIndex, 1);
            if (!sections[sectionIndex].groups.length) sections.splice(sectionIndex, 1);
            removeRecentEmailGroup(id);
            MODULE_BY_ID.email.import({ ...ensureAppState().modules.email, sections });
            requestFullSnapshot({ immediate: true }), MODULE_BY_ID.email.render();
            return { record, sectionName, sectionIndex, groupIndex, selectedKinds, recentEntry };
        },
        restore(snapshot) {
            if (!snapshot?.record) return false;
            const sections = cloneData(this.list()), sectionName = String(snapshot.sectionName || "").trim(), groupName = String(snapshot.record.name || "").trim();
            const duplicate = sections.some(section => section.name.toLowerCase() === sectionName.toLowerCase() && section.groups.some(group => String(group.name || "").trim().toLowerCase() === groupName.toLowerCase()));
            if (duplicate) return false;
            let section = sections.find(x => x.name === sectionName);
            if (!section) { section = { name: sectionName, groups: [] }; sections.splice(Math.min(snapshot.sectionIndex ?? sections.length, sections.length), 0, section); }
            section.groups.splice(Math.min(snapshot.groupIndex ?? section.groups.length, section.groups.length), 0, cloneData(snapshot.record));
            MODULE_BY_ID.email.import({ ...ensureAppState().modules.email, sections });
            const restoredId = makeEmailGroupId(sectionName, snapshot.record.name);
            restoreSelectedEmailGroup(restoredId, snapshot.record.emails, snapshot.selectedKinds || []);
            if (snapshot.recentEntry) {
                const preferences = businessPrefs();
                preferences.recentEmailGroups = [ { ...snapshot.recentEntry, id: restoredId, label: snapshot.record.name }, ...(preferences.recentEmailGroups || []).filter(entry => entry.id !== restoredId) ].slice(0, 5);
            }
            requestFullSnapshot({ immediate: true }), MODULE_BY_ID.email.render(); return true;
        }
    },
    emailProfiles: {
        create(input) {
            const rows = ensureAppState().modules.emailProfiles || [], next = normalizeEmailProfilesModule([ {
                ...input,
                id: input?.id || stableBusinessId(null, "profile"),
                createdAt: Date.now()
            } ])[0];
            return next ? (rows.unshift(next), ensureAppState().modules.emailProfiles = rows.slice(0, 50), 
            requestFullSnapshot(), next) : null;
        },
        update(id, patch) {
            const rows = ensureAppState().modules.emailProfiles || [], i = rows.findIndex(x => x.id === id);
            if (i < 0) return null;
            const next = normalizeEmailProfilesModule([ {
                ...rows[i],
                ...patch,
                id: id
            } ])[0];
            return next ? (rows[i] = next, requestFullSnapshot(), next) : null;
        },
        remove(id) {
            const rows = ensureAppState().modules.emailProfiles || [];
            ensureAppState().modules.emailProfiles = rows.filter(x => x.id !== id), requestFullSnapshot({
                immediate: !0
            });
        }
    },
    checklists: {
        create(input) {
            const rows = ensureAppState().modules.checklists || [], next = normalizeChecklistsModule([ {
                ...input,
                id: input?.id || stableBusinessId(null, "check")
            } ])[0];
            return next ? (rows.unshift(next), ensureAppState().modules.checklists = rows.slice(0, 100), 
            requestFullSnapshot(), next) : null;
        },
        update(id, patch) {
            const rows = ensureAppState().modules.checklists || [], i = rows.findIndex(x => x.id === id);
            if (i < 0) return null;
            const next = normalizeChecklistsModule([ {
                ...rows[i],
                ...patch,
                id: id
            } ])[0];
            return next ? (rows[i] = next, requestFullSnapshot(), next) : null;
        },
        remove(id) {
            return removeBusinessModuleRecord("checklists", id);
        },
        restore(snapshot) {
            return restoreBusinessModuleRecord("checklists", snapshot);
        },
        toggle(id, date, index, checked) {
            const rows = ensureAppState().modules.checklists || [], i = rows.findIndex(x => x.id === id);
            if (i < 0) return null;
            const current = rows[i], daily = {
                ...current.daily || {}
            }, arr = new Set(daily[date] || []);
            return checked ? arr.add(String(index)) : arr.delete(String(index)), daily[date] = [ ...arr ].filter(itemId => current.items.some(item => item.id === itemId)), 
            this.update(id, {
                daily: daily
            });
        }
    },
    responseCases: {
        create(input) {
            const rows = ensureAppState().modules.responseCases || [], next = normalizeResponseCasesModule([ {
                ...input,
                id: input?.id || stableBusinessId(null, "case"),
                createdAt: Date.now()
            } ])[0];
            return next ? (rows.unshift(next), ensureAppState().modules.responseCases = rows.slice(0, 1e3), 
            requestFullSnapshot(), next) : null;
        },
        update(id, patch = {}) {
            const rows = ensureAppState().modules.responseCases || [], i = rows.findIndex(x => x.id === id);
            if (i < 0) return null;
            const status = patch.status, now = Date.now(), lifecycle = "done" === status ? {
                closedAt: now
            } : status ? {
                closedAt: null
            } : {};
            return rows[i] = normalizeResponseCasesModule([ {
                ...rows[i],
                ...patch,
                ...lifecycle,
                id: id,
                updatedAt: now
            } ])[0] || rows[i], requestFullSnapshot(), rows[i];
        },
        remove(id) {
            return removeBusinessModuleRecord("responseCases", id);
        },
        restore(snapshot) {
            return restoreBusinessModuleRecord("responseCases", snapshot);
        },
        setStatus(id, status) {
            return [ "open", "waiting", "done", "cancelled" ].includes(status) ? this.update(id, {
                status: status
            }) : null;
        }
    },
    phoneLog: {
        create(input) {
            const rows = ensureAppState().modules.phoneLog || [], next = normalizePhoneLogModule([ {
                ...input,
                id: input?.id || stableBusinessId(null, "phone"),
                at: input?.at || Date.now()
            } ])[0];
            return next ? (rows.unshift(next), ensureAppState().modules.phoneLog = rows.slice(0, 500), 
            requestFullSnapshot(), next) : null;
        },
        update(id, patch) {
            const rows = ensureAppState().modules.phoneLog || [], i = rows.findIndex(x => x.id === id);
            return i < 0 ? null : (rows[i] = normalizePhoneLogModule([ {
                ...rows[i],
                ...patch,
                id: id
            } ])[0] || rows[i], requestFullSnapshot(), rows[i]);
        },
        remove(id) {
            return removeBusinessModuleRecord("phoneLog", id);
        },
        restore(snapshot) {
            return restoreBusinessModuleRecord("phoneLog", snapshot);
        },
        removeOldest() {
            const rows = ensureAppState().modules.phoneLog || [];
            if (!rows.length) return null;
            const oldest = [ ...rows ].sort((a, b) => Number(a.at) - Number(b.at))[0];
            return this.remove(oldest.id), oldest;
        }
    },
    procedures: {
        create(input) {
            const now = Date.now(), rows = ensureAppState().modules.procedures || [], next = normalizeProceduresModule([ {
                ...input,
                id: input?.id || stableBusinessId(null, "proc"),
                createdAt: now,
                updatedAt: now
            } ])[0];
            return next ? (rows.unshift(next), ensureAppState().modules.procedures = rows.slice(0, 300), 
            requestFullSnapshot(), next) : null;
        },
        update(id, patch) {
            const rows = ensureAppState().modules.procedures || [], i = rows.findIndex(x => x.id === id);
            return i < 0 ? null : (rows[i] = normalizeProceduresModule([ {
                ...rows[i],
                ...patch,
                id: id,
                updatedAt: Date.now()
            } ])[0] || rows[i], requestFullSnapshot(), rows[i]);
        },
        remove(id) {
            return removeBusinessModuleRecord("procedures", id);
        },
        restore(snapshot) {
            return restoreBusinessModuleRecord("procedures", snapshot);
        },
        togglePinned(id) {
            const x = (ensureAppState().modules.procedures || []).find(v => v.id === id);
            return x ? this.update(id, {
                pinned: !x.pinned
            }) : null;
        }
    }
});

function showConfirmModal(message, {title: title = "Potwierdź operację", confirmLabel: confirmLabel = "Potwierdź", danger: danger = !0} = {}) {
    return new Promise(resolve => {
        let settled = !1, modal = $("#unifiedConfirmModal");
        modal || (modal = document.createElement("div"), modal.className = "modal", modal.id = "unifiedConfirmModal", 
        modal.innerHTML = '<div class="modal-h"><h3 id="unifiedConfirmTitle"></h3><button class="icon-btn x" type="button" data-answer="false" aria-label="Zamknij">✕</button></div><div class="modal-b"><div id="unifiedConfirmText" class="text-prewrap"></div></div><div class="modal-f"><button class="btn ghost" type="button" data-answer="false">Anuluj</button><button class="btn danger" type="button" data-answer="true" id="unifiedConfirmYes"></button></div>', 
        $("#overlay").appendChild(modal)), $("#unifiedConfirmTitle").textContent = title, 
        $("#unifiedConfirmText").textContent = String(message || "");
        const yes = $("#unifiedConfirmYes");
        yes.textContent = confirmLabel, yes.className = danger ? "btn danger" : "btn primary";
        const finish = value => {
            settled || (settled = !0, bindEvent(modal, "click", null), closeModal({
                notifyCancel: !1
            }), resolve(value));
        };
        bindEvent(modal, "click", e => {
            const b = e.target.closest("[data-answer]");
            b && finish("true" === b.dataset.answer);
        }), showModal(modal, {
            onCancel: () => finish(!1)
        }), requestAnimationFrame(() => yes.focus());
    });
}

function requireBusinessRecord(moduleId, id, {rerender: rerender = !0} = {}) {
    const records = ensureAppState().modules[moduleId];
    return (Array.isArray(records) ? records.find(x => x.id === id) : null) || (rerender && function(moduleId) {
        const module = ModuleRegistry.get(moduleId);
        if (!module) return !1;
        try {
            return module.render(), !0;
        } catch (error) {
            console.error(`Render modułu ${moduleId} nie powiódł się.`, error);
            try { StorageService.recordDiagnostic("render", moduleId, error); } catch {}
            toast(`Nie udało się odświeżyć modułu: ${moduleId}`, "err");
            return !1;
        }
    }(moduleId), toast("Rekord został już usunięty lub zmieniony.", "err"), null);
}

