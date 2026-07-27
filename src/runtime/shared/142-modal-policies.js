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
        }
    });
    document.documentElement.classList.add("app-shell-overflow-guard");})();
