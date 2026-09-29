import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import {
  readPresentation,
  retainPresentationManifests,
  writePresentation,
} from '../../scripts/write-presentation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archive = (files) => `runtime.${hash(files.get('runtime.json'))}.json`;
const own = (files) => new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
function reindex(files) {
  const result = own(files);
  result.set(
    'manifest.json',
    Buffer.from(
      JSON.stringify({
        ...JSON.parse(result.get('manifest.json').toString('utf8')),
        files: [...result]
          .filter(([name]) => name !== 'manifest.json')
          .map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
      }),
    ),
  );
  return result;
}
let pending;
function fixture() {
  return (pending ??= (async () => {
    const source = structuredClone(createDefaultThemeBundle());
    const bytes = await fs.readFile(
      new URL('../assets/field-kit/sprites/player-scout-compact.png', import.meta.url),
    );
    const sha256 = hash(bytes);
    const slot = source.slots.find((item) => item.id === 'player.scout.compact');
    const image = {
      format: FORMATS.asset,
      id: 'retained.original',
      revision: 1,
      kind: 'image',
      description: 'Historical byte fixture',
      provenance: {
        creator: 'Test',
        source: 'Field Kit sprite',
        license: 'Project asset',
        prompt: '',
        parent: null,
      },
      file: { sha256, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
      geometry: structuredClone(slot.geometry),
      recipe: null,
      quality: { stage: 'produced', evidence: [] },
    };
    source.assets.push(image);
    source.themes[1].bindings[slot.id] = { id: image.id, revision: 1 };
    const prior = (await compilePresentation(source, new Map([[sha256, new Blob([bytes])]]))).files;
    const nextSource = structuredClone(createDefaultThemeBundle());
    nextSource.revision = 2;
    const next = (await compilePresentation(nextSource)).files;
    nextSource.revision = 3;
    const later = (await compilePresentation(nextSource)).files;
    return {
      prior: own(prior),
      next: own(next),
      later: own(later),
      assetPath: `assets/${sha256}.png`,
    };
  })());
}
async function location(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-retained-publishing-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, out: path.join(root, 'compiled') };
}

test('retention preserves exact original bytes and dependencies without mutating inputs or the next source identity', async () => {
  const { prior, next, assetPath } = await fixture();
  const beforePrior = own(prior),
    beforeNext = own(next);
  const result = await retainPresentationManifests(next, prior);
  assert.deepEqual(result.get(archive(prior)), prior.get('runtime.json'));
  assert.deepEqual(result.get(assetPath), prior.get(assetPath));
  assert.deepEqual(result.get('runtime.json'), next.get('runtime.json'));
  assert.deepEqual(result.get('studio.json'), next.get('studio.json'));
  assert.deepEqual(
    JSON.parse(result.get('manifest.json')).source,
    JSON.parse(next.get('manifest.json')).source,
  );
  assert.deepEqual(prior, beforePrior);
  assert.deepEqual(next, beforeNext);
  result.get(assetPath)[0] ^= 1;
  assert.deepEqual(prior, beforePrior);
});

test('unchanged defaults are byte-idempotent and subsequent adoption retains the entire historical chain', async () => {
  const { prior, next, later } = await fixture();
  assert.deepEqual(await retainPresentationManifests(prior, prior), prior);
  const second = await retainPresentationManifests(next, prior);
  assert.deepEqual(await retainPresentationManifests(next, second), second);
  const third = await retainPresentationManifests(later, second);
  for (const old of [prior, next])
    assert.deepEqual(third.get(archive(old)), old.get('runtime.json'));
  assert.equal(third.has(archive(later)), false);
  assert.deepEqual(await retainPresentationManifests(later, third), third);
});

test('writer admits verified archives and refuses to discard retained history before changing any output', async (t) => {
  const { prior, next, later } = await fixture();
  const { root, out } = await location(t);
  const second = await retainPresentationManifests(next, prior);
  await writePresentation(second, out);
  await writePresentation(second, out, { check: true });
  await assert.rejects(writePresentation(later, out), /must be preserved exactly/);
  assert.deepEqual(await fs.readFile(path.join(out, 'runtime.json')), next.get('runtime.json'));
  assert.deepEqual(await fs.readFile(path.join(out, archive(prior))), prior.get('runtime.json'));
  assert.deepEqual(await fs.readdir(root), ['compiled']);
  const third = await retainPresentationManifests(later, second);
  await writePresentation(third, out);
  await writePresentation(third, out, { check: true });
  assert.deepEqual(await fs.readdir(root), ['compiled']);
});

test('honest ownership metadata cannot authenticate a wrong archive filename or missing/corrupted dependency', async (t) => {
  const { prior, next, assetPath } = await fixture();
  const { root, out } = await location(t);
  const valid = await retainPresentationManifests(next, prior);
  for (const mutate of [
    (files) => {
      const value = files.get(archive(prior));
      files.delete(archive(prior));
      files.set(`runtime.${'0'.repeat(64)}.json`, value);
    },
    (files) => files.delete(assetPath),
    (files) => files.set(assetPath, Buffer.alloc(files.get(assetPath).length)),
    (files) => files.set(archive(prior), Buffer.from(files.get(archive(prior)).toString() + '\n')),
    (files) => files.set('runtime.NOT-A-HASH.json', Buffer.from('{}')),
  ]) {
    const invalid = own(valid);
    mutate(invalid);
    await assert.rejects(writePresentation(reindex(invalid), out));
    assert.deepEqual(await fs.readdir(root), []);
  }
});

test('manually altered archived output is retained for recovery instead of overwritten', async (t) => {
  const { prior, next } = await fixture();
  const { out } = await location(t);
  const valid = await retainPresentationManifests(next, prior);
  await writePresentation(valid, out);
  const filename = path.join(out, archive(prior));
  await fs.writeFile(filename, 'keep manual damage visible');
  await assert.rejects(writePresentation(valid, out), /does not match/);
  assert.equal(await fs.readFile(filename, 'utf8'), 'keep manual damage visible');
});

test('retention rejects malformed defaults, missing dependencies and conflicting hash-named bytes before adoption', async () => {
  const { prior, next, assetPath } = await fixture();
  const missing = own(prior);
  missing.delete(assetPath);
  await assert.rejects(retainPresentationManifests(next, reindex(missing)), /unavailable/);
  const corrupt = own(next);
  corrupt.set('runtime.json', Buffer.from('{}'));
  await assert.rejects(retainPresentationManifests(reindex(corrupt), prior));
  const conflicting = own(next);
  conflicting.set(assetPath, Buffer.alloc(prior.get(assetPath).length));
  await assert.rejects(
    retainPresentationManifests(reindex(conflicting), prior),
    /Conflicting retained/,
  );
  const noRuntime = own(next);
  noRuntime.delete('runtime.json');
  await assert.rejects(
    retainPresentationManifests(reindex(noRuntime), prior),
    /both original runtime/,
  );
});

test('owned output reader permits only explicitly absent output and never creates a directory', async (t) => {
  const { root, out } = await location(t);
  await assert.rejects(readPresentation(out), { code: 'ENOENT' });
  assert.equal(await readPresentation(out, { allowMissing: true }), null);
  assert.deepEqual(await fs.readdir(root), []);
});

test('owned output reader returns detached exact archived bytes ready for transitive retention', async (t) => {
  const { prior, next, later, assetPath } = await fixture();
  const { out } = await location(t);
  const second = await retainPresentationManifests(next, prior);
  await writePresentation(second, out);
  const read = await readPresentation(out);
  assert.deepEqual(read, second);
  const third = await retainPresentationManifests(later, read);
  assert.deepEqual(third.get(archive(prior)), prior.get('runtime.json'));
  assert.deepEqual(third.get(archive(next)), next.get('runtime.json'));
  read.get(assetPath)[0] ^= 1;
  assert.deepEqual(await readPresentation(out), second);
});

test('owned output reader rejects incomplete or changed existing trees even when absence is allowed', async (t) => {
  const { prior, assetPath } = await fixture();
  const { out } = await location(t);
  await fs.mkdir(out);
  await assert.rejects(
    readPresentation(out, { allowMissing: true }),
    /no valid ownership manifest/,
  );
  await fs.rmdir(out);
  await writePresentation(prior, out);
  await fs.unlink(path.join(out, assetPath));
  await assert.rejects(
    readPresentation(out, { allowMissing: true }),
    /does not match its manifest/,
  );
  await fs.writeFile(path.join(out, assetPath), Buffer.from('manual edit'));
  await assert.rejects(
    readPresentation(out, { allowMissing: true }),
    /does not match its manifest/,
  );
  assert.equal(await fs.readFile(path.join(out, assetPath), 'utf8'), 'manual edit');
});

test('owned output reader rejects top-level and nested links or unmanaged files without following them', async (t) => {
  const { prior, assetPath } = await fixture();
  const { root, out } = await location(t);
  await writePresentation(prior, out);
  const link = path.join(root, 'alias');
  await fs.symlink(out, link, 'dir');
  await assert.rejects(readPresentation(link), /real directory/);
  const note = path.join(out, 'private-note.txt');
  await fs.writeFile(note, 'preserve');
  await assert.rejects(readPresentation(out), /Unmanaged presentation output/);
  assert.equal(await fs.readFile(note, 'utf8'), 'preserve');
  await fs.unlink(note);
  const external = path.join(root, 'external.png');
  await fs.writeFile(external, prior.get(assetPath));
  await fs.unlink(path.join(out, assetPath));
  await fs.symlink(external, path.join(out, assetPath));
  await assert.rejects(readPresentation(out), /Unmanaged presentation output/);
  assert.deepEqual(await fs.readFile(external), prior.get(assetPath));
});
