!function() {
    const DIRECTION_LABELS = { incoming: "Przychodzące", outgoing: "Wychodzące", missed: "Nieodebrane" };
    const STATUS_LABELS = { completed: "Zakończone", callback: "Oddzwonić", noAnswer: "Brak odpowiedzi" };
    function dateTimeLocalValue(timestamp) {
        const date = new Date(timestamp || Date.now());
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    }
    function resetFormMode() {
        const addButton = $("#phAdd");
        if (!addButton) return;
        ["phNumber", "phContact", "phOrganization", "phNote", "phDuration"].forEach(id => $("#" + id).value = "");
        $("#phAt").value = dateTimeLocalValue(Date.now());
        $("#phDirection").value = "outgoing";
        $("#phStatus").value = "completed";
        $("#phCallback").checked = false;
        delete addButton.dataset.edit;
        addButton.textContent = "Dodaj";
        $("#phCancel").hidden = true;
    }
    function syncCallbackState(source) {
        const status = $("#phStatus");
        const checkbox = $("#phCallback");
        if (source === "status") checkbox.checked = status.value === "callback";
        else if (checkbox.checked) status.value = "callback";
        else if (status.value === "callback") status.value = "completed";
    }
    function ensureModal() {
        let modal = $("#phoneModal");
        if (modal) return modal;
        modal = document.createElement("div");
        modal.className = "modal lg";
        modal.id = "phoneModal";
        modal.hidden = true;
        modal.innerHTML = '<div class="modal-h"><h3>Rejestr połączeń</h3><button type="button" class="icon-btn x" data-close aria-label="Zamknij">✕</button></div><div class="modal-b"><div class="business-tools"><input id="phNumber" class="business-input" maxlength="60" inputmode="tel" placeholder="Numer telefonu"><input id="phContact" class="business-input" maxlength="300" placeholder="Osoba / kontakt"><input id="phOrganization" class="business-input" maxlength="300" placeholder="Organizacja / oddział"><input id="phAt" class="business-input" type="datetime-local"><select id="phDirection" class="business-input"><option value="outgoing">Wychodzące</option><option value="incoming">Przychodzące</option><option value="missed">Nieodebrane</option></select><select id="phStatus" class="business-input"><option value="completed">Zakończone</option><option value="callback">Oddzwonić</option><option value="noAnswer">Brak odpowiedzi</option></select><input id="phDuration" class="business-input" type="number" min="0" max="1440" placeholder="Czas (min)"><label class="checkbox"><input id="phCallback" type="checkbox"> Wymaga oddzwonienia</label><textarea id="phNote" class="business-input" maxlength="5000" placeholder="Notatka"></textarea><button type="button" id="phAdd" class="btn primary">Dodaj</button><button type="button" id="phCancel" class="btn ghost" hidden>Anuluj edycję</button><button type="button" id="phCsv" class="btn">CSV</button><select id="phFilter" class="business-input"><option value="all">Wszystkie</option><option value="callback">Do oddzwonienia</option><option value="incoming">Przychodzące</option><option value="outgoing">Wychodzące</option><option value="missed">Nieodebrane</option></select><input id="phSearch" class="business-input" placeholder="Szukaj"></div><div id="phList" class="business-list"></div></div>';
        $("#overlay").appendChild(modal);
        bindEvent($("#phSearch"), "input", render);
        bindEvent($("#phFilter"), "change", render);
        bindEvent($("#phStatus"), "change", () => syncCallbackState("status"));
        bindEvent($("#phCallback"), "change", () => syncCallbackState("checkbox"));
        bindEvent($("#phCancel"), "click", resetFormMode);
        bindEvent(modal, "click", event => { if (event.target.closest("[data-close]")) resetFormMode(); });
        bindEvent($("#phAdd"), "click", async () => {
            const phoneNumber = $("#phNumber").value.trim();
            const contactName = $("#phContact").value.trim();
            const organization = $("#phOrganization").value.trim();
            const note = $("#phNote").value.trim();
            if (!phoneNumber && !contactName && !organization && !note) return toast("Podaj numer, kontakt, organizację lub notatkę.", "err");
            syncCallbackState("checkbox");
            const atValue = Date.parse($("#phAt").value);
            const payload = {
                phoneNumber,
                contactName,
                organization,
                direction: $("#phDirection").value,
                status: $("#phStatus").value,
                durationSec: Math.max(0, Number($("#phDuration").value || 0) * 60),
                callbackRequired: $("#phCallback").checked,
                note,
                at: Number.isFinite(atValue) ? atValue : Date.now()
            };
            const editId = $("#phAdd").dataset.edit;
            if (editId) {
                AppServices.phoneLog.update(editId, payload);
                toast("Zaktualizowano wpis telefonu.");
            } else {
                if (ensureAppState().modules.phoneLog.length >= 500 && !await showConfirmModal("Limit 500 wpisów. Usunąć najstarszy i dodać nowy?", { confirmLabel: "Usuń najstarszy" })) return;
                if (ensureAppState().modules.phoneLog.length >= 500) AppServices.phoneLog.removeOldest();
                AppServices.phoneLog.create(payload);
                toast("Dodano wpis telefonu.");
            }
            resetFormMode();
            render();
        });
        bindEvent($("#phCsv"), "click", () => downloadText(`workdesk-phone-${dateKeyLocal(new Date())}.csv`, "Data;Numer;Kontakt;Organizacja;Kierunek;Status;Czas sekund;Oddzwonić;Notatka\n" + ensureAppState().modules.phoneLog.map(item => [new Date(item.at).toISOString(), item.phoneNumber, item.contactName, item.organization, DIRECTION_LABELS[item.direction], STATUS_LABELS[item.status], item.durationSec, item.callbackRequired ? "TAK" : "NIE", item.note].map(value => csvEscape(csvSafeCell(value))).join(";")).join("\n"), "text/csv"));
        delegateEvent($("#phList"), "click", "[data-del-ph],[data-edit-ph],[data-copy-phone],[data-call-phone],[data-phone-case]", async (event, button) => {
            const id = button.dataset.delPh || button.dataset.editPh || button.dataset.copyPhone || button.dataset.callPhone || button.dataset.phoneCase;
            const record = requireBusinessRecord("phoneLog", id);
            if (!record) return;
            if (button.dataset.phoneCase) {
                const created = BusinessWorkflow.phoneToCase(record.id);
                if (!created) return toast("Nie udało się utworzyć sprawy.", "err");
                render();
                renderResponseCasesModule?.();
                toast("Utworzono powiązaną sprawę.");
                return;
            }
            if (button.dataset.copyPhone) {
                const copied = await copyToClipboard(record.phoneNumber);
                toast(copied ? "Skopiowano numer." : "Nie udało się skopiować numeru.", copied ? "ok" : "err");
                return;
            }
            if (button.dataset.callPhone) {
                if (!record.phoneNumber) return toast("Brak numeru telefonu.", "err");
                const phone = record.phoneNumber.replace(/[^+\d]/g, "");
                const link = document.createElement("a");
                link.href = `tel:${phone}`;
                link.target = "_blank";
                link.rel = "noopener";
                link.hidden = true;
                document.body.appendChild(link);
                link.click();
                link.remove();
                return;
            }
            if (button.dataset.editPh) { fillForm(record); return; }
            if (await showConfirmModal("Usunąć wpis telefonu?", { confirmLabel: "Usuń" })) {
                const snapshot = AppServices.phoneLog.remove(record.id);
                if ($("#phAdd").dataset.edit === record.id) resetFormMode();
                snapshot && offerUndo(`undo-phone-${record.id}`, "Usunięto wpis telefonu", `Usunięto wpis „${record.contactName || record.phoneNumber || "telefon"}”.`, () => AppServices.phoneLog.restore(snapshot));
            }
        });
        return modal;
    }
    function fillForm(record) {
        $("#phNumber").value = record.phoneNumber || "";
        $("#phContact").value = record.contactName || record.who || "";
        $("#phOrganization").value = record.organization || "";
        $("#phAt").value = dateTimeLocalValue(record.at);
        $("#phDirection").value = record.direction;
        $("#phStatus").value = record.status;
        $("#phDuration").value = Math.round((record.durationSec || 0) / 60) || "";
        $("#phCallback").checked = !!record.callbackRequired;
        $("#phNote").value = record.note || "";
        $("#phAdd").dataset.edit = record.id;
        $("#phAdd").textContent = "Zapisz";
        $("#phCancel").hidden = false;
    }
    function render() {
        ensureModal();
        const query = ($("#phSearch")?.value || "").toLowerCase();
        const filter = $("#phFilter")?.value || "all";
        const rows = ensureAppState().modules.phoneLog
            .filter(item => `${item.phoneNumber} ${item.contactName} ${item.organization} ${item.note}`.toLowerCase().includes(query))
            .filter(item => filter === "all" || (filter === "callback" ? item.callbackRequired : item.direction === filter))
            .sort((a, b) => Number(b.at) - Number(a.at));
        SafeDOM.replace($("#phList"), rows.length ? rows.map(item => {
            const details = [
                item.contactName,
                item.organization,
                new Date(item.at).toLocaleString("pl-PL"),
                DIRECTION_LABELS[item.direction],
                STATUS_LABELS[item.status],
                item.durationSec ? `${Math.round(item.durationSec / 60)} min` : "",
                item.callbackRequired ? "ODDZWONIĆ" : ""
            ].filter(Boolean).join(" · ");
            return SafeDOM.el("div", { className: "business-row" }, [
                SafeDOM.el("div", {}, [
                    SafeDOM.el("b", { text: item.phoneNumber || item.contactName || "Kontakt" }),
                    SafeDOM.el("div", { className: "business-meta", text: details }),
                    SafeDOM.el("div", { text: item.note }),
                    BusinessWorkflow.linksView(item, {moduleId: "phoneLog", recordId: item.id})
                ]),
                SafeDOM.el("div", { className: "actions" }, [
                    SafeDOM.el("button", { className: "btn sm", text: "Kopiuj numer", attrs: { type: "button", disabled: !item.phoneNumber }, dataset: { copyPhone: item.id } }),
                    SafeDOM.el("button", { className: "btn sm", text: "Zadzwoń", attrs: { type: "button", disabled: !item.phoneNumber }, dataset: { callPhone: item.id } }),
                    SafeDOM.el("button", { className: "btn sm", text: "Utwórz sprawę", attrs: { type: "button" }, dataset: { phoneCase: item.id } }),
                    SafeDOM.el("button", { className: "btn sm", text: "Edytuj", attrs: { type: "button" }, dataset: { editPh: item.id } }),
                    SafeDOM.el("button", { className: "btn sm danger", text: "Usuń", attrs: { type: "button" }, dataset: { delPh: item.id } })
                ])
            ]);
        }) : SafeDOM.empty("business-empty", "Brak wpisów telefonu."));
    }
    renderPhoneLogModule = render;
    BusinessActions.register({ id: "phoneLog", label: "Telefony", run() { ensureModal(); resetFormMode(); ModuleRegistry.get("phoneLog").render(); showModal("phoneModal"); } });
}();
