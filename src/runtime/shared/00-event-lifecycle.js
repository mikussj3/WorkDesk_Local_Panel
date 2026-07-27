const EventLifecycle = (() => {
    const records = new Map;
    let sequence = 0, tornDown = false;
    const targetName = target => target === window ? "window" : target === document ? "document" : target?.id || target?.constructor?.name || "target";
    function on(target, type, handler, options = {}) {
        "boolean" == typeof options && (options = { capture: options }), options ||= {};
        if (!(target instanceof EventTarget)) throw new TypeError("EventLifecycle.on wymaga EventTarget.");
        if ("function" != typeof handler) throw new TypeError("EventLifecycle.on wymaga funkcji.");
        const owner = String(options.owner || `global:${targetName(target)}`), key = String(options.key || `${type}:${++sequence}`), id = `${owner}:${key}`;
        remove(id);
        const controller = new AbortController, listener = options.once ? function(...args) {
            try {
                return handler.apply(this, args);
            } finally {
                records.delete(id), controller.abort();
            }
        } : handler, nativeOptions = {
            capture: !!options.capture,
            passive: !!options.passive,
            once: false,
            signal: controller.signal
        }, record = {
            id: id,
            owner: owner,
            key: key,
            target: target,
            targetName: targetName(target),
            type: type,
            handler: handler,
            listener: listener,
            once: !!options.once,
            options: nativeOptions,
            controller: controller
        };
        records.set(id, record), target.addEventListener(type, listener, nativeOptions), tornDown = false;
        return Object.freeze({
            id: id,
            owner: owner,
            remove: () => remove(id)
        });
    }
    function once(target, type, handler, options = {}) {
        return on(target, type, handler, {
            ...options,
            once: true
        });
    }
    function delegate(root, type, selector, handler, options = {}) {
        if (!(root instanceof EventTarget)) throw new TypeError("EventLifecycle.delegate wymaga EventTarget.");
        if (!selector || "function" != typeof handler) throw new TypeError("EventLifecycle.delegate wymaga selektora i funkcji.");
        return on(root, type, event => {
            const target = event.target instanceof Element ? event.target.closest(selector) : null;
            target && (root === document || root.contains(target)) && handler(event, target);
        }, options);
    }
    function remove(token) {
        const id = "string" == typeof token ? token : token?.id;
        if (!id) return false;
        const record = records.get(id);
        return !!record && (record.controller.abort(), records.delete(id), true);
    }
    function removeOwner(owner) {
        let count = 0;
        for (const record of [ ...records.values() ]) record.owner === owner && (remove(record.id), count++);
        return count;
    }
    function teardown(owner) {
        if (owner) return removeOwner(owner);
        for (const record of [ ...records.values() ]) remove(record.id);
        return tornDown = true, true;
    }
    function audit() {
        const rows = [ ...records.values() ].map(record => Object.freeze({
            id: record.id,
            owner: record.owner,
            key: record.key,
            target: record.targetName,
            type: record.type,
            once: record.once
        }));
        const ids = rows.map(row => row.id);
        const issues = [];
        rows.forEach(row => {
            row.owner || issues.push({ id: row.id, issue: "missing-owner" });
            row.key || issues.push({ id: row.id, issue: "missing-key" });
            row.type || issues.push({ id: row.id, issue: "missing-type" });
        });
        ids.length !== new Set(ids).size && issues.push({ issue: "duplicate-id" });
        return Object.freeze({
            ok: issues.length === 0,
            active: rows.length,
            issues: Object.freeze(issues),
            rows: Object.freeze(rows)
        });
    }
    function stats() {
        const byOwner = {}, byTarget = {}, byType = {};
        for (const record of records.values()) byOwner[record.owner] = (byOwner[record.owner] || 0) + 1, byTarget[record.targetName] = (byTarget[record.targetName] || 0) + 1, byType[record.type] = (byType[record.type] || 0) + 1;
        return Object.freeze({
            active: records.size,
            byOwner: Object.freeze(byOwner),
            byTarget: Object.freeze(byTarget),
            byType: Object.freeze(byType),
            tornDown: tornDown
        });
    }
    return Object.freeze({
        on: on,
        once: once,
        delegate: delegate,
        remove: remove,
        removeOwner: removeOwner,
        teardown: teardown,
        stats: stats,
        audit: audit
    });
})();
