#!/usr/bin/env node
/**
 * Detektor niezadeklarowanych identyfikatorów w pozycji wywołania (klasa błędów
 * K1–K5 z audytu: hideModals, openCalendarDayMenu, ClipboardFeedback, localISODate).
 *
 * Analizuje CAŁY skonkatenowany bundel (kolejność z build-manifest.json) parserem
 * acorn: nazwa w pozycji callee (Call/NewExpression) musi być albo zadeklarowana
 * gdziekolwiek w bundlu (var/let/const/function/class/parametr/wzorzec destrukcyjny),
 * albo należeć do znanych globali przeglądarki.
 *
 * Użycie: node tools/check_undeclared.mjs  (exit 1 + raport przy wykryciu)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'build-manifest.json'), 'utf8'));
const files = [...manifest.shared, ...manifest.production_entry, ...manifest.diagnostic_overlay]
  .filter(p => p.endsWith('.js'));
const source = files.map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');

const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });

const declared = new Set();
function collectPattern(pat) {
  if (!pat) return;
  switch (pat.type) {
    case 'Identifier':
      declared.add(pat.name);
      break;
    case 'ObjectPattern':
      pat.properties.forEach(p => collectPattern(p.type === 'Property' ? p.value : p.argument));
      break;
    case 'ArrayPattern':
      pat.elements.forEach(e => collectPattern(e));
      break;
    case 'AssignmentPattern':
      collectPattern(pat.left);
      break;
    case 'RestElement':
      collectPattern(pat.argument);
      break;
  }
}
walk.full(ast, node => {
  switch (node.type) {
    case 'VariableDeclarator':
      collectPattern(node.id);
      break;
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
    case 'FunctionExpression':
      if (node.id) declared.add(node.id.name);
      if (node.params) node.params.forEach(collectPattern);
      break;
    case 'ArrowFunctionExpression':
      if (node.params) node.params.forEach(collectPattern);
      break;
    case 'CatchClause':
      collectPattern(node.param);
      break;
  }
});

const GLOBALS = new Set(`window document frames self globalThis top parent
localStorage sessionStorage console crypto navigator location history performance
JSON Math Date Promise Object Array Number String Boolean Symbol Map Set WeakMap WeakSet
Error TypeError RangeError SyntaxError ReferenceError EvalError URIError AggregateError
DOMException URL URLSearchParams Blob File FileReader TextEncoder TextDecoder
AbortController Proxy Reflect BigInt Intl RegExp Infinity NaN undefined
requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback
setTimeout clearTimeout setInterval clearInterval queueMicrotask structuredClone fetch
encodeURIComponent decodeURIComponent encodeURI decodeURI isFinite isNaN
parseFloat parseInt alert confirm prompt atob btoa
Event CustomEvent KeyboardEvent PointerEvent MouseEvent FocusEvent InputEvent PageTransitionEvent
ErrorEvent PromiseRejectionEvent MessageEvent ClipboardEvent DragEvent TransitionEvent
HTMLElement HTMLInputElement HTMLTextAreaElement HTMLButtonElement HTMLSelectElement
HTMLFormElement HTMLAnchorElement HTMLLabelElement HTMLDetailsElement HTMLDivElement
Element Node NodeList DocumentFragment Document Storage CSS Notification
getComputedStyle matchMedia scrollBy scrollTo scrollIntoView postMessage
Int8Array Uint8Array Uint16Array Uint32Array Int16Array Float32Array Float64Array ArrayBuffer DataView
AddSearchEntry__none`.trim().split(/\s+/));

const undeclared = new Map();
walk.full(ast, node => {
  for (const type of ['CallExpression', 'NewExpression']) {
    if (node.type === type && node.callee.type === 'Identifier') {
      const name = node.callee.name;
      if (!declared.has(name) && !GLOBALS.has(name)) {
        const line = node.loc ? node.loc.start.line : source.slice(0, node.start).split('\n').length;
        if (!undeclared.has(name)) undeclared.set(name, []);
        undeclared.get(name).push(line);
      }
    }
  }
});

if (undeclared.size) {
  console.error('undeclared-call scan: FAIL');
  for (const [name, lines] of [...undeclared.entries()].sort()) {
    console.error(` - niezadeklarowane wywołanie: ${name}() (linie bundla: ${lines.slice(0, 5).join(', ')})`);
  }
  process.exit(1);
}
console.log('undeclared-call scan: PASS');

// ============ Manifest zasięgów: detekcja ryzyka TDZ między plikami ============
// Bundel to jeden <script> — deklaracje let/const/class z późniejszego pliku są
// w martwej strefie czasowej podczas eval wcześniejszych plików. Wykrywamy
// odwołania z kodu WYKONYWANEGO przy eval (iniekcje zmiennych, IIFE, warunki
// top-level) do bindingów zadeklarowanych w plikach dalszych w manifeście.
// Ciała zwykłych funkcji (wykonywanych później, po pełnym eval) są pomijane.

const tdzIssues = [];
const parseFile = rel => parse(readFileSync(join(ROOT, rel), 'utf8'), { ecmaVersion: 'latest', sourceType: 'script', locations: true });

function topLevelTdzBindings(program) {
  const names = new Set();
  for (const stmt of program.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) collectPatternInto(decl.id, names);
    } else if (stmt.type === 'ClassDeclaration' && stmt.id) {
      names.add(stmt.id.name);
    }
  }
  return names;
}
function collectPatternInto(pat, set) {
  if (!pat) return;
  if (pat.type === 'Identifier') set.add(pat.name);
  else if (pat.type === 'ObjectPattern') pat.properties.forEach(p => collectPatternInto(p.type === 'Property' ? p.value : p.argument, set));
  else if (pat.type === 'ArrayPattern') pat.elements.forEach(e => collectPatternInto(e, set));
  else if (pat.type === 'AssignmentPattern') collectPatternInto(pat.left, set);
  else if (pat.type === 'RestElement') collectPatternInto(pat.argument, set);
}

function collectExecIdentifiers(node, into, declaredHere) {
  if (!node || node.type === 'Identifier') {
    if (node && node.type === 'Identifier') into.push(node);
    return;
  }
  switch (node.type) {
    case 'MemberExpression':
      collectExecIdentifiers(node.object, into, declaredHere);
      if (node.computed) collectExecIdentifiers(node.property, into, declaredHere);
      return;
    case 'FunctionDeclaration':
      return; // odroczone
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      // wykonywane tylko, gdy są bezpośrednim callee IIFE (obiekt Call woła osobno)
      node._iifeBody = true; // marker nie jest używany — ciała przechodzimy z CallExpression
      return;
    }
    case 'CallExpression':
    case 'NewExpression': {
      const callee = node.callee;
      if ((callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression')) {
        // natychmiastowe wywołanie: parametry (jako callee) + ciała funkcji wykonują się teraz
        collectExecIdentifiers(callee.body, into, declaredHere);
        for (const arg of node.arguments) collectExecIdentifiers(arg, into, declaredHere);
        return;
      }
      collectExecIdentifiers(callee, into, declaredHere);
      for (const arg of node.arguments) collectExecIdentifiers(arg, into, declaredHere);
      return;
    }
    case 'VariableDeclarator':
      collectExecIdentifiers(node.init, into, declaredHere);
      return;
    case 'Property':
      collectExecIdentifiers(node.value, into, declaredHere);
      return;
    default:
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) child.forEach(c => c && typeof c.type === 'string' && collectExecIdentifiers(c, into, declaredHere));
        else if (child && typeof child.type === 'string') collectExecIdentifiers(child, into, declaredHere);
      }
  }
}

const perFile = files.map(rel => {
  const program = parseFile(rel);
  return { rel, program, tdz: topLevelTdzBindings(program) };
});
for (const { rel, program, tdz } of perFile) {
  const declaredLater = new Map(); // nazwa -> plik
  const myIndex = files.indexOf(rel);
  for (const other of perFile.slice(myIndex + 1)) {
    for (const name of other.tdz) if (!declaredLater.has(name)) declaredLater.set(name, other.rel);
  }
  const localTop = new Set();
  for (const stmt of program.body) {
    if (stmt.type === 'FunctionDeclaration' && stmt.id) localTop.add(stmt.id.name);
  }
  const ids = [];
  for (const stmt of program.body) {
    if (stmt.type === 'FunctionDeclaration') continue; // deklaracja; ciao odroczone
    collectExecIdentifiers(stmt, ids, null);
  }
  for (const id of ids) {
    if (declaredLater.has(id.name) && !localTop.has(id.name) && !tdz.has(id.name)) {
      tdzIssues.push(`${rel}:${id.loc.start.line} — '${id.name}' użyte przy eval, a zadeklarowane jako let/const/class dopiero w ${declaredLater.get(id.name)}`);
    }
  }
}
if (tdzIssues.length) {
  console.error('declaration-order scan: FAIL (ryzyko TDZ między plikami)');
  for (const issue of tdzIssues.slice(0, 20)) console.error(' -', issue);
  process.exit(1);
}
console.log('declaration-order scan: PASS');
