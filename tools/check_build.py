#!/usr/bin/env python3
from pathlib import Path
import subprocess, re, sys, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=json.loads((ROOT/'build-manifest.json').read_text(encoding='utf-8'))
import re
prefixes=[int(re.match(r'(\d+)',Path(path).name).group(1)) for path in MANIFEST['shared']]
assert prefixes==sorted(prefixes), f'shared runtime order is not numeric: {prefixes}'
subprocess.run([sys.executable,str(ROOT/'tools/build.py'),'--kind','all'],check=True)
subprocess.run([sys.executable,str(ROOT/'tools/dead_code.py')],check=True)
subprocess.run(['node',str(ROOT/'tools/check_undeclared.mjs')],check=True,cwd=str(ROOT))

# Global listeners must be owned by the central EventLifecycle.
for path in MANIFEST['shared']+MANIFEST['production_entry']+MANIFEST['diagnostic_overlay']:
    if not path.endswith('.js') or path.endswith('00-event-lifecycle.js'):
        continue
    source=(ROOT/path).read_text(encoding='utf-8')
    assert not re.search(r'(?:window|document)\.addEventListener\s*\(',source), f'direct global addEventListener in {path}'
    assert not re.search(r'(?:window|document)\.removeEventListener\s*\(',source), f'direct global removeEventListener in {path}'
assert MANIFEST['shared'][0].endswith('00-event-lifecycle.js'), 'EventLifecycle must be initialized first'


assert 'src/runtime/shared/148-mobile-ux.js' in MANIFEST['shared'], 'MobileUX module missing'
mobile_source=(ROOT/'src/runtime/shared/148-mobile-ux.js').read_text(encoding='utf-8')
for removed in ('120-journal-backup.js','130-search-business-actions.js','140-business-modules.js'):
    assert not (ROOT/'src/runtime/shared'/removed).exists(), f'legacy monolith still present: {removed}'
large=[p for p in (ROOT/'src/runtime/shared').glob('*.js') if p.stat().st_size > 50000]
assert not large, f'shared module exceeds 50 KB after modularization: {[p.name for p in large]}'
assert 'const MobileUX = ' in mobile_source and 'backToTopBtn' in mobile_source, 'Mobile UX contract missing'

# Renderer security policy: user-data renderers must use SafeDOM, while remaining
# innerHTML sites are limited to trusted static shells, SVG/QR, or large CSV tables.
shared_sources={path:(ROOT/path).read_text(encoding='utf-8') for path in MANIFEST['shared'] if path.endswith('.js')}
inner_html_count=sum(len(re.findall(r'\.innerHTML\s*=',source)) for source in shared_sources.values())
assert inner_html_count <= 50, f'innerHTML budget exceeded: {inner_html_count}'
assert 'const SafeDOM = ' in shared_sources['src/runtime/shared/00-bootstrap-data.js'], 'SafeDOM missing'
assert 'emailData' not in '\n'.join(shared_sources.values()), 'legacy emailData state returned'
assert shared_sources['src/runtime/shared/00-bootstrap-data.js'].count('let appState = null') == 1, 'appState must have one owner'
assert 'const runtimeData = new Proxy' in shared_sources['src/runtime/shared/00-bootstrap-data.js'], 'runtimeData state facade missing'
assert 'Diagnostics.register("state-ownership"' in shared_sources['src/runtime/shared/160-app-store-api.js'], 'state ownership release gate missing'
registry_source=shared_sources['src/runtime/shared/70-module-registry.js']
assert not re.search(r'ensureAppState\(\)\.modules\.[a-zA-Z]+\s*=.*runtimeData', registry_source), 'module import writes canonical and facade state'
persistence_source=shared_sources['src/runtime/shared/80-persistence-import.js']
sync_body=persistence_source[persistence_source.index('function syncAppStateFromRuntime'):persistence_source.index('function getModuleIds')]
assert 'runtimeData.' not in sync_body, 'snapshot synchronization still copies facade data into appState'

# Reminder / startup UX policy: automatic interruptions must be non-blocking,
# and bulk mail must require one explicit gesture per separately opened message.
joined_shared="\n".join(shared_sources.values())
assert 'breakModal' not in joined_shared, 'automatic break modal returned'
assert 'RuntimeBridge' not in joined_shared, 'RuntimeBridge returned'
assert 'window.open(mailto(r)' not in joined_shared, 'scheduled bulk popup flow returned'
assert 'startup:weekly-backup' in joined_shared and 'startup:draft' in joined_shared, 'startup notices missing'
assert 'const AttentionCenter = ' in shared_sources['src/runtime/shared/10-scheduler-events.js'], 'AttentionCenter missing'
assert 'BulkMailFlow = ' in shared_sources['src/runtime/shared/30-email-composer.js'], 'BulkMailFlow missing'
for path in ('src/runtime/shared/30-email-composer.js','src/runtime/shared/60-storage-validation.js'):
    assert '.innerHTML =' not in shared_sources[path], f'user-data renderer still uses innerHTML in {path}'
core=shared_sources['src/runtime/shared/125-core-modules.js']
assert '.innerHTML =' not in core, 'core module renderer still uses innerHTML'
for symbol in ('renderTodos','renderNotes','renderJournal','renderCalendarReminderList','addTodo','addNote','addJournalEntry'):
    definitions=sum(len(re.findall(rf'function\s+{symbol}\b|\b{symbol}\s*=\s*function',source)) for source in shared_sources.values())
    assert definitions == 1, f'{symbol} must have exactly one implementation, got {definitions}'
for path in MANIFEST['shared']+MANIFEST['production_entry']+MANIFEST['diagnostic_overlay']:
    if path.endswith('.js'):
        subprocess.run(['node','--check',str(ROOT/path)],check=True)
for name in ('index_KF64.html','index_KF64_DIAG.html'):
    p=ROOT/'dist'/name; s=p.read_text(encoding='utf-8')
    assert s.count('<style>')==1 and s.count('<script>')==1
    js=s[s.index('<script>')+8:s.rindex('</script>')]
    tmp=ROOT/'dist'/(name+'.js'); tmp.write_text(js,encoding='utf-8')
    subprocess.run(['node','--check',str(tmp)],check=True); tmp.unlink()
    static=s[:s.index('<script>')]
    ids=re.findall(r'\bid="([^"]+)"',static)
    assert len(ids)==len(set(ids)), f'duplicate ids in {name}'
    id_set=set(ids)
    for target in sorted(set(re.findall(r'\bfor="([^"]+)"',static))):
        if target not in id_set:
            raise SystemExit(f'label[for="{target}"] without matching id in {name}')
    assert '"/ aria-label' not in static, f'stray self-closing slash before attribute in {name}'
prod=(ROOT/'dist/index_KF64.html').read_text(encoding='utf-8')
diag=(ROOT/'dist/index_KF64_DIAG.html').read_text(encoding='utf-8')
version=MANIFEST['appVersion']; tag=MANIFEST['buildTag']   # jedno źródło prawdy: build-manifest.json
if f'buildTag: "{tag}"' not in prod or f'version: "{version}"' not in prod:
    raise SystemExit(f'stale build metadata: expected {version}-{tag} in APP_META')
if f'{version}-{tag}' not in prod or f'{version}-{tag}-D' not in diag:
    raise SystemExit('stale document title/version metadata')
shared= ''.join((ROOT/p).read_text(encoding='utf-8') for p in MANIFEST['shared']).replace('{{APP_VERSION}}',MANIFEST['appVersion']).replace('{{BUILD_TAG}}',MANIFEST['buildTag'])
shared_n=re.sub(r'\s+','',shared)
def shared_pin(needle):
    return re.sub(r'\s+','',needle) in shared_n
assert shared in prod and shared in diag, 'shared runtime is not embedded identically'
assert 'WorkDeskDebug' not in prod, 'diagnostic API leaked into production'
assert 'window.WorkDeskDebug' in diag, 'diagnostic overlay missing'
assert shared_pin('Diagnostics.register("persistence-roundtrip"'), 'persistence roundtrip gate missing'
assert 'Diagnostics.register("business-modules"' in diag, 'business modules certification gate missing'
assert shared_pin('const PersistenceRoundtrip = Object.freeze'), 'PersistenceRoundtrip service missing'
assert 'buildExportArtifact(moduleIds)' in shared and 'prepareImportArtifact(raw)' in shared, 'shared export/import paths missing'
assert 'function isLocalPath(value)' in shared and 'function localPathForClipboard(value)' in shared, 'local path helpers missing'
assert 'kind: "local-path"' in shared and 'Ścieżka lokalna została skopiowana do schowka' in shared, 'local path clipboard fallback missing'
assert 'push("local-path-fallback"' in diag, 'local path diagnostic scenario missing'
assert 'push("tile-group-management"' in diag, 'tile/group management scenario missing'
assert 'data-tile-action="edit"' in shared or 'actionButton("edit"' in shared, 'tile edit action missing'
assert 'data-tile-action="delete"' in shared or 'actionButton("delete"' in shared, 'tile delete action missing'
assert 'AppServices.emailGroups' in shared and 'AppServices.tiles' in shared, 'canonical management services missing'
assert shared_pin('function reconcileChecklistItems'), 'checklist ID reconciliation missing'
for control_id in ('clCancel','caseCancel','phCancel','prCancel'):
    assert f'id=\"{control_id}\"' in shared, f'business edit cancel control missing: {control_id}'
assert shared.count('function resetFormMode()') >= 4, 'business form reset contract incomplete'

shared_source = ''.join(path.read_text(encoding='utf-8') for path in (ROOT/'src/runtime/shared').glob('*.js'))
for forbidden in ('BusinessRenderers', 'BusinessModuleLifecycle'):
    if forbidden in shared_source:
        raise SystemExit(f'legacy business lifecycle token present: {forbidden}')
for required in ('renderEmailProfilesModule', 'renderChecklistsModule', 'renderResponseCasesModule', 'renderPhoneLogModule', 'renderProceduresModule'):
    if required not in shared_source:
        raise SystemExit(f'missing ModuleRegistry business renderer hook: {required}')

search_source = (ROOT / "src/runtime/shared/131-search-quick-actions.js").read_text(encoding="utf-8")
search_pure = (ROOT / "src/runtime/shared/28-pure-helpers.js").read_text(encoding="utf-8")
for token in ["findGlobalSearchResults", "aria-activedescendant", "Przypomnienia", "Profile e-mail", "Snippety"]:
    if token not in search_source:
        raise SystemExit(f"global search contract missing: {token}")
for token in ["normalizeSearchText", "searchScore"]:
    if token not in search_pure:
        raise SystemExit(f"global search scoring contract missing (28-pure-helpers): {token}")


# KF57 consistency regressions.
assert shared_pin('flush: () => flushPendingWrites({ commitNow: !0 })'), 'public storage flush must commit immediately'
assert shared_pin('flushPendingWrites({ commitNow: true })'), 'persistence roundtrip must commit immediately'
assert 'function mirrorPersistentStorage()' in shared and 'memory.set(key, value)' in shared, 'storage fallback mirror missing'
assert shared_pin('identity(tile) === identity(restored)'), 'tile restore semantic deduplication missing'
assert shared_pin('group.name || "").trim().toLowerCase() === groupName.toLowerCase()'), 'email group restore deduplication missing'
assert shared_pin('todo.completedAt || todo.createdAt'), 'TODO retention must use completion time'
assert shared_pin('reminder.doneAt || reminder.createdAt'), 'reminder retention must use completion time'
assert shared_pin('title: profile.label'), 'email profile search title mismatch returned'
assert shared_pin('keywords: item.body || ""'), 'procedure body search missing'
assert shared_pin('todo.completedAt && new Date(todo.completedAt)'), 'day report must use TODO completion time'
assert shared_pin('dataset: { groupId: id }'), 'email group search target missing'

# KF64 module hardening regressions.
assert 'function makeEmailGroupId(' in shared and 'function parseEmailGroupId(' in shared, 'canonical email group id helpers missing'
assert shared_pin('function reconcileSelectedGroupMutation('), 'selected email group reconciliation missing'
assert shared_pin('function restoreSelectedEmailGroup('), 'selected email group undo restoration missing'
assert 'className: "btn sm ghost recent-email-group", text: group.label' in shared and '"aria-label": `Pokaż grupę ${group.label}`' in shared, 'recent email group label must be canonical'
assert 'row.querySelector(".g-name")?.textContent' not in shared, 'recent email group must not derive name from row textContent'
assert 'push("email-module-integrity"' in diag, 'email module integrity diagnostic missing'


# KF64 lifecycle, diagnostics and accessibility regressions.
backup_source=shared_sources['src/runtime/shared/121-journal-backup.js']
assert 'backup-list-actions' in backup_source and '$$("[data-act]", host).forEach' not in backup_source, 'backup actions must use delegated lifecycle binding'
assert 'UI_ERROR_REGISTRY.record("backup"' in backup_source, 'backup diagnostics missing'
assert 'aria-label="Zamknij"' in shared_sources['src/runtime/shared/132-business-actions-core.js'], 'dynamic modal close labels missing'
assert 'owner: "command-palette"' in persistence_source, 'command palette lifecycle owner missing'
assert 'owner: "csv-import"' in shared_sources['src/runtime/shared/120-csv-import.js'], 'CSV import lifecycle owner missing'

print('static shared-runtime checks: PASS')

# KF57 tooltip portal and coverage regressions.
tooltip_source = shared_sources['src/runtime/shared/26-tooltip-runtime.js']
assert 'workdeskTooltip' in tooltip_source and 'className = "global-tooltip"' in tooltip_source, 'global tooltip portal missing'
assert 'position:fixed' in (ROOT/'src/styles/99-final-overrides.css').read_text(encoding='utf-8'), 'fixed tooltip positioning missing'
assert '[data-tooltip]::after' not in (ROOT/'src/styles/99-final-overrides.css').read_text(encoding='utf-8'), 'clippable pseudo-element tooltip returned'
assert 'pointerover' in tooltip_source and 'focusin' in tooltip_source, 'delegated tooltip interactions missing'
assert 'TooltipRuntime.audit(document)' in diag, 'tooltip coverage diagnostic missing'
assert 'push("tooltip-portal"' in diag, 'tooltip portal diagnostic scenario missing'

# KF64 product-safety regressions.
for needle in (
    'id="dataConfidence"',
    'id="dataAdvanced"',
    'Eksportuj backup',
    'Punkty przywracania',
    'Utwórz punkt i przywróć',
    'function renderDataConfidence()',
):
    if needle not in prod:
        raise SystemExit(f'KF64 regression: missing {needle}')
if 'Szybkie akcje</button>' in prod:
    raise SystemExit('KF64 regression: old quick-actions label remains')

# KF64 business workflow and source-boundary regressions.
shared_text=''.join(x.read_text(encoding='utf-8') for x in (ROOT/'src/runtime/shared').glob('*.js'))
for needle in ('const BusinessWorkflow = Object.freeze', 'phoneToCase(phoneId)', 'caseToTodo(caseId)', 'caseToReminder(caseId)', 'caseToJournal(caseId)', 'normalizeWorkflowLinks'):
    if needle not in shared_text:
        raise SystemExit(f'KF64 regression: missing {needle}')
if 'src/runtime/shared/140-business-workflow.js' not in (ROOT/'build-manifest.json').read_text(encoding='utf-8'):
    raise SystemExit('KF64 regression: workflow module missing from manifest')
for needle in ('data-phone-case', 'data-case-todo', 'data-case-reminder', 'data-case-journal'):
    if needle not in prod:
        raise SystemExit(f'KF64 regression: missing built action {needle}')

# KF64 workflow integrity and navigation regressions.
assert 'existingLinks(record)' in shared and 'reconcileAll({persist = true}' in shared, 'workflow stale-link reconciliation missing'
assert 'data-workflow-open' in prod and 'workflow-highlight' in prod, 'workflow navigation UI missing'
assert shared_pin('Diagnostics.register("workflow-integrity"'), 'workflow integrity gate missing'
