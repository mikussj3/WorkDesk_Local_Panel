(() => {
    "use strict";
    const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [ ...r.querySelectorAll(s) ], safeId = (prefix = "a11y") => `${prefix}-${Math.random().toString(36).slice(2, 9)}`, live = document.createElement("div");
    live.className = "a11y-live", live.id = "a11yLive", live.setAttribute("aria-live", "polite"),
    live.setAttribute("aria-atomic", "true"), document.body.appendChild(live), EventLifecycle.on(document, "keydown", () => document.documentElement.dataset.a11yKeyboard = "true", {
        once: !0,
        capture: !0
    }), EventLifecycle.on(document, "pointerdown", () => delete document.documentElement.dataset.a11yKeyboard, {
        capture: !0
    }), UI_ERRORS ||= [];
    let uiErrorNoticeArmed = !1;
    function uiErrorReportText() {
        const registry = UI_ERROR_REGISTRY.list().slice(0, 10).map(r => `[${r.scope}:${r.name}] ${r.message}`).join("\n") || "—";
        const runtimeErrors = UI_ERRORS.slice(0, 10).map(e => `[${e.type}] ${e.message}`).join("\n") || "—";
        const storage = (StorageService.diagnostics?.() || []).slice(0, 5).map(d => `[${d.operation}:${d.key}] ${d.message}`).join("\n") || "—";
        return `WorkDesk ${APP_VERSION}-${APP_META.buildTag} — opis błędu\nCzas: ${new Date().toISOString()}\nGotowość: ${window.WorkDeskReady === !0 ? "tak" : "nie"} · moduły: ${ModuleRegistry.all().length}\n\nRejestr błędów (UI_ERROR_REGISTRY):\n${registry}\n\nBłędy runtime (window/error, unhandledrejection):\n${runtimeErrors}\n\nDiagnostyka storage:\n${storage}`;
    }
    function showUiErrorDetails() {
        showInfoDialog("Coś nie zadziałało — szczegóły", uiErrorReportText());
    }
    function notifyUiError() {
        if (uiErrorNoticeArmed) return;
        uiErrorNoticeArmed = !0;
        try {
            AttentionCenter.notify({
                id: "ui-error",
                priority: "warning",
                rank: 60,
                title: t("uierror.title"),
                message: t("uierror.message"),
                actions: [ {
                    id: "details",
                    label: t("uierror.details"),
                    run: () => showUiErrorDetails()
                }, {
                    id: "copy",
                    label: t("uierror.copy"),
                    run: async () => {
                        const ok = await copyToClipboard(uiErrorReportText());
                        toast(ok ? "Opis błędu skopiowany — możesz go wkleić w zgłoszeniu." : "Nie udało się skopiować opisu błędu.", ok ? "ok" : "err");
                    },
                    keepOpen: !0
                } ],
                onDismiss: () => {
                    SchedulerService.scheduleTimeout(() => {
                        uiErrorNoticeArmed = !1;
                    }, 3e4, { owner: "ui-errors", key: "rearm" });
                }
            });
        } catch {}
    }
    EventLifecycle.on(window, "error", e => {
        UI_ERRORS.length < 100 && UI_ERRORS.push({
            type: "error",
            message: e.message,
            at: Date.now()
        }), notifyUiError();
    }), EventLifecycle.on(window, "unhandledrejection", e => {
        UI_ERRORS.length < 100 && UI_ERRORS.push({
            type: "promise",
            message: String(e.reason?.message || e.reason),
            at: Date.now()
        }), notifyUiError();
    }), function(root = document) {
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
        qa('[role="dialog"]', root).forEach(dialog => {
            if (dialog.querySelector("[data-modal-focus-entry]")) return;
            const entry = dialog.querySelector('input:not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
            entry?.setAttribute("data-modal-focus-entry", "true");
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
            const scheduleSync = () => queueMicrotask(sync), owner = "combobox-sync", key = input.id;
            EventLifecycle.on(input, "input", scheduleSync, { owner: owner, key: key + ":input" }),
            EventLifecycle.on(input, "keydown", e => {
                "Tab" === e.key && popup.classList.contains("open") && popup.classList.remove("open"),
                scheduleSync();
            }, { owner: owner, key: key + ":keydown" }),
            EventLifecycle.on(popup, "click", scheduleSync, { owner: owner, key: key + ":click" }),
            EventLifecycle.on(input, "blur", () => SchedulerService.scheduleTimeout(sync, 140, { owner: owner, key: key + ":blur-sync" }), { owner: owner, key: key + ":blur" });
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
        const scheduleSync = () => queueMicrotask(sync), owner = "command-palette";
        EventLifecycle.on(input, "input", scheduleSync, { owner: owner, key: "sync-input" }),
        EventLifecycle.on(input, "keydown", scheduleSync, { owner: owner, key: "sync-keydown" }),
        EventLifecycle.on(list, "click", scheduleSync, { owner: owner, key: "sync-click" }),
        EventLifecycle.on(input, "blur", () => {
            q("#cmdModal")?.contains(document.activeElement) || SchedulerService.scheduleTimeout(() => UIRuntime?.close?.("cmdModal"), 0, { owner: owner, key: "blur-close" });
        }, { owner: owner, key: "sync-blur" });
    }(), announceA11y = msg => {
        live.textContent = "", requestAnimationFrame(() => {
            live.textContent = String(msg || "");
        });
    };
})();
