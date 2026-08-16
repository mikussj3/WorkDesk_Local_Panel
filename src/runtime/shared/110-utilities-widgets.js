
const PWD_AMBIG = /[O0lI1|`'"]/g;

function rngInt(max) {
    const limit = Math.floor(4294967296 / max) * max, buf = new Uint32Array(1);
    do {
        (window.crypto || window.msCrypto).getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
}

function generatePassword() {
    const len = +$("#pwdLen").value;
    $("#pwdLenVal").textContent = len;
    const pools = [];
    $("#pwdUpper").checked && pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), $("#pwdLower").checked && pools.push("abcdefghijklmnopqrstuvwxyz"), 
    $("#pwdDigit").checked && pools.push("0123456789"), $("#pwdSym").checked && pools.push("!@#$%^&*()-_=+[]{};:,.<>?/");
    const noAmb = $("#pwdNoAmb").checked;
    let all = pools.map(p => noAmb ? p.replace(PWD_AMBIG, "") : p);
    if (!all.length || all.some(p => !p.length)) return $("#pwdValue").value = "", void setPwdStrength(0);
    const out = [];
    all.forEach(p => out.push(p[rngInt(p.length)]));
    out.length = Math.min(out.length, len);
    const combined = all.join("");
    for (;out.length < len; ) out.push(combined[rngInt(combined.length)]);
    for (let i = out.length - 1; i > 0; i--) {
        const j = rngInt(i + 1);
        [out[i], out[j]] = [ out[j], out[i] ];
    }
    $("#pwdValue").value = out.join(""), setPwdStrength(function(pwd, alphaSize) {
        const bits = pwd.length * Math.log2(Math.max(alphaSize, 2));
        return Math.max(0, Math.min(1, bits / 100));
    }(out.join(""), combined.length));
}

function setPwdStrength(v) {
    const colors = [ "#ff6b6b", "#ffb86b", "#ffd28a", "#9cffd1", "#6bd6a4" ], ix = Math.min(colors.length - 1, Math.floor(v * colors.length)), el = $("#pwdStrength");
    el.style.setProperty("--w", Math.max(8, 100 * v) + "%"), el.style.setProperty("--c", colors[ix]);
}

$("#pwdLen").addEventListener("input", () => {
    $("#pwdLenVal").textContent = $("#pwdLen").value, generatePassword();
}), [ "pwdUpper", "pwdLower", "pwdDigit", "pwdSym", "pwdNoAmb" ].forEach(id => $("#" + id).addEventListener("change", generatePassword)), 
$("#pwdGen").addEventListener("click", generatePassword), $("#pwdCopy").addEventListener("click", async () => {
    if (!$("#pwdValue").value) return toast("Najpierw wygeneruj hasło.", "err");
    const ok = await copyToClipboard($("#pwdValue").value);
    toast(ok ? "Hasło skopiowane." : "Nie udało się skopiować.", ok ? "ok" : "err");
}), $("#toolPassword").addEventListener("click", () => {
    generatePassword(), showModal("pwdModal");
});

const FX_CODES = [ "EUR", "USD", "GBP", "CHF" ];

function getFxInput(code) {
    return $(`#fx${code}`);
}

function normalizeFxNumber(value, fallback) {
    const n = parseFloat(String(value).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function syncFxInputsFromData() {
    runtimeData.fx = {
        ...DEFAULT_FX,
        ...runtimeData.fx || {}
    }, FX_CODES.forEach(code => {
        const input = getFxInput(code);
        input && (input.value = Number(runtimeData.fx[code] || DEFAULT_FX[code]).toFixed(4));
    });
}

function recalcConv() {
    runtimeData.fx = {
        ...DEFAULT_FX,
        ...runtimeData.fx || {}
    }, FX_CODES.forEach(code => {
        const input = getFxInput(code);
        input && (runtimeData.fx[code] = normalizeFxNumber(input.value, DEFAULT_FX[code]));
    }), runtimeData.fx.asOf = "ręcznie ustawione";
    const amt = parseFloat($("#convAmt").value) || 0, from = $("#convFrom").value, to = $("#convTo").value, out = function(amount, from, to) {
        if (from === to) return amount;
        const fx = {
            ...DEFAULT_FX,
            ...runtimeData.fx || {}
        };
        return ((amt, cur) => "PLN" === cur ? amt : amt / normalizeFxNumber(fx[cur], DEFAULT_FX[cur]))((amt = amount, 
        "PLN" === (cur = from) ? amt : amt * normalizeFxNumber(fx[cur], DEFAULT_FX[cur])), to);
        var amt, cur;
    }(amt, from, to);
    $("#convOut").value = out.toFixed(2) + " " + to;
    const fx = {
        ...DEFAULT_FX,
        ...runtimeData.fx || {}
    };
    $("#convInfo").textContent = `Kursy ręczne: 1 EUR = ${Number(fx.EUR).toFixed(4)} PLN · 1 USD = ${Number(fx.USD).toFixed(4)} PLN · 1 GBP = ${Number(fx.GBP).toFixed(4)} PLN · 1 CHF = ${Number(fx.CHF).toFixed(4)} PLN.`;
}

function recalcVat() {
    const amt = parseFloat($("#vatAmt").value) || 0, rate = parseFloat($("#vatRate").value) || 0, dir = $("#vatDir").value;
    let net, gross, vat;
    "net2gross" === dir ? (net = amt, vat = net * rate / 100, gross = net + vat) : (gross = amt, 
    net = gross / (1 + rate / 100), vat = gross - net), $("#vatOut").value = ("net2gross" === dir ? gross : net).toFixed(2) + " PLN", 
    $("#vatInfo").textContent = `Netto: ${net.toFixed(2)} · VAT (${rate}%): ${vat.toFixed(2)} · Brutto: ${gross.toFixed(2)}`;
}

[ "convAmt", "convFrom", "convTo" ].forEach(id => $("#" + id).addEventListener("input", recalcConv)), 
FX_CODES.forEach(code => getFxInput(code)?.addEventListener("input", recalcConv)), 
$("#fxResetBtn")?.addEventListener("click", () => {
    runtimeData.fx = {
        ...DEFAULT_FX
    }, syncFxInputsFromData(), recalcConv(), toast("Przywrócono domyślne kursy walut.", "ok");
}), [ "vatAmt", "vatRate", "vatDir" ].forEach(id => $("#" + id).addEventListener("input", recalcVat)), 
$("#toolConv").addEventListener("click", () => {
    syncFxInputsFromData(), recalcConv(), recalcVat(), showModal("convModal");
});


let lastQrSVG = "", lastQrText = "";

function showQrModal(text, label) {
    try {
        const m = QR.make(text);
        lastQrSVG = QR.toSVG(m), lastQrText = text, $("#qrHost").innerHTML = lastQrSVG, 
        $("#qrText").textContent = label ? `${label}\n${text}` : text, $("#qrTitle").textContent = "Kod QR" + (label ? ` · ${label}` : ""), 
        showModal("qrModal");
    } catch (err) {
        toast(`Tekst za długi dla QR (limit ${QR.capacityBytes} bajtów — polskie znaki liczą się podwójnie).`, "err");
    }
}

function isTypingTarget() {
    const el = document.activeElement;
    return !(!el || ![ "INPUT", "TEXTAREA" ].includes(el.tagName) && !el.isContentEditable);
}

$("#qrDownload").addEventListener("click", () => {
    if (!lastQrSVG) return;
    const blob = new Blob([ lastQrSVG ], {
        type: "image/svg+xml"
    }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url, a.download = `qr-${(lastQrText || "code").slice(0, 20).replace(/\W+/g, "_")}.svg`, 
    document.body.appendChild(a), a.click(), a.remove(), SchedulerService.scheduleTimeout(() => URL.revokeObjectURL(url), 1e3, { owner: "utilities", key: "revoke-download-url" }), 
    toast("Pobrano SVG.");
}), $("#openHelpBtn").addEventListener("click", () => showModal("helpModal")), EventLifecycle.on(window, "keydown", e => {
    if ("cmdModal" === UIRuntime.top()?.id) return;
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    return mod && "s" === key ? (e.preventDefault(), scheduleDraftSave(), WriteQueue.flush("draft"), 
    void toast("Draft zapisany.")) : mod && "l" === key ? (e.preventDefault(), void $("#clearBtn").click()) : mod || !e.shiftKey || "?" !== key && "/" !== key || isTypingTarget() ? mod || "/" !== key || e.shiftKey || isTypingTarget() ? void 0 : (e.preventDefault(), 
    $("#tileSearch").focus(), void $("#tileSearch").select()) : (e.preventDefault(), 
    void showModal("helpModal"));
});

const MODULE_LIFECYCLE = (() => {
    const hooks = new Map, controllers = new Map, phaseNames = [ "beforeRender", "afterRender", "bindEvents", "teardown" ], bucket = id => (hooks.has(id) || hooks.set(id, Object.fromEntries(phaseNames.map(x => [ x, [] ]))), 
    hooks.get(id)), run = (moduleId, phase, context = {}) => {
        (bucket(moduleId)[phase] || []).forEach(h => safeAction(`${phase}:${moduleId}:${h.owner}`, () => h.fn(context), {
            context: {
                moduleId: moduleId,
                phase: phase,
                owner: h.owner
            }
        }));
    }, rootFor = id => ({
        todo: () => document.querySelector("#todoList"),
        journal: () => document.querySelector("#journalList"),
        notes: () => document.querySelector("#notesHost") || document.querySelector(".notes-list"),
        calendarReminders: () => document.querySelector(".cal-reminders"),
        tiles: () => document.querySelector("#tilesHost") || document.querySelector(".tiles")
    }[id]?.() || document), stateFor = id => ensureAppState()?.modules?.[id], createController = mod => Object.freeze({
        id: mod.id,
        label: mod.label,
        init: context => mod.init(context),
        validate: data => mod.validate(data),
        migrate: data => mod.migrate(data),
        serialize: () => mod.serialize(),
        deserialize: data => mod.deserialize(data),
        export: () => mod.serialize(),
        import: data => mod.deserialize(data),
        beforeRender(context = {}) {
            run(mod.id, "beforeRender", {
                ...context,
                root: rootFor(mod.id),
                state: stateFor(mod.id)
            });
        },
        render(context = {}) {
            const result = safeAction(`controller.render:${mod.id}`, () => mod.render(rootFor(mod.id), stateFor(mod.id), context), {
                context: {
                    moduleId: mod.id
                }
            });
            return this.bind(rootFor(mod.id)), result;
        },
        afterRender(context = {}) {
            run(mod.id, "afterRender", {
                ...context,
                root: rootFor(mod.id),
                state: stateFor(mod.id)
            });
        },
        bind(root = rootFor(mod.id)) {
            mod.bind(root), run(mod.id, "bindEvents", {
                root: root,
                state: stateFor(mod.id)
            });
        },
        teardown: (context = {}) => (run(mod.id, "teardown", {
            ...context,
            root: rootFor(mod.id),
            state: stateFor(mod.id)
        }), mod.teardown(context)),
        reset() {
            return this.teardown({
                reason: "reset"
            }), safeAction(`controller.reset:${mod.id}`, () => mod.reset(), {
                context: {
                    moduleId: mod.id
                }
            });
        },
        smokeTest: () => mod.smokeTest(),
        getStats: () => mod.getStats(),
        getDiagnostics() {
            const h = bucket(mod.id);
            return {
                id: mod.id,
                rootPresent: !!rootFor(mod.id),
                stateType: Array.isArray(stateFor(mod.id)) ? "array" : typeof stateFor(mod.id),
                hooks: Object.fromEntries(phaseNames.map(p => [ p, h[p].map(x => x.owner) ]))
            };
        }
    });
    return {
        init: () => ModuleRegistry.all().forEach(mod => controllers.set(mod.id, createController(mod))),
        add: (moduleId, phase, fn, owner = "anonymous") => !(!phaseNames.includes(phase) || "function" != typeof fn || (bucket(moduleId)[phase].push({
            fn: fn,
            owner: owner
        }), 0)),
        run: run,
        get: id => controllers.get(id),
        all: () => [ ...controllers.values() ],
        diagnostics: () => [ ...controllers.values() ].map(x => x.getDiagnostics())
    };
})();

function registerModuleHook(moduleId, phase, fn, owner) {
    return MODULE_LIFECYCLE.add(moduleId, phase, fn, owner);
}

MODULE_LIFECYCLE.init();

let POMO_WORK = 60 * Math.min(120, Math.max(5, Number(bootstrapModule("userConfig", {}).pomodoro) || 25)), pomoLeft = POMO_WORK, pomoMode = "work", pomoRunning = !1, pomoInterval = null, pomoSessions = 0;

function pomoRender() {
    const pill = $("#pomo");
    pill.hidden = !1, $("#pomoVal").textContent = function(sec) {
        const s = sec % 60;
        return pad(Math.floor(sec / 60)) + ":" + pad(s);
    }(Math.max(0, pomoLeft)), $("#pomoLabel").textContent = "work" === pomoMode ? "Praca" : "Przerwa", 
    pill.classList.toggle("break", "break" === pomoMode), pill.classList.toggle("paused", !pomoRunning), 
    $("#pomoToggle").setAttribute("aria-pressed", String(pomoRunning)), $("#pomoToggle").setAttribute("aria-label", pomoRunning ? "Wstrzymaj Pomodoro" : "Uruchom Pomodoro"),
    $("#pomoStart").style.display = "none";
}

function pomoStart() {
    pomoRunning ? (pomoRunning = !1, SchedulerService.cancel(pomoInterval), pomoInterval = null) : (pomoRunning = !0, 
    pomoInterval = SchedulerService.scheduleInterval(pomoTick, 1e3, {
        owner: "pomodoro",
        key: "tick"
    }), "Notification" in window && "default" === Notification.permission && Notification.requestPermission().catch(() => {})), 
    pomoRender();
}

function pomoTick() {
    pomoLeft--, pomoLeft <= 0 && (function() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx, o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = 660, g.gain.value = .08, o.connect(g), g.connect(ctx.destination), 
            o.start(), SchedulerService.scheduleTimeout(() => {
                o.frequency.value = 880;
            }, 180, { owner: "pomodoro", key: "tone-step" }), SchedulerService.scheduleTimeout(() => {
                o.stop(), ctx.close();
            }, 380, { owner: "pomodoro", key: "tone-stop" });
        } catch (error) {
            UI_ERROR_REGISTRY.record("utilities", "pomodoro-audio", error);
        }
    }(), "work" === pomoMode ? (pomoSessions++, pomoMode = "break", pomoLeft = 300, 
    pomoNotify("Czas na przerwę 5 min", `Ukończono ${pomoSessions} sesję Pomodoro.`)) : (pomoMode = "work", 
    pomoLeft = POMO_WORK, pomoNotify("Czas wracać do pracy", "Następna sesja: 25 min."))), 
    pomoRender();
}

function pomoNotify(title, body) {
    if ("Notification" in window && "granted" === Notification.permission) try {
        new Notification(title, {
            body: body,
            silent: !1
        });
    } catch (error) {
        UI_ERROR_REGISTRY.record("utilities", "notification", error, { title });
    }
    toast(title);
}

function parseTimeLine(line) {
    if (!(line = line.trim())) return 0;
    let m = line.match(/^(\d+):(\d{1,2})$/);
    return m ? 3600 * +m[1] + 60 * +m[2] : (m = line.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?$/i), 
    m && (m[1] || m[2]) ? Math.round(3600 * parseFloat(m[1] || 0) + 60 * parseFloat(m[2] || 0)) : (m = line.match(/^(\d+(?:\.\d+)?)$/), 
    m ? Math.round(60 * parseFloat(m[1])) : NaN));
}

function recalcTime() {
    const lines = $("#timeInput").value.split(/\n/);
    let sumSec = 0, bad = 0;
    for (const ln of lines) {
        if (!ln.trim()) continue;
        const v = parseTimeLine(ln);
        Number.isNaN(v) ? bad++ : sumSec += v;
    }
    const total = pad(Math.floor(sumSec / 3600)) + ":" + pad(Math.floor(sumSec % 3600 / 60)), dec = (sumSec / 3600).toFixed(2);
    SafeDOM.replace($("#timeOut"), [
            SafeDOM.text("Suma: "), SafeDOM.el("b", { text: total }), SafeDOM.text(` (${dec} h)`),
            bad ? SafeDOM.el("span", { text: ` · ${bad} wierszy niepoprawnych`, style: { color: "var(--danger)" } }) : null
        ]);
}

function isHolidayDate(d) {
    const dow = d.getDay();
    if (0 === dow || 6 === dow) return !0;
    const key = pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    return polishHolidays(d.getFullYear()).has(key);
}

function recalcWorkdays() {
    const v = $("#wdStart").value;
    if (!v) return;
    const [y, m, d] = v.split("-").map(Number), out = function(date, n, dir) {
        const out = new Date(date);
        let remaining = Math.abs(n);
        const step = "sub" === dir ? -1 : 1;
        for (;remaining > 0; ) out.setDate(out.getDate() + step), isHolidayDate(out) || remaining--;
        return out;
    }(new Date(y, m - 1, d), +$("#wdDays").value || 0, $("#wdOp").value), ds = pad(out.getDate()) + "." + pad(out.getMonth() + 1) + "." + out.getFullYear(), dow = out.toLocaleDateString("pl-PL", {
        weekday: "long"
    });
    $("#wdOut").value = ds, $("#wdInfo").textContent = `${dow.charAt(0).toUpperCase() + dow.slice(1)}. Pomija weekendy i dni wolne PL.`;
}


$("#pomoStart").addEventListener("click", () => {
    pomoLeft = POMO_WORK, pomoMode = "work", pomoStart();
}), $("#pomoToggle").addEventListener("click", pomoStart), $("#pomoStop").addEventListener("click", function() {
    SchedulerService.cancel(pomoInterval), pomoInterval = null, pomoRunning = !1, pomoMode = "work", 
    pomoLeft = POMO_WORK, $("#pomo").hidden = !0, $("#pomoStart").style.display = "";
}), $("#timeInput").addEventListener("input", recalcTime), [ "wdStart", "wdOp", "wdDays" ].forEach(id => $("#" + id).addEventListener("input", recalcWorkdays)), 
$("#toolTime").addEventListener("click", () => {
    const today = new Date;
    $("#wdStart").value = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate()), 
    recalcTime(), recalcWorkdays(), showModal("timeModal");
}), $("#csvExportBtn").addEventListener("click", function() {
    const rows = [ [ "Sekcja", "Grupa", "Email" ] ];
    runtimeData.sections.forEach(sec => {
        sec.groups.forEach(g => {
            g.emails.forEach(e => rows.push([ sec.name, g.name, e ]));
        });
    });
    const csv = "\ufeff" + rows.map(r => r.map(v => csvEscape(v, ",")).join(",")).join("\n"), blob = new Blob([ csv ], {
        type: "text/csv;charset=utf-8"
    }), url = URL.createObjectURL(blob), d = new Date, fname = `workdesk-grupy-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`, a = document.createElement("a");
    a.href = url, a.download = fname, document.body.appendChild(a), a.click(), a.remove(), 
    SchedulerService.scheduleTimeout(() => URL.revokeObjectURL(url), 1e3, { owner: "utilities", key: "revoke-download-url" }), toast(`Wyeksportowano ${rows.length - 1} adresów do CSV.`);
});
