const TooltipRuntime = (() => {
    const TOOLTIP_ID = "workdeskTooltip";
    const targetSelector = [
        "button.icon-btn",
        "button.clear",
        ".tile-action-bar button",
        "button.qr-btn",
        "button[data-icon-only]",
        "[role=\"button\"][data-icon-only]"
    ].join(",");
    let activeTarget = null;

    function tooltipElement() {
        let tooltip = document.getElementById(TOOLTIP_ID);
        if (tooltip) return tooltip;
        tooltip = document.createElement("div");
        tooltip.id = TOOLTIP_ID;
        tooltip.className = "global-tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.hidden = true;
        document.body.appendChild(tooltip);
        return tooltip;
    }

    function labelFor(element) {
        if (!(element instanceof Element)) return "";
        return String(
            element.dataset.tooltip ||
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            ""
        ).trim();
    }

    function isCompactIconButton(element) {
        if (!(element instanceof Element) || !element.matches("button,a,[role=\"button\"]")) return false;
        if (element.matches(targetSelector)) return true;
        const text = String(element.textContent || "").replace(/\s+/g, " ").trim();
        return !text || text.length <= 2 || /^[+\-×✕✓✔✎⌄⧉🔔📌📋📞☎↗←→↑↓⋮…]+$/u.test(text);
    }

    function normalize(root = document) {
        const scope = root instanceof Element || root instanceof Document ? root : document;
        scope.querySelectorAll("button,a,[role=\"button\"]").forEach(element => {
            if (!isCompactIconButton(element)) return;
            const label = labelFor(element);
            if (!label) return;
            element.dataset.tooltip = label;
            if (!element.getAttribute("aria-label")) element.setAttribute("aria-label", label);
            element.removeAttribute("title");
            element.setAttribute("aria-describedby", TOOLTIP_ID);
        });
    }

    function position(target, tooltip) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const gap = 8;
        const margin = 8;
        let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
        let top = targetRect.top - tooltipRect.height - gap;
        if (top < margin) top = targetRect.bottom + gap;
        top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    function show(target) {
        if (!(target instanceof Element) || !isCompactIconButton(target)) return false;
        const label = labelFor(target);
        if (!label) return false;
        target.dataset.tooltip = label;
        if (!target.getAttribute("aria-label")) target.setAttribute("aria-label", label);
        target.removeAttribute("title");
        target.setAttribute("aria-describedby", TOOLTIP_ID);
        const tooltip = tooltipElement();
        tooltip.textContent = label;
        tooltip.hidden = false;
        tooltip.dataset.open = "true";
        activeTarget = target;
        position(target, tooltip);
        return true;
    }

    function hide(target = null) {
        if (target && activeTarget && target !== activeTarget) return;
        const tooltip = document.getElementById(TOOLTIP_ID);
        if (tooltip) {
            tooltip.hidden = true;
            delete tooltip.dataset.open;
        }
        activeTarget = null;
    }



    function audit(root = document) {
        normalize(root);
        const scope = root instanceof Element || root instanceof Document ? root : document;
        const targets = [...scope.querySelectorAll("button,a,[role=\"button\"]")].filter(isCompactIconButton);
        const missing = targets.filter(element => !labelFor(element));
        const described = targets.filter(element => element.getAttribute("aria-describedby") === TOOLTIP_ID);
        return {
            ok: !missing.length && described.length === targets.length,
            targets: targets.length,
            described: described.length,
            missing: missing.map(element => element.id || element.dataset.action || element.outerHTML.slice(0, 120))
        };
    }

    return Object.freeze({ normalize, audit, show, hide, labelFor, isCompactIconButton });
})();

EventLifecycle.on(document, "pointerover", event => TooltipRuntime.show(event.target instanceof Element ? event.target.closest("button,a,[role=\"button\"]") : null), { owner: "tooltip-runtime", key: "pointerover" });
EventLifecycle.on(document, "pointerout", event => {
    const target = event.target instanceof Element ? event.target.closest("button,a,[role=\"button\"]") : null;
    if (target && event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    TooltipRuntime.hide(target);
}, { owner: "tooltip-runtime", key: "pointerout" });
EventLifecycle.on(document, "focusin", event => TooltipRuntime.show(event.target instanceof Element ? event.target.closest("button,a,[role=\"button\"]") : null), { owner: "tooltip-runtime", key: "focusin" });
EventLifecycle.on(document, "focusout", event => TooltipRuntime.hide(event.target instanceof Element ? event.target.closest("button,a,[role=\"button\"]") : null), { owner: "tooltip-runtime", key: "focusout" });
EventLifecycle.on(window, "scroll", () => TooltipRuntime.hide(), { owner: "tooltip-runtime", key: "scroll", capture: true, passive: true });
EventLifecycle.on(window, "resize", () => TooltipRuntime.hide(), { owner: "tooltip-runtime", key: "resize", passive: true });
document.readyState === "loading"
    ? EventLifecycle.once(document, "DOMContentLoaded", () => TooltipRuntime.normalize(document), { owner: "tooltip-runtime", key: "init" })
    : queueMicrotask(() => TooltipRuntime.normalize(document));
