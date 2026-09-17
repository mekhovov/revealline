from pathlib import Path
import json, hashlib, subprocess, datetime, ast

ROOT = Path('/Users/oleksandr.mekhovov/work/my_projects/go_test')
OUT = ROOT / '.cache/p02a-team-note/archive18-public-audit'
RUN = OUT / 'http/http-20260916T045812Z-6a65a60c'
REPO = ROOT / '.cache/worktrees/archive18-v0580-infrastructure'
BASE = 'https://mekhovov.github.io/revealline-archive-18/'
sha = lambda data: hashlib.sha256(data).hexdigest()
load = lambda path: json.loads(path.read_bytes())
completion = load(OUT / 'public-run-01.json')
assert completion['exitCode'] == 0, 'Do not label failed audit complete.'
inventory_raw = (REPO / 'expected-inventory.json').read_bytes()
assert sha(inventory_raw) == '7dfba91f1093de6983ab6a783242307eab196f82d84a55b76d84737c45fd2d46'
assert inventory_raw == (RUN / 'expected-inventory.json').read_bytes() == (OUT / 'verification-receipts/expected-inventory.json').read_bytes()
rows = json.loads(inventory_raw)['files']
expected = {r['path']: r for r in rows}
assert len(rows) == len(expected) == 665
assert sum(r['bytes'] for r in rows) == 312702795
results = [json.loads(line) for line in (RUN / 'http-results.jsonl').read_text().splitlines()]
attempts = [json.loads(line) for line in (RUN / 'http-attempts.jsonl').read_text().splitlines()]
assert len(results) == 665 and {r['path'] for r in results} == set(expected)
report = load(RUN / 'http-report.json')
auditor = (OUT / 'http-tools/http_audit.py').read_bytes()
assert sha(auditor) == 'd0d1d302f2c362bd9ffaeafc08ba846d57a932f4ce2e5ae73bae4ec18d531590'
syntax = ast.parse(auditor)
allowed_mimes = ast.literal_eval(next(node.value for node in syntax.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'MIMES' for target in node.targets)))
for r in results:
    pin = expected[r['path']]
    assert r['status'] == 'PASS' and r['statusCode'] == 200 and r['requestStarted'] is True
    assert r['expectedBytes'] == r['bytes'] == pin['bytes']
    assert r['expectedSha256'] == r['sha256'] == pin['sha256']
    assert r['url'] == r['finalURL'] == BASE + r['path']
    assert r['contentType'].split(';', 1)[0].strip().lower() in allowed_mimes[Path(r['path']).suffix.lower()]
    assert r['contentEncoding'].strip().lower() in ['', 'identity']
    path_attempts = [a for a in attempts if a['path'] == r['path']]
    assert path_attempts and path_attempts[-1] == r
    assert [a['attempt'] for a in path_attempts] == list(range(1, r['attempt'] + 1))
assert report['status'] == 'PASS' and report['files'] == 665 and report['verifiedBytes'] == 312702795
assert report['failedFiles'] == 0 and report['skipped'] == []
assert report['attempts'] == len(attempts)
assert report['failedAttempts'] == sum(a['status'] != 'PASS' for a in attempts)
assert report['retriedFiles'] == sum(r['attempt'] > 1 for r in results)
assert report['archiveCommit'] == 'b83acdd80f0aaa35a72cff8c6b861250e894b1d7'
assert report['allFinalURLsExact'] is True and report['payloadFilesPersisted'] is False
binding = load(OUT / 'hosted-binding.json')
for pin in binding['evidence']:
    raw = (OUT / pin['path']).read_bytes()
    assert len(raw) == pin['bytes'] and sha(raw) == pin['sha256']
queries = {
    'after-http-main': 'repos/mekhovov/revealline-archive-18/commits/main',
    'after-http-run': 'repos/mekhovov/revealline-archive-18/actions/runs/35057107194',
    'after-http-deployment': 'repos/mekhovov/revealline-archive-18/deployments/6474004290',
    'after-http-statuses': 'repos/mekhovov/revealline-archive-18/deployments/6474004290/statuses',
    'after-http-pages': 'repos/mekhovov/revealline-archive-18/pages',
    'after-http-tag-ref': 'repos/mekhovov/revealline/git/ref/tags/v0.58.0',
    'after-http-tag': 'repos/mekhovov/revealline/git/tags/8eabeb78d79938340f3b4c66c7c9cac186914f20',
    'after-http-release': 'repos/mekhovov/revealline/releases/tags/v0.58.0',
}
models = {}
for name, endpoint in queries.items():
    raw = subprocess.check_output(['gh', 'api', endpoint], cwd=ROOT)
    (OUT / (name + '.json')).open('xb').write(raw)
    models[name] = json.loads(raw)
main, run, dep, statuses = [models[n] for n in ['after-http-main', 'after-http-run', 'after-http-deployment', 'after-http-statuses']]
assert main['sha'] == run['head_sha'] == dep['sha'] == binding['archiveCommit']
assert main['commit']['tree']['sha'] == binding['archiveTree']
assert run['status'] == 'completed' and run['conclusion'] == 'success' and run['id'] == binding['runId']
assert dep['id'] == binding['deploymentId'] and statuses[0]['state'] == 'success'
assert statuses[0]['environment_url'] == BASE and statuses[0]['log_url'].startswith(run['html_url'] + '/')
assert models['after-http-pages']['build_type'] == 'workflow'
assert models['after-http-tag-ref']['object']['sha'] == '8eabeb78d79938340f3b4c66c7c9cac186914f20'
assert models['after-http-tag']['object']['sha'] == 'c113a348ae69bd013b67f0d22a5391d604253545'
original_release = load(ROOT / '.cache/p02a-team-note/archive18-preparation/api/release-v0580.json')
release = models['after-http-release']
assert release['id'] == original_release['id'] == 389617262 and not release['draft']
fields = ['id', 'name', 'size', 'digest', 'browser_download_url']
assert sorted([{k: a[k] for k in fields} for a in release['assets']], key=lambda a: a['id']) == sorted([{k: a[k] for k in fields} for a in original_release['assets']], key=lambda a: a['id'])
review = {
    'status': 'PUBLIC_HTTP_PASS_NATIVE_ACCEPTANCE_SEPARATE',
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'base': BASE, 'archiveCommit': binding['archiveCommit'], 'archiveTree': binding['archiveTree'],
    'deploymentId': binding['deploymentId'], 'runId': binding['runId'],
    'files': 665, 'verifiedBytes': 312702795, 'failedFiles': 0,
    'attempts': len(attempts), 'failedAttempts': report['failedAttempts'], 'retriedFiles': report['retriedFiles'],
    'exactResultAndAttemptIdentityRechecked': True, 'originalNineAssetsAndTagUnchangedAfterAudit': True,
    'hostedPinnedEvidenceUnchanged': True, 'freshArchiveAuthorityMatches': True,
    'inventorySHA256': sha(inventory_raw), 'httpReportSHA256': sha((RUN / 'http-report.json').read_bytes()),
    'resultsSHA256': sha((RUN / 'http-results.jsonl').read_bytes()), 'attemptsSHA256': sha((RUN / 'http-attempts.jsonl').read_bytes()),
    'scope': 'Full exact canonical public body inventory. Independent of native UI, offline, acoustic, hardware or game phase acceptance. No payload files persisted.',
}
(OUT / 'after-http-review.json').open('x').write(json.dumps(review, indent=2) + '\n')
print(json.dumps(review, indent=2))
