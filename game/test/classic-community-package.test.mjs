import { createClassicSnakeRecords } from '../snake/classic-records.mjs';
import {
  createClassicSnakeMatch,
  exportClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  queueClassicSnakeMatchTurn,
} from '../snake/classic-match.mjs';
// Authored boundary regressions; suites remain explicitly waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  validateClassicSnakePackage,
  classicSnakePackageEntries,
  exportClassicSnakePackage,
  importClassicSnakePackage,
} from '../snake/classic-community.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createCommunityClassicInstalled } from '../community/classic-installed.mjs';
import { createCommunityLibrary } from '../community/library.mjs';
import { createMemoryCommunityDownloadStore } from '../community/download-store.mjs';
import { createMemoryCommunityStateStore } from '../community/state.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
const packageSource = () => {
  const source = CLASSIC_SNAKE_LEVELS.find((row) => row.id === 'classic-living-shield-window');
  return {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: 'Shield workshop', uk: 'Майстерня щитів' },
    entries: [
      {
        title: source.title,
        description: source.description,
        level: structuredClone(source.level),
      },
    ],
  };
};
test('portable content cannot impersonate official recipes or introduce executable actor policies', async () => {
  const source = packageSource(),
    pack = validateClassicSnakePackage(source),
    entries = classicSnakePackageEntries(pack);
  assert.match(entries[0].id, /^custom-snake-[a-f0-9]{16}-1$/);
  assert.notEqual(entries[0].id, source.entries[0].level.id);
  assert.deepEqual(await importClassicSnakePackage(exportClassicSnakePackage(pack)), pack);
  const tampered = structuredClone(source);
  tampered.entries[0].level.targets.required[0].script = 'alert(1)';
  assert.throws(() => validateClassicSnakePackage(tampered));
});
test('family dispatch preserves exact valid UTF-8 bytes and rejects unknown formats', async () => {
  const blob = new Blob([JSON.stringify(packageSource(), null, 2)]),
    inspected = await inspectCommunityPackage(blob);
  assert.equal(inspected.family, 'classic');
  assert.equal(inspected.missions, 1);
  assert.equal(inspected.editionId, await creatorSHA256(await blob.arrayBuffer()));
  await assert.rejects(() => inspectCommunityPackage(new Blob(['{"format":"unknown"}'])));
});
test('Classic community install, recovery removal, offload and reinstall retain exact recipe identity', async (t) => {
  const model = memoryIndexedDB(),
    classicInstalled = createCommunityClassicInstalled({ indexedDB: model.indexedDB });
  const creatorStore = createCreatorStore({ indexedDB: model.indexedDB });
  t.after(() => classicInstalled.close());
  const blob = new Blob([JSON.stringify(packageSource(), null, 2)]),
    hash = await creatorSHA256(await blob.arrayBuffer());
  const edition = {
    editionId: `ed_${hash}`,
    collectionId: `co_${'a'.repeat(64)}`,
    slug: 'shield-workshop',
    title: 'Shield workshop',
    description: 'Native Snake package',
    version: '1.0.0',
    packageSha256: hash,
    packageSize: blob.size,
    publishedAt: '2026-10-03T12:00:00.000Z',
    family: 'classic',
  };
  const downloadStore = createMemoryCommunityDownloadStore();
  const library = createCommunityLibrary({
    client: {
      catalog: async () => ({ editions: [edition], nextCursor: null }),
      download: async () => blob,
    },
    creatorStore,
    classicInstalled,
    stateStore: createMemoryCommunityStateStore(),
    downloadStore,
  });
  await library.install(edition, { offline: false });
  const installed = await library.status(edition.editionId);
  assert.equal(installed.family, 'classic');
  assert.equal(installed.installed, true);
  assert.match(installed.playHref, /snake\/play\.html\?community=/);
  assert.match(installed.profileKey, /community\/[a-f0-9]{16}$/);
  const removal = await library.reviewDownloadRemoval(edition);
  await library.removeDownload(edition, removal);
  assert.equal((await library.status(edition.editionId)).packageRetained, false);
  await library.retainFromInstalled(edition);
  assert.equal(
    await creatorSHA256(await (await downloadStore.get(edition.editionId)).arrayBuffer()),
    hash,
  );
  const review = await library.reviewInstalledOffload(edition);
  await library.offloadInstalled(edition, review);
  assert.equal((await library.status(edition.editionId)).offloaded, true);
  await library.install(edition);
  const restored = await library.status(edition.editionId);
  assert.equal(restored.runtimeIdentity, installed.runtimeIdentity);
  assert.equal(restored.installed, true);
});

test('community Classic records persist under their owner and cannot enter official chapter records', async (t) => {
  const original = CLASSIC_SNAKE_LEVELS[0];
  const source = {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: 'Local open loop', uk: 'Локальна відкрита петля' },
    entries: [{ title: original.title, description: original.description, level: original.level }],
  };
  const model = memoryIndexedDB(),
    pack = validateClassicSnakePackage(source);
  const entry = classicSnakePackageEntries(pack)[0];
  const own = createClassicSnakeRecords({ indexedDB: model.indexedDB, contentPack: pack });
  const official = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => {
    own.close();
    official.close();
  });
  const match = createClassicSnakeMatch(entry.level, { mode: 'solo', seed: 17 });
  // Replay the existing accepted route as new input against the imported
  // identity. Do not relabel the original replay or trust its terminal state.
  const route = JSON.parse(
    await readFile(
      new URL(
        '../../docs/verification/classic-snake/authored-open-loop.replay.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const turn of route.turns) {
    advanceClassicSnakeMatchTo(match, turn.tick * route.level.stepMs);
    assert.equal(queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction), true);
  }
  advanceClassicSnakeMatchTo(match, route.steps * route.level.stepMs);
  assert.equal(match.runs[0].status, 'won');
  const context = {
    mode: 'solo',
    chapterId: entry.chapterId,
    level: entry.level,
    match: exportClassicSnakeMatch(match),
  };
  await own.remember(match.runs[0], context);
  const reload = createClassicSnakeRecords({ indexedDB: model.indexedDB, contentPack: pack });
  t.after(() => reload.close());
  await reload.read();
  await official.read();
  assert.ok(reload.get(match.runs[0], 'solo'));
  assert.equal(reload.cleared(entry.id), true);
  assert.equal(reload.chapter([entry]), 1);
  assert.equal(reload.chapter(CLASSIC_SNAKE_LEVELS), 0);
  assert.equal(official.get(match.runs[0], 'solo'), null);
  assert.equal(official.cleared(original.id), false);
  const replacement = createClassicSnakeRecords({
    indexedDB: model.indexedDB,
    contentPack: { ...source, title: { ...source.title, en: 'Another edition' } },
  });
  t.after(() => replacement.close());
  await replacement.read();
  assert.equal(replacement.chapter([entry]), 0);
  assert.deepEqual(replacement.snapshot().rows, {});
  await assert.rejects(() => official.remember(match.runs[0], context));
  const foreign = CLASSIC_SNAKE_LEVELS[0],
    foreignMatch = createClassicSnakeMatch(foreign.level, { mode: 'solo', seed: 17 });
  await assert.rejects(() =>
    own.remember(foreignMatch.runs[0], {
      mode: 'solo',
      chapterId: foreign.chapterId,
      level: foreign.level,
      match: exportClassicSnakeMatch(foreignMatch),
    }),
  );
});
