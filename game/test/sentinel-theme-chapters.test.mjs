import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, symlink, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ROOT,
  THEME_IDS,
  SOURCE_PACK_SHA,
  SOURCE_PROOF,
  SOURCE_LEVEL_IDS,
  EDITIONS_FILE,
  buildSentinelTheme,
  writeSentinelTheme,
  validateSentinelThemeEditions,
  physicalLevel,
  boundedFile,
} from '../../authoring/library/sentinel-theme-chapters/build.mjs';
import {
  PROOF_FILE,
  verifySentinelThemes,
} from '../../authoring/library/sentinel-theme-chapters/verify.mjs';
import { prepareExternalChapter, externalChapterHash } from '../external-chapter.mjs';
import { decodeOriginalPNG } from '../../authoring/library/four-worlds-chapters/verify-images.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { createPresentationPins, resolvePinnedPicture } from '../presentation-pins.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
  presentationPicturePins,
} from '../flight-media-pins.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  exportLibrary,
  importLibrary,
} from '../library.mjs';

const worlds = [];
for (const theme of THEME_IDS) worlds.push(await buildSentinelTheme(theme));
const proof = JSON.parse(await readFile(path.join(ROOT, PROOF_FILE)));
const editions = JSON.parse(await readFile(path.join(ROOT, EDITIONS_FILE)));
const art = JSON.parse(
  await readFile(path.join(ROOT, 'authoring/library/sentinel-theme-art/provenance.json')),
);
const source = JSON.parse(await readFile(path.join(ROOT, SOURCE_PROOF)));
const copy = (value) => structuredClone(value);
const decodeImage = async (value) => {
  const data =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const { naturalWidth, naturalHeight } = decodeOriginalPNG(data);
  return { naturalWidth, naturalHeight };
};

test('three new theme owners preserve every physical Sentinel field and all nine exact originals', async () => {
  const keys = new Set(),
    hashes = new Set();
  for (const world of worlds) {
    const { descriptor, prepared, sourcePack, payloads } = world;
    keys.add(descriptor.campaignKey);
    assert.equal(descriptor.source.sha256, SOURCE_PACK_SHA);
    assert.equal(descriptor.id, `sentinel-circuit-${descriptor.themeId}`);
    assert.equal(prepared.pack.classRecipes.length, 7);
    assert.deepEqual(prepared.pack.classRecipes, sourcePack.classRecipes);
    assert.deepEqual(prepared.pack.music, []);
    assert.deepEqual(prepared.pack.visualOverrides, {});
    assert.deepEqual(prepared.pack.levelVisuals, []);
    assert.equal(prepared.pack.themes.length, 1);
    assert.equal(prepared.pack.themes[0].id, descriptor.themeId);
    assert.ok(prepared.pack.name.includes('Sentinel Circuit'));
    assert.ok(!(await payloads.pack.text()).includes('data:image/'));
    for (const [i, level] of prepared.pack.campaigns[0].levels.entries()) {
      assert.notEqual(level.id, SOURCE_LEVEL_IDS[i]);
      assert.equal(level.themeId, descriptor.themeId);
      assert.deepEqual(physicalLevel(level), physicalLevel(sourcePack.campaigns[0].levels[i]));
      const original = descriptor.originals[i],
        presentation = prepared.imported.document.library.presentations[i];
      hashes.add(original.sha256);
      assert.equal(presentation.story, null);
      assert.deepEqual(presentation.identity, {
        baseCampaignKey: descriptor.campaignKey,
        levelId: level.id,
        levelRevision: level.revision,
        themeId: descriptor.themeId,
      });
      assert.deepEqual(presentation.poster, {
        assetId: original.assetId,
        fit: 'contain',
        sampling: 'nearest',
      });
      const stored = prepared.imported.assets.find((a) => a.sha256 === original.sha256);
      const input = world.inputPins.find((p) => p.sha256 === original.sha256);
      assert.deepEqual(
        Buffer.from(await stored.blob.arrayBuffer()),
        await readFile(path.join(ROOT, input.path)),
      );
      assert.equal(original.width, 1774);
      assert.equal(original.height, 887);
      assert.ok(original.bytes <= 4 * 1024 * 1024);
    }
    assert.equal(prepared.pack.campaigns[0].levels.filter((l) => l.encounter).length, 1);
  }
  assert.equal(keys.size, 3);
  assert.equal(hashes.size, 9);
});

test('fixed producers reproduce all three exact compact pairs and descriptor documents', async () => {
  for (const world of worlds) {
    const again = await buildSentinelTheme(world.descriptor.themeId);
    assert.deepEqual(again.descriptor, world.descriptor);
    for (const key of ['pack', 'media'])
      assert.deepEqual(
        Buffer.from(await again.payloads[key].arrayBuffer()),
        Buffer.from(await world.payloads[key].arrayBuffer()),
      );
    assert.deepEqual(again.inputPins, world.inputPins);
  }
});

test('compact receipts execute 168 exact base traces, every saved suffix and each theme identity', async () => {
  const before = JSON.stringify({ descriptors: worlds.map((w) => w.descriptor), proof });
  const result = await verifySentinelThemes({ candidate: JSON.parse(before) });
  assert.deepEqual(result.summary, {
    contexts: 168,
    wins: 96,
    lifeLossControls: 48,
    unfinishedClosureControls: 24,
    ticks: 305139,
    savedContinuations: 168,
    exactOriginals: 9,
    reusedGeometries: 3,
    newGeometries: 0,
    nullStoryPins: true,
  });
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 600000);
  for (const route of result.routes) {
    assert.equal(Object.hasOwn(route, 'segments'), false);
    assert.equal(Object.hasOwn(route, 'metrics'), false);
    assert.ok(source.routes.some((r) => r.id === route.sourceRouteId));
    assert.equal(route.savedPrefix.picturePin.identity.themeId, route.themeId);
    assert.equal(route.savedPrefix.picturePin.identity.baseCampaignKey, route.authoredKey);
    assert.equal(route.savedPrefix.storyPin, null);
    assert.equal(route.savedPrefix.replaySuffixByteIdentical, true);
  }
  assert.equal(JSON.stringify({ descriptors: worlds.map((w) => w.descriptor), proof }), before);
});

test('metadata validation refuses wrong source cell, original path/hash and foreign edition keys', () => {
  for (const mutate of [
    (d) => (d.editions[0].images[0].sourceCellId = 'sentinel-circuit/listening-court/retro'),
    (d) => (d.editions[0].images[0].sourceLevelId = SOURCE_LEVEL_IDS[1]),
    (d) => (d.editions[0].images[0].path = 'retro/originals/listening-court.png'),
    (d) => (d.editions[0].images[0].sha256 = '0'.repeat(64)),
    (d) => (d.editions[0].id = 'sentinel-circuit-fpv'),
    (d) => (d.editions[0].themeId = 'fpv'),
    (d) => d.editions[0].images.push(d.editions[0].images[0]),
    (d) => (d.editions[0].images[0].title = ''),
    (d) => (d.editions[0].images[0].description = 'x'.repeat(2049)),
    (d) => (d.provenanceSha256 = '0'.repeat(64)),
  ]) {
    const candidate = copy(editions);
    mutate(candidate);
    const raw = JSON.stringify(candidate);
    assert.throws(() => validateSentinelThemeEditions(candidate, art));
    assert.equal(JSON.stringify(candidate), raw);
  }
  const owned = validateSentinelThemeEditions(editions, art);
  owned.editions[0].images[0].title = 'caller change';
  assert.notEqual(editions.editions[0].images[0].title, 'caller change');
});

test('byte and owner mismatches refuse real paired authentication without replacing an original', async () => {
  const world = worlds[0],
    original = Buffer.from(await world.payloads.media.arrayBuffer());
  const changed = Buffer.from(original);
  changed[changed.length - 1] ^= 1;
  await assert.rejects(
    prepareExternalChapter(
      world.descriptor,
      { ...world.payloads, media: new Blob([changed]) },
      { decodeImage },
    ),
    /SHA-256/,
  );
  await assert.rejects(
    prepareExternalChapter(world.descriptor, worlds[1].payloads, { decodeImage }),
  );
  const foreign = copy(world.descriptor);
  foreign.originals[0].assetId = worlds[1].descriptor.originals[0].assetId;
  await assert.rejects(prepareExternalChapter(foreign, world.payloads, { decodeImage }));
  await assert.rejects(
    boundedFile(world.inputPins.at(-1).path, 4 * 1024 * 1024, '0'.repeat(64)),
    /Exact input/,
  );
  assert.deepEqual(Buffer.from(await world.payloads.media.arrayBuffer()), original);
  assert.equal(await externalChapterHash(original), world.descriptor.media.sha256);
});

function realCompletion(world) {
  const route = source.routes.find(
    (r) =>
      r.difficulty === 'standard' && r.expected.won && r.expected.levelId === SOURCE_LEVEL_IDS[0],
  );
  const context = world.prepared.executionCatalog.select(world.descriptor.campaignKey, 'standard'),
    level = context.campaign.levels[0];
  const identities = createMediaIdentityCatalog(world.prepared.executionCatalog);
  const oldPins = createPresentationPins({
    library: world.prepared.imported.document.library,
    identityCatalog: identities,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: [world.descriptor.themeId],
  });
  const pins = snapshotFlightPresentationPins({
    ...oldPins,
    format: FLIGHT_MEDIA_PINS_FORMAT,
    choices: oldPins.choices.map((picture) => ({ picture, story: null })),
  });
  const run = createRun(level, route.setup),
    recorder = createRecorder(level, route.setup, 'theme-owner-test');
  let saved = null,
    checkpoint = null;
  for (const segment of route.segments)
    for (let n = 0; n < segment.ticks; n++) {
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      if (run.tick === route.savedPrefix.tick) {
        checkpoint = authoritativeCheckpoint(run);
        saved = suspendSession({
          run,
          recorder,
          campaignKey: context.executionKey,
          themeId: world.descriptor.themeId,
          bodyId: world.prepared.pack.themes[0].player,
          runId: `${world.descriptor.themeId}-first`,
          savedAt: '2026-09-13T00:00:00.000Z',
          continuation: { direction: segment.input.direction },
          presentationPins: pins,
        });
      }
    }
  assert.equal(run.status, 'won');
  assert.ok(saved);
  return {
    saved,
    checkpoint,
    pins,
    context,
    identities,
    completion: {
      campaign: context.campaign,
      result: getSummary(run),
      runId: `${world.descriptor.themeId}-first`,
      themeId: world.descriptor.themeId,
      bodyId: world.prepared.pack.themes[0].player,
      completedAt: '2026-09-13T00:00:00.000Z',
      mediaIdentityCatalog: identities,
      presentationPins: pins,
    },
  };
}

test('actual saved and first-earned theme owners remain isolated with no cross-theme fallback', async () => {
  const a = realCompletion(worlds[0]),
    b = realCompletion(worlds[1]);
  const restored = await restoreSession(copy(a.saved), {
    campaign: a.context.campaign,
    campaignKey: a.context.executionKey,
    mediaIdentityCatalog: a.identities,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), a.checkpoint);
  assert.deepEqual(restored.session.presentationPins, a.pins);
  await assert.rejects(
    restoreSession(copy(a.saved), {
      campaign: a.context.campaign,
      campaignKey: a.context.executionKey,
      mediaIdentityCatalog: b.identities,
    }),
  );
  const unavailable = resolvePinnedPicture(
    presentationPicturePins(a.pins),
    'ukraine',
    worlds[1].prepared.imported.document.library,
  );
  assert.equal(unavailable.kind, 'unavailable');
  const first = recordLibraryCompletion(emptyLibrary(), a.completion),
    prior = exportLibrary(first);
  const both = recordLibraryCompletion(first, b.completion);
  assert.equal(both.pictureReceipts.length, 2);
  assert.equal(both.storyReceipts.length, 2);
  assert.ok(both.storyReceipts.every((r) => r.storyPin === null));
  assert.deepEqual(both.pictureReceipts[0], first.pictureReceipts[0]);
  assert.deepEqual(importLibrary(exportLibrary(both)), both);
  assert.equal(exportLibrary(first), prior);
  assert.throws(() =>
    recordLibraryCompletion(first, {
      ...a.completion,
      runId: 'foreign-pins',
      presentationPins: b.pins,
    }),
  );
  assert.equal(recordLibraryCompletion(both, b.completion), both);
});

test('invalid requests and compact proof tampering refuse before any source record write', async () => {
  for (const theme of [null, undefined, 'fpv', 'UKRAINE', {}, []])
    await assert.rejects(buildSentinelTheme(theme));
  for (const candidate of [null, false, {}, [], { descriptors: [], proof: {} }])
    await assert.rejects(verifySentinelThemes({ candidate }));
  await assert.rejects(verifySentinelThemes({ record: 'true' }));
  await assert.rejects(
    verifySentinelThemes({
      candidate: { descriptors: worlds.map((w) => w.descriptor), proof },
      record: true,
    }),
    /cannot record/,
  );
  const changed = copy(proof);
  changed.routes[0].sourceSegmentsSha256 = '0'.repeat(64);
  await assert.rejects(
    verifySentinelThemes({
      candidate: { descriptors: worlds.map((w) => w.descriptor), proof: changed },
    }),
  );
  const raw = await readFile(path.join(ROOT, PROOF_FILE));
  await assert.rejects(verifySentinelThemes({ record: true }));
  assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), raw);
});

test('explicit pair output is confined to a fresh ordinary cache directory', async (t) => {
  const cache = path.join(ROOT, '.cache');
  await mkdir(cache, { recursive: true });
  const local = await mkdtemp(path.join(cache, 'sentinel-themes-test-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'sentinel-themes-owned-'));
  t.after(async () => {
    await rm(local, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  const output = path.join(local, 'pair');
  await writeSentinelTheme('ukraine', output);
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
      Buffer.from(await worlds[0].payloads[key].arrayBuffer()),
    );
  await assert.rejects(writeSentinelTheme('ukraine', output));
  await symlink(outside, path.join(local, 'link'));
  await assert.rejects(
    writeSentinelTheme('ukraine', path.join(local, 'link', 'candidate')),
    /ordinary directories/,
  );
  await assert.rejects(lstat(path.join(outside, 'candidate')), { code: 'ENOENT' });
  await assert.rejects(writeSentinelTheme('ukraine', outside));
  assert.deepEqual(await readdir(outside), []);
});

test('registered theme descriptors are exact while raw compiler and art remain outside default build inputs', async () => {
  const { sourceExternalChapter } = await import('../external-chapter-source.mjs');
  const { EXTERNAL_CATALOG } = await import('../external-chapter-catalog.mjs');
  for (const world of worlds) {
    assert.deepEqual(sourceExternalChapter(world.descriptor.id), world.descriptor);
    const item = EXTERNAL_CATALOG.chapters.find((entry) => entry.id === world.descriptor.id);
    assert.equal(item.campaignKey, world.descriptor.campaignKey);
    for (const kind of ['pack', 'media']) {
      assert.equal(item[kind].bytes, world.descriptor[kind].bytes);
      assert.equal(item[kind].sha256, world.descriptor[kind].sha256);
    }
  }
  const files = await collectBuildFiles(ROOT);
  assert.ok(!files.some((f) => (typeof f === 'string' ? f : f.path).includes('sentinel-theme-')));
});
