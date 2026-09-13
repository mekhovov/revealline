import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, symlink, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ROOT,
  ID,
  SOURCE_PACK_SHA,
  buildExternalSentinel,
  writeExternalSentinel,
  boundedFile,
  physicalLevel,
} from '../../authoring/library/sentinel-circuit-external/build.mjs';
import {
  PROOF_FILE,
  verifyExternalSentinel,
} from '../../authoring/library/sentinel-circuit-external/verify.mjs';
import { prepareExternalChapter, externalChapterHash } from '../external-chapter.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { decodeOriginalPNG } from '../../authoring/library/four-worlds-chapters/verify-images.mjs';

const world = await buildExternalSentinel();
const proof = JSON.parse(await readFile(path.join(ROOT, PROOF_FILE)));
const decodeImage = async (value) => {
  const bytes =
    typeof value === 'string'
      ? Buffer.from(value.split(',')[1], 'base64')
      : Buffer.from(await value.arrayBuffer());
  return decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`);
};

test('new external Sentinel pairs three exact originals with unchanged wide missions and two boss schedules', async () => {
  const { descriptor, prepared, sourcePack, payloads } = world;
  assert.equal(descriptor.id, ID);
  assert.notEqual(descriptor.id, sourcePack.id);
  assert.equal(descriptor.source.sha256, SOURCE_PACK_SHA);
  assert.equal(descriptor.pack.bytes, 9238);
  assert.equal(descriptor.media.bytes, 8596058);
  assert.equal(prepared.pack.classRecipes.length, 7);
  assert.deepEqual(prepared.pack.themes, sourcePack.themes);
  assert.deepEqual(prepared.pack.music, sourcePack.music);
  const levels = prepared.pack.campaigns[0].levels;
  for (const [i, level] of levels.entries()) {
    assert.notEqual(level.id, sourcePack.campaigns[0].levels[i].id);
    assert.deepEqual(physicalLevel(level), physicalLevel(sourcePack.campaigns[0].levels[i]));
    assert.deepEqual([level.width, level.height], [72, 36]);
    const p = prepared.imported.document.library.presentations[i];
    assert.equal(p.story, null);
    assert.deepEqual(p.poster, {
      assetId: descriptor.originals[i].assetId,
      fit: 'contain',
      sampling: 'nearest',
    });
    assert.equal(p.identity.baseCampaignKey, descriptor.campaignKey);
    assert.equal(p.identity.levelId, level.id);
    const original = descriptor.originals[i];
    const stored = prepared.imported.assets.find((a) => a.sha256 === original.sha256);
    assert.ok(stored);
    const source = world.inputPins.find((p) => p.sha256 === original.sha256);
    assert.deepEqual(
      Buffer.from(await stored.blob.arrayBuffer()),
      await readFile(path.join(ROOT, source.path)),
    );
  }
  assert.equal(levels.filter((l) => l.encounter).length, 1);
  assert.deepEqual(
    Object.keys(levels[2].encounter).filter((k) => ['shielded', 'exposed'].includes(k)),
    ['shielded', 'exposed'],
  );
  assert.ok(!(await payloads.pack.text()).includes('data:image/'));
  assert.deepEqual(prepared.pack.visualOverrides, {});
  assert.deepEqual(prepared.pack.levelVisuals, []);
});

test('fixed producer repeats exact compact pack, native companion and descriptor bytes', async () => {
  const again = await buildExternalSentinel();
  assert.deepEqual(again.descriptor, world.descriptor);
  for (const key of ['pack', 'media'])
    assert.deepEqual(
      Buffer.from(await again.payloads[key].arrayBuffer()),
      Buffer.from(await world.payloads[key].arrayBuffer()),
    );
  assert.deepEqual(again.inputPins, world.inputPins);
});

test('all 56 Standard/Gentle both-turn contexts keep actual physical outcomes, exact posters and saved suffixes', async () => {
  const before = JSON.stringify({ descriptor: world.descriptor, proof });
  const checked = await verifyExternalSentinel({
    candidate: { descriptor: world.descriptor, proof },
  });
  assert.deepEqual(
    [
      checked.summary.contexts,
      checked.summary.wins,
      checked.summary.lifeLossControls,
      checked.summary.unfinishedClosureControls,
      checked.summary.ticks,
    ],
    [56, 32, 16, 8, 101713],
  );
  assert.equal(new Set(checked.routes.map((r) => r.id)).size, 56);
  assert.deepEqual([...new Set(checked.routes.map((r) => r.difficulty))].sort(), [
    'gentle',
    'standard',
  ]);
  assert.deepEqual([...new Set(checked.routes.map((r) => r.setup.turnPolicy))].sort(), [
    'grid-center',
    'immediate',
  ]);
  for (const r of checked.routes) {
    assert.ok(r.savedPrefix.player.cutting && r.savedPrefix.trailCells >= 6);
    assert.equal(r.savedPrefix.presentationPins.choices[0].picture.sha256, r.imageSha256);
    assert.equal(r.savedPrefix.presentationPins.choices[0].story, null);
    assert.equal(r.savedPrefix.replaySuffixByteIdentical, true);
  }
  assert.equal(JSON.stringify({ descriptor: world.descriptor, proof }), before);
});

test('native pair authentication refuses changed bytes and mismatched original ownership', async () => {
  const changed = new Uint8Array(await world.payloads.media.arrayBuffer());
  changed[changed.length - 1] ^= 1;
  await assert.rejects(
    prepareExternalChapter(
      world.descriptor,
      { ...world.payloads, media: new Blob([changed]) },
      { decodeImage },
    ),
    /SHA-256/,
  );
  const descriptor = structuredClone(world.descriptor);
  descriptor.originals[0].levelId = descriptor.originals[1].levelId;
  await assert.rejects(
    prepareExternalChapter(descriptor, world.payloads, { decodeImage }),
    /Duplicate/,
  );
  await assert.rejects(
    boundedFile(world.inputPins.at(-1).path, 4 * 1024 * 1024, '0'.repeat(64)),
    /Exact input/,
  );
  assert.equal(
    await externalChapterHash(await world.payloads.media.arrayBuffer()),
    world.descriptor.media.sha256,
  );
});

test('malformed explicit requests and source-proof mutation refuse without rewriting records', async () => {
  for (const candidate of [
    null,
    false,
    {},
    { descriptor: null, proof: null },
    { descriptor: {} },
    { proof: {} },
    [],
  ])
    await assert.rejects(verifyExternalSentinel({ candidate }));
  for (const record of [1, 'true', null]) await assert.rejects(verifyExternalSentinel({ record }));
  await assert.rejects(
    verifyExternalSentinel({ candidate: { descriptor: world.descriptor, proof }, record: true }),
    /cannot record/,
  );
  const changed = structuredClone(proof);
  changed.routes[0].id = 'fabricated';
  await assert.rejects(
    verifyExternalSentinel({ candidate: { descriptor: world.descriptor, proof: changed } }),
  );
  const before = await readFile(path.join(ROOT, PROOF_FILE));
  await assert.rejects(verifyExternalSentinel({ record: true }));
  assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), before);
});

test('explicit CLI pair writes only to a fresh ordinary cache directory and never overwrites', async (t) => {
  const cache = path.join(ROOT, '.cache');
  await mkdir(cache, { recursive: true });
  const local = await mkdtemp(path.join(cache, 'sentinel-external-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'sentinel-external-owned-'));
  t.after(async () => {
    await rm(local, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  const output = path.join(local, 'pair');
  await writeExternalSentinel(output);
  assert.deepEqual((await readdir(output)).sort(), [
    'descriptor.json',
    'inputs.json',
    'media.rlmedia',
    'pack.json',
  ]);
  for (const [file, key] of [
    ['pack.json', 'pack'],
    ['media.rlmedia', 'media'],
  ])
    assert.deepEqual(
      await readFile(path.join(output, file)),
      Buffer.from(await world.payloads[key].arrayBuffer()),
    );
  await assert.rejects(writeExternalSentinel(output));
  await symlink(outside, path.join(local, 'link'));
  await assert.rejects(
    writeExternalSentinel(path.join(local, 'link', 'candidate')),
    /ordinary directories/,
  );
  await assert.rejects(
    boundedFile(path.relative(ROOT, path.join(local, 'link', 'candidate')), 1024),
    /Ordinary input/,
  );
  await assert.rejects(lstat(path.join(outside, 'candidate')), { code: 'ENOENT' });
  await assert.rejects(writeExternalSentinel(outside));
  await assert.rejects(writeExternalSentinel('authoring/not-a-cache-output'));
  assert.deepEqual(await readdir(outside), []);
});

test('the source compiler and originals remain absent from active/optional catalogs and default build', async () => {
  for (const name of [
    'packs/catalog.json',
    'packs/archive-catalog.json',
    'packs/index.json',
    'packs/archive-index.json',
    'optional-worlds.json',
  ])
    assert.ok(
      !(await readFile(new URL(`../content/${name}`, import.meta.url), 'utf8')).includes(ID),
    );
  const files = await collectBuildFiles(ROOT);
  assert.ok(!files.some((f) => (typeof f === 'string' ? f : f.path).includes('sentinel-circuit')));
});
