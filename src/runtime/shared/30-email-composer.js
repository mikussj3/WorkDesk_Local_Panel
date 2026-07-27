
const DEFAULT_EMAIL_SIGNATURE = "—\nImię Nazwisko";
const EMAIL_FORM_FIELDS = Object.freeze({
    to: "#fTo",
    cc: "#fCc",
    bcc: "#fBcc",
    subject: "#fSubject",
    body: "#fBody",
    signature: "#fSig"
}), EmailComposerState = (() => {
    const state = () => {
        const modules = ensureAppState().modules, current = modules.emailUI && "object" == typeof modules.emailUI ? modules.emailUI : {}, base = {
            form: {
                to: "",
                cc: "",
                bcc: "",
                subject: "",
                body: "",
                signature: DEFAULT_EMAIL_SIGNATURE
            },
            selectedGroups: {
                To: [],
                Cc: [],
                Bcc: []
            },
            activeTemplate: null,
            activeProfile: null,
            draftRestored: !1,
            phase: "recipients",
            status: {
                kind: "idle",
                message: "Gotowe"
            }
        };
        current.form = {
            ...base.form,
            ...current.form || {}
        };
        if (!current.signatureDefaultVersion) {
            if (!String(current.form.signature || "").trim()) current.form.signature = DEFAULT_EMAIL_SIGNATURE;
            current.signatureDefaultVersion = 1;
        }
        current.selectedGroups = current.selectedGroups && "object" == typeof current.selectedGroups ? current.selectedGroups : {};
        [ "To", "Cc", "Bcc" ].forEach(kind => {
            Array.isArray(current.selectedGroups[kind]) || (current.selectedGroups[kind] = []);
        });
        return current.phase = current.phase || base.phase, current.status = current.status || base.status, 
        modules.emailUI = current, current;
    }, read = () => ({
        ...state().form
    }), render = (fields = Object.keys(EMAIL_FORM_FIELDS)) => {
        const form = state().form;
        return fields.forEach(key => {
            const el = $(EMAIL_FORM_FIELDS[key]);
            el && el.value !== String(form[key] ?? "") && (el.value = String(form[key] ?? ""));
        }), updateCharBadge?.(), read();
    }, update = (patch = {}, options = {}) => {
        const s = state(), changed = [];
        return Object.keys(EMAIL_FORM_FIELDS).forEach(key => {
            Object.prototype.hasOwnProperty.call(patch, key) && (s.form[key] = String(patch[key] ?? ""), 
            changed.push(key));
        }), !1 !== options.render && render(changed), !1 !== options.persist && requestFullSnapshot(), 
        read();
    }, groups = kind => state().selectedGroups[kind] || (state().selectedGroups[kind] = []), buildBody = () => {
        const {body: body, signature: signature} = state().form;
        return signature ? body.replace(/\s+$/, "") + "\n\n" + signature : body;
    };
    return Object.freeze({
        state: state,
        read: read,
        render: render,
        update: update,
        clear: () => {
            const s = state();
            return s.form = {
                to: "",
                cc: "",
                bcc: "",
                subject: "",
                body: "",
                signature: DEFAULT_EMAIL_SIGNATURE
            }, s.selectedGroups = {
                To: [],
                Cc: [],
                Bcc: []
            }, s.activeTemplate = null, s.activeProfile = null, s.draftRestored = !1, render(), 
            requestFullSnapshot(), read();
        },
        groups: groups,
        hasGroup: (kind, id) => groups(kind).includes(id),
        addGroup: (kind, id) => {
            const list = groups(kind);
            return list.includes(id) || list.push(id), requestFullSnapshot(), !0;
        },
        removeGroup: (kind, id) => {
            const list = groups(kind), i = list.indexOf(id);
            return i >= 0 && (list.splice(i, 1), requestFullSnapshot(), !0);
        },
        clearGroups: kind => {
            kind ? state().selectedGroups[kind] = [] : state().selectedGroups = {
                To: [],
                Cc: [],
                Bcc: []
            }, requestFullSnapshot();
        },
        setMeta: patch => (Object.assign(state(), patch), requestFullSnapshot(), state()),
        buildBody: buildBody,
        mailto: (to, overrides = {}) => {
            const form = state().form;
            const params = new URLSearchParams();
            const toList = formatRecipientsForMailto(to);
            const ccList = formatRecipientsForMailto(overrides.cc ?? form.cc);
            const bccList = formatRecipientsForMailto(overrides.bcc ?? form.bcc);
            const subject = overrides.subject ?? form.subject;
            const body = overrides.body ?? buildBody();
            if (ccList) params.set("cc", ccList);
            if (bccList) params.set("bcc", bccList);
            if (subject) params.set("subject", subject);
            params.set("body", body);
            return `mailto:${toList}?${params.toString().replace(/\+/g, "%20")}`;
        },
        draft: () => ({
            version: 2,
            form: read(),
            selectedGroups: {
                To: [ ...groups("To") ],
                Cc: [ ...groups("Cc") ],
                Bcc: [ ...groups("Bcc") ]
            },
            activeTemplate: state().activeTemplate,
            activeProfile: state().activeProfile,
            savedAt: Date.now()
        }),
        restoreDraft: value => {
            const d = value?.form ? value : {
                form: {
                    to: value?.fTo,
                    cc: value?.fCc,
                    bcc: value?.fBcc,
                    subject: value?.fSubject,
                    body: value?.fBody,
                    signature: value?.fSig
                },
                selectedGroups: value?.selectedGroups
            };
            return update(d.form || {}, {
                render: !1,
                persist: !1
            }), d.selectedGroups && (state().selectedGroups = {
                To: [ ...d.selectedGroups.To || [] ],
                Cc: [ ...d.selectedGroups.Cc || [] ],
                Bcc: [ ...d.selectedGroups.Bcc || [] ]
            }), state().draftRestored = !0, render(), requestFullSnapshot(), read();
        },
        bind: () => {
            $("#email")?.addEventListener("input", event => {
                const entry = Object.entries(EMAIL_FORM_FIELDS).find(([, selector]) => selector === "#" + event.target.id);
                entry && (update({
                    [entry[0]]: event.target.value
                }, {
                    render: !1
                }), scheduleDraftSave?.());
            }), render();
        }
    });
})();

class ComposerGroupSet {
    constructor(kind) {
        this.kind = kind;
    }
    has(id) {
        return EmailComposerState.hasGroup(this.kind, id);
    }
    add(id) {
        return EmailComposerState.addGroup(this.kind, id), this;
    }
    delete(id) {
        return EmailComposerState.removeGroup(this.kind, id);
    }
    clear() {
        EmailComposerState.clearGroups(this.kind);
    }
    [Symbol.iterator]() {
        return EmailComposerState.groups(this.kind)[Symbol.iterator]();
    }
    get size() {
        return EmailComposerState.groups(this.kind).length;
    }
}

const groupState = {
    To: new ComposerGroupSet("To"),
    Cc: new ComposerGroupSet("Cc"),
    Bcc: new ComposerGroupSet("Bcc")
};

function renderGroups(filter = "") {
    const host = $("#groupsHost"), normalized = normalizeEmailGroupSearch(filter), nodes = [];
    let visible = 0;
    for (const section of sortedSectionsForRender()) {
        const groups = section.groups.filter(group => matchesGroupFilter(group, section, normalized));
        if (!groups.length) continue;
        visible += groups.length;
        const block = SafeDOM.el("div", { className: "section-block" });
        block.append(SafeDOM.el("div", { className: "section-title" }, [
            SafeDOM.el("span", { text: section.name }),
            SafeDOM.el("span", { className: "line" }),
            SafeDOM.el("span", { text: groups.length })
        ]));
        for (const group of groups) {
            const id = makeEmailGroupId(section.name, group.name);
            const checks = ["To", "Cc", "Bcc"].map(kind => {
                const input = SafeDOM.el("input", {
                    checked: groupState[kind].has(id),
                    attrs: { type: "checkbox", "aria-label": `${section.name} — ${group.name} — ${kind === "To" ? "Do" : kind === "Cc" ? "DW" : "UDW"}` },
                    dataset: { key: id, kind }
                });
                return SafeDOM.el("label", { className: "checkbox", dataset: { testid: `grp-${kind.toLowerCase()}-${group.name}` } }, [
                    input,
                    SafeDOM.text(kind === "To" ? "To" : kind === "Cc" ? "CC" : "BCC")
                ]);
            });
            block.append(SafeDOM.el("div", { className: "group", dataset: { groupId: id } }, [
                SafeDOM.el("div", { className: "g-name" }, [
                    SafeDOM.el("span", { text: group.name }),
                    SafeDOM.el("span", { className: "count", text: group.emails.length })
                ]),
                SafeDOM.el("div", { className: "g-checks" }, [ ...checks, SafeDOM.el("button", { className: "icon-btn", text: "✎", attrs: { type: "button", "aria-label": `Edytuj grupę ${group.name}` }, dataset: { groupAction: "edit", groupId: id } }), SafeDOM.el("button", { className: "icon-btn", text: "✕", attrs: { type: "button", "aria-label": `Usuń grupę ${group.name}` }, dataset: { groupAction: "delete", groupId: id } }) ])
            ]));
        }
        nodes.push(block);
    }
    SafeDOM.replace(host, visible ? nodes : SafeDOM.el("div", {
        className: "empty",
        text: `Brak wyników dla „${filter}”.`,
        style: { padding: "14px", "text-align": "center", color: "var(--text-mute)", "font-size": "12.5px" }
    }));
    $$("#groupsHost input[type=checkbox]").forEach(cb => cb.addEventListener("change", onGroupToggle));
    updateVisibleGroupsControl();
}

function visibleGroupIds() {
    const filter = normalizeEmailGroupSearch($("#grpSearch").value), ids = [];
    return sortedSectionsForRender().forEach(sec => {
        sec.groups.filter(g => matchesGroupFilter(g, sec, filter)).forEach(g => ids.push(makeEmailGroupId(sec.name, g.name)));
    }), ids;
}

function updateVisibleGroupsControl() {
    const ids = visibleGroupIds();
    [ "To", "Cc", "Bcc" ].forEach(kind => {
        const cb = $(`#checkVisible${kind}`);
        if (!cb) return;
        const checked = ids.filter(id => groupState[kind].has(id)).length;
        cb.checked = ids.length > 0 && checked === ids.length, cb.indeterminate = checked > 0 && checked < ids.length, 
        cb.disabled = 0 === ids.length, cb.closest(".checkbox")?.classList.toggle("on", checked > 0);
    });
    const badge = $("#visibleGroupsBadge");
    badge && (badge.textContent = `${ids.length} wid.`);
}

const EMAIL_GROUP_ID_SEPARATOR = "::";
let renameRecentEmailGroup = () => {}, removeRecentEmailGroup = () => {};

function makeEmailGroupId(sectionName, groupName) {
    return `${String(sectionName || "").trim()}${EMAIL_GROUP_ID_SEPARATOR}${String(groupName || "").trim()}`;
}

function parseEmailGroupId(id) {
    const value = String(id || ""), separatorIndex = value.indexOf(EMAIL_GROUP_ID_SEPARATOR);
    return separatorIndex < 0 ? { sectionName: "", groupName: value } : {
        sectionName: value.slice(0, separatorIndex),
        groupName: value.slice(separatorIndex + EMAIL_GROUP_ID_SEPARATOR.length)
    };
}

function findEmailGroupRecord(id) {
    const {sectionName, groupName} = parseEmailGroupId(id), section = runtimeData.sections.find(item => item.name === sectionName), group = section?.groups.find(item => item.name === groupName);
    return group ? { section, group, id: makeEmailGroupId(section.name, group.name) } : null;
}

function validEmailGroupIds() {
    return new Set((runtimeData.sections || []).flatMap(section => (section.groups || []).map(group => makeEmailGroupId(section.name, group.name))));
}

function reconcileSelectedEmailGroups() {
    const valid = validEmailGroupIds();
    let changed = false;
    [ "To", "Cc", "Bcc" ].forEach(kind => {
        const list = EmailComposerState.groups(kind), next = list.filter(id => valid.has(id));
        if (next.length !== list.length) list.splice(0, list.length, ...next), changed = true;
    });
    changed && requestFullSnapshot();
    return changed;
}

function selectedEmailAddresses(kind, excludeId = null) {
    return new Set(EmailComposerState.groups(kind).filter(id => id !== excludeId).flatMap(id => findEmailGroupRecord(id)?.group.emails || []));
}

function reconcileSelectedGroupMutation(oldId, oldEmails, newId = null, newEmails = []) {
    [ "To", "Cc", "Bcc" ].forEach(kind => {
        const list = EmailComposerState.groups(kind), index = list.indexOf(oldId);
        if (index < 0) return;
        const otherSelectedEmails = selectedEmailAddresses(kind, oldId), removeCandidates = new Set(oldEmails || []), current = parseEmails(fieldFor(kind)?.value || "");
        const next = current.filter(address => !removeCandidates.has(address) || otherSelectedEmails.has(address));
        if (newId) {
            list.splice(index, 1, newId);
            next.push(...newEmails);
        } else list.splice(index, 1);
        const input = fieldFor(kind);
        if (input) {
            input.value = formatEmailField(next);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
}

function restoreSelectedEmailGroup(id, emails, kinds = []) {
    kinds.forEach(kind => {
        const list = EmailComposerState.groups(kind);
        list.includes(id) || list.push(id);
        const input = fieldFor(kind);
        if (input) {
            input.value = formatEmailField([ ...parseEmails(input.value), ...(emails || []) ]);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
}

function sortedSectionsForRender() {
    return runtimeData.sections.map(s => ({
        name: s.name,
        groups: [ ...s.groups ].sort((a, b) => byAlpha(a.name, b.name))
    }));
}

function normalizeEmailGroupSearch(value) {
    return String(value || "").trim().toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchesGroupFilter(group, section, filter) {
    const normalized = normalizeEmailGroupSearch(filter);
    return !normalized || normalizeEmailGroupSearch(group.name).includes(normalized) || normalizeEmailGroupSearch(section.name).includes(normalized);
}

function findGroupById(id) {
    return findEmailGroupRecord(id)?.group || null;
}

function fieldFor(kind) {
    return $({
        To: "#fTo",
        Cc: "#fCc",
        Bcc: "#fBcc"
    }[kind]);
}

function onGroupToggle(e) {
    const cb = e.currentTarget, id = cb.dataset.key, kind = cb.dataset.kind, grp = findGroupById(id);
    if (!grp) return;
    const inp = fieldFor(kind), current = parseEmails(inp.value);
    if (cb.checked) {
        groupState[kind].add(id);
        const merged = uniq([ ...current, ...grp.emails ]);
        inp.value = merged.join("; ");
    } else {
        groupState[kind].delete(id);
        const stillSelectedEmails = selectedEmailAddresses(kind), remove = new Set(grp.emails.filter(address => !stillSelectedEmails.has(address)));
        inp.value = current.filter(address => !remove.has(address)).join("; ");
    }
    inp.dispatchEvent(new Event("input", { bubbles: true })), cb.closest(".checkbox").classList.toggle("on", cb.checked), 
    updateVisibleGroupsControl();
}

function parseEmails(str) {
    return String(str || "").split(/[,;\n]/).map(address => address.trim()).filter(Boolean);
}
function formatRecipientsForMailto(value) {
    return uniq(parseEmails(value)).join(",");
}
function formatEmailField(value) {
    return uniq(parseEmails(value)).join("; ");
}
function normalizeRecipientField(input) {
    if (!input) return "";
    const formatted = formatEmailField(input.value), fieldKey = ({ fTo: "to", fCc: "cc", fBcc: "bcc" })[input.id];
    if (input.value !== formatted) input.value = formatted;
    fieldKey && EmailComposerState.update({ [fieldKey]: formatted }, { render: false });
    return formatted;
}


function sortedTemplates() {
    return [ ...runtimeData.templates ].sort((a, b) => byAlpha(a.name, b.name));
}

function renderTemplateList() {
    SafeDOM.replace($("#tmplList"), sortedTemplates().map(template => SafeDOM.el("option", { attrs: { value: template.name } })));
}

function loadTemplateByName(name) {
    const t = runtimeData.templates.find(x => x.name === name);
    return t ? (EmailComposerState.update({
        to: formatEmailField(t.to || ""),
        cc: formatEmailField(t.cc || ""),
        bcc: formatEmailField(t.bcc || ""),
        subject: t.subject || "",
        body: t.body || "",
        signature: t.footer || ""
    }), EmailComposerState.setMeta({
        activeTemplate: name
    }), toast("Wczytano szablon: " + name), !0) : (toast("Nie znaleziono szablonu.", "err"), 
    !1);
}

function mailto(to) {
    return EmailComposerState.mailto(to);
}

BulkMailFlow = (() => {
    let recipients = [], index = 0;
    const render = () => {
        const total = recipients.length, current = Math.min(index + 1, total);
        $("#bulkMailSummary").textContent = `${total} odbiorców. Możesz otworzyć jedną wiadomość BCC albo każdą osobno.`;
        $("#bulkMailProgress").textContent = index >= total ? "Wszystkie wiadomości zostały otwarte." : `Następna wiadomość: ${current} z ${total}`;
        SafeDOM.replace($("#bulkMailList"), recipients.map((address, i) => SafeDOM.el("div", { className: `bulk-mail-row ${i < index ? "done" : i === index ? "current" : ""}` }, [
            SafeDOM.el("span", { className: "bulk-mail-address", text: address }),
            SafeDOM.el("span", { className: "bulk-mail-state", text: i < index ? "otwarto" : i === index ? "następny" : "oczekuje" })
        ])));
        $("#bulkMailNext").disabled = index >= total;
    };
    const open = values => {
        recipients = uniq(values).filter(Boolean), index = 0, render(), showModal("bulkMailModal", { opener: $("#bulkBtn") });
    };
    const openNext = () => {
        const address = recipients[index];
        if (!address) return;
        window.open(EmailComposerState.mailto(address, { cc: "", bcc: "" }), "_blank", "noopener"), index += 1, render();
    };
    const openBcc = () => {
        if (!recipients.length) return;
        window.location.href = EmailComposerState.mailto("", { cc: "", bcc: recipients.join(",") });
        index = recipients.length, render();
    };
    bindEvent($("#bulkMailNext"), "click", openNext), bindEvent($("#bulkMailBcc"), "click", openBcc);
    return Object.freeze({ open, openNext, openBcc, bccUrl: () => EmailComposerState.mailto("", { cc: "", bcc: recipients.join(",") }), stats: () => ({ total: recipients.length, opened: index, remaining: Math.max(0, recipients.length - index) }) });
})();

function updateCharBadge() {
    $("#charBadge").textContent = "znaki: " + EmailComposerState.read().body.length;
}

function getCurrentToken(input) {
    const v = input.value, caret = input.selectionStart ?? v.length, left = v.slice(0, caret), m = left.match(/([^,;\s][^,;]*)$/);
    return {
        token: (m ? m[1] : "").trim(),
        start: m ? left.length - m[0].length : caret
    };
}

function closeSugg(ctx) {
    UIRuntime.close(ctx.sugg.id, {
        reason: "suggestion-close",
        restoreFocus: !1
    }), ctx.activeIx = -1;
}

function pickSugg(ctx, val) {
    const {input: input} = ctx, v = input.value, {start: start} = getCurrentToken(input), before = v.slice(0, start), afterPart = v.slice(input.selectionStart ?? v.length);
    if (parseEmails(before + afterPart).includes(val)) return void closeSugg(ctx);
    const head = before.replace(/[,;\s]+$/, ""), tail = afterPart ? /^[,;]/.test(afterPart) ? afterPart : "; " + afterPart.trimStart() : "";
    input.value = (head ? head + "; " : "") + val + tail, input.dispatchEvent(new Event("input", { bubbles: true })), closeSugg(ctx), input.focus();
}

[ "To", "Cc", "Bcc" ].forEach(kind => {
    $(`#checkVisible${kind}`)?.addEventListener("change", e => {
        !function(kind, shouldCheck) {
            const ids = visibleGroupIds(), input = fieldFor(kind);
            let current = parseEmails(input.value);
            const visibleEmails = ids.flatMap(id => findGroupById(id)?.emails || []);
            if (shouldCheck) ids.forEach(id => groupState[kind].add(id)), current = uniq([ ...current, ...visibleEmails ]); else {
                ids.forEach(id => groupState[kind].delete(id));
                const stillSelectedEmails = new Set([ ...groupState[kind] ].flatMap(id => findGroupById(id)?.emails || [])), remove = new Set(visibleEmails.filter(mail => !stillSelectedEmails.has(mail)));
                current = current.filter(x => !remove.has(x));
            }
            input.value = current.join("; "), input.dispatchEvent(new Event("input", { bubbles: true })), renderGroups($("#grpSearch").value);
        }(kind, e.target.checked);
    });
}), $("#grpSearch").addEventListener("input", e => renderGroups(e.target.value));
let groupEditorId = null;
function openGroupEditor(id = null) {
    groupEditorId = id;
    const group = id ? findGroupById(id) : null, section = id ? parseEmailGroupId(id).sectionName : "";
    $("#groupTitle").textContent = group ? "Edytuj grupę" : "Dodaj nową grupę";
    $("#ngGenerate").textContent = group ? "Zapisz" : "Dodaj";
    $("#ngSection").value = section; $("#ngGroup").value = group?.name || ""; $("#ngEmails").value = (group?.emails || []).join("\n");
    showModal("groupModal");
}
$("#addGroupBtn").addEventListener("click", () => openGroupEditor());
delegateEvent($("#groupsHost"), "click", "[data-group-action]", async (event, button) => {
    event.preventDefault(); event.stopPropagation();
    const id = button.dataset.groupId;
    if (button.dataset.groupAction === "edit") return openGroupEditor(id);
    if (button.dataset.groupAction === "delete") {
        const group = findGroupById(id);
        if (!group || !await showConfirmModal(`Czy na pewno chcesz usunąć grupę „${group.name}”?`, {confirmLabel: "Usuń grupę"})) return;
        const snapshot = AppServices.emailGroups.remove(id);
        snapshot && offerUndo(`undo-group-${Date.now()}`, "Usunięto grupę", `Usunięto grupę „${snapshot.record.name}”.`, () => AppServices.emailGroups.restore(snapshot));
    }
});
$("#groupDefaultsRestore")?.addEventListener("click", openGroupDefaultsRestore);
$("#ngGenerate").addEventListener("click", () => {
    const result = AppServices.emailGroups.update(groupEditorId, { section: $("#ngSection").value, name: $("#ngGroup").value, emails: parseEmails($("#ngEmails").value) });
    if (!result.ok) return toast(result.errors.join("; "), "err");
    closeModal(); toast(groupEditorId ? "Zapisano grupę." : "Dodano grupę.");
}), $("#loadTmplBtn").addEventListener("click", () => {
    const v = $("#tmplSearch").value.trim();
    if (!v) return toast("Wybierz szablon z listy.", "err");
    loadTemplateByName(v);
}), $("#genTmplBtn").addEventListener("click", () => {
    const obj = {
        name: $("#tmplSearch").value.trim() || EmailComposerState.read().subject.trim() || "Nowy szablon",
        to: EmailComposerState.read().to.trim(),
        cc: EmailComposerState.read().cc.trim(),
        bcc: EmailComposerState.read().bcc.trim(),
        subject: EmailComposerState.read().subject.trim(),
        body: EmailComposerState.read().body,
        footer: EmailComposerState.read().signature
    };
    showCode("Nowy szablon — JSON do wklejenia", `// Wklej do tablicy runtimeData.templates:\n${JSON.stringify(obj, null, 2)}`);
}), $$("[data-clear]").forEach(b => {
    b.addEventListener("click", () => {
        const id = b.dataset.clear;
        $("#" + id).value = "", $("#" + id).dispatchEvent(new Event("input", { bubbles: true })), $("#" + id).focus();
    });
}), $("#clearBtn").addEventListener("click", () => {
    $("#tmplSearch").value = "", EmailComposerState.clear(), renderGroups($("#grpSearch").value), 
    updateCharBadge(), syncSignaturePresetState(), clearDraft(), validateAllRecipients(), toast("Wyczyszczono kompozytor.");
});
function prepareEmailSend({ navigate = true } = {}) {
    ["fTo", "fCc", "fBcc"].forEach(inputId => normalizeRecipientField(document.getElementById(inputId)));
    const form = EmailComposerState.read();
    const recipients = parseEmails(form.to);
    if (!recipients.length) {
        toast('Pole „Do" jest puste.', "err");
        return { ok: false, reason: "empty-to", uri: "" };
    }
    const invalid = [...recipients, ...parseEmails(form.cc), ...parseEmails(form.bcc)].filter(address => !EMAIL_RE.test(address));
    if (invalid.length) {
        toast(`Popraw nieprawidłowe adresy: ${invalid.slice(0, 2).join(", ")}`, "err");
        return { ok: false, reason: "invalid-address", invalid, uri: "" };
    }
    const uri = mailto(form.to);
    if (navigate) {
        window.location.href = uri;
        clearDraft();
        toast("Otwieram klienta poczty…");
    }
    return { ok: true, reason: "ready", uri, recipients };
}
$("#sendBtn").addEventListener("click", () => prepareEmailSend()), $("#bulkBtn").addEventListener("click", () => {
    const recipients = parseEmails(EmailComposerState.read().to);
    if (recipients.length < 2) return toast("Wpisz co najmniej 2 adresy w polu „Do”.", "err");
    BulkMailFlow.open(recipients);
}), $("#fBody").addEventListener("input", () => {
    updateCharBadge(), function() {
        const body = EmailComposerState.read().body.toLowerCase();
        if (body.length < 3) return void hideSmart();
        const hit = sortedTemplates().find(t => t.name && body.includes(t.name.toLowerCase()));
        hit ? lastSmartName === hit.name && $("#smartBar").classList.contains("show") || (lastSmartName = hit.name, 
        $("#smartText").textContent = `Wczytać szablon „${hit.name}”?`, $("#smartBar").classList.add("show")) : hideSmart();
    }();
}), [ "fTo", "fCc", "fBcc" ].forEach(function(inputId) {
    const input = $("#" + inputId), ctx = {
        input: input,
        sugg: $(`.sugg[data-suggest="${inputId}"]`),
        activeIx: -1
    };
    input.addEventListener("blur", () => normalizeRecipientField(input));
    input.addEventListener("input", () => function(ctx) {
        const {token: token} = getCurrentToken(ctx.input);
        if (token.length < 2) return void closeSugg(ctx);
        const used = new Set(parseEmails(ctx.input.value)), items = function() {
            const fromGroups = runtimeData.sections.flatMap(s => s.groups.flatMap(g => g.emails)), fromTpls = runtimeData.templates.flatMap(t => [ t.to, t.cc, t.bcc ].join(",").split(/[,;]/).map(x => x.trim()).filter(Boolean));
            return uniq([ ...fromGroups, ...fromTpls, ...runtimeData.knownMails ]).sort(byAlpha);
        }().filter(m => m.toLowerCase().includes(token.toLowerCase()) && !used.has(m)).slice(0, 8);
        ctx.activeIx = items.length ? 0 : -1, function(ctx, items) {
            if (!items.length) return closeSugg(ctx);            SafeDOM.replace(ctx.sugg, items.map((mail, index) => SafeDOM.el("div", {
                className: "item " + (index === ctx.activeIx ? "active" : ""),
                dataset: { v: mail }
            }, [SafeDOM.el("span", { text: mail }), SafeDOM.el("span", { className: "src", text: "enter" })]))),
            UIRuntime.open("suggestion", ctx.sugg, {
                opener: ctx.input,
                priority: 35
            }), $$(".item", ctx.sugg).forEach(it => it.addEventListener("mousedown", e => {
                e.preventDefault(), pickSugg(ctx, it.dataset.v);
            }));
        }(ctx, items);
    }(ctx)), input.addEventListener("keydown", e => function(ctx, e) {
        if (!ctx.sugg.classList.contains("open")) return;
        const items = $$(".item", ctx.sugg);
        if ("ArrowDown" === e.key) e.preventDefault(), ctx.activeIx = (ctx.activeIx + 1) % items.length; else if ("ArrowUp" === e.key) e.preventDefault(), 
        ctx.activeIx = (ctx.activeIx - 1 + items.length) % items.length; else {
            if ("Enter" === e.key && ctx.activeIx >= 0) return e.preventDefault(), void pickSugg(ctx, items[ctx.activeIx].dataset.v);
            if ("Escape" === e.key) return e.preventDefault(), void UIRuntime.close(ctx.sugg.id, {
                reason: "escape"
            });
        }
        items.forEach((it, i) => it.classList.toggle("active", i === ctx.activeIx));
    }(ctx, e)), input.addEventListener("blur", () => SchedulerService.scheduleTimeout(() => closeSugg(ctx), 120));
});

let lastSmartName = null;

function hideSmart() {
    $("#smartBar").classList.remove("show"), lastSmartName = null;
}

$("#smartLoad").addEventListener("click", () => {
    lastSmartName && loadTemplateByName(lastSmartName) && hideSmart();
}), $("#smartDismiss").addEventListener("click", hideSmart);


