#!/usr/bin/env python3
"""Skan jakości kodu runtime WorkDesk.

Filtr 1 — nieużywane funkcje: deklaracje `function name(` oraz `const/let name = … =>`
        zreferencjonowane tekstowo najwyżej raz (definicja) w całym bundlu.
Filtr 3 — symbole zakazane/historyczne egzekwowane PRZED wyjściem (m.in. RuntimeBridge).
Filtr 4 — spójność manifestu z dyskiem: brakujące pliki = błąd; pliki poza manifestem = ostrzeżenie.

Uwaga: detekcja WYWOŁAŃ NIEZADEKLAROWANYCH identyfikatorów (klasa błędów K1–K5 z audytu)
odbywa się analizą AST w tools/check_undeclared.mjs (uruchamianym przez check_build.py) —
heurystyka tekstowa nie odróżnia wywołań od metod-shorthand w literałach obiektów.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / 'build-manifest.json').read_text(encoding='utf-8'))
JS_PATHS = [ROOT / p for p in MANIFEST['shared'] + MANIFEST['production_entry'] + MANIFEST['diagnostic_overlay'] if p.endswith('.js')]
SOURCE = '\n'.join(p.read_text(encoding='utf-8') for p in JS_PATHS)

issues = []

# --- Filtr 1: nieużywane funkcje (deklaracje funkcyjne i strzałkowe) ---
declared_functions = set()
declared_functions.update(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', SOURCE))
declared_functions.update(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>', SOURCE))
declared_functions.update(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*function\b', SOURCE))
for name in sorted(declared_functions):
    if name.startswith('_'):
        continue
    refs = len(re.findall(rf'\b{re.escape(name)}\b', SOURCE))
    if refs <= 1:
        issues.append(f'nieużywana funkcja: {name}')

# --- Filtr 3: symbole zakazane/historyczne (egzekwowane przed wyjściem) ---
for token in ('RuntimeBridge', 'BusinessRenderers', 'BusinessModuleLifecycle'):
    if token in SOURCE:
        issues.append(f'zakazany symbol obecny: {token}')
for pattern in (r'\b[A-Za-z_$][\w$]*PF\d+\b', r'\bLegacyStateDebugAssert\b', r'\bregisterModuleAction\b', r'\bmoduleActionNativeDialogAudit\b'):
    hits = sorted(set(re.findall(pattern, SOURCE)))
    issues.extend(f'symbol historyczny: {x}' for x in hits)

# --- Filtr 4: spójność manifestu z dyskiem ---
warnings = []
shared_dir = ROOT / 'src/runtime/shared'
on_disk = {p.name for p in shared_dir.glob('*.js')}
in_manifest = {Path(p).name for p in MANIFEST['shared']}
for missing in sorted(in_manifest - on_disk):
    issues.append(f'manifest wskazuje nieistniejący plik: {missing}')
for extra in sorted(on_disk - in_manifest):
    warnings.append(f'plik poza manifestem (nie trafia do buildu): src/runtime/shared/{extra}')

# --- raport ---
for warning in warnings:
    print('OSTRZEŻENIE:', warning)
if issues:
    print('dead-code scan: FAIL')
    for issue in issues:
        print(' -', issue)
    sys.exit(1)
print('dead-code scan: PASS')
