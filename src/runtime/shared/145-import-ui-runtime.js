(() => {
    "use strict";
    AppDialog = Object.freeze({
        editText(options = {}) {
            const id = options.id || "appEditTextModal";
            let modal = document.getElementById(id);
            modal || (modal = document.createElement("div"), modal.className = "modal", modal.id = id, 
            modal.setAttribute("role", "dialog"), document.getElementById("overlay")?.appendChild(modal));
            const titleId = `${id}Title`, descId = `${id}Desc`, inputId = `${id}Input`;
            modal.setAttribute("aria-labelledby", titleId);
            modal.setAttribute("aria-describedby", descId);
            const title = SafeDOM.el("h3", { text: options.title || "Edytuj", attrs: { id: titleId } });
            const close = SafeDOM.el("button", { className: "icon-btn x", text: "✕", attrs: { type: "button", "data-dialog-cancel": "", "aria-label": "Zamknij" } });
            const textarea = SafeDOM.el("textarea", { value: options.value || "", attrs: { id: inputId, "data-modal-focus-entry": "", maxlength: Number(options.maxLength) || 1000 } });
            SafeDOM.replace(modal, [
                SafeDOM.el("div", { className: "modal-h" }, [title, close]),
                SafeDOM.el("div", { className: "modal-b" }, [SafeDOM.el("p", { className: "modal-description", text: options.description || "Wprowadź wartość.", attrs: { id: descId } }), SafeDOM.el("div", { className: "field" }, [SafeDOM.el("label", { text: options.label || "Wartość", attrs: { for: inputId } }), textarea, SafeDOM.el("div", { className: "field-info", attrs: { "data-dialog-error": "", "aria-live": "polite" } })])]),
                SafeDOM.el("div", { className: "modal-f" }, [SafeDOM.el("button", { className: "btn ghost", text: "Anuluj", attrs: { type: "button", "data-dialog-cancel": "" } }), SafeDOM.el("button", { className: "btn primary", text: options.confirmLabel || "Zapisz", attrs: { type: "button", "data-dialog-confirm": "" } })])
            ]);
            return new Promise(resolve => {
                let settled = !1;
                const finish = value => {
                    settled || (settled = !0, UIRuntime?.close(id), resolve(value));
                };
                modal.querySelectorAll("[data-dialog-cancel]").forEach(btn => btn.addEventListener("click", () => finish(null), {
                    once: !0
                })), modal.querySelector("[data-dialog-confirm]")?.addEventListener("click", () => {
                    const input = modal.querySelector(`#${CSS.escape(inputId)}`), value = input?.value ?? "";
                    if (!1 !== options.required && !value.trim()) return modal.querySelector("[data-dialog-error]").textContent = "Pole nie może być puste.", 
                    void input?.focus();
                    finish(value);
                }, {
                    once: !0
                }), modal.addEventListener("keydown", e => {
                    (e.ctrlKey || e.metaKey) && "Enter" === e.key && (e.preventDefault(), modal.querySelector("[data-dialog-confirm]")?.click());
                }, {
                    once: !0
                }), UIRuntime?.open("modal", id, {
                    outsideClick: !1,
                    closeOnEscape: !0
                }), requestAnimationFrame(() => modal.querySelector(`#${CSS.escape(inputId)}`)?.focus());
            });
        }
    });
    const RenderContractRuntime = (() => {
        const records = new Map, structuralHooks = new Set([ "qr-buttons", "pf36-data-actions", "pf1115-todo", "pf1115-journal", "pf1115-notes", "pf1115-calendar", "pf1115-tiles" ]);
        function localAudit(moduleId, root) {
            if (!root) return {
                ok: !1,
                reason: "missing-root"
            };
            root.querySelectorAll?.(".group,.todo-item,.journal-item,.cal-reminder-item,.backup-list .b-row,.flink,.business-row").forEach(el => normalizeRow?.(el)), 
            labelIconActions?.(root), root.querySelectorAll?.(".modal").forEach(el => ensureModalSemantics?.(el)), 
            "tiles" === moduleId && $$(".tile.copy-tile", $("#tilesHost")).forEach(el => {
                if (el.querySelector(".qr-btn")) return;
                const t = runtimeData.tiles.find(x => x.id === el.dataset.tileId), title = t?.title || el.dataset.title;
                if (!t) return;
                const btn = document.createElement("button");
                btn.className = "qr-btn", btn.setAttribute("aria-label", "Pokaż QR"), btn.title = "Pokaż jako kod QR", 
                btn.setAttribute("data-testid", "qr-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-")), 
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h1v1h-1zM18 18h3v3h-3z"/></svg>', 
                btn.addEventListener("click", e => {
                    e.preventDefault(), e.stopPropagation(), showQrModal(t.value, t.title);
                }), el.appendChild(btn);
            });
            const unnamed = [ ...root.querySelectorAll?.('button,[role="button"]') || [] ].filter(el => !(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim());
            return {
                ok: 0 === unnamed.length,
                unnamedActions: unnamed.length
            };
        }
        return {
            render: function(moduleId, context = {}) {
                const controller = MODULE_LIFECYCLE?.get(moduleId);
                if (!controller) return {
                    ok: !1,
                    reason: "missing-controller"
                };
                const module = ModuleRegistry.get(moduleId), root = {
                    todo: "#todoList",
                    journal: "#journalList",
                    notes: "#notesHost",
                    calendarReminders: "#calReminderList",
                    tiles: "#tilesHost"
                }[moduleId] && document.querySelector({
                    todo: "#todoList",
                    journal: "#journalList",
                    notes: "#notesHost",
                    calendarReminders: "#calReminderList",
                    tiles: "#tilesHost"
                }[moduleId]) || document, state = ensureAppState()?.modules?.[moduleId], checksum = (value => {
                    let h = 2166136261;
                    const text = "string" == typeof value ? value : JSON.stringify(value ?? null);
                    for (let i = 0; i < text.length; i++) h ^= text.charCodeAt(i), h = Math.imul(h, 16777619);
                    return (h >>> 0).toString(36);
                })(state), previous = records.get(moduleId);
                if (previous?.checksum === checksum && root?.dataset?.renderChecksum === checksum && !context.force) return {
                    ok: !0,
                    skipped: !0,
                    checksum: checksum,
                    stamp: previous.stamp
                };
                const started = performance.now();
                MODULE_LIFECYCLE?.run(moduleId, "beforeRender", {
                    root: root,
                    state: state,
                    context: context
                });
                const result = safeAction(`pipeline.render:${moduleId}`, () => module.render(root, state, context), {
                    context: {
                        moduleId: moduleId
                    }
                });
                module.bind(root), MODULE_LIFECYCLE?.run(moduleId, "bindEvents", {
                    root: root,
                    state: state,
                    context: context
                });
                const audit = localAudit(moduleId, root), stamp = (previous?.stamp || 0) + 1;
                root && (root.dataset.renderChecksum = checksum, root.dataset.renderStamp = String(stamp));
                const rec = {
                    moduleId: moduleId,
                    checksum: checksum,
                    stamp: stamp,
                    durationMs: Math.round(100 * (performance.now() - started)) / 100,
                    audit: audit,
                    at: (new Date).toISOString()
                };
                return records.set(moduleId, rec), MODULE_LIFECYCLE?.run(moduleId, "afterRender", {
                    root: root,
                    state: state,
                    context: context,
                    audit: audit,
                    decorativeOnly: !0
                }), {
                    ok: !1 !== result && audit.ok,
                    result: result,
                    ...rec
                };
            },
            localAudit: localAudit,
            auditHooks: function() {
                const rows = MODULE_LIFECYCLE?.diagnostics?.() || [], violations = [];
                return rows.forEach(row => (row.hooks?.afterRender || []).forEach(owner => {
                    structuralHooks.has(owner) && violations.push({
                        moduleId: row.id,
                        owner: owner
                    });
                })), {
                    ok: 0 === violations.length,
                    violations: violations
                };
            },
            records: () => [ ...records.values() ]
        };
    })();})();
