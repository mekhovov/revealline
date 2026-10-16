import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareRegionalDelivery } from './prepare-delivery.mjs';

const [source, scratchParent] = process.argv.slice(2);
assert(
  source && scratchParent,
  'Usage: node verify-delivery-preparation.mjs SOURCE EXTERNAL_SCRATCH',
);
const scratch = await mkdtemp(path.join(scratchParent, 'delivery-verification-'));
const options = { source, id: 'urban-earthworks-study', revision: 'review-r1' };
const first = await prepareRegionalDelivery({ ...options, output: path.join(scratch, 'first') });
const second = await prepareRegionalDelivery({ ...options, output: path.join(scratch, 'second') });
assert.deepEqual(first, second);
for (const file of first.descriptor.files) {
  const bytes = await readFile(path.join(scratch, 'first', file.path));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
}
await assert.rejects(
  prepareRegionalDelivery({ ...options, output: path.join(scratch, 'first') }),
  /EEXIST/,
);
await assert.rejects(
  prepareRegionalDelivery({ ...options, id: '../unsafe', output: path.join(scratch, 'bad-id') }),
  /identity/,
);
const altered = path.join(scratch, 'altered');
await cp(source, altered, { recursive: true });
const manifestPath = path.join(altered, 'terrain/region.json');
const original = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const assetPath = path.join(altered, 'terrain', manifest.assets[0].path);
const asset = await readFile(assetPath);
const corrupt = Buffer.from(asset);
corrupt[corrupt.length - 1] ^= 1;
await writeFile(assetPath, corrupt);
await assert.rejects(
  prepareRegionalDelivery({ ...options, source: altered, output: path.join(scratch, 'bad-asset') }),
  /asset mismatch/,
);
await assert.rejects(stat(path.join(scratch, 'bad-asset')), /ENOENT/);
await writeFile(assetPath, asset);
manifest.spawns[0].position.x += 1;
await writeFile(manifestPath, JSON.stringify(manifest));
await assert.rejects(
  prepareRegionalDelivery({ ...options, source: altered, output: path.join(scratch, 'bad-spawn') }),
  /spawns differ/,
);
await writeFile(manifestPath, original);
manifest.assets[0].path = '../outside.glb';
await writeFile(manifestPath, JSON.stringify(manifest));
await assert.rejects(
  prepareRegionalDelivery({ ...options, source: altered, output: path.join(scratch, 'bad-path') }),
);
await writeFile(manifestPath, original);
const invalidUtf8 = Buffer.from(original);
const titleIndex = invalidUtf8.indexOf(Buffer.from(manifest.title.en));
assert(titleIndex >= 0, 'Fixture has a manifest title');
invalidUtf8[titleIndex] = 0xff;
await writeFile(manifestPath, invalidUtf8);
await assert.rejects(
  prepareRegionalDelivery({ ...options, source: altered, output: path.join(scratch, 'bad-utf8') }),
  /encoded data|encoding/i,
);
await assert.rejects(stat(path.join(scratch, 'bad-utf8')), /ENOENT/);
await writeFile(manifestPath, original);
for (const [name, mutate, reason] of [
  [
    'region-id',
    (m) => {
      m.id = 'another-region';
    },
    /identities differ/,
  ],
  [
    'revision',
    (m) => {
      m.revision = 'another-revision';
    },
    /identities differ/,
  ],
  [
    'cell-id',
    (m) => {
      m.chunks[0].id = 'another-cell';
    },
    /cell identities differ/,
  ],
  [
    'cell-coordinate',
    (m) => {
      [m.chunks[0].x, m.chunks[0].z, m.chunks[1].x, m.chunks[1].z] = [
        m.chunks[1].x,
        m.chunks[1].z,
        m.chunks[0].x,
        m.chunks[0].z,
      ];
    },
    /cell identities differ/,
  ],
]) {
  const changed = JSON.parse(original);
  mutate(changed);
  await writeFile(manifestPath, JSON.stringify(changed));
  const rejectedOutput = path.join(scratch, `bad-${name}`);
  await assert.rejects(
    prepareRegionalDelivery({ ...options, source: altered, output: rejectedOutput }),
    reason,
  );
  await assert.rejects(stat(rejectedOutput), /ENOENT/);
}
await writeFile(manifestPath, original);
const existing = path.join(scratch, 'existing');
await mkdir(existing);
await writeFile(path.join(existing, 'preserve.txt'), 'unfinished user work');
await assert.rejects(prepareRegionalDelivery({ ...options, output: existing }), /EEXIST/);
assert.equal(await readFile(path.join(existing, 'preserve.txt'), 'utf8'), 'unfinished user work');
console.log(
  JSON.stringify(
    {
      status: 'passed',
      scratch,
      files: first.descriptor.files.length,
      totalBytes: first.descriptor.totalBytes,
      pin: first.pin,
      checks: [
        'deterministic closure',
        'all copied hashes',
        'existing output retained',
        'unsafe identity rejected',
        'corrupt source rejected before output',
        'paired spawn mismatch rejected',
        'paired ID/revision/cell-ID/cell-coordinate mismatches rejected before output',
        'traversal rejected',
        'unrelated output preserved',
        'invalid UTF-8 rejected before output',
      ],
    },
    null,
    2,
  ),
);
