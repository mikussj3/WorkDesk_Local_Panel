
UIRuntime = (() => {
    const entries = new Map, stack = [], defaults = Object.freeze({
        priority: 10,
        closeOnEscape: !0,
        outsideClick: !0,
        closeOnContextChange: !0,
        modal: !1
    });
    let sequence = 0;
    const resolve = value => "string" == typeof value ? document.getElementById(value) || document.querySelector(value) : value, isVisible = entry => {
        const el = entry?.el;
        return !(!el || el.hidden) && (entry.modal ? stack.includes(entry) && "true" !== el.getAttribute("aria-hidden") : "none" !== getComputedStyle(el).display && (el.classList.contains("show") || el.classList.contains("open") || "false" === el.getAttribute("aria-hidden")));
    }, setExpanded = (opener, on) => opener?.setAttribute?.("aria-expanded", String(!!on)), syncModalLayer = () => {
        const modalTop = [ ...stack ].reverse().find(x => x.modal);
        ovEl.classList.toggle("show", !!modalTop), ovEl.setAttribute("aria-hidden", modalTop ? "false" : "true"), 
        document.body.classList.toggle("ui-runtime-locked", !!modalTop), document.body.style.removeProperty("overflow"), 
        Array.from(ovEl.children).filter(x => x.classList.contains("modal")).forEach(el => {
            const entry = stack.find(x => x.el === el && x.modal), open = !!entry;
            el.hidden = !open, el.classList.toggle("ui-layer-open", open), el.setAttribute("aria-hidden", open ? "false" : "true"), 
            open ? el.setAttribute("aria-modal", entry === modalTop ? "true" : "false") : el.removeAttribute("aria-modal"), 
            el.inert = open && entry !== modalTop;
        }), Array.from(document.body.children).forEach(el => {
            el === ovEl || el.classList.contains("toast-wrap") || el.classList.contains("drop-overlay") || "a11yLive" === el.id || "workdeskTooltip" === el.id || (modalTop ? (el.setAttribute("aria-hidden", "true"), el.inert = !0) : (el.removeAttribute("aria-hidden"), el.inert = !1));
        }), activeModal = modalTop?.el || null;
    }, register = def => {
        const el = resolve(def?.el || def?.id);
        if (!(el instanceof HTMLElement)) return null;
        const id = def.id || el.id || "transient-" + ++sequence;
        el.id || (el.id = id);
        const current = entries.get(id) || {}, modal = def.modal ?? el.classList.contains("modal"), entry = {
            ...defaults,
            ...current,
            ...def,
            id: id,
            el: el,
            modal: modal,
            priority: Number(def.priority ?? current.priority ?? (modal ? 80 : 10)),
            opener: resolve(def.opener) || current.opener || null,
            openedAt: current.openedAt || 0
        };
        return el.dataset.transientSurface = id, el.dataset.transientPriority = String(entry.priority), 
        modal || el.setAttribute("aria-hidden", isVisible(entry) ? "false" : "true"), entries.set(id, entry), 
        entry;
    }, discover = (root = document) => ([ [ "#snipPop", 40 ], [ ".sugg", 35 ], [ "#globalResults", 30 ], [ "#calDayMenu,.cal-day-menu", 45 ], [ "#cmdModal", 90, !0 ], [ "#quickActionsModal", 80, !0 ], [ "#recentActionsModal", 80, !0 ], [ "#csvImportModal", 80, !0 ], [ "#backupModal", 80, !0 ], [ "#storageCleanupModal", 80, !0 ], [ "#storageLimitsModal", 80, !0 ] ].forEach(([selector, priority, modal = !1]) => root.querySelectorAll(selector).forEach(el => register({
        id: el.id || void 0,
        el: el,
        priority: priority,
        modal: modal,
        outsideClick: "false" !== el.dataset.outsideClick
    }))), [ ...entries.values() ]), opened = () => [ ...stack ].filter(isVisible).sort((a, b) => b.priority - a.priority || b.openedAt - a.openedAt), close = (id, {reason: reason = "api", restoreFocus: restoreFocus = !0} = {}) => {
        const entry = "object" == typeof id && id?.el ? id : entries.get("string" == typeof id ? id : id?.id) || stack.find(x => x.el === id);
        if (!entry) return !1;
        if (entry.closePolicy && !1 === entry.closePolicy({
            reason: reason,
            entry: entry
        })) return !1;
        const index = stack.indexOf(entry);
        return index >= 0 && stack.splice(index, 1), entry.modal ? (entry.el.inert = !1, 
        entry.el.hidden = !0, entry.el.classList.remove("ui-layer-open")) : (entry.el.classList.remove("show", "open"), 
        entry.el.matches(".snip-pop") && (entry.el.hidden = !0), entry.el.setAttribute("aria-hidden", "true")), 
        setExpanded(entry.opener, !1), entry.openedAt = 0, entry.onClose?.({
            reason: reason,
            entry: entry
        }), syncModalLayer(), restoreFocus && ("context-switch" === reason || entry.opener?.isConnected ? entry.opener?.isConnected && "context-switch" !== reason && requestAnimationFrame(() => entry.opener.focus?.()) : requestAnimationFrame(() => {
            (document.querySelector("main.main") || document.body).focus?.({
                preventScroll: !0
            });
        })),
        !0;
    }, unregister = id => {
        const entry = "string" == typeof id ? entries.get(id) : id?.id ? entries.get(id.id) : stack.find(x => x.el === id);
        if (!entry) return !1;
        close(entry, { reason: "unregister", restoreFocus: !1 });
        entries.delete(entry.id);
        entry.el?.removeAttribute?.("data-transient-surface");
        return !0;
    }, closeAll = ({reason: reason = "context-switch", belowPriority: belowPriority = 1 / 0, except: except = null, modal: modal = null} = {}) => opened().filter(x => x.id !== except && x.priority <= belowPriority && x.closeOnContextChange && (null === modal || x.modal === modal)).forEach(x => close(x, {
        reason: reason,
        restoreFocus: !1
    })), closeTop = ({reason: reason = "escape", notifyCancel: notifyCancel = !0} = {}) => {
        const entry = opened().find(x => "escape" !== reason || x.closeOnEscape);
        if (!entry) return !1;
        if (notifyCancel && entry.onCancel) {
            const fn = entry.onCancel;
            return entry.onCancel = null, fn(), !0;
        }
        return close(entry, {
            reason: reason
        });
    }, top = () => opened()[0] || null;
    return EventLifecycle.on(document, "keydown", e => {
        const entry = top();
        if ("Escape" === e.key && entry?.closeOnEscape) return e.preventDefault(), e.stopImmediatePropagation(), 
        void closeTop({
            reason: "escape"
        });
        if ("Tab" !== e.key || !entry?.modal) return;
        const focusable = [ ...entry.el.querySelectorAll(MODAL_FOCUSABLE) ].filter(el => !el.hidden && !el.inert);
        if (!focusable.length) return e.preventDefault(), void entry.el.focus();
        const first = focusable[0], last = focusable.at(-1);
        e.shiftKey && document.activeElement === first ? (e.preventDefault(), last.focus()) : e.shiftKey || document.activeElement !== last || (e.preventDefault(), 
        first.focus());
    }, !0), EventLifecycle.on(document, "pointerdown", e => {
        const entry = top();
        entry && entry.outsideClick && !entry.el.contains(e.target) && !entry.opener?.contains?.(e.target) && (entry.modal && e.target !== ovEl || close(entry, {
            reason: "outside-click",
            restoreFocus: !1
        }));
    }, !0), EventLifecycle.on(document, "focusin", e => {
        const entry = top();
        entry?.modal && !entry.el.contains(e.target) && requestAnimationFrame(() => {
            const policy = MODAL_POLICIES?.[entry.id];
            (policy?.focus && entry.el.querySelector(policy.focus) || entry.el.querySelector(MODAL_FOCUSABLE) || entry.el).focus();
        });
    }), EventLifecycle.on(document, "click", e => {
        const closer = e.target.closest("[data-close]");
        if (closer) return e.preventDefault(), void close(closer.dataset.close || closer.closest(".modal")?.id, {
            reason: "control"
        });
        const opener = e.target.closest("[aria-controls]");
        if (opener) {
            const id = opener.getAttribute("aria-controls"), entry = entries.get(id);
            entry && (entry.opener = opener);
        }
        e.target.closest("[data-context-change],.nav-links a,.tile,[data-transient-context-change]") && closeAll({
            reason: "context-switch",
            modal: !1
        });
    }, !0), Object.freeze({
        register: register,
        unregister: unregister,
        discover: discover,
        open: (type, id, options = {}) => {
            discover();
            const el = resolve(id);
            if (!(el instanceof HTMLElement)) return !1;
            AccessibilityRuntime?.normalize(el);
            const modal = options.modal ?? ("modal" === type || el.classList.contains("modal")), entry = entries.get(el.id) || register({
                id: el.id,
                el: el,
                modal: modal,
                ...options
            });
            if (!entry) return !1;
            Object.assign(entry, {
                ...options,
                modal: modal,
                type: type || entry.type || (modal ? "modal" : "surface")
            }), entry.priority = Number(options.priority ?? entry.priority ?? (modal ? 80 : 10)), 
            entry.closeOnContextChange && !1 !== options.contextCloseOthers && closeAll({
                reason: "context-switch",
                belowPriority: entry.priority,
                except: entry.id
            }), entry.opener = resolve(options.opener) || (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null) || entry.opener, 
            entry.openedAt = ++sequence, entry.closePolicy = options.closePolicy || entry.closePolicy;
            const old = stack.indexOf(entry);
            if (old >= 0 && stack.splice(old, 1), stack.push(entry), modal) {
                (el => {
                    el.setAttribute("role", el.getAttribute("role") || "dialog");
                    const title = el.querySelector(".modal-h h1,.modal-h h2,.modal-h h3,[data-modal-title]");
                    title ? (title.id || (title.id = `${el.id || "dialog"}-title`), el.setAttribute("aria-labelledby", title.id)) : el.hasAttribute("aria-label") || el.setAttribute("aria-label", "Okno dialogowe");
                    const body = el.querySelector(".modal-b,[data-modal-description]");
                    body && (body.id || (body.id = `${el.id || "dialog"}-description`), el.setAttribute("aria-describedby", body.id));
                    const focusEntry = el.querySelector("[data-modal-focus-entry]") || el.querySelector(MODAL_FOCUSABLE);
                    focusEntry?.setAttribute("data-modal-focus-entry", "true");
                })(el), el.hidden = !1, el.tabIndex = -1, syncModalLayer();
                const policy = MODAL_POLICIES?.[el.id];
                requestAnimationFrame(() => {
                    AccessibilityRuntime?.normalize(el);
                    (policy?.focus && el.querySelector(policy.focus) || el.querySelector("[data-modal-focus-entry]") || el.querySelector(MODAL_FOCUSABLE) || el).focus();
                });
            } else el.hidden = !1, el.classList.add(entry.openClass || (/cal-day-menu|global-results/.test(el.className) ? "show" : "open")), 
            el.setAttribute("aria-hidden", "false"), setExpanded(entry.opener, !0);
            return !0;
        },
        close: close,
        closeTop: closeTop,
        closeAll: closeAll,
        closeAllTransient: reason => closeAll({
            reason: reason || "context-switch",
            modal: !1
        }),
        opened: opened,
        audit: () => {
            discover();
            const rows = [ ...entries.values() ].map(x => ({
                id: x.id,
                modal: x.modal,
                opener: !!x.opener || !!document.querySelector(`[aria-controls="${CSS.escape(x.id)}"]`),
                escape: "boolean" == typeof x.closeOnEscape,
                outside: "boolean" == typeof x.outsideClick,
                priority: Number.isFinite(x.priority),
                aria: x.modal || x.el.hasAttribute("aria-hidden")
            }));
            return {
                ok: rows.every(x => x.escape && x.outside && x.priority && x.aria),
                rows: rows,
                open: opened().map(x => x.id)
            };
        },
        get: id => entries.get(id),
        entries: () => [ ...entries.values() ],
        top: top,
        get stack() {
            return stack.map(x => ({
                type: x.type,
                id: x.id,
                el: x.el,
                opener: x.opener,
                modal: x.modal,
                priority: x.priority
            }));
        }
    });
})();

function showModal(target, {onCancel: onCancel = null, ...options} = {}) {
    const el = "string" == typeof target ? document.getElementById(target) : target, policy = MODAL_POLICIES?.[el?.id] || {};
    return UIRuntime.open("modal", el, {
        ...policy,
        ...options,
        onCancel: onCancel,
        modal: !0
    });
}

function closeModal(arg = {}) {
    return "string" == typeof arg ? UIRuntime.close(arg) : UIRuntime.closeTop(arg || {});
}

