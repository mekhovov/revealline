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
  readPinned,
  buildCountercurrentTheme,
  writeCountercurrentTheme,
  validateCountercurrentThemeEditions,
} from './build.mjs';
import { PROOF_FILE, descriptorFile, verifyCountercurrentThemes } from './verify.mjs';
import { drive } from '../countercurrent/controls.mjs';
import { routeCommands } from '../countercurrent/controls.mjs';
import { prepareExternalChapter } from '../../../game/external-chapter.mjs';
import { decodeOriginalPNG } from '../four-worlds-chapters/verify-images.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { createMediaIdentityCatalog, validateMediaLibrary } from '../../../game/media-library.mjs';
import { createPresentationPins, resolvePinnedPicture } from '../../../game/presentation-pins.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
  presentationPicturePins,
} from '../../../game/flight-media-pins.mjs';
import { suspendSession, restoreSession } from '../../../game/sessions.mjs';
import { authoritativeCheckpoint } from '../../../game/replay.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  exportLibrary,
  importLibrary,
} from '../../../game/library.mjs';

const worlds = await Promise.all(THEME_IDS.map(buildCountercurrentTheme));
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

test('four separate owners preserve exact level IDs, seven recipes and twelve original PNGs', async () => {
  assert.equal(new Set(worlds.map((w) => w.descriptor.campaignKey)).size, 4);
  assert.equal(
    new Set(worlds.flatMap((w) => w.descriptor.originals.map((o) => o.sha256))).size,
    12,
  );
  for (const [index, world] of worlds.entries()) {
    const themeId = THEME_IDS[index],
      edition = editions.editions[index];
    assert.equal(world.descriptor.id, `countercurrent-${themeId}`);
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
      assert.equal(
        original.sha256,
        provenances[index].images.filter((image) => image.themeId === themeId)[i].sha256,
      );
      assert.deepEqual([original.width, original.height], [1774, 887]);
      assert.ok(original.bytes <= 4 * 1024 * 1024);
      assert.match(world.imageProofs[i].pixelsSha256, /^[0-9a-f]{64}$/);
    }
  }
  assert.equal(
    worlds.flatMap((w) => w.descriptor.originals).reduce((n, o) => n + o.bytes, 0),
    31692501,
  );
});

test('edition admission refuses crossed themes, maps, provenance, originals and unknown fields without mutating inputs', () => {
  for (const mutate of [
    (d) => (d.editions[0].images[0].sourceLevelId = IDS[1]),
    (d) => (d.editions[0].images[0].sourceCellId = d.editions[1].images[0].sourceCellId),
    (d) => (d.editions[0].images[0].path = d.editions[0].images[1].path),
    (d) => (d.editions[0].images[0].sha256 = '0'.repeat(64)),
    (d) => (d.editions[0].provenanceSha256 = '0'.repeat(64)),
    (d) => (d.editions[0].artRoot = 'authoring/library/foreign-art'),
    (d) => (d.editions[0].id = 'countercurrent'),
    (d) => (d.editions[0].themeId = 'retro'),
    (d) => (d.expert = true),
    (d) => d.editions[0].images.push(d.editions[0].images[0]),
  ]) {
    const value = clone(editions);
    mutate(value);
    const before = JSON.stringify(value);
    assert.throws(() => validateCountercurrentThemeEditions(value, provenances));
    assert.equal(JSON.stringify(value), before);
  }
  const owned = validateCountercurrentThemeEditions(editions, provenances);
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
      classId: 'scout',
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
test('saved and first-earned procedural and four still owners never rebind despite shared level IDs', async () => {
  const completed = [completion(worlds[0], true), ...worlds.map((w) => completion(w))];
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
    const c = completed[i + 1];
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
    await assert.rejects(verifyCountercurrentThemes({ candidate }));
  await assert.rejects(
    verifyCountercurrentThemes({ record: true, candidate: { descriptors, proof } }),
    /cannot record/,
  );
  await assert.rejects(verifyCountercurrentThemes({ record: 'true' }));
  const mutable = { descriptors, proof: { ...clone(proof), format: 'wrong-format' } };
  const pending = verifyCountercurrentThemes({ candidate: mutable });
  mutable.proof.format = proof.format;
  await assert.rejects(pending, /Exact format required/);
  const changed = clone(proof);
  changed.editions[2].routes[0].id = 'expert/immediate/foreign/north';
  await assert.rejects(verifyCountercurrentThemes({ candidate: { descriptors, proof: changed } }));
  const foreign = clone(descriptors);
  foreign[0].campaignKey = baseProof.routes[0].authoredKey;
  await assert.rejects(verifyCountercurrentThemes({ candidate: { descriptors: foreign, proof } }));
  const raw = await readFile(path.join(ROOT, PROOF_FILE));
  await assert.rejects(verifyCountercurrentThemes({ record: true }));
  assert.deepEqual(await readFile(path.join(ROOT, PROOF_FILE)), raw);
});

test('explicit pairs reproduce exact bodies only inside new ordinary cache directories', async (t) => {
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const local = await mkdtemp(path.join(ROOT, '.cache/countercurrent-theme-test-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'countercurrent-theme-owned-'));
  t.after(async () => {
    await rm(local, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  for (const [i, themeId] of THEME_IDS.entries()) {
    const output = path.join(local, themeId),
      world = worlds[i];
    const again = await writeCountercurrentTheme(themeId, output);
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
    await assert.rejects(writeCountercurrentTheme(themeId, output));
  }
  await symlink(outside, path.join(local, 'link'));
  await assert.rejects(
    writeCountercurrentTheme('ukraine', path.join(local, 'link', 'pair')),
    /Ordinary cache parents/,
  );
  await assert.rejects(lstat(path.join(outside, 'pair')), { code: 'ENOENT' });
  await assert.rejects(writeCountercurrentTheme('ukraine', outside));
  await assert.rejects(writeCountercurrentTheme('unknown', path.join(local, 'unknown')));
});
