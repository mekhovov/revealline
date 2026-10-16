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
import {
  CLASSIC_RULES_CURRENT,
  CLASSIC_RULES_ORIGINAL,
  supportsClassicCurrentRules,
} from '../mission-library/classic-current-rules.mjs';

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
const adapters = {
  availability: (row) =>
    row.download ? { state: 'download', bytes: row.download.bytes } : { state: 'ready' },
  launch: () => true,
};

function classicMissionKey(row) {
  const owner = JSON.parse(row.ownerId);
  assert(Array.isArray(owner) && [3, 4].includes(owner.length));
  assert.equal(owner[0], 'classic');
  if (owner.length === 4) {
    assert.equal(owner[3], CLASSIC_RULES_CURRENT);
    owner.pop();
  }
  return JSON.stringify([owner, row.runtimeId]);
}

test('Archive retains superseded content and original rules once a current-rules edition exists', () => {
  const identity = dataIdentity(index);
  const sources = classicLibrarySources(index, adapters);
  const archivedPacks = new Set([
    'fpv-arcade',
    'fpv-arcade-r2',
    'fpv-arcade-r3',
    'fpv-arcade-r4',
    'original-fpv-pressure-external',
  ]);
  for (const source of sources) {
    const original = source.entries[0];
    const supersededRules =
      original.rulesEdition === CLASSIC_RULES_ORIGINAL && supportsClassicCurrentRules(original);
    assert.equal(
      source.lifecycle,
      original.source === 'archived' || archivedPacks.has(original.packId) || supersededRules
        ? 'archive'
        : 'current',
      original.packId,
    );
  }
  const library = createMissionLibrary(sources);
  assert.equal(library.search('', { lifecycle: 'current' }).length, 149);
  assert.equal(library.search('', { lifecycle: 'archive' }).length, 147);
  assert.equal(library.search('', { lifecycle: '' }).length, 296);
  assert.equal(
    new Set(library.search('', { lifecycle: 'current' }).map(classicMissionKey)).size,
    149,
  );
  assert.equal(dataIdentity(index), identity);
});

test('Classic dedupe collapses actual rules editions without merging unrelated mission owners', () => {
  const library = createMissionLibrary(classicLibrarySources(index, adapters));
  const projected = library.missions.filter(
    (row) => JSON.parse(row.ownerId)[3] === CLASSIC_RULES_CURRENT,
  );
  assert.equal(projected.length, 132);
  for (const row of projected) {
    const owner = JSON.parse(row.ownerId).slice(0, 3);
    const original = library.missions.find(
      (other) => other.ownerId === JSON.stringify(owner) && other.runtimeId === row.runtimeId,
    );
    assert(original, row.id);
    assert.notEqual(row.ownerId, original.ownerId);
    assert.equal(classicMissionKey(row), classicMissionKey(original));
  }
  assert.equal(new Set(library.missions.map(classicMissionKey)).size, 164);

  const current = library.search('', { lifecycle: 'current' });
  const row = current.find((item) => JSON.parse(item.ownerId)[3] === CLASSIC_RULES_CURRENT);
  const owner = JSON.parse(row.ownerId).slice(0, 3);
  const original = library.missions.find(
    (item) => item.ownerId === JSON.stringify(owner) && item.runtimeId === row.runtimeId,
  );
  const unrelated = current.find((item) => classicMissionKey(item) !== classicMissionKey(row));
  // Preserve the row count while injecting the exact duplicate the guard must catch.
  const duplicated = [...current.filter((item) => item !== unrelated), original];
  assert.equal(duplicated.length, 149);
  assert.equal(new Set(duplicated.map(classicMissionKey)).size, 148);

  for (const distinct of [
    { ...row, ownerId: JSON.stringify([owner[0], 'other-source', owner[2]]) },
    { ...row, ownerId: JSON.stringify([owner[0], owner[1], 'other-pack']) },
    { ...row, runtimeId: 'other-mission' },
  ])
    assert.notEqual(classicMissionKey(distinct), classicMissionKey(row));
  const policyNamedPack = {
    ...row,
    ownerId: JSON.stringify(['classic', owner[1], CLASSIC_RULES_CURRENT]),
  };
  assert.equal(
    classicMissionKey(policyNamedPack),
    JSON.stringify([['classic', owner[1], CLASSIC_RULES_CURRENT], row.runtimeId]),
  );
  for (const invalid of [
    ['journey', owner[1], owner[2]],
    [...owner, 'unrelated-rules'],
    [...owner, CLASSIC_RULES_CURRENT, 'extra-owner-field'],
  ])
    assert.throws(() => classicMissionKey({ ...row, ownerId: JSON.stringify(invalid) }));
});

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

test('164 originals and 132 compatible Current-rules editions are distinct and ordered safely', () => {
  const library = createMissionLibrary(classicLibrarySources(index, adapters));
  assert.equal(library.missions.length, 296);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 296);
  assert.equal(library.forMode('solo').length, 296);
  assert.equal(library.forMode('versus').length, 296);
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
