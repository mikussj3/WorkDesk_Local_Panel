
function bootstrapRegisteredModules() {
    for (const module of ModuleRegistry.all()) {
        try {
            module.init();
            module.teardown();
            module.bind(document.querySelector(module.hostSelector));
            module.render();
        } catch (error) {
            BootState.fail(error), console.error(`[ModuleBootstrap] Moduł ${module?.id || "?"} nie wystartował:`, error);
            try {
                UI_ERROR_REGISTRY.record("bootstrap", module?.id || "unknown", error);
            } catch {}
        }
    }
    for (const step of [ updateTileFilterBadges, checkCalendarReminders, updateCharBadge, validateAllRecipients, refreshDataBadge, applyStorageInputLimits, renderStorageDashboard ]) try {
        step();
    } catch (error) {
        BootState.fail(error), console.error("[ModuleBootstrap] Krok po-modułowy nie powiódł się:", error);
        try {
            UI_ERROR_REGISTRY.record("bootstrap", step?.name || "post-step", error);
        } catch {}
    }
}

try {
    bootstrapRegisteredModules();
} catch (error) {
    BootState.fail(error), console.error("[ModuleBootstrap] Bootstrap przerwany:", error);
}

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
