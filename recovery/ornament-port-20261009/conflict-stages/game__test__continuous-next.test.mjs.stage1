import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { librarySuccessor, retainedLibraryMission } from '../mission-library/continuous-next.mjs';

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
    retainedLibraryMission(library, { mode: 'solo', levelId: 'a', campaignKey: 'base@1' }),
    rows[2],
  );
  assert.equal(
    retainedLibraryMission(library, {
      mode: 'solo',
      levelId: 'a',
      campaignKey: 'custom@1',
      sourcePackId: 'mine',
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
test('stale, absent and ambiguous owners never silently launch a same-name replacement', () => {
  const owner = source('["classic","base",null]', 'Classic', [{ id: 'a', campaignKey: 'base@1' }]);
  const library = createMissionLibrary([owner]);
  const stale = library.missions[0];
  library.register({ ...owner, editionId: 'edition-2' });
  assert.throws(() => librarySuccessor(library, stale, 'solo'), /changed/);
  assert.throws(
    () =>
      retainedLibraryMission(library, { mode: 'solo', levelId: 'missing', campaignKey: 'base@1' }),
    /exact/,
  );
  library.register(
    source('["classic","archived",null]', 'Classic', [{ id: 'a', campaignKey: 'base@1' }]),
  );
  assert.throws(
    () => retainedLibraryMission(library, { mode: 'solo', levelId: 'a', campaignKey: 'base@1' }),
    /exact/,
  );
});
