import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, LIMITS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { retainPresentationOutput } from '../../scripts/retain-presentation-output.mjs';
import {
  writePresentation,
  verifyPresentationOutput,
  RETAINED_OUTPUT_LIMITS,
} from '../../scripts/write-presentation.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const retainedName = (files) => `runtime.${hash(files.get('runtime.json'))}.json`;
const own = (files) => new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
function resign(files) {
  const old = JSON.parse(files.get('manifest.json'));
  old.files = [...files]
    .filter(([name]) => name !== 'manifest.json')
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }));
  files.set('manifest.json', Buffer.from(JSON.stringify(old)));
  return files;
}
const fixtures = new Map();
function fixture(index) {
  if (!fixtures.has(index))
    fixtures.set(
      index,
      (async () => {
        const document = structuredClone(createDefaultThemeBundle());
        document.revision = index;
        document.themes[1].tokens.accent = undefined;
        delete document.themes[1].tokens.accent;
        document.themes[1].tokens.amber = index === 1 ? '#f4bf62' : '#ffca70';
        const bytes = await fs.readFile(
          new URL(
            index === 1
              ? '../assets/field-kit/sprites/player-scout-compact.png'
              : '../assets/field-kit/sprites/player-bomber-compact.png',
            import.meta.url,
          ),
        );
        const sha256 = hash(bytes),
          slot = document.slots.find((s) => s.id === 'player.scout.compact');
        document.assets.push({
          format: FORMATS.asset,
          id: 'retention.sprite',
          revision: index,
          kind: 'image',
          description: 'Original retention test sprite',
          provenance: {
            creator: 'Test',
            source: 'Project sprite',
            license: 'Project asset',
            prompt: '',
            parent: null,
          },
          file: { sha256, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
          geometry: structuredClone(slot.geometry),
          recipe: null,
          quality: { stage: 'produced', evidence: [] },
        });
        document.themes[1].bindings[slot.id] = { id: 'retention.sprite', revision: index };
        const assets = new Map([[sha256, new Blob([bytes], { type: 'image/png' })]]);
        return {
          document,
          assets,
          ...(await compilePresentation(document, assets)),
          imagePath: `assets/${sha256}.png`,
        };
      })(),
    );
  return fixtures.get(index);
}
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-retained-output-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, out: path.join(root, 'compiled') };
}
async function diskFiles(directory) {
  const files = new Map();
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory())
      for (const file of await fs.readdir(path.join(directory, item.name)))
        files.set(`${item.name}/${file}`, await fs.readFile(path.join(directory, item.name, file)));
    else files.set(item.name, await fs.readFile(path.join(directory, item.name)));
  }
  return files;
}
function fingerprints(files) {
  return [...files]
    .map(([name, bytes]) => [name, hash(bytes)])
    .sort(([a], [b]) => a.localeCompare(b));
}

test('explicit compiler retention preserves exact prior runtime and only its selected dependencies', async () => {
  const a = await fixture(1),
    b = await fixture(2),
    before = fingerprints(a.files);
  const joined = await compilePresentation(b.document, b.assets, { previousOutput: a.files });
  assert.deepEqual(
    joined.files.get(retainedName(a.files)),
    Buffer.from(a.files.get('runtime.json')),
  );
  assert.deepEqual(joined.files.get(a.imagePath), Buffer.from(a.files.get(a.imagePath)));
  for (const name of ['runtime.json', 'studio.json', 'theme.css'])
    assert.equal(hash(joined.files.get(name)), hash(b.files.get(name)));
  assert.deepEqual(
    joined.dependencies,
    b.dependencies,
    'current offline descriptor stays the selected current snapshot',
  );
  assert.deepEqual(fingerprints(a.files), before);
  assert.notEqual(
    joined.files.get(a.imagePath),
    a.files.get(a.imagePath),
    'input buffers are not aliased',
  );
  await verifyPresentationOutput(joined.files);
  assert.deepEqual(
    fingerprints(await retainPresentationOutput(b.files, a.files)),
    fingerprints(joined.files),
  );
});

test('ordinary directory adoption retains two generations and repeat builds are byte-identical', async (t) => {
  const { out, root } = await temporary(t),
    a = await fixture(1),
    b = await fixture(2),
    c = await fixture(3);
  await writePresentation(a.files, out);
  const ab = await retainPresentationOutput(b.files, a.files);
  await writePresentation(ab, out);
  const abc = await retainPresentationOutput(c.files, await diskFiles(out));
  await writePresentation(abc, out);
  await writePresentation(abc, out, { check: true });
  assert.deepEqual(
    await fs.readFile(path.join(out, retainedName(a.files))),
    Buffer.from(a.files.get('runtime.json')),
  );
  assert.deepEqual(
    await fs.readFile(path.join(out, retainedName(b.files))),
    Buffer.from(b.files.get('runtime.json')),
  );
  const repeat = await retainPresentationOutput(c.files, ab);
  assert.deepEqual(fingerprints(repeat), fingerprints(abc));
  assert.deepEqual(
    fingerprints(await retainPresentationOutput(c.files, abc)),
    fingerprints(abc),
    'rebuilding the unchanged current collection does not append a redundant snapshot',
  );
  assert.deepEqual(await fs.readdir(root), ['compiled'], 'no abandoned staging directories');
});

test('writer refuses a rebuild that drops admitted history before changing any current bytes', async (t) => {
  const { out, root } = await temporary(t),
    a = await fixture(1),
    b = await fixture(2);
  const ab = await retainPresentationOutput(b.files, a.files);
  await writePresentation(ab, out);
  const before = fingerprints(await diskFiles(out));
  await assert.rejects(writePresentation(b.files, out), /must be preserved/);
  await assert.rejects(writePresentation(b.files, out, { check: true }), /must be preserved/);
  assert.deepEqual(fingerprints(await diskFiles(out)), before);
  assert.deepEqual(await fs.readdir(root), ['compiled']);
});

test('wrong retained pin, missing old image, corrupt dependency and unsafe URL fail before replacement', async (t) => {
  const { out, root } = await temporary(t),
    a = await fixture(1),
    b = await fixture(2);
  const ab = await retainPresentationOutput(b.files, a.files);
  await writePresentation(ab, out);
  const before = fingerprints(await diskFiles(out));
  for (const kind of ['pin', 'missing', 'corrupt', 'url']) {
    const bad = own(ab),
      name = retainedName(a.files);
    if (kind === 'pin') {
      bad.set(`runtime.${'0'.repeat(64)}.json`, bad.get(name));
      bad.delete(name);
    }
    if (kind === 'missing') bad.delete(a.imagePath);
    if (kind === 'corrupt') {
      const data = bad.get(a.imagePath);
      data[0] ^= 1;
    }
    if (kind === 'url') {
      const runtime = JSON.parse(bad.get(name));
      runtime.urls[Object.keys(runtime.urls)[0]] = '../outside.png';
      const bytes = Buffer.from(JSON.stringify(runtime));
      bad.delete(name);
      bad.set(`runtime.${hash(bytes)}.json`, bytes);
    }
    resign(bad);
    await assert.rejects(writePresentation(bad, out), /Retained|dependency|URL|url|asset/i, kind);
    assert.deepEqual(fingerprints(await diskFiles(out)), before, kind);
  }
  assert.deepEqual(await fs.readdir(root), ['compiled']);
});

test('invalid previous ownership and missing prior runtime never mutate compiler inputs', async () => {
  const a = await fixture(1),
    b = await fixture(2),
    before = fingerprints(b.files);
  const bad = own(a.files);
  bad.delete('runtime.json');
  resign(bad);
  await assert.rejects(retainPresentationOutput(b.files, bad), /bounded original/);
  const missingImage = own(a.files);
  missingImage.delete(a.imagePath);
  resign(missingImage);
  await assert.rejects(retainPresentationOutput(a.files, missingImage), /unavailable/);
  const corrupt = own(a.files);
  corrupt.get('runtime.json')[0] ^= 1;
  await assert.rejects(retainPresentationOutput(b.files, corrupt), /does not match/);
  assert.deepEqual(fingerprints(b.files), before);
});

test('retained manifest capacity fails before parsing an oversized history set', async () => {
  const f = own((await fixture(1)).files);
  for (let i = 0; i <= RETAINED_OUTPUT_LIMITS.manifests; i++)
    f.set(`runtime.${i.toString(16).padStart(64, '0')}.json`, Buffer.from('{}'));
  await assert.rejects(verifyPresentationOutput(resign(f)), /manifest capacity/);
});

test('retained aggregate byte capacity includes original manifest bytes without normalizing them', async () => {
  const f = own((await fixture(1)).files),
    source = JSON.parse(f.get('runtime.json'));
  for (let i = 0; i < 7; i++) {
    source.source.revision = i + 1;
    const prefix = Buffer.from(JSON.stringify(source)),
      bytes = Buffer.alloc(LIMITS.manifestBytes, 32);
    prefix.copy(bytes);
    f.set(`runtime.${hash(bytes)}.json`, bytes);
  }
  await assert.rejects(verifyPresentationOutput(resign(f)), /byte capacity/);
});
