
const StorageLimits = (() => {
    const HARD_LIMIT_BYTES = 4718592;
    const DEFAULTS = Object.freeze({
        totalBudgetBytes: 3145728,
        warningPercent: 70,
        dangerPercent: 85,
        todoRecords: 500,
        journalRecords: 2000,
        notesRecords: 200,
        remindersRecords: 500,
        idHistoryRecords: 8,
        draftBytes: 102400,
        noteBytes: 20480,
        journalEntryBytes: 5120,
        todoTextChars: 5000,
        reminderTextChars: 2000
    });
    const FIELDS = Object.freeze([
        [ "totalBudgetBytes", "Budżet całkowity (KB)", 1024, 512, 10240 ],
        [ "warningPercent", "Próg żółty (%)", 1, 40, 95 ],
        [ "dangerPercent", "Próg czerwony (%)", 1, 50, 99 ],
        [ "todoRecords", "TODO — rekordy", 1, 10, 10000 ],
        [ "journalRecords", "Journal — rekordy", 1, 10, 20000 ],
        [ "notesRecords", "Notatki — rekordy", 1, 1, 2000 ],
        [ "remindersRecords", "Przypomnienia — rekordy", 1, 1, 5000 ],
        [ "idHistoryRecords", "Historia ID — rekordy", 1, 1, 100 ],
        [ "draftBytes", "Draft e-mail (KB)", 1024, 10, 2048 ],
        [ "noteBytes", "Pojedyncza notatka (KB)", 1024, 1, 512 ],
        [ "journalEntryBytes", "Pojedynczy wpis journalu (KB)", 1024, 1, 128 ],
        [ "todoTextChars", "Tekst TODO (znaki)", 1, 50, 50000 ],
        [ "reminderTextChars", "Tekst przypomnienia (znaki)", 1, 50, 20000 ]
    ]);
    const clamp = (value, min, max, fallback) => {
        const number = Math.round(Number(value));
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    };
    function normalize(raw) {
        const source = raw && typeof raw === "object" ? raw : {};
        const limits = {};
        FIELDS.forEach(([key, , factor, min, max]) => {
            limits[key] = clamp(source[key], min * factor, max * factor, DEFAULTS[key]);
        });
        if (limits.dangerPercent <= limits.warningPercent) {
            limits.dangerPercent = Math.min(99, limits.warningPercent + 10);
        }
        return Object.freeze(limits);
    }
    function current() {
        return normalize(typeof appState !== "undefined" ? appState?.modules?.preferences?.storageLimits : null);
    }
    return Object.freeze({
        HARD_LIMIT_BYTES,
        DEFAULTS,
        FIELDS,
        normalize,
        current
    });
})();

const STORAGE_LIMIT_FIELDS = StorageLimits.FIELDS;

const StorageService = (() => {
    const memoryDiagnostics = [];
    const byteLength = value => new Blob([ String(value ?? "") ]).size;
    const entrySize = (key, value) => value == null ? 0 : byteLength(key) + byteLength(value);
    function effectiveBudgetBytes() {
        return Math.min(StorageLimits.HARD_LIMIT_BYTES, StorageLimits.current().totalBudgetBytes);
    }
    function projectedAtomicUsage(key, value) {
        const target = String(key), raw = String(value), temp = target + ".__tmp__", afterTemp = rawUsage().usedBytes - entrySize(temp, GuardedStorage.getItem(temp)) + entrySize(temp, raw), afterTarget = afterTemp - entrySize(target, GuardedStorage.getItem(target)) + entrySize(target, raw);
        return Math.max(afterTemp, afterTarget);
    }
    function preflight(key, value) {
        const peakBytes = projectedAtomicUsage(key, value), limitBytes = effectiveBudgetBytes();
        if (peakBytes > limitBytes) throw new DOMException("Przekroczono bezpieczny budżet danych podczas zapisu atomowego", "QuotaExceededError");
        return Object.freeze({
            ok: true,
            peakBytes,
            limitBytes,
            remainingBytes: Math.max(0, limitBytes - peakBytes),
            percent: limitBytes ? peakBytes / limitBytes * 100 : 0
        });
    }
    function notify(message, type = "err") {
        try {
            toast(message, type);
        } catch {
            console.warn("[StorageService]", message);
        }
    }
    function isQuotaExceeded(error) {
        return !!error && ("QuotaExceededError" === error.name || "NS_ERROR_DOM_QUOTA_REACHED" === error.name || 22 === error.code || 1014 === error.code);
    }
    function rawUsage() {
        let bytes = 0;
        const perKey = {};
        try {
            for (let i = 0; i < GuardedStorage.length; i++) {
                const key = GuardedStorage.key(i);
                if (null == key) continue;
                const value = GuardedStorage.getItem(key) || "", size = new Blob([ key, value ]).size;
                perKey[key] = size, bytes += size;
            }
        } catch {}
        return {
            usedBytes: bytes,
            usedKilobytes: Math.round(bytes / 1024 * 100) / 100,
            perKey: perKey
        };
    }
    function recordDiagnostic(operation, key, error, extra = {}) {
        const diagnostic = {
            at: (new Date).toISOString(),
            operation: operation,
            key: String(key || ""),
            errorName: error?.name || "StorageError",
            message: error?.message || String(error || "Nieznany błąd storage"),
            quotaExceeded: isQuotaExceeded(error),
            usedBytes: rawUsage().usedBytes,
            ...extra
        };
        memoryDiagnostics.unshift(diagnostic), memoryDiagnostics.splice(20), console.error("[StorageService]", diagnostic);
        try {
            const currentRaw = GuardedStorage.getItem("wd.storage.diagnostics.v1"), current = currentRaw ? JSON.parse(currentRaw) : [], next = [ diagnostic, ...Array.isArray(current) ? current : [] ].slice(0, 20);
            GuardedStorage.setItem("wd.storage.diagnostics.v1", JSON.stringify(next));
        } catch {}
        return diagnostic;
    }
    function get(key, fallback = null) {
        try {
            const value = GuardedStorage.getItem(key);
            return null === value ? fallback : value;
        } catch (error) {
            return recordDiagnostic("get", key, error), notify("Nie udało się odczytać danych lokalnych."), 
            fallback;
        }
    }
    function safeCommit(key, value) {
        const raw = String(value), tempKey = key + ".__tmp__";
        let previous = null, hadPrevious = !1;
        try {
            if (previous = GuardedStorage.getItem(key), hadPrevious = null !== previous, 
            preflight(key, raw), GuardedStorage.setItem(tempKey, raw), GuardedStorage.getItem(tempKey) !== raw) throw new Error("Weryfikacja zapisu tymczasowego nie powiodła się.");
            if (GuardedStorage.setItem(key, raw), GuardedStorage.getItem(key) !== raw) throw new Error("Weryfikacja zapisu docelowego nie powiodła się.");
            return GuardedStorage.removeItem(tempKey), {
                ok: !0,
                key: key,
                bytes: new Blob([ raw ]).size
            };
        } catch (error) {
            try {
                GuardedStorage.removeItem(tempKey);
            } catch {}
            try {
                GuardedStorage.getItem(key) !== previous && (hadPrevious ? GuardedStorage.setItem(key, previous) : GuardedStorage.removeItem(key));
            } catch (rollbackError) {
                recordDiagnostic("rollback", key, rollbackError);
            }
            return recordDiagnostic("safeCommit", key, error, {
                attemptedBytes: new Blob([ raw ]).size
            }), notify(isQuotaExceeded(error) ? "Brak miejsca w pamięci lokalnej. Dane nie zostały nadpisane." : "Nie udało się bezpiecznie zapisać danych. Poprzednia wersja została zachowana."), 
            {
                ok: !1,
                key: key,
                error: error,
                quotaExceeded: isQuotaExceeded(error)
            };
        }
    }
    function remove(key) {
        try {
            return GuardedStorage.removeItem(key), GuardedStorage.removeItem(key + ".__tmp__"), 
            !0;
        } catch (error) {
            return recordDiagnostic("remove", key, error), notify("Nie udało się usunąć danych lokalnych."), 
            !1;
        }
    }
    function keys() {
        const result = [];
        try {
            for (let i = 0; i < GuardedStorage.length; i++) {
                const key = GuardedStorage.key(i);
                null == key || key.endsWith(".__tmp__") || result.push(key);
            }
        } catch (error) {
            recordDiagnostic("keys", "", error);
        }
        return result;
    }
    return Object.freeze({
        HARD_LIMIT_BYTES: StorageLimits.HARD_LIMIT_BYTES,
        TEMP_SUFFIX: ".__tmp__",
        get: get,
        getJSON: function(key, fallback = null, options = {}) {
            const raw = get(key, null);
            if (null === raw) return {
                ok: !0,
                exists: !1,
                value: cloneData(fallback)
            };
            try {
                return {
                    ok: !0,
                    exists: !0,
                    value: JSON.parse(raw)
                };
            } catch (error) {
                const safeKey = String(key).replace(/[^a-zA-Z0-9._-]/g, "_"), fingerprint = (() => {
                    let hash = 2166136261;
                    for (let index = 0; index < raw.length; index++) hash ^= raw.charCodeAt(index), 
                    hash = Math.imul(hash, 16777619);
                    return (hash >>> 0).toString(16).padStart(8, "0");
                })(), quarantineKey = `wd.corrupt.${fingerprint}.${safeKey}`, markerKey = `wd.corrupt.marker.${safeKey}.${fingerprint}`;
                let quarantined = get(quarantineKey, null) === raw, sourceRemoved = !1;
                if (!quarantined) {
                    const committed = safeCommit(quarantineKey, raw);
                    quarantined = !!committed && !1 !== committed.ok;
                }
                if (quarantined) {
                    sourceRemoved = remove(key);
                    const marker = {
                        sourceKey: String(key),
                        quarantineKey,
                        fingerprint,
                        quarantinedAt: (new Date).toISOString(),
                        sourceRemoved,
                        bytes: byteLength(raw)
                    };
                    safeCommit(markerKey, JSON.stringify(marker));
                }
                return recordDiagnostic("parse", key, error, {
                    quarantineKey,
                    markerKey,
                    sourceRemoved
                }), !1 !== options.notify && notify(sourceRemoved ? `Nie udało się odczytać danych „${key}”. Uszkodzoną wartość przeniesiono do kwarantanny.` : `Nie udało się odczytać danych „${key}”. Uszkodzoną wartość zachowano w kwarantannie, ale nie udało się usunąć źródła.`), 
                {
                    ok: !1,
                    exists: !0,
                    value: cloneData(fallback),
                    error,
                    quarantineKey,
                    markerKey,
                    sourceRemoved
                };
            }
        },
        set: function(key, value) {
            return safeCommit(key, value);
        },
        remove: remove,
        limits: StorageLimits.current,
        snapshot: function() {
            const raw = rawUsage(), limits = StorageLimits.current(), persistent = GuardedStorage.degraded !== true, configuredBudgetBytes = limits.totalBudgetBytes, budgetBytes = Math.min(StorageLimits.HARD_LIMIT_BYTES, configuredBudgetBytes), usedBytes = raw.usedBytes, remainingBytes = Math.max(0, budgetBytes - usedBytes), percent = budgetBytes ? usedBytes / budgetBytes * 100 : 0, level = percent >= limits.dangerPercent ? "danger" : percent >= limits.warningPercent ? "warning" : "ok";
            return Object.freeze({
                ok: persistent && usedBytes <= budgetBytes,
                persistent,
                degraded: !persistent,
                level,
                usedBytes,
                usedKilobytes: raw.usedKilobytes,
                configuredBudgetBytes,
                hardLimitBytes: StorageLimits.HARD_LIMIT_BYTES,
                budgetBytes,
                remainingBytes,
                percent,
                warningPercent: limits.warningPercent,
                dangerPercent: limits.dangerPercent,
                perKey: Object.freeze({ ...raw.perKey }),
                tempSuffix: ".__tmp__"
            });
        },
        usage: function() {
            return this.snapshot();
        },
        projectedAtomicUsage: projectedAtomicUsage,
        preflight: preflight,
        status: function() {
            return this.snapshot();
        },
        safeCommit: safeCommit,
        safeCommitJSON: function(key, value) {
            let raw;
            try {
                raw = JSON.stringify(value);
            } catch (error) {
                return recordDiagnostic("serialize", key, error), notify("Nie udało się przygotować danych do zapisu. Poprzednia wersja została zachowana."), 
                {
                    ok: !1,
                    key: key,
                    reason: "serialize",
                    error: error,
                    quotaExceeded: !1
                };
            }
            return safeCommit(key, raw);
        },
        keys: keys,
        clear: function() {
            let ok = !0;
            return keys().forEach(key => {
                remove(key) || (ok = !1);
            }), ok;
        },
        diagnostics: function() {
            return memoryDiagnostics.slice();
        },
        recordDiagnostic: recordDiagnostic
    });
})(), WriteQueue = (() => {
    const tasks = new Map;
    let timer = null, running = !1;
    function arm() {
        if (timer && SchedulerService.cancel(timer), timer = null, !tasks.size || running) return;
        const now = Date.now(), nextAt = Math.min(...Array.from(tasks.values(), task => task.dueAt));
        timer = SchedulerService.scheduleTimeout(runDue, Math.max(0, nextAt - now), {
            owner: "storage-write",
            key: "queue"
        });
    }
    function execute(key, task) {
        tasks.delete(key);
        try {
            task.fn();
        } catch (error) {
            console.error(`[WriteQueue:${key}]`, error), toast("Nie udało się zapisać oczekującej zmiany.", "err");
        }
    }
    function runDue() {
        if (timer = null, running) return arm();
        running = !0;
        const now = Date.now();
        Array.from(tasks.entries()).forEach(([key, task]) => {
            task.dueAt <= now && execute(key, task);
        }), running = !1, arm();
    }
    return Object.freeze({
        schedule: function(key, fn, delay = 0) {
            tasks.set(key, {
                fn: fn,
                dueAt: Date.now() + Math.max(0, delay)
            }), arm();
        },
        flush: function(key) {
            if (timer && (SchedulerService.cancel(timer), timer = null), running = !0, void 0 !== key) {
                const task = tasks.get(key);
                task && execute(key, task);
            } else {
                let guard = 0;
                for (;tasks.size && guard++ < 100; ) Array.from(tasks.entries()).forEach(([taskKey, task]) => execute(taskKey, task));
            }
            running = !1, arm();
        },
        cancel: function(key) {
            tasks.delete(key), arm();
        },
        pending: function() {
            return Array.from(tasks.keys());
        }
    });
})(), APP_META = Object.freeze({
    name: "WorkDesk",
    version: "1.66.3",
    schemaVersion: 5,
    buildTag: "KF64",
    builtAt: "2026-07-23T00:30:00Z"
}), APP_NAME = APP_META.name, APP_VERSION = APP_META.version, SCHEMA_VERSION = APP_META.schemaVersion, DATA_SCHEMA_VERSION = SCHEMA_VERSION, BUILD_INFO = Object.freeze({
    appName: APP_NAME,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    buildTag: APP_META.buildTag,
    builtAt: APP_META.builtAt
}), DATA_KEY = "wd.data.v5";




function applyBuildMetadata() {
    document.title = `${APP_NAME} ${APP_VERSION}-${APP_META.buildTag} — Panel pracy lokalny`, 
    document.querySelectorAll("[data-app-name]").forEach(el => {
        el.textContent = APP_NAME;
    }), document.querySelectorAll("[data-app-version]").forEach(el => {
        el.textContent = APP_VERSION;
    });
}

applyBuildMetadata();

const BootState = (() => {
    const state = {
        stage: "script",
        startedAt: Date.now(),
        completed: !1,
        errors: []
    };
    return Object.freeze({
        mark: stage => (state.stage = String(stage || "unknown"), state.stage),
        fail: error => (state.errors.push({
            stage: state.stage,
            message: String(error?.message || error),
            stack: String(error?.stack || "")
        }), !1),
        complete: () => (state.stage = "ready", state.completed = !0, state.completedAt = Date.now(), 
        !0),
        report: () => structuredClone(state),
        get completed() {
            return state.completed;
        }
    });
})();

EventLifecycle.on(window, "error", event => BootState.fail(event.error || event.message)), 
EventLifecycle.on(window, "unhandledrejection", event => BootState.fail(event.reason)), 
BootState.mark("storage");

let storageLoadBlocked = !1;

const FULL_SNAPSHOT_MIN_INTERVAL_MS = 3e3;

let lastFullSnapshotAt = 0;

function commitFullSnapshotNow() {
    if (storageLoadBlocked) return {
        ok: !1,
        reason: "corrupt-source",
        blocked: !0
    };
    syncAppStateFromRuntime();
    const snap = exportAppData();
    let raw;
    try {
        raw = JSON.stringify(snap);
    } catch (error) {
        return StorageService.safeCommitJSON(DATA_KEY, snap);
    }
    if (StorageService.get(DATA_KEY, null) === raw) return lastFullSnapshotAt = Date.now(), 
    {
        ok: !0,
        unchanged: !0,
        bytes: byteSize(raw)
    };
    const result = StorageService.safeCommit(DATA_KEY, raw);
    return result && !1 !== result.ok && (lastFullSnapshotAt = Date.now()), "function" == typeof renderDataConfidence && renderDataConfidence(), result;
}

let bootstrapSnapshotCache, isSyntheticTestRunning = !1, fullSnapshotIdleHandle = null;

function cancelFullSnapshotIdle() {
    null != fullSnapshotIdleHandle && ("cancelIdleCallback" in window ? cancelIdleCallback(fullSnapshotIdleHandle) : SchedulerService.cancel(fullSnapshotIdleHandle), 
    fullSnapshotIdleHandle = null);
}

function runSnapshotWhenIdle() {
    cancelFullSnapshotIdle();
    const task = () => {
        fullSnapshotIdleHandle = null, commitFullSnapshotNow();
    };
    fullSnapshotIdleHandle = "requestIdleCallback" in window ? requestIdleCallback(task, {
        timeout: 1500
    }) : SchedulerService.scheduleTimeout(task, 50, {
        owner: "storage",
        key: "snapshot-idle"
    });
}

function requestFullSnapshot(options = {}) {
    if (isSyntheticTestRunning) return {
        ok: !0,
        testMode: !0
    };
    if (options && options.immediate) return WriteQueue.cancel("full-snapshot"), cancelFullSnapshotIdle(), 
    commitFullSnapshotNow();
    const delay = Math.max(0, FULL_SNAPSHOT_MIN_INTERVAL_MS - (Date.now() - lastFullSnapshotAt));
    WriteQueue.schedule("full-snapshot", runSnapshotWhenIdle, delay);
}

function flushPendingWrites({commitNow: commitNow = !1} = {}) {
    return WriteQueue.flush(), commitNow ? (WriteQueue.cancel("full-snapshot"), cancelFullSnapshotIdle(), 
    commitFullSnapshotNow()) : {
        ok: !0,
        queued: !0
    };
}

function recoverBootstrapSnapshot() {
    for (const key of [ "wd.restore.current", "wd.restore.previous-good" ]) {
        const candidate = StorageService.getJSON(key, null, {
            notify: !1
        });
        if (!candidate.ok || !candidate.value || !candidate.value.modules || "object" != typeof candidate.value.modules) continue;
        const committed = StorageService.safeCommitJSON(DATA_KEY, candidate.value);
        if (committed && !1 !== committed.ok) return toast(`Odzyskano dane z punktu „${"wd.restore.current" === key ? "current" : "previous-good"}”.`, "ok"), 
        candidate.value;
    }
    return null;
}

function bootstrapModule(moduleId, fallback) {
    if (void 0 === bootstrapSnapshotCache) {
        const r = StorageService.getJSON(DATA_KEY, null, {
            notify: !0
        });
        bootstrapSnapshotCache = r.ok && r.value && r.value.modules ? r.value : r.ok ? null : recoverBootstrapSnapshot();
    }
    const value = bootstrapSnapshotCache?.modules?.[moduleId];
    return cloneData(void 0 === value ? fallback : value);
}
