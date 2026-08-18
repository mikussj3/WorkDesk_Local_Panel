
function replaceArrayContents(target, value) {
    const rows = Array.isArray(value) ? cloneData(value) : [];
    return target.splice(0, target.length, ...rows), target;
}


let todos = bootstrapModule("todo", []);



function setOut(s) {
    $("#toolsOut").textContent = s;
}

function renderFlinks() {
    const host = $("#flinksHost");
    SafeDOM.replace(host, runtimeData.frequentLinks.map(link => {
        const icon = SafeDOM.el("span", { className: "ic", attrs: { "aria-hidden": "true" } },
            SafeDOM.trustedStaticFragment('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>'));
        return SafeDOM.el("a", { className: "flink", attrs: {
            href: SafeDOM.safeUrl(link.url), target: "_blank", rel: "noopener"
        } }, [icon, SafeDOM.el("span", { text: link.title }), SafeDOM.el("span", { className: "desc", text: link.note || "" })]);
    }));
}

function ieUrl(url) {
    const value = String(url || "").trim();
    return value.startsWith("microsoft-edge:") ? value : "microsoft-edge:" + value;
}

function isLocalPath(value) {
    const path = String(value || "").trim();
    return /^file:(?:\/{0,2})/i.test(path) || /^[a-z]:[\\/]/i.test(path) || /^\\\\[^\\]+\\[^\\]+/.test(path) || /^\\\\\?\\[a-z]:[\\/]/i.test(path);
}

function localPathForClipboard(value) {
    const path = String(value || "").trim();
    if (!/^file:/i.test(path)) return /^[a-z]:[\\/]/i.test(path) || /^\\\\/.test(path) ? path.replace(/\//g, "\\") : path;
    try {
        const fileUrl = new URL(path);
        const decodedPath = decodeURIComponent(fileUrl.pathname || "").replace(/\//g, "\\");
        if (fileUrl.hostname && fileUrl.hostname.toLowerCase() !== "localhost") {
            return `\\\\${fileUrl.hostname}${decodedPath}`;
        }
        return decodedPath.replace(/^\\(?=[a-z]:\\)/i, "");
    } catch {
        return path;
    }
}

function tileOpenUrl(tile) {
    if (!tile || !tile.url) return "";
    return tile.ie ? ieUrl(tile.url) : String(tile.url).trim();
}

async function openTile(tile) {
    const rawTarget = String(tile?.url || "").trim();
    if (!rawTarget) return Object.freeze({ ok: false, kind: "empty" });
    if (isLocalPath(rawTarget)) {
        const localPath = localPathForClipboard(rawTarget);
        const copied = await copyToClipboard(localPath);
        toast(copied
            ? "Ścieżka lokalna została skopiowana do schowka — wklej ją w Eksploratorze Windows."
            : "Nie udało się skopiować ścieżki lokalnej do schowka.", copied ? "ok" : "err");
        return Object.freeze({ ok: copied, kind: "local-path", copied, target: localPath });
    }
    const targetUrl = tileOpenUrl(tile);
    window.open(targetUrl, "_blank", "noopener");
    return Object.freeze({ ok: true, kind: tile.ie ? "ie-mode" : "web", opened: true, target: targetUrl });
}

function renderTiles() {
    const __pf36ctx = {
        root: document,
        state: ensureAppState()?.modules?.tiles
    };
    MODULE_LIFECYCLE?.run("tiles", "beforeRender", __pf36ctx);
    const host = $("#tilesHost");
    host.replaceChildren(), sortTilesByPreferences(runtimeData.tiles || []).forEach(t => host.appendChild(function(t) {
        const isCopy = "copy" === t.type, el = document.createElement("article");
        el.className = "tile" + (isCopy ? " copy-tile" : "") + (pinnedTiles.has(t.id) ? " pinned" : ""), 
        el.dataset.title = t.title, t.id || (t.id = globalThis.crypto?.randomUUID?.() || `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`), 
        el.dataset.tileId = t.id, el.dataset.recordId = t.id, el.draggable = !0, isCopy || (el.dataset.url = tileOpenUrl(t), 
        el.setAttribute("role", "link"), el.tabIndex = 0, el.setAttribute("aria-label", `Otwórz: ${t.title}`)), 
        el.setAttribute("data-testid", "tile-" + t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        const tags = [];
        t.ie && tags.push(SafeDOM.el("span", { className: "tag ie", text: "IE MODE" })), isCopy && tags.push(SafeDOM.el("span", { className: "tag copy", text: "KOPIUJ" })),
        isCopy || t.ie || tags.push(SafeDOM.el("span", { className: "tag", text: "LINKS" })), (t.tags || []).forEach(tag => tags.push(SafeDOM.el("span", { className: "tag", text: tag })));
        const iconHost = SafeDOM.el("div", { className: "t-icon" }, SafeDOM.trustedStaticFragment(getIcon(t.icon)));
        SafeDOM.append(el, [
            SafeDOM.el("div", { className: "t-head" }, [iconHost, SafeDOM.el("div", { className: "t-title", text: t.title })]),
            SafeDOM.el("div", { className: "t-desc", text: t.desc || "" }),
            isCopy ? SafeDOM.el("div", { className: "t-value", text: t.value || "" }) : null,
            SafeDOM.el("div", { className: "t-tags" }, tags)
        ]),
        isCopy && el.addEventListener("click", async e => {
            e.target.closest("[data-tile-action]") || (await copyToClipboard(t.value) ? (el.style.outline = "2px solid var(--ok)", 
            SchedulerService.scheduleTimeout(() => el.style.outline = "", 600, { owner: "tiles", key: `copy-outline-${t.id}` }), toast(`Skopiowano: ${t.title}`)) : toast("Nie udało się skopiować.", "err"));
        }), el.addEventListener("dragstart", e => {
            el.classList.add("dragging"), e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.title);
        }), el.addEventListener("dragend", () => {
            el.classList.remove("dragging"), $$(".tile.drag-over", $("#tilesHost")).forEach(x => x.classList.remove("drag-over")), 
            function() {
                const ids = $$(".tile", $("#tilesHost")).map(el => el.dataset.tileId).filter(Boolean);
                var arr;
                arr = ids.filter(id => !pinnedTiles.has(id)), ensureAppState(), appState.modules.preferences.tileOrder = normalizeTilePreferenceIds(arr), 
                requestFullSnapshot(), appState.modules.preferences.tileOrder;
            }();
        }), el.addEventListener("dragover", e => {
            e.preventDefault(), e.dataTransfer.dropEffect = "move";
            const dragging = $(".tile.dragging", $("#tilesHost"));
            if (!dragging || dragging === el) return;
            const rect = el.getBoundingClientRect(), before = e.clientY - rect.top < rect.height / 2;
            el.parentNode.insertBefore(dragging, before ? el : el.nextSibling);
        }), el.addEventListener("dragenter", () => {
            el.classList.contains("dragging") || el.classList.add("drag-over");
        }), el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
        const actions = document.createElement("div");
        actions.className = "tile-action-bar";
        const actionButton = (action, label, text) => {
            const button = document.createElement("button");
            button.type = "button", button.className = "icon-btn", button.dataset.tileAction = action, 
            button.setAttribute("aria-label", label), button.textContent = text, actions.appendChild(button);
        };
        return isCopy || actionButton("open", "Otwórz kafelek", "↗"), isCopy && actionButton("copy", "Kopiuj wartość", "⧉"), 
        actionButton("pin", (pinnedTiles.has(t.id) ? "Odepnij" : "Przypnij") + " kafelek", "★"), 
        actionButton("qr", "Pokaż kod QR", "QR"), actionButton("edit", "Edytuj kafelek", "✎"),
        actionButton("delete", "Usuń kafelek", "✕"), el.appendChild(actions), el;
    }(t))), applyTileFilter(), MODULE_LIFECYCLE?.run("tiles", "afterRender", {
        ...__pf36ctx,
        root: document
    });
}

function showCode(title, code) {
    $("#codeTitle").textContent = title, $("#codeBlock").textContent = code, showModal("codeModal");
}

EventLifecycle.on($("#toolClean"), "click", () => {
    const before = EmailComposerState.read().body.length, body = EmailComposerState.read().body.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").replace(/^\s+|\s+$/g, "");
    EmailComposerState.update({
        body: body
    }), setOut(`Wyczyszczono treść (− ${before - body.length} znaków).`), toast("Tekst uporządkowany.");
}), EventLifecycle.on($("#toolCount"), "click", () => {
    const t = EmailComposerState.read().body, words = (t.match(/\S+/g) || []).length;
    setOut(`Znaki: ${t.length} · słowa: ${words} · linie: ${t.split("\n").length}`);
}, { owner: "text-tools", key: "count" }), EventLifecycle.on($("#toolDatePL"), "click", async () => {
    const d = new Date, v = pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear();
    await copyToClipboard(v) && (setOut("Skopiowano: " + v), toast("Skopiowano " + v));
}, { owner: "text-tools", key: "date-pl" }), EventLifecycle.on($("#toolDateISO"), "click", async () => {
    const d = new Date, v = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    await copyToClipboard(v) && (setOut("Skopiowano: " + v), toast("Skopiowano " + v));
}, { owner: "text-tools", key: "date-iso" }), EventLifecycle.on($("#toolUpper"), "click", () => {
    const t = $("#fBody"), s = t.selectionStart, e = t.selectionEnd;
    if (s === e) return void setOut("Zaznacz fragment w treści, aby zmienić wielkość liter.");
    const part = t.value.slice(s, e), allUpper = part === part.toUpperCase(), replaced = allUpper ? part.toLowerCase() : part.toUpperCase();
    t.value = t.value.slice(0, s) + replaced + t.value.slice(e), t.focus(), t.setSelectionRange(s, s + replaced.length), 
    updateCharBadge(), setOut(allUpper ? "Zamieniono na małe litery." : "Zamieniono na WIELKIE litery.");
}, { owner: "text-tools", key: "toggle-case" }), $$("[data-toggle]").forEach(h => {
    h.addEventListener("click", () => {
        const panel = h.parentElement, open = panel.classList.toggle("open");
        h.setAttribute("aria-expanded", String(open));
        open || flushPendingWrites();
    });
}), EventLifecycle.on($("#copyCodeBtn"), "click", async () => {
    const ok = await copyToClipboard($("#codeBlock").textContent);
    toast(ok ? "Skopiowano kod do schowka." : "Nie udało się skopiować.", ok ? "ok" : "err");
}, { owner: "text-tools", key: "copy-code" });




function byteSize(value) {
    try {
        return new Blob([ "string" == typeof value ? value : JSON.stringify(value) ]).size;
    } catch {
        return 0;
    }
}

function formatBytes(bytes) {
    const n = Math.max(0, Number(bytes) || 0);
    return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB" : (n / 1024 / 1024).toFixed(2) + " MB";
}

function canAddRecord(moduleId, currentCount) {
    const l = StorageLimits.current(), key = {
        todo: "todoRecords",
        journal: "journalRecords",
        notes: "notesRecords",
        calendarReminders: "remindersRecords"
    }[moduleId];
    return !(key && currentCount >= l[key] && (toast(`Osiągnięto limit modułu: ${l[key]} rekordów. Zmień limit lub zwolnij miejsce.`, "err"), 
    1));
}
