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

test('110 originals and 78 compatible Current-rules editions are distinct and ordered safely', () => {
  const library = createMissionLibrary(classicLibrarySources(index, adapters));
  assert.equal(library.missions.length, 188);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 188);
  assert.equal(library.forMode('solo').length, 188);
  assert.equal(library.forMode('versus').length, 188);
  assert.equal(library.forMode('team').length, 0);
  assert.equal(
    library.missions.filter((row) => library.availability(row).state === 'download').length,
    126,
  );
  assert.ok(
    library.missions.every((row) => row.tags.includes('Classic') && !row.rules.includes('Band')),
  );
});

test('Classic text names only verified mode-specific difficulty settings and never invents a Journey band', () => {
  const library = createMissionLibrary(classicLibrarySources(index, adapters));
  const row = library.missions.find((mission) => mission.edition.endsWith('Original rules'));
  assert.match(
    library.details(row, 'solo').challenge,
    /^Original authored Standard rules · 45% coverage/,
  );
  assert.equal(library.details(row, 'solo').route, 'Difficulty settings: Standard, Gentle');
  assert.equal(library.details(row, 'versus').route, 'Difficulty settings: Standard');
  assert.match(
    library.details(row, 'versus').challenge,
    /Separate Versus race timer also applies$/,
  );
  assert.doesNotMatch(library.details(row, 'solo').challenge, /race timer/);
  assert.equal(library.details(row, 'solo').mastery, '');
  assert.ok(!library.details(row, 'solo').challenge.includes('Band'));
});

test('timed Classic maps distinguish their authored clock from the separate Versus race timer', () => {
  const library = createMissionLibrary(classicLibrarySources(index, adapters));
  const row = library.missions.find((mission) => mission.name === 'Voltage Garden');
  assert(row);
  assert.match(library.details(row, 'solo').challenge, /135s/);
  assert.match(
    library.details(row, 'versus').challenge,
    /135s.*Separate Versus race timer also applies/,
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
  const source = sources.find((item) => item.edition.endsWith('Original rules')),
    original = source.entries.at(-1),
    library = createMissionLibrary(sources);
  const row = library.missions.find(
    (row) => row.runtimeId === original.levelId && row.ownerId === source.id,
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
    (value) => {
      delete value.missions[0].difficultiesByMode;
    },
    (value) => {
      value.missions[0].difficultiesByMode.solo = ['invented'];
    },
    (value) => {
      delete value.missions.find((row) => row.packId).packIdentity;
    },
  ]) {
    const value = structuredClone(index);
    mutate(value);
    assert.throws(() => prepareMissionLibraryIndex(value));
  }
  const mixed = structuredClone(index);
  mixed.missions[1].sourceFile.sha256 = 'a'.repeat(64);
  assert.throws(() => classicLibrarySources(mixed, adapters), /different source editions/);
  const artworkMixed = structuredClone(index);
  const firstPack = artworkMixed.missions.find((row) => row.packId);
  const sibling = artworkMixed.missions.find(
    (row) => row !== firstPack && row.packId === firstPack.packId,
  );
  sibling.packIdentity.sha256 = 'b'.repeat(64);
  assert.throws(() => classicLibrarySources(artworkMixed, adapters), /different source editions/);
});
