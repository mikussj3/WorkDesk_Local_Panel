(() => {
    "use strict";
    const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [ ...r.querySelectorAll(s) ], safeId = (prefix = "a11y") => `${prefix}-${Math.random().toString(36).slice(2, 9)}`, live = document.createElement("div");
    live.className = "a11y-live", live.id = "a11yLive", live.setAttribute("aria-live", "polite"), 
    live.setAttribute("aria-atomic", "true"), document.body.appendChild(live), EventLifecycle.on(document, "keydown", function(e) {
        if (![ "Enter", " " ].includes(e.key)) return;
        const row = e.target.closest(".ui-row.row--interactive,.ui-row.row--selectable,.filter-badge");
        row && !e.target.closest("button,a,input,select,textarea") && (e.preventDefault(), 
        row.click());
    }), EventLifecycle.on(document, "keydown", () => document.documentElement.dataset.a11yKeyboard = "true", {
        once: !0,
        capture: !0
    }), EventLifecycle.on(document, "pointerdown", () => delete document.documentElement.dataset.a11yKeyboard, {
        capture: !0
    }), UI_ERRORS ||= [], EventLifecycle.on(window, "error", e => UI_ERRORS.push({
        type: "error",
        message: e.message,
        at: Date.now()
    })), EventLifecycle.on(window, "unhandledrejection", e => UI_ERRORS.push({
        type: "promise",
        message: String(e.reason?.message || e.reason),
        at: Date.now()
    })), function(root = document) {
        qa('button, [role="button"]', root).forEach((el, i) => {
            (function(el) {
                return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();
            })(el) || el.querySelector("svg,use,.ic") && (el.setAttribute("aria-label", `Akcja ${i + 1}`), 
            el.dataset.a11yAutolabel = "true");
        });
    }(), function(root = document) {
        qa("[tabindex]", root).forEach(el => {
            Number(el.getAttribute("tabindex")) > 0 && el.setAttribute("tabindex", "0");
        }), qa(".ui-row.row--interactive,.ui-row.row--selectable,.filter-badge", root).forEach(el => {
            el.matches("button,a,input,select,textarea,[tabindex]") || (el.tabIndex = 0);
        });
    }(), function(root = document) {
        qa('[role="dialog"]', root).forEach((dialog, i) => {
            dialog.setAttribute("aria-modal", "true");
            let titleId = dialog.getAttribute("aria-labelledby"), title = titleId && document.getElementById(titleId);
            title || (title = dialog.querySelector(".modal-h h1,.modal-h h2,.modal-h h3,[data-modal-title]"), 
            title && (title.id ||= safeId("dialog-title"), dialog.setAttribute("aria-labelledby", title.id)));
            let descId = dialog.getAttribute("aria-describedby"), desc = descId && document.getElementById(descId);
            if (desc || (desc = dialog.querySelector("[data-modal-description],.modal-description,.modal-b p"), 
            desc && (desc.id ||= safeId("dialog-desc"), dialog.setAttribute("aria-describedby", desc.id))), 
            !dialog.querySelector("[data-modal-focus-entry]")) {
                const entry = dialog.querySelector('input:not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
                entry?.setAttribute("data-modal-focus-entry", "true");
            }
        });
    }(), qa(".sugg[data-suggest]").forEach(p => {
        const id = p.dataset.suggest, input = document.getElementById(id);
        input && function(input) {
            const popup = document.querySelector(`.sugg[data-suggest="${CSS.escape(input.id)}"]`);
            if (!popup) return;
            popup.id ||= safeId("suggest"), popup.setAttribute("role", "listbox"), input.setAttribute("role", "combobox"), 
            input.setAttribute("aria-autocomplete", "list"), input.setAttribute("aria-controls", popup.id), 
            input.setAttribute("aria-expanded", popup.classList.contains("open") ? "true" : "false");
            const sync = () => {
                qa(".item", popup).forEach((it, i) => {
                    it.id ||= `${popup.id}-opt-${i}`, it.setAttribute("role", "option");
                    const active = it.classList.contains("active");
                    it.setAttribute("aria-selected", String(active)), active && input.setAttribute("aria-activedescendant", it.id);
                }), popup.classList.contains("open") ? input.setAttribute("aria-expanded", "true") : (input.setAttribute("aria-expanded", "false"), 
                input.removeAttribute("aria-activedescendant"));
            };
            sync();
            const scheduleSync = () => queueMicrotask(sync);
            input.addEventListener("input", scheduleSync), input.addEventListener("keydown", e => {
                "Tab" === e.key && popup.classList.contains("open") && popup.classList.remove("open"), 
                scheduleSync();
            }), popup.addEventListener("click", scheduleSync), input.addEventListener("blur", () => SchedulerService.scheduleTimeout(sync, 140));
        }(input);
    }), function() {
        const input = q("#cmdQuery"), list = q("#cmdList");
        if (!input || !list) return;
        list.id ||= "cmdList", list.setAttribute("role", "listbox"), input.setAttribute("role", "combobox"), 
        input.setAttribute("aria-controls", list.id), input.setAttribute("aria-autocomplete", "list");
        const sync = () => {
            qa(".cmd-item", list).forEach((el, i) => {
                el.id ||= `cmd-option-${i}`, el.setAttribute("role", "option"), el.tabIndex = -1;
                const active = el.classList.contains("active");
                el.setAttribute("aria-selected", String(active)), active && input.setAttribute("aria-activedescendant", el.id);
            }), input.setAttribute("aria-expanded", String(!q("#cmdModal")?.hidden));
        };
        sync();
        const scheduleSync = () => queueMicrotask(sync);
        input.addEventListener("input", scheduleSync), input.addEventListener("keydown", scheduleSync), 
        list.addEventListener("click", scheduleSync), input.addEventListener("blur", () => {
            q("#cmdModal")?.contains(document.activeElement) || SchedulerService.scheduleTimeout(() => UIRuntime?.close?.("cmdModal"), 0);
        });
    }(), announceA11y = msg => {
        live.textContent = "", requestAnimationFrame(() => {
            live.textContent = String(msg || "");
        });
    };})();
