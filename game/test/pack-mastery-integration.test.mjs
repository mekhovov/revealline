import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  STEADY_SIGNAL,
  SUPPLY_LINE,
  SAFE_RETURN,
  captureMasteryFacts,
  masteryDefinitionIdentity,
} from '../mastery.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';
import {
  preparePack,
  emptyPackLibrary,
  installPack,
  removePack,
  resolvePackCampaign,
  exportPackLibrary,
  importPackLibrary,
} from '../packs.mjs';
import {
  campaignKey,
  emptyLibrary,
  recordLibraryCompletion,
  withMasteryRecords,
  loadLibrary,
  saveLibrary,
} from '../library.mjs';
import { prepareBackup, exportBackup, BACKUP_FORMAT } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { pictureMasteries } from '../ui/mastery-view.mjs';

const copy = (value) => structuredClone(value);
const canonical = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const proofBytes = await readFile(new URL('../replays/homeward-routes.json', import.meta.url));
const proof = JSON.parse(proofBytes);
const definitions = [STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN];
const KEY = 'homeward-skies/1/0d01f5687b3c38ff';
const STAMP = '2026-09-12T12:00:00.000Z';
// Full canonical {preview, verification, record} digests produced only by the
// frozen v0.8.0 site modules, source 8410d814dbcc7b3aef53e11c6f94d384d01cce05.
// Archive SHA: 6ea37522cf6e253b2999611b2a66e0a2aa661dac61ca37d7db6771edfe86e52b.
// Ordinary tests need no Git, archived runtime or regeneration of old fixtures.
// Do not update these values to accommodate a changed container implementation.
const V080 = {
  'homeward-01/immediate/specialty/fiber':
    '629bed3465e2e0b0bf2742acb9d9df2a7171ea5e18c9f5bcfd4c9ab4cb4ccae7',
  'homeward-01/immediate/fallback/interceptor':
    '2a287c55778578eedc4fc6f808a5f06b23ffd0685a874fcd7bf03a0411de8c3d',
  'homeward-01/grid-center/specialty/fiber':
    '0a9b52dfafac3440d441cce38605c514c143c7401ee9f6d1ce96cebbeabe5b7b',
  'homeward-01/grid-center/fallback/interceptor':
    '3149c5ae60781be83368193c90d01402dc10d16c113ae999e39dc84d78d3abc0',
  'homeward-02/immediate/specialty/bomber':
    '8e40d3826fe1981e3a78bfb4e958adfceb7659175652324ad916d62c0c0945ee',
  'homeward-02/immediate/fallback/interceptor':
    '19a380060935dac0fc24ad510479def16f853f0e7ee8af0927b772072d9a2acd',
  'homeward-02/grid-center/specialty/bomber':
    'fc16ca1919174e59ef6ef2581b99fff03617473c49fa644e442c410ba5584779',
  'homeward-02/grid-center/fallback/interceptor':
    '2493de3db554412025e3a9b587627c23aa12c25fa1abe750ba9f0b5724079f21',
  'homeward-03/immediate/specialty/impact':
    '70ec5f06ae5ba2dcf7025e6c2ae0e2762793dc94bfc111bdf7642d7529192239',
  'homeward-03/immediate/fallback/interceptor':
    '44ef9c41b87d49acd3236687faca9310d313382513a813e3fa432af0e017a51e',
  'homeward-03/grid-center/specialty/impact':
    'a9ce94b9c84a54b60fdda23e4a17a6bd04be98f593683124222dda8f80b4c9b7',
  'homeward-03/grid-center/fallback/interceptor':
    '77a375d7024e6310d6eb50fcfb56712661e6e74d2638aba27133145cefa79348',
};

function presentationFree(pack) {
  // Dedicated presentation removal leaves every original map/recipe byte intact.
  // This suite tests integration without allocating or pretending to decode art.
  pack.visualOverrides = {};
  pack.levelVisuals = [];
  return pack;
}
const homeward = presentationFree(await json('../content/packs/homeward-skies.json'));
const night = presentationFree(await json('../content/packs/night-shift.json'));
const noImage = async () => {
  throw new Error('This integration fixture has no image overrides.');
};
const v2Source = (masteries = definitions) => ({
  ...copy(homeward),
  format: 'xonix-pack.v2',
  masteries: copy(masteries),
});
const prepare = async (source, library) =>
  (await preparePack(source, { decodeImage: noImage, library })).pack;
const v1 = await prepare(homeward);
const v2 = await prepare(v2Source());
const older = await prepare(night);
const mixed = installPack(installPack(emptyPackLibrary(), older), v2);
function entry(pack, id = pack.campaigns[0].id) {
  const resolved = resolvePackCampaign(pack, id);
  return {
    campaign: resolved.campaign,
    sourcePackId: resolved.sourcePackId,
    ...(resolved.sourcePackFormat
      ? {
          sourcePackFormat: resolved.sourcePackFormat,
          masteries: resolved.masteries,
        }
      : {}),
  };
}
const catalogFor = (library) =>
  createMasteryCatalog(
    library.packs.flatMap((pack) => pack.campaigns.map((campaign) => entry(pack, campaign.id))),
  );
const installed = entry(v2),
  campaign = installed.campaign;
const catalog = catalogFor(mixed);
const goalFor = (levelId) => catalog.get(KEY, levelId).definition;
const routes = proof.routes.filter(
  (route) => route.variant === 'specialty' || route.classId === 'interceptor',
);
const routeFor = (levelId, policy = 'immediate') =>
  routes.find(
    (route) =>
      route.levelId === levelId && route.turnPolicy === policy && route.variant === 'specialty',
  );

function advance(source, route, end = route.expected.tick) {
  let index = 0;
  const start = source.run.tick;
  for (const segment of route.segments) {
    if (source.run.tick >= end) return;
    if (segment.releaseBefore && index >= start) {
      releaseInputs(source.run);
      recordRelease(source.recorder);
    }
    for (let n = 0; n < segment.ticks; n++) {
      if (index++ < start) continue;
      if (source.run.tick >= end) return;
      stepRun(source.run, segment.input, FIXED_DT);
      recordInput(source.recorder, segment.input);
      source.masteryObserver?.observe(
        captureMasteryFacts(source.run, {
          runId: source.runId,
          definition: source.definition,
        }),
      );
    }
  }
}
function recording(route, end = route.expected.tick) {
  const level = campaign.levels.find((value) => value.id === route.levelId);
  const options = {
    classId: route.classId,
    seed: route.seed,
    turnPolicy: route.turnPolicy,
    classRecipes: campaign.classRecipes,
  };
  const source = {
    run: createRun(level, options),
    recorder: createRecorder(level, options, 'pack-integration'),
  };
  advance(source, route, end);
  return { ...source, replay: exportReplay(source.recorder, source.run) };
}
const recordings = new Map(routes.map((route) => [route.id, recording(route)]));
const runIdFor = (route) => `pack-${route.id}`;
const request = (definition, runId) => ({
  definition,
  campaignId: campaign.id,
  campaignKey: KEY,
  runId,
});
const memo = new Map();
function assess(route) {
  if (!memo.has(route.id))
    memo.set(
      route.id,
      (async () => {
        const replay = recordings.get(route.id).replay,
          definition = goalFor(route.levelId);
        const runId = runIdFor(route);
        const checked = await verifyReplayAsync(replay, { mastery: request(definition, runId) });
        const verification = await verifyMasteryRun({
          replay,
          campaign,
          definition,
          runId,
          earnedAt: STAMP,
        });
        return { checked, verification, record: verifiedMasteryRecord(verification) };
      })(),
    );
  return memo.get(route.id);
}
async function earnedProfile() {
  let library = emptyLibrary();
  for (const route of routes.filter((value) => value.variant === 'specialty')) {
    const { record } = await assess(route);
    assert.ok(record);
    library = recordLibraryCompletion(library, {
      campaign,
      result: recordings.get(route.id).replay.summary,
      runId: runIdFor(route),
      themeId: 'fpv',
      bodyId: 'fpv-body',
      sourcePackId: v2.id,
      completedAt: STAMP,
    });
    library = withMasteryRecords(library, [record]);
  }
  return library;
}
function suspended(route, tick) {
  const source = recording(route, tick),
    runId = `saved-${route.id}`;
  return {
    ...source,
    runId,
    session: suspendSession({
      ...source,
      campaignKey: KEY,
      runId,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      savedAt: STAMP,
    }),
  };
}

test('the immutable Homeward proof and twelve v0.8 result digests remain pinned', () => {
  assert.equal(sha(proofBytes), '63a77908b1ce98b480f9fd0431894e4f1d58ad56e4266ae0860206de564d8c1a');
  assert.equal(routes.length, 12);
  assert.deepEqual(Object.keys(V080).sort(), routes.map((route) => route.id).sort());
  assert.equal(campaignKey(campaign), KEY);
  assert.equal(campaignKey(entry(v1).campaign), KEY);
});

test('prepared v2 registrations are owned sidecars and preserve explicit mixed member formats', async () => {
  const before = copy(homeward),
    resolved = entry(v2),
    registered = createMasteryCatalog([resolved]);
  assert.equal(Object.hasOwn(resolved.campaign, 'masteries'), false);
  assert.equal(resolved.sourcePackFormat, 'xonix-pack.v2');
  assert.equal(Object.hasOwn(entry(v1), 'masteries'), false);
  for (const definition of definitions) {
    const current = registered.get(KEY, definition.levelId);
    assert.equal(current.definitionIdentity, masteryDefinitionIdentity(definition));
    assert.ok(Object.isFrozen(current.definition));
    assert.equal(current.rosterHash, 'roster-v1-e159e435');
  }
  resolved.masteries[0].name = 'Caller mutation';
  assert.equal(registered.get(KEY, 'homeward-01').definition.name, 'Steady Signal');
  assert.deepEqual(homeward, before);
  const text = exportPackLibrary(mixed),
    roundTrip = await importPackLibrary(text, { decodeImage: noImage });
  assert.deepEqual(roundTrip, mixed);
  assert.deepEqual(
    roundTrip.packs.map((pack) => pack.format),
    ['xonix-pack.v1', 'xonix-pack.v2'],
  );
  assert.equal(Object.hasOwn(roundTrip.packs[0], 'masteries'), false);
});

for (const route of routes)
  test(`${route.id}: prepared declaration preserves the complete frozen v0.8 result`, async () => {
    const source = recordings.get(route.id),
      before = copy(source.replay);
    assert.deepEqual(source.replay.summary, route.expected);
    assert.deepEqual(source.replay.checkpoint, route.checkpoint);
    const { checked, verification, record } = await assess(route);
    assert.equal(checked.match, true);
    assert.deepEqual(checked.actual.summary, route.expected);
    assert.deepEqual(checked.actual.checkpoint, route.checkpoint);
    const bundle = { preview: checked.masteryPreview, verification, record };
    assert.equal(
      sha(canonical(bundle)),
      V080[route.id],
      'Every preview/result/record field matches the frozen runtime.',
    );
    assert.equal(verification.qualified, route.variant === 'specialty');
    assert.equal(record !== null, route.variant === 'specialty');
    assert.equal(checked.masteryPreview.authority, 'preview-only');
    assert.throws(() => verifiedMasteryRecord(copy(verification)), /verification is required/);
    assert.deepEqual(source.replay, before);
  });

for (const comparison of proof.comparisons)
  test(`${comparison.levelId}/${comparison.turnPolicy}: pack declarations do not qualify omitted-action controls`, async () => {
    const checked = await verifyReplayAsync(comparison.replay, {
      mastery: request(
        goalFor(comparison.levelId),
        `omitted-${comparison.levelId}-${comparison.turnPolicy}`,
      ),
    });
    assert.equal(checked.match, true);
    assert.deepEqual(checked.actual.summary, comparison.replay.summary);
    assert.deepEqual(checked.actual.checkpoint, comparison.replay.checkpoint);
    assert.equal(checked.masteryPreview.qualified, false);
  });

for (const policy of ['immediate', 'grid-center'])
  test(`mixed full backup preserves earned metadata and live equipment progress (${policy})`, async () => {
    const library = await earnedProfile();
    assert.equal(library.masteries.length, 6);
    assert.equal(library.gallery.length, 3);
    for (const [levelId, tick] of [
      ['homeward-02', 850],
      ['homeward-03', 140],
    ]) {
      const route = routeFor(levelId, policy),
        source = suspended(route, tick);
      const candidate = { format: BACKUP_FORMAT, library, packs: mixed, session: source.session };
      const before = copy(candidate);
      const prepared = await prepareBackup(candidate, { decodeImage: noImage });
      const exported = await exportBackup(prepared, { decodeImage: noImage });
      const imported = await prepareBackup(exported, { decodeImage: noImage });
      assert.deepEqual(imported, prepared);
      assert.deepEqual(imported.library, library);
      assert.deepEqual(
        imported.packs.packs.map((pack) => pack.format),
        ['xonix-pack.v1', 'xonix-pack.v2'],
      );
      assert.equal(imported.session.format, 'xonix-session.v1');
      assert.equal(imported.session.replay.version, 'xonix-replay.v3');
      assert.equal(Object.hasOwn(imported.session, 'masteries'), false);
      const afterCatalog = catalogFor(imported.packs);
      const definition = afterCatalog.get(KEY, levelId).definition;
      const afterCampaign = entry(imported.packs.packs.find((pack) => pack.id === v2.id)).campaign;
      const restored = await restoreSession(imported.session, {
        campaign: afterCampaign,
        campaignKey: KEY,
        masteryDefinition: definition,
      });
      const prefix = await verifyReplayAsync(source.session.replay, {
        mastery: request(goalFor(levelId), source.runId),
      });
      assert.deepEqual(restored.masteryObserver.snapshot(), prefix.masteryPreview);
      assert.deepEqual(authoritativeCheckpoint(restored.run), source.session.replay.checkpoint);
      if (levelId === 'homeward-03')
        assert.equal(prefix.masteryPreview.predicates[1].phase, 'awaiting-return');
      else
        assert.equal(
          prefix.masteryPreview.predicates[1].regions.find((r) => r.zoneId === 'west-emitter')
            .bestClosedCells,
          4,
        );
      advance({ ...restored, definition, runId: source.runId }, route);
      assert.equal(restored.masteryObserver.snapshot().qualified, true);
      assert.deepEqual(exportReplay(restored.recorder, restored.run).checkpoint, route.checkpoint);
      assert.deepEqual(candidate, before);
    }
  });

test('goal replacement, explicit removal and exact reinstall preserve historical records and current labels', async () => {
  const previous = await earnedProfile(),
    original = copy(previous);
  const revisedSource = v2Source();
  revisedSource.version = '1.0.1';
  const revised = revisedSource.masteries.find((value) => value.id === 'supply-line');
  revised.revision = '2';
  revised.name = 'Supply Line III';
  revised.description =
    'Refill both pads, close three suppressed cells in each region, switch at the south hangar, then win.';
  revised.all[1].regions.forEach((region) => {
    region.minCells = 3;
  });
  const revisedPack = await prepare(revisedSource, mixed);
  const changed = installPack(mixed, revisedPack),
    changedCatalog = catalogFor(changed);
  const route = routeFor('homeward-02');
  const revisedVerification = await verifyMasteryRun({
    replay: recordings.get(route.id).replay,
    campaign,
    definition: changedCatalog.get(KEY, route.levelId).definition,
    runId: 'revised-pack-goal',
    earnedAt: STAMP,
  });
  const revisedRecord = verifiedMasteryRecord(revisedVerification);
  assert.ok(revisedRecord);
  const library = withMasteryRecords(previous, [revisedRecord]);
  const picture = library.gallery.find((value) => value.levelId === route.levelId);
  const names = (packs) => {
    const current = catalogFor(packs);
    return pictureMasteries(
      library.masteries,
      picture,
      current.get(KEY, picture.levelId)?.definition ?? null,
      campaign.classRecipes,
      current,
    ).map((value) => value.name);
  };
  assert.equal(names(changed).filter((name) => name === 'Supply Line III').length, 1);
  assert.equal(names(changed).filter((name) => name === 'Archived seal: supply-line').length, 2);
  const explicitNone = installPack(changed, await prepare(v2Source([]), changed));
  assert.equal(catalogFor(explicitNone).get(KEY, route.levelId), null);
  assert.ok(names(explicitNone).every((name) => name === 'Archived seal: supply-line'));
  const removed = removePack(explicitNone, v2.id);
  const archivedBackup = await prepareBackup(
    { format: BACKUP_FORMAT, library, packs: removed, session: null },
    { decodeImage: noImage },
  );
  assert.deepEqual(archivedBackup.library, library);
  const reinstalled = installPack(archivedBackup.packs, v1);
  assert.equal(names(reinstalled).filter((name) => name === 'Supply Line').length, 2);
  assert.equal(
    names(reinstalled).filter((name) => name === 'Archived seal: supply-line').length,
    1,
  );
  assert.deepEqual(previous, original);
  assert.deepEqual(library.gallery, previous.gallery);
  assert.equal(library.masteries.length, 7);
});

test('a revised or removed goal reconstructs a saved prefix from current declarations without stale counters', async () => {
  const route = routeFor('homeward-02'),
    source = suspended(route, 850);
  const revised = v2Source();
  const goal = revised.masteries.find((value) => value.id === 'supply-line');
  goal.revision = '2';
  goal.all[1].regions.forEach((region) => {
    region.minCells = 4;
  });
  const changed = installPack(mixed, await prepare(revised, mixed));
  const definition = catalogFor(changed).get(KEY, route.levelId).definition;
  const restored = await restoreSession(source.session, {
    campaign,
    campaignKey: KEY,
    masteryDefinition: definition,
  });
  assert.equal(
    restored.masteryObserver.snapshot().definitionIdentity,
    masteryDefinitionIdentity(definition),
  );
  advance({ ...restored, definition, runId: source.runId }, route);
  assert.equal(restored.run.status, 'won');
  assert.equal(
    restored.masteryObserver.snapshot().qualified,
    false,
    'The original south three-cell route cannot satisfy a new four-cell threshold.',
  );
  assert.deepEqual(exportReplay(restored.recorder, restored.run).checkpoint, route.checkpoint);
  const without = installPack(changed, await prepare(v2Source([]), changed));
  assert.equal(catalogFor(without).get(KEY, route.levelId), null);
  const ordinary = await restoreSession(source.session, { campaign, campaignKey: KEY });
  assert.equal(Object.hasOwn(ordinary, 'masteryObserver'), false);
  assert.deepEqual(authoritativeCheckpoint(ordinary.run), source.session.replay.checkpoint);
});

function storageHarness() {
  const local = new Map(),
    assets = new Map();
  let rejectProfile = false;
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
    readAsset: async (key) => copy(assets.get(key) ?? null),
    writeAsset: async (key, value) => {
      assets.set(key, copy(value));
    },
    withLock: (task) => task(),
    commitProfile: (library, options) =>
      rejectProfile
        ? { ok: false, warning: 'Injected write failure' }
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
      rejectProfile = value;
    },
    bytes: () => ({
      profile: storage.getItem('profile'),
      session: storage.getItem('session'),
      packs: assets.get('packs') ?? null,
    }),
    journal: () => assets.get('journal') ?? null,
  };
}

test('journaled mixed backup adoption, failed replacement and explicit Undo retain the intended formats and records', async () => {
  const h = storageHarness();
  const old = await prepareBackup(
    {
      format: BACKUP_FORMAT,
      library: emptyLibrary(),
      packs: installPack(emptyPackLibrary(), older),
      session: null,
    },
    { decodeImage: noImage },
  );
  assert.equal((await commitBackup(old, h.adapters)).ok, true);
  const prior = h.bytes();
  const library = await earnedProfile(),
    source = suspended(routeFor('homeward-03'), 140);
  const incoming = await prepareBackup(
    { format: BACKUP_FORMAT, library, packs: mixed, session: source.session },
    { decodeImage: noImage },
  );
  h.reject(true);
  const failed = await commitBackup(incoming, h.adapters);
  assert.equal(failed.ok, false);
  assert.equal(failed.recoveryRequired, false);
  assert.deepEqual(h.bytes(), prior, 'Rejected profile commit rolls back pack/session bytes too.');
  assert.equal(h.journal(), null);
  h.reject(false);
  assert.equal((await commitBackup(incoming, h.adapters)).ok, true);
  assert.deepEqual(loadLibrary(h.storage, 'profile').library, library);
  assert.deepEqual(
    JSON.parse(h.bytes().packs).packs.map((pack) => pack.format),
    ['xonix-pack.v1', 'xonix-pack.v2'],
  );
  assert.deepEqual(JSON.parse(h.bytes().session), source.session);
  assert.equal(
    (await commitBackup(old, h.adapters)).ok,
    true,
    'Undo is an explicit replacement, not a metadata union.',
  );
  assert.deepEqual(loadLibrary(h.storage, 'profile').library, old.library);
  assert.deepEqual(
    JSON.parse(h.bytes().packs).packs.map((pack) => pack.format),
    ['xonix-pack.v1'],
  );
  assert.equal(h.bytes().session, null);
  assert.equal(h.journal(), null);
  assert.equal(h.storage.getItem('profile.backup-lock'), null);
});
