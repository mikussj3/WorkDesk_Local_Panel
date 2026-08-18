
let csvPending = null;


EventLifecycle.on($("#csvImportBtn"), "click", () => $("#csvImportFile").click(), { owner: "csv-import", key: "open-file" }), 
EventLifecycle.on($("#csvImportFile"), "change", e => {
    const f = e.target.files?.[0];
    f && function(file) {
        if (!file) return;
        const reader = new FileReader;
        reader.onerror = () => toast("Nie udało się odczytać pliku CSV.", "err"), reader.onload = () => function(text, srcName) {
            const raw = function(text) {
                const firstLine = (text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")).split("\n").find(l => l.trim()) || "", sep = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",", rows = [];
                let row = [], cell = "", quoted = !1;
                for (let i = 0; i < text.length; i++) {
                    const c = text[i];
                    quoted ? '"' === c ? '"' === text[i + 1] ? (cell += '"', i++) : quoted = !1 : cell += c : '"' === c ? quoted = !0 : c === sep ? (row.push(cell), 
                    cell = "") : "\n" === c ? (row.push(cell), rows.push(row), row = [], cell = "") : cell += c;
                }
                return (cell.length || row.length) && (row.push(cell), rows.push(row)), rows.filter(r => r.length && r.some(f => f.trim()));
            }(text);
            if (!raw.length) return void toast("Plik CSV jest pusty.", "err");
            const dataRows = function(row) {
                const j = row.map(c => c.toLowerCase()).join("|");
                return j.includes("sekcja") || j.includes("grupa") || j.includes("email") || j.includes("e-mail");
            }(raw[0]) ? raw.slice(1) : raw, existingByGroup = new Map;
            runtimeData.sections.forEach(sec => sec.groups.forEach(g => {
                existingByGroup.set(sec.name + "::" + g.name, new Set(g.emails.map(e => e.toLowerCase())));
            }));
            const seenInImport = new Set, out = [];
            let nNew = 0, nDup = 0, nBad = 0;
            const newGroupKeys = new Set, newSectionNames = new Set, existingSecNames = new Set(runtimeData.sections.map(s => s.name));
            for (const r of dataRows) {
                const sec = csvUnguardCell(r[0]), grp = csvUnguardCell(r[1]), email = (r[2] || "").trim();
                if (!sec && !grp && !email) continue;
                if (!sec || !grp || !email) {
                    out.push({
                        section: sec,
                        group: grp,
                        email: email,
                        status: "bad",
                        reason: "Brakujące pole"
                    }), nBad++;
                    continue;
                }
                if (!EMAIL_RE.test(email)) {
                    out.push({
                        section: sec,
                        group: grp,
                        email: email,
                        status: "bad",
                        reason: "Niepoprawny e-mail"
                    }), nBad++;
                    continue;
                }
                const key = sec + "::" + grp, elc = email.toLowerCase(), dupHere = seenInImport.has(key + "||" + elc), dupExisting = existingByGroup.get(key)?.has(elc);
                dupHere || dupExisting ? (out.push({
                    section: sec,
                    group: grp,
                    email: email,
                    status: "dup",
                    reason: dupExisting ? "Już istnieje" : "Duplikat w pliku"
                }), nDup++) : (seenInImport.add(key + "||" + elc), existingByGroup.has(key) || newGroupKeys.add(key), 
                existingSecNames.has(sec) || newSectionNames.add(sec), out.push({
                    section: sec,
                    group: grp,
                    email: email,
                    status: "new"
                }), nNew++);
            }
            csvPending = {
                rows: out,
                stats: {
                    total: out.length,
                    nNew: nNew,
                    nDup: nDup,
                    nBad: nBad,
                    newSections: newSectionNames.size,
                    newGroups: newGroupKeys.size
                }
            }, function(srcName) {
                const { rows, stats } = csvPending;
                $("#csvImportTitle").textContent = `Import CSV — ${srcName || "podgląd"}`;
                const stat = (value, label, tone = "") => SafeDOM.el("div", { className: `stat ${tone}`.trim() }, [
                    SafeDOM.el("div", { className: "v", text: value }), SafeDOM.el("div", { className: "l", text: label })
                ]);
                SafeDOM.replace($("#csvStats"), [
                    stat(stats.nNew, "nowych adresów", "ok"), stat(stats.nDup, "duplikatów", "warn"),
                    stat(stats.nBad, "błędnych", "err"), stat(`+${stats.newSections} / +${stats.newGroups}`, "sekcje / grupy")
                ]);
                const table = SafeDOM.el("table");
                const head = SafeDOM.el("thead", {}, SafeDOM.el("tr", {}, ["Status", "Sekcja", "Grupa", "E-mail", "Uwagi"].map(text => SafeDOM.el("th", { text }))));
                const body = SafeDOM.el("tbody");
                rows.slice(0, 200).forEach(row => {
                    const label = row.status === "new" ? "Nowy" : row.status === "dup" ? "Dup" : "Błąd";
                    body.append(SafeDOM.el("tr", { className: row.status }, [
                        SafeDOM.el("td", {}, SafeDOM.el("span", { className: `row-tag ${row.status}`, text: label })),
                        SafeDOM.el("td", { text: row.section }), SafeDOM.el("td", { text: row.group }),
                        SafeDOM.el("td", { text: row.email }), SafeDOM.el("td", { text: row.reason || "", style: { color: "var(--text-mute)", "font-size": "12px" } })
                    ]));
                });
                table.append(head, body);
                SafeDOM.replace($("#csvPreview"), [table, rows.length > 200 ? SafeDOM.el("p", {
                    text: `…i ${rows.length - 200} więcej (zostaną zaimportowane).`,
                    style: { color: "var(--text-mute)", "font-size": "12px", margin: "8px 0 0" }
                }) : null]);
                $("#csvImportApply").disabled = stats.nNew === 0;
                $("#csvImportApply").textContent = stats.nNew ? `Zaimportuj (${stats.nNew})` : "Brak nowych do importu";
            }(srcName), showModal("csvImportModal");
        }(String(reader.result || ""), file.name), reader.readAsText(file, "utf-8");
    }(f), e.target.value = "";
}, { owner: "csv-import", key: "file-change" }), EventLifecycle.on($("#csvImportApply"), "click", function() {
    if (!csvPending) return;
    const {rows: rows} = csvPending, secMap = new Map(runtimeData.sections.map(s => [ s.name, s ]));
    let added = 0;
    for (const r of rows) {
        if ("new" !== r.status) continue;
        let sec = secMap.get(r.section);
        sec || (sec = {
            name: r.section,
            groups: []
        }, runtimeData.sections.push(sec), secMap.set(r.section, sec));
        let grp = sec.groups.find(g => g.name === r.group);
        grp || (grp = {
            name: r.group,
            emails: []
        }, sec.groups.push(grp)), grp.emails.push(r.email), added++;
    }
    persistData(), rerenderAllFromData(), closeModal(), csvPending = null, toast(`Zaimportowano ${added} adresów.`);
}, { owner: "csv-import", key: "apply" });
