import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionLibrary, libraryMissionId } from '../mission-library/library.mjs';

const entry = (id = 'shared-name', modes = ['solo', 'versus']) => ({
  id,
  campaignKey: 'campaign/revision/fingerprint',
  campaignTitle: 'Original campaign',
  name: 'Shared name',
  levelIndex: 8,
  modes,
  tags: ['Arcade'],
  rules: '65% · 3 lives',
});
function source(overrides = {}) {
  return {
    id: 'original',
    editionId: 'edition-1',
    edition: 'Original edition',
    collection: 'Classic',
    entries: [entry()],
    describe: (value) => value,
    availability: () => ({ state: 'ready' }),
    launch: () => true,
    ...overrides,
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('archiving is a browsing filter and preserves exact launch, progress and content identities', () => {
  const original = Object.freeze(entry());
  let launched;
  const current = source({ entries: [original], launch: (value) => (launched = value) });
  const library = createMissionLibrary([current]);
  const before = library.missions[0];
  library.register({ ...current, lifecycle: 'archive' });
  const archived = library.missions[0];
  for (const key of ['id', 'ownerId', 'editionId', 'campaignKey', 'runtimeId'])
    assert.equal(archived[key], before[key], key);
  assert.deepEqual(library.search('', { lifecycle: 'current' }), []);
  assert.deepEqual(library.search('', { lifecycle: 'archive' }), [archived]);
  assert.deepEqual(library.search('', { lifecycle: '' }), [archived]);
  library.launch(archived, { mode: 'solo' });
  assert.equal(launched, original);
  assert.equal(library.progress(archived, 'solo'), '');
  assert.throws(() => library.register({ ...current, lifecycle: 'removed' }), /lifecycle/);
  assert.equal(library.find(archived.id), archived);
  assert.throws(() => library.search('', { lifecycle: 'removed' }), /filter/);
});

test('All orders Journey, Classic and Custom, preserving each owner authored order', () => {
  const library = createMissionLibrary([
    source({ id: 'custom', collection: 'Custom' }),
    source({ entries: [entry('last'), entry('first')] }),
    source({ id: 'new', collection: 'Journey' }),
  ]);
  assert.deepEqual(
    library.missions.map((row) => row.collection),
    ['Journey', 'Classic', 'Classic', 'Custom'],
  );
  assert.deepEqual(
    library.missions.slice(1, 3).map((row) => row.runtimeId),
    ['last', 'first'],
  );
  assert.equal(library.next, undefined, 'Browsing must not provide combined progression.');
});

test('same names and runtime IDs in different editions/owners remain distinct', () => {
  const library = createMissionLibrary([
    source(),
    source({ id: 'archive', editionId: 'edition-0' }),
  ]);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 2);
  assert.notEqual(library.missions[0].campaignKey, library.missions[1].campaignKey);
  const parts = { owner: 'a/b', edition: 'c', campaign: 'd', mission: 'e' };
  assert.notEqual(
    libraryMissionId(parts),
    libraryMissionId({ ...parts, owner: 'a', edition: 'b/c' }),
  );
});

test('search covers edition, campaign, tags and rules; filters are mode-aware', () => {
  const library = createMissionLibrary([
    source(),
    source({ id: 'team', collection: 'Journey', entries: [entry('coop', ['team'])] }),
  ]);
  assert.equal(library.search('original arcade 65%').length, 1);
  assert.equal(library.search('', { mode: 'team' }).length, 1);
  assert.equal(library.search('', { collection: 'Custom' }).length, 0);
  assert.equal(library.search('', { campaign: library.missions[1].campaignKey }).length, 1);
  assert.throws(() => library.search('', { mode: 'online' }));
});

test('translated presentation is searchable without changing row identity or launch content', () => {
  const original = Object.freeze(entry());
  let language = 'en',
    launched;
  const library = createMissionLibrary([
    source({
      entries: [original],
      presentation: () =>
        language === 'uk' ? { name: 'Спільна назва', campaignTitle: 'Початкова кампанія' } : {},
      launch: (value) => {
        launched = value;
        return true;
      },
    }),
  ]);
  const row = library.missions[0];
  const before = JSON.stringify(row);
  language = 'uk';
  assert.equal(library.presentation(row).name, 'Спільна назва');
  assert.deepEqual(library.search('спільна початкова'), [row]);
  assert.deepEqual(library.search('Shared name'), [row]);
  assert.equal(library.launch(row), true);
  assert.equal(launched, original);
  assert.equal(JSON.stringify(row), before);
  language = 'en';
  assert.equal(library.presentation(row).name, original.name);
  assert.equal(library.missions[0], row);
});

test('late mission launches exact original object without inventing clears or modifying it', () => {
  const original = Object.freeze(entry());
  let launched;
  const library = createMissionLibrary([
    source({
      entries: [original],
      launch: (value, context) => {
        launched = { value, context };
      },
    }),
  ]);
  const row = library.missions[0];
  assert.equal(library.progress(row, 'solo'), '');
  library.launch(row, { mode: 'solo' });
  assert.equal(launched.value, original);
  assert.equal(launched.context.mode, 'solo');
  assert.equal(library.progress(row, 'solo'), '');
  assert.throws(() => library.launch({ ...row }), /stale/);
  assert.throws(() => library.launch(row, { mode: 'team' }), /support/);
});

test('metadata cannot manufacture ready state, an exact installed replacement invalidates old rows', () => {
  const library = createMissionLibrary([
    source({ availability: () => ({ state: 'download', bytes: 1234 }) }),
  ]);
  const old = library.missions[0];
  assert.throws(() => library.launch(old), /Prepare/);
  library.register(source());
  assert.equal(library.missions.length, 1);
  assert.equal(library.missions[0].id, old.id);
  assert.equal(library.find(old.id), library.missions[0]);
  assert.notEqual(library.find(old.id), old);
  assert.throws(() => library.launch(old), /stale/);
  assert.equal(library.launch(library.missions[0]), true);
});

test('identity and mode indexes track accepted owner removal and disposal', () => {
  const library = createMissionLibrary([
    source(),
    source({ id: 'team', collection: 'Journey', entries: [entry('coop', ['team'])] }),
  ]);
  const classic = library.missions.find((row) => row.ownerId === 'original'),
    team = library.missions.find((row) => row.ownerId === 'team');
  assert.equal(library.find(classic.id), classic);
  assert.equal(library.find(team.id), team);
  assert.deepEqual(library.forMode('solo'), [classic]);
  assert.deepEqual(library.forMode('team'), [team]);
  assert.equal(library.remove('original'), true);
  assert.equal(library.find(classic.id), null);
  assert.deepEqual(library.forMode('solo'), []);
  assert.deepEqual(library.forMode('team'), [team]);
  library.dispose();
  assert.equal(library.find(team.id), null);
  assert.deepEqual(library.forMode('team'), []);
});

test('reject duplicate source rows atomically without invalidating accepted content', () => {
  const library = createMissionLibrary([source()]);
  const old = library.missions[0];
  assert.throws(() => library.register(source({ entries: [entry(), entry()] })), /duplicate/);
  assert.equal(library.missions[0], old);
  assert.equal(library.launch(old), true);
});

test('prepare reports a bounded download, becomes Play-ready, and never launches automatically', async () => {
  let ready = false,
    launches = 0,
    finish;
  const library = createMissionLibrary([
    source({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 200 }),
      prepare: () =>
        new Promise((resolve) => {
          finish = () => {
            ready = true;
            resolve();
          };
        }),
      launch: () => launches++,
    }),
  ]);
  const row = library.missions[0];
  const result = library.prepare(row);
  assert.equal(library.availability(row).state, 'preparing');
  assert.throws(() => library.launch(row), /Prepare/);
  await tick();
  finish();
  assert.deepEqual(await result, { state: 'ready' });
  assert.equal(launches, 0);
  library.launch(row);
  assert.equal(launches, 1);
});

test('download failure exposes reason and retry, retaining original row and progress', async () => {
  let calls = 0,
    ready = false;
  const library = createMissionLibrary([
    source({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 200 }),
      progress: () => 'Cleared',
      prepare: async () => {
        if (!calls++) throw new Error('Offline');
        ready = true;
      },
    }),
  ]);
  const row = library.missions[0];
  await assert.rejects(library.prepare(row), /Offline/);
  assert.deepEqual(library.availability(row), {
    state: 'unavailable',
    reason: 'Offline',
    retry: true,
  });
  await library.prepare(row);
  assert.equal(library.availability(row).state, 'ready');
  assert.equal(library.progress(row), 'Cleared');
  assert.equal(library.missions[0], row);
});

test('cancel settles immediately even if a transport ignores AbortSignal; a late failure cannot revive error', async () => {
  let fail, transportSignal;
  const library = createMissionLibrary([
    source({
      availability: () => ({ state: 'download', bytes: 200 }),
      prepare: (_, { signal }) => {
        transportSignal = signal;
        return new Promise((_, reject) => {
          fail = reject;
        });
      },
    }),
  ]);
  const row = library.missions[0];
  const operation = library.prepare(row);
  await tick();
  library.cancel(row);
  assert.equal(transportSignal.aborted, true);
  assert.deepEqual(await operation, { state: 'cancelled' });
  fail(new Error('Late failure'));
  await tick();
  assert.deepEqual(library.availability(row), { state: 'download', bytes: 200 });
});

test('owner replacement cancels preparations and rejects stale selection without merging modified Custom', async () => {
  const library = createMissionLibrary([
    source({
      availability: () => ({ state: 'download', bytes: 200 }),
      prepare: () => new Promise(() => {}),
    }),
  ]);
  const old = library.missions[0],
    operation = library.prepare(old);
  await tick();
  library.register(source());
  library.register(source({ id: 'import-modified', collection: 'Custom' }));
  assert.deepEqual(await operation, { state: 'cancelled' });
  assert.equal(library.missions.length, 2);
  assert.throws(() => library.launch(old), /stale/);
});

test('aborted external signal never starts preparation and disposed registry never launches', async () => {
  let calls = 0;
  const library = createMissionLibrary([
    source({
      availability: () => ({ state: 'download', bytes: 200 }),
      prepare: () => calls++,
    }),
  ]);
  const row = library.missions[0],
    controller = new AbortController();
  controller.abort();
  assert.deepEqual(await library.prepare(row, { signal: controller.signal }), {
    state: 'cancelled',
  });
  assert.equal(calls, 0);
  library.dispose();
  assert.throws(() => library.launch(row), /stale/);
  assert.equal(library.missions.length, 0);
});

test('availability never silently invents readiness or download sizes', () => {
  const library = createMissionLibrary([
    source({ availability: () => ({ state: 'download', bytes: 0 }) }),
  ]);
  assert.throws(() => library.availability(library.missions[0]), /byte size/);
  assert.throws(
    () => createMissionLibrary([source({ entries: [entry('bad', ['online'])] })]),
    /supported modes/,
  );
});

test('reentrant availability reconciliation cannot launch or prepare a stale owner', async () => {
  for (const action of ['launch', 'prepare']) {
    let calls = 0;
    const library = createMissionLibrary();
    library.register(
      source({
        availability: () => {
          library.register(source());
          return action === 'launch' ? { state: 'ready' } : { state: 'download', bytes: 200 };
        },
        launch: () => calls++,
        prepare: () => calls++,
      }),
    );
    const original = library.missions[0];
    if (action === 'launch') assert.throws(() => library.launch(original), /stale/);
    else await assert.rejects(library.prepare(original), /stale/);
    assert.equal(calls, 0);
  }
});

test('Solo preparation and failure cannot poison a ready Versus mission', async () => {
  let reject;
  const library = createMissionLibrary([
    source({
      availability: (_, mode) =>
        mode === 'versus' ? { state: 'ready' } : { state: 'download', bytes: 200 },
      prepare: () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    }),
  ]);
  const row = library.missions[0];
  const operation = library.prepare(row, { mode: 'solo' });
  await tick();
  assert.equal(library.availability(row, 'solo').state, 'preparing');
  assert.equal(library.availability(row, 'versus').state, 'ready');
  reject(new Error('Solo preparation failed'));
  await assert.rejects(operation, /Solo preparation failed/);
  assert.equal(library.availability(row, 'solo').state, 'unavailable');
  assert.equal(library.availability(row, 'versus').state, 'ready');
  assert.equal(library.launch(row, { mode: 'versus' }), true);
});

for (const count of [0, 1, 32]) {
  test(`initial ${count}-source construction builds indexes once and later mutations remain observable`, (t) => {
    const collections = ['Custom', 'Journey', 'Classic'];
    const described = [];
    const sources = Array.from({ length: count }, (_, index) =>
      source({
        id: `owner-${index}`,
        collection: collections[index % collections.length],
        entries: Array.from({ length: 2 }, (_, position) => ({
          ...entry(`mission-${index}-${position}`, position ? ['team'] : ['solo', 'versus']),
          levelIndex: position,
          canonicalLevelKey: `canonical-${index}-${position}`,
          globalLevelNumber: 2 * index + position + 1,
        })),
        describe(value) {
          described.push(value);
          return value;
        },
        launch: (value) => value,
      }),
    );
    const orderedSources = [...sources].sort(
      (a, b) =>
        ['Journey', 'Classic', 'Custom'].indexOf(a.collection) -
        ['Journey', 'Classic', 'Custom'].indexOf(b.collection),
    );
    const expected = orderedSources.flatMap((owner) =>
      owner.entries.map((value) => ({ owner, value })),
    );
    const nativeSort = Array.prototype.sort;
    let sorts = 0;
    const sort = t.mock.method(Array.prototype, 'sort', function (compare) {
      sorts++;
      return nativeSort.call(this, compare);
    });
    let library;
    try {
      library = createMissionLibrary(sources);
    } finally {
      sort.mock.restore();
    }
    try {
      assert.equal(sorts, count ? 1 : 0, 'Only final construction publishes sorted indexes');
      assert.deepEqual(
        described,
        sources.flatMap((owner) => owner.entries),
      );
      assert.equal(library.missions.length, expected.length);
      expected.forEach(({ owner, value }, index) => {
        const row = library.missions[index];
        assert.equal(row.ownerId, owner.id);
        assert.equal(row.runtimeId, value.id);
        assert.equal(library.find(row.id), row);
        assert.equal(library.launch(row, { mode: value.modes[0] }), value);
      });
      for (const mode of ['solo', 'versus', 'team']) {
        const rows = library.missions.filter((row) => row.modes.includes(mode));
        assert.deepEqual(library.forMode(mode), rows);
        assert.deepEqual(library.search('', { mode }), rows);
      }

      let notifications = 0;
      library.subscribe(() => {
        notifications++;
        for (const row of library.missions) assert.equal(library.find(row.id), row);
        for (const mode of ['solo', 'versus', 'team']) {
          assert.deepEqual(
            library.forMode(mode),
            library.missions.filter((row) => row.modes.includes(mode)),
          );
        }
      });
      const extra = source({ id: 'later', entries: [entry('later', ['team'])] });
      library.register(extra);
      const old = library.missions.find((row) => row.ownerId === extra.id);
      assert.equal(notifications, 1);
      library.register({ ...extra, entries: [entry('replacement', ['solo'])] });
      assert.equal(notifications, 2);
      assert.equal(library.find(old.id), null);
      assert.throws(() => library.launch(old, { mode: 'team' }), /stale/);
      assert.equal(library.remove(extra.id), true);
      assert.equal(notifications, 3);
      assert.equal(library.missions.length, expected.length);
    } finally {
      library?.dispose();
    }
  });
}

test('initial duplicate owners replace in place without changing authored collection order', () => {
  const first = source({ id: 'first', entries: [entry('old')] });
  const second = source({ id: 'second', entries: [entry('second')] });
  const replacement = { ...first, entries: [entry('new')], launch: (value) => value };
  const library = createMissionLibrary([first, second, replacement]);
  try {
    assert.deepEqual(
      library.missions.map((row) => [row.ownerId, row.runtimeId]),
      [
        ['first', 'new'],
        ['second', 'second'],
      ],
    );
    const row = library.missions[0];
    assert.equal(library.find(row.id), row);
    assert.equal(library.launch(row), replacement.entries[0]);
  } finally {
    library.dispose();
  }
});

test('initial numbering conflicts fail before later owners can conceal an invalid prefix', () => {
  let laterDescriptions = 0;
  const numbered = (id, key, number = 1) =>
    source({
      id,
      entries: [{ ...entry(id), canonicalLevelKey: key, globalLevelNumber: number }],
    });
  assert.throws(
    () =>
      createMissionLibrary([
        numbered('first', 'first-key'),
        numbered('second', 'conflicting-key'),
        {
          ...numbered('second', 'second-key', 2),
          describe(value) {
            laterDescriptions++;
            return value;
          },
        },
      ]),
    /Official level number/,
  );
  assert.equal(laterDescriptions, 0, 'A later replacement cannot mask an earlier conflict');

  const shared = createMissionLibrary([
    numbered('solo', 'same-canonical'),
    numbered('team', 'same-canonical'),
  ]);
  try {
    assert.equal(
      shared.missions.length,
      2,
      'The same canonical mission can share its official number',
    );
    assert(shared.missions.every((row) => shared.find(row.id) === row));
  } finally {
    shared.dispose();
  }
});

test('initial row and capacity failures stop before later source adapters run', () => {
  for (const invalid of [
    [source({ entries: [entry(), entry()] })],
    [source({ entries: [entry('bad', ['online'])] })],
    [
      source({
        entries: Array.from({ length: 4096 }, (_, index) => ({
          ...entry(String(index)),
          levelIndex: index,
        })),
      }),
      source({ id: 'overflow' }),
    ],
  ]) {
    let laterDescriptions = 0;
    assert.throws(() =>
      createMissionLibrary([
        ...invalid,
        source({
          id: 'later',
          describe(value) {
            laterDescriptions++;
            return value;
          },
        }),
      ]),
    );
    assert.equal(laterDescriptions, 0);
  }
});
