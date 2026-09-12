import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey, emptyLibrary, loadLibrary, saveLibrary, exportLibrary } from '../library.mjs';
import {
  preparePack,
  validatePack,
  installPack,
  removePack,
  emptyPackLibrary,
  importPackLibrary,
  exportPackLibrary,
  resolvePackCampaign,
  scenarioFromPack,
  ENCOUNTER_PACK_VERSION,
} from '../packs.mjs';
import { prepareBackup, exportBackup, BACKUP_FORMAT } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const source = await readJSON('../../authoring/library/sentinel-relay/proposedpack-source.json');
const oldSource = await readJSON('../content/packs/night-shift.json');
const goalsSource = await readJSON('../content/packs/equipment-workshop.json');
const oracle = await readJSON('./fixtures/compatibility-v0100.json');
const noImage = async () => {
  throw new Error('These fixtures have no image decoder work.');
};
const prepare = async (candidate, library) =>
  (await preparePack(candidate, { decodeImage: noImage, library })).pack;
const entryFor = (pack) => resolvePackCampaign(pack, pack.campaigns[0].id);
const pack = await prepare(source),
  entry = entryFor(pack),
  campaign = entry.campaign,
  key = campaignKey(campaign);
const old = await prepare(oldSource),
  goals = await prepare(goalsSource);
const oldPacks = installPack(installPack(emptyPackLibrary(), old), goals);
const mixed = installPack(oldPacks, pack);
function session(policy = 'immediate') {
  const options = {
    classId: 'scout',
    classRecipes: campaign.classRecipes,
    seed: 1,
    turnPolicy: policy,
  };
  const run = createRun(campaign.levels[0], options),
    recorder = createRecorder(campaign.levels[0], options, 'encounter-backup');
  for (let i = 0; i < 300; i++) {
    stepRun(run, {}, FIXED_DT);
    recordInput(recorder, {});
  }
  return suspendSession({
    run,
    recorder,
    campaignKey: key,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: `saved-encounter-${policy}`,
    savedAt: '2026-09-12T12:00:00.000Z',
  });
}
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';

test('encounter pack v3 stays data-only with explicit empty goals and playable scenario v3', () => {
  assert.equal(ENCOUNTER_PACK_VERSION, 'xonix-pack.v3');
  assert.equal(entry.sourcePackFormat, ENCOUNTER_PACK_VERSION);
  assert.deepEqual(entry.masteries, []);
  assert.ok(Object.isFrozen(pack.campaigns[0].levels[0].encounter));
  const scenario = scenarioFromPack(pack, campaign.id, campaign.levels[0].id, {
    classId: 'fiber',
    turnPolicy: 'grid-center',
    seed: 9,
  });
  assert.equal(scenario.format, 'xonix-playground.v3');
  assert.equal(scenario.masteryDefinition, null);
  assert.equal(scenario.settings.classId, 'fiber');
  assert.equal(
    createRun(scenario.level, { ...scenario.settings, classRecipes: scenario.classRecipes })
      .ruleset,
    'xonix-core.v3',
  );
  assert.deepEqual(source, JSON.parse(JSON.stringify(pack)));
});
test('mixed v1/v2/v3 expansion library roundtrip preserves old bytes and current old goals', async () => {
  const restored = await importPackLibrary(exportPackLibrary(mixed), { decodeImage: noImage });
  assert.equal(exportPackLibrary(restored), exportPackLibrary(mixed));
  assert.deepEqual(
    restored.packs.map((p) => p.format),
    ['xonix-pack.v1', 'xonix-pack.v2', 'xonix-pack.v3'],
  );
  for (const legacy of [old, goals])
    assert.deepEqual(
      restored.packs.find((p) => p.id === legacy.id),
      legacy,
    );
  const entries = restored.packs.map((p) => {
    const value = entryFor(p);
    return {
      campaign: value.campaign,
      sourcePackId: value.sourcePackId,
      ...(value.sourcePackFormat
        ? { sourcePackFormat: value.sourcePackFormat, masteries: value.masteries }
        : {}),
    };
  });
  const catalog = createMasteryCatalog(entries);
  assert.equal(catalog.registrations.length, 3);
  assert.equal(catalog.get(key, campaign.levels[0].id), null);
});
test('format, engine, level and mastery mismatches reject before any image decode', async () => {
  for (const alter of [
    (p) => {
      p.engine = 'xonix-core.v2';
    },
    (p) => {
      p.format = 'xonix-pack.v2';
    },
    (p) => {
      p.campaigns[0].levels[0].version = 'xonix-level.v1';
    },
    (p) => {
      p.campaigns[0].levels.push(structuredClone(old.campaigns[0].levels[0]));
    },
    (p) => {
      delete p.masteries;
    },
    (p) => {
      p.masteries = [structuredClone(goals.masteries[0])];
    },
    (p) => {
      p.campaigns[0].levels[0].encounter.script = 'run()';
    },
    (p) => {
      p.campaigns[0].levels[0].encounter.enemyId = 'absent';
    },
  ]) {
    const candidate = structuredClone(source);
    candidate.visualOverrides.background = { dataUrl: png, name: 'original.png' };
    alter(candidate);
    let calls = 0;
    assert.equal(validatePack(candidate).valid, false);
    await assert.rejects(
      preparePack(candidate, {
        decodeImage: async () => {
          calls++;
          return { naturalWidth: 1, naturalHeight: 1 };
        },
      }),
    );
    assert.equal(calls, 0);
  }
});
test('same-ID replacement changes only its encounter content; assets cannot alter simulation identity', async () => {
  const before = exportPackLibrary(mixed),
    changed = structuredClone(source);
  changed.version = '1.0.1';
  changed.campaigns[0].levels[0].encounter.laneWidth = 1.5;
  const replacement = await prepare(changed, mixed),
    next = installPack(mixed, replacement);
  assert.equal(next.packs.length, 3);
  assert.notEqual(campaignKey(entryFor(replacement).campaign), key);
  assert.equal(exportPackLibrary(mixed), before);
  const cosmetic = structuredClone(source);
  cosmetic.themes[0].palette.accent = '#112233';
  const cosmeticPack = await prepare(cosmetic);
  assert.equal(campaignKey(entryFor(cosmeticPack).campaign), key);
  assert.deepEqual(removePack(next, pack.id), oldPacks);
});
for (const policy of ['immediate', 'grid-center'])
  test(`mixed old collection and ${policy} encounter suspended slot survive a single complete backup`, async () => {
    const saved = session(policy),
      input = { format: BACKUP_FORMAT, library: oracle.library, packs: mixed, session: saved };
    const before = JSON.stringify(input),
      options = { campaigns: [oracle.campaign], decodeImage: noImage };
    const ready = await prepareBackup(input, options);
    const restoredBackup = await prepareBackup(await exportBackup(ready, options), options);
    assert.equal(exportLibrary(restoredBackup.library), exportLibrary(oracle.library));
    assert.equal(exportPackLibrary(restoredBackup.packs), exportPackLibrary(mixed));
    assert.deepEqual(restoredBackup.session, saved);
    const restored = await restoreSession(restoredBackup.session, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), saved.replay.checkpoint);
    assert.equal(JSON.stringify(input), before);
    await assert.rejects(
      prepareBackup({ ...input, packs: oldPacks }, options),
      /matching included pack/,
    );
  });
test('a malformed nested replay version pair fails before any backup image allocation', async () => {
  const images = structuredClone(oldSource);
  images.visualOverrides.background = { dataUrl: png, name: 'original.png' };
  const saved = session();
  saved.replay.checkpoint.algorithm = 'fnv1a64-state-v2';
  let calls = 0;
  await assert.rejects(
    prepareBackup(
      {
        format: BACKUP_FORMAT,
        library: emptyLibrary(),
        packs: { format: 'xonix-pack-library.v1', packs: [images, source] },
        session: saved,
      },
      {
        decodeImage: async () => {
          calls++;
          return { naturalWidth: 1, naturalHeight: 1 };
        },
      },
    ),
    /mismatched simulation versions/,
  );
  assert.equal(calls, 0);
});
test('prepared encounter backup resists caller mutation while legacy pack artwork decodes', async () => {
  const images = structuredClone(oldSource);
  images.visualOverrides.background = { dataUrl: png, name: 'original.png' };
  const saved = session(),
    expected = saved.replay.checkpoint.hash;
  const input = {
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: { format: 'xonix-pack-library.v1', packs: [images, structuredClone(source)] },
    session: saved,
  };
  let done;
  const pending = prepareBackup(input, {
    decodeImage: () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  });
  input.session.replay.level.encounter.laneWidth = 4;
  input.packs.packs[1].campaigns[0].levels[0].encounter.transitionTicks = 1;
  done({ naturalWidth: 1, naturalHeight: 1 });
  const ready = await pending;
  assert.equal(ready.session.replay.checkpoint.hash, expected);
  assert.equal(
    ready.packs.packs[1].campaigns[0].levels[0].encounter.transitionTicks,
    source.campaigns[0].levels[0].encounter.transitionTicks,
  );
});
test('journaled mixed import, rollback and Undo preserve old collection and encounter save boundaries', async () => {
  const local = new Map(),
    assets = new Map();
  let fail = false;
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
    readAsset: async (key) => structuredClone(assets.get(key) ?? null),
    writeAsset: async (key, value) => {
      assets.set(key, structuredClone(value));
    },
    withLock: (task) => task(),
    commitProfile: (library, options) =>
      fail
        ? { ok: false, warning: 'Injected failure' }
        : saveLibrary(storage, 'profile', library, null, options),
  };
  const previous = await prepareBackup(
    { format: BACKUP_FORMAT, library: oracle.library, packs: oldPacks, session: null },
    { campaigns: [oracle.campaign], decodeImage: noImage },
  );
  const incoming = await prepareBackup(
    { format: BACKUP_FORMAT, library: oracle.library, packs: mixed, session: session() },
    { campaigns: [oracle.campaign], decodeImage: noImage },
  );
  assert.equal((await commitBackup(previous, adapters)).ok, true);
  const oldBytes = storage.getItem('profile'),
    oldPackBytes = assets.get('packs');
  fail = true;
  assert.equal((await commitBackup(incoming, adapters)).ok, false);
  assert.equal(storage.getItem('profile'), oldBytes);
  assert.equal(assets.get('packs'), oldPackBytes);
  assert.equal(storage.getItem('session'), null);
  fail = false;
  assert.equal((await commitBackup(incoming, adapters)).ok, true);
  assert.equal(JSON.parse(storage.getItem('session')).replay.version, 'xonix-replay.v4');
  assert.equal((await commitBackup(previous, adapters)).ok, true);
  assert.equal(
    exportLibrary(loadLibrary(storage, 'profile').library),
    exportLibrary(oracle.library),
  );
  assert.equal(assets.get('packs'), oldPackBytes);
  assert.equal(storage.getItem('session'), null);
  assert.equal(assets.get('journal'), null);
});
