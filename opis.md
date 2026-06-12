WorkDesk One-Page – Informacje o projekcie

Status projektu

⚠️ Projekt jest obecnie w fazie Draft / Work In Progress.

Aplikacja jest funkcjonalna i może być używana na co dzień, jednak nie jest produktem komercyjnym ani gotowym systemem wdrożeniowym. Jest to rozwijany projekt typu „one-page productivity tool”, który można dostosować do własnych potrzeb.

Dla kogo jest ten projekt?

Projekt został stworzony głównie z myślą o osobach pracujących w:

- korporacjach,
- dużych organizacjach,
- firmach logistycznych,
- działach operacyjnych,
- administracji,
- biurach obsługi klienta,

czyli wszędzie tam, gdzie:

- nie można instalować dodatkowego oprogramowania,
- obowiązują ograniczenia IT,
- brakuje odpowiednich narzędzi wspierających codzienną pracę,
- wiele czynności wykonuje się ręcznie i wielokrotnie każdego dnia.

Aplikacja działa jako pojedynczy plik HTML uruchamiany lokalnie w przeglądarce.

Wymagane podstawowe umiejętności techniczne

Aby dostosować aplikację do własnych potrzeb, potrzebne są przynajmniej minimalne zdolności edycji kodu lub korzystania z narzędzi AI.

Najczęściej wymagane będzie:

- usunięcie przykładowych danych,
- dodanie własnych linków,
- dodanie własnych grup adresowych,
- dodanie własnych szablonów wiadomości,
- konfiguracja kafelków i skrótów,
- dostosowanie danych startowych.

Większość zmian można wykonać bez znajomości programowania, korzystając z pomocy modeli AI.

Wsparcie AI

Kod projektu można rozwijać przy pomocy własnego ulubionego agenta AI, np.:

- ChatGPT,
- Claude,
- Gemini,
- Codex,
- Goose,
- Cursor,
- Windsurf,
- innych narzędzi AI.

Należy jednak pamiętać, że modele AI mogą generować błędny kod lub nieprawidłowe modyfikacje.

Zawsze zaleca się:

- wykonywanie kopii zapasowej przed zmianami,
- testowanie działania aplikacji po każdej modyfikacji,
- zachowanie wcześniejszych wersji pliku.

Brak zależności zewnętrznych

Jednym z głównych założeń projektu jest maksymalna prostota.

Aplikacja:

✅ nie wymaga serwera,

✅ nie wymaga instalacji,

✅ nie wymaga Node.js,

✅ nie wymaga bazy danych,

✅ nie wymaga Docker,

✅ nie wymaga połączenia z Internetem,

✅ nie korzysta z zewnętrznych bibliotek JavaScript.

Wystarczy otworzyć plik HTML w przeglądarce.

Przechowywanie danych

Wszystkie dane przechowywane są lokalnie w przeglądarce użytkownika przy użyciu mechanizmu:

localStorage

Oznacza to, że dane pozostają dostępne po ponownym uruchomieniu przeglądarki.

Ważne ograniczenie

⚠️ Dane zapisane w localStorage mogą zostać utracone.

Może się to zdarzyć między innymi gdy:

- użytkownik wyczyści dane przeglądarki,
- administrator firmowy wyczyści profil użytkownika,
- przeglądarka zostanie zresetowana,
- profil systemowy zostanie usunięty,
- polityki bezpieczeństwa firmy usuną dane lokalne.

Dlatego regularne tworzenie kopii zapasowych jest bardzo ważne.

Zalecenia dotyczące bezpieczeństwa danych

Rekomendowane jest:

1. Regularne eksportowanie danych do plików JSON.
2. Przechowywanie kopii pliku HTML w bezpiecznej lokalizacji.
3. Przechowywanie eksportów JSON na dysku sieciowym lub OneDrive.
4. Wykonywanie backupu przed większymi zmianami w kodzie.
5. Zachowywanie kilku wcześniejszych wersji aplikacji.

Filozofia projektu

Celem projektu nie jest zastąpienie rozbudowanych systemów klasy ERP, CRM czy platform korporacyjnych.

Jego zadaniem jest zapewnienie lekkiego, szybkiego i łatwego do przenoszenia narzędzia, które pomaga wykonywać codzienne zadania biurowe szybciej i wygodniej — szczególnie w środowiskach, gdzie instalacja dodatkowego oprogramowania jest utrudniona lub niemożliwa.

Najważniejsze założenia projektu:

- jeden plik,
- szybkie uruchomienie,
- pełna praca lokalna,
- brak zależności zewnętrznych,
- łatwa personalizacja,
- maksymalna kontrola użytkownika nad własnymi danymi.

OPIS FUNKCJONALNOŚCI

1. Główna idea aplikacji
To lokalna, jednoplikowa aplikacja typu WorkDesk / biurowy kombajn. Ma pomagać w codziennej pracy: szybkie linki, kopiowanie danych, pisanie maili, grupy odbiorców, notatki, TODO, journal, kalendarz, przypomnienia, konwerter, backupy i eksport/import danych.
Dane są trzymane lokalnie w przeglądarce przez localStorage, a główne dane konfiguracyjne aplikacji można eksportować/importować jako JSON. Mechanizm danych używa klucza wd.data.v1, a wymagane sekcje danych to sections, templates, tiles, frequentLinks, knownMails. �
index_new.html
Moduły aplikacji
2. Navbar / pasek górny
Navbar pełni rolę centrum sterowania.
Zawiera:
logo i nazwę aplikacji,
linki: Pulpit, Narzędzia, Pomoc,
zegar z aktualną datą i godziną,
przycisk palety poleceń Ctrl+K,
pomoc / skróty klawiszowe,
przełącznik motywu jasny/ciemny/system,
licznik przerwy,
Pomodoro.
Moduł zegara działa co sekundę i aktualizuje datę oraz godzinę. Timer przerwy pokazuje czas do pełnej godziny i uruchamia popup przerwy przed końcem godziny. �
index_new.html
Uwaga: w ostatnim pliku nadal widzę logikę Focus Mode, mimo że wcześniej planowałeś ją usunąć. Jest jeszcze focusBtn, focusBadge i .layout.focus. �
index_new.html
3. Układ strony / layout
Aplikacja działa w układzie 3-kolumnowym:
Plain text
Lewy sidebar | Pulpit główny | Prawy sidebar
CSS układu:
CSS
grid-template-columns: var(--side-w) minmax(0, 1fr) var(--side-right-w);
Lewy sidebar służy głównie do modułów roboczych, a prawy sidebar zawiera moduły pomocnicze, takie jak kalendarz, narzędzia, journal i dane JSON.
4. Moduł e-mail
To jeden z najważniejszych modułów aplikacji. Jest rozwijany jako składany panel Napisz e-mail.
Główne funkcje:
wybór grup odbiorców,
wyszukiwarka grup,
checkboxy TO / CC / BCC,
globalne zaznaczanie widocznych grup,
pola e-mail: TO, CC, BCC, temat, treść, stopka,
szablony wiadomości,
czyszczenie pól,
podpowiedzi szablonów,
presety podpisów / stopek,
eksport grup do CSV.
Logika grup działa tak, że użytkownik zaznacza grupy odbiorców w odpowiedniej kolumnie TO, CC lub BCC, a aplikacja buduje odpowiednie listy adresów.
Moduł ma też wyszukiwarkę grup i globalny panel email-select-visible, który służy do zaznaczania widocznych wyników po filtrowaniu.
5. Szablony wiadomości
Szablony służą do szybkiego uzupełniania treści maila.
Założenie:
użytkownik wpisuje nazwę szablonu,
aplikacja może podpowiadać pasujące szablony,
po wyborze szablon uzupełnia treść wiadomości,
można czyścić pole szablonu,
button „wyczyść” w sekcji email powinien czyścić również input szablonu.
To jest bardzo praktyczne przy powtarzalnych mailach: zmiana godziny odbioru, opóźnienie, prośba o dokumenty, anulowanie trasy itd.
6. Stopki wiadomości
Masz logikę presetów podpisu:
SHORT,
LONG,
OFFICIAL,
CASUAL.
Przyciski presetów mają klasę .sig-preset, a ich zadaniem jest szybkie wstawienie odpowiedniej stopki do pola podpisu. �
index_new.html
To dobrze pasuje do pracy biurowej, bo pozwala przełączać ton wiadomości bez ręcznego pisania końcówki.
7. Pulpit / tiles
Pulpit główny zawiera kafelki akcji.
Kafelki mogą być różnego typu:
zwykłe linki,
linki IE Mode,
kafelki kopiujące wartości,
kafelki przypięte,
kafelki z QR,
kafelki filtrowane badge’ami.
Masz szybkie filtry:
ALL,
LINKS,
KOPIUJ,
IE MODE.
Są renderowane jako .tile-filter-badges, a aktywny badge dostaje klasę .active. �
index_new.html
Kafelki obsługują też drag & drop, czyli użytkownik może zmieniać kolejność kafelków, a aplikacja zapisuje widoczny układ. �
index_new.html
8. Częste linki
Moduł częstych linków pozwala trzymać listę linków bocznych, prawdopodobnie dla często używanych stron, systemów, paneli, katalogów lub zasobów firmowych.
To dobry moduł do:
systemów kurierskich,
portali firmowych,
OneDrive/SharePoint,
dokumentów,
raportów,
paneli klientów,
map,
formularzy.
9. TODO
Moduł TODO służy do szybkiego zapisywania zadań.
Funkcje:
dodawanie zadania,
oznaczanie jako wykonane,
usuwanie,
licznik zadań,
obsługa wpisów dodawanych z kalendarza.
Po ostatnich zmianach kliknięcie daty w kalendarzu i wybór „Dodaj do TO DO” nie tworzy od razu gotowego wpisu, tylko uzupełnia input TODO datą, aby użytkownik dopisał szczegóły. To jest dobry kierunek, bo nie generuje śmieciowych zadań.
10. Notatki
Moduł notatek działa jako szybkie sticky notes.
Funkcje:
wiele notatek,
dodawanie nowej notatki,
usuwanie,
kolory notatek,
licznik notatek,
zapis lokalny.
Z kalendarza można utworzyć notatkę z datą.
To dobre miejsce na krótkie informacje typu:
Plain text
12.06.2026
Sprawdzić odbiór dokumentów od przewoźnika.
11. Journal / dziennik pracy
Journal jest modułem worklogu: „co robię?”.
Funkcje:
input wpisu,
Enter zapisuje wpis,
każdy wpis dostaje timestamp,
eksport CSV,
czyszczenie wpisów,
licznik wpisów.
W pliku widoczny jest panel Journal · co robię?, input journalInput, przycisk dodawania, lista wpisów, eksport CSV i czyszczenie. �
index_new.html
Po ostatnich poprawkach akcja z kalendarza „Dodaj do Journal” powinna wstawiać datę do inputa Journal, a nie tworzyć wpis automatycznie.
12. Kalendarz
Kalendarz jest jednym z najbardziej rozbudowanych modułów po ostatnich zmianach.
Funkcje:
poprzedni / następny miesiąc,
przycisk „Dziś”,
oznaczanie dzisiejszego dnia,
oznaczanie dni wolnych,
kliknięcie dnia otwiera mini popup akcji,
dzień z przypomnieniem pokazuje ikonę 🔔,
pod kalendarzem jest lista najbliższych przypomnień.
Mini popup dnia ma akcje:
📋 Kopiuj datę,
✉️ Dodaj do treści email,
✅ Dodaj do TO DO,
📝 Utwórz notatkę,
📓 Dodaj do Journal,
🔔 Ustaw przypomnienie,
📅 +7 dni,
📅 +14 dni,
📅 Koniec miesiąca.
Te akcje są widoczne w kodzie menu dnia. �
index_new.html
13. Przypomnienia kalendarza
Przypomnienia działają lokalnie.
Założenie:
Plain text
Klikasz dzień
→ Ustaw przypomnienie
→ wpisujesz godzinę
→ wpisujesz krótką notatkę
→ zapis do localStorage
W kalendarzu dzień z przypomnieniem dostaje oznaczenie 🔔, a lista pod kalendarzem pokazuje najbliższe przypomnienia.
Toast przypomnienia pokazuje komunikat użytkownikowi. W założeniu ma akcje typu:
Odłóż,
Zrobione.
W ostatnim pliku jest lista przypomnień i menu dnia pokazujące przypomnienia dla wybranego dnia. �
index_new.html
14. Narzędzia
Panel narzędzi zawiera szybkie akcje biurowe.
Widoczne funkcje:
Data PL,
Data ISO,
UPPER/lower dla zaznaczenia w treści,
generator hasła,
konwerter,
czas / data robocza,
generator ID / UUID.
Te przyciski są widoczne w sekcji narzędzi. �
index_new.html
To bardzo praktyczny moduł do codziennych, małych operacji, które normalnie wymagają osobnych stron lub Excela.
15. Konwerter
Konwerter obsługuje przeliczanie wartości, a po Twoich zmianach ma edytowalne kursy walut.
Funkcje:
wpisanie kwoty,
wybór jednostki/waluty wejściowej,
wybór jednostki/waluty wyjściowej,
edycja kursów walut,
reset kursów,
informacja pomocnicza.
To ważne, bo użytkownik może ręcznie poprawić kurs według aktualnego notowania lub kursu firmowego.
16. Generator haseł
Moduł generatora haseł pozwala tworzyć hasła z opcjami:
długość,
wielkie litery,
małe litery,
cyfry,
znaki specjalne,
siła hasła,
kopiowanie.
Dobry moduł pomocniczy do pracy z kontami testowymi, panelami, dostępami itd.
17. Generator ID / UUID
Generator ID / UUID służy do szybkiego tworzenia identyfikatorów.
Przydatne do:
testów,
numerów roboczych,
unikalnych nazw,
tymczasowych referencji,
ticketów,
identyfikatorów w JSON.
18. QR
Aplikacja ma moduł QR, prawdopodobnie generowany dla linków lub wartości z kafelków.
W kodzie widać osobny .qr-host, .qr-text, przyciski QR na kafelkach i modal QR.
To przydatne, gdy chcesz szybko przenieść link na telefon.
19. Dane JSON
Panel Dane (JSON) to fundament konfiguracyjny aplikacji.
Obsługuje:
eksport danych do JSON,
import danych z JSON,
reset do danych wbudowanych,
drag & drop pliku JSON,
walidację wymaganych pól,
wskaźnik domyślne / edytowane.
Eksport tworzy plik workdesk-data-YYYY-MM-DD.json. Import pyta o potwierdzenie, waliduje strukturę i odświeża grupy, szablony, kafelki oraz linki. �
index_new.html
To bardzo dobra decyzja architektoniczna dla one-page HTML, bo pozwala aktualizować dane bez edycji kodu.
20. Backupy
Aplikacja ma też mechanizm backupów w localStorage.
Funkcje:
automatyczny backup dzienny,
klucze typu wd.backup.YYYY-MM-DD,
lista backupów,
rozmiar backupu,
przywracanie backupu,
rotacja starych backupów.
W kodzie widać funkcje todayBackupKey, listBackups, createBackup, rotateBackups, ensureDailyBackup, restoreBackup. �
index_new.html
To bardzo ważne, bo przy aplikacji lokalnej łatwo przypadkiem nadpisać dane.
21. Import przez drag & drop
Aplikacja ma drop overlay do importu danych JSON.
Założenie:
Plain text
Przeciągasz plik JSON na stronę
→ pojawia się overlay
→ aplikacja czyta plik
→ waliduje strukturę
→ pyta o potwierdzenie
→ importuje dane
To wygodne do pracy z jednoplikową aplikacją bez backendu.
22. Paleta poleceń Ctrl+K
Paleta poleceń daje szybki dostęp do funkcji aplikacji.
Założenie:
użytkownik naciska Ctrl+K,
wpisuje nazwę funkcji,
wybiera akcję,
aplikacja uruchamia odpowiedni moduł.
To dobry kierunek, szczególnie przy rosnącej liczbie narzędzi.
23. Motyw jasny / ciemny
Aplikacja ma tryb:
system,
jasny,
ciemny.
CSS zawiera dużo reguł [data-theme="light"], więc motyw jasny jest realnie dopracowany, a nie tylko częściowy. �
