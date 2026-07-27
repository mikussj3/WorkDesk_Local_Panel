
function toast(msg, kind = "ok") {
    const wrap = $("#toasts");
    const el = SafeDOM.el("div", { className: `toast ${kind}` });
    const icon = SafeDOM.el("svg", { className: "ic", attrs: {
        viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "aria-hidden": "true"
    } });
    icon.append(SafeDOM.trustedStaticFragment(kind === "ok"
        ? '<path d="m5 12 5 5L20 7"/>'
        : '<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 17h.01"/>'));
    SafeDOM.append(el, [icon, SafeDOM.el("span", { text: msg })]);
    wrap.appendChild(el);
    SchedulerService.scheduleTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(6px)";
    }, 2400, { owner: "toast" });
    SchedulerService.scheduleTimeout(() => el.remove(), 2700, { owner: "toast" });
}

const AttentionCenter = (() => {
    const notices = new Map, suppressed = new Set, host = () => $("#attentionCenter");
    const render = () => {
        const root = host();
        if (!root) return;
        const ordered = [ ...notices.values() ].sort((a, b) => (b.rank || 0) - (a.rank || 0) || a.createdAt - b.createdAt);
        SafeDOM.replace(root, ordered.map(notice => SafeDOM.el("section", {
            className: "attention-notice",
            attrs: { role: notice.priority === "danger" ? "alert" : "status" },
            dataset: { noticeId: notice.id, priority: notice.priority || "info" }
        }, [
            SafeDOM.el("div", { className: "attention-copy" }, [
                SafeDOM.el("div", { className: "attention-title", text: notice.title }),
                SafeDOM.el("div", { className: "attention-message", text: notice.message })
            ]),
            SafeDOM.el("div", { className: "attention-actions" }, [
                ...(notice.actions || []).map(action => SafeDOM.el("button", {
                    className: `btn sm ${action.primary ? "primary" : "ghost"}`,
                    text: action.label,
                    attrs: { type: "button" },
                    dataset: { attentionAction: action.id, noticeId: notice.id }
                })),
                SafeDOM.el("button", { className: "btn ghost sm", text: "Zamknij", attrs: { type: "button", "aria-label": `Zamknij komunikat: ${notice.title}` }, dataset: { attentionDismiss: notice.id } })
            ])
        ])));
    };
    const dismiss = (id, { suppress = false } = {}) => {
        const notice = notices.get(id);
        if (!notice) return false;
        notices.delete(id);
        suppress && suppressed.add(id);
        SchedulerService.cancelOwner(`attention:${id}`);
        render();
        notice.onDismiss?.();
        return true;
    };
    const notify = config => {
        const id = String(config?.id || "");
        if (!id || suppressed.has(id)) return false;
        notices.set(id, {
            id, title: String(config.title || "Informacja"), message: String(config.message || ""),
            priority: config.priority || "info", rank: Number(config.rank || 0), createdAt: Date.now(),
            actions: Array.isArray(config.actions) ? config.actions : [], onDismiss: config.onDismiss
        });
        render();
        if (Number(config.autoDismissMs) > 0) SchedulerService.scheduleTimeout(() => dismiss(id), Number(config.autoDismissMs), { owner: `attention:${id}`, key: "dismiss" });
        return true;
    };
    EventLifecycle.on(document, "click", event => {
        const button = event.target instanceof Element ? event.target.closest("[data-attention-dismiss]") : null;
        button && dismiss(button.dataset.attentionDismiss, { suppress: true });
    }, { owner: "attention-center", key: "dismiss" });
    EventLifecycle.on(document, "click", async event => {
        const button = event.target instanceof Element ? event.target.closest("[data-attention-action]") : null;
        if (!button) return;
        const notice = notices.get(button.dataset.noticeId), action = notice?.actions?.find(item => item.id === button.dataset.attentionAction);
        if (!action) return;
        await action.run?.();
        action.keepOpen || dismiss(notice.id);
    }, { owner: "attention-center", key: "action" });
    return Object.freeze({ notify, dismiss, clearOwner: owner => [ ...notices.keys() ].filter(id => id.startsWith(owner + ":")).forEach(id => dismiss(id)), stats: () => ({ active: notices.size, suppressed: suppressed.size }) });
})();

async function copyToClipboard(text) {
    try {
        return await navigator.clipboard.writeText(text), !0;
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text, ta.style.position = "fixed", ta.style.left = "-9999px", document.body.appendChild(ta), 
        ta.focus(), ta.select();
        let ok = !1;
        try {
            ok = document.execCommand("copy");
        } catch {}
        return ta.remove(), ok;
    }
}

const ICONS = {
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17h15"/></svg>',
    life: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M19.1 4.9l-4.3 4.3M9.2 14.8l-4.3 4.3"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20a5 5 0 0 1 6 0"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    id: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4M5 17c1-2 3-2 4-2s3 0 4 2"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 10 9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2z"/><path d="M9 3v16M15 5v16"/></svg>',
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>'
};

function getIcon(k) {
    return ICONS[k] || ICONS.globe;
}

const ovEl = $("#overlay");

function pad(n) {
    return String(n).padStart(2, "0");
}

const EVENT_BINDINGS = new WeakMap;

function bindEvent(el, type, handler, options) {
    if (!(el instanceof EventTarget)) return !1;
    let events = EVENT_BINDINGS.get(el);
    if (events || (events = new Map, EVENT_BINDINGS.set(el, events)), events.get(type)?.abort(), 
    "function" != typeof handler) return events.delete(type), !0;
    const controller = new AbortController;
    return events.set(type, controller), el.addEventListener(type, handler, {
        ...options,
        signal: controller.signal
    }), !0;
}

function delegateEvent(root, type, selector, handler, options) {
    return bindEvent(root, type, event => {
        const target = event.target instanceof Element ? event.target.closest(selector) : null;
        target && (root === document || root.contains(target)) && handler(event, target);
    }, options);
}

function tickClock() {
    const d = new Date;
    $("#clock").textContent = d.toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "2-digit",
        month: "short"
    }) + " · " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()), 
    $("#todayLabel").textContent = d.toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

SchedulerService.scheduleInterval(tickClock, 1e3, {
    owner: "clock",
    key: "display"
}), tickClock();

let breakNoticeHour = -1, breakNoticeId = null;

function tickTimer() {
    const d = new Date, next = new Date(d);
    next.setHours(d.getHours() + 1, 0, 0, 0);
    const diff = next - d, m = Math.floor(diff / 6e4), s = Math.floor(diff % 6e4 / 1e3);
    $("#timerVal").textContent = pad(m) + ":" + pad(s);
    const t = $("#timer");
    m < 5 ? t.classList.add("warn") : t.classList.remove("warn");
    if (m < 5 && breakNoticeHour !== d.getHours()) {
        breakNoticeHour = d.getHours();
        breakNoticeId = `break:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        AttentionCenter.notify({
            id: breakNoticeId,
            title: "Czas na krótką przerwę",
            message: `Do pełnej godziny pozostało ${pad(m)}:${pad(s)}. Wstań, rozprostuj plecy i spójrz w dal przez 30 sekund.`,
            priority: "warning", rank: 30,
            actions: [ { id: "done", label: "Przerwa zrobiona", primary: true, run: () => toast("Świetnie — wracaj spokojnie do pracy.") } ]
        });
    } else if (m >= 5 && breakNoticeId) {
        AttentionCenter.dismiss(breakNoticeId);
        breakNoticeId = null;
    }
}

const startHourlyTimer = () => {
    tickTimer(), SchedulerService.scheduleInterval(tickTimer, 1e3, {
        owner: "work-timer",
        key: "hourly"
    });
};

"loading" === document.readyState ? EventLifecycle.on(document, "DOMContentLoaded", startHourlyTimer, {
    once: !0
}) : queueMicrotask(startHourlyTimer);

const emailEl = $("#email");

function toggleEmail() {
    const open = emailEl.classList.toggle("expanded");
    $("#emailBar").setAttribute("aria-expanded", open ? "true" : "false"), open || flushPendingWrites();
}

$("#emailBar").addEventListener("click", toggleEmail), $("#emailBar").addEventListener("keydown", e => {
    "Enter" !== e.key && " " !== e.key || (e.preventDefault(), toggleEmail());
});

let activeModal = null;

const MODAL_FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let UIRuntime = null, AccessibilityRuntime = null, BulkMailFlow = null, ModuleRegistry = null,
    CoreModuleState = null, EmailSubsystem = null, AppDialog = null;
let MODAL_POLICIES = Object.freeze({}), announceA11y = () => {};
const UI_ERRORS = [];
const businessUid = () => Date.now().toString(36) + "_" + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
const csvSafeCell = value => {
    const text = String(value ?? "");
    return /^[=+\-@]/.test(text) ? "'" + text : text;
};
