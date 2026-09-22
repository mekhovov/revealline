import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMissionLibrary } from '../mission-library/library.mjs';
import {
  classicLibrarySources,
  prepareMissionLibraryIndex,
} from '../mission-library/classic-source.mjs';

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
const adapters = {
  availability: (row) =>
    row.download ? { state: 'download', bytes: row.download.bytes } : { state: 'ready' },
  launch: () => true,
};

test('all110 indexed Classics are represented with separate original editions and real rule labels', () => {
  const library = createMissionLibrary(classicLibrarySources(index, adapters));
  assert.equal(library.missions.length, 110);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 110);
  assert.equal(library.forMode('solo').length, 110);
  assert.equal(library.forMode('versus').length, 110);
  assert.equal(library.forMode('team').length, 0);
  assert.equal(
    library.missions.filter((row) => library.availability(row).state === 'download').length,
    63,
  );
  assert.ok(
    library.missions.every((row) => row.tags.includes('Classic') && !row.rules.includes('Band')),
  );
});

test('late Classic launch hands the exact pinned metadata to its validator, without recording a clear', () => {
  let chosen;
  const sources = classicLibrarySources(index, {
    ...adapters,
    launch: (row) => {
      chosen = row;
      return true;
    },
  });
  const original = sources[0].entries.at(-1),
    library = createMissionLibrary(sources);
  const row = library.missions.find(
    (row) => row.runtimeId === original.levelId && row.ownerId === sources[0].id,
  );
  assert.equal(row.levelIndex, 11);
  assert.equal(library.progress(row, 'solo'), '');
  assert.equal(library.launch(row, { mode: 'solo' }), true);
  assert.equal(chosen, original);
  assert(Object.isFrozen(chosen));
  assert.equal(library.progress(row, 'solo'), '');
});

test('missing readiness adapter cannot promote metadata into a ready playable mission', () => {
  assert.throws(() => classicLibrarySources(index, { launch: () => true }), /host-owned/);
  const library = createMissionLibrary(
    classicLibrarySources(index, {
      availability: () => ({ state: 'unavailable', reason: 'Exact edition not installed' }),
      launch: () => assert.fail('Cannot launch'),
    }),
  );
  assert.throws(() => library.launch(library.missions[0]), /Prepare/);
});

test('bounded reader rejects duplicates, malformed metadata and mixed source editions', () => {
  for (const mutate of [
    (value) => value.missions.push(value.missions[0]),
    (value) => {
      value.missions[0].sourceFile.sha256 = 'invented';
    },
    (value) => {
      value.missions[0].modes = ['team'];
    },
  ]) {
    const value = structuredClone(index);
    mutate(value);
    assert.throws(() => prepareMissionLibraryIndex(value));
  }
  const mixed = structuredClone(index);
  mixed.missions[1].sourceFile.sha256 = 'a'.repeat(64);
  assert.throws(() => classicLibrarySources(mixed, adapters), /different source editions/);
});
