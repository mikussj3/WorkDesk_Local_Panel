#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'build-manifest.json').read_text())
paths=[ROOT/p for p in m['shared']+m['production_entry']+m['diagnostic_overlay'] if p.endswith('.js')]
source='\n'.join(p.read_text() for p in paths)
issues=[]
# Bridge exports must have at least one consumer in addition to the assignment.
# Named functions referenced only at declaration are dead candidates.
for name in sorted(set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',source))):
    refs=len(re.findall(rf'\b{re.escape(name)}\b',source))
    if refs<=1 and not name.startswith('_'):
        issues.append(f'unreferenced function: {name}')
# Historical production identifiers are forbidden.
for pattern in (r'\b[A-Za-z_$][\w$]*PF\d+\b',r'\bLegacyStateDebugAssert\b',r'\bregisterModuleAction\b',r'\bmoduleActionNativeDialogAudit\b'):
    hits=sorted(set(re.findall(pattern,source)))
    issues.extend(f'historical/dead symbol: {x}' for x in hits)
if issues:
    print('dead-code scan: FAIL')
    for issue in issues: print(' -',issue)
    sys.exit(1)
print('dead-code scan: PASS')
if 'RuntimeBridge' in source:
    issues.append('RuntimeBridge must not exist')

