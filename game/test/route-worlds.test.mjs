import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  ROOT,
  THEME_IDS,
  buildRouteWorld,
  writeRouteWorld,
} from '../../authoring/library/route-worlds/build.mjs';
import { PROOF_FILE, verifyRouteWorlds } from '../../authoring/library/route-worlds/verify.mjs';
import { prepareExternalChapter, externalChapterHash } from '../external-chapter.mjs';

const raw = await readFile(path.join(ROOT, PROOF_FILE));
const proof = JSON.parse(raw);

test('114 exact themed routes preserve physical outcomes, full replays and real serialized v4 saved continuations', async () => {
  const candidate = structuredClone(proof);
  const before = JSON.stringify(candidate);
  const checked = await verifyRouteWorlds({ candidate });
  assert.deepEqual(checked.totals, {
    contexts: 114,
    wins: 84,
    failures: 30,
    ticks: 91620,
    savedContinuations: 114,
    originalPictures: 9,
  });
  assert.equal(JSON.stringify(candidate), before);
  assert.equal(checked.layoutsReused, 3);
  assert.equal(checked.newlyAuthoredGeometry, 0);
  assert.equal(new Set(checked.routes.map((r) => r.id)).size, 114);
  for (const themeId of THEME_IDS) {
    const routes = checked.routes.filter((r) => r.themeId === themeId);
    assert.equal(routes.filter((r) => r.difficulty === 'standard').length, 24);
    assert.equal(routes.filter((r) => r.difficulty === 'gentle').length, 14);
    assert.deepEqual([...new Set(routes.map((r) => r.turnPolicy))].sort(), [
      'grid-center',
      'immediate',
    ]);
    for (const route of routes) {
      assert.equal(route.savedPrefix.sessionFormat, 'xonix-session.v4');
      assert.equal(route.savedPrefix.themeId, themeId);
      assert.ok(route.savedPrefix.tick > 0 && route.savedPrefix.tick < route.expected.tick);
      assert.deepEqual(route.savedPrefix.restoredCheckpoint, route.checkpoint);
      const choice = route.savedPrefix.presentationPins.choices[0];
      assert.equal(choice.picture.identity.themeId, themeId);
      assert.equal(choice.picture.sha256, route.imageSha256);
      assert.equal(choice.story, null);
      assert.equal(route.savedPrefix.replaySuffixByteIdentical, true);
    }
  }
});

test('explicit malformed proof and non-boolean record never fall back to checked-in success', async () => {
  for (const candidate of [null, false, [], 'proof', {}, { routes: null }])
    await assert.rejects(verifyRouteWorlds({ candidate }));
  for (const record of [null, 0, 1, 'false']) await assert.rejects(verifyRouteWorlds({ record }));
  for (const candidate of [null, false, {}, proof])
    await assert.rejects(
      verifyRouteWorlds({ candidate, record: true }),
      /Explicit proof cannot write/,
    );
  assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), raw);
});

test('missing, duplicated or relabelled contexts cannot satisfy the fixed three-theme source coverage', async () => {
  for (const mutate of [
    (p) => p.routes.pop(),
    (p) => p.routes.splice(1, 1, structuredClone(p.routes[0])),
    (p) => p.routes.reverse(),
    (p) => p.themes.reverse(),
    (p) => (p.newlyAuthoredGeometry = 9),
    (p) => (p.sourceProof.sha256 = '0'.repeat(64)),
  ]) {
    const candidate = structuredClone(proof);
    mutate(candidate);
    await assert.rejects(verifyRouteWorlds({ candidate }));
  }
});

test('proof ownership rejects accessors without invoking them', async () => {
  let reads = 0;
  const candidate = {};
  Object.defineProperty(candidate, 'format', {
    enumerable: true,
    get() {
      reads++;
      return proof.format;
    },
  });
  await assert.rejects(verifyRouteWorlds({ candidate }), /accessors/);
  assert.equal(reads, 0);
});

test('changed physical outcome and saved-picture evidence are rejected by actual route derivation', async () => {
  for (const mutate of [
    (p) => p.routes[0].expected.score++,
    (p) => (p.routes[0].savedPrefix.presentationPins.choices[0].picture.sha256 = '0'.repeat(64)),
  ]) {
    const candidate = structuredClone(proof);
    mutate(candidate);
    await assert.rejects(verifyRouteWorlds({ candidate }));
  }
});

test('new payloads are exact originals and a foreign paired media file cannot be reassigned by changing its outer hash', async () => {
  const ukraine = await buildRouteWorld('ukraine'),
    retro = await buildRouteWorld('retro'),
    coupa = await buildRouteWorld('coupa');
  assert.notEqual(ukraine.descriptor.campaignKey, retro.descriptor.campaignKey);
  assert.ok(ukraine.payloads.pack.size < 32768 && retro.payloads.pack.size < 32768);
  for (const world of [ukraine, retro, coupa]) {
    const pack = world.prepared.pack;
    assert.doesNotMatch(pack.description, /exact paired|separate edition|no new track|story movie/);
    assert.match(pack.metadata.rightsStatus, /Existing theme music; no new track/);
    for (const [i, level] of pack.campaigns[0].levels.entries()) {
      const source = world.prior.campaigns[0].levels[i].metadata.description;
      const audit =
        ' This is an original route-choice study with fixed Standard grades, not a human-qualified difficulty rating.';
      assert.equal(level.metadata.description, i === 0 ? source.slice(0, -audit.length) : source);
      assert.doesNotMatch(level.metadata.description, /route-choice study|human-qualified/);
      assert.match(level.metadata.description, /^Recommended:/);
      if (i === 0) assert.ok(source.endsWith(audit) && level.metadata.rightsStatus.endsWith(audit));
    }
    for (const original of world.descriptor.originals) {
      const input = world.inputPins.find((p) => p.sha256 === original.sha256);
      const imported = world.prepared.imported.assets.find((a) => a.sha256 === original.sha256);
      assert.deepEqual(
        Buffer.from(await imported.blob.arrayBuffer()),
        await readFile(path.join(ROOT, input.path)),
      );
      assert.equal(imported.blob.size, original.bytes);
    }
  }
  const descriptor = structuredClone(ukraine.descriptor);
  descriptor.media = {
    bytes: retro.payloads.media.size,
    sha256: await externalChapterHash(await retro.payloads.media.arrayBuffer()),
  };
  await assert.rejects(
    prepareExternalChapter(
      descriptor,
      { pack: ukraine.payloads.pack, media: retro.payloads.media },
      {
        decodeImage: async (blob) => {
          const bytes = Buffer.from(await blob.arrayBuffer());
          const hash = await externalChapterHash(bytes);
          const actual = retro.imageProofs.find((p) => p.sha256 === hash);
          assert.ok(actual);
          return { naturalWidth: actual.naturalWidth, naturalHeight: actual.naturalHeight };
        },
      },
    ),
    /unexpected owners/,
  );
});

test('cache-only compiler refuses unknown themes, existing destinations, foreign paths and symlink parents without overwriting', async () => {
  await assert.rejects(buildRouteWorld('fpv'), /Choose/);
  await assert.rejects(
    writeRouteWorld('ukraine', path.join(ROOT, 'authoring/library/route-worlds/forbidden')),
    /only to a new directory/,
  );
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const directory = await mkdtemp(path.join(ROOT, '.cache/route-worlds-test-'));
  try {
    await assert.rejects(writeRouteWorld('ukraine', directory));
    await symlink(directory, path.join(directory, 'link'));
    await assert.rejects(
      writeRouteWorld('ukraine', path.join(directory, 'link', 'new-output')),
      /ordinary directories/,
    );
    await assert.rejects(verifyRouteWorlds({ record: true }));
    assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), raw);
  } finally {
    await rm(directory, { recursive: true });
  }
});
