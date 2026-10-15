import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/publish-main-pages.yml', import.meta.url),
  'utf8',
);
const inventoryStep = workflow
  .split('      - name: Verify Pages capacity and record the exact inventory\n')[1]
  .split('\n      - name:')[0];
const python = inventoryStep
  .match(/python3 - <<'PY'\n([\s\S]*?)\n          PY/)[1]
  .split('\n')
  .map((line) => line.slice(10))
  .join('\n');
const source = 'a'.repeat(40);

async function fixture(t, files = { 'index.html': 'hello' }) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages-capacity-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'main-pages');
  await mkdir(root);
  for (const [name, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), text);
  }
  return { directory, root };
}
function run(f, maximum = 100) {
  return spawnSync('python3', ['-c', python], {
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNNER_TEMP: f.directory,
      SOURCE_SHA: source,
      MAX_PUBLISHED_BYTES: String(maximum),
      GITHUB_OUTPUT: path.join(f.directory, 'outputs'),
    },
  });
}
const json = async (f, name) => JSON.parse(await readFile(path.join(f.directory, name), 'utf8'));

test('oversized final staging writes failure evidence before rejecting publication', async (t) => {
  const f = await fixture(t, { 'index.html': 'hello', 'practice/package.bin': '1234567890' });
  const result = run(f, 14);
  assert.equal(result.status, 1);
  const receipt = await json(f, 'main-pages-receipt.json');
  assert.equal(receipt.sourceRevision, source);
  assert.equal(receipt.bytes, 15);
  assert.equal(receipt.completeInventory, true);
  assert.equal(receipt.capacityAccepted, false);
  assert.equal(receipt.withinCapacity, false);
});

test('inventory binds final files, hidden assets and generated metadata by exact bytes', async (t) => {
  const files = {
    'index.html': 'hello',
    '.well-known/value': 'hidden',
    'main-deployment.json': '{}',
  };
  const f = await fixture(t, files);
  assert.equal(run(f, 13).status, 0);
  const receipt = await json(f, 'main-pages-receipt.json');
  const inventory = await json(f, 'main-pages-inventory.json');
  assert.equal(receipt.files, 3);
  assert.equal(receipt.bytes, 13);
  assert.equal(receipt.capacityAccepted, true);
  assert.equal(
    receipt.inventorySha256,
    createHash('sha256')
      .update(await readFile(path.join(f.directory, 'main-pages-inventory.json')))
      .digest('hex'),
  );
  assert.deepEqual(
    inventory.files.map((f) => f.path),
    Object.keys(files).sort(),
  );
  for (const file of inventory.files) {
    assert.equal(file.bytes, Buffer.byteLength(files[file.path]));
    assert.equal(file.sha256, createHash('sha256').update(files[file.path]).digest('hex'));
  }
  assert.equal(receipt.largestFiles[0].path, '.well-known/value');
});

for (const kind of ['symlink', 'directory symlink', 'hard link'])
  test(`${kind} is rejected with explicitly incomplete evidence`, async (t) => {
    const f = await fixture(t);
    if (kind === 'hard link')
      await link(path.join(f.root, 'index.html'), path.join(f.root, 'alias'));
    else
      await symlink(
        kind === 'directory symlink' ? f.root : path.join(f.root, 'index.html'),
        path.join(f.root, 'alias'),
      );
    assert.equal(run(f).status, 1);
    const receipt = await json(f, 'main-pages-receipt.json');
    assert.equal(receipt.completeInventory, false);
    assert.equal(receipt.capacityAccepted, false);
    assert.ok(receipt.errors.length > 0);
  });

test('an empty staging tree cannot become publishable', async (t) => {
  const f = await fixture(t, {});
  assert.equal(run(f).status, 1);
  assert.equal((await json(f, 'main-pages-receipt.json')).capacityAccepted, false);
});

test('unreadable subtrees cannot be silently omitted from a complete inventory', async (t) => {
  if (process.getuid?.() === 0) return t.skip('Root bypasses directory access permissions.');
  const f = await fixture(t, { 'index.html': 'hello', 'private/asset.bin': 'hidden' });
  const directory = path.join(f.root, 'private');
  await chmod(directory, 0);
  try {
    assert.equal(run(f).status, 1);
    const receipt = await json(f, 'main-pages-receipt.json');
    assert.equal(receipt.completeInventory, false);
    assert.equal(receipt.capacityAccepted, false);
    assert.match(receipt.errors.join('\n'), /Could not enumerate staged directory/);
  } finally {
    await chmod(directory, 0o755);
  }
});

test('upload-action exclusions are rejected instead of advertising unarchived files', async (t) => {
  const f = await fixture(t, { 'index.html': 'hello', '.github/hidden.txt': 'not archived' });
  assert.equal(run(f).status, 1);
  const receipt = await json(f, 'main-pages-receipt.json');
  assert.equal(receipt.completeInventory, false);
  assert.match(receipt.errors.join('\n'), /excluded from the Pages archive/);
});

test('receipt upload survives failure while Pages upload and deploy remain success-gated', () => {
  const upload = workflow
    .split('      - name: Upload deployment receipt\n')[1]
    .split('\n      - name:')[0];
  assert.match(
    upload,
    /if: \$\{\{ !cancelled\(\) && \(steps\.inventory\.outcome == 'success' \|\| steps\.inventory\.outcome == 'failure'\) \}\}/,
  );
  assert.match(upload, /main-pages-inventory\.json/);
  const pages = workflow
    .split('      - name: Upload the exact Pages artifact\n')[1]
    .split('\n      - name:')[0];
  assert.doesNotMatch(pages, /always\(|continue-on-error|if:/);
  assert.match(workflow, /deploy:\n    needs: build\n/);
  assert.match(workflow, /MAX_PUBLISHED_BYTES: 980000000/);
  assert.match(workflow, /cancel-in-progress: false/);
});
