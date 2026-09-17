"""Finite local metadata preparation only; no network, Git mutation or payloads."""
from pathlib import Path
import ast
import copy
import difflib
import hashlib
import importlib.util
import json
import shutil
import stat
import sys

ROOT = Path(__file__).resolve().parent
ORIGINAL = ROOT / 'originals/archive18'
ADDED = ROOT / 'originals/v0.58.1'
OUTPUT = ROOT / 'candidate'
VERSION = 'v0.58.1'
SOURCE = 'c93019a344f6f4c6ac03940c77ea09c81122d911'
TREE = 'f6055cbcba92d45ef1da2b5d16e7e4f1158c8d2a'
TAG = 'a055a08d6f53600276abdf8291d08313c3baf413'
PARENT = 'b83acdd80f0aaa35a72cff8c6b861250e894b1d7'
PARENT_TREE = '69b9a690589500ea78b240ae242efb7309474730'


def encoded(value):
    return (json.dumps(value, indent=2) + '\n').encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def load(path):
    return json.loads(path.read_bytes())


def ordinary(path):
    if path.is_symlink() or not stat.S_ISREG(path.lstat().st_mode) or path.stat().st_nlink != 1:
        raise ValueError('Only ordinary single-link input files are admitted')
    return path.read_bytes()


def write(path, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as target:
        target.write(body)


def replace_one(value, old, new):
    if value.count(old) != 1:
        raise ValueError('Reviewed one-occurrence source hunk no longer matches')
    return value.replace(old, new, 1)


def main():
    if OUTPUT.exists() or OUTPUT.is_symlink():
        raise ValueError('Never replace a prepared candidate')
    if ROOT.is_symlink() or '/.cache/' not in str(ROOT) or ROOT.parent.name != '.cache':
        raise ValueError('Preparation is limited to this explicit external cache boundary')
    origin = load(ROOT / 'originals-manifest.json')
    for row in origin['rows'] + load(ROOT / 'api-input-pins.json')['files']:
        path = ROOT / row['path']
        if '..' in Path(row['path']).parts or Path(row['path']).is_absolute():
            raise ValueError('Unsafe retained input path')
        body = ordinary(path)
        if len(body) != row['bytes'] or sha(body) != row['sha256']:
            raise ValueError('Retained input bytes changed: ' + row['path'])
    if load(ROOT / 'api/archive-main.json')['object']['sha'] != PARENT:
        raise ValueError('Prepared archive parent does not match actual API snapshot')
    if load(ROOT / 'api/archive-commit.json')['tree']['sha'] != PARENT_TREE:
        raise ValueError('Prepared original archive tree changed')
    release = load(ROOT / 'api/release-v0581.json')
    if release['id'] != 389657437 or release['tag_name'] != VERSION or release['draft'] or release['prerelease'] or not release['published_at']:
        raise ValueError('An actual published stable original is required')
    assets = {row['name']: row for row in release['assets']}
    if len(assets) != len(release['assets']) or len(assets) != 9:
        raise ValueError('Expected the exact original nine assets')
    if load(ROOT / 'api/v0581-tag-ref.json')['object'] != {'sha': TAG, 'type': 'tag', 'url': 'https://api.github.com/repos/mekhovov/revealline/git/tags/' + TAG}:
        raise ValueError('Original annotated tag changed')
    if load(ROOT / 'api/v0581-tag.json')['object']['sha'] != SOURCE or load(ROOT / 'api/v0581-tag.json')['object']['type'] != 'commit':
        raise ValueError('Original tag target changed')
    for path in ADDED.iterdir():
        body = ordinary(path)
        if len(body) != assets[path.name]['size'] or 'sha256:' + sha(body) != assets[path.name]['digest']:
            raise ValueError('Original metadata does not match actual asset descriptor')

    # Reuse the exact accepted verifier. Importing it performs no extraction.
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('archive18_original_verifier', ORIGINAL / 'tools/verify.py')
    verify = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verify)
    before_lock, before_inventory = verify.locked_inputs(ORIGINAL)
    if (before_lock['expectedFiles'], before_lock['expectedBytes']) != (665, 312702795):
        raise ValueError('The accepted predecessor is not the measured original cohort')
    if [row['version'] for row in before_lock['releases']] != ['v0.58.0']:
        raise ValueError('Append-only predecessor mismatch')

    # Prepare ordinary infrastructure and four small original metadata files only.
    OUTPUT.mkdir(exist_ok=False)
    for row in origin['rows']:
        if row.get('equalTree') == PARENT_TREE:
            write(OUTPUT / row['sourcePath'], ordinary(ROOT / row['path']))
    for path in ADDED.iterdir():
        write(OUTPUT / 'metadata' / VERSION / path.name, ordinary(path))
    lock = copy.deepcopy(before_lock)
    q = ordinary(ADDED / 'source-qualification.json')
    entry = {
        'version': VERSION, 'sourceRevision': SOURCE, 'sourceTree': TREE,
        'distributionSha256': assets['distribution.zip']['digest'].removeprefix('sha256:'),
        'distributionBytes': assets['distribution.zip']['size'], 'tagObject': TAG,
        'metadata': {name: sha(ordinary(ADDED / name)) for name in ['release.json', 'manifest.json', 'distribution.zip.sha256']},
        'sourceQualification': {'sha256': sha(q), 'bytes': len(q)},
    }
    lock['releases'].append(entry)

    index = ordinary(OUTPUT / 'index.html').decode()
    index = replace_one(index, 'Historical v0.58.0 is preserved with its original game bytes.', 'Historical v0.58.0 and v0.58.1 are preserved with their original game bytes.')
    anchor = '      <li><a href="https://mekhovov.github.io/revealline/releases/">Open the release explorer</a></li>'
    added_links = '\n'.join([
        '      <li><a href="releases/v0.58.1/site/game/">Play v0.58.1</a></li>',
        '      <li><a href="https://github.com/mekhovov/revealline/releases/download/v0.58.1/distribution.zip">Download the original v0.58.1 ZIP</a></li>',
        '      <li><a href="releases/v0.58.1/source-qualification.json">Inspect v0.58.1 source qualification</a></li>',
        anchor,
    ])
    index = replace_one(index, anchor, added_links)
    (OUTPUT / 'index.html').write_text(index)
    workflow = ordinary(OUTPUT / '.github/workflows/deploy.yml').decode()
    workflow = replace_one(workflow, 'git fetch --depth=1 origin refs/tags/v0.58.0:refs/tags/v0.58.0', 'git fetch --depth=1 origin refs/tags/v0.58.0:refs/tags/v0.58.0 refs/tags/v0.58.1:refs/tags/v0.58.1')
    (OUTPUT / '.github/workflows/deploy.yml').write_text(workflow)

    rows = [row for cohort in lock['releases'] for row in verify.metadata_inventory(OUTPUT, cohort)]
    rows.extend([
        {'path': '.nojekyll', 'bytes': 0, 'sha256': sha(b'')},
        *[{'path': name, 'bytes': len(ordinary(OUTPUT / name)), 'sha256': sha(ordinary(OUTPUT / name))} for name in ['index.html', 'releases/index.html']],
    ])
    rows.sort(key=lambda row: row['path'])
    verify.validate_rows(rows)
    inventory = copy.deepcopy(before_inventory)
    inventory['files'] = rows
    inventory_bytes = encoded(inventory)
    (OUTPUT / 'expected-inventory.json').write_bytes(inventory_bytes)
    lock.update(expectedInventorySha256=sha(inventory_bytes), expectedFiles=len(rows), expectedBytes=sum(row['bytes'] for row in rows))
    (OUTPUT / 'source-lock.json').write_bytes(encoded(lock))
    old_rows = [row for row in rows if row['path'].startswith('releases/v0.58.0/')]
    if old_rows != [row for row in before_inventory['files'] if row['path'].startswith('releases/v0.58.0/')]:
        raise ValueError('Append changed an existing canonical versioned byte')
    new_rows = [row for row in rows if row['path'].startswith('releases/v0.58.1/')]
    if (len(new_rows), sum(row['bytes'] for row in new_rows)) != (662, 312699575):
        raise ValueError('Actual new original cohort measurement changed')

    test = ordinary(OUTPUT / 'tools/test_prepare.py').decode()
    test = replace_one(test, "(lock['expectedFiles'], lock['expectedBytes']), (665, 312702795)", f"(lock['expectedFiles'], lock['expectedBytes']), ({lock['expectedFiles']}, {lock['expectedBytes']})")
    test = replace_one(test, "[r['version'] for r in lock['releases']], ['v0.58.0']", "[r['version'] for r in lock['releases']], ['v0.58.0', 'v0.58.1']")
    test = replace_one(test, "self.assertEqual(len(rows), 1)", "self.assertEqual(len(rows), 2)")
    preserved = "        self.assertEqual((len(cohort), sum(r['bytes'] for r in cohort)), (662, 312701443))"
    added_assertions = '''
        successor = lock['releases'][1]
        self.assertEqual(successor['tagObject'], 'a055a08d6f53600276abdf8291d08313c3baf413')
        self.assertEqual(successor['sourceRevision'], 'c93019a344f6f4c6ac03940c77ea09c81122d911')
        self.assertEqual(successor['sourceTree'], 'f6055cbcba92d45ef1da2b5d16e7e4f1158c8d2a')
        self.assertEqual(successor['sourceQualification'], {'sha256': '889961391c700bd9bb3c13475b72c4a5c6c403ddfeecb51c17a076e15ff362c4', 'bytes': 63073})
        self.assertEqual(rows[1]['bytes'], 63073)
        successor_rows = [r for r in inventory['files'] if r['path'].startswith('releases/v0.58.1/')]
        self.assertEqual((len(successor_rows), sum(r['bytes'] for r in successor_rows)), (662, 312699575))'''
    test = replace_one(test, preserved, preserved + added_assertions)
    ast.parse(test)
    (OUTPUT / 'tools/test_prepare.py').write_text(test)

    successor_notice = f'''## Prepared successor: preserve v0.58.1 alongside v0.58.0

This local infrastructure candidate appends published v0.58.1 from source `{SOURCE}`, tree `{TREE}`, annotated tag `{TAG}`. All nine original assets remain on their original Release; four small metadata originals are added here. All 662 canonical v0.58.0 rows stay exact. The prepared combined inventory has {lock['expectedFiles']:,} files / {lock['expectedBytes']:,} bytes, below the unchanged 800,000,000-byte budget. No new game build, source TAR or runtime artwork is produced.

The accepted extractor/verifier and their ordinary-file, tag, metadata, CRC, hash, capacity and no-clobber guards are unchanged. Workflow changes only fetch the second original tag. Full hosted extraction, byte reread, a new complete canonical HTTP audit and scoped actual browser admission are required after the successor's reviewed main merge. Prior v0.58.0 deployment/browser evidence does not accept this two-release successor. Current main/default remains v0.58.1 until the separately qualified v0.59.0 cutover.

P02-A was accepted as a scoped feature in v0.58.1. Archive admission is historical online preservation, not new offline, physical-device, audio or P03 acceptance. The material below is the unchanged historical single-release preparation note; its then-pending P02 status is not current acceptance.

'''
    readme = ordinary(OUTPUT / 'README.md').decode()
    (OUTPUT / 'README.md').write_text(replace_one(readme, '# Reveal Line archive 18\n\n', '# Reveal Line archive 18\n\n' + successor_notice))
    authority = {
        'status': 'PREPARED_ORIGINALS_SUCCESSOR_NOT_DEPLOYED', 'predecessorArchiveCommit': PARENT,
        'predecessorArchiveTree': PARENT_TREE, 'sourceControllerAtPreparation': '6697956df99d4b88a6a09014ac1f7cc7d154ea5a',
        'sourceRepository': 'mekhovov/revealline', 'version': VERSION, 'sourceRevision': SOURCE,
        'sourceTree': TREE, 'tagObject': TAG, 'releaseId': release['id'], 'publishedAt': release['published_at'],
        'assets': [{key: asset[key] for key in ['id', 'name', 'size', 'digest', 'browser_download_url']} for asset in release['assets']],
        'archiveInfrastructureCommit': None, 'archiveDeploymentId': None, 'archiveHttpAcceptance': None,
        'archiveNativeAdmission': None, 'scope': 'Prepared exact originals only; future IDs must come from the actual successor run.',
    }
    write(OUTPUT / 'input-authority-v0581.json', encoded(authority))

    # Metadata-only consistency; this does not run unit tests or extract payloads.
    if verify.locked_inputs(OUTPUT) != (lock, inventory):
        raise ValueError('Generated successor does not pass the original metadata guards')
    for name in ['tools/prepare.py', 'tools/verify.py', 'tools/test_verify.py', 'releases/index.html', '.gitignore', 'input-authority.json']:
        if ordinary(OUTPUT / name) != ordinary(ORIGINAL / name):
            raise ValueError('Unexpected edit to preserved helper or original provenance')
    all_paths = sorted({p.relative_to(base).as_posix() for base in [ORIGINAL, OUTPUT] for p in base.rglob('*') if p.is_file()})
    diff = []
    files = []
    for name in all_paths:
        before = ordinary(ORIGINAL / name) if (ORIGINAL / name).exists() else b''
        after = ordinary(OUTPUT / name)
        files.append({'path': name, 'bytes': len(after), 'sha256': sha(after), 'changed': before != after})
        if before != after:
            diff.extend(difflib.unified_diff(before.decode().splitlines(True), after.decode().splitlines(True), fromfile='original/' + name, tofile='candidate/' + name))
    write(ROOT / 'candidate-adaptation.diff', ''.join(diff).encode())
    review = {'status': 'METADATA_PREPARED_TEST_HOSTED_PUBLIC_NATIVE_PENDING', 'files': files, 'sourceBytes': sum(row['bytes'] for row in files), 'publicFiles': len(rows), 'publicBytes': lock['expectedBytes'], 'inventorySha256': lock['expectedInventorySha256'], 'preservedOriginalVersionedRows': len(old_rows), 'newVersionedRows': len(new_rows), 'newVersionedBytes': sum(row['bytes'] for row in new_rows), 'testsExecuted': False, 'payloadsDownloaded': False, 'remoteMutation': False, 'phaseAccepted': False}
    write(ROOT / 'candidate-review.json', encoded(review))
    print(json.dumps(review))


if __name__ == '__main__':
    main()
