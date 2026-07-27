(() => {
    const result = (ok, details = {}) => ({
        status: ok ? "PASS" : "FAIL",
        ok: !!ok,
        details
    });
    const ClipboardFeedback = Object.freeze({
        async copy(value, {success: success = "Skopiowano do schowka.", empty: empty = "Brak wartości do skopiowania.", error: error = "Nie udało się skopiować."} = {}) {
            const text = String(value ?? "");
            if (!text) return toast(empty, "err"), result(!1, {
                reason: "empty"
            });
            try {
                const ok = await copyToClipboard(text);
                return toast(ok ? success : error, ok ? "ok" : "err"), result(ok, {
                    length: text.length
                });
            } catch (err) {
                return toast(error, "err"), result(!1, {
                    error: String(err?.message || err)
                });
            }
        }
    });
    
    const ToolContracts = {
        validateText(value, {required: required = !1, max: max = 5e4, label: label = "Wartość"} = {}) {
            const text = String(value ?? "");
            return required && !text.trim() ? result(!1, {
                error: `${label}: pole jest wymagane.`
            }) : text.length > max ? result(!1, {
                error: `${label}: przekroczono limit ${max} znaków.`
            }) : result(!0, {
                value: text
            });
        },
        password(options = {}) {
            const len = Number(options.length);
            return !Number.isInteger(len) || len < 8 || len > 128 ? result(!1, {
                error: "Długość hasła musi mieścić się w zakresie 8–128."
            }) : result(!0, {
                length: len
            });
        },
        id: value => result("string" == typeof value && value.length > 0, {
            value: value
        }),
        qr(value) {
            return this.validateText(value, {
                required: !0,
                max: 2048,
                label: "QR"
            });
        },
        fx(value) {
            const n = Number(String(value).replace(",", "."));
            return result(Number.isFinite(n), Number.isFinite(n) ? {
                value: n
            } : {
                error: "Podaj poprawną liczbę."
            });
        },
        date(value) {
            const d = new Date(value);
            return result(!Number.isNaN(d.getTime()), Number.isNaN(d.getTime()) ? {
                error: "Niepoprawna data."
            } : {
                value: d.toISOString()
            });
        }
    };
    Object.freeze(ToolContracts);})();
