// Czyste funkcje pomocnicze WorkDesk — bez DOM, bez stanu globalnego aplikacji.
// Wydzielone w Fazie 4 audytu: jedno źródło prawdy (koniec duplikacji csvEscape/csvSafeCell)
// i testowalność jednostkowa (tools/unit_tests.mjs, node:test, zero zależności).
// Kolejność ładowania: po 27-storage-capability, przed resztą runtime.

function cloneData(value) {
    if (void 0 !== value) {
        if (null === value) return null;
        try {
            if ("function" == typeof structuredClone) return structuredClone(value);
        } catch {}
        try {
            const json = JSON.stringify(value);
            return void 0 === json ? void 0 : JSON.parse(json);
        } catch {
            return value;
        }
    }
}

function parseTimestamp(value) {
    const n = "number" == typeof value ? value : Date.parse(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeTimestamp(value) {
    if ("number" == typeof value) return Number.isFinite(value) && value >= 0 ? value : null;
    const ts = parseTimestamp(value);
    return null !== ts && ts >= 0 ? ts : null;
}

function validDateISO(value) {
    if ("string" != typeof value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return !1;
    const [y, m, d] = value.split("-").map(Number), dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function validTime(value) {
    return "string" == typeof value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function csvEscape(value, delimiter = ";") {
    return function(value, delimiter = ";") {
        let text = String(value ?? "");
        /^[=+\-@]/.test(text) && (text = "'" + text);
        const escaped = text.replace(/"/g, '""');
        return escaped.includes(delimiter) || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"') ? `"${escaped}"` : escaped;
    }(value, delimiter);
}

// Usuwa apostrof ochronny dodany przez csvEscape (round-trip własnych eksportów).
function csvUnguardCell(value) {
    const text = String(value ?? "").trim();
    return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

// Alternatywny, prosty wariant ochrony CSV-injection (bez cytowania) — pozostały po
// konsolidacji wyłącznie w celach kompatybilności; nowy kod powinien używać csvEscape.
function csvSafeCell(value) {
    const text = String(value ?? "");
    return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function normalizeSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[łŁ]/g, "l")
        .replace(/[đĐ]/g, "d")
        .toLocaleLowerCase("pl-PL")
        .replace(/\s+/g, " ")
        .trim();
}

function searchScore(entry, queryTokens, normalizedQuery) {
    let score = 0;
    if (entry.normalizedTitle === normalizedQuery) score += 120;
    else if (entry.normalizedTitle.startsWith(normalizedQuery)) score += 80;
    else if (entry.normalizedTitle.includes(normalizedQuery)) score += 55;
    if (entry.normalizedCategory === normalizedQuery) score += 45;
    else if (entry.normalizedCategory.startsWith(normalizedQuery)) score += 25;
    for (const token of queryTokens) {
        if (entry.normalizedTitle.startsWith(token)) score += 24;
        else if (entry.normalizedTitle.includes(token)) score += 16;
        if (entry.normalizedSubtitle.includes(token)) score += 8;
        if (entry.normalizedCategory.includes(token)) score += 6;
        if (entry.normalizedKeywords.includes(token)) score += 4;
        if (![entry.normalizedTitle, entry.normalizedSubtitle, entry.normalizedCategory, entry.normalizedKeywords].some(field => field.includes(token))) return -1;
    }
    return score;
}
