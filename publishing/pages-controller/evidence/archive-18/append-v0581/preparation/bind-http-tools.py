"""Bind original Archive18 auditor identities; never run public requests here."""
from pathlib import Path
import ast
import difflib
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parent
INFRA = ROOT.parent / 'worktrees/archive18-v0581-preservation'
OUT = ROOT / 'public-audit'
TARGET = OUT / 'http-tools'
BASE = 'https://mekhovov.github.io/revealline-archive-18/'
EXPECTED_FILES = 1327
EXPECTED_BYTES = 625402709
INVENTORY_SHA = 'c52247cf0b6f2204bf4b83863e5a0da60f1dd3947301fe653f9f3b86358240b6'


def sha(body):
    return hashlib.sha256(body).hexdigest()


def load(path):
    return json.loads(path.read_bytes())


def replace_one(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Expected exact original identity hunk')
    return text.replace(old, new, 1)


def main():
    inputs = load(ROOT / 'http-binding-inputs.json')
    if inputs['reviewed'] is not True or inputs['archiveId'] != 'archive-18':
        raise ValueError('Actual successor binding needs root review')
    if TARGET.exists() or TARGET.is_symlink():
        raise ValueError('Do not overwrite an existing auditor')
    binding_raw = (OUT / 'hosted-binding.json').read_bytes()
    if sha(binding_raw) != inputs['hostedBindingSha256']:
        raise ValueError('Reviewed actual hosted binding changed')
    binding = json.loads(binding_raw)
    if binding['status'] != 'HOSTED_READY_FOR_HTTP' or binding['archiveId'] != 'archive-18':
        raise ValueError('Hosted original extraction must actually pass first')
    if binding['archiveCommit'] == 'b83acdd80f0aaa35a72cff8c6b861250e894b1d7':
        raise ValueError('Historical one-release deployment is not the successor')
    for key in ['archiveCommit', 'archiveTree', 'sourceCheckoutCommit', 'sourceCheckoutTree', 'runId', 'buildJob', 'deployJob', 'deploymentId', 'statusId']:
        if binding[key] != inputs[key]:
            raise ValueError('Actual reviewed identity mismatch: ' + key)
    for key in ['runId', 'buildJob', 'deployJob', 'deploymentId', 'statusId']:
        if type(binding[key]) is not int or binding[key] <= 0:
            raise ValueError('An actual positive hosted identifier is required')
    for pin in binding['evidence']:
        relative = Path(pin['path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe hosted evidence path')
        path = OUT / relative
        if path.is_symlink() or not path.is_file():
            raise ValueError('Actual ordinary hosted original required')
        body = path.read_bytes()
        if len(body) != pin['bytes'] or sha(body) != pin['sha256']:
            raise ValueError('Hosted original changed')
    run = load(OUT / 'run-01.json')
    jobs = load(OUT / 'jobs-01.json')['jobs']
    deployment = load(OUT / 'deployment.json')
    statuses = load(OUT / 'deployment-statuses.json')
    if run['id'] != binding['runId'] or run['head_sha'] != binding['archiveCommit'] or run['status'] != 'completed' or run['conclusion'] != 'success':
        raise ValueError('Require actual terminal successful source run')
    selected = [job for job in jobs if job['id'] in [binding['buildJob'], binding['deployJob']]]
    if len(selected) != 2 or any(job['status'] != 'completed' or job['conclusion'] != 'success' for job in selected):
        raise ValueError('Both actual build and deployment jobs must pass')
    if deployment['id'] != binding['deploymentId'] or deployment['sha'] != binding['archiveCommit']:
        raise ValueError('Deployment authority does not match merged source')
    if not statuses or statuses[0]['id'] != binding['statusId'] or statuses[0]['state'] != 'success' or statuses[0]['environment_url'] != BASE:
        raise ValueError('Require actual successful canonical Pages status')
    if not statuses[0]['log_url'].startswith(run['html_url'] + '/'):
        raise ValueError('Deployment status does not belong to this workflow run')
    git = ['git', '-C', str(INFRA)]
    head = subprocess.check_output([*git, 'rev-parse', 'HEAD'], text=True).strip()
    tree = subprocess.check_output([*git, 'rev-parse', 'HEAD^{tree}'], text=True).strip()
    if head != binding['sourceCheckoutCommit'] or tree != binding['sourceCheckoutTree'] or tree != binding['archiveTree']:
        raise ValueError('Held source and deployed merge must have the same exact tree')
    inventory_raw = (INFRA / 'expected-inventory.json').read_bytes()
    if subprocess.check_output([*git, 'show', head + ':expected-inventory.json']) != inventory_raw:
        raise ValueError('Inventory differs from committed source')
    if sha(inventory_raw) != INVENTORY_SHA or binding['inventorySha256'] != INVENTORY_SHA:
        raise ValueError('Require the reviewed two-original-cohort inventory')
    inventory = json.loads(inventory_raw)
    if inventory['base'] != BASE or len(inventory['files']) != EXPECTED_FILES or sum(row['bytes'] for row in inventory['files']) != EXPECTED_BYTES:
        raise ValueError('Measured public inventory changed')
    if (binding['files'], binding['bytes']) != (EXPECTED_FILES, EXPECTED_BYTES):
        raise ValueError('Hosted inventory counts differ')
    if (OUT / 'verification-receipts/expected-inventory.json').read_bytes() != inventory_raw:
        raise ValueError('Hosted original inventory bytes differ')

    origins = {}
    for pin in load(ROOT / 'http-origin-pins.json')['files']:
        body = (ROOT / pin['path']).read_bytes()
        if len(body) != pin['bytes'] or sha(body) != pin['sha256']:
            raise ValueError('Previously approved audit implementation changed')
        origins[Path(pin['path']).name] = body
    auditor = origins['http_audit.py'].decode()
    replacements = [
        ("INFRA = BASE_DIR.parent.parent / 'worktrees/archive18-v0580-infrastructure'", 'INFRA = Path(' + repr(str(INFRA)) + ')'),
        ("COMMIT = 'b83acdd80f0aaa35a72cff8c6b861250e894b1d7'", 'COMMIT = ' + repr(binding['archiveCommit'])),
        ("SOURCE_COMMIT = '7e13712909dd0deb686dff18499710cb9b2c3458'", 'SOURCE_COMMIT = ' + repr(head)),
        ("SOURCE_TREE = '69b9a690589500ea78b240ae242efb7309474730'", 'SOURCE_TREE = ' + repr(tree)),
        ("AUTHORITY_SHA = '9553ca2f14e06c0f1404d91e4fefbce9eeddb73f11edc73f29c58ed5d21a5777'", 'AUTHORITY_SHA = ' + repr(sha(binding_raw))),
        ("INVENTORY_SHA = '7dfba91f1093de6983ab6a783242307eab196f82d84a55b76d84737c45fd2d46'", 'INVENTORY_SHA = ' + repr(INVENTORY_SHA)),
        ('EXPECTED_FILES = 665', 'EXPECTED_FILES = 1327'),
        ('EXPECTED_BYTES = 312702795', 'EXPECTED_BYTES = 625402709'),
    ]
    for before, after in replacements:
        auditor = replace_one(auditor, before, after)
    tests = origins['test_http_audit.py'].decode()
    tests = replace_one(tests, 'self.assertEqual(len(rows), 665)', 'self.assertEqual(len(rows), 1327)')
    tests = replace_one(tests, 'self.assertEqual(sum(item[\'bytes\'] for item in rows), 312702795)', 'self.assertEqual(sum(item[\'bytes\'] for item in rows), 625402709)')
    for source in [auditor, tests]:
        ast.parse(source)
    # Functions, guards, network behavior, deadlines and retry policy are exact.
    original_ast = ast.parse(origins['http_audit.py'])
    adapted_ast = ast.parse(auditor)
    defs = lambda syntax: [ast.dump(node, include_attributes=False) for node in syntax.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))]
    if defs(original_ast) != defs(adapted_ast):
        raise ValueError('Identity adaptation changed an auditor function or guard')
    TARGET.mkdir(parents=True, exist_ok=False)
    diffs = []
    pins = []
    for name, text in [('http_audit.py', auditor), ('test_http_audit.py', tests)]:
        body = text.encode()
        with (TARGET / name).open('xb') as target:
            target.write(body)
        diffs.extend(difflib.unified_diff(origins[name].decode().splitlines(True), text.splitlines(True), fromfile='original/' + name, tofile='adapted/' + name))
        pins.append({'path': 'http-tools/' + name, 'bytes': len(body), 'sha256': sha(body)})
    with (OUT / 'audit-adaptation.diff').open('x') as target:
        target.write(''.join(diffs))
    record = {'status': 'ADAPTED_AWAITING_ROOT_DIFF_REVIEW', 'functionsAndGuardsIdentical': True, 'networkRequests': 0, 'testsExecuted': False, 'pins': pins, 'actualBindingSha256': sha(binding_raw), 'publicAccepted': False}
    with (OUT / 'audit-adaptation.json').open('x') as target:
        json.dump(record, target, indent=2)
        target.write('\n')
    print(json.dumps(record))


if __name__ == '__main__':
    main()
