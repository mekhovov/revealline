import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { combineJourneyLibrarySources } from '../mission-library/cross-mode-journey.mjs';

function fixture(mode, { levels = ['shared', `${mode}-only`], editionId = 'shared-v1' } = {}) {
  const catalog = createJourneyCatalog([
    {
      source: 'candidate',
      packId: 'journey-shared',
      id: 'opening',
      title: 'Opening',
      modes: [mode],
      levels: levels.map((id) => ({ id, name: 'Same name', hook: 'Choose a return lane.' })),
    },
  ]);
  const calls = [],
    profile = {
      clears: { solo: {}, versus: {}, team: {} },
      skipped: { solo: [], versus: [], team: [] },
    };
  const source = journeyLibrarySource({
    editionId,
    edition: 'New Journey',
    catalog,
    profile: { snapshot: () => profile },
    tags: () => ['Arcade'],
    details(entry, selectedMode) {
      calls.push({ method: 'details', entry, mode: selectedMode });
      return { challenge: `${mode} rules`, route: entry.hook, mastery: `${mode} mastery` };
    },
    card(entry, selectedMode) {
      calls.push({ method: 'card', entry, mode: selectedMode });
      return { original: entry, mode };
    },
    launch(entry, context) {
      calls.push({ method: 'launch', entry, context });
      return { original: entry, context };
    },
  });
  source.availability = (entry, selectedMode) => {
    calls.push({ method: 'availability', entry, mode: selectedMode });
    return { state: 'ready' };
  };
  return { mode, source, catalog, profile, calls };
}

test('mode union preserves existing opaque IDs, exact owner objects and mode-exclusive rows', () => {
  const solo = fixture('solo'),
    versus = fixture('versus');
  const original = createMissionLibrary([solo.source]);
  const combined = combineJourneyLibrarySources([solo, versus]);
  const library = createMissionLibrary([combined]);
  assert.equal(library.missions.length, 3);
  assert.equal(library.forMode('solo').length, 2);
  assert.equal(library.forMode('versus').length, 2);
  assert.equal(library.forMode('team').length, 0);
  const shared = library.missions.find((row) => row.runtimeId.endsWith('/shared'));
  assert.deepEqual(shared.modes, ['solo', 'versus']);
  assert.equal(shared.id, original.missions[0].id);
  assert.equal(library.forMode('solo')[0], library.forMode('versus')[0]);
  assert.equal(
    new Set(library.missions.map((row) => row.name)).size,
    1,
    'Names never deduplicate distinct identities.',
  );
  assert(Object.isFrozen(combined) && Object.isFrozen(combined.entries));
  assert(combined.entries.every((entry) => Object.isFrozen(entry)));
  assert(!combined.entries.includes(solo.catalog.missions[0]));
  assert(!combined.entries.includes(versus.catalog.missions[0]));
  assert.deepEqual(solo.calls, [], 'Composition does not build cards, check media or launch.');
  assert.deepEqual(versus.calls, []);
  assert.equal(Object.hasOwn(combined, 'next'), false);

  const isCurrent = () => true;
  for (const owner of [solo, versus]) {
    const result = library.launch(shared, { mode: owner.mode, isCurrent });
    assert.equal(result.original, owner.catalog.missions[0]);
    assert.equal(result.context.mode, owner.mode);
    assert.equal(result.context.libraryMissionId, shared.id);
    assert.equal(result.context.isCurrent, isCurrent);
  }
  const exclusive = library.missions.find((row) => row.runtimeId.endsWith('/solo-only'));
  assert.throws(() => library.launch(exclusive, { mode: 'versus' }), /does not support/);
  assert.throws(() => library.launch({ ...shared }, { mode: 'solo' }), /stale/);
});

test('details, lazy cards and progress remain independent for each qualified mode', () => {
  const solo = fixture('solo'),
    versus = fixture('versus');
  const library = createMissionLibrary([combineJourneyLibrarySources([solo, versus])]);
  const shared = library.missions[0];
  solo.profile.clears.solo[solo.catalog.missions[0].id] = {};
  versus.profile.skipped.versus.push(versus.catalog.missions[0].id);
  assert.equal(library.progress(shared, 'solo'), 'Cleared');
  assert.equal(library.progress(shared, 'versus'), 'Skipped · try again');
  assert.equal(library.details(shared, 'solo').challenge, 'solo rules');
  assert.equal(library.details(shared, 'versus').challenge, 'versus rules');
  assert.equal(library.card(shared, 'solo').original, solo.catalog.missions[0]);
  assert.equal(library.card(shared, 'versus').original, versus.catalog.missions[0]);
  for (const owner of [solo, versus])
    for (const call of owner.calls) {
      assert.equal(call.entry, owner.catalog.missions[0]);
      assert.equal(call.mode, owner.mode);
    }
});

test('availability and preparation are delegated to the selected mode without preparing its sibling', async () => {
  const solo = fixture('solo'),
    versus = fixture('versus');
  let prepared = false,
    received;
  versus.source.availability = () =>
    prepared ? { state: 'ready' } : { state: 'download', bytes: 42 };
  versus.source.prepare = async (entry, context) => {
    received = { entry, context };
    prepared = true;
  };
  const library = createMissionLibrary([combineJourneyLibrarySources([solo, versus])]);
  const shared = library.missions[0];
  assert.equal(library.availability(shared, 'solo').state, 'ready');
  assert.equal(library.availability(shared, 'versus').state, 'download');
  const result = await library.prepare(shared, { mode: 'versus' });
  assert.equal(result.state, 'ready');
  assert.equal(received.entry, versus.catalog.missions[0]);
  assert.equal(received.context.mode, 'versus');
  assert(received.context.signal instanceof AbortSignal);
  assert(!solo.calls.some((call) => call.method === 'launch'));
});

test('forged display bindings, unsupported modes and mismatched launch context fail closed', () => {
  const solo = fixture('solo'),
    versus = fixture('versus');
  const combined = combineJourneyLibrarySources([solo, versus]);
  const entry = combined.entries[0];
  for (const fake of [{}, { ...entry }, solo.catalog.missions[0], null]) {
    assert.throws(() => combined.describe(fake), /Unknown.*binding/);
    assert.throws(() => combined.card(fake, 'solo'), /Unknown.*binding/);
    assert.throws(() => combined.launch(fake, { mode: 'solo' }), /Unknown.*binding/);
  }
  assert.throws(() => combined.launch(entry, { mode: 'team' }), /no qualified source/);
  assert.throws(() => combined.launch(entry, {}), /no qualified source/);
  assert.throws(
    () => combined.launch(entry, { mode: 'solo', libraryMissionId: 'another' }),
    /another display mission/,
  );
  assert.throws(() => combined.prepare(entry, { mode: 'solo' }), /cannot prepare/);
  assert.deepEqual(solo.calls, []);
  assert.deepEqual(versus.calls, []);
});

test('one exact mission cannot silently acquire different display metadata in another mode', () => {
  for (const [key, value] of [
    ['name', 'Changed name'],
    ['campaignTitle', 'Changed campaign'],
    ['levelIndex', 9],
    ['hook', 'Different route'],
    ['rules', 'Different rules'],
    ['tags', ['FPV']],
  ]) {
    const solo = fixture('solo'),
      versus = fixture('versus');
    const describe = versus.source.describe;
    versus.source.describe = (entry) => ({ ...describe(entry), [key]: value });
    assert.throws(() => combineJourneyLibrarySources([solo, versus]), /metadata differs/, key);
  }
});

test('different revisions keep separate display identities instead of merging by mission name', () => {
  const solo = fixture('solo', { levels: ['shared'] }),
    versus = fixture('versus', { levels: ['shared'] });
  for (const [owner, revision] of [
    [solo, 'r1'],
    [versus, 'r2'],
  ]) {
    const describe = owner.source.describe;
    owner.source.describe = (entry) => ({ ...describe(entry), revision });
  }
  const library = createMissionLibrary([combineJourneyLibrarySources([solo, versus])]);
  assert.equal(library.missions.length, 2);
  assert.notEqual(library.missions[0].id, library.missions[1].id);
  assert.deepEqual(
    library.missions.map((row) => row.modes),
    [['solo'], ['versus']],
  );
});

test('invalid qualification, duplicate owners, editions and mission identities are rejected', () => {
  const solo = fixture('solo');
  assert.throws(() => combineJourneyLibrarySources([]), /one to three/);
  assert.throws(() => combineJourneyLibrarySources([solo, solo]), /one source/);
  assert.throws(() => combineJourneyLibrarySources([{ ...solo, mode: 'versus' }]), /declared mode/);
  assert.throws(
    () => combineJourneyLibrarySources([solo, fixture('versus', { editionId: 'another' })]),
    /same exact edition/,
  );
  assert.throws(
    () =>
      combineJourneyLibrarySources([
        { ...solo, source: { ...solo.source, collection: 'Classic' } },
      ]),
    /Only validated Journey/,
  );
  assert.throws(
    () =>
      combineJourneyLibrarySources([
        {
          ...solo,
          source: { ...solo.source, entries: [solo.source.entries[0], solo.source.entries[0]] },
        },
      ]),
    /duplicate exact mission/,
  );
  const combined = combineJourneyLibrarySources([solo]);
  const originalLaunch = solo.source.launch;
  solo.source.launch = () => {
    throw new Error('Changed after composition');
  };
  assert.equal(
    combined.launch(combined.entries[0], { mode: 'solo' }).original,
    solo.catalog.missions[0],
  );
  assert.notEqual(
    solo.source.launch,
    originalLaunch,
    'The combined owner captured its original adapter.',
  );
});
