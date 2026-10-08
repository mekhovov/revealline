import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionLibrary } from '../mission-library/library.mjs';
import {
  CLASSIC_SNAKE_LEVELS as entries,
  CLASSIC_SNAKE_CHAPTERS as chapters,
  CLASSIC_SNAKE_CAMPAIGNS as campaigns,
} from '../snake/classic-catalogue.mjs';
import { classicSnakeLibrarySource } from '../snake/classic-mission-library.mjs';
import { exportClassicSnakeReplay } from '../snake/classic-core.mjs';

const source = (options = {}) =>
  classicSnakeLibrarySource({ entries, chapters, campaigns, ...options });

test('Snake exposes every current level in stable chapter sections and binds exact launches', async () => {
  const launched = [],
    library = createMissionLibrary([source({ launch: (...args) => launched.push(args) })]);
  assert.equal(library.missions.length, 144);
  assert.equal(new Set(library.missions.map((row) => row.campaignKey)).size, 23);
  assert.deepEqual(
    library.missions.map((row) => row.globalLevelNumber),
    entries.map((_, i) => i + 1),
  );
  for (const mode of ['solo', 'versus', 'team']) assert.equal(library.forMode(mode).length, 144);
  const last = library.missions.at(-1);
  await library.launch(last, { mode: 'team' });
  assert.equal(launched[0][0], entries.at(-1));
  assert.equal(launched[0][1].mode, 'team');
  assert.throws(() => library.launch({ ...last }, { mode: 'solo' }), /stale/i);
  assert.equal(library.completion(last, 'solo'), null);
});

test('every schematic is a deterministic unadvanced native board with the selected seats and seed', () => {
  let seed = 17;
  const received = [],
    library = createMissionLibrary([
      source({
        getSeed: () => seed,
        records: {
          get: (identity) => {
            received.push(identity);
            return null;
          },
        },
        launch() {},
      }),
    ]);
  for (const row of library.missions) {
    const solo = library.card(row, 'solo'),
      team = library.card(row, 'team');
    assert.equal(solo.run.tick, 0);
    assert.equal(team.run.tick, 0);
    assert.equal(solo.run.snakes.length, 1);
    assert.equal(team.run.snakes.length, 2);
    assert.equal(solo.width, solo.run.level.width);
    assert.deepEqual(
      solo.run.level.walls,
      entries.find((entry) => entry.id === row.runtimeId).level.walls,
    );
    const before = exportClassicSnakeReplay(solo.run);
    assert.equal(library.card(row, 'solo'), solo);
    assert.equal(library.card(row, 'versus'), solo);
    assert.deepEqual(exportClassicSnakeReplay(solo.run), before);
    library.progressState(row, 'solo');
    assert.equal(received.at(-1).levelIdentity, solo.run.levelIdentity);
  }
  const row = library.missions[0],
    before = library.card(row, 'solo');
  seed = 42;
  const after = library.card(row, 'solo');
  assert.notEqual(before, after);
  assert.equal(after.run.seed, 42);
  assert.equal(before.run.seed, 17);
});

test('Snake cards project only exact setup ratings and localize without replacing authoritative rows', () => {
  let locale = 'en',
    pace = 'normal';
  const identities = [],
    library = createMissionLibrary([
      source({
        locale: () => locale,
        getSetup: () => ({ pace }),
        records: {
          get: (run, mode, policy) => {
            identities.push([run.levelIdentity, run.seed, mode, policy]);
            return pace === 'normal' && mode === 'solo'
              ? { clear: true, rating: { stars: 2 } }
              : null;
          },
        },
        launch() {},
      }),
    ]);
  const row = library.missions[0];
  assert.deepEqual(library.progressState(row, 'solo'), { state: 'completed', bestStars: 2 });
  assert.deepEqual(library.progressState(row, 'team'), { state: 'new', bestStars: null });
  pace = 'fast';
  assert.deepEqual(library.progressState(row, 'solo'), { state: 'new', bestStars: null });
  assert.notEqual(identities[0][0], identities.at(-1)[0]);
  locale = 'uk';
  assert.equal(library.presentation(row).name, entries[0].title.uk);
  assert.equal(library.find(row.id), row);
});

test('installed Snake packages keep their own collection and never acquire official numbers or artwork', () => {
  const library = createMissionLibrary([
    source({ entries: entries.slice(0, 2), communityIdentity: '0123456789abcdef', launch() {} }),
  ]);
  assert.equal(library.missions.length, 2);
  for (const row of library.missions) {
    assert.equal(row.collection, 'Custom');
    assert.equal(row.globalLevelNumber, null);
    assert.equal(row.editionId, '0123456789abcdef');
    assert.equal(library.completion(row, 'team'), null);
  }
});
