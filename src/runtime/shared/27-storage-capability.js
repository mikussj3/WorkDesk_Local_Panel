const StorageCapability = (() => {
    let checked = !1, available = !1, reason = "", reported = !1, mirrored = !1;
    const memory = new Map;
    function mirrorPersistentStorage() {
        if (mirrored) return;
        try {
            for (let index = 0; index < window.localStorage.length; index += 1) {
                const key = window.localStorage.key(index);
                if (key != null) memory.set(String(key), window.localStorage.getItem(key));
            }
            mirrored = !0;
        } catch {}
    }
    function probe() {
        if (checked) return available;
        if (checked = !0, "1" === new URLSearchParams(location.search).get("pf148_matrix")) return available = !1, 
        reason = "browser-matrix-memory-mode", !1;
        try {
            const k = "__wd_probe_pf87__";
            window.localStorage.setItem(k, "1"), window.localStorage.removeItem(k), available = !0, mirrorPersistentStorage();
        } catch (e) {
            available = !1, reason = e?.message || String(e);
        }
        return available;
    }
    function reportOnce(error) {
        reported || (reported = !0, console.warn("[StorageCapability] Przełączono na pamięć ulotną:", error?.message || reason || "storage unavailable"));
    }
    const backend = {
        get length() {
            return probe() ? window.localStorage.length : memory.size;
        },
        key: i => probe() ? window.localStorage.key(i) : [ ...memory.keys() ][i] ?? null,
        getItem(k) {
            const key = String(k);
            if (!probe()) return memory.has(key) ? memory.get(key) : null;
            try {
                const value = window.localStorage.getItem(key);
                if (value !== null) memory.set(key, value);
                else memory.delete(key);
                return value;
            } catch (e) {
                return available = !1, reason = e?.message || String(e), reportOnce(e), memory.has(key) ? memory.get(key) : null;
            }
        },
        setItem(k, v) {
            const key = String(k), value = String(v);
            memory.set(key, value);
            if (probe()) try {
                window.localStorage.setItem(key, value);
            } catch (e) {
                available = !1, reason = e?.message || String(e), reportOnce(e);
            }
        },
        removeItem(k) {
            if (memory.delete(String(k)), probe()) try {
                window.localStorage.removeItem(k);
            } catch (e) {
                available = !1, reason = e?.message || String(e), reportOnce(e);
            }
        },
        clear() {
            if (memory.clear(), probe()) try {
                window.localStorage.clear();
            } catch (e) {
                available = !1, reason = e?.message || String(e), reportOnce(e);
            }
        }
    };
    return Object.freeze({
        probe: probe,
        get available() {
            return probe();
        },
        get reason() {
            return probe(), reason;
        },
        memory: memory,
        backend: backend,
        reportOnce: reportOnce
    });
})(), StorageBackend = StorageCapability.backend, GuardedStorage = (() => {
    const backend = StorageBackend;
    return Object.freeze({
        getItem: key => backend.getItem(key),
        setItem: (key, value) => backend.setItem(key, value),
        removeItem: key => backend.removeItem(key),
        clear: () => backend.clear(),
        get length() {
            return backend.length;
        },
        key: index => backend.key(index),
        get degraded() {
            return !StorageCapability.available;
        },
        get reason() {
            return StorageCapability.reason || "";
        }
    });
})();

try {
    Object.defineProperty(window, "WorkDeskStorage", {
        value: GuardedStorage,
        configurable: !0
    });
} catch {}
