from pathlib import Path
import json
p=Path('docs/verification/demo-qualification-2026-09-29/packaging/integrated-c5e3419ee')
r=json.loads((p/'desktop-protocol-audit.json').read_text())
print(sorted({(Path(x['path']).suffix,x['mime']) for x in r['requests']}))
expected={'.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}
for row in r['requests']:
    assert row['mime'].split(';')[0]==expected[Path(row['path']).suffix],row
print('38 MIME assertions passed')
