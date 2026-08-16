# WorkDesk

> Prywatne, lokalne centrum organizacji pracy działające offline i dystrybuowane jako jeden plik HTML.

**Polski** · [English](README.md)

![Status](https://img.shields.io/badge/status-release%20candidate-blue)
![Wersja](https://img.shields.io/badge/version-1.66.3--KF64-informational)
![Środowisko](https://img.shields.io/badge/runtime-przeglądarka-success)
![Dystrybucja](https://img.shields.io/badge/dystrybucja-jeden%20HTML-success)
![Offline](https://img.shields.io/badge/offline-first-success)
![Język UI](https://img.shields.io/badge/UI-tylko%20polski-orange)

> [!IMPORTANT]
> Obecny interfejs aplikacji jest przygotowany **wyłącznie w języku polskim**. Repozytorium zawiera angielską wersję dokumentacji dla deweloperów i użytkowników zagranicznych, ale aplikacja nie ma obecnie angielskiego pakietu językowego ani kompletnej warstwy i18n.

## Spis treści

- [Czym jest WorkDesk?](#czym-jest-workdesk)
- [Cel projektu](#cel-projektu)
- [Najważniejsze założenia](#najważniejsze-założenia)
- [Funkcje](#funkcje)
- [Jak korzystać z aplikacji](#jak-korzystać-z-aplikacji)
- [Dane, prywatność i bezpieczeństwo](#dane-prywatność-i-bezpieczeństwo)
- [Backup i odzyskiwanie danych](#backup-i-odzyskiwanie-danych)
- [Architektura](#architektura)
- [Struktura repozytorium](#struktura-repozytorium)
- [Środowisko deweloperskie](#środowisko-deweloperskie)
- [Budowanie i weryfikacja](#budowanie-i-weryfikacja)
- [Jak modyfikować projekt](#jak-modyfikować-projekt)
- [Jak dodać nowy moduł](#jak-dodać-nowy-moduł)
- [Storage i kontrakty danych](#storage-i-kontrakty-danych)
- [Powiązania przepływów biznesowych](#powiązania-przepływów-biznesowych)
- [Dostępność](#dostępność)
- [Obsługiwane przeglądarki](#obsługiwane-przeglądarki)
- [Aktualne ograniczenia](#aktualne-ograniczenia)
- [Zasady wydawania wersji](#zasady-wydawania-wersji)
- [Współtworzenie](#współtworzenie)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Licencja](#licencja)
- [FAQ](#faq)

---

## Czym jest WorkDesk?

WorkDesk to przeglądarkowa, lokalna aplikacja do organizacji codziennej pracy biurowej i operacyjnej. Łączy w jednym miejscu grupy odbiorców e-mail, szablony, zadania, przypomnienia, notatki, dziennik, procedury, checklisty oraz prostą obsługę telefonów i spraw wymagających odpowiedzi.

Wersja produkcyjna jest generowana jako **jeden samowystarczalny plik HTML**. Nie wymaga serwera, usługi bazodanowej, instalowania pakietów, tworzenia konta ani stałego połączenia z Internetem. Plik można skopiować do innego katalogu lub na nośnik przenośny i uruchomić bezpośrednio w nowoczesnej przeglądarce.

WorkDesk jest przeznaczony przede wszystkim dla jednego użytkownika pracującego na jednym komputerze. Projekt nie próbuje zastąpić wieloosobowego systemu zarządzania projektami. Jego celem jest ograniczenie przełączania się między wieloma narzędziami podczas codziennej pracy oraz pozostawienie danych pod kontrolą użytkownika.

## Cel projektu

WorkDesk powstał w odpowiedzi na praktyczny problem: codzienne procesy biurowe są często rozproszone pomiędzy klientem pocztowym, plikami tekstowymi, zakładkami przeglądarki, karteczkami, arkuszami, kalendarzem i osobną aplikacją do zadań.

Projekt zbiera w jednym środowisku funkcje potrzebne do:

- przygotowywania powtarzalnych wiadomości e-mail;
- zarządzania grupami odbiorców i szablonami;
- zapisywania zadań, przypomnień, notatek i zdarzeń dnia;
- przechowywania często używanych linków, snippetów i procedur;
- rejestrowania telefonów oraz spraw wymagających reakcji;
- wykonywania lokalnych kopii zapasowych i odzyskiwania danych;
- pracy bez dostępu do Internetu, gdy nie są potrzebne zewnętrzne odnośniki.

WorkDesk celowo nie wymaga synchronizacji chmurowej, kont, abonamentu ani telemetrii.

## Najważniejsze założenia

### Offline first

Sama aplikacja jest lokalna i samowystarczalna. Podstawowe funkcje działają bez połączenia z siecią. Linki skonfigurowane przez użytkownika mogą oczywiście otwierać strony internetowe lub zasoby intranetowe.

### Dystrybucja jako jeden plik

Źródła deweloperskie są modułowe, ale build produkcyjny powstaje jako jeden HTML zawierający HTML, CSS i JavaScript.

Zalety:

- brak instalatora;
- proste kopiowanie i wdrożenie;
- łatwa archiwizacja;
- prosty rollback do wcześniejszego pliku;
- brak zależności runtime od npm lub CDN;
- możliwość uruchomienia ze zwykłego katalogu lub nośnika przenośnego.

### Dane pod kontrolą użytkownika

Dane aplikacji są przechowywane w localStorage przeglądarki dla originu użytego do otwarcia WorkDesk. Użytkownik może wyeksportować dane do pliku JSON i tworzyć lokalne punkty przywracania.

### Odporna obsługa danych

Runtime zawiera walidację, normalizację, backup/restore, sumy kontrolne, retencję, mechanizmy odzyskiwania oraz osobny build diagnostyczny.

### Modułowe źródła, przenośna dystrybucja

Deweloper pracuje na osobnych szablonach, stylach i modułach runtime. Użytkownik końcowy otrzymuje jeden plik HTML.

## Funkcje

### Pulpit dnia

Pulpit agreguje bieżącą pracę, w tym:

- zadania na dziś;
- zadania po terminie;
- przypomnienia zaplanowane na dziś;
- niewysłany draft e-mail;
- wiek backupu i stan danych;
- najważniejsze moduły i kafelki.

Globalny wskaźnik stanu danych informuje, czy dane zostały zapisane, jakie jest przybliżone wykorzystanie pamięci oraz czy istnieje świeży punkt przywracania.

### Sekcja e-mail

Moduł e-mail obsługuje:

- grupy odbiorców podzielone na sekcje;
- osobne zaznaczanie pól **Do**, **DW** i **UDW**;
- ostatnio używane grupy;
- szablony wiadomości;
- podpisy;
- profile e-mail;
- walidację odbiorców;
- eliminację duplikatów adresów;
- wyszukiwanie grup i sekcji;
- trwały draft;
- przygotowanie wiadomości przez `mailto:`;
- wiadomości seryjne;
- wielokrotnego użytku snippety tekstowe.

### TODO

Moduł TODO oferuje:

- dodawanie i edycję zadań;
- priorytety;
- terminy;
- filtry: dziś, po terminie, priorytet i status wykonania;
- timestamp wykonania;
- archiwum;
- eksport archiwum do CSV;
- tworzenie przypomnienia lub wpisu dziennika z zadania;
- mechanizmy Cofnij i przywracania.

### Kalendarz i przypomnienia

Kalendarz zawiera:

- widok miesiąca;
- lokalne przypomnienia;
- status wykonania przypomnienia;
- filtrowanie i listę rekordów;
- tworzenie przypomnień z powiązanych spraw;
- nawigację z relacji workflow.

### Dziennik

Dziennik służy do krótkich zapisów operacyjnych. Obsługuje:

- wpisy z timestampem;
- typy: informacja, problem, decyzja, kontakt i wykonane;
- wyszukiwanie tekstowe;
- filtrowanie po zakresie dat;
- podsumowania;
- eksport CSV;
- retencję i czyszczenie starych danych.

### Notatki

Moduł notatek umożliwia lokalne tworzenie, edycję i usuwanie notatek z limitami bezpieczeństwa oraz integracją z mechanizmami przywracania.

### Kafelki i częste linki

Użytkownik może utrzymywać własne kafelki oraz często używane odnośniki do systemów wewnętrznych, stron internetowych, zasobów współdzielonych lub często wykonywanych działań. Domyślne źródła zawierają przykładowe adresy, które należy zastąpić przed faktycznym wdrożeniem.

### Checklisty

Checklisty wspierają powtarzalne procedury, stabilne identyfikatory pozycji, oznaczanie wykonania i znormalizowany zapis.

### Sprawy wymagające odpowiedzi

Sprawy to lekkie rekordy dla tematów wymagających dalszej reakcji. Ze sprawy można utworzyć:

- TODO;
- przypomnienie;
- wpis w dzienniku.

### Rejestr telefonów

Rejestr telefonów przechowuje operacyjne informacje o rozmowach. Z telefonu można utworzyć powiązaną sprawę, zachowując stabilną relację pomiędzy rekordem źródłowym i utworzoną sprawą.

### Procedury

Moduł procedur przechowuje wielokrotnego użytku instrukcje i wiedzę operacyjną, którą można odnajdywać przez wyszukiwanie globalne.

### Wyszukiwanie globalne i paleta poleceń

WorkDesk posiada:

- wyszukiwanie w obsługiwanych modułach;
- punktowane wyniki;
- obsługę klawiatury;
- paletę poleceń otwieraną przez `Ctrl+K`;
- szybkie polecenia operacyjne;
- przechodzenie do odnalezionych rekordów.

### Narzędzia pomocnicze

Aplikacja zawiera lokalne narzędzia, między innymi:

- generator haseł;
- generator QR;
- kalkulator czasu i dni roboczych;
- generator identyfikatorów;
- narzędzia walutowe/VAT;
- działania związane ze schowkiem.

Wyniki narzędzi należy zweryfikować przed wykorzystaniem zawodowym. WorkDesk nie jest autorytatywnym systemem finansowym, bezpieczeństwa ani compliance.

### Zarządzanie danymi

Panel danych umożliwia:

- pełny eksport JSON;
- pełny import JSON;
- eksport pojedynczych modułów;
- lokalne punkty przywracania;
- reset modułu;
- przywrócenie danych wbudowanych;
- podgląd wykorzystania pamięci;
- retencję i cleanup;
- test roundtrip i integralności.

Funkcje zaawansowane i destrukcyjne są oddzielone od codziennych akcji backupu.

### Build diagnostyczny

Oprócz pliku produkcyjnego projekt generuje build diagnostyczny z dodatkowymi kontrolami runtime i interfejsem `WorkDeskDebug`. Build diagnostyczny służy do testów i weryfikacji, a nie do codziennej pracy.

## Jak korzystać z aplikacji

### Opcja A: gotowy plik produkcyjny

1. Pobierz lub skopiuj `index_KF64.html`.
2. Umieść go w stałym katalogu.
3. Otwórz w nowoczesnej przeglądarce, najlepiej Microsoft Edge lub innej przeglądarce Chromium.
4. Skonfiguruj grupy, szablony, linki, zadania i preferencje.
5. Po konfiguracji wykonaj backup w panelu **Dane**.

Normalny użytkownik nie musi uruchamiać żadnej komendy instalacyjnej.

### Zalecana konfiguracja początkowa

1. Zastąp przykładowe linki i kafelki własnymi zasobami.
2. Sprawdź grupy e-mail i szablony.
3. Ustaw domyślną godzinę przypomnienia i preferencje UI.
4. Utwórz kilka rekordów testowych.
5. Wyeksportuj backup JSON.
6. Zapisz backup poza profilem przeglądarki.
7. Przetestuj restore na niekrytycznych danych przykładowych.

### Typowy dzień pracy

1. Otwórz WorkDesk i sprawdź sekcję **Dzisiaj**.
2. Przejrzyj zaległe TODO i przypomnienia.
3. Przygotuj wiadomości z grup i szablonów.
4. Zapisuj telefony, sprawy i decyzje.
5. Twórz ze spraw zadania lub przypomnienia.
6. Ważne zdarzenia dopisuj do dziennika.
7. Przed dużym importem lub resetem utwórz punkt przywracania.
8. Regularnie eksportuj backup.

### Ważna informacja o originie pliku

Storage przeglądarki jest przypisany do originu. Otwarcie tego samego HTML z innej ścieżki, hosta lub profilu przeglądarki może utworzyć osobny kontekst danych. Nie należy zakładać, że kopia HTML otwarta z innego miejsca automatycznie zobaczy te same dane.

Zawsze utrzymuj niezależne backupy JSON.

## Dane, prywatność i bezpieczeństwo

### Co pozostaje lokalnie

W obecnej wersji źródeł WorkDesk nie wymaga backendu do podstawowych funkcji. Rekordy aplikacji są przechowywane lokalnie w przeglądarce.

Projekt nie zawiera wbudowanego systemu kont, chmurowej bazy danych, SDK analitycznego ani usługi telemetrii aplikacyjnej.

### Nawigacja zewnętrzna

Kafelki i linki mogą prowadzić do Internetu lub intranetu. Po otwarciu odnośnika użytkownik opuszcza lokalną aplikację i podlega zasadom systemu docelowego.

Paczka źródłowa zawiera przykładowe adresy intranetu, CRM, wiki i helpdesku. Przed wdrożeniem należy je zastąpić.

### Dane wrażliwe

Ponieważ WorkDesk zapisuje dane lokalnie:

- osoba mająca dostęp do profilu przeglądarki lub konta systemowego może potencjalnie uzyskać do nich dostęp;
- localStorage nie zastępuje szyfrowanego sejfu;
- haseł, kluczy API, danych medycznych i szczególnie wrażliwych danych nie należy przechowywać bez odpowiedniego zabezpieczenia środowiska;
- pliki backupu należy chronić jak każdy eksport danych operacyjnych.

### Brak automatycznej synchronizacji

Dane nie synchronizują się pomiędzy urządzeniami. Skopiowanie HTML nie przenosi localStorage. Do kontrolowanego transferu służy eksport/import.

## Backup i odzyskiwanie danych

WorkDesk posiada kilka warstw ochrony danych:

- centralną walidację i normalizację storage;
- bezpieczne zapisy i fallback storage;
- pełny eksport/import JSON;
- lokalne punkty przywracania;
- sumy kontrolne i semantyczny test roundtrip;
- reset modułu z punktem bezpieczeństwa;
- przywracanie poprzedniego poprawnego stanu;
- kwarantannę i odzyskiwanie uszkodzonych danych;
- retencję wybranych typów rekordów.

### Zalecana polityka backupów

- Utwórz backup po większych zmianach konfiguracji.
- Wykonuj kopie regularnie podczas aktywnej pracy.
- Przechowuj co najmniej jedną kopię poza profilem przeglądarki.
- Zachowuj kilka wersji z datą.
- Okresowo testuj przywracanie.
- Nie polegaj wyłącznie na lokalnych punktach, ponieważ korzystają z tego samego środowiska storage.

## Architektura

Ogólny przepływ:

```text
Entry produkcyjny / diagnostyczny
               │
               ▼
          Bootstrap runtime
               │
      ┌────────┼─────────┐
      ▼        ▼         ▼
  UI Runtime  AppStore  ModuleRegistry
      │        │         │
      ├────────┼─────────┤
      ▼        ▼         ▼
  Event      Storage    Moduły biznesowe
 Lifecycle  Services    i renderery
      │        │         │
      └──── Scheduler ───┘
               │
               ▼
      Diagnostyka / recovery
```

### Odpowiedzialności głównych warstw

#### AppStore

Utrzymuje kanoniczny stan aplikacji w pamięci i koordynuje dostęp do danych trwałych.

#### Storage capability i storage core

Stanowią kontrolowaną granicę wokół `localStorage`: test dostępności, fallback pamięciowy, walidację, bezpieczny commit i raportowanie wykorzystania.

#### ModuleRegistry

Definiuje kontrakty modułów i łączy lifecycle: inicjalizację, bind, render, serializację, reset i teardown.

#### EventLifecycle

Rejestruje zdarzenia z modelem właściciel/klucz, dzięki czemu listenery można usuwać i zastępować bez niekontrolowanego dublowania. Obsługuje także delegację zdarzeń.

#### SchedulerService

Centralizuje timeouty, intervale i debounce. Zadania można przypisać do właściciela i anulować podczas teardown.

#### UIRuntime

Obsługuje wspólne powierzchnie tymczasowe, modale, focus i interakcje poziomu aplikacji.

#### Accessibility Runtime

Sprawdza i uzupełnia nazwy dostępnościowe, obsługę klawiatury, przepływ focusu, stany ARIA i wybrane kontrakty UI.

#### Diagnostics

Zapewnia statyczne i runtime'owe gate'y dla storage, persistence, modułów, workflow i krytycznych zachowań. Build diagnostyczny zawiera dodatkowe scenariusze.

#### BusinessWorkflow

Koordynuje stabilne relacje i konwersje pomiędzy rejestrem telefonów, sprawami, TODO, przypomnieniami i dziennikiem.

## Struktura repozytorium

```text
.
├── src/
│   ├── diagnostics/
│   │   └── diagnostic-overlay.js
│   ├── runtime/
│   │   ├── entry/
│   │   │   ├── production.js
│   │   │   └── diagnostic.js
│   │   └── shared/
│   │       ├── 00-event-lifecycle.js
│   │       ├── 10-scheduler-events.js
│   │       ├── 20-ui-runtime.js
│   │       ├── 25-accessibility-runtime.js
│   │       ├── 27-storage-capability.js
│   │       ├── 30-email-composer.js
│   │       ├── 40-storage-core.js
│   │       ├── 60-storage-validation.js
│   │       ├── 70-module-registry.js
│   │       ├── 80-persistence-import.js
│   │       ├── 100-calendar-reminders.js
│   │       ├── 125-core-modules.js
│   │       ├── 130-business-foundation.js
│   │       ├── 131-search-quick-actions.js
│   │       ├── 140-business-workflow.js
│   │       └── ...
│   ├── styles/
│   │   ├── 00-tokens-navbar.css
│   │   ├── 10-email.css
│   │   ├── 20-layout-panels.css
│   │   ├── 90-design-system.css
│   │   └── 99-final-overrides.css
│   └── templates/
│       └── production.html  (tytuł diagnostyczny: marker {{TITLE_DIAG}})
├── tools/
│   ├── build.py
│   ├── check_build.py
│   ├── check_undeclared.mjs
│   ├── dead_code.py
│   ├── browser_smoke.py
│   └── phase0…3_verify.py  (regresje poprawek z audytu)
├── dist/
│   ├── index_KF64.html
│   └── index_KF64_DIAG.html
├── build-manifest.json
└── package.json
```

Numeryczne prefiksy określają deterministyczną kolejność łączenia plików. Nie zmieniaj nazw ani kolejności manifestu bez znajomości zależności bootstrapu.

## Środowisko deweloperskie

### Wymagania

- Python 3;
- Node.js do kontroli składni JavaScript uruchamianej przez checker;
- Chromium lub kompatybilna przeglądarka do browser smoke testu;
- obecny build nie wymaga zewnętrznych zależności npm w runtime.

Sprawdzenie środowiska:

```bash
python --version
node --version
```

### Klonowanie repozytorium

```bash
git clone <adres-repozytorium>
cd <katalog-repozytorium>
```

### Build przez Pythona

```bash
python tools/build.py --kind all
```

### Build przez skrypty package.json

```bash
npm run build
```

Obecny `package.json` jest wrapperem dla lokalnych narzędzi Python i nie deklaruje zewnętrznych zależności produkcyjnych.

## Budowanie i weryfikacja

### Generowanie buildów

```bash
python tools/build.py --kind all
```

Oczekiwane pliki:

```text
dist/index_KF64.html
dist/index_KF64_DIAG.html
```

### Pełny checker

```bash
python tools/check_build.py
```

Checker weryfikuje między innymi:

- składnię JavaScript;
- jeden osadzony blok `<style>` i `<script>`;
- duplikaty ID HTML;
- identyczność shared runtime w buildzie produkcyjnym i diagnostycznym;
- brak API diagnostycznego w produkcji;
- wymagane kontrakty persistence i modułów;
- regresje storage i workflow;
- regresje dostępności i lifecycle;
- aktualne oznaczenia wersji i buildu.

### Skan martwego kodu

```bash
python tools/dead_code.py
```

lub:

```bash
npm run dead-code
```

### Browser smoke test

```bash
python tools/browser_smoke.py
```

lub:

```bash
npm run browser-smoke
```

Test KF64 potwierdza uruchomienie bez błędów JavaScript oraz renderowanie krytycznych elementów:

- kafelków;
- komórek kalendarza;
- grup e-mail;
- TODO;
- notatek;
- dziennika.

Browser smoke test jest obowiązkowy. Same kontrole składni nie wykryły regresji startowej KF63, którą naprawiono w KF64.

## Jak modyfikować projekt

### Ogólne zasady

1. Modyfikuj pliki w `src/`, a nie wygenerowany HTML w `dist/`.
2. Zachowaj jedno źródło prawdy dla stanu aplikacji.
3. Moduły biznesowe nie powinny pisać bezpośrednio do `localStorage`.
4. Korzystaj z centralnego storage i istniejących walidatorów.
5. Trwałe listenery rejestruj przez `EventLifecycle`.
6. Timery i debounce rejestruj przez `SchedulerService`.
7. Dane użytkownika renderuj bezpiecznymi metodami DOM lub przez `textContent`.
8. Zachowaj lifecycle i teardown modułów.
9. Przy zmianie schematu aktualizuj migrację i normalizację.
10. Przed commitem zbuduj projekt i uruchom wszystkie kontrole.

### Zmiana struktury HTML

Edytuj:

```text
src/templates/production.html  (jeden szablon; build wstawia sufiks tytułu dla wersji diagnostycznej przez {{TITLE_DIAG}})
```

Zachowuj stabilne ID używane przez runtime. Dodając kontrolkę:

- użyj semantycznego elementu;
- zapewnij nazwę dostępnościową;
- obsłuż klawiaturę, gdy ma to znaczenie;
- dodaj binding lifecycle;
- dla krytycznych elementów dodaj test diagnostyczny lub smoke.

### Zmiana stylów

Edytuj najbardziej właściwy istniejący arkusz zamiast dopisywania kolejnego globalnego nadpisania.

Sugerowana odpowiedzialność:

- tokeny/nawigacja → `00-tokens-navbar.css`;
- e-mail → `10-email.css`;
- layout/panele → `20-layout-panels.css`;
- modale/powierzchnie tymczasowe → `30-modals-transient.css`;
- kafelki/notatki → `40-tiles-notes.css`;
- kalendarz/narzędzia → `50-calendar-tools.css`;
- dziennik/dane → `60-journal-data.css`;
- motywy → `70-theme.css`;
- storage/dostępność/biznes → `80-storage-a11y-business.css`;
- prymitywy design systemu → `90-design-system.css`;
- egzekwowanie komponentów → `95-component-enforcement.css`;
- wyłącznie awaryjna kompatybilność → `99-final-overrides.css`.

Nie naprawiaj zwykłych problemów komponentu przez dokładanie następnej reguły do `99-final-overrides.css`.

### Zmiana JavaScript

Wybierz moduł, który jest właścicielem danej odpowiedzialności. Nie twórz drugiego renderera, ścieżki zapisu ani helpera realizującego tę samą funkcję.

Przed dodaniem nowej funkcji wyszukaj istniejący kontrakt i rozszerz go, jeśli jest to właściwe.

Po zmianach uruchom:

```bash
python tools/build.py --kind all
python tools/check_build.py
python tools/dead_code.py
python tools/browser_smoke.py
```

## Jak dodać nowy moduł

Dokładna implementacja zależy od typu modułu, ale moduł trwały powinien zapewniać kontrakt odpowiadający:

```js
{
  id,
  init,
  bind,
  render,
  serialize,
  deserialize,
  reset,
  teardown,
  smokeTest,
  getStats
}
```

### Zalecany proces

1. **Zdefiniuj model danych**
   - Wybierz stabilne identyfikatory rekordów.
   - Określ pola wymagane i opcjonalne.
   - Ustal limity i retencję.

2. **Dodaj normalizację i walidację**
   - Zaktualizuj centralną warstwę storage-validation.
   - Zachowaj zgodność ze starszymi rekordami, jeśli jest wymagana.
   - Brakujące pola normalizuj do bezpiecznych wartości.

3. **Dodaj root UI**
   - Utwórz stabilny element główny w szablonie.
   - Użyj semantycznego HTML i etykiet dostępnościowych.

4. **Zaimplementuj renderowanie**
   - Buduj DOM bezpiecznie.
   - Nie wstawiaj danych użytkownika przez `innerHTML`.
   - Render powinien być idempotentny.

5. **Podepnij zdarzenia przez lifecycle**
   - Użyj stabilnego ownera i klucza.
   - Dla dynamicznych list preferuj delegację.
   - Teardown musi usuwać listenery trwałe.

6. **Zarejestruj moduł**
   - Dodaj go do `ModuleRegistry` we właściwej kolejności.
   - Dodaj mapowanie persistence, jeśli dane mają być zapisywane.

7. **Udostępnij akcje przez serwisy**
   - Kanoniczny CRUD umieść w serwisie aplikacyjnym/domenowym, nie bezpośrednio w click handlerze.

8. **Dodaj import/export**
   - Uwzględnij moduł w pełnym eksporcie.
   - Dodaj eksport/reset modułu, jeśli ma to sens.

9. **Dodaj diagnostykę**
   - Dodaj smoke test.
   - Dodaj semantyczny roundtrip dla danych trwałych.
   - Dodaj asercję browserową, jeśli błąd może zablokować start UI.

10. **Zbuduj i zweryfikuj projekt**

## Storage i kontrakty danych

### Granica storage

Moduły biznesowe nie powinny korzystać bezpośrednio z `window.localStorage`. Niskopoziomowy dostęp znajduje się w wydzielonej warstwie storage capability/backend.

### Normalizacja

Dane ze storage i importu są normalizowane przed użyciem. Nowe pola powinny mieć bezpieczne wartości domyślne, aby starsze backupy nadal działały.

### Limity

Aplikacja stosuje limity liczby rekordów i długości tekstu, aby ograniczać niekontrolowany wzrost localStorage. Dokładne limity zależą od modułu i są widoczne w zaawansowanych ustawieniach danych.

### Zgodność importu

Przy zmianie schematu:

- zachowuj stare pola tylko tak długo, jak jest to konieczne;
- mapuj stare wartości do aktualnego kształtu;
- nie utrzymuj dwóch aktywnych źródeł prawdy;
- dodaj fixture lub scenariusz regresyjny;
- sprawdź eksport → reset → import → porównanie semantyczne.

### Nie zakładaj stałego quota

Dostępna pojemność localStorage zależy od przeglądarki, trybu, polityki i originu. Wskaźnik aplikacji jest pomocą operacyjną, a nie uniwersalną gwarancją.

## Powiązania przepływów biznesowych

Od KF62/KF63 aplikacja obsługuje połączony przepływ:

```text
Rejestr telefonów
        │
        ▼
Sprawa wymagająca odpowiedzi
        ├──► TODO
        ├──► Przypomnienie
        └──► Wpis dziennika
```

Relacje wykorzystują identyfikatory rekordów, nie tylko skopiowany tekst. Runtime może:

- tworzyć rekordy powiązane;
- wyświetlać liczbę relacji;
- przechodzić do rekordu docelowego;
- podświetlać odnaleziony rekord;
- wykrywać i pomijać martwe odwołania;
- uzgadniać integralność workflow.

Przy modyfikacji tych modułów należy zachować referencje i kompatybilną normalizację.

## Dostępność

WorkDesk zawiera mechanizmy dostępnościowe, między innymi:

- nazwy dostępnościowe dla przycisków ikonowych;
- obsługę klawiatury;
- zarządzanie focusem w modalach i warstwach tymczasowych;
- stany ARIA dla kontrolek;
- live regions dla wybranych statusów;
- klawiaturową paletę poleceń;
- globalny portal tooltipów;
- diagnostyczne kontrole dostępności.

Dostępność jest stałym wymaganiem jakościowym, a nie formalnie zakończoną certyfikacją. Zmiany należy sprawdzać samą klawiaturą i, jeśli to możliwe, czytnikiem ekranu.

## Obsługiwane przeglądarki

Aplikacja jest projektowana dla nowoczesnych przeglądarek desktopowych. Głównym testowanym środowiskiem jest Microsoft Edge/Chromium.

Inne aktualne przeglądarki Chromium oraz Firefox mogą działać poprawnie, ale przed wdrożeniem operacyjnym wymagają testu. Polityki dotyczące plików lokalnych, pobierania, schowka, powiadomień lub localStorage mogą wpływać na działanie.

Tryb prywatny/incognito nie jest zalecany, ponieważ dane mogą być automatycznie usuwane.

## Aktualne ograniczenia

- Interfejs aplikacji jest obecnie wyłącznie po polsku.
- Brak wbudowanej synchronizacji chmurowej.
- Brak współpracy wielu użytkowników i rozwiązywania konfliktów.
- Brak serwerowego uwierzytelniania i autoryzacji.
- Dane są związane z originem/profilem przeglądarki do czasu eksportu.
- Pojemność localStorage zależy od środowiska.
- Aplikacja nie zastępuje szyfrowanego menedżera haseł.
- `mailto:` zależy od systemu i skonfigurowanego klienta pocztowego.
- Linki zewnętrzne wymagają sieci lub intranetu.
- Istnieje responsywność mobilna, ale głównym przypadkiem użycia jest desktopowa praca biurowa.
- Projekt nie deklaruje formalnej certyfikacji bezpieczeństwa, dostępności ani compliance.

## Zasady wydawania wersji

Aktualny format łączy wersję aplikacji i wewnętrzny numer buildu KF, np.:

```text
1.66.3-KF64
```

Zalecany release powinien zawierać:

- produkcyjny HTML;
- diagnostyczny HTML;
- paczkę source dev;
- changelog;
- sumy SHA-256;
- zakończone powodzeniem kontrole statyczne;
- zakończony powodzeniem browser smoke test.

Pliki wynikowe traktuj jako artefakty wydania. Kod należy modyfikować w `src/`.

## Współtworzenie

Szczegóły znajdują się w [CONTRIBUTING.md](CONTRIBUTING.md).

Przed zgłoszeniem zmiany:

- odtwórz błąd na najnowszej wersji;
- opisz wpływ widoczny dla użytkownika;
- zaznacz, czy zmiana dotyczy migracji danych;
- podaj kroki weryfikacji;
- uruchom build, checker, dead-code scan i browser smoke test.

## Bezpieczeństwo

Zobacz [SECURITY.md](SECURITY.md).

Nie publikuj w publicznych issue rzeczywistych rekordów operacyjnych, adresów e-mail, linków wewnętrznych ani plików backupu.

## Licencja

Projekt WorkDesk udostępniany jest jako w pełni otwarte oprogramowanie (open-source) na permissive licencji [MIT](LICENSE).

Zezwala się na pełne i nieograniczone modyfikowanie, kopiowanie, używanie, rozpowszechnianie, sublicencjonowanie oraz komercyjne i prywatne wykorzystanie kodu i aplikacji. Pełna treść znajduje się w pliku [LICENSE](LICENSE).

## FAQ

### Czy WorkDesk wymaga instalacji?

Nie. Użytkownik może otworzyć produkcyjny HTML bezpośrednio w nowoczesnej przeglądarce.

### Czy WorkDesk wymaga Internetu?

Funkcje lokalne nie wymagają. Linki internetowe i intranetowe wymagają dostępu do systemu docelowego.

### Czy dane są wysyłane na serwer?

Obecna aplikacja nie wymaga backendu ani usługi telemetrii. Linki skonfigurowane przez użytkownika mogą otwierać systemy zewnętrzne.

### Gdzie są moje dane?

Głównie w localStorage przeglądarki powiązanym z użytym originem i profilem.

### Czy skopiowanie HTML przenosi dane?

Nie. Należy wyeksportować backup JSON i zaimportować go w środowisku docelowym.

### Czy kilka osób może używać wspólnego zestawu danych?

Nie. Obecna wersja jest lokalną aplikacją dla jednego użytkownika.

### Czy istnieje angielski interfejs?

Jeszcze nie. Dokumentacja jest dwujęzyczna, ale UI pozostaje polskie.

### Czy mogę edytować wygenerowany HTML?

Technicznie tak, ale nie jest to zalecane. Zmieniaj `src/` i wykonuj build, aby utrzymać projekt w spójnym stanie.

### Który plik ma otwierać zwykły użytkownik?

`index_KF64.html`. Wersja `_DIAG` służy do testów i diagnostyki.

### Co należy backupować?

Plik produkcyjny, repozytorium źródłowe po własnych modyfikacjach oraz regularne eksporty JSON z danymi użytkownika.
