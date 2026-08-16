const AppStore = Object.freeze({
    getState: () => ensureAppState(),
    getModule: id => ensureAppState().modules?.[id],
    replaceModule(id, next, {snapshot: snapshot = !0} = {}) {
        const state = ensureAppState();
        state.modules = state.modules || {};
        const current = state.modules[id];
        return Array.isArray(current) && Array.isArray(next) ? replaceArrayContents(current, next) : state.modules[id] = cloneData(next),
        snapshot && requestFullSnapshot(), state.modules[id];
    },
    updateModule(id, producer, options) {
        const current = cloneData(this.getModule(id)), next = producer(current);
        return this.replaceModule(id, void 0 === next ? current : next, options);
    },
    snapshot: () => cloneData(ensureAppState())
});

const Diagnostics = (() => {
    const gates = new Map();
    const last = new Map();
    const VALID_STATUS = new Set(["PASS", "FAIL", "WARNING", "NOT_RUN"]);
    const nowIso = () => new Date().toISOString();
    const freeze = value => Object.freeze(value);
    const normalizeIssues = value => Array.isArray(value) ? value.map(item => String(item)) : value ? [String(value)] : [];

    function result(id, input = {}, meta = {}) {
        const source = input && typeof input === "object" ? input : { ok: Boolean(input) };
        const ok = source.ok === null ? null : Boolean(source.ok);
        const status = VALID_STATUS.has(source.status) ? source.status : ok === null ? "NOT_RUN" : ok ? "PASS" : "FAIL";
        return freeze({
            id,
            status,
            ok,
            severity: source.severity || (status === "FAIL" ? "error" : status === "WARNING" ? "warning" : "info"),
            issues: freeze(normalizeIssues(source.issues)),
            metrics: freeze({ ...(source.metrics || {}) }),
            details: freeze({ ...(source.details || {}) }),
            durationMs: Number(source.durationMs || 0),
            generatedAt: source.generatedAt || nowIso(),
            release: meta.release !== false,
            category: meta.category || "runtime"
        });
    }

    function register(id, runner, meta = {}) {
        if (!id || typeof runner !== "function") throw new TypeError("Diagnostics.register requires id and runner");
        gates.set(id, freeze({ id, runner, meta: freeze({ ...meta }) }));
        return api;
    }

    function unregister(id) {
        last.delete(id);
        return gates.delete(id);
    }

    async function run(id, context = {}) {
        const gate = gates.get(id);
        if (!gate) return result(id, { ok: null, status: "NOT_RUN", issues: [`Unknown diagnostic gate: ${id}`] }, { release: false });
        const started = performance.now();
        try {
            const raw = await gate.runner(context);
            const report = result(id, { ...(raw || {}), durationMs: performance.now() - started }, gate.meta);
            last.set(id, report);
            return report;
        } catch (error) {
            const report = result(id, {
                ok: false,
                status: "FAIL",
                issues: [error?.message || String(error)],
                details: { stack: error?.stack || "" },
                durationMs: performance.now() - started
            }, gate.meta);
            last.set(id, report);
            return report;
        }
    }

    async function runMany(ids, context = {}) {
        const reports = [];
        for (const id of ids) reports.push(await run(id, context));
        const blocking = reports.filter(item => item.ok === false && item.severity === "error");
        return freeze({
            status: blocking.length ? "FAIL" : reports.some(item => item.status === "WARNING") ? "WARNING" : "PASS",
            ok: blocking.length === 0,
            reports: freeze(reports),
            issues: freeze(blocking.flatMap(item => item.issues)),
            generatedAt: nowIso()
        });
    }

    async function runAll(context = {}) {
        return runMany([...gates.keys()], context);
    }

    async function release(context = {}) {
        const ids = [...gates.values()].filter(gate => gate.meta.release !== false).map(gate => gate.id);
        const aggregate = await runMany(ids, context);
        return freeze({ ...aggregate, kind: "release", gateIds: freeze(ids) });
    }

    function status() {
        return freeze({
            ready: window.WorkDeskReady === true,
            modules: ModuleRegistry.all().length,
            storage: StorageService.status(),
            scheduler: SchedulerService.stats(),
            events: EventLifecycle.stats(),
            eventAudit: EventLifecycle.audit(),
            ui: UIRuntime.audit(),
            gates: gates.size,
            last: freeze(Object.fromEntries(last)),
            generatedAt: nowIso()
        });
    }

    function list() {
        return freeze([...gates.values()].map(gate => freeze({ id: gate.id, ...gate.meta })));
    }

    function lastReport(id) {
        return last.get(id) || null;
    }

    const api = freeze({ register, unregister, run, runMany, runAll, release, status, list, lastReport, result });
    return api;
})();

Diagnostics.register("runtime", () => {
    const snapshot = Diagnostics.status();
    const expectedModules = ModuleRegistry.all().length;
    const ok = window.WorkDeskReady === true && snapshot.modules === expectedModules && snapshot.eventAudit.ok !== false && snapshot.ui.ok !== false;
    return { ok, metrics: { modules: snapshot.modules, schedulerTasks: snapshot.scheduler.size, listeners: snapshot.events.active }, details: snapshot };
}, { category: "runtime", release: true });

Diagnostics.register("state-ownership", () => {
    const state = ensureAppState();
    const checks = {
        emailSections: runtimeData.sections === state.modules.email.sections,
        knownMails: runtimeData.knownMails === state.modules.email.knownMails,
        templates: runtimeData.templates === state.modules.templates,
        tiles: runtimeData.tiles === state.modules.tiles,
        frequentLinks: runtimeData.frequentLinks === state.modules.frequentLinks,
        fx: runtimeData.fx === state.modules.fx,
        snippets: runtimeData.snippets === state.modules.snippets,
        todo: todos === state.modules.todo,
        notes: notes === state.modules.notes,
        journal: journal === state.modules.journal,
        reminders: calReminders === state.modules.calendarReminders
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    return {
        ok: failed.length === 0,
        metrics: { checks: Object.keys(checks).length, passed: Object.values(checks).filter(Boolean).length },
        details: { checks },
        issues: failed.map(name => `Rozbieżne źródło stanu: ${name}`)
    };
}, { category: "state", release: true });

Diagnostics.register("modules", () => {
    const reports = ModuleRegistry.all().map(module => {
        try { return { id: module.id, ok: Boolean(module.smokeTest?.()?.ok) }; }
        catch (error) { return { id: module.id, ok: false, error: error?.message || String(error) }; }
    });
    return { ok: reports.every(item => item.ok), metrics: { total: reports.length, passed: reports.filter(item => item.ok).length }, details: { reports }, issues: reports.filter(item => !item.ok).map(item => `${item.id}: ${item.error || "smoke failed"}`) };
}, { category: "modules", release: true });

Diagnostics.register("storage-contract", () => {
    const status = StorageService.status(), usage = StorageService.usage();
    const ok = ["getJSON", "safeCommit", "preflight", "limits", "snapshot"].every(name => typeof StorageService[name] === "function") && Number.isFinite(usage.usedBytes) && Number.isFinite(usage.budgetBytes) && Number.isFinite(usage.percent);
    return { ok, metrics: { usedBytes: usage.usedBytes, budgetBytes: usage.budgetBytes, percent: usage.percent }, details: { status, usage } };
}, { category: "storage", release: true });

Diagnostics.register("storage-persistence", () => {
    const status = StorageService.status();
    return { ok: status.persistent === true, severity: "error", issues: status.persistent ? [] : ["Persistent storage unavailable"], details: { status } };
}, { category: "storage", release: true });

Diagnostics.register("storage-capacity", () => {
    const usage = StorageService.usage();
    const ok = usage.usedBytes <= usage.budgetBytes && usage.remainingBytes >= 0 && Number.isFinite(usage.percent);
    return { ok, severity: usage.level === "danger" ? "error" : usage.level === "warning" ? "warning" : "info", metrics: { usedBytes: usage.usedBytes, remainingBytes: usage.remainingBytes, percent: usage.percent }, details: { usage } };
}, { category: "storage", release: true });

Diagnostics.register("accessibility", () => {
    const report = AccessibilityRuntime.audit(document);
    const issues = Object.entries(report.checks || {}).flatMap(([name, rows]) => (rows || []).map(row => `${name}: ${row}`));
    return { ok: report.ok, issues, metrics: Object.fromEntries(Object.entries(report.checks || {}).map(([name, rows]) => [name, rows.length])), details: { report } };
}, { category: "accessibility", release: true });


Diagnostics.register("persistence-roundtrip", async () => {
    const report = await PersistenceRoundtrip.run();
    const issues = Object.entries(report.stages).filter(([, stage]) => stage.ok === false).flatMap(([id, stage]) => (stage.issues || ["FAIL"]).map(issue => `${id}: ${issue}`));
    return {
        ok: report.ok,
        issues,
        metrics: {
            modules: report.metrics.modules,
            storageKeys: report.metrics.storageKeys,
            passedStages: Object.values(report.stages).filter(stage => stage.ok === true).length,
            totalStages: Object.keys(report.stages).length
        },
        details: { report }
    };
}, { category: "persistence", release: true });

Diagnostics.register("workflow-integrity", () => {
    const reports = BusinessWorkflow.reconcileAll({persist: false});
    const stale = reports.filter(item => item.changed);
    return {
        ok: stale.length === 0,
        severity: stale.length ? "warning" : "info",
        metrics: {records: reports.length, staleRelations: stale.length},
        issues: stale.map(item => `${item.moduleId}/${item.recordId}: nieaktualne powiązania`),
        details: {stale}
    };
}, {category: "workflow", release: true});

const WorkDeskAPI = Object.freeze({
    version: APP_META.version,
    buildId: APP_META.buildTag,
    apiVersion: 7,
    store: AppStore,
    modules: Object.freeze({
        get: id => ModuleRegistry.get(id) || null,
        list: () => ModuleRegistry.all(),
        render: (id, context = {}) => ModuleRegistry.get(id)?.render?.(context)
    }),
    runtime: Object.freeze({
        ui: UIRuntime,
        modal: UIRuntime,
        scheduler: SchedulerService,
        events: EventLifecycle,
        accessibility: AccessibilityRuntime,
        attention: AttentionCenter,
        bulkMail: BulkMailFlow,
        calendar: ReminderTimeService
    }),
    storage: Object.freeze({
        get: StorageService.get,
        getJSON: StorageService.getJSON,
        set: StorageService.set,
        remove: StorageService.remove,
        keys: StorageService.keys,
        limits: StorageService.limits,
        snapshot: StorageService.snapshot,
        usage: StorageService.usage,
        preflight: StorageService.preflight,
        projectedAtomic: StorageService.projectedAtomicUsage,
        status: StorageService.status,
        flush: () => flushPendingWrites({ commitNow: !0 }),
        persistenceRoundtrip: () => PersistenceRoundtrip.run()
    }),
    diagnostics: Diagnostics
});

window.WorkDesk = WorkDeskAPI;
