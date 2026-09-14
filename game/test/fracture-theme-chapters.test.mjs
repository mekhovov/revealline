import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, rm, symlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ROOT,
  THEME_IDS,
  artRoot,
  physicalLevel,
  IDS,
  SOURCE_PACK_SHA,
  SOURCE_PROOF,
  EDITIONS_FILE,
  digest,
  readPinned,
  buildFractureTheme,
  writeFractureTheme,
  validateFractureThemeEditions,
} from '../../authoring/library/fracture-theme-chapters/build.mjs';
import {
  PROOF_FILE,
  descriptorFile,
  verifyFractureThemes,
} from '../../authoring/library/fracture-theme-chapters/verify.mjs';
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

import { buildFractureChapter } from '../../authoring/library/fracture-lines-chapter/build.mjs';
const worlds = await Promise.all(THEME_IDS.map(buildFractureTheme));
const load = async (file) => JSON.parse(await readFile(path.join(ROOT, file)));
const proof = await load(PROOF_FILE),
  baseProof = await load(SOURCE_PROOF),
  editions = await load(EDITIONS_FILE);
const provenances = await Promise.all(THEME_IDS.map((t) => load(`${artRoot(t)}/provenance.json`)));
const clone = (v) => structuredClone(v);
const decodeImage = async (value) => {
  const data =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const { naturalWidth, naturalHeight } = decodeOriginalPNG(data);
  return { naturalWidth, naturalHeight };
};

test('three separate theme owners preserve exact level IDs, physical fields and nine original PNGs', async () => {
  assert.equal(new Set(worlds.map((w) => w.descriptor.campaignKey)).size, 3);
  assert.equal(new Set(worlds.flatMap((w) => w.descriptor.originals.map((o) => o.sha256))).size, 9);
  for (const [index, world] of worlds.entries()) {
    const themeId = THEME_IDS[index],
      edition = editions.editions[index];
    assert.equal(world.descriptor.id, `fracture-lines-${themeId}`);
    assert.equal(world.descriptor.themeId, themeId);
    assert.equal(world.descriptor.source.sha256, SOURCE_PACK_SHA);
    assert.deepEqual(world.descriptor, await load(descriptorFile(themeId)));
    assert.deepEqual(
      world.prepared.pack.campaigns[0].levels.map(physicalLevel),
      world.sourcePack.campaigns[0].levels.map(physicalLevel),
    );
    for (const key of ['classRecipes', 'music'])
      assert.deepEqual(world.prepared.pack[key], world.sourcePack[key]);
    assert.deepEqual(
      world.prepared.pack.themes.map((t) => t.id),
      [themeId],
    );
    assert.deepEqual(
      world.prepared.executionCatalog.entries.map((e) => e.difficulty),
      ['standard', 'gentle'],
    );
    assert.notEqual(world.descriptor.campaignKey, baseProof.routes[0].authoredKey);
    assert.ok(!(await world.payloads.pack.text()).includes('data:image'));
    for (const [i, original] of world.descriptor.originals.entries()) {
      const presentation = world.prepared.imported.document.library.presentations[i];
      const level = world.prepared.pack.campaigns[0].levels[i];
      assert.equal(original.levelId, IDS[i]);
      assert.equal(level.name, edition.images[i].title);
      assert.equal(level.themeId, themeId);
      assert.equal(level.metadata.title, level.name);
      assert.equal(level.metadata.description, edition.images[i].description);
      assert.equal(presentation.story, null);
      assert.deepEqual(presentation.identity, {
        baseCampaignKey: world.descriptor.campaignKey,
        levelId: IDS[i],
        levelRevision: '1',
        themeId,
      });
      assert.deepEqual(presentation.poster, {
        assetId: original.assetId,
        fit: 'contain',
        sampling: 'nearest',
      });
      const asset = world.prepared.imported.assets.find((a) => a.sha256 === original.sha256);
      assert.deepEqual(
        Buffer.from(await asset.blob.arrayBuffer()),
        await readFile(path.join(ROOT, edition.artRoot, edition.images[i].path)),
      );
      assert.equal(original.sha256, provenances[index].images[i].sha256);
      assert.deepEqual([original.width, original.height], [1774, 887]);
      assert.ok(original.bytes <= 4 * 1024 * 1024);
      assert.match(world.imageProofs[i].pixelsSha256, /^[0-9a-f]{64}$/);
    }
  }
  assert.equal(
    worlds.flatMap((w) => w.descriptor.originals).reduce((n, o) => n + o.bytes, 0),
    25383697,
  );
});

test('edition admission refuses crossed themes, maps, provenance, originals and unknown fields without mutating inputs', () => {
  for (const mutate of [
    (d) => (d.editions[0].images[0].sourceLevelId = IDS[1]),
    (d) => (d.editions[0].images[0].sourceCellId = d.editions[1].images[0].sourceCellId),
    (d) => (d.editions[0].images[0].path = d.editions[0].images[1].path),
    (d) => (d.editions[0].images[0].sha256 = '0'.repeat(64)),
    (d) => (d.editions[0].provenanceSha256 = '0'.repeat(64)),
    (d) => (d.editions[0].artRoot = d.editions[1].artRoot),
    (d) => (d.editions[0].id = 'fracture-lines'),
    (d) => (d.editions[0].themeId = 'retro'),
    (d) => (d.expert = true),
    (d) => d.editions[0].images.push(d.editions[0].images[0]),
  ]) {
    const value = clone(editions);
    mutate(value);
    const before = JSON.stringify(value);
    assert.throws(() => validateFractureThemeEditions(value, provenances));
    assert.equal(JSON.stringify(value), before);
  }
  const owned = validateFractureThemeEditions(editions, provenances);
  owned.editions[0].images[0].sha256 = '0'.repeat(64);
  assert.equal(editions.editions[0].images[0].sha256, provenances[0].images[0].sha256);
});

test('pair preparation rejects mixed theme bodies, corrupt originals and foreign poster ownership', async () => {
  const [world, foreign] = worlds;
  const before = Buffer.from(await world.payloads.media.arrayBuffer()),
    changed = Buffer.from(before);
  changed[changed.length - 1] ^= 1;
  for (const payloads of [
    { ...world.payloads, media: new Blob([changed]) },
    { ...world.payloads, media: foreign.payloads.media },
    { ...world.payloads, pack: foreign.payloads.pack },
  ])
    await assert.rejects(prepareExternalChapter(world.descriptor, payloads, { decodeImage }));
  const descriptor = clone(world.descriptor);
  descriptor.originals[0].assetId = descriptor.originals[1].assetId;
  await assert.rejects(prepareExternalChapter(descriptor, world.payloads, { decodeImage }));
  await assert.rejects(
    readPinned(
      `${editions.editions[0].artRoot}/${editions.editions[0].images[0].path}`,
      4 * 1024 * 1024,
      '0'.repeat(64),
    ),
    /Exact source/,
  );
  assert.deepEqual(Buffer.from(await world.payloads.media.arrayBuffer()), before);
});

test('144 existing route contexts, 18 gameovers and 612 saved boundaries retain exact physical outcomes across themes', async () => {
  const candidate = { descriptors: worlds.map((w) => clone(w.descriptor)), proof: clone(proof) };
  const operation = verifyFractureThemes({ candidate });
  candidate.descriptors[0].originals[0].sha256 = '0'.repeat(64);
  candidate.proof.editions[0].routes.length = 0;
  const actual = await operation;
  assert.deepEqual(actual, proof);
  assert.deepEqual(actual.summary, {
    contexts: 144,
    ordinaryWins: 72,
    firstLifeLossControls: 36,
    recoveredWins: 36,
    separateGameOvers: 18,
    ticks: 365826,
    savedChecks: 612,
    nonemptySavedSuffixes: 576,
    savedEndpointRestores: 36,
    originalCount: 9,
    originalBytes: 25383697,
    pairBytes: worlds.reduce((n, w) => n + w.payloads.pack.size + w.payloads.media.size, 0),
  });
  assert.ok(Buffer.byteLength(JSON.stringify(actual)) < 1200000);
  const baseRows = [...baseProof.routes, ...baseProof.gameOverControls];
  for (const [i, edition] of actual.editions.entries())
    for (const r of [...edition.routes, ...edition.gameOverControls]) {
      const base = baseRows.find((b) => b.id === r.id);
      assert.equal(r.baseTraceSha256, digest(base));
      assert.equal(r.sourceRoute, base.route);
      assert.equal(Object.hasOwn(r, 'segments'), false);
      assert.equal(r.presentationPins.choices[0].story, null);
      assert.equal(
        r.presentationPins.choices[0].picture.identity.baseCampaignKey,
        worlds[i].descriptor.campaignKey,
      );
      assert.equal(r.presentationPins.choices[0].picture.identity.themeId, THEME_IDS[i]);
      assert.deepEqual({ ...r.expected, revision: base.expected.revision }, base.expected);
      if (base.difficulty === 'gentle')
        assert.notEqual(r.expected.revision, base.expected.revision);
      else assert.equal(r.checkpointSha256, base.checkpointSha256);
      for (const s of r.saved) assert.equal(s.finalCheckpointSha256, r.checkpointSha256);
    }
});
function completion(world, useBase = false) {
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
    themeIds: [useBase ? 'fpv' : world.descriptor.themeId],
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
          themeId: useBase ? 'fpv' : world.descriptor.themeId,
          bodyId: pack.themes[0].player,
          runId: useBase ? 'legacy-owner' : world.descriptor.id,
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
      themeId: useBase ? 'fpv' : world.descriptor.themeId,
      bodyId: pack.themes[0].player,
      completedAt: '2026-09-14T00:00:00.000Z',
      mediaIdentityCatalog: identities,
      presentationPins: pins,
    },
  };
}
test('saved and first-earned legacy, FPV and three theme owners never rebind despite shared level IDs', async () => {
  const fpv = await buildFractureChapter();
  const completed = [
    completion(worlds[0], true),
    completion(fpv),
    ...worlds.map((w) => completion(w)),
  ];
  assert.equal(completed[0].pins.choices[0].picture.kind, 'legacy');
  assert.ok(completed.slice(1).every((c) => c.pins.choices[0].picture.kind === 'still'));
  assert.equal(new Set(completed.map((c) => c.context.baseCampaignKey)).size, 5);
  let library = emptyLibrary();
  for (const c of completed) {
    const restored = await restoreSession(clone(c.saved), {
      campaign: c.context.campaign,
      campaignKey: c.context.executionKey,
      mediaIdentityCatalog: c.identities,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), c.checkpoint);
    assert.deepEqual(restored.session.presentationPins, c.pins);
    const before = exportLibrary(library),
      previous = library;
    library = recordLibraryCompletion(library, c.completion);
    assert.equal(exportLibrary(previous), before);
    const previousPictures = previous.pictureReceipts ?? [];
    assert.deepEqual(library.pictureReceipts.slice(0, previousPictures.length), previousPictures);
    assert.equal(recordLibraryCompletion(library, c.completion), library);
    for (const foreign of completed.filter((other) => other !== c)) {
      await assert.rejects(
        restoreSession(clone(c.saved), {
          campaign: c.context.campaign,
          campaignKey: c.context.executionKey,
          mediaIdentityCatalog: foreign.identities,
        }),
      );
      assert.throws(() =>
        recordLibraryCompletion(library, {
          ...c.completion,
          runId: 'foreign-pin-completion',
          presentationPins: foreign.pins,
        }),
      );
    }
  }
  assert.equal(library.pictureReceipts.length, 5);
  assert.equal(library.storyReceipts.length, 5);
  assert.ok(library.storyReceipts.every((r) => r.storyPin === null));
  assert.deepEqual(importLibrary(exportLibrary(library)), library);
  for (const [i, world] of worlds.entries()) {
    const c = completed[i + 2];
    const empty = validateMediaLibrary(
      { format: 'revealline-media-library.v1', assets: [], presentations: [], assignments: [] },
      { identityCatalog: c.identities },
    );
    for (const missing of [
      empty,
      worlds[(i + 1) % worlds.length].prepared.imported.document.library,
    ])
      assert.equal(
        resolvePinnedPicture(presentationPicturePins(c.pins), world.descriptor.themeId, missing)
          .kind,
        'unavailable',
      );
  }
});

test('malformed, foreign and incomplete proof requests refuse without rewriting source evidence', async () => {
  const descriptors = worlds.map((w) => w.descriptor);
  for (const candidate of [null, false, [], {}, { descriptors, proof: {}, extra: true }])
    await assert.rejects(verifyFractureThemes({ candidate }));
  await assert.rejects(
    verifyFractureThemes({ record: true, candidate: { descriptors, proof } }),
    /cannot record/,
  );
  await assert.rejects(verifyFractureThemes({ record: 'true' }));
  const changed = clone(proof);
  changed.editions[2].routes[0].id = 'expert/immediate/foreign/north';
  await assert.rejects(verifyFractureThemes({ candidate: { descriptors, proof: changed } }));
  const foreign = clone(descriptors);
  foreign[0].campaignKey = baseProof.routes[0].authoredKey;
  await assert.rejects(verifyFractureThemes({ candidate: { descriptors: foreign, proof } }));
  const raw = await readFile(path.join(ROOT, PROOF_FILE));
  await assert.rejects(verifyFractureThemes({ record: true }));
  assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), raw);
});

test('explicit pairs reproduce exact bodies only inside new ordinary cache directories', async (t) => {
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const local = await mkdtemp(path.join(ROOT, '.cache/fracture-theme-test-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'fracture-theme-owned-'));
  t.after(async () => {
    await rm(local, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  for (const [i, themeId] of THEME_IDS.entries()) {
    const output = path.join(local, themeId),
      world = worlds[i];
    const again = await writeFractureTheme(themeId, output);
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
    await assert.rejects(writeFractureTheme(themeId, output));
  }
  await symlink(outside, path.join(local, 'link'));
  await assert.rejects(
    writeFractureTheme('ukraine', path.join(local, 'link', 'pair')),
    /Ordinary cache parents/,
  );
  await assert.rejects(lstat(path.join(outside, 'pair')), { code: 'ENOENT' });
  await assert.rejects(writeFractureTheme('ukraine', outside));
  await assert.rejects(writeFractureTheme('unknown', path.join(local, 'unknown')));
});
