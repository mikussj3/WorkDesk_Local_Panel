# Desk Hub  

***************
This is a draft application, and all links, email groups, templates, etc., require manual modification of the inex.html file. This file is for more technical users who can customize the entire experience to their needs.
***************

Desk Hub is a local, browser-based work hub designed for office employees and corporate teams that need a single practical place for everyday tasks. It acts as a lightweight desktop-style dashboard for links, templates, email groups, notes, quick actions, and small productivity tools. The current version is a **draft prepared for Poland**, including Polish language defaults and a Polish-oriented calendar, and it still requires adaptation for individual audiences depending on location and workflow. [file:1]

Desk Hub is optimized for Microsoft Edge and is intended to work best when opened locally in that browser. Some links and flows may rely on Edge-specific behavior, including attempts to open certain resources directly in **Internet Explorer mode** when that is supported in the environment (The goal is to open folders in the old-school Internet Explorer style, i.e., directly opening a folder from a link saved on a page.). [file:1]

## Installation

Save the `index.html` file locally on your device and open it directly in the browser. Microsoft Edge is the recommended browser, because the application is tuned for Edge behavior and may try to use Internet Explorer mode for some direct links or legacy workflows. No external libraries or backend setup are required. [file:1]

## Usage

Open the file and use the main dashboard as a central place for daily work. The interface groups the most common office actions into one view: email organization, template snippets, quick links, task helpers, notes, timers, and command-driven shortcuts. The goal is to reduce context switching and keep routine work fast, predictable, and easy to access. [file:1]

The email area supports structured group management and snippet-driven message composition. In message content, you can type shortcuts like `/podpis`, `/data`, or `/nip` to insert ready-made fragments, and the app also supports generating ready-to-paste code for insertion into the correct place inside `index.html`. [file:1]

The data import flow accepts simple `Section,Group,Email` input, with support for both commas and semicolons as separators. Duplicate entries are skipped, missing sections and groups are created automatically, and daily backups are stored locally in `localStorage` with a 7-day rotation. [file:1]

## Customization

This project is intentionally simple to customize by editing `index.html` directly. Templates and email groups can be added manually in the appropriate section of the file, or you can generate ready-made code and paste it into the right place without rebuilding the app structure from scratch. That makes it practical for teams that want full control over their own internal setup. [file:1]

Because the current release is a Poland-focused draft, customization should also cover language, date/calendar behavior, and any region-specific assumptions. Different users or organizations may want different calendar conventions, wording, or workflow defaults, so the app is designed as a starting point rather than a final universal distribution. [file:1]

The layout, sidebar behavior, and panel sizes can also be adjusted directly in CSS. This is useful when adapting the hub to different monitors, user preferences, or larger internal datasets that require more room in the interface. [file:1]

## Contributing

Contributions should focus on improving the local workflow experience, extending the available templates, refining the email-group structure, and adapting the hub for different locales. Since the app is built as a standalone HTML file, contributions are easiest when they preserve the no-dependency approach and keep the tool simple to deploy. [file:1]

If you add new modules or localization changes, keep the code self-contained and easy to paste into `index.html`. The project is intentionally designed so that new snippets, groups, and internal workflows can be introduced without requiring external services or a complex build pipeline. [file:1]

## License

This project is free to use. [file:1]

---

# Desk Hub

***************
Jest to draft aplikacji i wszystkie linki i grupy email, szablony itd wymagają ręcznej modyfikacji pliku inex.html  Plik dla osób bardziej technicznych którzy dopasują całość do swoich wymagań.
***************

Desk Hub to lokalny, przeglądarkowy hub roboczy zaprojektowany dla pracowników biurowych i zespołów korporacyjnych, którzy potrzebują jednego praktycznego miejsca do codziennych zadań. Działa jak lekki pulpit typu desktop dla linków, szablonów, grup e-mail, notatek, szybkich akcji i prostych narzędzi produktywności. Obecna wersja to **draft przygotowany pod Polskę**, z polskim językiem i kalendarzem, i nadal wymaga dopracowania pod indywidualnego odbiorcę w zależności od lokalizacji oraz sposobu pracy. [file:1]

Desk Hub jest zoptymalizowany pod Microsoft Edge i najlepiej działa po otwarciu lokalnego pliku właśnie w tej przeglądarce. Część linków i przepływów może wykorzystywać zachowanie charakterystyczne dla Edge, łącznie z próbą otwierania niektórych zasobów bezpośrednio w trybie **Internet Explorer mode**, jeśli środowisko to obsługuje. (Celem jest otwieranie folderów w starym stylu Internet Explorer czyli bezpośrednie otwarcie folderu z linku zapisanego na stronie.) [file:1]



## Instalacja

Zapisz plik `index.html` lokalnie na urządzeniu i otwórz go bezpośrednio w przeglądarce. Zalecany jest Microsoft Edge, ponieważ aplikacja jest dostosowana do jego działania i może próbować używać trybu Internet Explorer mode dla niektórych bezpośrednich linków lub starszych przepływów. Nie są wymagane zewnętrzne biblioteki ani backend. [file:1]

## Użycie

Otwórz plik i korzystaj z głównego panelu jako centralnego miejsca pracy. Interfejs porządkuje najczęstsze czynności biurowe w jednym widoku: organizację e-maili, fragmenty szablonów, szybkie linki, pomocnicze zadania, notatki, timery i skróty oparte na komendach. Celem jest ograniczenie przełączania kontekstu i utrzymanie rutynowej pracy w szybkim, przewidywalnym i łatwo dostępnym układzie. [file:1]

Sekcja e-mail wspiera uporządkowane zarządzanie grupami oraz tworzenie wiadomości na bazie snippetów. W treści wiadomości można wpisywać skróty takie jak `/podpis`, `/data` lub `/nip`, aby wstawić gotowe fragmenty, a aplikacja wspiera też generowanie gotowego kodu do wklejenia we właściwe miejsce pliku `index.html`. [file:1]

Import danych obsługuje prosty format `Sekcja,Grupa,Email` oraz separatory w postaci przecinka i średnika. Duplikaty są pomijane, brakujące sekcje i grupy tworzą się automatycznie, a dzienne kopie zapasowe trafiają lokalnie do `localStorage` z rotacją 7-dniową. [file:1]

## Dostosowanie

Projekt jest celowo prosty do dostosowania poprzez bezpośrednią edycję `index.html`. Szablony i grupy e-mail można dodać ręcznie w odpowiedniej sekcji pliku albo wygenerować gotowy fragment kodu i wkleić go we właściwe miejsce bez przebudowy całej aplikacji od zera. To rozwiązanie jest wygodne dla zespołów, które chcą mieć pełną kontrolę nad własną konfiguracją wewnętrzną. [file:1]

Ponieważ aktualne wydanie jest draftem skupionym na Polsce, dostosowanie powinno obejmować także język, zachowanie kalendarza i wszystkie założenia regionalne. Różni odbiorcy lub organizacje mogą potrzebować innych konwencji dat, innego słownictwa lub innych domyślnych przepływów pracy, dlatego aplikacja jest punktem wyjścia, a nie ostateczną uniwersalną dystrybucją. [file:1]

Układ, zachowanie sidebaru i szerokości paneli można również regulować bezpośrednio w CSS. Jest to przydatne podczas dopasowywania narzędzia do różnych monitorów, preferencji użytkowników lub większych zbiorów danych, które wymagają więcej miejsca w interfejsie. [file:1]

## Współpraca

Wkład w projekt powinien skupiać się na usprawnianiu lokalnego workflow, rozbudowie szablonów, dopracowaniu struktury grup e-mail i dostosowaniu narzędzia do różnych lokalizacji. Ponieważ aplikacja jest zbudowana jako samodzielny plik HTML, najłatwiejsze są zmiany, które zachowują brak zależności i prostotę wdrożenia. [file:1]

Jeśli dodajesz nowe moduły albo zmiany związane z lokalizacją, utrzymuj kod w formie samowystarczalnej i łatwej do wklejenia do `index.html`. Projekt został celowo zaprojektowany tak, aby nowe snippety, grupy i wewnętrzne workflow dało się wprowadzać bez usług zewnętrznych i bez złożonego pipeline’u buildów. [file:1]

## Licencja

Projekt jest darmowy w użyciu. [file:1]
