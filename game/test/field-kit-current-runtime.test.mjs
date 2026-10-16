// Authored regressions; automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { importThemeBundle } from '../presentation/bundle.mjs';
import { inspectPresentationDependencies } from '../presentation/dependencies.mjs';
import {
  FIELD_KIT_RETAINED_CANONICAL104 as current,
  FIELD_KIT_RETAINED_NATIVE_PREDECESSOR103 as previous,
  readFieldKitRetainedOutput,
} from '../../scripts/field-kit-retained-runtime.mjs';
import { verifyPresentationOutput } from '../../scripts/write-presentation.mjs';

const read = (name) => readFile(new URL(`../../${name}`, import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function ledger() {
  return importThemeBundle(
    new Blob([await read('authoring/library/fpv-field-kit/production.rltheme')]),
    { decodeImage: null },
  );
}

test('canonical104 retains exact committed bytes,335 original bindings and complete lazy dependencies', async () => {
  const raw = await read(current.path),
    production = await ledger(),
    runtime = JSON.parse(raw),
    files = await readFieldKitRetainedOutput({ assets: production.assets, read });
  assert.equal(raw.length, 1264907);
  assert.equal(sha256(raw), 'b1123620aa68398dd8131aafa23f29bd686224bb9e50bf86ceeeef94752a1ef3');
  assert.equal(
    createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex'),
    current.blob,
  );
  assert.equal(current.commit, 'c5e22bc860e9021d42ce326761d0f4decba3fc40');
  assert.deepEqual(runtime.source, { id: 'field-kit', revision: 104 });
  assert.equal(runtime.resolved.theme.id, 'fpv');
  assert.equal(runtime.resolved.theme.revision, 104);
  assert.equal(runtime.resolved.collection, null);
  assert.equal(Object.keys(runtime.resolved.assets).length, 335);
  for (const [slot, asset] of Object.entries(runtime.resolved.assets)) {
    assert.ok(production.document.slots.some((entry) => entry.id === slot));
    assert.equal(
      canonicalJSON(
        production.document.assets.find(
          (entry) => entry.id === asset.id && entry.revision === asset.revision,
        ),
      ),
      canonicalJSON(asset),
      `${slot} retains its original immutable record even after a successor selection`,
    );
  }
  assert.deepEqual(files.get('runtime.json'), raw);
  assert.deepEqual(files.get(`runtime.${previous.sha256}.json`), await read(previous.path));
  const inventory = await inspectPresentationDependencies(raw);
  for (const file of inventory.files) {
    assert.equal(files.get(file.path)?.length, file.bytes, file.path);
    assert.equal(sha256(files.get(file.path)), file.sha256, file.path);
  }
  await verifyPresentationOutput(files);
});

test('retention rejects changed/truncated canonical104 and its missing dependency instead of dropping the published pin', async () => {
  const raw = await read(current.path),
    production = await ledger(),
    corrupt = Buffer.from(raw);
  corrupt[100] ^= 1;
  for (const replacement of [corrupt, raw.subarray(1)])
    await assert.rejects(
      readFieldKitRetainedOutput({
        assets: production.assets,
        read: (name) => (name === current.path ? replacement : read(name)),
      }),
      /runtime input hash differs|runtime byte count differs/,
    );
  const { files } = await inspectPresentationDependencies(raw),
    missing = new Map(production.assets);
  missing.delete(files[0].sha256);
  await assert.rejects(
    readFieldKitRetainedOutput({ assets: missing, read }),
    /dependency is unavailable/,
  );
});
