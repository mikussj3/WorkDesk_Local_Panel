
function readMeaningfulDraft() {
    try {
        const raw = StorageService.get(DRAFT_KEY) || StorageService.get("wd.draft.v1");
        if (!raw) return null;
        const d = JSON.parse(raw), form = d.form || {
            to: d.fTo,
            cc: d.fCc,
            bcc: d.fBcc,
            subject: d.fSubject,
            body: d.fBody,
            signature: d.fSig
        };
        return [ "to", "cc", "bcc", "subject", "body" ].some(k => String(form?.[k] || "").trim()) ? d : null;
    } catch {
        return null;
    }
}

function clearDraft() {
    WriteQueue.cancel("draft"), StorageService.remove(DRAFT_KEY), StorageService.remove("wd.draft.v1");
}

let pendingDraftRestore = null;

function restorePendingDraft() {
    if (!pendingDraftRestore) return false;
    EmailComposerState.restoreDraft(pendingDraftRestore), reconcileSelectedEmailGroups(), updateCharBadge(), validateAllRecipients(), renderGroups($("#grpSearch").value), 
    pendingDraftRestore = null, emailEl.classList.contains("expanded") || toggleEmail(), toast("Przywrócono wersję roboczą.");
    return true;
}

function discardPendingDraft() {
    return clearDraft(), pendingDraftRestore = null, toast("Wersja robocza odrzucona."), true;
}

EmailComposerState.bind();

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function validateRecipients(id) {
    const input = $("#" + id), info = $("#info" + id.slice(1)), addrs = parseEmails(input.value);
    if (!addrs.length) return info.textContent = "", info.className = "field-info", 
    void input.classList.remove("invalid-input");
    const bad = addrs.filter(a => !EMAIL_RE.test(a));
    bad.length ? (info.textContent = `${addrs.length - bad.length} OK · ${bad.length} błędnych: ${bad.slice(0, 2).join(", ")}${bad.length > 2 ? "…" : ""}`, 
    info.className = "field-info invalid", input.classList.add("invalid-input")) : (info.textContent = `${addrs.length} prawidłow${1 === addrs.length ? "y" : "ych"}`, 
    info.className = "field-info ok", input.classList.remove("invalid-input"));
}

function validateAllRecipients() {
    [ "fTo", "fCc", "fBcc" ].forEach(validateRecipients);
}

function normalizeTilePreferenceIds(values) {
    const tiles = runtimeData?.tiles || [], byId = new Map(tiles.map(tile => [ tile.id, tile.id ])), byTitle = new Map;
    return tiles.forEach(tile => {
        byTitle.has(tile.title) || byTitle.set(tile.title, tile.id);
    }), [ ...new Set((Array.isArray(values) ? values : []).map(value => byId.get(value) || byTitle.get(value)).filter(Boolean)) ];
}

function loadTileOrder() {
    return normalizeTilePreferenceIds(bootstrapModule("preferences", {}).tileOrder);
}

[ "fTo", "fCc", "fBcc" ].forEach(id => {
    $("#" + id).addEventListener("input", () => validateRecipients(id));
});

let tileSearchQuery = "", tileTypeFilter = "ALL", pinnedTiles = new Set(normalizeTilePreferenceIds(bootstrapModule("preferences", {}).tilePins));

function sortTilesByPreferences(rows) {
    const order = new Map(loadTileOrder().map((id, index) => [ id, index ]));
    return [ ...rows ].sort((a, b) => Number(pinnedTiles.has(b.id)) - Number(pinnedTiles.has(a.id)) || (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

function updateTileFilterBadges() {
    $$("#tileFilterBadges .filter-badge").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tileFilter === tileTypeFilter);
    });
}

function applyTileFilter() {
    $$(".tile", $("#tilesHost")).forEach(el => {
        const t = runtimeData.tiles.find(x => x.id === el.dataset.tileId);
        el.classList.toggle("tile-hidden", !(t && function(t, q) {
            return !q || (t.title + " " + (t.desc || "") + " " + (t.tags || []).join(" ")).toLowerCase().includes(q);
        }(t, tileSearchQuery) && function(t, filter) {
            return "KOPIUJ" === filter ? "copy" === t.type : "IE MODE" === filter ? !!t.ie : "LINKS" !== filter || "copy" !== t.type && !t.ie;
        }(t, tileTypeFilter)));
    });
}

$("#tileSearch").addEventListener("input", e => {
    tileSearchQuery = e.target.value.trim().toLowerCase(), applyTileFilter();
}), $$("#tileFilterBadges .filter-badge").forEach(btn => {
    btn.addEventListener("click", () => {
        tileTypeFilter = btn.dataset.tileFilter || "ALL", updateTileFilterBadges(), applyTileFilter();
    });
}), $("#tileReorderReset").addEventListener("click", async () => {
    await showConfirmModal("Przywrócić domyślną kolejność kafelków?", {
        confirmLabel: "Przywróć"
    }) && (ensureAppState(), appState.modules.preferences.tileOrder = [], appState.modules.preferences.tilePins = [], 
    StorageService.remove("wd.tileOrder.v1"), StorageService.remove("wd.tilePins.v1"), 
    pinnedTiles = new Set, requestFullSnapshot(), renderTiles(), toast("Przywrócono domyślną kolejność."));
});

let pendingUndo = null;

const NOTE_PALETTES = [ {
    id: "amber",
    bg: "#26200f",
    bd: "#5b4a1c",
    fg: "#ffe8a8",
    swatch: "#e6c374"
}, {
    id: "mint",
    bg: "#0f2620",
    bd: "#1d4438",
    fg: "#bff5d6",
    swatch: "#6bd6a4"
}, {
    id: "blue",
    bg: "#101a2a",
    bd: "#234063",
    fg: "#cfdcff",
    swatch: "#7aa2ff"
}, {
    id: "rose",
    bg: "#2a1418",
    bd: "#5a2b30",
    fg: "#ffd0d0",
    swatch: "#ff8a8a"
}, {
    id: "slate",
    bg: "#161a22",
    bd: "#2c333f",
    fg: "#dfe3eb",
    swatch: "#8a93a8"
} ];


let notes = bootstrapModule("notes", []);




let snipActiveIx = 0, snipMatches = [];

function getSnippetToken() {
    const t = $("#fBody"), v = t.value, caret = t.selectionStart ?? v.length, m = v.slice(0, caret).match(/(?:^|\s)\/([a-z0-9]{0,20})$/i);
    return m ? {
        token: m[1].toLowerCase(),
        start: caret - m[1].length - 1
    } : null;
}

function refreshSnipActive() {
    $$(".item", $("#snipPop")).forEach((el, i) => el.classList.toggle("active", i === snipActiveIx));
}

function insertSnippet(s) {
    if (!s) return;
    const t = $("#fBody"), tk = getSnippetToken();
    if (!tk) return;
    const before = t.value.slice(0, tk.start), after = t.value.slice(t.selectionStart ?? t.value.length), value = function(value) {
        const d = new Date;
        return value.replace(/\{\{date_pl\}\}/g, pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear()).replace(/\{\{date_iso\}\}/g, d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())).replace(/\{\{time\}\}/g, pad(d.getHours()) + ":" + pad(d.getMinutes()));
    }(s.value);
    t.value = before + value + after;
    const caret = (before + value).length;
    t.setSelectionRange(caret, caret), t.focus(), UIRuntime.close("snipPop", {
        reason: "snippet-picked",
        restoreFocus: !1
    }), updateCharBadge(), scheduleDraftSave();
}

$("#fBody").addEventListener("input", function() {
    const pop = $("#snipPop"), tk = getSnippetToken();
    tk ? (snipMatches = (runtimeData.snippets || []).filter(s => s.name.toLowerCase().startsWith(tk.token)).slice(0, 8), 
    snipMatches.length ? (snipActiveIx = Math.min(snipActiveIx, snipMatches.length - 1), 
    SafeDOM.replace(pop, snipMatches.map((snippet, index) => SafeDOM.el("div", {
        className: `item ${index === snipActiveIx ? "active" : ""}`,
        dataset: { ix: index }
    }, SafeDOM.el("span", {}, [
        SafeDOM.el("code", { text: `/${snippet.name}` }),
        SafeDOM.text(" "),
        SafeDOM.el("span", { className: "lbl", text: snippet.label })
    ])))), UIRuntime.open("snippet", pop, {
        opener: $("#fBody"),
        priority: 40
    }), $$(".item", pop).forEach(el => {
        el.addEventListener("mousedown", e => {
            e.preventDefault(), insertSnippet(snipMatches[+el.dataset.ix]);
        }), el.addEventListener("mouseenter", () => {
            snipActiveIx = +el.dataset.ix, refreshSnipActive();
        });
    })) : UIRuntime.close(pop.id, {
        reason: "snippet-empty",
        restoreFocus: !1
    })) : UIRuntime.close(pop.id, {
        reason: "snippet-empty",
        restoreFocus: !1
    });
}), $("#fBody").addEventListener("keydown", e => {
    !$("#snipPop").hidden && snipMatches.length && ("ArrowDown" === e.key ? (e.preventDefault(), 
    snipActiveIx = (snipActiveIx + 1) % snipMatches.length, refreshSnipActive()) : "ArrowUp" === e.key ? (e.preventDefault(), 
    snipActiveIx = (snipActiveIx - 1 + snipMatches.length) % snipMatches.length, refreshSnipActive()) : "Enter" === e.key || "Tab" === e.key ? (e.preventDefault(), 
    insertSnippet(snipMatches[snipActiveIx])) : "Escape" === e.key && (e.preventDefault(), 
    UIRuntime.close("snipPop", {
        reason: "escape"
    })));
}), $("#fBody").addEventListener("blur", () => SchedulerService.scheduleTimeout(() => UIRuntime.close("snipPop", {
    reason: "blur",
    restoreFocus: !1
}), 120));
