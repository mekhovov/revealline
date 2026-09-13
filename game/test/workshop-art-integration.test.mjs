import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  loadWorkshopArtInputs,
  replayWorkshopRoute,
  createWorkshopArtFixtures,
} from '../../scripts/create-workshop-art-fixtures.mjs';
import {
  preparePack,
  resolvePackCampaign,
  scenarioFromPack,
  emptyPackLibrary,
  installPack,
  removePack,
  importPackLibrary,
  exportPackLibrary,
  PACK_LIMITS,
} from '../packs.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { versionsForCampaign } from '../core/versions.mjs';
import {
  createRun,
  stepRun,
  releaseInputs,
  FIXED_DT,
  loadoutHash,
  rosterHash,
} from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  campaignKey,
  boardIdentity,
  emptyLibrary,
  recordLibraryCompletion,
  withMasteryRecords,
  progressFor,
  loadLibrary,
  saveLibrary,
} from '../library.mjs';
import { appearanceMilestones, unlockedBodies } from '../progress.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { exportBackup, prepareBackup, BACKUP_FORMAT } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';
import { pictureMasteries } from '../ui/mastery-view.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const source = await loadWorkshopArtInputs(ROOT);
const { previous, current, routes, decodeImage } = source;
const oldEntry = resolvePackCampaign(previous, 'equipment-workshop'),
  nextEntry = resolvePackCampaign(current, 'equipment-workshop');
const oldCampaign = oldEntry.campaign,
  campaign = nextEntry.campaign,
  key = campaignKey(campaign);
const STAMP = '2026-09-12T16:00:00.000Z';
const clone = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const entry = (pack) => {
  const value = resolvePackCampaign(pack, 'equipment-workshop');
  return {
    campaign: value.campaign,
    sourcePackId: pack.id,
    sourcePackFormat: pack.format,
    masteries: value.masteries,
  };
};
const catalog = (pack) => createMasteryCatalog([entry(pack)]);
const oldPacks = installPack(emptyPackLibrary(), previous);
const newPacks = installPack(oldPacks, current);
const originals = { oldPack: JSON.stringify(previous), pack: JSON.stringify(current) };
let profilePromise;
function earnedProfile() {
  profilePromise ??= (async () => {
    const bytes = await readFile(new URL('../replays/homeward-routes.json', import.meta.url));
    assert.equal(sha(bytes), '63a77908b1ce98b480f9fd0431894e4f1d58ad56e4266ae0860206de564d8c1a');
    const proof = JSON.parse(bytes),
      result = [];
    let library = emptyLibrary();
    for (const route of proof.routes.filter(
      (r) => r.variant === 'specialty' && r.turnPolicy === 'immediate',
    )) {
      const level = oldCampaign.levels[Number(route.levelId.slice(-2)) - 1];
      const options = {
        seed: route.seed,
        turnPolicy: route.turnPolicy,
        classId: route.classId,
        classRecipes: oldCampaign.classRecipes,
      };
      const run = createRun(level, options),
        recorder = createRecorder(level, options, 'round27-old-earned-seal');
      for (const segment of route.segments) {
        if (segment.releaseBefore) {
          releaseInputs(run);
          recordRelease(recorder);
        }
        for (let i = 0; i < segment.ticks; i++) {
          stepRun(run, segment.input, FIXED_DT);
          recordInput(recorder, segment.input);
        }
      }
      const replay = exportReplay(recorder, run),
        runId = `old-workshop-seal-${level.id}`;
      assert.deepEqual(replay.summary, { ...route.expected, levelId: level.id });
      const definition = catalog(previous).get(key, level.id).definition;
      const certificate = await verifyMasteryRun({
        replay,
        campaign: oldCampaign,
        definition,
        runId,
        earnedAt: STAMP,
      });
      const record = verifiedMasteryRecord(certificate);
      assert.ok(record);
      const scenario = scenarioFromPack(previous, campaign.id, level.id);
      library = recordLibraryCompletion(library, {
        campaign: oldCampaign,
        result: replay.summary,
        runId,
        themeId: scenario.theme.id,
        bodyId: scenario.theme.classBodies[route.classId],
        sourcePackId: previous.id,
        completedAt: STAMP,
      });
      library = withMasteryRecords(library, [record]);
      result.push({ replay, runId, record });
    }
    assert.equal(library.gallery.length, 3);
    assert.equal(library.scores.length, 3);
    assert.equal(library.masteries.length, 3);
    return { library, records: result };
  })();
  return profilePromise;
}
function suspended(route) {
  const trace = replayWorkshopRoute(previous, route, route.expected.tick - 24);
  const scenario = scenarioFromPack(previous, campaign.id, route.levelId);
  const session = suspendSession({
    run: trace.run,
    recorder: trace.recorder,
    campaignKey: key,
    themeId: scenario.theme.id,
    bodyId: scenario.theme.classBodies[route.classId],
    runId: `old-prefix-${route.levelId}-${route.turnPolicy}`,
    savedAt: STAMP,
  });
  return { ...trace, session };
}

test('illustrations preserve all nonvisual pack content and exact selected original PNG bytes', () => {
  assert.equal(previous.version, '1.0.0');
  assert.equal(current.version, '1.1.0');
  assert.deepEqual(
    { ...current, version: previous.version, levelVisuals: previous.levelVisuals },
    previous,
  );
  assert.notEqual(sha(source.currentBytes), sha(source.previousBytes));
  assert.ok(source.currentBytes.length < PACK_LIMITS.maxBytes);
  assert.equal(new Set(source.images.map((image) => image.sha256)).size, 3);
  for (const image of source.images) assert.equal(image.width * 3, image.height * 4);
});

test('campaign, normalized maps, all recipes, both steering policies and switched board identities are unchanged', () => {
  assert.equal(key, 'equipment-workshop/1/3fc2cf073da368b4');
  assert.deepEqual(nextEntry.campaign, oldEntry.campaign);
  assert.deepEqual(nextEntry.classRecipes, oldEntry.classRecipes);
  assert.deepEqual(versionsForCampaign(campaign), versionsForCampaign(oldCampaign));
  assert.equal(rosterHash(campaign.classRecipes), rosterHash(oldCampaign.classRecipes));
  for (const [index, level] of campaign.levels.entries()) {
    const oldLevel = oldCampaign.levels[index];
    assert.deepEqual(normalizedLevel(level), normalizedLevel(oldLevel));
    for (const [r, recipe] of campaign.classRecipes.entries()) {
      assert.equal(loadoutHash(recipe), loadoutHash(oldCampaign.classRecipes[r]));
      for (const turnPolicy of ['immediate', 'grid-center'])
        for (const classRoute of [[recipe.id], [recipe.id, 'carrier', recipe.id]]) {
          assert.equal(
            boardIdentity({ campaign, level, recipe, turnPolicy, seed: 1, classRoute }),
            boardIdentity({
              campaign: oldCampaign,
              level: oldLevel,
              recipe: oldCampaign.classRecipes[r],
              turnPolicy,
              seed: 1,
              classRoute,
            }),
          );
        }
    }
  }
  assert.deepEqual(catalog(current).registrations, catalog(previous).registrations);
});

for (const route of routes)
  test(`${route.levelId}/${route.turnPolicy}: old legal live cut restores and finishes with the same checkpoint under illustrated content`, async () => {
    const old = replayWorkshopRoute(previous, route),
      next = replayWorkshopRoute(current, route);
    assert.deepEqual(next.replay, old.replay);
    const saved = suspended(route),
      input = route.segments.at(-1).input;
    const restored = await restoreSession(saved.session, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), saved.session.replay.checkpoint);
    for (let i = 0; i < 24; i++) {
      stepRun(restored.run, input, FIXED_DT);
      recordInput(restored.recorder, input);
    }
    assert.deepEqual(
      exportReplay(restored.recorder, restored.run).checkpoint,
      old.replay.checkpoint,
    );
    assert.equal(restored.run.status, 'won');
  });

test('same-ID install, replacement, removal and reinstall preserve collected records and current seal labels', async () => {
  const { library, records } = await earnedProfile(),
    before = clone(library);
  const installed = installPack(
    oldPacks,
    (await preparePack(current, { decodeImage, library: oldPacks })).pack,
  );
  assert.equal(installed.packs.length, 1);
  assert.deepEqual(installed.packs[0].levelVisuals, current.levelVisuals);
  assert.deepEqual(progressFor(library, campaign), progressFor(library, oldCampaign));
  assert.deepEqual(
    appearanceMilestones(progressFor(library, campaign), campaign),
    appearanceMilestones(progressFor(library, oldCampaign), oldCampaign),
  );
  assert.deepEqual(
    unlockedBodies(progressFor(library, campaign), campaign),
    unlockedBodies(progressFor(library, oldCampaign), oldCampaign),
  );
  for (const { replay, runId, record } of records) {
    const definition = catalog(current).get(key, record.levelId).definition;
    assert.deepEqual(
      verifiedMasteryRecord(
        await verifyMasteryRun({ replay, campaign, definition, runId, earnedAt: STAMP }),
      ),
      record,
    );
  }
  const names = (pack, picture) => {
    const registered = catalog(pack);
    return pictureMasteries(
      library.masteries,
      picture,
      registered.get(key, picture.levelId).definition,
      campaign.classRecipes,
      registered,
    );
  };
  for (const picture of library.gallery)
    assert.deepEqual(names(current, picture), names(previous, picture));
  const removed = removePack(installed, current.id);
  assert.equal(removed.packs.length, 0);
  const reinstalled = installPack(removed, current);
  const imported = await importPackLibrary(exportPackLibrary(reinstalled), { decodeImage });
  assert.deepEqual(imported, reinstalled);
  assert.deepEqual(library, before);
  assert.equal(JSON.stringify(previous), originals.oldPack);
  assert.equal(JSON.stringify(current), originals.pack);
});

for (const policy of ['immediate', 'grid-center'])
  test(`complete illustrated backup retains source images, old scores/seals and suspended flight (${policy})`, async () => {
    const { library } = await earnedProfile(),
      saved = suspended(
        routes.find((route) => route.levelId === 'workshop-02' && route.turnPolicy === policy),
      );
    const value = { format: BACKUP_FORMAT, library, packs: newPacks, session: saved.session };
    const text = await exportBackup(
      { library: value.library, packs: value.packs, session: value.session },
      { decodeImage },
    );
    const restored = await prepareBackup(text, { decodeImage });
    assert.deepEqual(restored.library, library);
    assert.deepEqual(restored.packs, newPacks);
    assert.deepEqual(restored.session, saved.session);
    assert.deepEqual(restored.packs.packs[0].levelVisuals, current.levelVisuals);
    const flight = await restoreSession(restored.session, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(flight.run), saved.session.replay.checkpoint);
  });

test('corrupt headers and failing decoders reject replacement before adoption and keep the old library intact', async () => {
  const original = exportPackLibrary(oldPacks),
    broken = clone(current);
  let calls = 0;
  broken.levelVisuals[1].visualOverrides.background.dataUrl = 'data:image/png;base64,YmFk';
  await assert.rejects(
    preparePack(broken, {
      library: oldPacks,
      decodeImage: async () => {
        calls++;
        throw new Error('unexpected decode');
      },
    }),
  );
  assert.equal(calls, 0);
  await assert.rejects(
    preparePack(current, {
      library: oldPacks,
      decodeImage: async () => {
        throw new Error('Pixels failed to decode');
      },
    }),
    /Pixels failed/,
  );
  assert.equal(exportPackLibrary(oldPacks), original);
  assert.equal(oldPacks.packs[0], previous);
  assert.throws(() => installPack(oldPacks, clone(current)), /prepared/);
});

function storageHarness() {
  const local = new Map(),
    assets = new Map();
  let reject = false;
  const storage = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, String(value)),
    removeItem: (key) => local.delete(key),
  };
  const adapters = {
    storage,
    profileKey: 'profile',
    packsKey: 'packs',
    sessionKey: 'session',
    journalKey: 'journal',
    readAsset: async (key) => clone(assets.get(key) ?? null),
    writeAsset: async (key, value) => assets.set(key, clone(value)),
    withLock: (task) => task(),
    commitProfile: (library, options) =>
      reject
        ? { ok: false, warning: 'Injected profile failure' }
        : saveLibrary(
            storage,
            'profile',
            library,
            loadLibrary(storage, 'profile').recovery,
            options,
          ),
  };
  return {
    adapters,
    storage,
    reject: (value) => {
      reject = value;
    },
    values: () => ({
      profile: storage.getItem('profile'),
      packs: assets.get('packs') ?? null,
      session: storage.getItem('session'),
    }),
    journal: () => assets.get('journal') ?? null,
  };
}

test('journal failure restores previous bytes; explicit illustrated import and Undo retain the same old collection', async () => {
  const { library } = await earnedProfile(),
    saved = suspended(routes[0]),
    h = storageHarness();
  const old = await prepareBackup(
    { format: BACKUP_FORMAT, library, packs: oldPacks, session: saved.session },
    { decodeImage },
  );
  const next = await prepareBackup(
    { format: BACKUP_FORMAT, library, packs: newPacks, session: saved.session },
    { decodeImage },
  );
  assert.equal((await commitBackup(old, h.adapters)).ok, true);
  const before = h.values();
  h.reject(true);
  const failed = await commitBackup(next, h.adapters);
  assert.equal(failed.ok, false);
  assert.equal(failed.recoveryRequired, false);
  assert.deepEqual(h.values(), before);
  assert.equal(h.journal(), null);
  h.reject(false);
  assert.equal((await commitBackup(next, h.adapters)).ok, true);
  assert.deepEqual(loadLibrary(h.storage, 'profile').library, library);
  assert.deepEqual(JSON.parse(h.values().packs).packs[0].levelVisuals, current.levelVisuals);
  assert.equal((await commitBackup(old, h.adapters)).ok, true);
  assert.deepEqual(JSON.parse(h.values().packs).packs[0], previous);
  assert.equal(h.values().session, before.session);
  assert.deepEqual(loadLibrary(h.storage, 'profile').library, library);
});

test('public fixture generator emits six proven sessions/scenarios and a legally completed procedural backup without overwriting arbitrary files', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workshop-art-fixtures-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const names = [
    'authoring/library/equipment-workshop/previous/equipment-workshop-1.0.0.json',
    'game/content/packs/equipment-workshop.json',
    'game/replays/expansion-routes.json',
    ...source.images.map((image) => image.sourcePath),
  ];
  for (const name of names) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await copyFile(path.join(ROOT, name), path.join(root, name));
  }
  const out = path.join(root, '.cache/round-27/browser/fixtures');
  const report = await createWorkshopArtFixtures({ root, out });
  assert.equal(report.files, 14);
  assert.equal(report.attempts.length, 6);
  const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json')));
  assert.equal(manifest.completed.seals, 0);
  const old = await prepareBackup(
    await readFile(path.join(out, 'workshop-procedural-completed.backup.json'), 'utf8'),
    { decodeImage },
  );
  assert.equal(old.library.gallery.length, 3);
  assert.equal(old.library.scores.length, 3);
  assert.deepEqual(old.packs.packs[0], previous);
  const first = manifest.attempts[0];
  const live = JSON.parse(await readFile(path.join(out, first.sessionFile)));
  assert.ok(old.library.scores.every((score) => score.runId !== live.runId));
  const replayed = recordLibraryCompletion(old.library, {
    campaign: oldCampaign,
    result: first.winningSummary,
    runId: live.runId,
    themeId: live.themeId,
    bodyId: live.bodyId,
    sourcePackId: previous.id,
    completedAt: STAMP,
  });
  assert.equal(replayed.gallery.length, 3);
  assert.equal(
    replayed.scores.length,
    4,
    'A new QA replay must not alias the old collection attempt.',
  );
  for (const file of manifest.files)
    assert.equal(sha(await readFile(path.join(out, file.name))), file.sha256);
  await assert.rejects(createWorkshopArtFixtures({ root, out }), /Output exists/);
  await assert.rejects(
    createWorkshopArtFixtures({ root, out: path.join(root, 'elsewhere') }),
    /direct child/,
  );
  await writeFile(path.join(out, manifest.files[0].name), 'edited');
  await assert.rejects(createWorkshopArtFixtures({ root, out, replace: true }), /edited/);
  assert.equal(await readFile(path.join(out, manifest.files[0].name), 'utf8'), 'edited');
});

test('historical nine packs retain their budget boundary; seven active packs allow any one archived edition without raising the cap', async () => {
  const index = JSON.parse(await readFile(path.join(ROOT, 'game/content/packs/index.json')));
  const archiveIndex = JSON.parse(
    await readFile(path.join(ROOT, 'game/content/packs/archive-index.json')),
  );
  assert.equal(index.packs.length, 7);
  assert.equal(archiveIndex.packs.length, 3);
  const historicalRefs = [
    ...index.packs.filter((entry) => entry.id !== 'fpv-arcade-r4'),
    ...archiveIndex.packs,
  ];
  assert.equal(historicalRefs.length, 9);
  const known = new Map(
    current.levelVisuals.map((entry) => {
      const dataUrl = entry.visualOverrides.background.dataUrl;
      return [dataUrl, inspectImageDataUrl(dataUrl)];
    }),
  );
  const homeward = JSON.parse(
    await readFile(path.join(ROOT, 'game/content/packs/homeward-skies.json')),
  );
  for (const entry of homeward.levelVisuals) {
    const bytes = await readFile(
      path.join(ROOT, `authoring/library/homeward-skies/backgrounds/${entry.levelId}.png`),
    );
    const dataUrl = entry.visualOverrides.background.dataUrl;
    assert.equal(dataUrl, `data:image/png;base64,${bytes.toString('base64')}`);
    const dimensions = inspectImageDataUrl(dataUrl);
    assert.equal(dimensions.valid, true);
    known.set(dataUrl, dimensions);
  }
  const firstLight = JSON.parse(
    await readFile(path.join(ROOT, 'game/content/packs/fpv-arcade.json')),
  );
  const firstLightArt = JSON.parse(
    await readFile(path.join(ROOT, 'authoring/library/fpv-arcade/art-provenance.json')),
  );
  assert.deepEqual(
    firstLight.levelVisuals.map((entry) => entry.levelId),
    ['orchard-window', 'split-courtyard', 'night-signal'],
  );
  assert.equal(firstLightArt.images.length, 3);
  assert.equal(new Set(firstLightArt.images.map((image) => image.sha256)).size, 3);
  for (const entry of firstLight.levelVisuals) {
    const image = firstLightArt.images.find((image) => image.id === entry.levelId);
    assert.ok(image);
    assert.equal(image.file, `backgrounds/${entry.levelId}.png`);
    const bytes = await readFile(path.join(ROOT, 'authoring/library/fpv-arcade', image.file));
    assert.equal(bytes.length, image.bytes);
    assert.equal(sha(bytes), image.sha256);
    const dataUrl = entry.visualOverrides.background.dataUrl;
    assert.equal(dataUrl, `data:image/png;base64,${bytes.toString('base64')}`);
    const dimensions = inspectImageDataUrl(dataUrl);
    assert.equal(dimensions.valid, true);
    assert.equal(dimensions.width, image.width);
    assert.equal(dimensions.height, image.height);
    assert.equal(dimensions.width, dimensions.height * 2);
    known.set(dataUrl, dimensions);
  }
  assert.equal(known.size, 9);
  const packs = await Promise.all(
    historicalRefs.map(async (entry) =>
      JSON.parse(await readFile(path.join(ROOT, 'game/content/packs', entry.path))),
    ),
  );
  const text = JSON.stringify({ format: 'xonix-pack-library.v1', packs });
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1024 * 1024);
  assert.ok(Buffer.byteLength(text) > PACK_LIMITS.libraryBytes);
  let decoded = 0;
  const decodeImage = async (dataUrl) => {
    const info = known.get(dataUrl);
    assert.ok(info, 'Only exact Homeward, Workshop and First Light originals');
    decoded++;
    return { naturalWidth: info.width, naturalHeight: info.height };
  };
  await assert.rejects(importPackLibrary(text, { decodeImage }), /byte budget/);
  assert.equal(decoded, 0, 'Over-budget libraries fail before image decoding or adoption.');
  for (const removedId of ['fpv-arcade', 'fpv-arcade-r2']) {
    const selected = packs.filter((p) => p.id !== removedId);
    const eight = JSON.stringify({ format: 'xonix-pack-library.v1', packs: selected });
    assert.ok(Buffer.byteLength(eight) <= PACK_LIMITS.libraryBytes);
    decoded = 0;
    const installed = await importPackLibrary(eight, { decodeImage });
    assert.equal(decoded, 12);
    assert.equal(installed.packs.length, 8);
    assert.equal(exportPackLibrary(installed), eight);
    const omitted = (
      await preparePack(
        packs.find((p) => p.id === removedId),
        { decodeImage },
      )
    ).pack;
    assert.throws(() => installPack(installed, omitted), /byte budget/);
    assert.equal(
      exportPackLibrary(installed),
      eight,
      'Rejected ninth pack never evicts or changes the installed library.',
    );
  }
  const active = [];
  for (const entry of index.packs) {
    const source = JSON.parse(await readFile(path.join(ROOT, 'game/content/packs', entry.path)));
    active.push((await preparePack(source, { decodeImage })).pack);
  }
  const activeText = JSON.stringify({ format: 'xonix-pack-library.v1', packs: active });
  assert.ok(Buffer.byteLength(activeText) < PACK_LIMITS.libraryBytes);
  const installed = await importPackLibrary(activeText, { decodeImage });
  assert.equal(installed.packs.length, 7);
  for (const { id } of archiveIndex.packs) {
    const archived = (
      await preparePack(
        packs.find((pack) => pack.id === id),
        { decodeImage },
      )
    ).pack;
    const withArchive = installPack(installed, archived);
    assert.equal(withArchive.packs.length, 8);
    const bytes = exportPackLibrary(withArchive);
    assert.ok(Buffer.byteLength(bytes) <= PACK_LIMITS.libraryBytes);
    assert.equal(exportPackLibrary(await importPackLibrary(bytes, { decodeImage })), bytes);
    const another = (
      await preparePack(
        packs.find((pack) =>
          archiveIndex.packs.some((entry) => entry.id === pack.id && entry.id !== id),
        ),
        { decodeImage },
      )
    ).pack;
    assert.throws(() => installPack(withArchive, another), /byte budget/);
    assert.equal(
      exportPackLibrary(withArchive),
      bytes,
      'No archived edition is evicted to make room.',
    );
    const removed = removePack(withArchive, id);
    assert.equal(exportPackLibrary(removed), activeText);
    assert.equal(exportPackLibrary(installPack(removed, archived)), bytes);
  }
});
