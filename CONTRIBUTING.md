# Contributing to WorkDesk

[Polski poniżej](#współtworzenie-workdesk)

## Contribution scope

WorkDesk is a local, single-file browser application with modular development sources. Changes should preserve offline operation, backward-compatible data handling and the single-file production output.

## Before opening an issue

- Verify the problem on the latest release.
- Test the production build, not only the diagnostic build.
- Record exact reproduction steps.
- Remove private email addresses, internal URLs and operational data.
- State the browser and operating system.
- Attach console errors only after sanitizing them.

## Development rules

- Modify `src/`, never only `dist/`.
- Do not add direct business-module writes to `localStorage`.
- Do not add duplicate renderers or parallel state stores.
- Use `EventLifecycle` for persistent events.
- Use `SchedulerService` for timers and debounced work.
- Preserve accessible names and keyboard behavior.
- Add normalization for schema changes.
- Maintain compatibility with existing backups where feasible.
- Prefer consolidating existing code over appending override layers.

## Required verification

```bash
python tools/build.py --kind all
python tools/check_build.py
python tools/dead_code.py
python tools/browser_smoke.py
```

A pull request should explain:

- the problem;
- the user-visible effect;
- the implementation approach;
- data migration impact;
- tests performed;
- rollback considerations.

---

# Współtworzenie WorkDesk

## Zakres zmian

WorkDesk jest lokalną aplikacją przeglądarkową dystrybuowaną jako jeden plik HTML, ale rozwijaną z modułowych źródeł. Zmiany muszą zachować pracę offline, kompatybilność danych i pojedynczy plik produkcyjny.

## Przed zgłoszeniem błędu

- Potwierdź problem na najnowszej wersji.
- Sprawdź build produkcyjny, nie tylko diagnostyczny.
- Zapisz dokładne kroki reprodukcji.
- Usuń prywatne adresy e-mail, linki wewnętrzne i dane operacyjne.
- Podaj przeglądarkę i system operacyjny.
- Logi konsoli dołączaj dopiero po anonimizacji.

## Zasady rozwoju

- Modyfikuj `src/`, nie tylko `dist/`.
- Nie dodawaj bezpośrednich zapisów `localStorage` w modułach biznesowych.
- Nie twórz równoległych rendererów ani drugiego store.
- Trwałe zdarzenia rejestruj przez `EventLifecycle`.
- Timery i debounce rejestruj przez `SchedulerService`.
- Zachowuj dostępne nazwy i obsługę klawiatury.
- Przy zmianie schematu dodaj normalizację.
- W miarę możliwości zachowuj zgodność ze starszymi backupami.
- Konsoliduj istniejący kod zamiast dodawać kolejne warstwy nadpisań.

## Wymagana weryfikacja

```bash
python tools/build.py --kind all
python tools/check_build.py
python tools/dead_code.py
python tools/browser_smoke.py
```

Pull request powinien opisywać:

- problem;
- wpływ na użytkownika;
- sposób naprawy;
- wpływ na migrację danych;
- wykonane testy;
- możliwość rollbacku.
