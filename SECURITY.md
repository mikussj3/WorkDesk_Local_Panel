# Security Policy

[Polski poniżej](#polityka-bezpieczeństwa)

## Supported version

Security fixes should be applied to the newest maintained KF release unless the repository owner explicitly declares additional supported versions.

## Reporting a vulnerability

Do not publish a vulnerability containing real operational data in a public issue.

Report privately to the repository owner using the private security-reporting channel configured for the repository. Include:

- affected version/build;
- reproduction steps;
- impact;
- proof of concept using synthetic data;
- suggested mitigation, if known.

## Security model

WorkDesk is a local browser application. It has no required backend in the current architecture, but local data can still be exposed through:

- access to the operating-system or browser profile;
- malicious browser extensions;
- unsafe backup handling;
- modified application files;
- untrusted imported JSON;
- links opened in external systems.

## User responsibilities

- Protect the operating-system account.
- Keep backup files private.
- Do not store secrets that require encrypted-vault protection.
- Import data only from trusted sources.
- Verify SHA-256 checksums for distributed release artifacts.
- Keep a known-good application file and independent data backups.

---

# Polityka bezpieczeństwa

## Obsługiwana wersja

Poprawki bezpieczeństwa powinny trafiać do najnowszej utrzymywanej wersji KF, chyba że właściciel repozytorium jawnie wskaże inne wspierane wersje.

## Zgłaszanie podatności

Nie publikuj w publicznym issue podatności zawierającej rzeczywiste dane operacyjne.

Zgłoszenie przekaż prywatnie właścicielowi repozytorium przez skonfigurowany kanał bezpieczeństwa. Podaj:

- wersję/build;
- kroki reprodukcji;
- wpływ;
- proof of concept na danych syntetycznych;
- proponowaną mitigację, jeśli jest znana.

## Model bezpieczeństwa

WorkDesk jest lokalną aplikacją przeglądarkową. Obecna architektura nie wymaga backendu, ale dane lokalne mogą zostać ujawnione przez:

- dostęp do konta systemowego lub profilu przeglądarki;
- złośliwe rozszerzenia;
- niebezpieczne przechowywanie backupów;
- zmodyfikowany plik aplikacji;
- niezaufany import JSON;
- linki otwierane w systemach zewnętrznych.

## Obowiązki użytkownika

- Chroń konto systemowe.
- Zabezpieczaj pliki backupu.
- Nie przechowuj sekretów wymagających szyfrowanego sejfu.
- Importuj dane wyłącznie z zaufanych źródeł.
- Weryfikuj sumy SHA-256 artefaktów wydania.
- Zachowuj znany poprawny plik aplikacji i niezależne backupy danych.
