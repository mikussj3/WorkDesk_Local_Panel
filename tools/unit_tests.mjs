#!/usr/bin/env node
/**
 * Testy jednostkowe czystych funkcji WorkDesk (Faza 4 audytu).
 *
 * node --test tools/unit_tests.mjs   (lub: npm run test:unit)
 *
 * Bez zależności produkcyjnych — zgodnie z filozofią projektu. Pliki src ładowane są
 * przez vm.runInThisContext w kolejności manifestu (model wielu <script> w jednym
 * zasięgu leksykalnym), z minimalnymi shimami DOM wystarczającymi dla warstwy
 * walidacji (00 → 27 → 28 → 40 → 60) oraz wprost dla modułów czystych (28, 111).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// --- shims DOM (wystarczające dla warstwy storage/walidacji przy eval) ---
globalThis.window = new EventTarget();
globalThis.document = {
  title: '',
  documentElement: { dataset: {}, classList: { add() {} } },
  body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
};
globalThis.location = new URL('file:///workdesk/index.html');
globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => store.set(String(k), String(v)),
    removeItem: k => store.delete(String(k)),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: i => Array.from(store.keys())[i] ?? null,
  };
})();
window.localStorage = globalThis.localStorage;
window.document = globalThis.document;
window.location = globalThis.location;

// --- ładowanie plików runtime (kolejność jak w build-manifest) ---
for (const rel of [
  'src/runtime/shared/00-event-lifecycle.js',
  'src/runtime/shared/27-storage-capability.js',
  'src/runtime/shared/28-pure-helpers.js',
  'src/runtime/shared/40-storage-core.js',
  'src/runtime/shared/60-storage-validation.js',
  'src/runtime/shared/111-qr-codec.js',
]) {
  vm.runInThisContext(load(rel), { filename: rel });
}
const api = vm.runInThisContext(`({
  cloneData, parseTimestamp, normalizeTimestamp, validDateISO, validTime,
  csvEscape, csvUnguardCell, csvSafeCell, normalizeSearchText, searchScore,
  validateTodoItem, validateJournalEntry, validateNote, validateReminder, QR
})`, { filename: 'api-export.js' });

// ============ cloneData ============
test('cloneData: niezależna kopia zagnieżdżonych struktur', () => {
  const src = { a: [1, { b: 'x' }] };
  const copy = api.cloneData(src);
  assert.deepEqual(copy, src);
  assert.notEqual(copy, src);
  copy.a[1].b = 'zmienione';
  assert.equal(src.a[1].b, 'x');
});
test('cloneData: null/undefined zgodnie z kontraktem aplikacji', () => {
  assert.equal(api.cloneData(null), null);
  assert.equal(api.cloneData(undefined), undefined);
});

// ============ daty ============
test('validDateISO: format + zakresy (rok przestępny)', () => {
  assert.equal(api.validDateISO('2026-08-15'), true);
  assert.equal(api.validDateISO('2028-02-29'), true);   // 2028 przestępny
  assert.equal(api.validDateISO('2026-02-29'), false);
  assert.equal(api.validDateISO('2026-13-01'), false);
  assert.equal(api.validDateISO('2026-00-10'), false);
  assert.equal(api.validDateISO('2026-8-15'), false);   // brak zer wiodących
  assert.equal(api.validDateISO('15-08-2026'), false);
  assert.equal(api.validDateISO(''), false);
  assert.equal(api.validDateISO(123), false);
});
test('validTime: godziny 00:00-23:59, minuty 00-59', () => {
  assert.equal(api.validTime('00:00'), true);
  assert.equal(api.validTime('23:59'), true);
  assert.equal(api.validTime('24:00'), false);
  assert.equal(api.validTime('99:99'), false);
  assert.equal(api.validTime('12:5'), false);
  assert.equal(api.validTime('12:60'), false);
});
test('parseTimestamp/normalizeTimestamp: liczby, ISO, śmieci', () => {
  assert.equal(api.parseTimestamp(1714557600000), 1714557600000);
  assert.equal(api.parseTimestamp('2024-05-01T10:00:00Z'), Date.parse('2024-05-01T10:00:00Z'));
  assert.equal(api.parseTimestamp('to nie jest data'), null);
  assert.equal(api.normalizeTimestamp('2024-05-01T10:00:00Z'), Date.parse('2024-05-01T10:00:00Z'));
  assert.equal(api.normalizeTimestamp(-5), null);
  assert.equal(api.normalizeTimestamp('abc'), null);
});

// ============ CSV ============
test('csvEscape: ochrona formuł + cytowanie + round-trip unguard', () => {
  assert.equal(api.csvEscape('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(api.csvEscape('-Dział'), "'-Dział");
  assert.equal(api.csvEscape('@cmd'), "'@cmd");
  assert.equal(api.csvEscape('+2'), "'+2");
  assert.equal(api.csvEscape('zwykły tekst'), 'zwykły tekst');
  assert.equal(api.csvEscape('a;b'), '"a;b"');
  assert.equal(api.csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(api.csvEscape('linia\n2'), '"linia\n2"');
  // round-trip własnego eksportu: eksport -> unguard odtwarza oryginał
  for (const value of ['-Dział', '=SUM(A1)', 'zwykły', '@x']) {
    assert.equal(api.csvUnguardCell(api.csvEscape(value)), value);
  }
});
test('csvSafeCell: wariant starszy (bez cytowania) zachowuje ochronę formuł', () => {
  assert.equal(api.csvSafeCell('=1+1'), "'=1+1");
  assert.equal(api.csvSafeCell('plain'), 'plain');
});

// ============ wyszukiwanie ============
test('normalizeSearchText: diakrytyki PL normalizowane', () => {
  assert.equal(api.normalizeSearchText('Łódź Życzenia'), 'lodz zyczenia');
  assert.equal(api.normalizeSearchText('ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ'), 'acelnoszz acelnoszz');
  assert.equal(api.normalizeSearchText('Đev'), 'dev');
  assert.equal(api.normalizeSearchText('  dużo   spacji  '), 'duzo spacji');
});
test('searchScore: ranking trafień i odrzucanie nietrafionych', () => {
  const entry = {
    normalizedTitle: 'sprawa pilna',
    normalizedSubtitle: 'kontakt',
    normalizedCategory: 'sprawy',
    normalizedKeywords: 'baza',
  };
  assert.equal(api.searchScore({ ...entry, normalizedTitle: 'pilna' }, ['pilna'], 'pilna') > api.searchScore(entry, ['pilna'], 'pilna'), true);
  assert.equal(api.searchScore(entry, ['pilna'], 'pilna') > 0, true);
  assert.equal(api.searchScore(entry, ['nieistnieje'], 'nieistnieje'), -1);
  const exact = api.searchScore({ ...entry, normalizedTitle: 'x' }, ['x'], 'x');
  const partial = api.searchScore({ ...entry, normalizedTitle: 'x-start' }, ['x'], 'x');
  assert.equal(exact > partial, true, 'pełne trafienie w tytuł > przedrostkowe');
});

// ============ walidatory importu ============
const base = { id: 'rec1', createdAt: 1714557600000 };
test('validateTodoItem: happy-path zachowuje pola (w tym id)', () => {
  const r = api.validateTodoItem({ ...base, text: 'zadanie', done: true, priority: 'high', dueDate: '2026-08-15' });
  assert.equal(r.valid, true);
  assert.equal(r.value.id, 'rec1');
  assert.equal(r.value.text, 'zadanie');
  assert.equal(r.value.done, true);
  assert.equal(r.value.priority, 'high');
  assert.equal(r.value.dueDate, '2026-08-15');
  assert.ok(!r.repaired);
});
test('validateTodoItem: whitelista pól + naprawy', () => {
  const r = api.validateTodoItem({ ...base, text: 'x', injected: 'PAYLOAD', priority: 'ultra', dueDate: '2026-13-40' });
  assert.equal(r.valid, true);
  assert.equal('injected' in r.value, false);
  assert.equal(r.value.priority, 'normal');
  assert.equal(r.value.dueDate, '');
  assert.equal(r.warnings.some(w => w.includes('injected')), true);
  const noId = api.validateTodoItem({ text: 'x', createdAt: 1 });
  assert.notEqual(noId.value.id, '');
  assert.equal(noId.value.id.length <= 120, true);
});
test('validateTodoItem: ISO createdAt konwertowane, nie nadpisywane', () => {
  const r = api.validateTodoItem({ text: 'x', createdAt: '2024-05-01T10:00:00Z' });
  assert.equal(r.value.createdAt, Date.parse('2024-05-01T10:00:00Z'));
});
test('validateReminder: zła data/godzina odrzucone lub naprawione', () => {
  assert.equal(api.validateReminder({ ...base, text: 'r', date: '2026-13-40', time: '10:00' }).valid, false);
  const repaired = api.validateReminder({ text: 'r', date: '2026-08-15', time: '99:99' });
  assert.equal(repaired.valid, true);
  assert.equal(repaired.value.time, '09:00');
});
test('validateNote: kolor poza paletą naprawiany, title zachowany', () => {
  const r = api.validateNote({ ...base, text: 'n', title: 'Notatka', color: 'rozowy' });
  assert.equal(r.valid, true);
  assert.equal(r.value.color, 'amber');
  assert.equal(r.value.title, 'Notatka');
  assert.equal(r.value.pinned, false);
});
test('validateJournalEntry: brak typu -> "info"', () => {
  const r = api.validateJournalEntry({ ...base, text: 'w' });
  assert.equal(r.value.type, 'info');
});

// ============ QR (ISO/IEC 18004, poziom M) ============
test('QR: wewnętrzna spójność tabeli wersji (Σbloki=data, data+ec·bloki=total)', () => {
  // dane referencyjne ISO 18004 poziom M dla wersji 1-10 (liczba słów danych)
  const ISO_M_DATA = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
  const sizes = [];
  for (const cap of api.QR.caps) {
    const blocksData = cap.blocks.reduce((sum, [d]) => sum + d, 0);
    const blocksCount = cap.blocks.length;
    assert.equal(blocksData, cap.data, `v${cap.v}: suma bloków danych ${blocksData} ≠ deklarowane ${cap.data}`);
    assert.equal(cap.data + cap.ec * blocksCount, cap.total, `v${cap.v}: data+ec×bloki ≠ total`);
    assert.equal(cap.data, ISO_M_DATA[cap.v - 1], `v${cap.v}: pojemność niezgodna z ISO M`);
    sizes.push(cap.v);
  }
  assert.deepEqual(sizes, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
test('QR: rozmiar macierzy 4·wersja+17 dla v1, v5, v10', () => {
  assert.equal(api.QR.make('A'.repeat(10)).length, 21);    // 10 B -> v1
  assert.equal(api.QR.make('B'.repeat(70)).length, 37);    // 70 B -> v5
  assert.equal(api.QR.make('C'.repeat(200)).length, 57);   // 200 B -> v10
});
test('QR: granica pojemności — 213 bajtów OK, 214 odrzucone', () => {
  assert.equal(api.QR.capacityBytes, 213);
  assert.doesNotThrow(() => api.QR.make('A'.repeat(213)));
  assert.throws(() => api.QR.make('A'.repeat(214)));
});
test('QR: deterministyczne kodowanie (ten sam tekst -> identyczny SVG)', () => {
  const a = api.QR.toSVG(api.QR.make('workdesk-determinizm'));
  const b = api.QR.toSVG(api.QR.make('workdesk-determinizm'));
  assert.equal(a, b);
  assert.ok(a.startsWith('<svg'));
});
test('QR: UTF-8 — polskie znaki kodowane (2 bajty/znak)', () => {
  const m = api.QR.make('ąęś');   // 3 znaki = 6 bajtów UTF-8 -> v1
  assert.equal(m.length, 21);
  const m2 = api.QR.make('ąęśźć ńół');   // 17 bajtów -> v2
  assert.equal(m2.length, 25);
});
