import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, recordLibraryCompletion, campaignKey, exportLibrary } from '../library.mjs';
import { emptyPackLibrary, exportPackLibrary, resolvePackCampaign } from '../packs.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { challengeCampaign } from '../challenges.mjs';
import {
  BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  prepareBackup,
  validateBackup,
  exportBackup,
} from '../backup.mjs';

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'backup-flight',
  revision: '1',
  title: 'Backup flight',
  classRecipes: structuredClone(CLASSES),
  levels: [
    {
      version: 'xonix-level.v1',
      id: 'backup-level',
      revision: '1',
      name: 'Portable flight',
      width: 48,
      height: 36,
      spawn: { x: 24.5, y: 0.5 },
      walls: [],
      enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
      objectives: [],
      supplies: [],
      goal: { coverage: 0.3 },
    },
  ],
};
function flight(source = campaign, turnPolicy = 'immediate') {
  const options = { classId: 'scout', classRecipes: source.classRecipes, turnPolicy };
  const run = createRun(source.levels[0], options);
  const recorder = createRecorder(source.levels[0], options, 'backup-test');
  for (let i = 0; i < 100; i++) {
    stepRun(run, { direction: 'down' }, FIXED_DT);
    recordInput(recorder, { direction: 'down' });
  }
  assert.ok(run.trail.length > 0);
  const session = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(source),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: `portable-${turnPolicy}`,
    savedAt: '2026-09-12T12:00:00.000Z',
  });
  return { session, run };
}
function sourceBackup() {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  pack.visualOverrides.background = { dataUrl: png, name: 'original.png' };
  return {
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: { format: 'xonix-pack-library.v1', packs: [pack] },
    session: null,
  };
}
test('a full archive preserves all member formats, original image bytes and prepared-pack capability', async () => {
  const candidate = sourceBackup();
  const before = structuredClone(candidate);
  const ready = await validateBackup(JSON.stringify(candidate), { decodeImage });
  assert.equal(ready.packs.packs[0].visualOverrides.background.dataUrl, png);
  assert.equal(ready.session, null);
  assert.ok(Object.isFrozen(ready.library.preferences));
  assert.ok(Object.isFrozen(ready.packs));
  assert.equal(JSON.parse(exportPackLibrary(ready.packs)).format, 'xonix-pack-library.v1');
  assert.equal(JSON.parse(exportLibrary(ready.library)).format, 'xonix-library.v1');
  const text = await exportBackup(ready, { decodeImage });
  assert.deepEqual(await prepareBackup(text, { decodeImage }), ready);
  assert.deepEqual(candidate, before);
});
for (const policy of ['immediate', 'grid-center'])
  test(`profile awards and a live ${policy} cut survive a single-file backup and continue`, async () => {
    const source = sourceBackup();
    const { session, run } = flight(campaign, policy);
    source.session = session;
    const winner = createRun(campaign.levels[0]);
    while (winner.status === 'running') stepRun(winner, { direction: 'down' }, FIXED_DT);
    assert.equal(winner.status, 'won');
    source.library = recordLibraryCompletion(emptyLibrary(), {
      campaign,
      result: getSummary(winner),
      runId: 'previous-clear',
      themeId: 'fpv',
      bodyId: 'fpv-body',
      completedAt: '2026-09-12T11:00:00.000Z',
    });
    const options = { campaigns: [campaign], decodeImage };
    const prepared = await prepareBackup(source, options);
    const restoredBackup = await prepareBackup(await exportBackup(prepared, options), options);
    const restored = await restoreSession(restoredBackup.session, {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    assert.equal(restoredBackup.library.gallery.length, 1);
    assert.equal(restoredBackup.library.scores.length, 1);
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    for (let tick = 0; tick < 40; tick++) {
      stepRun(run, { direction: 'right' }, FIXED_DT);
      stepRun(restored.run, { direction: 'right' }, FIXED_DT);
    }
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  });
test('a suspended pack campaign resolves only from included prepared content', async () => {
  const source = sourceBackup();
  source.packs.packs[0].campaigns[0].levels = structuredClone(campaign.levels);
  const prepared = await prepareBackup(source, { decodeImage });
  const pack = prepared.packs.packs[0];
  const resolved = resolvePackCampaign(pack, pack.campaigns[0].id).campaign;
  source.session = flight(resolved).session;
  assert.ok((await prepareBackup(source, { decodeImage })).session);
  const missing = { ...source, packs: emptyPackLibrary() };
  await assert.rejects(prepareBackup(missing, { decodeImage }), /requires a matching included/);
});
test('a trusted dated-campaign resolver must return the exact registered campaign identity', async () => {
  const daily = challengeCampaign('2026-09-12', 'calm');
  const source = {
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: flight(daily).session,
  };
  const key = campaignKey(daily);
  const restored = await prepareBackup(source, {
    resolveCampaign: (requested) => (requested === key ? daily : null),
  });
  assert.equal(restored.session.campaignKey, key);
  await assert.rejects(
    prepareBackup(source, { resolveCampaign: () => campaign }),
    /campaign identity differs/,
  );
});
test('bad profile, pack dependencies, decode and replay checkpoints cannot partially replace caller state', async () => {
  const previous = await prepareBackup(sourceBackup(), { decodeImage });
  let active = previous;
  for (const change of [
    (s) => (s.library.preferences.masterVolume = -1),
    (s) => (s.packs.packs[0].dependencies = [{ id: 'absent', version: '1.0.0' }]),
    (s) => (s.packs.packs[0].visualOverrides.background.dataUrl = 'https://invalid.test/a.png'),
    (s) => {
      s.session = flight().session;
      s.session.replay.summary.score += 100;
    },
    (s) => {
      s.session = flight().session;
      s.session.savedAt = 'September 12';
    },
  ]) {
    const candidate = sourceBackup();
    change(candidate);
    await assert.rejects(async () => {
      active = await prepareBackup(candidate, { campaigns: [campaign], decodeImage });
    });
    assert.equal(active, previous);
  }
  await assert.rejects(
    prepareBackup(sourceBackup(), {
      decodeImage: async () => {
        throw new Error('decode failed');
      },
    }),
    /decode failed/,
  );
  assert.equal(active, previous);
});
test('a self-consistent replay with different rules is rejected against its installed campaign', async () => {
  const different = structuredClone(campaign);
  different.levels[0].goal.coverage = 0.4;
  const source = sourceBackup();
  source.session = flight(different).session;
  source.session.campaignKey = campaignKey(campaign);
  await assert.rejects(
    prepareBackup(source, { campaigns: [campaign], decodeImage }),
    /rules differ from the installed/,
  );
});
test('full-envelope and trusted-campaign snapshots resist edits while images decode', async () => {
  const source = sourceBackup();
  source.session = flight().session;
  const registered = structuredClone(campaign);
  let release;
  const pending = prepareBackup(source, {
    campaigns: [registered],
    decodeImage: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  source.library.preferences.masterVolume = 0.01;
  source.session.runId = 'changed-later';
  source.session.replay.summary.score = 9876;
  source.packs.packs[0].visualOverrides.background.dataUrl = 'bad';
  registered.levels[0].goal.coverage = 0.99;
  release({ naturalWidth: 1, naturalHeight: 1 });
  const ready = await pending;
  assert.equal(ready.library.preferences.masterVolume, 0.8);
  assert.equal(ready.session.runId, 'portable-immediate');
  assert.equal(ready.packs.packs[0].visualOverrides.background.dataUrl, png);
});
test('strict envelopes reject executable fields, prototype keys, accessors and missing members', async () => {
  const empty = {
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: null,
  };
  for (const candidate of [
    { ...empty, format: 'xonix-backup.v2' },
    { ...empty, scripts: ['run.js'] },
    { ...empty, session: undefined },
    { ...empty, session: 'not-a-session' },
    { format: BACKUP_FORMAT, packs: emptyPackLibrary(), session: null },
    JSON.stringify(empty).replace('"session":null', '"session":null,"__proto__":{}'),
    Object.assign(Object.create({ hidden: true }), empty),
  ])
    await assert.rejects(prepareBackup(candidate));
  let read = false;
  const getter = { ...empty };
  Object.defineProperty(getter, 'library', {
    enumerable: true,
    get() {
      read = true;
      return emptyLibrary();
    },
  });
  await assert.rejects(prepareBackup(getter), /accessors/);
  assert.equal(read, false);
  const loop = { ...empty };
  loop.session = loop;
  await assert.rejects(prepareBackup(loop), /cycles/);
});
test('outer bytes reject before parsing and member limits remain independently enforced', async () => {
  await assert.rejects(prepareBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /byte budget/);
  const source = sourceBackup();
  source.library.preferences.masterVolume = 9;
  let calls = 0;
  await assert.rejects(
    prepareBackup(source, {
      decodeImage: async () => {
        calls++;
        return decodeImage();
      },
    }),
  );
  assert.equal(calls, 0);
  source.library = emptyLibrary();
  source.packs.packs = Array.from({ length: 13 }, () => structuredClone(source.packs.packs[0]));
  await assert.rejects(prepareBackup(source, { decodeImage }), /Invalid expansion library/);
});
test('abort before work and during decode rejects without returning adoptable data', async () => {
  const before = new AbortController();
  before.abort();
  await assert.rejects(prepareBackup(sourceBackup(), { signal: before.signal }), {
    name: 'AbortError',
  });
  const during = new AbortController();
  await assert.rejects(
    prepareBackup(sourceBackup(), {
      signal: during.signal,
      decodeImage: async () => {
        during.abort();
        return decodeImage();
      },
    }),
    { name: 'AbortError' },
  );
});
test('empty backup exports default to no suspended attempt and tolerate older preference migration', async () => {
  const library = emptyLibrary();
  delete library.preferences.masterVolume;
  delete library.preferences.matchClassAppearance;
  const text = await exportBackup({ library, packs: emptyPackLibrary() });
  const ready = await prepareBackup(text);
  assert.equal(ready.session, null);
  assert.equal(ready.library.preferences.masterVolume, 0.8);
  assert.equal(ready.library.preferences.matchClassAppearance, false);
  assert.equal(library.preferences.masterVolume, undefined);
});
