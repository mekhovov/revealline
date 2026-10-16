import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./pages-recovery.py', import.meta.url));
const fixture = `
import hashlib, importlib.util, io, json, pathlib, sys, tarfile, tempfile
spec = importlib.util.spec_from_file_location('recovery', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
case = sys.argv[2]
sha = 'a' * 40
hash = lambda data: hashlib.sha256(data).hexdigest()
with tempfile.TemporaryDirectory(prefix='pages-recovery-test-') as temporary:
  root = pathlib.Path(temporary)
  bundle = root / 'bundle'
  bundle.mkdir()
  destination = root / 'restore'
  members = [('index.html', b'hello', 'file')]
  if case in ('traversal', 'absolute', 'backslash'):
    members = [({'traversal':'../index.html', 'absolute':'/index.html', 'backslash':'a\\\\b'}[case], b'hello', 'file')]
  if case in ('symlink', 'hardlink'):
    members = [('index.html', b'', case)]
  if case == 'duplicate': members *= 2
  if case == 'missing': members = []
  if case == 'extra': members += [('extra', b'extra', 'file')]
  if case == 'changed': members = [('index.html', b'other', 'file')]
  with tarfile.open(bundle / 'artifact.tar', 'w') as tar:
    for name, data, kind in members:
      member = tarfile.TarInfo(name)
      if kind != 'file':
        member.type = tarfile.SYMTYPE if kind == 'symlink' else tarfile.LNKTYPE
        member.linkname = '/tmp/not-a-target'
        tar.addfile(member)
      else:
        member.size = len(data)
        tar.addfile(member, io.BytesIO(data))
  inventory = {'format':'revealline-main-pages-inventory.v1', 'sourceRevision':sha,
    'completeInventory':True, 'files':[{'path':'index.html','bytes':5,'sha256':hash(b'hello')}]}
  raw = json.dumps(inventory).encode()
  (bundle / 'main-pages-inventory.json').write_bytes(raw)
  staged = {'format':'revealline-main-pages-receipt.v1', 'sourceRevision':sha,
    'completeInventory':True, 'capacityAccepted':True, 'inventorySha256':hash(raw),
    'files':1, 'bytes':5, 'maximumBytes':980000000, 'errors':[]}
  archive = {'format':'revealline-main-pages-archive-receipt.v1', 'sourceRevision':sha,
    'archiveAccepted':True, 'inventorySha256':hash(raw), 'files':1, 'stagedBytes':5,
    'archiveBytes':(bundle / 'artifact.tar').stat().st_size,
    'archiveSha256':hash((bundle / 'artifact.tar').read_bytes()),
    'maximumArchiveBytes':980000000, 'errors':[]}
  if case == 'inventory-hash': staged['inventorySha256'] = '0'*64
  if case == 'archive-hash': archive['archiveSha256'] = '0'*64
  if case == 'source': archive['sourceRevision'] = 'b'*40
  if case == 'rejected': archive['archiveAccepted'] = False
  if case == 'size': archive['archiveBytes'] += 1
  if case == 'occupied':
    destination.mkdir()
    (destination / 'keep').write_text('untouched')
  for name, data in [('main-pages-receipt.json',staged),('main-pages-archive-receipt.json',archive)]:
    (bundle / name).write_text(json.dumps(data))
  try:
    result = module.recover(bundle, destination, sha, '123')
  except (ValueError, AssertionError) as error:
    assert case != 'valid', str(error)
    assert not (bundle / 'recovery-rehearsal.json').exists()
    if case == 'occupied': assert (destination / 'keep').read_text() == 'untouched'
    else: assert not destination.exists(), 'Untrusted input created a restore directory'
    print(json.dumps({'refused':case,'reason':str(error)}))
  else:
    assert case == 'valid', 'Invalid fixture was accepted: '+case
    assert result['exactRestoreVerified'] and not result['productionDeploymentPerformed']
    assert not result['browserGameplayQualified']
    assert (destination / 'index.html').read_bytes() == b'hello'
    print(json.dumps(result))
`;

for (const name of [
  'valid',
  'traversal',
  'absolute',
  'backslash',
  'symlink',
  'hardlink',
  'duplicate',
  'missing',
  'extra',
  'changed',
  'inventory-hash',
  'archive-hash',
  'source',
  'rejected',
  'size',
  'occupied',
])
  test(`isolated recovery: ${name}`, () => {
    const result = spawnSync('python3', ['-B', '-c', fixture, script, name], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(result.stdout);
    if (name !== 'valid') assert.equal(receipt.refused, name);
  });

test('recovery publication is manual, main-only, separately serialized and never deploys Pages', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/preserve-pages-recovery.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /group: pages-recovery-preservation\n  cancel-in-progress: false/);
  assert.doesNotMatch(
    workflow,
    /pages: write|deploy-pages@|--clobber|continue-on-error|latest=true/,
  );
  assert.match(workflow, /\.path == "\.github\/workflows\/publish-main-pages.yml"/);
  assert.match(workflow, /\.conclusion == "success"/);
  assert.match(workflow, /\.sourceRevision == \$sha/);
  assert.match(workflow, /\.workflow_run.head_sha == \$sha/);
  assert.match(workflow, /sha256sum --check SHA256SUMS/);
  assert.match(workflow, /--draft=false --latest=false/);
  assert.match(workflow, /git\/matching-refs\/tags\/\$tag/);
  assert.match(workflow, /jq -e 'length == 0'/);
  assert.match(workflow, /commits\/\$tag.*grep -qx "\$SOURCE_SHA"/);
  assert.match(workflow, /--method POST.*git\/refs.*ref=refs\/tags\/\$tag.*sha=\$SOURCE_SHA/);
  assert.ok(workflow.indexOf('pages-recovery.py --bundle') < workflow.indexOf('gh release create'));
  assert.ok(workflow.indexOf('sha256sum --check') < workflow.indexOf('gh release edit'));
});
