"""Reconcile one completed audit's retained metadata; never contacts the network."""
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import quote

root = Path(__file__).resolve().parent
run = Path(sys.argv[1]).resolve()
assert run.parent == root and run.name.startswith('http-')
assert {p.name for p in run.iterdir()} == {'expected-inventory.json', 'auditor.py', 'http-results.jsonl', 'http-attempts.jsonl', 'http-report.json'}
assert hashlib.sha256((run / 'auditor.py').read_bytes()).hexdigest() == 'e4b627a42200d8c60f495c1067f2a10d90a53de8f4bc785c40bf60cd945e9629'
raw = (run / 'expected-inventory.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == 'd825b3ff2c7ae8a6f4a1212d86b28a9f8d6dcee117e1726b976fa25655c74ffa'
expected = json.loads(raw)['files']
results = [json.loads(line) for line in (run / 'http-results.jsonl').read_text().splitlines()]
attempts = [json.loads(line) for line in (run / 'http-attempts.jsonl').read_text().splitlines()]
report = json.loads((run / 'http-report.json').read_bytes())
assert len(results) == len(expected) == 1303
assert len({r['path'] for r in results}) == 1303
by_path = {r['path']: r for r in results}
assert set(by_path) == {r['path'] for r in expected}
assert report['status'] == 'PASS' and report['files'] == 1303 and report['verifiedBytes'] == report['expectedBytes'] == 624422286
assert report['archiveCommit'] == '58b21ebeff3c2d8e8ca37d5b7764f8203b8824ed'
assert report['infrastructureSourceCommit'] == '18f70dba10b6c7e24d3074e05931ecb32b4dcdae'
assert report['deploymentId'] == 6454910731 and report['runId'] == 34947667008
assert report['failedFiles'] == 0 and report['skipped'] == [] and report['allFinalURLsExact'] is True
assert report['payloadFilesPersisted'] is False
assert report['attempts'] == len(attempts)
assert set(r['path'] for r in attempts) == set(by_path)
for wanted in expected:
    result = by_path[wanted['path']]
    assert result['status'] == 'PASS' and result['requestStarted'] is True and result['statusCode'] == 200
    assert result['bytes'] == result['expectedBytes'] == wanted['bytes']
    assert result['sha256'] == result['expectedSha256'] == wanted['sha256']
    assert result['finalURL'] == result['url'] == 'https://mekhovov.github.io/revealline-archive-13/' + quote(wanted['path'], safe='/')
    trials = [r for r in attempts if r['path'] == wanted['path']]
    assert [r['attempt'] for r in trials] == list(range(1, len(trials) + 1)) and 1 <= len(trials) <= 3
    assert trials[-1] == result
assert report['failedAttempts'] == sum(r['status'] != 'PASS' for r in attempts)
assert report['retriedFiles'] == sum(r['attempt'] > 1 for r in results)
bridge = by_path['releases/index.html']
assert bridge['bytes'] == 571 and bridge['sha256'] == 'a67eebc2c45e1659fef5b993c65fee2146ae3e47f352f25b0c9d42ccc77471c0'
cohorts = []
for version in ['v0.54.0', 'v0.55.0']:
    rows = [r for r in expected if r['path'].startswith('releases/' + version + '/')]
    cohorts.append({'version': version, 'files': len(rows), 'verifiedBytes': sum(r['bytes'] for r in rows)})
assert [r['files'] for r in cohorts] == [650, 650]
assert [r['verifiedBytes'] for r in cohorts] == [312209030, 312212099]
summary = {'status': 'PASS', 'auditDirectory': str(run), 'files': 1303, 'verifiedBytes': 624422286, 'cohorts': cohorts, 'globalFiles': 3, 'globalBytes': 1157, 'attempts': len(attempts), 'failedAttempts': report['failedAttempts'], 'scope': 'Full decoded HTTP bytes, exact canonical URLs and MIME per fixed helper. Does not prove native play, save, offline or devices; previous v054 acceptance remains historical.'}
with (root / 'reconciliation.json').open('x') as out:
    json.dump(summary, out, indent=2); out.write('\n')
print(json.dumps(summary))
