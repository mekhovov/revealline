import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  createRun,
  stepRun,
  getSummary,
  releaseInputs,
  FIXED_DT,
  CLASSES,
} from '../core/index.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import {
  DEFAULT_PREFERENCES,
  LIBRARY_LIMITS,
  LIBRARY_VERSION,
  LIBRARY_STORAGE_VERSION,
  emptyLibrary,
  importLibrary,
  exportLibrary,
  validateLibrary,
  updatePreferences,
  mergeLibraries,
  loadLibrary,
  saveLibrary,
  campaignKey,
  boardIdentity,
  recordLibraryCompletion,
  progressFor,
} from '../library.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';

const read = (name) => readFileSync(new URL(name, import.meta.url));
const json = (name) => JSON.parse(read(name));
const sha = (data) => createHash('sha256').update(data).digest('hex');
const oldProfiles = json('./fixtures/controller-boost-profiles.json').sources;
const first = json('../content/campaign.json').levels[0];
// A new data-only fixture: a stationary field enemy lets real public ticks test
// long-duration persistence without inventing a terminal state or summary.
const base = {
  version: 'xonix-campaign.v1',
  id: 'difficulty-storage',
  revision: '1',
  title: 'Difficulty storage',
  classRecipes: structuredClone(CLASSES),
  levels: [
    {
      ...first,
      id: 'difficulty-storage-01',
      name: 'Storage crossing',
      enemies: [{ id: 'field', type: 'bouncer', x: 37.5, y: 24.5, vx: 0, vy: 0, radius: 0.3 }],
    },
  ],
};
const standard = createDifficultyContext(base, 'standard');
const gentle = createDifficultyContext(base, 'gentle');
const contexts = [standard, gentle];
const campaigns = contexts.map((context) => context.campaign);
const stamp = '2026-09-12T12:00:00.000Z';
const copy = (value) => structuredClone(value);
const withoutMode = (value) => {
  const owned = copy(value);
  delete owned.preferences.campaignDifficulty;
  return owned;
};
function localStorage(entries = {}) {
  const map = new Map(Object.entries(entries)),
    writes = [];
  return {
    map,
    writes,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      map.set(key, String(value));
    },
    removeItem(key) {
      writes.push([key, null]);
      map.delete(key);
    },
  };
}
function begin(context, turnPolicy = 'immediate', seed = 1) {
  const options = {
    classId: 'scout',
    classRecipes: context.campaign.classRecipes,
    turnPolicy,
    seed,
  };
  const run = createRun(context.campaign.levels[0], options);
  return { run, recorder: createRecorder(context.campaign.levels[0], options), context };
}
function advance(flight, input, count) {
  for (let i = 0; i < count; i++) {
    assert.equal(flight.run.status, 'running');
    stepRun(flight.run, input, FIXED_DT);
    recordInput(flight.recorder, input);
  }
}
function win(context, turnPolicy = 'immediate', seed = 1) {
  const flight = begin(context, turnPolicy, seed);
  for (let ticks = 0; flight.run.status === 'running' && ticks < 600; ticks++)
    advance(flight, { direction: 'down' }, 1);
  assert.equal(flight.run.status, 'won');
  return flight;
}
function award(library, flight, runId, completedAt = stamp) {
  return recordLibraryCompletion(library, {
    campaign: flight.context.campaign,
    result: getSummary(flight.run),
    runId,
    completedAt,
    themeId: 'fpv',
    bodyId: 'fpv-body',
  });
}
function suspended(flight, runId = 'gentle-live-cut') {
  releaseInputs(flight.run);
  recordRelease(flight.recorder);
  return suspendSession({
    run: flight.run,
    recorder: flight.recorder,
    campaignKey: flight.context.campaignKey,
    runId,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    savedAt: stamp,
  });
}
const envelope = (library, session = null) => ({
  format: BACKUP_FORMAT,
  library,
  packs: emptyPackLibrary(),
  session,
});
function backupStore(before) {
  const storage = localStorage({
    profile: exportLibrary(before.library),
    session: JSON.stringify(before.session),
  });
  const assets = new Map([['packs', JSON.stringify(before.packs)]]);
  let fault = () => {};
  return {
    storage,
    assets,
    fail: (value) => {
      fault = value;
    },
    api: {
      storage,
      profileKey: 'profile',
      sessionKey: 'session',
      packsKey: 'packs',
      journalKey: 'journal',
      lockKey: 'backup-lock',
      withLock: (task) => task(),
      readAsset: async (key) => copy(assets.get(key) ?? null),
      writeAsset: async (key, value) => {
        fault(key, value);
        assets.set(key, copy(value));
      },
      commitProfile: (library, options) => saveLibrary(storage, 'profile', library, null, options),
    },
  };
}

for (const source of oldProfiles)
  test(`${source.version} omitted preferences migrate to explicit defaults and leave raw storage untouched`, () => {
    assert.equal(sha(source.profileText), source.profileSha256);
    const old = JSON.parse(source.profileText),
      text = JSON.stringify(old);
    assert.equal(Object.hasOwn(old.preferences, 'campaignDifficulty'), false);
    const migrated = importLibrary(old, { campaigns: [source.campaign] });
    assert.equal(DEFAULT_PREFERENCES.campaignDifficulty, 'standard');
    assert.equal(emptyLibrary().preferences.campaignDifficulty, 'standard');
    assert.equal(migrated.format, LIBRARY_VERSION);
    assert.deepEqual(migrated.preferences, {
      ...old.preferences,
      tapSteering: old.preferences.tapSteering ?? null,
      keyboardBindings: old.preferences.keyboardBindings ?? null,
      controllerBindings: old.preferences.controllerBindings ?? null,
      controllerBoostMode: 'hold',
      campaignDifficulty: 'standard',
      textSize: 'standard',
      screenControls: 'auto',
      touchControls: null,
    });
    for (const name of ['campaigns', 'gallery', 'scores', 'masteries'])
      assert.deepEqual(migrated[name], old[name] ?? []);
    assert.equal(JSON.stringify(old), text);
    for (const raw of [
      source.profileText,
      JSON.stringify({
        format: LIBRARY_STORAGE_VERSION,
        generation: 'generation-original',
        library: old,
      }),
    ]) {
      const storage = localStorage({ profile: raw }),
        loaded = loadLibrary(storage, 'profile');
      assert.equal(loaded.recovery, null);
      assert.equal(loaded.library.preferences.campaignDifficulty, 'standard');
      assert.equal(storage.getItem('profile'), raw);
      assert.deepEqual(storage.writes, []);
    }
  });

test('difficulty round trips independently of bindings, Boost mode and existing collected metadata', () => {
  const before = updatePreferences(importLibrary(oldProfiles[1].profileText), {
    controllerBoostMode: 'toggle',
    turnPolicy: 'grid-center',
    musicGenre: 'metal',
  });
  const bytes = exportLibrary(before);
  for (const campaignDifficulty of ['gentle', 'standard']) {
    const selected = updatePreferences(before, { campaignDifficulty });
    const restored = importLibrary(exportLibrary(selected));
    assert.equal(restored.preferences.campaignDifficulty, campaignDifficulty);
    assert.deepEqual(withoutMode(restored), withoutMode(before));
  }
  assert.equal(exportLibrary(before), bytes);
});

test('present malformed difficulties reject before storage reads, writes or image allocation', async () => {
  const before = emptyLibrary();
  let reads = 0,
    decodes = 0;
  const storage = localStorage();
  storage.getItem = () => {
    reads++;
    throw new Error('must not read');
  };
  const invalid = [undefined, null, false, 1, '', 'Standard', 'gentle ', 'easy', [], {}];
  for (const campaignDifficulty of invalid) {
    const candidate = { ...before, preferences: { ...before.preferences, campaignDifficulty } };
    assert.throws(() => updatePreferences(before, { campaignDifficulty }));
    assert.equal(validateLibrary(candidate).valid, false);
    assert.throws(() => importLibrary(candidate));
    assert.throws(() => mergeLibraries(candidate, before, { baseline: before }));
    assert.equal(
      saveLibrary(storage, 'profile', candidate, 'preserved-corrupt', { mode: 'replace' }).ok,
      false,
    );
    await assert.rejects(
      prepareBackup(envelope(candidate), {
        decodeImage: async () => {
          decodes++;
        },
      }),
    );
  }
  assert.equal(reads, 0);
  assert.equal(decodes, 0);
  assert.deepEqual(storage.writes, []);
});

test('accessors, inherited difficulty and attempt-state fields cannot masquerade as omission', () => {
  let reads = 0;
  const accessor = emptyLibrary();
  Object.defineProperty(accessor.preferences, 'campaignDifficulty', {
    enumerable: true,
    get() {
      reads++;
      return 'gentle';
    },
  });
  const inherited = withoutMode(emptyLibrary());
  Object.setPrototypeOf(inherited.preferences, { campaignDifficulty: 'gentle' });
  for (const candidate of [
    accessor,
    inherited,
    {
      ...emptyLibrary(),
      preferences: { ...emptyLibrary().preferences, currentDifficulty: 'gentle' },
    },
  ])
    assert.throws(() => importLibrary(candidate));
  assert.equal(reads, 0);
});

test('stale merges adopt the stored mode while deliberate Standard selection remains explicit', () => {
  const old = withoutMode(emptyLibrary()),
    storage = localStorage({ profile: JSON.stringify(old) });
  const baseline = loadLibrary(storage, 'profile');
  const options = { baseline: baseline.library, generation: baseline.generation };
  const remote = saveLibrary(
    storage,
    'profile',
    updatePreferences(baseline.library, { campaignDifficulty: 'gentle' }),
    null,
    options,
  );
  assert.equal(remote.ok, true);
  const stale = updatePreferences(baseline.library, { musicVolume: 0.15 });
  const saved = saveLibrary(storage, 'profile', stale, null, options);
  assert.equal(saved.ok, true);
  assert.equal(stale.preferences.campaignDifficulty, 'standard');
  assert.equal(saved.library.preferences.campaignDifficulty, 'gentle');
  assert.equal(saved.library.preferences.musicVolume, 0.15);
  const explicit = updatePreferences(saved.library, { campaignDifficulty: 'standard' });
  assert.equal(
    mergeLibraries(explicit, saved.library, { baseline: saved.library }).preferences
      .campaignDifficulty,
    'standard',
  );
  assert.equal(
    mergeLibraries(stale, remote.library, { baseline: old }).preferences.campaignDifficulty,
    'gentle',
  );
});

test('replacement and Undo restore preference generations without resurrecting a stale mode', () => {
  const prior = emptyLibrary(),
    storage = localStorage({ profile: exportLibrary(prior) });
  const replacement = saveLibrary(
    storage,
    'profile',
    updatePreferences(prior, { campaignDifficulty: 'gentle' }),
    null,
    { mode: 'replace' },
  );
  const undo = saveLibrary(storage, 'profile', prior, null, { mode: 'replace' });
  assert.equal(replacement.ok, true);
  assert.equal(undo.ok, true);
  assert.notEqual(undo.generation, replacement.generation);
  assert.equal(undo.library.preferences.campaignDifficulty, 'standard');
  const raw = storage.getItem('profile');
  assert.equal(
    saveLibrary(storage, 'profile', replacement.library, null, {
      baseline: replacement.library,
      generation: replacement.generation,
    }).ok,
    false,
  );
  assert.equal(storage.getItem('profile'), raw);
});

test('quota failure retains an exportable session-only preference and exact old stored bytes', () => {
  const raw = oldProfiles[1].profileText,
    storage = localStorage({ profile: raw });
  const selected = updatePreferences(loadLibrary(storage, 'profile').library, {
    campaignDifficulty: 'gentle',
  });
  storage.setItem = () => {
    throw new Error('quota');
  };
  const result = saveLibrary(storage, 'profile', selected);
  assert.equal(result.ok, false);
  assert.match(result.warning, /save|storage|session|quota/i);
  assert.equal(importLibrary(exportLibrary(selected)).preferences.campaignDifficulty, 'gentle');
  assert.equal(storage.getItem('profile'), raw);
  assert.deepEqual(storage.writes, []);
});

test('a no-lock session can export Gentle metadata without becoming a profile writer', async () => {
  const lease = await claimProfileWriter(undefined, 'difficulty-profile');
  assert.equal(lease.writable, false);
  const storage = localStorage({ profile: oldProfiles[1].profileText });
  const selected = updatePreferences(loadLibrary(storage, 'profile').library, {
    campaignDifficulty: 'gentle',
  });
  const ready = await prepareBackup(envelope(selected));
  const restored = await prepareBackup(await exportBackup(ready));
  assert.equal(restored.library.preferences.campaignDifficulty, 'gentle');
  assert.equal(storage.getItem('profile'), oldProfiles[1].profileText);
  assert.deepEqual(storage.writes, []);
  lease.release();
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: actual wins retain separate Standard/Gentle awards through backup and a live-cut restore`, async () => {
    const normalWin = win(standard, turnPolicy),
      gentleWin = win(gentle, turnPolicy);
    const normal = award(emptyLibrary(), normalWin, `normal-${turnPolicy}`);
    const wrong = recordLibraryCompletion(normal, {
      campaign: standard.campaign,
      result: getSummary(gentleWin.run),
      runId: 'wrong-mode',
      themeId: 'fpv',
      bodyId: 'fpv-body',
    });
    assert.equal(wrong, normal, 'Derived level revision cannot award a Standard clear.');
    const both = updatePreferences(award(normal, gentleWin, `gentle-${turnPolicy}`), {
      campaignDifficulty: 'standard',
    });
    assert.deepEqual(progressFor(both, standard.campaign), progressFor(normal, standard.campaign));
    assert.equal(Object.keys(both.campaigns).length, 2);
    assert.equal(both.gallery.length, 2);
    assert.equal(both.scores.length, 2);
    assert.notEqual(both.scores[0].boardId, both.scores[1].boardId);
    assert.deepEqual(both.masteries, normal.masteries);
    const flight = begin(gentle, turnPolicy);
    advance(flight, { direction: 'down' }, 120);
    assert.equal(flight.run.player.cutting, true);
    const session = suspended(flight),
      input = envelope(both, session),
      bytes = JSON.stringify(input);
    const prepared = await prepareBackup(input, { campaigns });
    const recovered = await prepareBackup(await exportBackup(prepared, { campaigns }), {
      campaigns,
    });
    assert.deepEqual(recovered.library, both);
    assert.deepEqual(recovered.session, session);
    assert.equal(recovered.library.preferences.campaignDifficulty, 'standard');
    assert.equal(recovered.session.campaignKey, gentle.campaignKey);
    assert.equal(JSON.stringify(session).includes('campaignDifficulty'), false);
    const restored = await restoreSession(recovered.session, {
      campaign: gentle.campaign,
      campaignKey: gentle.campaignKey,
    });
    assert.deepEqual(exportReplay(restored.recorder, restored.run), session.replay);
    advance(flight, { direction: 'down' }, 30);
    for (let tick = 0; tick < 30; tick++) stepRun(restored.run, { direction: 'down' }, FIXED_DT);
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(flight.run));
    await assert.rejects(
      restoreSession(session, { campaign: standard.campaign, campaignKey: gentle.campaignKey }),
      /rules differ/,
    );
    assert.equal(JSON.stringify(input), bytes);
  });

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`core v3 ${turnPolicy}: a public Gentle cut keeps replay v4 in a full backup`, async () => {
    const pack = json('../content/packs/sentinel-relay.json');
    const context = createDifficultyContext(
      { ...pack.campaigns[0], classRecipes: pack.classRecipes },
      'gentle',
    );
    const flight = begin(context, turnPolicy);
    // Follow the existing ordinary route along the safe edge, then enter its
    // first live cut. The Gentle definition changes timing, not this geometry.
    advance(flight, { direction: 'up' }, 270);
    advance(flight, { direction: 'right' }, 180);
    advance(flight, {}, 116);
    advance(flight, { direction: 'down' }, 120);
    assert.equal(flight.run.player.cutting, true);
    const session = suspended(flight, `sentinel-gentle-${turnPolicy}`);
    const ready = await prepareBackup(envelope(emptyLibrary(), session), {
      resolveCampaign: (key) => (key === context.campaignKey ? context.campaign : null),
    });
    assert.equal(ready.session.replay.version, 'xonix-replay.v4');
    assert.equal(ready.session.replay.ruleset, 'xonix-core.v3');
    const restored = await restoreSession(ready.session, {
      campaign: context.campaign,
      campaignKey: context.campaignKey,
    });
    assert.deepEqual(exportReplay(restored.recorder, restored.run), session.replay);
    await assert.rejects(prepareBackup(envelope(emptyLibrary(), session)), /matching included/);
    await assert.rejects(
      prepareBackup(envelope(emptyLibrary(), session), { resolveCampaign: () => base }),
      /identity differs/,
    );
  });

test('journaled mixed-mode import and Undo preserve a public suspended cut and exact prior branches', async () => {
  const normal = award(emptyLibrary(), win(standard), 'before-clear');
  const flight = begin(gentle);
  advance(flight, { direction: 'down' }, 120);
  const session = suspended(flight);
  const before = await prepareBackup(envelope(normal, session), { campaigns });
  const incoming = await prepareBackup(
    envelope(
      updatePreferences(award(normal, win(gentle), 'incoming-gentle'), {
        campaignDifficulty: 'gentle',
      }),
      session,
    ),
    { campaigns },
  );
  const h = backupStore(before),
    sessionBytes = h.storage.getItem('session');
  const imported = await commitBackup(incoming, h.api);
  assert.equal(imported.ok, true, imported.warning);
  assert.equal(imported.profile.library.preferences.campaignDifficulty, 'gentle');
  assert.equal(Object.keys(imported.profile.library.campaigns).length, 2);
  assert.equal(h.storage.getItem('session'), sessionBytes);
  const undone = await commitBackup(before, h.api);
  assert.equal(undone.ok, true, undone.warning);
  assert.notEqual(undone.profile.generation, imported.profile.generation);
  assert.deepEqual(undone.profile.library, before.library);
  assert.equal(h.storage.getItem('session'), sessionBytes);
  assert.equal(h.assets.get('journal'), null);
});

test('failed journal finalization rolls both mode branches and the save back without partial adoption', async () => {
  const before = await prepareBackup(envelope(award(emptyLibrary(), win(standard), 'old')), {
    campaigns,
  });
  const incoming = await prepareBackup(
    envelope(
      updatePreferences(award(before.library, win(gentle), 'new'), {
        campaignDifficulty: 'gentle',
      }),
    ),
    { campaigns },
  );
  const h = backupStore(before),
    raw = new Map(h.storage.map),
    assets = new Map(h.assets);
  let failed = false;
  h.fail((key, value) => {
    if (key === 'journal' && value === null && !failed) {
      failed = true;
      throw new Error('journal failed');
    }
  });
  const result = await commitBackup(incoming, h.api);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true, result.warning);
  assert.deepEqual(h.storage.map, raw);
  for (const [key, value] of assets) assert.deepEqual(h.assets.get(key), value);
  assert.equal(h.assets.get('journal'), null);
});

function fullScoreboard() {
  const library = award(emptyLibrary(), win(standard), 'score-template');
  const template = library.scores[0];
  // Imported local records are metadata, not newly verified attempts. Fill the
  // real shared cap with valid distinct boards, each at its existing ten-row cap.
  library.scores = Array.from({ length: 100 }, (_, board) => {
    const seed = board + 1;
    const boardId = boardIdentity({
      campaign: standard.campaign,
      level: standard.campaign.levels[0],
      recipe: standard.campaign.classRecipes[0],
      turnPolicy: 'immediate',
      seed,
      classRoute: ['scout'],
    });
    return Array.from({ length: 10 }, (_, row) => ({
      ...template,
      boardId,
      seed,
      runId: `old-${board}-${row}`,
      completedAt: '2026-09-11T12:00:00.000Z',
    }));
  }).flat();
  return importLibrary(library, { campaigns });
}

test('an actual Gentle clear uses the shared 1,000-score retention cap without rewriting Standard stats', () => {
  const before = fullScoreboard(),
    bytes = exportLibrary(before);
  assert.equal(before.scores.length, LIBRARY_LIMITS.scores);
  const after = award(before, win(gentle), 'new-gentle-cap');
  assert.equal(after.scores.length, 1000);
  assert.equal(after.scores[0].campaignKey, gentle.campaignKey);
  assert.deepEqual(after.scores.slice(1), before.scores.slice(0, 999));
  assert.deepEqual(after.campaigns[standard.campaignKey], before.campaigns[standard.campaignKey]);
  assert.deepEqual(after.masteries, before.masteries);
  assert.equal(exportLibrary(before), bytes);
});

test('full-backup merge retains the ordinary shared score eviction policy across both modes', async () => {
  const old = fullScoreboard(),
    incoming = award(emptyLibrary(), win(gentle), 'backup-gentle');
  const prepared = await prepareBackup(envelope(incoming), { campaigns });
  const merged = mergeLibraries(old, prepared.library, { baseline: old });
  assert.equal(merged.scores.length, 1000);
  assert.equal(merged.scores.filter((row) => row.campaignKey === gentle.campaignKey).length, 1);
  assert.equal(merged.scores.filter((row) => row.campaignKey === standard.campaignKey).length, 999);
  assert.deepEqual(merged.campaigns[standard.campaignKey], old.campaigns[standard.campaignKey]);
  assert.deepEqual(merged.masteries, old.masteries);
  const roundtrip = await prepareBackup(
    await exportBackup(
      { library: merged, packs: emptyPackLibrary(), session: null },
      { campaigns },
    ),
    { campaigns },
  );
  assert.deepEqual(roundtrip.library, merged);
});

test('per-board retention stays ten independently for Standard and Gentle results', () => {
  const normal = win(standard),
    eased = win(gentle);
  let library = award(emptyLibrary(), normal, 'standard-retained');
  const standardRow = copy(library.scores[0]);
  for (let i = 0; i < 12; i++) library = award(library, eased, `repeat-gentle-${i}`);
  assert.equal(library.scores.length, 11);
  assert.equal(library.scores.filter((row) => row.campaignKey === gentle.campaignKey).length, 10);
  assert.deepEqual(
    library.scores.find((row) => row.campaignKey === standard.campaignKey),
    standardRow,
  );
});

test('7,200 seconds remains the portable time ceiling, without clamping or partial mutation', () => {
  const template = award(emptyLibrary(), win(gentle), 'time-boundary');
  const boundary = copy(template),
    key = gentle.campaignKey,
    levelId = gentle.campaign.levels[0].id;
  boundary.campaigns[key].clears[levelId].time = 7200;
  for (const row of Object.values(boundary.campaigns[key].clears[levelId].variants))
    row.time = 7200;
  boundary.gallery[0].time = 7200;
  boundary.scores[0].time = 7200;
  assert.deepEqual(importLibrary(boundary), boundary);
  for (const change of [
    (value) => {
      value.campaigns[key].clears[levelId].time = 7200 + FIXED_DT;
    },
    (value) => {
      value.gallery[0].time = 7200 + FIXED_DT;
    },
    (value) => {
      value.scores[0].time = 7200 + FIXED_DT;
    },
  ]) {
    const bad = copy(boundary);
    change(bad);
    assert.equal(validateLibrary(bad).valid, false);
    const storage = localStorage({ profile: exportLibrary(template) }),
      raw = storage.getItem('profile');
    assert.equal(saveLibrary(storage, 'profile', bad).ok, false);
    assert.equal(storage.getItem('profile'), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test('a real untimed Gentle win after two hours cannot update collection', () => {
  const flight = begin(gentle);
  for (let seconds = 0; seconds < 7200; seconds += 10) stepRun(flight.run, {}, 10);
  assert.equal(flight.run.status, 'running');
  for (let ticks = 0; flight.run.status === 'running' && ticks < 600; ticks++)
    stepRun(flight.run, { direction: 'down' }, FIXED_DT);
  assert.equal(flight.run.status, 'won');
  assert.ok(flight.run.time > 7200);
  const before = award(emptyLibrary(), win(standard), 'existing-standard'),
    raw = exportLibrary(before);
  assert.throws(() => award(before, flight, 'too-long'));
  assert.equal(exportLibrary(before), raw);
  assert.deepEqual(Object.keys(before.campaigns), [campaignKey(standard.campaign)]);
});
