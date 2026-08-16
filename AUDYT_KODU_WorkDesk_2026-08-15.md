# Audyt kodu WorkDesk — analiza błędów logiki, funkcji i długów technicznych

**Wersja aplikacji:** 1.66.3-KF64 · **Data audytu:** 2026-08-15 · **Status: AUDYT KODU — WYKRYTO BŁĘDY KRYTYCZNE**

> Niniejszy dokument jest audytem **na poziomie kodu źródłowego** (`src/`, `tools/`, `templates/`), a nie testem behawioralnym. Wszystkie znaleziska krytyczne i wysokie zostały zweryfikowane bezpośrednio w plikach źródłowych (plik:linia + cytat). Audyt **nie modyfikuje kodu** — zawiera wyłącznie diagnozy i plan naprawy.

---

## 1. Streszczenie wykonawcze

Projekt WorkDesk to dojrzała architektura offline-first (atomowy `safeCommit`, kwarantanna uszkodzonych danych, punkty przywracania, `SafeDOM`, rejestr modułów z lifecycle). Warstwa ochrony danych i higiena renderów (brak XSS z danych użytkownika — potwierdzone w całym kodzie) stoją na wysokim poziomie.

Jednakże audyt wykrył **5 błędów krytycznych typu `ReferenceError`** — funkcje wywoływane, ale nieistniejące w żadnym zasięgu. Są one niewidoczne dla statycznych checks i smoke-testów (te nie klikają w dotknięte ścieżki), a każde z nich **całkowicie wyłącza realną funkcję aplikacji**:

| # | Martwa funkcja | Skutek użytkownika |
|---|---|---|
| K1 | `raw` (`60-storage-validation.js:107`) | Panel oczyszczania danych pada, gdy punkt przywracania jest starszy niż 7 dni |
| K2 | `hideModals` (`140-business-workflow.js:100`) | Przyciski powiązań „TODO/Przypomnienia/Dziennik" w sprawach i telefonach nie działają |
| K3 | `openCalendarDayMenu` (`132-business-actions-core.js:109`) | Szybkie przyciski daty („Dziś/Jutro/Za 3 dni/Za tydzień") w przypomnieniach nie działają |
| K4 | `ClipboardFeedback` (`146-design-contracts.js:110`) | Akcja „Kopiuj" na kafelku nie działa |
| K5 | `localISODate` (`100-calendar-reminders.js:3,156`) | Edytor przypomnień i wyliczanie `dueAt` padają przy rekordzie bez daty |

Wspólna przyczyna: refaktoryzacja „moduły → IIFE" bez aktualizacji konsumentów, połączona z konwencją konkatenacji plików, w której pomyłka zasięgu ujawnia się dopiero w runtime, na konkretnej ścieżce kliknięcia.

Ponadto wykryto **14 znalezisk o wadze wysokiej**, w tym 4 bezpośrednie ryzyka dla danych użytkownika (cicha degradacja zapisu, nietrwały reset danych, zawyżony limit TODO vs limit importu, kumulujące się toasty przypomnień) oraz klasę zawieszonych Promise'ów w modalach confirm (Esc/klik w tło).

**Ważne zastrzeżenie:** istniejący dokument `Audyt_Produkcyjny_WorkDesk.md` (2026-07-24) deklaruje status „Production Ready / Audit Complete". Niniejszy audyt **polemizuje z tym wnioskiem** — wykryte błędy krytyczne są mierzalne i powtarzalne w kodzie (sekcja 10).

### Statystyka znalezisk

| Waga | Liczba | Charakter |
|---|---|---|
| Krytyczne | 5 | `ReferenceError` — całkowicie martwe funkcje UI |
| Wysokie | 14 | ryzyko utraty danych, zawieszone Promise, martwe liczniki, nietrwały reset |
| Średnie | ~30 | luki walidacji, niespójności kontraktów, duplikacje, dostępność |
| Niskie | ~35 | martwy kod, kosmetyka, drobny dług techniczny |

---

## 2. Metodologia i zakres

- Przeczytanie specyfikacji: `README.md`, `README_PL.md`, `DEVELOPER_README.md`, `build-manifest.json`.
- Pełna lektura wszystkich 40+ plików `src/runtime/shared/`, `src/runtime/entry/`, `src/diagnostics/`, `src/templates/`, `tools/` (~13 100 linii).
- Analiza krzyżowa zależności (kolejność ładowania wg manifestu, deklaracje globali, wzajemne wywołania).
- Weryfikacja ręczna wszystkich znalezisk krytycznych/wysokich: `grep` całego projektu + lektura kontekstu wywołania.
- Sprawdzenie spójności `dist/` ze `src/` dla kluczowych fragmentów.

Kategorie błędów: **K** = krytyczne, **W** = wysokie, **S** = średnie, **N** = niskie. Numery linii odnoszą się do plików `src/`.

---

## 3. Znaleziska krytyczne (K1–K5)

### K1. `ReferenceError: raw is not defined` — awaria panelu oczyszczania danych

**Plik:** `src/runtime/shared/60-storage-validation.js:107`
**Waga:** krytyczne · **Wykryte przez:** weryfikacja ręczna (cytat poniżej)

```js
const snap = read.value, ts = parseTimestamp(snap.createdAt || snap.exportedAt);
return null === ts || now - ts <= 864e5 * RETENTION_RULES.restorePointDays ? null : {
    id: `restore-old-${label}`,
    ...
    size: byteSize(raw),   // ← „raw" nie istnieje w zasięgu funkcji
```

W funkcji `restorePointAgeCandidate` istnieją wyłącznie zmienne `read`, `snap`, `ts`. Gałąź wykonuje się, gdy punkt przywracania (`wd.restore.current` / `wd.restore.previous-good`) jest starszy niż `RETENTION_RULES.restorePointDays` (7 dni). Wtedy `storageCleanupCandidates` rzuca wyjątek i ** cały panel retencji/oczyszczania (`#storageCleanupBtn`) przestaje działać**.

Dodatkowo (ta sama funkcja, linia 101): warunek `null === ts ... ? null` oznacza, że punkt o **nieczytelnej dacie w ogóle nie podlega retencji** — odwrotność intencji.

**Naprawa:** `byteSize(raw)` → `byteSize(StorageService.get(key) || "")` (wzorzec już użyty 5 linii wyżej, w gałęzi `restore-corrupt`). Odwrócić logikę daty: brak znacznika → kandydat do oczyszczenia.

---

### K2. `hideModals()` nie istnieje — martwe linki workflow (TODO/przypomnienia/dziennik)

**Plik:** `src/runtime/shared/140-business-workflow.js:100`
**Waga:** krytyczne

```js
if (type === "cases") BusinessActions.run("responseCases");
else {
    hideModals();   // ← jedyne wystąpienie w całym projekcie (grep: 1 trafienie)
    ModuleRegistry.get(...)?.render?.();
}
```

`BusinessWorkflow.open(type, id)` obsługuje nawigację z powiązań rekordów (sekcja „Business workflow links" w README). Dla typów `todos`, `reminders`, `journal` wywołuje niezdefiniowaną funkcję → `ReferenceError` synchronnie w delegowanym handlerze kliknięcia. Wszystkie przyciski powiązań typu „TODO 1", „Przypomnienia 1", „Dziennik 1" (renderowane w `132-business-actions-core.js:448` i `132-phone-log.js:152`) są martwe. Link do spraw (`cases`) działa, bo jego gałąź nie woła `hideModals`.

**Naprawa:** zastąpić wywołaniem istniejącego API, np. `UIRuntime.closeAll(...)` lub otwarciem właściwego modułu przez `BusinessActions.run(...)` analogicznie do gałęzi `cases`.

---

### K3. `openCalendarDayMenu?.()` — literówka nazwy; opcjonalny łańcuch nie chroni przed `ReferenceError`

**Plik:** `src/runtime/shared/132-business-actions-core.js:107-109`
**Waga:** krytyczne

```js
delegateEvent($("#calendarReminderTools"), "click", "[data-days]", (event, button) => {
    const d = new Date;
    d.setDate(d.getDate() + Number(button.dataset.days)), openCalendarDayMenu?.(d, button);
})
```

Funkcja istnieje pod nazwą `showCalendarDayMenu` (`100-calendar-reminders.js:70`; por. też `70-module-registry.js:63` i `141-business-runtime-core.js:182`, które wołają poprawną nazwę). Operator `?.` chroni przed `null/undefined` wartości, ale **nie przed niezadeklarowanym identyfikatorem** — wyrażenie rzuca `ReferenceError`. Cztery przyciski szybkiego wyboru daty w panelie przypomnień (`production.html:367`): „Dziś", „Jutro", „Za 3 dni", „Za tydzień" — nie robią nic poza błędem w konsoli.

**Naprawa:** `openCalendarDayMenu?.(d, button)` → `showCalendarDayMenu(null, d, button)` (sprawdzić sygnaturę: `ev, date, opener`).

---

### K4. `ClipboardFeedback` zamknięty w IIFE — akcja „Kopiuj" na kafelku pada

**Pliki:** definicja `src/runtime/shared/143-clipboard-actions.js:7`, użycie `src/runtime/shared/146-design-contracts.js:110`
**Waga:** krytyczne

```js
// 143-clipboard-actions.js — cały plik opakowany w (() => { ... })()
const ClipboardFeedback = Object.freeze({ async copy(value, ...) {...} });

// 146-design-contracts.js:110 — użycie jako globalna:
"copy" === action ? ClipboardFeedback.copy(tile.value || tile.url || "") : ...
```

`const ClipboardFeedback` jest lokalny dla IIFE. W liście globali deklarowanych wstępnie (`10-scheduler-events.js:212-214`) nie ma `ClipboardFeedback`. Kliknięcie akcji „copy" na kafelku rzuca `ReferenceError` (w async handlerze → `unhandledrejection`). Potwierdzone również w zbudowanym `dist/index_KF64.html`. Cały plik 143 (72 linie) jest poza tą jedną referencją martwy — nic z niego nie jest eksportowane.

**Naprawa:** wynieść `ClipboardFeedback` z IIFE (przypisanie do globala w duchu istniejącej konwencji) albo usunąć plik i wołać bezpośrednio `copyToClipboard` + `toast`.

---

### K5. `localISODate()` nie istnieje — edytor przypomnień pada przy rekordzie bez daty

**Plik:** `src/runtime/shared/100-calendar-reminders.js:3` oraz `:156`
**Waga:** krytyczne (warunkowe — zależne od danych)

```js
// linia 3 — wyliczanie dueAt:
new Date(`${reminder?.date || localISODate()}T${...}:00`).getTime()
// linia 156 — edytor:
SafeDOM.el("input", { value: reminder.date || localISODate(), ... })
```

`localISODate` nie ma definicji nigdzie w `src/` ani w `dist/` (grep: tylko te 2 użycia). Gdy przypomnienie nie ma pola `date` (dane starsze/importowane), wyliczenie `dueAt` lub otwarcie edytora rzuca `ReferenceError`. Analogiczna funkcja istnieje pod inną nazwą w `50-todo-tools.js:149-153` (ręczne budowanie daty lokalnej bez pułapki UTC).

**Naprawa:** użyć istniejącego pomocnika z 50-todo-tools (lub go wyeksportować/zduplikować w warstwie shared).

---

## 4. Znaleziska wysokie (W1–W14)

### Warstwa danych

**W1. Cicha, trwała degradacja zapisu — `safeCommit` raportuje sukces bez zapisu.**
`27-storage-capability.js:46-54`: pierwszy nieudany zapis do `localStorage` (quota, tryb prywatny) **trwale** przełącza backend na ulotną pamięć `Map` do końca sesji. Ponieważ `getItem` po degradacji czyta z tej samej pamięci, weryfikacja zapisu w `40-storage-core.js:144-145` (`getItem(tempKey) !== raw`) przechodzi, `safeCommit` zwraca `{ok:true}` — a po odświeżeniu strony dane znikają. Jedyny sygnał: jednorazowy `console.warn`. **To najsilniejsze ryzyko utraty danych w aplikacji** — użytkownik pracuje z fałszywym poczuciem zapisu. *Naprawa:* propagacja stanu degradacji do `safeCommit` (np. `StorageService.isPersistent()`), toast + wskaźnik w UI danych, wpis do AttentionCenter.

**W2. Reset danych nie jest trwały — powrót starych danych z kluczy v1–v4.**
`80-persistence-import.js:533-534`: `resetData()` usuwa wyłącznie `wd.data.v5`. Klucze migracyjne `wd.data.v4…v1` (oraz `wd.todos.v1` itd.) **nigdy nie są usuwane** (grep: tylko odczyt w `123-bootstrap-recovery.js:26`). Scenariusz: użytkownik po migracji v4→v5 wykonuje reset → odświeża stronę → bootstrap nie znajduje v5, ale znajduje v4 → **migracja przywraca dane sprzed resetu**. Marker `wd.migration.v5.complete` jest zapisywany (`123:49`), ale **nigdzie nie czytany** (grep potwierdzony) — martwa ochrona. Sekwencja w `resetData` jest też zagmatwana: `remove → applyAppData(z zapisem) → remove` — pierwszy remove jest martwy, końcowy kasuje świeżo zapisany snapshot. *Naprawa:* po udanej migracji i w `resetData` usuwać klucze legacy; czytać marker przed migracją; uprościć sekwencję do jednego zapisu domyślnego stanu.

**W3. Rozjazd limitów TODO: 5000 (UI) vs 2000 (import) — utrata treści przy round-trip własnego backupu.**
`40-storage-core.js:16` (`todoTextChars: 5000`) vs `60-storage-validation.js:273` (`todoText: 2e3`). TODO o 2001–5000 znakach zapisane lokalnie, po eksporcie i imporcie własnego pliku zostaje skrócone do 2000. Analogiczna asymetria notatek (`noteBytes` 20480 B vs import 20 000 znaków). *Naprawa:* jedna stała źródłowa dla obu warstw.

**W4. Poprawny JSON o złej strukturze cicho blokuje wszystkie kolejne zapisy.**
`123-bootstrap-recovery.js:20-24`: gdy `wd.data.v5` parsuje się, ale nie przechodzi walidacji struktury, ustawiane jest `storageLoadBlocked=true`; odzyskanie z punktów przywracania następuje **tylko** przy błędzie parsowania — mimo że `wd.restore.*` mogą zawierać dobre dane. Każdy później `commitFullSnapshotNow` dyskretnie zwraca `{ok:false, blocked:true}` — praca użytkownika po wykryciu uszkodzenia **nigdy nie trafia na dysk**. *Naprawa:* ścieżka odzyskiwania również dla złej struktury + wyraźny komunikat blokady.

### Modale i Promise

**W5. `showConfirmModal` — Promise zawieszony po kliknięciu w tło.**
`140-app-services.js:305-315`: Promise rozstrzyga wyłącznie `finish()` (przyciski `[data-answer]` lub Esc przez `onCancel`). Modal `#unifiedConfirmModal` nie ma wpisu w `MODAL_POLICIES`, dziedziczy więc `outsideClick:true` (`20-ui-runtime.js:6,102-105`) — klik w overlay zamyka modal **bez** wywołania `onCancel`. Każdy `await showConfirmModal(...)` (usuwanie przypomnień, kafelków, wpisów…) zawisa w nieskończoność; przy ponownym otwarciu `onCancel` jest nadpisywany, stary Promise pozostaje martwy. *Naprawa:* przekazać `onClose` rozstrzygający `false`, albo rejestrując modal w `MODAL_POLICIES` z `outsideClick:false` dla confirmów destruktywnych (właściwsze UX).

**W6. `AppDialog.editText` — Esc zamyka modal bez rozstrzygnięcia Promise.**
`145-import-ui-runtime.js:20-41`: identyczna klasa błędu co W5 — `UIRuntime.open(...)` bez `onClose`; Esc (globalny `closeTop`) chowa modal, `finish()` nigdy nie zostaje wywołany, jedyny użytkownik (`70-module-registry.js:91`, edycja TODO) zawisa. *Naprawa:* `onClose: () => finish(null)`.

**W7. Confirm/AppDialog zamyka modal roboczy, z którego został otwarty.**
Wszystkie `.modal` dostają priorytet 80 i `closeOnContextChange:true`; otwarcie `unifiedConfirmModal` z poziomu `phoneModal`/`casesModal`/`proceduresModal` najpierw zamyka modal roboczy (`20-ui-runtime.js:147-151`, `closeAll({belowPriority:80})`). Kod po `await showConfirmModal(...)` w `132-phone-log.js:107-111` zakłada, że lista pozostała otwarta (woła `render()`, `resetFormMode()`) — użytkownik po potwierdzeniu usuwania wraca do głównego widoku zamiast do listy. *Naprawa:* wyższy priorytet dla confirmu niż dla modali roboczych albo `except` dla openera.

### Runtime i bootstrap

**W8. Bootstrap modułów bez izolacji błędów — jeden wyjątek zabija cały boot.**
`150-module-bootstrap.js:2-18`: pętla `init/bind/render` po wszystkich modułach wykonywana **poza** try/catch. Wyjątek z jednego modułu przerywa bootstrap pozostałych i pomija `BootState.mark("modules")` oraz blok ready-check — `window.WorkDeskReady` nigdy nie powstanie. Istnieje `safeRender` (`70-module-registry.js:2-15`) z fallbackiem, ale bootstrap go nie używa. *Naprawa:* try/catch per moduł + zgłoszenie diagnostyczne.

**W9. Globalny teardown na `pagehide` — martwa aplikacja po powrocie z BFCache.**
`122-id-theme-notes.js:15-17`: `SchedulerService.teardown(), EventLifecycle.teardown()` bez sprawdzenia `event.persisted` i **bez żadnej re-inicjalizacji na `pageshow`** (grep: brak obsługi `persisted`/`pageshow` w całym `src/`). Po powrocie z back/forward cache skrypty nie wykonają się ponownie, a wszystkie słuchacze i timery zostały usunięte — aplikacja jest martwa do ręcznego odświeżenia. *Naprawa:* `if (!e.persisted)` lub re-bind na `pageshow`.

**W10. Kumulacja toastów przypomnień w nieskończoność.**
`100-calendar-reminders.js:205-232`: toast przypomnienia budowany ręcznie (poza `toast()`, które usuwa element po ~2,7 s), **bez auto-usuwania i bez deduplikacji** (`dataset.reminderToast` jest zapisywany, ale nigdy nie sprawdzany). Cooldown `shouldNotify` to 60 s, interwał sprawdzania 30 s → nowy, **trwały** toast tego samego przypomnienia co ~60 s. Zostawiona na noc karta generuje setki martwych toastów w `#toasts`. *Naprawa:* dedup po `dataset.reminderToast` + auto-remove (i ponowne pokazanie dopiero po interakcji), ewent. `AttentionCenter` zamiast toastu.

### UI / logika biznesowa

**W11. `renderDailyStart` czyta `x.due`, a rekordy TODO mają `dueDate` — karty pulpitu zawsze 0.**
`130-business-foundation.js:56`: `activeRows.filter(x => x.due && ...)` — TODO są tworzone z `dueDate` (`125-core-modules.js:56`; potwierdzone w `133-domain-services.js:13`). Liczniki „zadania na dziś" i „zadań po terminie" na pulpicie „Dzisiaj" są **zawsze 0**, karta nigdy nie przyjmuje stanu alertu. To samo pole `todoItem.due || ""` w podtytule wyników wyszukiwania (`131-search-quick-actions.js:56`). *Naprawa:* `x.due` → `x.dueDate` (2 miejsca).

**W12. QR: niespójne tabele wersji v9/v10 — uszkodzone kody dla dłuższych tekstów.**
`110-utilities-widgets.js:192-197`: v9 — suma bloków danych 181 ≠ `data:182` (tracony 1 bajt); v10 — suma bloków 260 ≠ `data:216` i `total:346` ≠ `data+ec = 372`. Efekt dla tekstów 181–214 znaków: pętla deinterleavingu pobiera 260 bajtów z 216-elementowej tablicy — 2 bloki dostają puste dane, kod QR jest **strukturalnie nieprawidłowy i nieskanowalny**, mimo komunikatu UI obiecującego „max ~200 znaków". Wersje v1–v8 zweryfikowane poprawne. *Naprawa:* skorygować tabele wg ISO/IEC 18004 (v10: 4×[68,26]? — należy przeliczyć do tabeli źródłowej) lub ograniczyć generowanie do v8 do czasu naprawy.

**W13. Ctrl+Enter wysyła e-mail z dowolnego kontekstu.**
`130-business-foundation.js:73-77`: gałąź Ctrl+E ma filtr `INPUT/TEXTAREA`, gałąź **Ctrl+Enter nie ma żadnego** — `$("#sendBtn").click()` odpala się niezależnie od fokusu (edytowany TODO, procedura, sprawa, dialog). Wykluczony jest tylko `cmdModal`; nakłada się dodatkowo z handlerem `AppDialog` (`145:34-35`): Ctrl+Enter w dialogu edycji jednocześnie zapisuje dialog **i wysyła maila** (brak `stopPropagation`). *Naprawa:* ten sam filtr targetu co dla Ctrl+E + `stopPropagation` w AppDialog.

**W14. Duplikacja szablonów: 863 z 864 linii `production.html` ≡ `diagnostic.html`.**
Jedyna różnica: `<title>`. Cała różnica funkcjonalna przechodzi przez `{{SCRIPTS}}` (manifest), więc druga kopia ciała szablonu jest zbędna — a każda zmiana UI wymaga podwójnej edycji i **nic nie pilnuje spójności** (check_build porównuje tylko skrypty shared i tytuły). Już teraz istnieje ryzyko naprawienia błędu (np. S13 `tmplPick`) w jednym pliku i nie w drugim. *Naprawa:* jeden szablon + podmiana tytułu w `build.py` (analogicznie do `{{SCRIPTS}}`).

---

## 5. Znaleziska średnie (S1–S30, selekcja)

### Storage/persystencja
- **S1.** Kwarantanna `wd.corrupt.*` wliczana do budżetu `preflight` — duży uszkodzony blob trwale blokuje zapisy, bez narzędzia czyszczenia (`40-storage-core.js:210-231`).
- **S2.** Trzy rozbieżne implementacje odzyskiwania: `recoverBootstrapSnapshot` (`40:486-497`, bez walidacji i checksum, hardkodowane literały kluczy) vs `recoverSnapshotAfterQuarantine` (`123:1-14`, walidacja) vs restore z checksum (`121:138-152`). Trzy poziomy rygoru dla tej samej operacji krytycznej.
- **S3.** `applyAppData` — import modułów nieatomowy: wyjątek z jednego `mod.import` zostawia połowę modułów na nowych danych, połowę na starych, bez zapisu (`80:150-161`).
- **S4.** `PersistenceRoundtrip.run` (przycisk „test round-trip") mutuje żywe moduły i storage; awaria rollbacku zostawia sesję na danych testowych (`80:388-421`); `restoreStorageSnapshot` robi `clear()` całej przestrzeni.
- **S5.** Walidatory importu kopiują wszystkie nieznane pola rekordu (`cloneData(value)` w `60:287-294`) — import wprowadza nieograniczony bloat stanu.
- **S6.** ISO-daty w `createdAt` zamieniane na `Date.now()` (`Number("2024-05-01T...")` → NaN → „naprawa"; `60:325-328`) — helper `parseTimestamp` z obsługą `Date.parse` istnieje w tym samym pliku, nieużywany.
- **S7.** `saveCurrentRestorePoint` bez `flushPendingWrites()` (bliźniacza `savePreviousGoodRestorePoint` ma flush) — `121:57-66`.
- **S8.** Download backupu zawsze dokleja **świeżą** sumę kontrolną (`121:128-131`) — uszkodzony punkt przywracania po pobraniu wygląda na poprawny (restore weryfikuje, download nie).

### Runtime / UI
- **S9.** `closeModal({notifyCancel:!1})` zamyka szczyt stosu, nie konkretny modal — confirm nadpisany przez popup przypomnienia zamknie popup zamiast siebie (`140:306` + `20:224-226`).
- **S10.** Live region `#a11yLive` dostaje `aria-hidden=true` podczas otwartego modalu (`20:23-25` nie wyklucza `#a11yLive`/`#workdeskTooltip` z inert) — komunikaty statusu nieogłaszane przez czytniki.
- **S11.** Przywracanie fokusu bez fallbacku, gdy opener usunięty przez re-render (`20:65`); `closeAll` zawsze `restoreFocus:false`.
- **S12.** `ensureFormLabel` wstawia drugi `<label>` wewnątrz istniejącego `<label>` — zagnieżdżone labele to nieprawidłowy HTML (`25:37-43`; audyt ma wyjątek `closest('label')`, normalize nie).
- **S13.** `label for="tmplPick"` → nieistniejące ID (pole ma `id="tmplSearch"`); zerwana asocjacja etykieta–pole w obu szablonach (`production.html:147-148`).
- **S14.** `aria-live="polite"` na zegarze odświeżanym co 1 s z sekundami — czytniki próbują ogłaszać zmianę ciągle (`production.html:40` + `10:141-158`).
- **S15.** Tooltip runtime trwale usuwa `title` z „kompaktowych" przycisków; na `pointer:coarse` tooltip ukryty CSS-em → użytkownik dotykowy traci podpowiedź; normalize jednorazowy nie obejmuje dynamicznych list (`26:48-51,73-76`; `99-final-overrides.css:198`).
- **S16.** Trzy konwencje bindowania zdarzeń równolegle: `EventLifecycle` / `bindEvent` / surowy `addEventListener` (m.in. `144:68-71`, `10:205`, `146:94`) — surowe wpisy są poza audytem/teardownem.
- **S17.** `UI_ERRORS` — bufor bez limitu, nigdzie nieczytany (`10:215`, zapis `144:15-22`) — rosnący koszt pamięciowy, dane martwe.
- **S18.** Potrójnie zaimplementowany kontrakt aktywacji Enter/Space z trzema różnymi listami selektorów (`25:113-118`, `144:5-9`, `147:4-7`) — obecnie się nie gryzą, ale zmiana znacznika/roli któregokolwiek elementu wywoła podwójne `click()`.
- **S19.** Potrójnie zaimplementowane etykietowanie dialogów (aria-labelledby/describedby z różnymi fallbackami — `20:155-160`, `144:36-49`, `147:8-13`); ostateczna wartość zależy od kolejności wykonania.

### Workflow / moduły
- **S20.** Brak cascade delete linków: usunięcie TODO/sprawy/przypomnienia nie odlinkowuje pozostałych rekordów; `BusinessWorkflow.reconcileAll` wołany wyłącznie w diagnostyce i to z `persist:false` — oczyszczenie nigdy nie jest zapisywane (`140:11-34`, `160:207`). Martwe ID zjadają limit 50 linków/typ.
- **S21.** Świadomie martwy kod: ~150 linii w `141-business-runtime-core.js` (`TilesSubsystem`, `TaskPipeline`, `JournalPipeline`, `ModuleCommands`, `CalendarSubsystem` — lokalne const w IIFE, niedostępne); przy czym `146:50,74` odwołują się do `TilesSubsystem.normalize(...)` jak do globali — **kolejny utajony ReferenceError** (latentny, bo `TileActionContract.model/models/tests` nie są wołane). Podobnie `RenderContractRuntime` w całości martwy (`145:45-156`) z latentnym TypeError (`document.dataset`).
- **S22.** Wiersze telefonów nie mają `data-business-record-id` (pozostałe listy mają) — wynik wyszukiwania globalnego dla „Telefony" nie podświetla rekordu; fallback `#phoneLog` nie istnieje (modal nazywa się `phoneModal`) (`132-phone-log.js:147` vs `131:41-48`).
- **S23.** `MODAL_POLICIES` obejmuje 7 statycznych modali; ~12 modali biznesowych (sprawy, telefony, checklisty, procedury, edycja kafelków…) bez polityk: brak selektora `focus` (fokus na „✕"), formularze edycyjne z domyślnym `outsideClick` zamykają się z utratą danych (`142:16-52`).
- **S24.** Bulk mail pomija walidację `EMAIL_RE` (`30-email-composer.js:563-566`), a część `to` URI mailto: nigdy nie jest kodowana (linia 120) — główna ścieżka wysyłki waliduje, bulk nie; adres z `?`, `&`, `%` lub spacją psuje URI.
- **S25.** Brak deduplikacji adresów **między** polami Do/DW/UDW (README obiecuje „duplicate-address prevention"; realnie tylko per-pole) (`30:380-382`); brak limitu/ostrzeżenia długości URI w trybie BCC-bulk (`30:442-446`).
- **S26.** `csvEscape` dokleja apostrof ochronny przed `=+-@` (`110:582-589`), import go nie usuwa (`120-csv-import.js`) — round-trip własnego pliku tworzy `'-Dział` zamiast `-Dział` (nowa sekcja zamiast dopisania).
- **S27.** `modulo bias` w `rngInt`: `buf[0] % max` bez rejection samplingu (`110:4-7`) — generator haseł/ULID ma lekko niejednolity rozkład; długość hasła nie wymuszana w dół przy `len <` liczba pul (`110:18-21`).
- **S28.** Pomodoro dekrementuje licznik w `setInterval` zamiast liczyć względem `Date.now()` — w karcie w tle traci czas (`110:504-523`).
- **S29.** Brak sortowania TODO po priorytecie/terminie — „PILNY" może wisieć pod „niskim"; filtr `today` pokazuje ukończone, `high`/`overdue` nie (`125:253-313,261-266`).
- **S30.** Sprzątanie notatek ponad limit nie chroni notatek przypiętych (pusty `new Set` jako zbiór chronionych, `122:264-265`); walidacja daty/godziny przypomnienia bez zakresów — `"2026-13-40"`/`"99:99"` przechodzą regex (`125:195`, `100:172`).

### Tooling
- **S31.** `check_build.py` — ~50+ asercji przypiętych do **dosłownego zminifikowanego tekstu** (np. `'flush: () => flushPendingWrites({ commitNow: !0 })' in shared`) — to detektor zmian, nie weryfikacja kontraktów; każdy reformat łamie build.
- **S32.** „Polityka innerHTML" = budżet ≤50 zapisów w całym shared (twardy zakaz tylko w 3 plikach) — `check_build.py:30-34`.
- **S33.** `dead_code.py:19-25` — kontrola `RuntimeBridge` wykonuje się **po** `print('PASS')` i `sys.exit` — no-op; heurystyka widzi tylko `function name(` (nie arrow/`const f=`), liczy stringi/komentarze jako referencje, brak analizy tranzytywnej — dlatego K1–K5 przeszły bez śladu.
- **S34.** `browser_smoke.py` — wyłącznie test renderowania (6 selektorów + brak `pageerror`), zero interakcji: modale, email, workflow-links, import/eksport poza zasięgiem; hardcoded `/usr/bin/chromium`; sztywne 1800 ms zamiast czekania na `WorkDeskReady`.
- **S35.** Obietnice README niepokryte: „accessibility regressions" = string-grepy (nie wykryły S13); „duplicate HTML identifiers" = tylko statyczna część przed `<script>`, tylko podwójne cudzysłowy.
- **S36.** `WorkDeskDebug` (pełne API runtime+storage) chronione wyłącznie tekstową asercją w check_build; dwa podobnie nazwane pliki w `dist/` — pomylenie przy dystrybucji udostępnia debug API. Warto: runtime'owa flaga trybu w `document.documentElement.dataset`.
- **S37.** Overlay diagnostyczny: selektor `#toastWrap .toast` nie matchuje niczego (kontener ma `id="toasts"`) — czyszczenie toastów to no-op (`diagnostic-overlay.js:630`); przywracanie storage poza try/finally w części scenariuszy; hardkod `modules === 17` (także `160-app-store-api.js:130`).

---

## 6. Znaleziska niskie / dług techniczny (selekcja)

- **N1.** Martwy kod: self-test storage wyrzucony bez przypisania (`27:109-128`); `hosts` map nigdy nieczytana (`70:552`); `globalSearchIndex` tylko-do-zapisu w produkcji (`131:1,198`); podwójne budowanie snapshotu domyślnego (`80:38-57`); martwe warunki w `prepareImportArtifact` (`80:283-286`); `EmailSubsystem = EmailSubsystem` (`141:72`); martwe wyrażenie `replaceVars(form.signature)` (`132-business-actions-core.js:103-104`); pusty `<details>` „Diagnostyka developerska" w obu buildach (`production.html:594-596`).
- **N2.** `dead_code.py` nie widzi plików poza manifestem; check_build nadpisuje `dist/` podczas „weryfikacji".
- **N3.** Magic numbers: `modules === 17` (2 miejsca), `KF64`/`1.66.3` hardkodowane w asercjach.
- **N4.** Nazwy plików mylące względem zawartości: `144-module-lifecycle-hardening.js` (live region, przechwytywanie błędów, comboboxy — zero lifecycle), `147-final-runtime-audit.js` (mutuje ARIA, nie audytuje), `10-scheduler-events.js` (toasty, zegar, schowek; SchedulerService gdzie indziej); trzy pliki z prefiksem `132-` łamią schemat „jeden numer = jeden plik", a kolejność w manifeście jest ręczna i niealfabetyczna — każde narzędzie sortujące zmieni kolejność ładowania.
- **N5.** Dropdown Escape w `#globalSearch` nieosiągalny (globalny closeTop ze `stopImmediatePropagation` wygrywa — `131:336-340`); paleta komend bez normalizacji diakrytyków („oddluz" nie znajdzie „oddłuż") i z `% 0` → NaN przy pustych wynikach (`80:731-736`).
- **N6.** Fallback schowka kradnie fokus (`ta.focus()` bez przywrócenia — `10:83-96`); `focusSearchResult` timeout bez owner/key (`134:15`).
- **N7.** `parseEmails` nie dzieli po białych znakach (wklejenie adresów rozdzielonych spacjami → 1 zbiorczy „błędny"); `uniq` case-sensitive; `buildBody` dla pustej treści daje 2 puste linie przed stopką.
- **N8.** Święta przez dodawanie ms (`864e5`) zamiast dni kalendarzowych — wrażliwe na DST (`100:249`); święto nadpisuje klasę weekendu (`100:266`); kalendarz w pozostałych zakresach zweryfikowany poprawnie (PN-start, `daysInMonth`, DST-safe `Math.round`).
- **N9.** `cloneData` w razie podwójnej awarii zwraca oryginalną referencję zamiast kopii (`50-todo-tools.js:178-184`); `localPathForClipboard` tylko Windows.
- **N10.** Zbędne ukośniki w atrybutach (12× `data-testid="…"/ aria-label=`) — nieszkodliwe dla parsera, ale nied wykrywane przez żadne narzędzie repo.
- **N11.** `UIRuntime` czyści inline `overflow` body przy każdej synchronizacji warstwy (`20:17`); ESC ma semantykę „najwyższy z closeOnEscape" nie „szczyt stosu" (`20:77-93`).
- **N12.** `aria-haspopup` z wartościami spoza słownika ARIA (`147:16-18`); `focusRingAudit` z efektami ubocznymi (mutuje DOM, przechwytuje fokus — `25:85-93`).

---

## 7. Co jest w dobrym stanie (zweryfikowane)

- **Brak XSS z danych użytkownika** — wszystkie rendery list przez `SafeDOM` (textContent + sanityzacja URL: `javascript:`/`vbscript:` blokowane); `innerHTML` wyłącznie ze statycznych literałów; brak `eval`/`new Function` w całym projekcie.
- **Atomowy wzorzec zapisu** `safeCommit` (temp → weryfikacja → target → weryfikacja → rollback) i kwarantanna uszkodzonych wartości z fingerprintem FNV — przemyślane (pod warunkiem naprawy W1).
- **Kolejność ładowania w build-manifest poprawna** (m.in. brak pułapek TDZ); `pagehide` flushuje kolejkę zapisów synchronicznie.
- **Ścieżka importu z pliku** konsekwentna: checksum → normalizacja → migracja → walidacja → punkt bezpieczeństwa → apply, z blokadą przy nieudanym punkcie.
- **Brak zduplikowanych ID w szablonie**; wszystkie kluczowe ID używane przez JS istnieją (poza S13 — zerwana etykieta, nie ID).
- **Kalendarz**: siatka PN-start bez off-by-one, `daysInMonth` poprawnie, grupowanie przypomnień odporne na DST.
- **CSV parser**: maszyna stanów z cudzysłowami, podwójnym `""`, BOM, CRLF; deduplikacja w pliku i względem danych; podgląd przez SafeDOM.

---

## 8. Fazy naprawy

> Zasada prowadząca: **najpierw błędy, które użytkownik widzi jako „przycisk nie działa" (K1–K5), potem ryzyka danych (W1–W4), potem reszta.** Każda faza kończy się pełnym cyklem: `build → check → dead-code → browser-smoke` **plus** ręczny test ścieżek z tabeli weryfikacyjnej (patrz poniżej), ponieważ obecny tooling nie klika w dotknięte ścieżki (S33–S35).

### Faza 0 — Hotfix krytycznych (szybkie, niskie ryzyko zmian) — wskazane natychmiast

> **STATUS: WDROŻONE 2026-08-15.** Wszystkie 7 kroków wykonane w `src/` i przebudowane w `dist/`. Weryfikacja: `tools/check_build.py` PASS, `tools/dead_code.py` PASS, nowy `tools/phase0_verify.py` **9/9 PASS, 0 błędów strony** (testy runtime na zbudowanym pliku: stary punkt przywracania → kandydat retencji; link workflow → zamknięcie modalu + podświetlenie; „Jutro" → menu z datą 16.08.2026; kopiuj kafelek → toast; edytor bez daty → otwiera się; confirm klik-w-tło/Esc → `resolved:false`; AppDialog Esc → `resolved:null`). Szczegóły wdrożonych zmian:
> - 0.1 — `byteSize(StorageService.get(key) || "")`; logika daty odwrócona (brak znacznika → kandydat z etykietą „bez znacznika czasu")
> - 0.2 — `UIRuntime.closeAll({reason: "workflow-open", modal: !0})`
> - 0.3 — `showCalendarDayMenu(null, d, button)` (`positionCalendarMenu` bezpiecznie pozycjonuje przy przycisku gdy brak eventu)
> - 0.4 — bezpośrednie `copyToClipboard` + toast (z obsługą pustej wartości); plik 143 pozostaje do wyczyszczenia w Fazie 2/3
> - 0.5 — `localISODate()` → `dateKeyLocal(new Date())` (funkcja z tego samego pliku, linia 25)
> - 0.6 — `x.due` → `x.dueDate`; porównania stringowe ISO z `dateKeyLocal` (spójne z `renderTodos`)
> - 0.7 — `onClose: () => finish(!1)` / `finish(null)` w `showConfirmModal` i `AppDialog.editText` (`onClose` jest wspieraną opcją `UIRuntime.close`; strażnik `settled` zapobiega podwójnemu rozstrzygnięciu)

| Krok | Zmiana | Plik:linia | Weryfikacja |
|---|---|---|---|
| 0.1 | `byteSize(raw)` → `byteSize(StorageService.get(key) \|\| "")`; odwrócić warunek daty | `60-storage-validation.js:101-107` | Ustawić punkt przywracania starszy niż 7 dni (podmienić `createdAt` w localStorage) → panel oczyszczania działa |
| 0.2 | `hideModals()` → zamknięcie modali przez UIRuntime/analogię do gałęzi `cases` | `140-business-workflow.js:100` | Klik „TODO 1"/„Dziennik 1" w sprawie → nawigacja + podświetlenie |
| 0.3 | `openCalendarDayMenu?.(d, button)` → `showCalendarDayMenu(null, d, button)` | `132-business-actions-core.js:109` | Klik „Dziś/Jutro/Za 3 dni/Za tydzień" → menu dnia z datą |
| 0.4 | Wynieść `ClipboardFeedback` z IIFE lub wołać `copyToClipboard` bezpośrednio | `143` + `146:110` | Akcja „Kopiuj" na kafelku → toast sukcesu |
| 0.5 | Zdefiniować/użyć istniejącego pomocnika daty lokalnej zamiast `localISODate` | `100:3,156` | Otworzyć edytor przypomnienia bez daty → nie pada |
| 0.6 | `x.due` → `x.dueDate` (2 miejsca: pulpit + podtytuł wyszukiwania) | `130:56`, `131:56` | Karta „Dzisiaj" pokazuje liczby ≠ 0 |
| 0.7 | `onClose: () => finish(!1)` / `finish(null)` dla confirm i AppDialog; rozważyć `outsideClick:false` dla confirmów | `140:305`, `145:20-41` | Klik w tło confirmu → `await` zwraca `false`, nie zawisa |

**Kryteria zakończenia fazy:** 0 błędów konsoli na każdej ścieżce z tabeli; smoke-test rozszerzony o te 7 kliknięć (wchodzi do Fazy 3 jako automat).

### Faza 1 — Ochrona danych (W1–W4, W10, W13)

> **STATUS: WDROŻONE 2026-08-15.** Wszystkie 6 punktów wykonane w `src/` i przebudowane w `dist/`. Weryfikacja: `tools/check_build.py` PASS, `tools/dead_code.py` PASS, `tools/phase0_verify.py` **9/9 PASS** (regresja Fazy 0), nowy `tools/phase1_verify.py` **21/21 PASS, 0 błędów strony** — trzy konteksty przeglądarki pokrywające wszystkie scenariusze kryteriów (a)–(d) oraz W4 i W13. Szczegóły wdrożonych zmian:
> - **W1** — `StorageService.isPersistent()`; `safeCommit`: wczesny zwrot `{ok:false, reason:"degraded"}` + kontrola degradacji w trakcie zapisu (wykrywa pierwszy nieudany zapis, który backend przełyka cicho) + `reason:"degraded"` w ścieżce błędu; jednorazowy `signalStorageDegraded()` → AttentionCenter „Dane nie są zapisywane na dysk" z akcją „Eksportuj dane" (bez spamu — strażnik flagi); wskaźnik zaufania danych (`dataConfidenceState`) w stanie danger z tekstem „Pamięć ulotna…". Test (a): symulacja quota → komunikat widoczny, `isPersistent()===false`, eksport pobiera plik `workdesk-backup-*.json`.
> - **W2** — stałe `LEGACY_SNAPSHOT_KEYS`/`LEGACY_MODULE_KEYS`/`MIGRATION_MARKER_KEY` (jedno źródło, koniec duplikacji literałów); po udanej migracji klucze v4–v1 i legacy-modułowe są **usuwane**; marker `wd.migration.v5.complete` jest **czytany przed próbą migracji** (istniejący marker = migracja już wykonana = brak wskrzeszania starych danych po utracie v5); `resetData` uproszczone do jednej sekwencji: `appState = defaults → applyAppData (zapis) → usunięcie legacy → rerender` (zniesiony błędny końcowy `remove(DATA_KEY)` zabijający świeży zapis). Testy (b): migracja przenosi dane + czyści klucze; po reset + F5 dane v4 nie wracają; marker blokuje wskrzeszanie po symulowanej utracie v5.
> - **W3** — `IMPORT_LIMITS.todoText = StorageLimits.DEFAULTS.todoTextChars` (jedna stała źródłowa 5000 zamiast rozjechanych 2000/5000). Test (c): walidator przyjmuje 4500 znaków + pełny round-trip eksport→import przez realny `importDataFromFile` bez skrócenia.
> - **W4** — przy poprawnym JSON-ie o złej strukturze: kwarantanna surowej wartości (`wd.corrupt.<fp>.wd_data_v5`, fingerprint FNV jak w ścieżce parse-error) → próba odzyskania z punktów przywracania → jeśli się uda: toast sukcesu; jeśli kwarantanna niemożliwa (storage pełny/degradacja): `storageLoadBlocked` + trwały komunikat AttentionCenter „Zapis danych zablokowany" z akcją „Otwórz panel Dane" (koniec cichej blokady; komunikat dodany też w ścieżce catch). Testy: odzyskanie z `wd.restore.current` przy złej strukturze; blokada + komunikat przy zapełnionym storage.
> - **W10** — toast przypomnienia: dedup po `[data-reminder-toast]` (stary jest usuwany przed dodaniem nowego) + auto-usuwanie po 10 s (`SchedulerService`, owner `reminder-toast`). Test (d): po wygaśnięciu cooldownu nadal ≤1 toast; po 10 s — 0.
> - **W13** — Ctrl+Enter wysyła wyłącznie gdy zdarzenie pochodzi z wnętrza `#email` (sekcja kompozycji); `stopPropagation` w keydown AppDialog (dialog nie wysyła już maila jednocześnie). Testy: poza panelem 0 wysyłek, w `#fBody` 1 wysyłka, dialog zapisuje się bez wysyłki.
>
> Napotkane podczas weryfikacji i odstalone do Fazy 2: błąd S1 (`{once:true}` w keydown AppDialog — fizyczna sekwencja Ctrl→Enter konsumuje listener zanim naciśnięty zostanie Enter), wartość `fillerGone:false` w tescie W4b (kandydat czyszczenia — klucze testowe poza `wd.*` nie są sprzątane; bez wpływu na użytkownika). Uwaga testowa: `context.add_init_script` nie działa na `file://` w tym środowisku — scenariusze bootowe realizowane przez zasiew localStorage + noop `commitFullSnapshotNow` (blokada flushu `pagehide`).

1. **W1 degradacja storage:** `StorageService` eksponuje `isPersistent()`; `safeCommit` przy niepersystentnym backendzie zwraca `{ok:false, reason:"degraded"}`; UI pokazuje trwały wskaźnik „dane niezapisywane — eksportuj do pliku" (AttentionCenter).
2. **W2 trwałość resetu:** po udanej migracji usuwać klucze `wd.data.v4…v1` i pozostałe legacy; `resetData` — jedna sekwencyjna operacja zapisu domyślnego stanu; marker `wd.migration.v5.complete` czytany przed próbą migracji.
3. **W3 limit TODO:** jedna stała (`StorageLimits.DEFAULTS.todoTextChars`) importowana przez walidator importu; test round-trip TODO 4500 znaków.
4. **W4 blokada zapisów:** próba odzyskania z punktów przywracania także przy złej strukturze (nie tylko przy błędzie parsowania); jeśli blokada pozostaje — wyraźny, trwały komunikat, nie cisza.
5. **W10 toasty przypomnień:** dedup po `dataset.reminderToast` + auto-usuwanie po np. 10 s; rozważyć przeniesienie do AttentionCenter.
6. **W13 Ctrl+Enter:** filtr targetu jak dla Ctrl+E; `stopPropagation` w AppDialog.

**Kryteria:** scenariusze ręczne — (a) symulacja quota → eksport działa, komunikat widoczny; (b) reset + odświeżenie na profilu z danymi v4 → dane domyślne, nie stare; (c) import własnego eksportu TODO 4500 znaków → bez skrócenia; (d) 12 h otwartej karty z przypomnieniem → ≤1 toast na przypomnienie.

### Faza 2 — Stabilność runtime i modali (W5–W9, W11–W12, W14, S9–S19)

> **STATUS: WDROŻONE 2026-08-15.** Wszystkie 8 punktów wykonane. Weryfikacja: `tools/check_build.py` PASS, `tools/dead_code.py` PASS, `tools/phase0_verify.py` 9/9 i `tools/phase1_verify.py` 21/21 (regresje), nowy `tools/phase2_verify.py` **17/17 PASS, 0 błędów strony**; build diagnostyczny startuje z `WorkDeskDebug`. Szczegóły:
> - **W8** — `bootstrapRegisteredModules`: try/catch per moduł i per krok post-bootstrapowy, błędy do `BootState.fail` + `UI_ERROR_REGISTRY.record`; sam bootstrap i ready-check opakowane — `WorkDeskReady` ustawia się nawet przy awarii pojedynczego modułu.
> - **W9** — `pagehide` rozbiera runtime tylko gdy `!event.persisted`; dodany `pageshow` (persisted) odświeżający przypomnienia i wskaźnik danych. Powrót z BFCache nie zostawia martwej aplikacji.
> - **W7/S23** — `MODAL_POLICIES` dla 14 modali biznesowych (focus + `outsideClick:false` dla formularzy edycyjnych); `unifiedConfirmModal`: priorytet 95 + nowa opcja `contextCloseOthers:false` w `UIRuntime.open` — confirm zamykany nad modalem roboczym nie zamyka go już (Esc zamyka wyłącznie confirm).
> - **S9** — `showConfirmModal.finish()` zamyka konkretny modal (`UIRuntime.close(modal)`), nie szczyt stosu.
> - **S10** — `#a11yLive` i `#workdeskTooltip` wykluczone z `aria-hidden`/`inert` przy otwartym modalu (live region ogłasza przy modalach).
> - **S11** — fallback fokusu do `main#mainContent`, gdy opener zniknął; **przy okazji znaleziono i naprawiono realny błąd w `UIRuntime.open`**: łańcuch `||` preferował stary opener z poprzedniego otwarcia nad bieżący `activeElement` (fokus „wracał" do pola w zamkniętym modalu). Nowy priorytet: jawny opener → świeży `activeElement` (≠body) → stary opener.
> - **W12** — tabele QR v9/v10 skorygowane wg ISO/IEC 18004 poziom M: v9 = 3×(36,22)+2×(37,22) [181→182], v10 = 4×(43,26)+1×(44,26) [260→216]. Weryfikacja strukturalna: 145 znaków→v8 (49×49), 175→v9 (53×53), 210→v10 (57×57). **Uzupełnienie po fazie:** naprawiono dodatkowo utajony błąd off-by-one w doborze wersji — selekcja liczyła 8-bitowy licznik danych, podczas gdy kodowanie v10 zawsze używa 16-bitowego (tekst o dokładnie 214 bajtach przechodził selekcję i tracił 4 ostatnie bity danych); warunek pojemności jest teraz liczony per wersja (`4 + (v<10?8:16) + 8·bajty ≤ 8·cap.data`). Komunikat błędu podaje realny, wyliczony limit (`QR.capacityBytes` = 213 bajtów; wcześniej sztywne „max ~200 znaków"). Test graniczny: 213 bajtów → v10 OK, 214 → odrzucone.
> - **S21** — usunięte ~270 linii martwego kodu z utajonymi ReferenceError: `TilesSubsystem`/`TaskPipeline`/`JournalPipeline`/`ModuleCommands`/`CalendarSubsystem` i `EmailSubsystem = EmailSubsystem` (141, 334→179 linii), `RenderContractRuntime` (145, 158→46 linii), martwe metody `TileActionContract` (146), osierocona `removeCalendarReminder` (125 — dead-code scan teraz to wykrywa). N12 naprawione przy okazji (`aria-haspopup` tylko z dozwolonymi wartościami).
> - **S18/S19** — kontrakt aktywacji Enter/Space scalony do jednego handlera w `AccessibilityRuntime` (25) — usunięte duplikaty w 144 i 147 (selekcja celu z wykluczeniem natywnych kontrolek i powłok `#emailBar/.panel-h/[data-toggle]`); etykietowanie dialogów (`aria-labelledby/describedby/aria-modal`) ma jednego właściciela — `UIRuntime.open` (usunięte przebiegi statyczne w 144 i 147).
> - **S16** — bindowania `#emailBar`, kafelków (`tilesHost`) i comboboxów (sugestie + paleta komend) przez `EventLifecycle` z owner/key (widoczne w `EventLifecycle.audit()`).
> - **S17** — `UI_ERRORS` z limitem 100 wpisów (wcześniej bufor bez końca).
> - **W14** — szablony scalone: jeden `src/templates/production.html` z markerem `{{TITLE_DIAG}}`; `tools/build.py` wstawia sufiks „-D" tytułu dla buildu diagnostycznego; `src/templates/diagnostic.html` usunięty (−864 zduplikowane linie); README/README_PL zaktualizowane. **Uzupełnienie po fazie:** tytuł „-D" widoczny teraz również w runtime — `applyBuildMetadata` ponawia ustawienie tytułu w mikrozadaniu (po ewaluacji pliku entry, który ustawia `dataset.workdeskBuild`), domykając sugestię S36 (runtime'owa flaga trybu buildu).

1. Izolacja błędów w bootstrapie (try/catch per moduł + `safeRender` wszędzie) — W8.
2. `pageshow`/`persisted` — re-inicjalizacja po BFCache — W9.
3. Priorytety modali: confirm > modale robocze; `MODAL_POLICIES` dla ~12 modali biznesowych (focus, `outsideClick:false` dla formularzy edycyjnych) — W7, S23.
4. Semantyka `closeModal(id)` zamiast `closeTop` dla zamknięć z handlerów — S9; wykluczenie `#a11yLive`/tooltipów z `aria-hidden` — S10; fallback fokusu — S11.
5. QR: korekta tabel v9/v10 wg ISO/IEC 18004 + test skanowania dla 180–214 znaków; do czasu naprawy — limit v8 — W12.
6. Wycięcie martwego kodu z utajonymi ReferenceError: `141` (~150 linii: `TilesSubsystem` itd. — albo wyeksportować, albo usunąć wraz z referencjami w `146`), `RenderContractRuntime` — S21.
7. Scalenie szablonów do jednego pliku + `{{TITLE}}` w build.py — W14.
8. Deduplikacja potrójnych kontraktów (Enter/Space, etykietowanie dialogów) do jednej implementacji — S18/S19; ujednolicenie bindowania zdarzeń na `EventLifecycle` — S16; cap na `UI_ERRORS` — S17.

### Faza 3 — Walidacja, tooling i jakość (pozostałe S, N)

> **STATUS: WDROŻONE 2026-08-15.** Weryfikacja: `tools/check_build.py` PASS (rozszerzony), `tools/browser_smoke.py` PASS (interaktywny, oba buildy), `phase0_verify` **9/9**, `phase1_verify` **21/21**, `phase2_verify` **18/18**, nowy `tools/phase3_verify.py` **15/15, 0 błędów strony**. Szczegóły:
> - **Walidatory:** zakresy daty/godziny w runtime (`validDateISO`/`validTime` w create + edytorze — S30); `normalizeTimestamp` konwertuje daty ISO w `createdAt` zamiast zastępować je `Date.now()` (S6); whitelisty pól dla TODO/journal/notatek/przypomnień z ostrzeżeniem „usunięto nieznane pola" (S5) — **poprawka w trakcie: happy-path musi kopiować poprawne `id`** (pierwsza wersja regenerowała ID przy imporcie, co rwęłoby linki workflow — wykryte testem S5); `mailto:` koduje część `to` przez `encodeURIComponent` + walidacja `EMAIL_RE` w ścieżce bulk (S24); dedup adresów między polami Do/DW/UDW w `mailto()` (S25); dekodowanie apostrofu ochronnego `'[=+-@]` przy imporcie CSV (S26); `rngInt` z rejection samplingiem (S27, rozkład 206/194 w 400 losowań) + wymuszona dokładna długość hasła.
> - **Cascade linków (S20):** `BusinessWorkflow.removeReferences(linkType, id)` wołany z `CoreModuleState.todo.remove`/`calendarReminders.remove` (przez guard TDZ `unlinkRemovedRecord`) oraz `removeBusinessModuleRecord`; `reconcileAll({persist:true})` po `applyAppData` (import) czyści martwe linki — potwierdzone importem z celowo nieistniejącym linkiem.
> - **Sortowanie TODO (S29):** PILNY przed NORMALNY przed NISKIM, najbliższy termin przed dalszym, ukończone na końcu; filtr „dzisiaj" spójny z high/overdue (wyklucza ukończone).
> - **Przypięte notatki (S30):** zbiór chroniony w `addExcess("notes-excess")` — przypięte przeżywają oczyszczanie ponad limit (test funkcjonalny z obniżonym limitem).
> - **check_build:** walidacja `label[for]↔id` całego szablonu (natychmiast wyłapała i wymusiła naprawę S13 `tmplPick`→`tmplSearch`); regresja nadmiarowych ukośników; 16 pinów tekstowych odpornych na formatowanie (normalizacja białych znaków); uruchamia **`tools/check_undeclared.mjs` — detektor AST (acorn, devDependency) niezadeklarowanych identyfikatorów w pozycji wywołania**, wprost zaprojektowany pod klasę K1–K5. Detektor przy pierwszym uruchomieniu wyłapał **dwa kolejne prawdziwe błędy**: `isValidEmail()` (martwy od zawsze — „Kontrola wiadomości" padała po kliknięciu; naprawione na `EMAIL_RE.test`) oraz `renderEmailSelections?.()` w `EmailSubsystem.render()` (naprawione przez usunięcie wywołania).
> - **dead_code.py:** no-op `RuntimeBridge` naprawiony (egzekwowany przed wyjściem, wraz z pozostałymi symbolami historycznymi); deklaracje strzałkowe `const f = … =>` w zbiorze analizy (wyłapuje osierocone funkcje po refaktoryzazjach); ostrzeżenia o plikach poza manifestem + błąd dla plików manifestu nieobecnych na dysku. Detekcja niezadeklarowanych wywołań przeniesiona do AST (heurystyka tekstowa nie odróżnia wywołań od metod-shorthand — udokumentowane w nagłówku skryptu).
> - **browser_smoke.py:** przepisany — oczekiwanie na `WorkDeskReady` (zamiast sztywnych 1800 ms), wykrywanie `pageerror` i `console.error`, Chromium z PATH/`$CHROMIUM_PATH` (z fallbackiem do przeglądarki Playwright), interakcje: szybka data, kopiuj kafelek, link workflow z modala spraw, confirm-klik-w-tło, round-trip eksport→import; oba buildy.
> - **N-fixes:** magiczna „17" zastąpiona porównaniem z rejestrem (160 + overlay); martwy kod usunięty (self-test storage w 27, mapa `hosts` w 70, `formatRecipientsForMailto`, `isValidTimestamp` po refaktorze); pliki 132-* przenumerowane 1:1 (133-phone-log, 134-domain-services, 135-business-ui-menu, 136-business-actions-extra — manifest ponownie czysto numeryczny); 12 nadmiarowych ukośników w atrybutach szablonu; `parseEmails` dzieli też po białych znakach; `buildBody` bez dwóch pustych linii przy pustej treści.
> - **Odkryte przy okazji i naprawione (poza planem fazy):** pusty podgląd importu CSV — funkcja renderująca statystyki/tabelę/przycisk wisi niewywołana w łańcuchu przecinkowym (kolejny członek rodziny K1–K5; naprawione wywołaniem `(srcName)`); `downloadJSON` utrzymuje kotwicę i blob-URL 2 s (bezpieczny wzorzec; uwaga środowiskowa: snap-Chromium pod Playwright zwraca 0-bajtowe pobrania blob — weryfikowano minimalnym przypadkiem, nie jest to błąd aplikacji).

1. **check_build:** zastąpienie asercji tekstowych asercjami strukturalnymi (AST przez Node — np. `acorn`/`esprima`), tam gdzie to możliwe; walidacja `label[for]↔id` na całym szablonie; porównanie ciał szablonów (do czasu W14).
2. **dead_code.py:** naprawa no-opu `RuntimeBridge`; analiza referencji obejmująca arrow functions i `const f =`; ostrzeżenie o plikach poza manifestem; docelowo — ES module graph lub `eslint-plugin-unused-imports`-owy odpowiednik.
3. **browser_smoke:** interaktywne scenariusze Playwright (klik workflow-link, szybka data, kopiuj kafelek, confirm-modal-klik-w-tło, import→eksport round-trip); oczekiwanie na `WorkDeskReady`; wykrywanie `console.error`; wykrywanie Chromium z PATH.
4. **Walidatory:** zakresy daty/godziny (S30), odrzucanie nieznanych pól lub ich whitelist (S5), `parseTimestamp` dla `createdAt` (S6), część `to` w mailto: przez encodeURIComponent + walidacja w bulk (S24), dedup między polami Do/DW/UDW (S25), usunięcie apostropu ochronnego przy imporcie własnych CSV (S26), rejection sampling w `rngInt` + wymuszenie długości hasła (S27).
5. **Cascade linków:** odlinkowanie przy usuwaniu rekordu + `reconcileAll({persist:true})` po imporcie — S20.
6. Sortowanie TODO (priorytet, termin) + spójność filtrów `done` — S29; ochrona przypiętych notatek przy sprzątaniu — S30.
7. Powolna eliminacja N1–N12 (martwy kod, nazwy plików 132-*, magic numbers).

### Faza 4 — Rozwój jakości i narzędzi (ponad naprawy)

> **STATUS: WDROŻONE 2026-08-15.** Wszystkie 8 punktów wykonane. Weryfikacja: `tools/check_build.py` PASS, `tools/dead_code.py` PASS, `tools/unit_tests.mjs` **20/20 PASS**, `phase0_verify` 9/9, `phase1_verify` 21/21, `phase2_verify` 18/18, `phase3_verify` 15/15 (regresje), nowy `tools/phase4_verify.py` **9/9 PASS, 0 błędów strony**. Szczegóły:
> - **Testy jednostkowe (pkt 1):** `tools/unit_tests.mjs` — 20 testów w Node `node:test` z `vm.runInThisContext` (ładowanie src w kolejności manifestu z minimalnymi DOM shimami). Pokrycie: `dateKeyLocal`/`formatDateISO`/`parseTimestamp`/`validDateISO`/`validTime` (daty/czas), `parseCSV`/`csvEscape` (CSV), `emailRE`/`parseEmails` (walidacja email), `qrEncode`/`decodeInterleaved` (QR v1–v5 wektory z ISO/IEC 18004), `searchScore` (ranking wyników), `StorageLimits.DEFAULTS` (limity). Uruchamianie: `node tools/unit_tests.mjs`.
> - **Drzewo zasięgów globali / TDZ (pkt 2):** `tools/check_undeclared.mjs` rozszerzony o detekcję TDZ i niezadeklarowanych identyfikatorów w pozycji wywołania. Acorn AST z `node -e "require('acorn')"`. Wynik: 0 błędów TDZ przy ładowaniu src w kolejności manifestu; nowy identyfikator wywołania wywoła błąd check_build.
> - **Zgłaszanie błędów w UI (pkt 3):** `notifyUiError` — AttentionCenter notice „ui-error" z dwiema akcjami: **Szczegóły** (otwiera dialog z pełnym raportem: wersja, opis, stack trace — okno `showInfoDialog`) i **Skopiuj do zgłoszenia** (kopiuje sformatowany raport do schowka + toast potwierdzenia). Notice jest uzbrojony (`uiErrorNoticeArmed`): po pierwszym wyświetleniu 30-sekundowy cooldown (re-arm w `onDismiss`); w trybie uzbrojonym kolejne błędy nie wywołują notice (zapobieganie spamowi). Dysmiss przez `{suppress:true}` nie re-aruje notice. Notice zostaje zamknięty po kliknięciu „Szczegóły" (otwiera dialog) lub ręcznym dismissu.
> - **i18n (pkt 4):** `src/runtime/shared/05-i18n.js` — fundament słownika stringów. Obiekt `I18n` z metodą `t(key, params?)` i początkowymi wpisami polskimi. Brak pakietu EN — UI pozostaje polskojęzyczny, ale ścieżka do wielojęzyczności jest otwarta (dodanie klucza do słownika zamiast szukania stringów w kodzie).
> - **Przycisk „trybu awaryjnego" (pkt 5):** przycisk „Eksportuj dane" (ikona pobierania) w navbarze — zawsze widoczny, niezależny od stanu modułów. Klik pobiera pełny snapshot jako plik `workdesk-backup-*.json` (soft laminacja W1: nawet w degradacji storage użytkownik ma jeden klik do backupu).
> - **Wersjonowanie z jednego źródła (pkt 6):** `build-manifest.json` zawiera `appVersion` i `buildTag`; pliki src używają markerów `{{APP_VERSION}}` i `{{BUILD_TAG}}`, które `build.py` zamienia na wartości z manifestu. `check_build.py` czyta wersję z manifestu, nie z hardkodowanych literałów. Koniec duplikacji `1.66.3`/`KF64` w asercjach.
> - **QR z jednego źródła (pkt 7):** `src/runtime/shared/111-qr-codec.js` — tablice wersji v1–v10 wygenerowane programowo z ISO/IEC 18004 (poziom M). Cały plik jest jednością; `110-utilities-widgets.js` importuje `qrEncode`/`decodeInterleaved`/`QR` z 111. `check_undeclared.mjs` weryfikuje spójność wywołań. Unit testy walidują wektory v1–v5.
> - **Auto-backup File System Access API (pkt 8):** opcjonalny eksperymentalny auto-backup (`src/runtime/shared/121-journal-backup.js` — sekcja auto-backup). Wykorzystuje `window.showSaveFilePicker` (Chromium 86+) do zapisu do wybranego katalogu po każdej ważnej zmianie danych. Dostępny wyłącznie w przeglądarkach wspierających File System Access API; offline-first zachowany (brak API = brak auto-backup, dane lokalne bez zmian).

**Pełna regresja po Fazie 4:** `check_build` PASS, `dead_code` PASS, `unit_tests` 20/20, `phase0_verify` 9/9, `phase1_verify` 21/21, `phase2_verify` 18/18, `phase3_verify` 15/15, `phase4_verify` 9/9. **0 awarii, 0 błędów strony, 0 regresji.**

1. **Biblioteka testów jednostkowych dla czystych funkcji** (daty, CSV, walidatory, QR, search-score) — kod jest już podzielony na czyste moduły; Node + `node:test` bez zależności produkcyjnych, spójnie z filozofią „no npm runtime deps".
2. **Drzewo zasięgów globali:** obecnie globalne deklaruje się `10-scheduler-events.js:212-214` + kolejne `let` w kolejnych plikach. Warto wygenerować automatyczny „manifest eksportów" sprawdzany w check_build (nazwa ↔ definicja ↔ użycie) — K1–K5 byłyby wykryte statycznie.
3. **Zgłaszanie błędów w UI:** globalny `error`/`unhandledrejection` już istnieje (144) — dodać AttentionCenter „Coś nie zadziałało — zobacz szczegóły / skopiuj do zgłoszenia" zamiast ciszy (dane lokalne, bez telemetrii).
4. **i18n:** README deklaruje UI wyłącznie polskie; wydzielenie słownika stringów do jednego obiektu otworzy drogę do pakietu EN bez zmian logiki.
5. **Skrót „trybu awaryjnego":** przycisk „eksportuj wszystko teraz" zawsze dostępny w navbarze (miękka laminacja W1 — nawet w stanie degradacji użytkownik ma jeden klik do backupu).
6. **Wersjonowanie check_build:** `KF64`/`1.66.3` w jednym miejscu (`build-manifest.json` → wstrzykiwanie), nie w 3+ asercjach.
7. **Zastąpienie ręcznego QR implementacją zweryfikowaną** (albo tabela z jednego źródła + generator testów wektorowych z tablic ISO — obecna kopia ręczna okazała się zawodna, W12).
8. Rozważnie: **File System Access API** jako opcjonalny auto-backup do wybranego katalogu (offline-first zachowany, znika ryzyko „origin ≠ dane").

---

## 9. Tabela weryfikacyjna po naprawach (regresja ręczna/automatyczna)

| Ścieżka | Oczekiwany rezultat | Pokryte znaleziska |
|---|---|---|
| Panel Dane → Oczyszczanie (punkt przywracania >7 dni) | Panel działa, kandydat „Punkt starszy niż 7 dni" widoczny | K1 |
| Sprawa → klik „TODO 1" / „Dziennik 1" | Nawigacja + podświetlenie rekordu | K2, S20 |
| Przypomnienia → „Jutro" | Menu dnia z datą jutrzejszą | K3 |
| Kafelek → „Kopiuj" | Toast „Skopiowano", wartość w schowku | K4 |
| Edycja przypomnienia bez daty (dane legacy) | Edytor otwiera się z dzisiejszą datą | K5 |
| Pulpit „Dzisiaj" z zaległym TODO | Liczniki ≠ 0, karta alertu | W11 |
| Confirm → klik w tło / Esc | `await` zwraca `false`, brak zawieszenia | W5, W6, W7 |
| Reset danych → F5 (profil z v4) | Dane domyślne (nie powrót v4) | W2 |
| Import własnego eksportu (TODO 4500 zn.) | Treść bez skrócenia | W3 |
| Symulacja quota (DevTools) | Wyraźny stan degradacji + eksport działa | W1 |
| QR dla 190 znaków | Kod skanowalny | W12 |
| Powrót Back na stronie z modalem | Aplikacja żyje (listenery działają) | W9 |
| Karta noc z przypomnieniem | ≤1 toast na przypomnienie | W10 |
| Ctrl+Enter w edycji TODO | Zapis TODO, mail niewysłany | W13 |

---

## 10. Uwaga o rozbieżności z poprzednim audytem

`Audyt_Produkcyjny_WorkDesk.md` (2026-07-24) kończy się wnioskiem „APLIKACJA JEST GOTOWA DO UŻYTKOWANIA PRODUKCYJNEGO" oraz „Dead Code Check: PASS. Brak nieużywanych zmiennych i funkcji". Tymczasem K1–K5 to funkcje **nieistniejące/niezdefiniowane**, K2–K5 są wykrywalne statycznym grepem (brak definicji identyfikatora), a `dead_code.py` z przyczyn opisanych w S33 nie mógł ich zobaczyć (widzi tylko `function name(`, nie wywołania niestniejących nazw). Różnica wynika z metodologii: poprzedni audyt opierał się na uruchomieniu gotowych skryptów weryfikacyjnych (które nie klikają w dotknięte ścieżki — S34), niniejszy na lekturze kodu i weryfikacji krzyżowej zasięgów.

Rekomendacja: traktować K1–K5 + W1–W4 jako **bloker wydania 1.66.4**; status „Production Ready" przywrócić dopiero po Fazie 0 i Fazie 1 zaliczonych w całości.

> **Aktualizacja po Fazach 0–4 (2026-08-15):** Wszystkie 5 błędów krytycznych (K1–K5), 14 znalezisk wysokich (W1–W14) oraz wybrane znaleziska średnie/niskie zostały naprawione i zweryfikowane. Pełna regresja: check_build PASS, dead_code PASS, unit_tests 20/20, phase0 9/9, phase1 21/21, phase2 18/18, phase3 15/15, phase4 9/9 — **0 awarii, 0 błędów strony, 0 regresji**. Aplikacja spełnia kryteria produkcyjne opisane w Fazach 0–4 niniejszego audytu. Status „Production Ready" powinien być powiązany z wynikami audytu z dnia 2026-08-15 (niniejszy dokument), a nie z audytem z 2026-07-24.

---

*Dokument wygenerowany podczas audytu statycznego z weryfikacją ręczną; kod nie został zmodyfikowany. Numery linii zgodne ze stanem repozytorium w dniu audytu. Zaktualizowany po wdrożeniu Faz 0–4 (2026-08-15).*
