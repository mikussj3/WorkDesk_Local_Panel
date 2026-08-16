#!/usr/bin/env python3
from pathlib import Path
import argparse, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=json.loads((ROOT/'build-manifest.json').read_text(encoding='utf-8'))

def join_files(paths):
    return ''.join((ROOT/p).read_text(encoding='utf-8') for p in paths)

def build(kind, output):
    template=(ROOT/'src/templates/production.html').read_text(encoding='utf-8')
    styles=join_files(MANIFEST['styles'])
    scripts=join_files(MANIFEST['shared'])
    scripts+=join_files(MANIFEST['production_entry'] if kind=='production' else MANIFEST['diagnostic_overlay'])
    version=MANIFEST.get('appVersion','0.0.0')
    tag=MANIFEST.get('buildTag','KF')
    html=template.replace('{{TITLE_DIAG}}','' if kind=='production' else '-D')
    html=html.replace('{{STYLES}}',styles).replace('{{SCRIPTS}}',scripts)
    # wersja z build-manifest.json (jedno źródło prawdy) — wstrzykiwana PO sklejeniu,
    # więc marker działa i w szablonie (tytuł), i w runtime (APP_META w 40-storage-core)
    html=html.replace('{{APP_VERSION}}',version).replace('{{BUILD_TAG}}',tag)
    output=Path(output); output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(html,encoding='utf-8')
    digest=hashlib.sha256(html.encode()).hexdigest()
    print(f'{kind}: {output} ({len(html)} bytes, sha256={digest})')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--kind',choices=['production','diagnostic','all'],default='all')
    p.add_argument('--out-dir',default=str(ROOT/'dist'))
    a=p.parse_args(); out=Path(a.out_dir)
    if a.kind in ('production','all'): build('production',out/'index_KF64.html')
    if a.kind in ('diagnostic','all'): build('diagnostic',out/'index_KF64_DIAG.html')
