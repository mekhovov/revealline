import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { librarySuccessor, retainedLibraryMission } from '../mission-library/continuous-next.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import {
  CLASSIC_RULES_CURRENT,
  CLASSIC_RULES_ORIGINAL,
  classicRulesCampaignIdentity,
} from '../mission-library/classic-current-rules.mjs';

function source(id, collection, missions, editionId = 'edition-1') {
  return {
    id,
    collection,
    editionId,
    edition: editionId,
    entries: missions,
    describe: (row) => ({
      levelIndex: missions.indexOf(row),
      ...row,
      name: 'Same name',
      campaignTitle: row.campaignKey,
      modes: row.modes ?? ['solo', 'versus'],
      rules: 'Authored',
    }),
    availability: () => ({ state: 'ready' }),
    launch: (row) => row,
  };
}
test('Next crosses campaigns, packs and collections without using filters or completion', () => {
  const library = createMissionLibrary([
    source('journey:j', 'Journey', [
      { id: 'a', campaignKey: 'c1' },
      { id: 'b', campaignKey: 'c2' },
    ]),
    source('["classic","base",null]', 'Classic', [{ id: 'a', campaignKey: 'base@1' }]),
    source('["custom","mine"]', 'Custom', [{ id: 'a', campaignKey: 'custom@1' }]),
  ]);
  const rows = library.forMode('solo');
  for (let i = 0; i < rows.length - 1; i++)
    assert.equal(librarySuccessor(library, rows[i], 'solo'), rows[i + 1]);
  assert.equal(librarySuccessor(library, rows.at(-1), 'solo'), null);
  assert.equal(
    retainedLibraryMission(library, {
      mode: 'solo',
      levelId: 'a',
      campaignKey: 'base@1',
      rulesEdition: 'original',
    }),
    rows[2],
  );
  assert.equal(
    retainedLibraryMission(library, {
      mode: 'solo',
      levelId: 'a',
      campaignKey: 'custom@1',
      sourcePackId: 'mine',
      rulesEdition: 'original',
    }),
    rows[3],
  );
});
test('Next stays in the current mode and retains an unavailable successor for explicit retry', () => {
  const owner = source('journey:j', 'Journey', [
    { id: 'a', campaignKey: 'c1', modes: ['solo'] },
    { id: 'b', campaignKey: 'c2', modes: ['team'] },
    { id: 'c', campaignKey: 'c3', modes: ['solo'] },
  ]);
  owner.availability = (row) =>
    row.id === 'c'
      ? { state: 'unavailable', reason: 'Download failed', retry: true }
      : { state: 'ready' };
  const library = createMissionLibrary([owner]);
  assert.equal(librarySuccessor(library, library.missions[0], 'solo'), library.missions[2]);
  assert.throws(() => librarySuccessor(library, library.missions[0], 'team'), /mode/);
  assert.equal(librarySuccessor(library, library.missions[1], 'team'), null);
});
test('Classic Next retains Current or Original rules across owners before leaving the collection', () => {
  const current = 'current-line-impact.v1';
  const library = createMissionLibrary([
    source(`["classic","base",null,"${current}"]`, 'Classic', [
      { id: 'current-a', campaignKey: 'base-current' },
    ]),
    source('["classic","base",null]', 'Classic', [
      { id: 'original-a', campaignKey: 'base-original' },
    ]),
    source(`["classic","optional","pack","${current}"]`, 'Classic', [
      { id: 'current-b', campaignKey: 'pack-current' },
    ]),
    source('["classic","optional","pack"]', 'Classic', [
      { id: 'original-b', campaignKey: 'pack-original' },
    ]),
    source('["custom","mine"]', 'Custom', [{ id: 'custom-a', campaignKey: 'custom' }]),
  ]);
  const [currentA, originalA, currentB, originalB, custom] = library.forMode('solo');
  assert.equal(librarySuccessor(library, currentA, 'solo'), currentB);
  assert.equal(librarySuccessor(library, originalA, 'solo'), originalB);
  assert.equal(librarySuccessor(library, currentB, 'solo'), custom);
  assert.equal(librarySuccessor(library, originalB, 'solo'), custom);
});
test('Classic Next accepts an opaque Team owner as original rules without parsing provenance', () => {
  const library = createMissionLibrary([
    source('team-classic:relay-rescue-starter', 'Classic', [
      { id: 'team-a', campaignKey: 'team-classic', modes: ['team'] },
    ]),
    source('custom:team-visit', 'Custom', [
      { id: 'custom-a', campaignKey: 'team-custom', modes: ['team'] },
    ]),
  ]);
  assert.equal(
    librarySuccessor(library, library.forMode('team')[0], 'team'),
    library.forMode('team')[1],
  );
});
test('retained production identities preserve Current, Original and Custom in Solo and Versus', () => {
  const indexedMission = {
    id: 'classic/base/base/first-signal/same/1',
    source: 'base',
    packId: null,
    campaignId: 'first-signal',
    campaignRevision: '2',
    campaignKey: 'first-signal/2/verified',
    levelId: 'same',
    levelRevision: '1',
    levelIndex: 0,
    name: 'Same name',
    campaignTitle: 'First Signal',
    edition: 'Base game',
    themeId: null,
    modes: ['solo', 'versus'],
    tags: ['Classic'],
    rules: 'Authored',
    ruleDetails: {
      ruleset: 'xonix-core.v5',
      coverage: 0.45,
      lives: 3,
      moveSpeed: 10,
      timeLimitSeconds: 0,
      enemies: [],
      requiredObjectives: 0,
    },
    difficultiesByMode: { solo: ['standard'], versus: ['standard'] },
    sourceFile: { path: 'game/content/campaign.json', bytes: 1, sha256: 'a'.repeat(64) },
  };
  const library = createMissionLibrary([
    ...classicLibrarySources(
      { format: 'revealline-mission-library-index.v1', missions: [indexedMission] },
      { availability: () => ({ state: 'ready' }), launch: () => true },
    ),
    source(
      '["custom","mine"]',
      'Custom',
      [{ id: 'same', campaignKey: 'custom@1' }],
      'custom-edition',
    ),
  ]);
  const currentCampaignKey = classicRulesCampaignIdentity({
    campaignKey: indexedMission.campaignKey,
    rulesEdition: CLASSIC_RULES_CURRENT,
  });
  const originalCampaignKey = classicRulesCampaignIdentity({
    campaignKey: indexedMission.campaignKey,
    rulesEdition: CLASSIC_RULES_ORIGINAL,
  });
  for (const mode of ['solo', 'versus']) {
    const rows = library.forMode(mode);
    const currentRow = rows.find(
      (row) =>
        row.collection === 'Classic' &&
        row.ownerId === JSON.stringify(['classic', 'base', null, CLASSIC_RULES_CURRENT]),
    );
    const originalRow = rows.find(
      (row) =>
        row.collection === 'Classic' && row.ownerId === JSON.stringify(['classic', 'base', null]),
    );
    const customRow = rows.find((row) => row.collection === 'Custom');
    assert.equal(
      retainedLibraryMission(library, {
        mode,
        levelId: 'same',
        campaignKey: currentCampaignKey,
        rulesEdition: CLASSIC_RULES_CURRENT,
      }),
      currentRow,
    );
    assert.equal(
      retainedLibraryMission(library, {
        mode,
        levelId: 'same',
        campaignKey: originalCampaignKey,
        rulesEdition: CLASSIC_RULES_ORIGINAL,
      }),
      originalRow,
    );
    assert.equal(
      retainedLibraryMission(library, {
        mode,
        levelId: 'same',
        campaignKey: 'custom@1',
        sourcePackId: 'mine',
        ownerId: customRow.ownerId,
        editionId: customRow.editionId,
        rulesEdition: CLASSIC_RULES_ORIGINAL,
      }),
      customRow,
    );
    assert.throws(
      () =>
        retainedLibraryMission(library, {
          mode,
          levelId: 'same',
          campaignKey: originalCampaignKey,
          rulesEdition: CLASSIC_RULES_CURRENT,
        }),
      /exact/,
    );
    assert.throws(
      () =>
        retainedLibraryMission(library, {
          mode,
          levelId: 'same',
          campaignKey: originalCampaignKey,
        }),
      /rules edition/,
    );
    assert.throws(
      () =>
        retainedLibraryMission(library, {
          mode,
          levelId: 'same',
          campaignKey: originalCampaignKey,
          rulesEdition: 'future-rules',
        }),
      /rules edition/,
    );
    assert.throws(
      () =>
        retainedLibraryMission(library, {
          mode,
          levelId: 'same',
          campaignKey: currentCampaignKey,
          rulesEdition: CLASSIC_RULES_CURRENT,
          ownerId: originalRow.ownerId,
        }),
      /exact/,
    );
  }
});
test('stale, absent and ambiguous owners never silently launch a same-name replacement', () => {
  const owner = source('["classic","base",null]', 'Classic', [{ id: 'a', campaignKey: 'base@1' }]);
  const library = createMissionLibrary([owner]);
  const stale = library.missions[0];
  library.register({ ...owner, editionId: 'edition-2' });
  assert.throws(() => librarySuccessor(library, stale, 'solo'), /changed/);
  assert.throws(
    () =>
      retainedLibraryMission(library, {
        mode: 'solo',
        levelId: 'missing',
        campaignKey: 'base@1',
        rulesEdition: 'original',
      }),
    /exact/,
  );
  library.register(
    source('["classic","archived",null]', 'Classic', [{ id: 'a', campaignKey: 'base@1' }]),
  );
  assert.throws(
    () =>
      retainedLibraryMission(library, {
        mode: 'solo',
        levelId: 'a',
        campaignKey: 'base@1',
        rulesEdition: 'original',
      }),
    /exact/,
  );
});
