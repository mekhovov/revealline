import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, rm, symlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ROOT,
  ID,
  IDS,
  SOURCE_PACK_SHA,
  SOURCE_PROOF,
  EDITION_FILE,
  digest,
  readPinned,
  buildFractureChapter,
  writeFractureChapter,
  validateFractureEdition,
} from '../../authoring/library/fracture-lines-chapter/build.mjs';
import {
  PROOF_FILE,
  DESCRIPTOR_FILE,
  verifyFractureChapter,
} from '../../authoring/library/fracture-lines-chapter/verify.mjs';
import { drive } from '../../authoring/library/fracture-lines/controls.mjs';
import { routeCommands } from '../../authoring/library/fracture-lines/verify.mjs';
import { prepareExternalChapter } from '../external-chapter.mjs';
import { decodeOriginalPNG } from '../../authoring/library/four-worlds-chapters/verify-images.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { resolvePackCampaign } from '../packs.mjs';
import { createMediaIdentityCatalog, validateMediaLibrary } from '../media-library.mjs';
import { createPresentationPins, resolvePinnedPicture } from '../presentation-pins.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
  presentationPicturePins,
} from '../flight-media-pins.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  exportLibrary,
  importLibrary,
} from '../library.mjs';

const world = await buildFractureChapter();
const load = async (file) => JSON.parse(await readFile(path.join(ROOT, file)));
const proof = await load(PROOF_FILE),
  baseProof = await load(SOURCE_PROOF),
  edition = await load(EDITION_FILE);
const records = await Promise.all(edition.images.map((p) => load(p.metadataPath)));
const clone = (v) => structuredClone(v);
const decodeImage = async (value) => {
  const data =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const { naturalWidth, naturalHeight } = decodeOriginalPNG(data);
  return { naturalWidth, naturalHeight };
};

test('the distinct FPV owner binds three byte-exact originals and preserves every authored level and recipe', async () => {
  assert.equal(world.descriptor.id, ID);
  assert.equal(world.descriptor.source.sha256, SOURCE_PACK_SHA);
  assert.deepEqual(world.descriptor, await load(DESCRIPTOR_FILE));
  assert.deepEqual(world.prepared.pack.campaigns[0].levels, world.sourcePack.campaigns[0].levels);
  for (const key of ['classRecipes', 'themes', 'music', 'levelVisuals', 'visualOverrides'])
    assert.deepEqual(world.prepared.pack[key], world.sourcePack[key]);
  assert.deepEqual(
    world.prepared.executionCatalog.entries.map((e) => e.difficulty),
    ['standard', 'gentle'],
  );
  assert.notEqual(world.descriptor.campaignKey, baseProof.routes[0].authoredKey);
  assert.ok(!(await world.payloads.pack.text()).includes('data:image'));
  for (const [i, original] of world.descriptor.originals.entries()) {
    const presentation = world.prepared.imported.document.library.presentations[i];
    assert.equal(original.levelId, IDS[i]);
    assert.equal(presentation.story, null);
    assert.deepEqual(presentation.identity, {
      baseCampaignKey: world.descriptor.campaignKey,
      levelId: IDS[i],
      levelRevision: '1',
      themeId: 'fpv',
    });
    assert.deepEqual(presentation.poster, {
      assetId: original.assetId,
      fit: 'contain',
      sampling: 'nearest',
    });
    const asset = world.prepared.imported.assets.find((a) => a.sha256 === original.sha256);
    assert.deepEqual(
      Buffer.from(await asset.blob.arrayBuffer()),
      await readFile(path.join(ROOT, edition.images[i].path)),
    );
    assert.equal(original.sha256, records[i].sha256);
    assert.deepEqual([original.width, original.height], [1774, 887]);
    assert.ok(original.bytes <= 4 * 1024 * 1024);
    assert.match(world.imageProofs[i].pixelsSha256, /^[0-9a-f]{64}$/);
  }
  assert.equal(
    world.descriptor.originals.reduce((n, o) => n + o.bytes, 0),
    8656868,
  );
});

test('edition validation refuses wrong map, original hash/path, theme and unimplemented fields', () => {
  for (const mutate of [
    (d) => (d.images[0].sourceLevelId = IDS[1]),
    (d) => (d.images[0].assetId = 'foreign-art'),
    (d) => (d.images[0].path = d.images[1].path),
    (d) => (d.images[0].metadataPath = d.images[1].metadataPath),
    (d) => (d.images[0].sha256 = '0'.repeat(64)),
    (d) => (d.id = 'fracture-lines'),
    (d) => (d.themeId = 'ukraine'),
    (d) => (d.expert = true),
    (d) => d.images.push(d.images[0]),
  ]) {
    const value = clone(edition);
    mutate(value);
    const before = JSON.stringify(value);
    assert.throws(() => validateFractureEdition(value, records));
    assert.equal(JSON.stringify(value), before);
  }
  const owned = validateFractureEdition(edition, records);
  owned.images[0].sha256 = '0'.repeat(64);
  assert.equal(edition.images[0].sha256, records[0].sha256);
});

test('real pair preparation refuses corrupt originals and foreign poster owner references', async () => {
  const before = Buffer.from(await world.payloads.media.arrayBuffer()),
    changed = Buffer.from(before);
  changed[changed.length - 1] ^= 1;
  await assert.rejects(
    prepareExternalChapter(
      world.descriptor,
      { ...world.payloads, media: new Blob([changed]) },
      { decodeImage },
    ),
    /SHA-256/,
  );
  const descriptor = clone(world.descriptor);
  descriptor.originals[0].assetId = descriptor.originals[1].assetId;
  await assert.rejects(prepareExternalChapter(descriptor, world.payloads, { decodeImage }));
  await assert.rejects(
    readPinned(edition.images[0].path, 4 * 1024 * 1024, '0'.repeat(64)),
    /Exact source/,
  );
  assert.deepEqual(Buffer.from(await world.payloads.media.arrayBuffer()), before);
});

test('all retained input traces and 204 saved boundaries run with the new exact still owner', async () => {
  const candidate = { descriptor: clone(world.descriptor), proof: clone(proof) };
  const operation = verifyFractureChapter({ candidate });
  // Ownership is captured before the first asynchronous file read.
  candidate.descriptor.originals[0].sha256 = '0'.repeat(64);
  candidate.proof.routes.length = 0;
  const actual = await operation;
  assert.deepEqual(actual, proof);
  assert.deepEqual(actual.summary, {
    contexts: 48,
    ordinaryWins: 24,
    firstLifeLossControls: 12,
    recoveredWins: 12,
    separateGameOvers: 6,
    ticks: 121942,
    savedChecks: 204,
    nonemptySavedSuffixes: 192,
    savedEndpointRestores: 12,
    originalCount: 3,
    originalBytes: 8656868,
    pairBytes: world.payloads.pack.size + world.payloads.media.size,
  });
  assert.ok(Buffer.byteLength(JSON.stringify(actual)) < 400000);
  const baseRows = [...baseProof.routes, ...baseProof.gameOverControls];
  for (const r of [...actual.routes, ...actual.gameOverControls]) {
    const base = baseRows.find((b) => b.id === r.id);
    assert.equal(r.baseTraceSha256, digest(base));
    assert.equal(Object.hasOwn(r, 'segments'), false);
    assert.equal(r.presentationPins.choices[0].story, null);
    assert.equal(
      r.presentationPins.choices[0].picture.identity.baseCampaignKey,
      world.descriptor.campaignKey,
    );
    assert.deepEqual({ ...r.expected, revision: base.expected.revision }, base.expected);
    if (base.difficulty === 'gentle') assert.notEqual(r.expected.revision, base.expected.revision);
    else assert.equal(r.checkpointSha256, base.checkpointSha256);
    for (const s of r.saved) assert.equal(s.finalCheckpointSha256, r.checkpointSha256);
  }
});

function completion(useBase) {
  const pack = useBase ? world.sourcePack : world.prepared.pack;
  const catalog = useBase
    ? createExecutionCatalog([resolvePackCampaign(pack, pack.id)])
    : world.prepared.executionCatalog;
  const context = catalog.entries[0],
    level = context.campaign.levels[0];
  const identities = createMediaIdentityCatalog(catalog);
  const pictures = createPresentationPins({
    library: world.prepared.imported.document.library,
    identityCatalog: identities,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: ['fpv'],
  });
  const pins = snapshotFlightPresentationPins({
    ...pictures,
    format: FLIGHT_MEDIA_PINS_FORMAT,
    choices: pictures.choices.map((picture) => ({ picture, story: null })),
  });
  let saved, checkpoint;
  const result = drive(
    level,
    pack.classRecipes,
    'immediate',
    routeCommands(level.id, 'north', 'standard'),
    {
      onTick({ run, recorder, input }) {
        if (run.tick !== 45) return;
        checkpoint = authoritativeCheckpoint(run);
        saved = suspendSession({
          run,
          recorder,
          campaignKey: context.executionKey,
          themeId: 'fpv',
          bodyId: pack.themes[0].player,
          runId: useBase ? 'legacy-owner' : 'illustrated-owner',
          savedAt: '2026-09-14T00:00:00.000Z',
          continuation: { direction: input.direction },
          presentationPins: pins,
        });
      },
    },
  );
  assert.equal(result.run.status, 'won');
  return {
    saved,
    checkpoint,
    context,
    identities,
    pins,
    completion: {
      campaign: context.campaign,
      result: result.expected,
      runId: saved.runId,
      themeId: 'fpv',
      bodyId: pack.themes[0].player,
      completedAt: '2026-09-14T00:00:00.000Z',
      mediaIdentityCatalog: identities,
      presentationPins: pins,
    },
  };
}
test('saved and first-earned base owners never silently rebind to the illustrated campaign', async () => {
  const old = completion(true),
    illustrated = completion(false);
  assert.equal(old.pins.choices[0].picture.kind, 'legacy');
  assert.equal(illustrated.pins.choices[0].picture.kind, 'still');
  for (const c of [old, illustrated]) {
    const restored = await restoreSession(clone(c.saved), {
      campaign: c.context.campaign,
      campaignKey: c.context.executionKey,
      mediaIdentityCatalog: c.identities,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), c.checkpoint);
    assert.deepEqual(restored.session.presentationPins, c.pins);
  }
  await assert.rejects(
    restoreSession(clone(old.saved), {
      campaign: old.context.campaign,
      campaignKey: old.context.executionKey,
      mediaIdentityCatalog: illustrated.identities,
    }),
  );
  const unavailable = resolvePinnedPicture(
    presentationPicturePins(illustrated.pins),
    'fpv',
    validateMediaLibrary(
      {
        format: 'revealline-media-library.v1',
        assets: [],
        presentations: [],
        assignments: [],
      },
      { identityCatalog: illustrated.identities },
    ),
  );
  assert.equal(unavailable.kind, 'unavailable');
  const first = recordLibraryCompletion(emptyLibrary(), old.completion),
    before = exportLibrary(first);
  const both = recordLibraryCompletion(first, illustrated.completion);
  assert.equal(both.pictureReceipts.length, 2);
  assert.equal(both.storyReceipts.length, 2);
  assert.ok(both.storyReceipts.every((r) => r.storyPin === null));
  assert.deepEqual(both.pictureReceipts[0], first.pictureReceipts[0]);
  assert.equal(exportLibrary(first), before);
  assert.deepEqual(importLibrary(exportLibrary(both)), both);
  assert.throws(() =>
    recordLibraryCompletion(first, {
      ...old.completion,
      runId: 'foreign-new-completion',
      presentationPins: illustrated.pins,
    }),
  );
  assert.equal(recordLibraryCompletion(both, illustrated.completion), both);
});

test('malformed, foreign and incomplete proof requests refuse without rewriting source evidence', async () => {
  for (const candidate of [
    null,
    false,
    [],
    {},
    { descriptor: world.descriptor, proof: {}, extra: true },
  ])
    await assert.rejects(verifyFractureChapter({ candidate }));
  await assert.rejects(
    verifyFractureChapter({ record: true, candidate: { descriptor: world.descriptor, proof } }),
    /cannot record/,
  );
  await assert.rejects(verifyFractureChapter({ record: 'true' }));
  const changed = clone(proof);
  changed.routes[0].id = 'expert/immediate/foreign/north';
  await assert.rejects(
    verifyFractureChapter({ candidate: { descriptor: world.descriptor, proof: changed } }),
  );
  const descriptor = clone(world.descriptor);
  descriptor.campaignKey = baseProof.routes[0].authoredKey;
  await assert.rejects(verifyFractureChapter({ candidate: { descriptor, proof } }));
  const raw = await readFile(path.join(ROOT, PROOF_FILE));
  await assert.rejects(verifyFractureChapter({ record: true }));
  assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), raw);
});

test('explicit pair reproduction is byte-exact and confined to a new ordinary cache directory', async (t) => {
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const local = await mkdtemp(path.join(ROOT, '.cache/fracture-chapter-test-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'fracture-chapter-owned-'));
  t.after(async () => {
    await rm(local, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  const output = path.join(local, 'pair');
  const again = await writeFractureChapter(output);
  assert.deepEqual(again.descriptor, world.descriptor);
  assert.deepEqual((await readdir(output)).sort(), [
    'descriptor.json',
    'inputs.json',
    'media.rlmedia',
    'pack.json',
  ]);
  for (const [file, kind] of [
    ['pack.json', 'pack'],
    ['media.rlmedia', 'media'],
  ])
    assert.deepEqual(
      await readFile(path.join(output, file)),
      Buffer.from(await world.payloads[kind].arrayBuffer()),
    );
  await assert.rejects(writeFractureChapter(output));
  await symlink(outside, path.join(local, 'link'));
  await assert.rejects(
    writeFractureChapter(path.join(local, 'link', 'pair')),
    /Ordinary cache parents/,
  );
  await assert.rejects(lstat(path.join(outside, 'pair')), { code: 'ENOENT' });
  await assert.rejects(writeFractureChapter(outside));
});
