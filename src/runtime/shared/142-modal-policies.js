(() => {
    const ALLOWED_SCROLL_CONTAINERS = Object.freeze([ {
        selector: ".modal-b",
        reason: "główna przewijalna treść modalu"
    }, {
        selector: ".cmd-list",
        reason: "wyniki command palette"
    }, {
        selector: ".csv-preview,.scroll-container--modal-preview",
        reason: "ograniczony preview w modalu"
    }, {
        selector: ".code-block,.scroll-container--diagnostic",
        reason: "diagnostyka i logi"
    } ]);
    
    MODAL_POLICIES = Object.freeze({
        cmdModal: {
            description: "Wyszukaj i uruchom jedną akcję. Escape zamyka wyłącznie paletę.",
            outsideClick: !0,
            focus: "#cmdQuery"
        },
        quickActionsModal: {
            description: "Najczęściej używane operacje dostępne z jednego miejsca.",
            outsideClick: !0,
            focus: "#qaTemplate"
        },
        recentActionsModal: {
            description: "Historia ostatnich operacji wykonanych w aplikacji.",
            outsideClick: !0,
            focus: "#recentActionsList button, #recentActionsList [tabindex]"
        },
        csvImportModal: {
            description: "Sprawdź podgląd danych przed zatwierdzeniem importu CSV.",
            outsideClick: !1,
            focus: "#csvImportModal input, #csvImportModal button:not([data-close])"
        },
        backupModal: {
            description: "Zarządzaj lokalnymi punktami odzyskiwania danych.",
            outsideClick: !1,
            focus: "#backupNow"
        },
        storageCleanupModal: {
            description: "Zweryfikuj elementy przeznaczone do usunięcia przed zwolnieniem miejsca.",
            outsideClick: !1,
            focus: "#storageCleanupModal input, #storageCleanupApply"
        },
        storageLimitsModal: {
            description: "Ustaw limity rekordów i wykorzystania pamięci dla modułów.",
            outsideClick: !1,
            focus: "#storageLimitsModal input, #storageLimitsSave"
        },
        unifiedConfirmModal: {
            description: "Potwierdź operację albo anuluj. Kliknięcie w tło anuluje.",
            outsideClick: !0,
            focus: "#unifiedConfirmYes",
            priority: 95,
            contextCloseOthers: !1
        },
        phoneModal: {
            description: "Rejestr rozmów telefonicznych i powiązane sprawy.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        casesModal: {
            description: "Sprawy wymagające odpowiedzi wraz z powiązaniami.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        checklistsModal: {
            description: "Listy kontrolne powtarzalnych procedur.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        proceduresModal: {
            description: "Baza instrukcji i wiedzy operacyjnej.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        configModal: {
            description: "Ustawienia aplikacji: motyw, czas, limity i pulpity.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        tileEditModal: {
            description: "Edycja kafelka skrótu: nazwa, adres, tagi.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        emailProfilesModal: {
            description: "Profile nadawcze wiadomości e-mail.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        messageGenModal: {
            description: "Generator gotowych komunikatów na podstawie danych.",
            outsideClick: !1,
            focus: "[data-modal-focus-entry], input:not([type=hidden]), textarea, select"
        },
        reminderEditorModal: {
            description: "Edycja daty, godziny i treści przypomnienia.",
            outsideClick: !1,
            focus: "input[type=date]"
        },
        upcomingModal: {
            description: "Nadchodzące przypomnienia.",
            outsideClick: !0,
            focus: ".modal-f .btn, [data-close]"
        },
        contactQualityModal: {
            description: "Raport jakości danych kontaktowych.",
            outsideClick: !0,
            focus: ".modal-f .btn, [data-close]"
        },
        todoArchiveModal: {
            description: "Archiwum wykonanych zadań.",
            outsideClick: !0,
            focus: ".modal-f .btn, [data-close]"
        },
        infoDialogModal: {
            description: "Komunikat informacyjny.",
            outsideClick: !0,
            focus: ".modal-f .btn, [data-close]"
        }
    });
    document.documentElement.classList.add("app-shell-overflow-guard");})();
