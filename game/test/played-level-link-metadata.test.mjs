import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexedPlayedLevelHref, playedLevelHref } from '../mission-library/played-level-link.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { readMissionLibraryHandoff } from '../mission-library/handoff.mjs';

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
const baseURL = 'https://example.test/releases/v0.151.1/site/game/index.html?journey=legacy';
const sources = () =>
  classicLibrarySources(index, {
    availability: () => {
      throw new Error('Reading a link cannot request readiness.');
    },
    launch: () => {
      throw new Error('Reading a link cannot launch a mission.');
    },
  });

test('metadata links preserve exact public Original/Current owners without preparing playable content', () => {
  const library = createMissionLibrary(sources());
  try {
    const rows = library
      .forMode('solo')
      .filter((row) => ['signal-01', 'orchard-crossing'].includes(row.runtimeId));
    assert.ok(rows.some((row) => JSON.parse(row.ownerId)[3] === 'current-line-impact.v1'));
    assert.ok(rows.some((row) => !JSON.parse(row.ownerId)[3]));
    for (const row of rows) {
      const owner = JSON.parse(row.ownerId);
      const selection = {
        mode: 'solo',
        levelId: row.runtimeId,
        campaignKey: JSON.parse(row.campaignKey)[2],
        sourcePackId: owner[2],
        rulesEdition: owner[3] || 'original',
        ownerId: row.ownerId,
        editionId: row.editionId,
      };
      const href = indexedPlayedLevelHref(index, selection, { baseURL });
      assert.equal(href, playedLevelHref(row, { baseURL }));
      assert.equal(readMissionLibraryHandoff(new URL(href).searchParams), row.id);
      assert.equal(new URL(href).pathname, '/releases/v0.151.1/site/game/');
    }
  } finally {
    library.dispose();
  }
});

test('unregistered or changed ownership cannot receive a public-looking link', () => {
  const selection = {
    mode: 'solo',
    levelId: 'local-only',
    campaignKey: 'local/1/key',
    sourcePackId: null,
    rulesEdition: 'original',
  };
  assert.throws(
    () => indexedPlayedLevelHref(index, selection, { baseURL }),
    /exact current mission edition/,
  );
  assert.throws(
    () =>
      indexedPlayedLevelHref(
        { ...index, missions: [{ ...index.missions[0], sourceFile: { bytes: 1, sha256: 'bad' } }] },
        selection,
        { baseURL },
      ),
    /metadata/,
  );
});
