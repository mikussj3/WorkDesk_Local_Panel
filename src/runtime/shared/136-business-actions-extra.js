!function() {
    const defs = {
        delay: ["Opóźnienie", "Informujemy, że dla {{unit}} występuje opóźnienie realizacji. Przewidywana godzina: {{time}}."],
        pickup: ["Zmiana godziny odbioru", "Odbiór dla {{unit}} w dniu {{date}} odbędzie się o godzinie {{time}}."],
        cancel: ["Anulowanie trasy", "Informujemy o anulowaniu trasy dla {{unit}} w dniu {{date}}."],
        docs: ["Prośba o dokumenty", "Prosimy {{unit}} o przesłanie wymaganych dokumentów do dnia {{date}}."],
        failure: ["Awaria systemu", "Z powodu awarii systemu mogą wystąpić opóźnienia dotyczące {{unit}}."]
    };
    function build() { const definition = defs[$("#mgType").value]; const unit = $("#mgUnit").value.trim() || "wskazanego oddziału"; return definition[1].replaceAll("{{date}}", $("#mgDate").value || dateKeyLocal(new Date())).replaceAll("{{time}}", $("#mgTime").value || "do uzupełnienia").replaceAll("{{unit}}", unit); }
    function ensureModal() {
        let modal = $("#messageGenModal"); if (modal) return modal;
        modal = document.createElement("div"); modal.className = "modal"; modal.id = "messageGenModal"; modal.hidden = true;
        modal.innerHTML = '<div class="modal-h"><h3>Generator komunikatów</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="form-grid"><div class="field"><label>Typ</label><select id="mgType"></select></div><div class="field"><label>Data</label><input id="mgDate" type="date"></div><div class="field"><label>Godzina</label><input id="mgTime" type="time"></div><div class="field"><label>Oddział / adresat</label><input id="mgUnit" maxlength="300"></div><div class="field"><label>Podgląd</label><textarea id="mgPreview" readonly></textarea></div><button type="button" class="btn primary" id="mgBuild">Utwórz wiadomość</button></div></div>';
        $("#overlay").appendChild(modal); SafeDOM.replace($("#mgType"), Object.entries(defs).map(([key, value]) => SafeDOM.el("option", { text: value[0], attrs: { value: key } })));
        const preview = () => $("#mgPreview").value = build();
        ["mgType","mgDate","mgTime","mgUnit"].forEach(id => bindEvent($("#" + id), "input", preview));
        bindEvent($("#mgBuild"), "click", async () => {
            if (!$("#mgUnit").value.trim() && !await showConfirmModal("Nie podano oddziału/adresata. Kontynuować?", { confirmLabel: "Kontynuuj", danger: false })) return;
            emailEl.classList.contains("expanded") || toggleEmail();
            const subject = defs[$("#mgType").value][0] + ($("#mgUnit").value ? " — " + $("#mgUnit").value : "");
            EmailComposerState.update({ subject, body: build() }); scheduleDraftSave(); recordRecentAction?.("message.generated", subject); closeModal(); toast("Utworzono komunikat.");
        });
        return modal;
    }
    BusinessActions.register({ id: "messageGenerator", label: "Generator komunikatów", className: "btn sm primary", run() { ensureModal(); $("#mgDate").value = dateKeyLocal(new Date()); $("#mgPreview").value = build(); showModal("messageGenModal"); } });
}(), function() {
    function resetFormMode() {
        const addButton = $("#prAdd");
        if (!addButton) return;
        $("#prTitle").value = ""; $("#prCategory").value = ""; $("#prText").value = "";
        delete addButton.dataset.edit; addButton.textContent = "Dodaj"; $("#prCancel").hidden = true;
    }
    function ensureModal() {
        let modal = $("#proceduresModal"); if (modal) return modal;
        modal = document.createElement("div"); modal.className = "modal lg"; modal.id = "proceduresModal"; modal.hidden = true;
        modal.innerHTML = '<div class="modal-h"><h3>Procedury</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="business-tools"><input id="prTitle" class="business-input" maxlength="300" placeholder="Tytuł"><input id="prCategory" class="business-input" maxlength="120" placeholder="Kategoria"><textarea id="prText" class="business-input" maxlength="20000" placeholder="Opis / kroki, każdy krok w osobnym wierszu"></textarea><button type="button" id="prAdd" class="btn primary">Dodaj</button><button type="button" id="prCancel" class="btn ghost" hidden>Anuluj edycję</button><input id="prSearch" class="business-input" placeholder="Szukaj"></div><div id="prList" class="business-list"></div></div>';
        $("#overlay").appendChild(modal);
        bindEvent($("#prSearch"), "input", render);
        bindEvent($("#prCancel"), "click", resetFormMode);
        bindEvent(modal, "click", event => { if (event.target.closest("[data-close]")) resetFormMode(); });
        bindEvent($("#prAdd"), "click", () => {
            const title = $("#prTitle").value.trim(); const body = $("#prText").value.trim(); const category = $("#prCategory").value.trim();
            if (!title || !body) return toast("Podaj tytuł i opis.", "err");
            const editId = $("#prAdd").dataset.edit;
            if (editId) { AppServices.procedures.update(editId, { title, body, category }); toast("Zaktualizowano procedurę."); }
            else { if (ensureAppState().modules.procedures.length >= 300) return toast("Osiągnięto limit 300 procedur.", "err"); AppServices.procedures.create({ title, body, category, pinned: false }); toast("Dodano procedurę."); }
            resetFormMode(); render();
        });
        delegateEvent($("#prList"), "click", "[data-copy-pr],[data-del-pr],[data-pin-pr],[data-edit-pr]", async (event, button) => {
            const id = button.dataset.copyPr || button.dataset.delPr || button.dataset.pinPr || button.dataset.editPr;
            const record = requireBusinessRecord("procedures", id); if (!record) return;
            if (button.dataset.copyPr) { const copied = await copyToClipboard(record.body); toast(copied ? "Skopiowano procedurę." : "Nie udało się skopiować procedury.", copied ? "ok" : "err"); return; }
            if (button.dataset.delPr) { if (await showConfirmModal(`Usunąć procedurę „${record.title}”?`, { confirmLabel: "Usuń" })) { const snapshot = AppServices.procedures.remove(record.id); if ($("#prAdd").dataset.edit === record.id) resetFormMode(); snapshot && offerUndo(`undo-procedure-${record.id}`, "Usunięto procedurę", `Usunięto „${record.title}”.`, () => AppServices.procedures.restore(snapshot)); } return; }
            if (button.dataset.pinPr) { AppServices.procedures.togglePinned(record.id); render(); toast(record.pinned ? "Odpięto procedurę." : "Przypięto procedurę."); return; }
            $("#prTitle").value = record.title; $("#prCategory").value = record.category; $("#prText").value = record.body; $("#prAdd").dataset.edit = record.id; $("#prAdd").textContent = "Zapisz"; $("#prCancel").hidden = false;
        });
        return modal;
    }
    function render() {
        ensureModal(); const query = ($("#prSearch")?.value || "").toLowerCase();
        const rows = ensureAppState().modules.procedures.filter(item => `${item.title} ${item.body} ${item.category}`.toLowerCase().includes(query)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt));
        SafeDOM.replace($("#prList"), rows.length ? rows.map(item => SafeDOM.el("div", { className: "business-card", dataset: { businessRecordId: item.id } }, [
            SafeDOM.el("div", { className: "business-row" }, [SafeDOM.el("div", {}, [SafeDOM.el("h4", { text: `${item.pinned ? "📌 " : ""}${item.title}` }), SafeDOM.el("div", { className: "business-meta", text: `${item.category || "bez kategorii"} · zmiana ${new Date(item.updatedAt || item.createdAt).toLocaleString("pl-PL")}` })]), SafeDOM.el("div", { className: "actions" }, [
                SafeDOM.el("button", { className: "btn sm", text: item.pinned ? "Odepnij" : "Przypnij", attrs: { type: "button" }, dataset: { pinPr: item.id } }),
                SafeDOM.el("button", { className: "btn sm", text: "Edytuj", attrs: { type: "button" }, dataset: { editPr: item.id } }),
                SafeDOM.el("button", { className: "btn sm", text: "Kopiuj", attrs: { type: "button" }, dataset: { copyPr: item.id } }),
                SafeDOM.el("button", { className: "btn sm danger", text: "Usuń", attrs: { type: "button" }, dataset: { delPr: item.id } })
            ])]), SafeDOM.el("div", { className: "text-prewrap", text: item.body })
        ])) : SafeDOM.empty("business-empty", "Brak procedur."));
    }
    renderProceduresModule = render;
    BusinessActions.register({ id: "procedures", label: "Procedury", run() { ensureModal(); resetFormMode(); ModuleRegistry.get("procedures").render(); showModal("proceduresModal"); } });
}(), function() {
    const beforePreferences = JSON.stringify(ensureAppState().modules.preferences || {}), normalizedPreferences = normalizePreferences(ensureAppState().modules.preferences);
    ensureAppState().modules.preferences = normalizedPreferences, JSON.stringify(normalizedPreferences) !== beforePreferences && requestFullSnapshot(), 
    BusinessActions.render();
}();
