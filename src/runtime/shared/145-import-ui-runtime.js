(() => {
    "use strict";
    AppDialog = Object.freeze({
        editText(options = {}) {
            const id = options.id || "appEditTextModal";
            let modal = document.getElementById(id);
            modal || (modal = document.createElement("div"), modal.className = "modal", modal.id = id, 
            modal.setAttribute("role", "dialog"), document.getElementById("overlay")?.appendChild(modal));
            const titleId = `${id}Title`, descId = `${id}Desc`, inputId = `${id}Input`;
            modal.setAttribute("aria-labelledby", titleId);
            modal.setAttribute("aria-describedby", descId);
            const title = SafeDOM.el("h3", { text: options.title || "Edytuj", attrs: { id: titleId } });
            const close = SafeDOM.el("button", { className: "icon-btn x", text: "✕", attrs: { type: "button", "data-dialog-cancel": "", "aria-label": "Zamknij" } });
            const textarea = SafeDOM.el("textarea", { value: options.value || "", attrs: { id: inputId, "data-modal-focus-entry": "", maxlength: Number(options.maxLength) || 1000 } });
            SafeDOM.replace(modal, [
                SafeDOM.el("div", { className: "modal-h" }, [title, close]),
                SafeDOM.el("div", { className: "modal-b" }, [SafeDOM.el("p", { className: "modal-description", text: options.description || "Wprowadź wartość.", attrs: { id: descId } }), SafeDOM.el("div", { className: "field" }, [SafeDOM.el("label", { text: options.label || "Wartość", attrs: { for: inputId } }), textarea, SafeDOM.el("div", { className: "field-info", attrs: { "data-dialog-error": "", "aria-live": "polite" } })])]),
                SafeDOM.el("div", { className: "modal-f" }, [SafeDOM.el("button", { className: "btn ghost", text: "Anuluj", attrs: { type: "button", "data-dialog-cancel": "" } }), SafeDOM.el("button", { className: "btn primary", text: options.confirmLabel || "Zapisz", attrs: { type: "button", "data-dialog-confirm": "" } })])
            ]);
            return new Promise(resolve => {
                let settled = !1;
                const finish = value => {
                    settled || (settled = !0, UIRuntime?.close(id), resolve(value));
                };
                modal.querySelectorAll("[data-dialog-cancel]").forEach(btn => btn.addEventListener("click", () => finish(null), {
                    once: !0
                })), modal.querySelector("[data-dialog-confirm]")?.addEventListener("click", () => {
                    const input = modal.querySelector(`#${CSS.escape(inputId)}`), value = input?.value ?? "";
                    if (!1 !== options.required && !value.trim()) return modal.querySelector("[data-dialog-error]").textContent = "Pole nie może być puste.", 
                    void input?.focus();
                    finish(value);
                }, {
                    once: !0
                }), modal.addEventListener("keydown", e => {
                    (e.ctrlKey || e.metaKey) && "Enter" === e.key && (e.preventDefault(), e.stopPropagation(), modal.querySelector("[data-dialog-confirm]")?.click());
                }, {
                    once: !0
                }), UIRuntime?.open("modal", id, {
                    outsideClick: !1,
                    closeOnEscape: !0,
                    onClose: () => finish(null)
                }), requestAnimationFrame(() => modal.querySelector(`#${CSS.escape(inputId)}`)?.focus());
            });
        }
    });
})();
