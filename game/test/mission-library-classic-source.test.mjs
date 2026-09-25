import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { contentText, isRegisteredContent } from '../i18n/content.mjs';
import { dataIdentity } from '../data-json.mjs';
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

test('Classic editions translate exact source metadata while retaining launch ownership and authored imports', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  let selected;
  const sources = classicLibrarySources(index, {
    ...adapters,
    launch: (entry) => {
      selected = entry;
      return true;
    },
  });
  const library = createMissionLibrary(sources);
  const identity = dataIdentity(index);
  const originalRows = JSON.stringify(library.missions);
  setLocale('uk', { persist: false });
  for (const original of index.missions) {
    assert.equal(isRegisteredContent(original), true, original.id);
    for (const row of library.missions.filter(
      (row) => row.runtimeId === original.levelId && row.campaignTitle === original.campaignTitle,
    )) {
      const display = library.presentation(row);
      assert.equal(display.name, contentText(original, 'name'));
      assert.equal(display.campaignTitle, contentText(original, 'campaignTitle'));
      assert.ok(display.edition.startsWith(contentText(original, 'edition') + ' · '));
      assert.doesNotMatch(
        library.details(row, 'solo').challenge,
        /coverage|lives|enemy|enemies|Manual|countdown|cells/,
      );
      assert.match(library.details(row, 'versus').challenge, /окремий таймер змагання$/);
    }
  }
  const first = library.missions.find((row) => row.runtimeId === 'signal-01');
  assert.equal(library.presentation(first).name, 'Перший сигнал');
  assert.match(library.presentation(first).edition, /^Базова гра · /);
  assert.match(library.details(first, 'solo').challenge, /45% відкрито · 3 життя · 10 кл\.\/с/);
  assert.ok(library.search('Перший сигнал', { collection: 'Classic' }).includes(first));
  assert.equal(library.launch(first, { mode: 'solo' }), true);
  assert.equal(
    selected,
    sources
      .find((source) => source.id === first.ownerId)
      .entries.find((entry) => entry.levelId === first.runtimeId),
  );
  assert.equal(dataIdentity(index), identity);
  assert.equal(JSON.stringify(library.missions), originalRows);

  const custom = structuredClone(index.missions[0]);
  custom.sourceFile.sha256 = 'a'.repeat(64);
  custom.rules = 'Authored special rules';
  const customLibrary = createMissionLibrary(
    classicLibrarySources({ ...index, missions: [custom] }, adapters),
  );
  assert.equal(isRegisteredContent(custom), false);
  for (const row of customLibrary.missions) {
    assert.equal(customLibrary.presentation(row).name, custom.name);
    assert.equal(customLibrary.presentation(row).campaignTitle, custom.campaignTitle);
    assert.ok(customLibrary.presentation(row).edition.startsWith(custom.edition));
    assert.match(customLibrary.details(row, 'solo').challenge, /Authored special rules$/);
  }
  setLocale('en', { persist: false });
  assert.equal(library.presentation(first).edition, first.edition);
  assert.ok(library.details(first, 'solo').challenge.endsWith(index.missions[0].rules));
});

test('shared lives and enemy counts use Ukrainian case agreement, including decimals', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('uk', { persist: false });
  for (const [count, lives, enemies] of [
    [0, '0 життів', '0 ворогів'],
    [1, '1 життя', '1 ворог'],
    [2, '2 життя', '2 вороги'],
    [5, '5 життів', '5 ворогів'],
    [11, '11 життів', '11 ворогів'],
    [21, '21 життя', '21 ворог'],
    [22, '22 життя', '22 вороги'],
    [1.5, '1,5 життя', '1,5 ворога'],
  ]) {
    assert.equal(t('common:counts.lives', { count }), lives);
    assert.equal(t('common:counts.enemies', { count }), enemies);
  }
});

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
