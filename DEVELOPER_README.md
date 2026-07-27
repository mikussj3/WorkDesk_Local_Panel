# WorkDesk KF64 — source dev

Źródła deweloperskie wersji 1.66.3-KF64. Dystrybucja nadal powstaje jako pojedynczy plik HTML, natomiast logika jest dzielona na moduły w `src/runtime/shared`.

## Build

```bash
python tools/build.py --kind all
python tools/check_build.py
```

Wyniki znajdują się w `dist/index_KF64.html` i `dist/index_KF64_DIAG.html`.

## Nowa granica runtime

`140-business-workflow.js` odpowiada wyłącznie za relacje i konwersje między telefonami, sprawami, TODO, przypomnieniami i dziennikiem. Normalizacja relacji znajduje się w warstwie walidacji, a renderery jedynie wywołują usługę przepływu.

## Test UI w Chromium

```bash
python tools/browser_smoke.py
```

Test wymaga wyrenderowania kafelków, kalendarza, grup e-mail, TODO, notatek i dziennika bez błędów JavaScript.
