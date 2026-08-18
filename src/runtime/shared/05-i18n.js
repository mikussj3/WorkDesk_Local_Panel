// Fundament i18n WorkDesk (Faza 4 audytu) — jedno miejsce na słownik interfejsu.
//
// UI pozostaje polskie; mechanizm jest gotowy na pakiet EN: wystarczy dodać
// drugi zamrożony słownik i przełączyć I18N_LANG. Zasada migracji (z audytu):
// nowe i zmieniane komunikaty używają t("klucz"), a nie literałów w kodzie.
// t() nigdy nie rzuca — brak klucza zwraca fallback albo sam klucz.

const I18N = Object.freeze({
    pl: Object.freeze({
        "confirm.title": "Potwierdź operację",
        "confirm.confirm": "Potwierdź",
        "confirm.cancel": "Anuluj",
        "storage.degraded.title": "Dane nie są zapisywane na dysk",
        "storage.degraded.message": "Przeglądarka zablokowała trwałą pamięć lokalną (tryb prywatny, limit pojemności lub polityka bezpieczeństwa). Bieżąca sesja pracuje na kopii ulotnej — wyeksportuj dane do pliku JSON.",
        "storage.degraded.export": "Eksportuj dane",
        "storage.blocked.title": "Zapis danych zablokowany",
        "storage.blocked.message": "Zapisany zestaw danych ma nieprawidłową strukturę. Skorzystaj z panelu Dane → Import, aby przywrócić kopię zapasową.",
        "storage.blocked.openData": "Otwórz panel Dane",
        "uierror.title": "Coś nie zadziałało",
        "uierror.message": "Aplikacja napotkała błąd. Zobacz szczegóły albo skopiuj opis do zgłoszenia.",
        "uierror.details": "Szczegóły",
        "uierror.copy": "Skopiuj do zgłoszenia"
    })
});

const I18N_LANG = "pl";

function t(key, fallback) {
    const pack = I18N[I18N_LANG];
    return pack && Object.prototype.hasOwnProperty.call(pack, key) ? pack[key] : void 0 !== fallback ? fallback : key;
}
