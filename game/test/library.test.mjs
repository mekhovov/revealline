import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { CLASSES, loadoutHash } from '../core/registry.mjs';
import { emptyProgress, awardCompletion } from '../progress.mjs';
import {
  emptyLibrary,
  validateLibrary,
  importLibrary,
  exportLibrary,
  campaignKey,
  boardIdentity,
  progressFor,
  setCampaignProgress,
  recordLibraryCompletion,
  scoresFor,
  updatePreferences,
  loadLibrary,
  saveLibrary,
  LIBRARY_LIMITS,
  LIBRARY_STORAGE_VERSION,
  LibraryCapacityError,
  mergeLibraries,
  libraryCapacity,
} from '../library.mjs';
import { dataIdentity } from '../data-json.mjs';
import { resolveKeyBindings } from '../key-bindings.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
const level = {
  version: 'xonix-level.v1',
  id: 'first',
  revision: '1',
  name: 'First light',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'fixture',
  revision: '1',
  title: 'Fixture',
  levels: [level],
  classRecipes: structuredClone(CLASSES),
};
function result() {
  const state = createRun(level);
  for (let i = 0; i < 900 && state.status === 'running'; i++)
    stepRun(state, { direction: 'down' }, FIXED_DT);
  assert.equal(state.status, 'won');
  return getSummary(state);
}
const options = (runId = 'win-1', overrides = {}) => ({
  campaign,
  result: result(),
  runId,
  themeId: 'fpv',
  bodyId: 'fpv-body',
  completedAt: '2026-09-12T12:00:00.000Z',
  ...overrides,
});
function storage() {
  const map = new Map();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
}
test('library validation and storage messages follow the active locale', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));

  setLocale('en', { persist: false });
  assert.equal(
    validateLibrary({ ...emptyLibrary(), format: 'future' }).errors[0],
    'Unsupported player library version.',
  );
  assert.match(new LibraryCapacityError('gallery', 2, 1).message, /Library gallery budget/);

  setLocale('uk', { persist: false });
  assert.equal(
    validateLibrary({ ...emptyLibrary(), format: 'future' }).errors[0],
    'Версія бібліотеки гравця не підтримується.',
  );
  assert.match(new LibraryCapacityError('gallery', 2, 1).message, /Перевищено ліміт бібліотеки/);
  const unreadable = loadLibrary(
    {
      getItem: () => {
        throw new Error('blocked');
      },
    },
    'profile',
  );
  assert.match(unreadable.warning, /Не вдалося прочитати бібліотеку гравця/);
});
test('a real kernel win atomically records progress, gallery and local scores; portable roundtrip preserves each', () => {
  const original = emptyLibrary(),
    before = structuredClone(original),
    awarded = recordLibraryCompletion(original, options());
  assert.deepEqual(original, before);
  assert.equal(awarded.gallery.length, 1);
  assert.equal(awarded.scores.length, 1);
  assert.equal(progressFor(awarded, campaign).clears.first.clean, true);
  assert.deepEqual(importLibrary(exportLibrary(awarded), { campaigns: [campaign] }), awarded);
  assert.equal(validateLibrary(awarded).valid, true);
  assert.equal(recordLibraryCompletion(awarded, options()), awarded);
});
test('practice, failed, incompatible and repeated attempts cannot duplicate rewards or gallery entries', () => {
  const empty = emptyLibrary();
  for (const patch of [
    { practice: true },
    { result: { ...result(), status: 'lost', won: false } },
    { result: { ...result(), loadoutHash: 'loadout-v1-00000000' } },
  ])
    assert.equal(recordLibraryCompletion(empty, options('a', patch)), empty);
  const one = recordLibraryCompletion(empty, options('a'));
  const two = recordLibraryCompletion(one, options('b'));
  assert.equal(two.gallery.length, 1);
  assert.equal(two.scores.length, 2);
});
test('scoreboards cap and rank exact boards, dedupe run IDs and retain every actual attempt statistics together', () => {
  let library = emptyLibrary();
  for (let i = 0; i < 15; i++)
    library = recordLibraryCompletion(
      library,
      options(`run-${i}`, { result: { ...result(), score: 100 + i, time: 10 + i } }),
    );
  assert.equal(library.scores.length, 10);
  const ranked = scoresFor(library, library.scores[0].boardId);
  assert.deepEqual(
    ranked.map((r) => r.score),
    [114, 113, 112, 111, 110, 109, 108, 107, 106, 105],
  );
  assert.equal(ranked[0].time, 24);
  ranked[0].score = 0;
  assert.equal(library.scores[0].score, 114);
});
test('rules, geometry, roster, seed, policy and mixed class routes partition leaderboards', () => {
  const input = {
    campaign,
    level,
    recipe: CLASSES[0],
    turnPolicy: 'immediate',
    seed: 1,
    classRoute: ['scout'],
  };
  const identity = boardIdentity(input);
  for (const patch of [
    { seed: 2 },
    { turnPolicy: 'grid-center' },
    { classRoute: ['scout', 'bomber'] },
    { level: { ...level, rules: { moveSpeed: 11 } } },
    { campaign: { ...campaign, classRecipes: [CLASSES[0]] } },
  ])
    assert.notEqual(boardIdentity({ ...input, ...patch }), identity);
  const reordered = {
    ...campaign,
    levels: campaign.levels.map((l) => Object.fromEntries(Object.entries(l).reverse())),
  };
  assert.equal(campaignKey(reordered), campaignKey(campaign));
  assert.notEqual(
    campaignKey({ ...campaign, levels: [{ ...level, rules: { lives: 5 } }] }),
    campaignKey(campaign),
  );
});
test('known legacy progress migrates explicitly without fabricating gallery pictures or leaderboard runs', () => {
  const progress = awardCompletion(emptyProgress(campaign), campaign, result(), {
    runId: 'legacy',
  });
  const library = setCampaignProgress(emptyLibrary(), campaign, progress);
  assert.deepEqual(progressFor(library, campaign), progress);
  assert.equal(library.gallery.length, 0);
  assert.equal(library.scores.length, 0);
  assert.throws(
    () => setCampaignProgress(library, { ...campaign, id: 'other' }, progress),
    /incompatible/,
  );
});
test('preferences validate full shape and immutable patches including audio levels', () => {
  const before = emptyLibrary(),
    next = updatePreferences(before, {
      musicGenre: 'metal',
      musicVolume: 0.8,
      masterVolume: 0.7,
      turnPolicy: 'grid-center',
    });
  assert.equal(before.preferences.musicGenre, 'synthwave');
  assert.equal(next.preferences.musicGenre, 'metal');
  for (const patch of [
    { musicVolume: 2 },
    { masterVolume: -0.1 },
    { classId: 'javascript:run' },
    { injected: true },
    { showGrid: 'yes' },
    { style: 'unknown' },
  ])
    assert.throws(() => updatePreferences(next, patch));
});
test('bad imports reject before changing the existing library, including malformed identities and duplicates', () => {
  const current = recordLibraryCompletion(emptyLibrary(), options());
  const mutations = [
    (v) => (v.format = 'future'),
    (v) => (v.gallery[0].levelId = 'unearned'),
    (v) => v.scores.push(v.scores[0]),
    (v) => v.gallery.push(v.gallery[0]),
    (v) => (v.scores[0].score = Infinity),
    (v) => (v.gallery[0].completedAt = '2026-02-31T00:00:00.000Z'),
    (v) => (v.campaigns[campaignKey(campaign)].clears.first.variants = {}),
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(current);
    mutate(bad);
    let active = current;
    assert.throws(() => (active = importLibrary(bad)));
    assert.equal(active, current);
  }
});
test('prototype pollution, accessors, cycles, sparse/custom arrays and oversized files cannot enter saves', () => {
  let reads = 0;
  const access = emptyLibrary();
  Object.defineProperty(access.preferences, 'classId', {
    enumerable: true,
    get() {
      reads++;
      return 'scout';
    },
  });
  assert.throws(() => importLibrary(access), /accessors/);
  assert.equal(reads, 0);
  for (const key of ['__proto__', 'constructor', 'prototype'])
    assert.throws(() => importLibrary(`{"format":"xonix-library.v1","${key}":{}}`), /Forbidden/);
  const cycle = emptyLibrary();
  cycle.extra = cycle;
  assert.throws(() => importLibrary(cycle), /cycles/);
  const sparse = emptyLibrary();
  sparse.gallery = Array(1);
  assert.throws(() => importLibrary(sparse), /Sparse/);
  const decorated = emptyLibrary();
  decorated.scores.extra = true;
  assert.throws(() => importLibrary(decorated), /custom/);
  assert.throws(() => importLibrary(' '.repeat(LIBRARY_LIMITS.maxBytes + 1)), /budget/);
  assert.equal({}.polluted, undefined);
});
test('unknown campaign records roundtrip for temporarily removed packs but current campaign records validate against content', () => {
  const saved = recordLibraryCompletion(emptyLibrary(), options());
  assert.deepEqual(importLibrary(exportLibrary(saved), { campaigns: [] }), saved);
  const bad = structuredClone(saved);
  bad.campaigns[campaignKey(campaign)].clears.unknown =
    bad.campaigns[campaignKey(campaign)].clears.first;
  assert.equal(validateLibrary(bad).valid, true);
  assert.equal(validateLibrary(bad, { campaigns: [campaign] }).valid, false);
});
test('storage read corruption is preserved before replacement and failed recovery write never overwrites original', () => {
  const local = storage();
  local.map.set('profile', '{bad-json');
  const loaded = loadLibrary(local, 'profile');
  assert.equal(loaded.recovery, '{bad-json');
  assert.match(loaded.warning, /preserved/);
  assert.equal(saveLibrary(local, 'profile', loaded.library, loaded.recovery).ok, true);
  assert.ok(
    [...local.map.entries()].some(
      ([key, value]) => key.startsWith('profile.recovery.') && value === '{bad-json',
    ),
  );
  const broken = {
    getItem: () => null,
    setItem: (key) => {
      assert.notEqual(key, 'profile');
      throw new Error('quota');
    },
  };
  assert.equal(saveLibrary(broken, 'profile', emptyLibrary(), 'original').ok, false);
  const old = local.map.get('profile');
  assert.equal(saveLibrary(local, 'profile', { format: 'bad' }).ok, false);
  assert.equal(local.map.get('profile'), old);
});
test('class route metadata must match the registered roster and initial class', () => {
  const other = CLASSES.find((r) => r.id === 'bomber');
  const completed = result();
  const mixed = {
    ...completed,
    activeClassId: other.id,
    switches: 1,
    classHistory: [
      ...(completed.classHistory ?? [
        {
          classId: completed.classId,
          classRevision: completed.classRevision,
          loadoutHash: completed.loadoutHash,
          tick: 0,
        },
      ]),
      {
        classId: other.id,
        classRevision: other.revision,
        loadoutHash: loadoutHash(other),
        tick: 10,
      },
    ],
  };
  const one = recordLibraryCompletion(emptyLibrary(), options('mixed', { result: mixed }));
  assert.equal(one.scores[0].switches, 1);
  assert.deepEqual(one.scores[0].classRoute, ['scout', 'bomber']);
  const empty = emptyLibrary();
  assert.equal(
    recordLibraryCompletion(
      empty,
      options('bad', {
        result: {
          ...mixed,
          classHistory: [{ classId: 'invented', classRevision: '1', loadoutHash: 'x', tick: 0 }],
        },
      }),
    ),
    empty,
  );
});

test('earlier v1 profiles migrate the additive master volume field while preserving earned records', () => {
  const full = recordLibraryCompletion(emptyLibrary(), options()),
    old = structuredClone(full);
  delete old.preferences.masterVolume;
  const imported = importLibrary(JSON.stringify(old));
  assert.equal(imported.preferences.masterVolume, 0.8);
  assert.deepEqual(imported.gallery, full.gallery);
  assert.deepEqual(imported.campaigns, full.campaigns);
  assert.deepEqual(imported.scores, full.scores);
  assert.equal(Object.hasOwn(old.preferences, 'masterVolume'), false);
  const corrupt = structuredClone(old);
  corrupt.preferences.masterVolume = null;
  assert.throws(() => importLibrary(corrupt), /masterVolume/);
});

test('gallery preserves the actual procedural-art seed and upgrades pre-seed records', () => {
  const state = createRun(level, { seed: 19 });
  for (let i = 0; i < 900 && state.status === 'running'; i++)
    stepRun(state, { direction: 'down' }, FIXED_DT);
  const lib = recordLibraryCompletion(
    emptyLibrary(),
    options('seeded', { result: getSummary(state) }),
  );
  assert.equal(lib.gallery[0].seed, 19);
  assert.equal(importLibrary(exportLibrary(lib)).gallery[0].seed, 19);
  const older = structuredClone(lib);
  delete older.gallery[0].seed;
  assert.equal(importLibrary(older).gallery[0].seed, 1);
});
test('ordinary tab writes merge remote completions and apply only locally changed preferences', () => {
  const local = storage(),
    a = loadLibrary(local, 'p'),
    b = loadLibrary(local, 'p');
  const first = updatePreferences(recordLibraryCompletion(a.library, options('tab-a')), {
    musicGenre: 'metal',
  });
  const savedA = saveLibrary(local, 'p', first, null, {
    baseline: a.library,
    generation: a.generation,
  });
  assert.equal(savedA.ok, true);
  const pendingB = updatePreferences(b.library, { showGrid: true });
  const savedB = saveLibrary(local, 'p', pendingB, null, {
    baseline: b.library,
    generation: b.generation,
  });
  assert.equal(savedB.ok, true);
  assert.equal(savedB.library.gallery.length, 1);
  assert.equal(savedB.library.scores.length, 1);
  assert.equal(savedB.library.preferences.musicGenre, 'metal');
  assert.equal(savedB.library.preferences.showGrid, true);
  assert.deepEqual(loadLibrary(local, 'p').library, savedB.library);
  assert.equal(JSON.parse(local.map.get('p')).format, LIBRARY_STORAGE_VERSION);
  assert.equal(JSON.parse(exportLibrary(savedB.library)).format, 'xonix-library.v2');
  assert.deepEqual(
    importLibrary(local.map.get('p')),
    savedB.library,
    'raw recovered storage envelopes remain importable',
  );
});
test('a changed disk snapshot is re-read before merging and never overwritten blindly', () => {
  const local = storage(),
    base = emptyLibrary(),
    remote = recordLibraryCompletion(base, options('remote'));
  local.map.set('p', exportLibrary(base));
  let reads = 0;
  const interleaved = {
    ...local,
    getItem(key) {
      if (key === 'p' && ++reads === 2) local.map.set('p', exportLibrary(remote));
      return local.getItem(key);
    },
  };
  const saved = saveLibrary(interleaved, 'p', updatePreferences(base, { showGrid: true }), null, {
    baseline: base,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.library.gallery.length, 1);
  assert.equal(saved.library.preferences.showGrid, true);
  assert.ok(reads >= 4);
});
test('replacement observed during a merge retry invalidates the older candidate generation', () => {
  const local = storage(),
    base = emptyLibrary();
  local.map.set('p', exportLibrary(base));
  let reads = 0;
  const replacement = JSON.stringify({
    format: LIBRARY_STORAGE_VERSION,
    generation: 'generation-another-import',
    library: base,
  });
  const interleaved = {
    ...local,
    getItem(key) {
      if (key === 'p' && ++reads === 2) local.map.set('p', replacement);
      return local.getItem(key);
    },
  };
  const localWin = recordLibraryCompletion(base, options('pending'));
  const saved = saveLibrary(interleaved, 'p', localWin, null, { baseline: base });
  assert.equal(saved.ok, false);
  assert.equal(saved.conflict, true);
  assert.equal(saved.library.gallery.length, 1);
  assert.equal(local.map.get('p'), replacement);
});
test('concurrent completions preserve both setups, aggregate bests and coherent gallery result metadata', () => {
  const baseline = emptyLibrary(),
    left = recordLibraryCompletion(baseline, options('left', { result: { ...result(), seed: 7 } }));
  const right = recordLibraryCompletion(
    baseline,
    options('right', { result: { ...result(), seed: 12, score: result().score + 10 } }),
  );
  const before = [structuredClone(left), structuredClone(right)],
    merged = mergeLibraries(left, right, { baseline });
  const clear = progressFor(merged, campaign).clears.first;
  assert.equal(Object.keys(clear.variants).length, 2);
  assert.equal(merged.scores.length, 2);
  assert.equal(merged.gallery[0].seed, 12);
  assert.equal(merged.gallery[0].runId, 'right');
  assert.deepEqual([left, right], before);
});
test('explicit replacement and Undo invalidate stale tabs instead of resurrecting removed progress', () => {
  const local = storage(),
    baseline = emptyLibrary();
  const first = saveLibrary(local, 'p', recordLibraryCompletion(baseline, options()), null, {
    baseline,
  });
  const stale = loadLibrary(local, 'p');
  const replaced = saveLibrary(local, 'p', emptyLibrary(), null, {
    mode: 'replace',
    baseline: first.library,
    generation: first.generation,
  });
  assert.equal(replaced.ok, true);
  assert.notEqual(replaced.generation, stale.generation);
  const raw = local.map.get('p'),
    candidate = updatePreferences(stale.library, { showGrid: true });
  const rejected = saveLibrary(local, 'p', candidate, null, {
    baseline: stale.library,
    generation: stale.generation,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.conflict, true);
  assert.equal(rejected.library.gallery.length, 1);
  assert.equal(local.map.get('p'), raw);
  const restored = saveLibrary(local, 'p', stale.library, null, {
    mode: 'replace',
    generation: replaced.generation,
  });
  assert.equal(restored.ok, true);
  assert.notEqual(restored.generation, replaced.generation);
  assert.equal(
    saveLibrary(local, 'p', emptyLibrary(), null, {
      baseline: emptyLibrary(),
      generation: replaced.generation,
    }).conflict,
    true,
  );
});
test('backup import lock blocks ordinary writes but permits its owner and preserves disk on quota failures', () => {
  const local = storage(),
    base = emptyLibrary(),
    candidate = recordLibraryCompletion(base, options());
  saveLibrary(local, 'p', base);
  const old = local.map.get('p');
  local.map.set('p.backup-lock', 'owner');
  const blocked = saveLibrary(local, 'p', candidate, null, { baseline: base });
  assert.equal(blocked.conflict, true);
  assert.equal(local.map.get('p'), old);
  assert.equal(blocked.library.gallery.length, 1);
  const owned = saveLibrary(local, 'p', candidate, null, {
    mode: 'replace',
    writeLock: { key: 'p.backup-lock', token: 'owner' },
  });
  assert.equal(owned.ok, true);
  local.map.delete('p.backup-lock');
  const disk = local.map.get('p'),
    broken = {
      getItem: local.getItem,
      setItem() {
        throw new Error('quota');
      },
    };
  const failed = saveLibrary(broken, 'p', candidate, null, {
    baseline: owned.library,
    generation: owned.generation,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.library.gallery.length, 1);
  assert.equal(local.map.get('p'), disk);
});
test('stale corruption recovery never overwrites a different unreadable disk value', () => {
  const local = storage();
  local.map.set('p', 'old corrupt');
  const loaded = loadLibrary(local, 'p');
  local.map.set('p', 'new corrupt');
  const failed = saveLibrary(local, 'p', loaded.library, loaded.recovery, {
    baseline: loaded.library,
    generation: loaded.generation,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.conflict, true);
  assert.equal(local.map.get('p'), 'new corrupt');
});
test('old profiles preserve manual appearance choice while new profiles default to class matching', () => {
  const old = emptyLibrary();
  delete old.preferences.matchClassAppearance;
  old.preferences.bodyId = 'fpv-racer';
  const imported = importLibrary(old);
  assert.equal(imported.preferences.matchClassAppearance, false);
  assert.equal(imported.preferences.bodyId, 'fpv-racer');
  assert.equal(emptyLibrary().preferences.matchClassAppearance, true);
});
test('tap steering keeps device defaults for legacy profiles and preserves explicit choices through storage and exports', () => {
  const old = recordLibraryCompletion(emptyLibrary(), options('before-tap-preference'));
  delete old.preferences.tapSteering;
  const original = JSON.stringify(old);
  const migrated = importLibrary(original, { campaigns: [campaign] });
  assert.equal(migrated.preferences.tapSteering, null);
  assert.deepEqual(migrated.campaigns, old.campaigns);
  assert.deepEqual(migrated.gallery, old.gallery);
  assert.deepEqual(migrated.scores, old.scores);
  assert.equal(JSON.stringify(old), original);
  assert.equal(emptyLibrary().preferences.tapSteering, null);

  const local = storage();
  local.map.set('p', original);
  assert.equal(loadLibrary(local, 'p').library.preferences.tapSteering, null);
  for (const mode of [true, false, null]) {
    const selected = updatePreferences(migrated, { tapSteering: mode });
    const saved = saveLibrary(local, 'p', selected, null, { mode: 'replace' });
    assert.equal(saved.ok, true);
    assert.equal(loadLibrary(local, 'p').library.preferences.tapSteering, mode);
    assert.equal(importLibrary(exportLibrary(selected)).preferences.tapSteering, mode);
  }
  assert.equal(migrated.preferences.tapSteering, null);
});
test('tap steering rejects coercible values and unrelated stale edits cannot undo an explicit choice', () => {
  const baseline = emptyLibrary();
  for (const invalid of ['auto', 'true', 'false', 0, 1, {}, [], undefined]) {
    assert.throws(() => updatePreferences(baseline, { tapSteering: invalid }));
    assert.equal(baseline.preferences.tapSteering, null);
  }
  const remote = updatePreferences(baseline, { tapSteering: false });
  const local = updatePreferences(baseline, { musicGenre: 'rock' });
  const merged = mergeLibraries(local, remote, { baseline });
  assert.equal(merged.preferences.tapSteering, false);
  assert.equal(merged.preferences.musicGenre, 'rock');
  const automatic = updatePreferences(remote, { tapSteering: null });
  assert.equal(
    mergeLibraries(automatic, remote, { baseline: remote }).preferences.tapSteering,
    null,
  );
});
test('keyboard preferences migrate old profiles to defaults and preserve owned remaps through portable and local saves', () => {
  const old = recordLibraryCompletion(emptyLibrary(), options('before-key-preference'));
  delete old.preferences.keyboardBindings;
  const bytes = JSON.stringify(old);
  const migrated = importLibrary(bytes, { campaigns: [campaign] });
  assert.equal(migrated.preferences.keyboardBindings, null);
  assert.equal(emptyLibrary().preferences.keyboardBindings, null);
  assert.deepEqual(migrated.campaigns, old.campaigns);
  assert.deepEqual(migrated.gallery, old.gallery);
  assert.deepEqual(migrated.scores, old.scores);
  assert.equal(JSON.stringify(old), bytes);

  const bindings = resolveKeyBindings(null);
  bindings.bindings.ability = ['KeyQ'];
  const expected = structuredClone(bindings);
  const selected = updatePreferences(migrated, { keyboardBindings: bindings });
  bindings.bindings.ability.push('KeyF');
  assert.deepEqual(selected.preferences.keyboardBindings, expected);
  const imported = importLibrary(exportLibrary(selected));
  assert.deepEqual(imported.preferences.keyboardBindings, expected);
  imported.preferences.keyboardBindings.bindings.ability.push('KeyF');
  assert.deepEqual(selected.preferences.keyboardBindings, expected);

  const local = storage();
  local.map.set('p', bytes);
  assert.equal(loadLibrary(local, 'p').library.preferences.keyboardBindings, null);
  assert.equal(saveLibrary(local, 'p', selected, null, { mode: 'replace' }).ok, true);
  assert.deepEqual(loadLibrary(local, 'p').library.preferences.keyboardBindings, expected);
  const automatic = updatePreferences(selected, { keyboardBindings: null });
  assert.equal(saveLibrary(local, 'p', automatic, null, { mode: 'replace' }).ok, true);
  assert.equal(loadLibrary(local, 'p').library.preferences.keyboardBindings, null);
});
test('invalid keyboard remaps reject before preference adoption or replacement storage writes', () => {
  const baseline = emptyLibrary();
  const bytes = exportLibrary(baseline);
  const local = storage();
  local.map.set('p', bytes);
  const malformed = [false, 'default', [], {}, undefined];
  for (const mutate of [
    (value) => (value.version = 'future'),
    (value) => delete value.bindings.up,
    (value) => (value.bindings.ability = ['KeyW']),
    (value) => (value.bindings.ability = ['KeyQ', 'KeyQ']),
    (value) => (value.bindings.pause = ['KeyP']),
    (value) => (value.bindings.ability = ['javascript:run']),
    (value) => (value.bindings.ability = ['KeyQ', 'KeyF', 'KeyT', 'KeyY', 'KeyU']),
    (value) => (value.executable = 'run()'),
  ]) {
    const candidate = resolveKeyBindings(null);
    mutate(candidate);
    malformed.push(candidate);
  }
  for (const keyboardBindings of malformed) {
    assert.throws(() => updatePreferences(baseline, { keyboardBindings }));
    const invalid = structuredClone(baseline);
    invalid.preferences.keyboardBindings = keyboardBindings;
    assert.equal(validateLibrary(invalid).valid, false);
    assert.throws(() => importLibrary(invalid));
    assert.equal(saveLibrary(local, 'p', invalid, null, { mode: 'replace' }).ok, false);
    assert.equal(local.map.get('p'), bytes);
    assert.equal(exportLibrary(baseline), bytes);
  }
});
test('unchanged cloned keyboard settings preserve remote remaps while deliberate changes and default resets apply', () => {
  const originalBindings = resolveKeyBindings(null);
  const baseline = updatePreferences(emptyLibrary(), { keyboardBindings: originalBindings });
  const remoteBindings = resolveKeyBindings(null);
  remoteBindings.bindings.ability = ['KeyQ'];
  const remote = updatePreferences(baseline, { keyboardBindings: remoteBindings });
  const local = updatePreferences(baseline, { musicGenre: 'rock' });
  assert.notEqual(local.preferences.keyboardBindings, baseline.preferences.keyboardBindings);
  assert.deepEqual(local.preferences.keyboardBindings, baseline.preferences.keyboardBindings);
  const merged = mergeLibraries(local, remote, { baseline });
  assert.deepEqual(merged.preferences.keyboardBindings, remoteBindings);
  assert.equal(merged.preferences.musicGenre, 'rock');

  const deliberateBindings = resolveKeyBindings(null);
  deliberateBindings.bindings.ability = ['KeyF'];
  const deliberate = updatePreferences(local, { keyboardBindings: deliberateBindings });
  assert.deepEqual(
    mergeLibraries(deliberate, remote, { baseline }).preferences.keyboardBindings,
    deliberateBindings,
  );
  const automatic = updatePreferences(remote, { keyboardBindings: null });
  assert.equal(
    mergeLibraries(automatic, remote, { baseline: remote }).preferences.keyboardBindings,
    null,
  );
});
test('campaign capacity overflow is typed and preserves existing completed records', () => {
  const lib = emptyLibrary();
  for (let i = 0; i < LIBRARY_LIMITS.campaigns; i++) {
    const id = `archived-${i}`;
    lib.campaigns[`${id}/1/0000000000000000`] = emptyProgress({ ...campaign, id });
  }
  assert.equal(validateLibrary(lib).valid, true);
  const before = exportLibrary(lib);
  assert.throws(
    () => recordLibraryCompletion(lib, options('overflow')),
    (error) => error instanceof LibraryCapacityError && error.resource === 'campaigns',
  );
  assert.equal(exportLibrary(lib), before);
  const capacity = libraryCapacity(lib);
  assert.equal(capacity.campaigns, 512);
  assert.equal(capacity.maxCampaigns, 512);
  assert.ok(capacity.bytes > 0 && capacity.percent < 100);
});
test('gallery capacity never silently drops old completed pictures', () => {
  const lib = recordLibraryCompletion(emptyLibrary(), options('first')),
    template = lib.gallery[0];
  lib.gallery = Array.from({ length: LIBRARY_LIMITS.gallery }, (_, i) => {
    const themeId = `world-${i}`;
    return {
      ...template,
      themeId,
      key: `gallery-v1-${dataIdentity([template.campaignKey, template.levelId, themeId])}`,
    };
  });
  assert.equal(validateLibrary(lib).valid, true);
  const before = exportLibrary(lib);
  assert.throws(
    () => recordLibraryCompletion(lib, options('new-picture')),
    (error) => error instanceof LibraryCapacityError && error.resource === 'gallery',
  );
  assert.equal(exportLibrary(lib), before);
  assert.equal(libraryCapacity(lib).gallery, 4096);
  const update = recordLibraryCompletion(
    lib,
    options('improved', { themeId: 'world-0', result: { ...result(), score: result().score + 1 } }),
  );
  assert.equal(update.gallery.length, 4096);
  assert.equal(update.gallery[0].themeId, 'world-0');
});
