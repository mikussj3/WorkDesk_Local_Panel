const MobileUX = (() => {
    const owner = "mobile-ux";
    const media = window.matchMedia("(max-width: 980px)");
    const nav = document.getElementById("mobileQuickNav");
    const topButton = document.getElementById("backToTopBtn");
    const sectionIds = [ "email", "mainContent", "todoPanel", "notesPanel", "calendarPanel", "journalPanel", "dataPanel" ];
    let compactApplied = false, activeLockUntil = 0;

    function reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    function setPanelOpen(panel, open) {
        if (!panel?.classList.contains("panel")) return;
        panel.classList.toggle("open", open);
        const head = panel.querySelector(":scope > .panel-h");
        head?.setAttribute("aria-expanded", String(open));
    }
    function reveal(target) {
        if (!target) return;
        if (target.id === "email") {
            const email = document.getElementById("email");
            const bar = document.getElementById("emailBar");
            if (!email?.classList.contains("expanded")) bar?.click();
        }
        const panel = target.closest(".panel");
        panel && setPanelOpen(panel, true);
        activeLockUntil = Date.now() + (reducedMotion() ? 100 : 2000);
        target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        markCurrent(target.id);
        SchedulerService.scheduleTimeout(() => {
            const focusTarget = panel?.querySelector(":scope > .panel-h") || target.querySelector?.("h1,h2,h3,[tabindex]") || target;
            if (focusTarget instanceof HTMLElement) {
                if (!focusTarget.hasAttribute("tabindex") && !focusTarget.matches("button,a,input,select,textarea")) focusTarget.tabIndex = -1;
                focusTarget.focus({ preventScroll: true });
            }
        }, 260, { owner, key: "focus-target" });
    }
    function markCurrent(id) {
        nav?.querySelectorAll("[data-mobile-target]").forEach(button => {
            const active = button.dataset.mobileTarget === id;
            button.toggleAttribute("aria-current", active);
        });
    }
    function applyCompactDefaults() {
        if (!media.matches || compactApplied) return;
        compactApplied = true;
        [ "notesPanel", "linksPanel", "toolsPanel", "journalPanel", "dataPanel" ].forEach(id => setPanelOpen(document.getElementById(id), false));
        [ "todoPanel", "calendarPanel" ].forEach(id => setPanelOpen(document.getElementById(id), true));
    }
    function syncMode() {
        const mobile = media.matches;
        if (nav) nav.hidden = !mobile;
        if (topButton) topButton.hidden = !mobile || window.scrollY < Math.max(420, window.innerHeight * .65);
        document.documentElement.classList.toggle("mobile-ux", mobile);
        mobile && applyCompactDefaults();
    }
    function activeFromViewport() {
        if (!media.matches) return;
        if (topButton) topButton.hidden = window.scrollY < Math.max(420, window.innerHeight * .65);
        if (Date.now() < activeLockUntil) return;
        const line = Math.max(110, window.innerHeight * .24);
        let current = sectionIds[0];
        for (const id of sectionIds) {
            const el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top <= line) current = id;
        }
        markCurrent(current);
    }
    function bind() {
        if (!nav || !topButton) return;
        EventLifecycle.on(nav, "click", event => {
            const button = event.target.closest("[data-mobile-target]");
            if (!(button instanceof HTMLElement)) return;
            reveal(document.getElementById(button.dataset.mobileTarget));
        }, { owner, key: "quick-nav-click" });
        EventLifecycle.on(topButton, "click", () => {
            window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
            document.querySelector(".navbar")?.focus?.({ preventScroll: true });
        }, { owner, key: "back-to-top" });
        EventLifecycle.on(window, "scroll", activeFromViewport, { owner, key: "scroll-state", passive: true });
        EventLifecycle.on(window, "resize", syncMode, { owner, key: "resize", passive: true });
        EventLifecycle.on(media, "change", syncMode, { owner, key: "media-change" });
        syncMode();
        activeFromViewport();
    }
    function audit() {
        const issues = [];
        if (!nav) issues.push("missing-mobile-nav");
        if (!topButton) issues.push("missing-back-to-top");
        for (const id of sectionIds) if (!document.getElementById(id)) issues.push(`missing-target:${id}`);
        return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues), mobile: media.matches, compactApplied });
    }
    return Object.freeze({ bind, reveal, syncMode, audit });
})();
MobileUX.bind();
