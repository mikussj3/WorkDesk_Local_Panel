Object.freeze({
    to: "#fTo",
    cc: "#fCc",
    bcc: "#fBcc",
    subject: "#fSubject",
    body: "#fBody",
    signature: "#fSig"
}), function() {
    const missing = [ "fTo", "fCc", "fBcc", "fSubject", "fBody", "fSig", "tilesHost", "todoList", "journalList", "notesHost" ].filter(id => !document.getElementById(id));
    if (missing.length) throw new Error("Bootstrap: missing DOM nodes: " + missing.join(", "));
 }();

const SafeDOM = (() => {
    const URL_ATTRS = new Set(["href", "src", "action", "formaction"]);
    const safeUrl = value => {
        const raw = String(value ?? "").trim();
        if (!raw) return "";
        if (/^(?:javascript|vbscript):/i.test(raw)) return "";
        if (/^data:/i.test(raw) && !/^data:image\/(?:png|gif|jpeg|webp);/i.test(raw)) return "";
        return raw;
    };
    const append = (parent, children) => {
        for (const child of [children].flat(Infinity)) {
            if (child == null || child === false) continue;
            parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
        }
        return parent;
    };
    const el = (tag, options = {}, children = []) => {
        const node = document.createElement(tag);
        if (options.className) node.className = options.className;
        if (options.text != null) node.textContent = String(options.text);
        if (options.value != null && "value" in node) node.value = String(options.value);
        if (options.checked != null && "checked" in node) node.checked = !!options.checked;
        if (options.hidden != null) node.hidden = !!options.hidden;
        for (const [key, value] of Object.entries(options.attrs || {})) {
            if (value == null || value === false) continue;
            const safeValue = URL_ATTRS.has(key.toLowerCase()) ? safeUrl(value) : String(value);
            if (value === true) node.setAttribute(key, "");
            else node.setAttribute(key, safeValue);
        }
        for (const [key, value] of Object.entries(options.dataset || {})) {
            if (value != null) node.dataset[key] = String(value);
        }
        for (const [key, value] of Object.entries(options.style || {})) {
            if (value != null) node.style.setProperty(key, String(value));
        }
        return append(node, children);
    };
    const clear = node => (node?.replaceChildren(), node);
    const replace = (node, children = []) => (node?.replaceChildren(), node && append(node, children), node);
    const text = value => document.createTextNode(String(value ?? ""));
    const empty = (className, message) => el("div", { className, text: message });
    const trustedStaticFragment = html => {
        const template = document.createElement("template");
        template.innerHTML = String(html || "");
        return template.content.cloneNode(true);
    };
    return Object.freeze({ el, append, clear, replace, text, empty, safeUrl, trustedStaticFragment });
})();


let renderEmailProfilesModule = () => false;
let renderChecklistsModule = () => false;
let renderResponseCasesModule = () => false;
let renderPhoneLogModule = () => false;
let renderProceduresModule = () => false;
let renderUserConfigModule = () => false;

const DEFAULT_RUNTIME_DATA = {
    sections: [ {
        name: "Wewnętrzne",
        groups: [ {
            name: "Zarząd",
            emails: [ "prezes@firma.pl", "wiceprezes@firma.pl" ]
        }, {
            name: "IT",
            emails: [ "it.helpdesk@firma.pl", "admin@firma.pl", "devops@firma.pl" ]
        }, {
            name: "HR",
            emails: [ "hr@firma.pl", "rekrutacja@firma.pl", "kadry@firma.pl" ]
        }, {
            name: "Księgowość",
            emails: [ "ksiegowosc@firma.pl", "faktury@firma.pl" ]
        } ]
    }, {
        name: "Klienci",
        groups: [ {
            name: "Klienci kluczowi",
            emails: [ "kontakt@klient-a.pl", "biuro@klient-b.pl", "office@klient-c.com" ]
        }, {
            name: "Klienci VIP",
            emails: [ "vip1@example.com", "vip2@example.com" ]
        }, {
            name: "Nowi klienci",
            emails: [ "nowy1@example.com", "nowy2@example.com", "nowy3@example.com" ]
        } ]
    }, {
        name: "Dostawcy",
        groups: [ {
            name: "Logistyka",
            emails: [ "transport@kurier.pl", "spedycja@logistyka.pl" ]
        }, {
            name: "Materiały",
            emails: [ "zamowienia@dostawca.pl", "biuro@hurtownia.pl" ]
        } ]
    } ],
    templates: [ {
        name: "Potwierdzenie spotkania",
        to: "",
        cc: "",
        bcc: "",
        subject: "Potwierdzenie spotkania – [data]",
        body: "Dzień dobry,\n\npotwierdzam nasze spotkanie zaplanowane na [data] o godzinie [godzina].\nMiejsce: [miejsce / link do spotkania online].\n\nW razie zmian proszę o informację.\n\nPozdrawiam,",
        footer: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o.\ntel. +48 000 000 000"
    }, {
        name: "Prośba o fakturę",
        to: "ksiegowosc@firma.pl",
        cc: "",
        bcc: "",
        subject: "Prośba o wystawienie faktury",
        body: "Dzień dobry,\n\nproszę o wystawienie faktury za usługi z miesiąca [miesiąc].\nDane do faktury w załączeniu / poniżej.\n\nDziękuję,",
        footer: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o."
    }, {
        name: "Urlop – wniosek",
        to: "hr@firma.pl",
        cc: "",
        bcc: "",
        subject: "Wniosek urlopowy – [data od] / [data do]",
        body: "Dzień dobry,\n\nzwracam się z prośbą o udzielenie urlopu wypoczynkowego w terminie od [data od] do [data do].\nW okresie nieobecności w sprawach pilnych proszę kontaktować się z [osoba zastępująca].\n\nZ poważaniem,",
        footer: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o."
    }, {
        name: "Wysyłka oferty",
        to: "",
        cc: "",
        bcc: "",
        subject: "Oferta – [nazwa projektu / klienta]",
        body: "Dzień dobry,\n\nw załączeniu przesyłam ofertę dotyczącą [temat].\nProszę o potwierdzenie otrzymania oraz informację o ewentualnych pytaniach.\n\nPozdrawiam,",
        footer: "—\nImię Nazwisko\nDział handlowy\nFirma Sp. z o.o.\ntel. +48 000 000 000"
    }, {
        name: "Zgłoszenie do IT",
        to: "it.helpdesk@firma.pl",
        cc: "",
        bcc: "",
        subject: "Zgłoszenie – [krótki opis problemu]",
        body: "Dzień dobry,\n\nzgłaszam problem techniczny:\n• Co się dzieje: [opis]\n• Kiedy zaczęło się dziać: [data/godzina]\n• Komunikat błędu: [treść]\n• Stanowisko / system: [Windows / Edge / app]\n\nProszę o kontakt w sprawie naprawy.",
        footer: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o."
    } ],
    tiles: [ {
        type: "link",
        title: "Intranet",
        url: "http://intranet.firma.local",
        desc: "Wewnętrzny portal pracownika.",
        icon: "globe"
    }, {
        type: "link",
        title: "System CRM",
        url: "https://crm.firma.pl",
        desc: "Klienci, kontakty, lejek sprzedaży.",
        icon: "briefcase"
    }, {
        type: "link",
        title: "Baza wiedzy",
        url: "https://wiki.firma.pl",
        desc: "Procedury, instrukcje, FAQ.",
        icon: "book"
    }, {
        type: "link",
        title: "Helpdesk IT",
        url: "https://helpdesk.firma.pl",
        desc: "Zgłoszenia awarii i wniosków.",
        icon: "life"
    }, {
        type: "link",
        title: "Stary panel HR",
        url: "http://hr-legacy.firma.local/login.aspx",
        desc: "Stary system HR – działa w trybie IE.",
        icon: "users",
        ie: !0
    }, {
        type: "link",
        title: "ERP – moduł magazyn",
        url: "http://erp.firma.local/wms",
        desc: "Wymaga trybu zgodności IE.",
        icon: "box",
        ie: !0
    }, {
        type: "copy",
        title: "NIP firmy",
        value: "PL0000000000",
        desc: "Kliknij, aby skopiować NIP.",
        icon: "id"
    }, {
        type: "copy",
        title: "Numer konta",
        value: "PL00 0000 0000 0000 0000 0000 0000",
        desc: "Kliknij, aby skopiować IBAN.",
        icon: "bank"
    }, {
        type: "copy",
        title: "Adres biura",
        value: "Firma Sp. z o.o., ul. Przykładowa 1, 00-000 Warszawa",
        desc: "Kliknij, aby skopiować adres.",
        icon: "map"
    }, {
        type: "copy",
        title: "ID wewnętrzny",
        value: "WD-2026-INTERNAL-001",
        desc: "Identyfikator do zgłoszeń wewnętrznych.",
        icon: "hash"
    } ],
    frequentLinks: [ {
        title: "Pulpit zarządzania",
        url: "http://intranet.firma.local",
        note: "intranet"
    }, {
        title: "Kalendarz zespołu",
        url: "https://outlook.office.com/calendar/",
        note: "outlook"
    }, {
        title: "Pliki współdzielone",
        url: "https://firma.sharepoint.com/",
        note: "sharepoint"
    }, {
        title: "Ewidencja czasu",
        url: "http://intranet.firma.local/timesheet",
        note: "czas pracy"
    } ],
    knownMails: [ "anna.kowalska@firma.pl", "jan.nowak@firma.pl", "piotr.zielinski@firma.pl", "biuro@firma.pl", "kontakt@firma.pl" ],
    snippets: [ {
        name: "data",
        label: "Dzisiejsza data (PL)",
        value: "{{date_pl}}"
    }, {
        name: "dataiso",
        label: "Dzisiejsza data (ISO)",
        value: "{{date_iso}}"
    }, {
        name: "godzina",
        label: "Aktualna godzina",
        value: "{{time}}"
    }, {
        name: "podpis",
        label: "Podpis stopki",
        value: "—\nImię Nazwisko\nDział / Stanowisko\nFirma Sp. z o.o.\ntel. +48 000 000 000"
    }, {
        name: "spotkanie",
        label: "Blok potwierdzenia spotkania",
        value: "Potwierdzam nasze spotkanie zaplanowane na [data] o godzinie [godzina].\nMiejsce: [miejsce / link do spotkania online]."
    }, {
        name: "nip",
        label: "NIP firmy",
        value: "NIP: PL0000000000"
    }, {
        name: "iban",
        label: "Numer konta",
        value: "Numer konta: PL00 0000 0000 0000 0000 0000 0000"
    }, {
        name: "adres",
        label: "Adres biura",
        value: "Firma Sp. z o.o.\nul. Przykładowa 1, 00-000 Warszawa"
    }, {
        name: "prosba",
        label: "Uprzejma prośba (otwarcie)",
        value: "Dzień dobry,\n\nzwracam się z uprzejmą prośbą o "
    }, {
        name: "dzieki",
        label: "Podziękowanie (zamknięcie)",
        value: "\n\nZ góry dziękuję za pomoc.\n\nPozdrawiam,"
    } ],
    fx: {
        EUR: 4.3,
        USD: 4,
        GBP: 5.05,
        CHF: 4.45,
        asOf: "domyślne"
    }
}

let appState = null;

const RUNTIME_DATA_MODULES = Object.freeze({
    sections: ["email", "sections"],
    knownMails: ["email", "knownMails"],
    templates: ["templates"],
    tiles: ["tiles"],
    frequentLinks: ["frequentLinks"],
    fx: ["fx"],
    snippets: ["snippets"]
});

const runtimeBootstrapData = JSON.parse(JSON.stringify(DEFAULT_RUNTIME_DATA));

function resolveRuntimeDataProperty(property) {
    const mapping = RUNTIME_DATA_MODULES[property];
    if (!mapping || !appState?.modules) return runtimeBootstrapData[property];
    const [moduleId, nestedKey] = mapping;
    const moduleState = appState.modules[moduleId];
    return nestedKey ? moduleState?.[nestedKey] : moduleState;
}

function assignRuntimeDataProperty(property, value) {
    const mapping = RUNTIME_DATA_MODULES[property];
    if (!mapping || !appState?.modules) {
        runtimeBootstrapData[property] = value;
        return true;
    }
    const [moduleId, nestedKey] = mapping;
    if (nestedKey) {
        const current = appState.modules[moduleId] && typeof appState.modules[moduleId] === "object"
            ? appState.modules[moduleId]
            : {};
        current[nestedKey] = value;
        appState.modules[moduleId] = current;
    } else {
        appState.modules[moduleId] = value;
    }
    return true;
}

const runtimeData = new Proxy(runtimeBootstrapData, {
    get(target, property) {
        if (typeof property === "symbol" || !(property in RUNTIME_DATA_MODULES)) return target[property];
        return resolveRuntimeDataProperty(property);
    },
    set(target, property, value) {
        if (typeof property === "symbol" || !(property in RUNTIME_DATA_MODULES)) {
            target[property] = value;
            return true;
        }
        return assignRuntimeDataProperty(property, value);
    },
    ownKeys(target) {
        return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, property) {
        return Object.getOwnPropertyDescriptor(target, property) || { configurable: true, enumerable: true };
    }
});
const DEFAULT_FX = Object.freeze({
    EUR: 4.3,
    USD: 4,
    GBP: 5.05,
    CHF: 4.45,
    asOf: "domyślne"
}), $ = (s, el = document) => el.querySelector(s), $$ = (s, root = document) => {
    const el = "string" == typeof root ? document.querySelector(root) : root;
    return el && "function" == typeof el.querySelectorAll ? Array.from(el.querySelectorAll(s)) : [];
}, byAlpha = (a, b) => a.localeCompare(b, "pl", {
    sensitivity: "base"
}), uniq = arr => Array.from(new Set(arr)), escHTML = s => String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[m])), SchedulerService = (() => {
    const native = Object.freeze({
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window)
    }), jobs = new Map, resumeListeners = new Set;
    let sequence = 0, paused = document.hidden;
    function disarm(job) {
        null != job?.nativeId && (native.clearTimeout(job.nativeId), job.nativeId = null);
    }
    function arm(job, delay = job.remaining ?? job.delay) {
        !job || !jobs.has(job.id) || paused && job.pauseWhenHidden || (job.remaining = null, 
        job.nextAt = Date.now() + Math.max(0, delay), job.nativeId = native.setTimeout(() => function(id) {
            const job = jobs.get(id);
            if (job) {
                job.nativeId = null, "timeout" === job.type && jobs.delete(id);
                try {
                    job.fn();
                } catch (error) {
                    console.error(`[SchedulerService:${job.owner}]`, error);
                }
                "interval" === job.type && jobs.has(id) && arm(job, job.delay);
            }
        }(job.id), Math.max(0, delay)));
    }
    function schedule(type, fn, delay = 0, options = {}) {
        if ("function" != typeof fn) throw new TypeError("SchedulerService wymaga funkcji.");
        const owner = String(options.owner || "app"), id = ((owner, key) => key ? `${owner}:${key}` : `${owner}:task-${++sequence}`)(owner, options.key);
        cancel(id);
        const job = {
            id: id,
            owner: owner,
            key: options.key || null,
            type: type,
            fn: fn,
            delay: Math.max(0, Number(delay) || 0),
            pauseWhenHidden: !1 !== options.pauseWhenHidden,
            nativeId: null,
            nextAt: 0,
            remaining: null
        };
        if (jobs.set(id, job), options.immediate && "interval" === type) try {
            fn();
        } catch (error) {
            console.error(`[SchedulerService:${owner}]`, error);
        }
        return arm(job), Object.freeze({
            id: id,
            owner: owner
        });
    }
    function scheduleTimeout(fn, delay = 0, options = {}) {
        return schedule("timeout", fn, delay, options);
    }
    function cancel(token) {
        const id = (token => "string" == typeof token ? token : token?.id)(token);
        if (!id) return !1;
        const job = jobs.get(id);
        return !!job && (disarm(job), jobs.delete(id), !0);
    }
    function cancelOwner(owner) {
        let count = 0;
        for (const job of [ ...jobs.values() ]) job.owner === owner && (cancel(job.id), 
        count++);
        return count;
    }
    function pauseOnHidden() {
        if (paused) return !1;
        paused = !0;
        const now = Date.now();
        for (const job of jobs.values()) job.pauseWhenHidden && (job.remaining = Math.max(0, (job.nextAt || now) - now), 
        disarm(job));
        return !0;
    }
    function resume() {
        const wasPaused = paused;
        paused = !1;
        for (const job of jobs.values()) null == job.nativeId && arm(job, job.remaining ?? job.delay);
        if (wasPaused) for (const listener of [ ...resumeListeners ]) try {
            listener();
        } catch (error) {
            console.error("[SchedulerService:resume]", error);
        }
        return wasPaused;
    }
    function handleVisibility() {
        document.hidden ? pauseOnHidden() : resume();
    }
    const visibilityListener = EventLifecycle.on(document, "visibilitychange", handleVisibility, {
        owner: "scheduler",
        key: "visibility"
    });
    return Object.freeze({
        scheduleTimeout: scheduleTimeout,
        scheduleInterval: function(fn, delay, options = {}) {
            return schedule("interval", fn, delay, options);
        },
        debounce: function(owner, key, fn, wait = 160, options = {}) {
            const taskOwner = String(owner || "app"), taskKey = String(key || fn?.name || "debounce"), wrapped = function(...args) {
                const context = this;
                return scheduleTimeout(() => fn.apply(context, args), wait, {
                    ...options,
                    owner: taskOwner,
                    key: taskKey
                });
            };
            return wrapped.cancel = () => cancel(`${taskOwner}:${taskKey}`), wrapped;
        },
        cancel: cancel,
        cancelOwner: cancelOwner,
        pauseOnHidden: pauseOnHidden,
        resume: resume,
        onResume: function(listener) {
            return "function" != typeof listener ? () => {} : (resumeListeners.add(listener), 
            () => resumeListeners.delete(listener));
        },
        teardown: function(owner) {
            if (owner) return cancelOwner(owner);
            for (const job of [ ...jobs.values() ]) cancel(job.id);
            return resumeListeners.clear(), EventLifecycle.remove(visibilityListener), !0;
        },
        get paused() {
            return paused;
        },
        get size() {
            return jobs.size;
        },
        stats() {
            const byOwner = {};
            for (const job of jobs.values()) byOwner[job.owner] = (byOwner[job.owner] || 0) + 1;
            return {
                size: jobs.size,
                paused: paused,
                byOwner: byOwner
            };
        }
    });
})();
