
function bootstrapRegisteredModules() {
    for (const module of ModuleRegistry.all()) {
        module.init();
        module.teardown();
        module.bind(document.querySelector(module.hostSelector));
        module.render();
    }
    updateTileFilterBadges();
    checkCalendarReminders();
    updateCharBadge();
    validateAllRecipients();
    refreshDataBadge();
    applyStorageInputLimits();
    renderStorageDashboard();
}

bootstrapRegisteredModules();

try {
    BootState.mark("modules"), requestAnimationFrame(() => {
        try {
            BootState.mark("render");
            const missing = [ "todo", "notes", "journal", "calendarReminders" ].filter(id => !ModuleRegistry?.get?.(id));
            if (missing.length) throw new Error(`Missing required modules: ${missing.join(", ")}`);
            BootState.complete(), window.WorkDeskReady = !0, document.documentElement.dataset.workdeskReady = "true";
        } catch (error) {
            BootState.fail(error), document.documentElement.dataset.workdeskReady = "false";
        }
    });
} catch (error) {
    BootState.fail(error);
}
