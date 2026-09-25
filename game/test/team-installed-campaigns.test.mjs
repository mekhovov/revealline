import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { generateCreatorTeamCampaign, prepareCreatorTeamCampaign } from '../creator/team.mjs';
import {
  CREATOR_TEAM_DATABASE,
  createInstalledTeamAttempt,
  createInstalledTeamAttemptSnapshot,
  createInstalledTeamCampaignStore,
  installedTeamGameplayId,
} from '../creator/team-installed.mjs';
import { stepCoop } from '../coop/core.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

async function prepared(seed = 12) {
  const generated = generateCreatorTeamCampaign({
    id: `installed-team-${seed}`,
    name: `Installed Team ${seed}`,
    seed,
  });
  return prepareCreatorTeamCampaign(generated.pack, generated.provenance);
}

function recordRoute(run) {
  const segments = [],
    tick = (directions) => {
      const commands = directions.map((direction, seat) => {
          const player = run.players[seat],
            coverDrifters = Boolean(run.level.goal.cores),
            support =
              player.support.readyAt <= run.time &&
              (run.enemies.some(
                (enemy) =>
                  enemy.active !== false &&
                  ((coverDrifters && enemy.type === 'drifter') ||
                    ['warning', 'commit'].includes(enemy.phase)) &&
                  Math.hypot(enemy.x - player.x, enemy.y - player.y) <= 5.9,
              ) ||
                run.impacts.some(
                  (impact) => Math.hypot(impact.x - player.x, impact.y - player.y) <= 5.9,
                ));
          return { direction, boost: true, support };
        }),
        previous = segments.at(-1);
      stepCoop(run, commands);
      if (previous && canonicalJSON(previous.commands) === canonicalJSON(commands))
        previous.ticks++;
      else segments.push({ ticks: 1, commands });
    },
    toward = (axis, targets) =>
      run.players.map((player, seat) =>
        Math.abs(player[axis] - targets[seat]) <= 0.051
          ? null
          : player[axis] < targets[seat]
            ? axis === 'x'
              ? 'right'
              : 'down'
            : axis === 'x'
              ? 'left'
              : 'up',
      ),
    at = (axis, targets) =>
      run.players.every((player, seat) => Math.abs(player[axis] - targets[seat]) <= 0.051),
    stage = (directions, done, limit = 1800) => {
      let ticks = 0;
      while (!done() && run.status === 'running' && ticks++ < limit)
        tick(typeof directions === 'function' ? directions() : directions);
    };
  if (run.level.goal.coverage) {
    stage(
      () => toward('y', [12.5, 12.5]),
      () => at('y', [12.5, 12.5]),
    );
    stage(['right', 'left'], () => run.claimedCount > 0);
    stage(
      () => toward('x', [26.5, 45.5]),
      () => at('x', [26.5, 45.5]),
    );
    stage(['down', 'down'], () => run.players.every((player) => player.y >= 34.99));
    stage(
      () => toward('y', [22.5, 22.5]),
      () => at('y', [22.5, 22.5]),
    );
    const upper = run.claimedCount;
    stage(['right', 'left'], () => run.claimedCount > upper);
    stage(
      () => toward('x', [26.5, 45.5]),
      () => at('x', [26.5, 45.5]),
    );
    stage(
      () => toward('y', [26.5, 26.5]),
      () => at('y', [26.5, 26.5]),
    );
    const lower = run.claimedCount;
    stage(['right', 'left'], () => run.status === 'won' || run.claimedCount > lower);
  } else {
    stage(
      () => toward('y', [12.5, 12.5]),
      () => at('y', [12.5, 12.5]),
    );
    stage(['right', 'left'], () => run.claimedCount > 0);
    stage(
      () => toward('x', [23.5, 48.5]),
      () => at('x', [23.5, 48.5]),
    );
    stage(['up', 'up'], () => run.strongholds[0].anchors.every((anchor) => anchor.captured));
    stage(
      () => toward('y', [6.5, 6.5]),
      () => at('y', [6.5, 6.5]),
    );
    stage(['right', 'left'], () => run.status === 'won');
  }
  return segments;
}

function writeEdition(indexedDB, editionId, update) {
  return new Promise((resolve, reject) => {
    const opened = indexedDB.open(CREATOR_TEAM_DATABASE, 1);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result,
        tx = db.transaction('editions', 'readwrite'),
        store = tx.objectStore('editions'),
        read = store.get(editionId);
      read.onsuccess = () => store.put(update(read.result), editionId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => reject(tx.error);
    };
  });
}

test('verified Team portable bytes install once and reopen through exact replay verification', async () => {
  const memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({
      indexedDB: memory.indexedDB,
      now: () => 40,
    }),
    campaign = await prepared();
  const first = await store.install(campaign),
    second = await store.install(campaign),
    inventory = await store.inventory();
  assert.match(first.editionId, /^[a-f0-9]{64}$/);
  assert.equal(first.alreadyInstalled, false);
  assert.deepEqual(second, {
    editionId: first.editionId,
    alreadyInstalled: true,
  });
  assert.equal(inventory.generation, 1);
  assert.equal(inventory.editions.length, 1);
  assert.equal(inventory.editions[0].editionId, first.editionId);
  assert.equal(inventory.editions[0].installedAt, 40);
  assert.equal(inventory.editions[0].pack.name, campaign.pack.name);
  assert.deepEqual(inventory.editions[0].progress.clears, {});
  const loaded = await store.load(first.editionId);
  assert.equal(loaded.editionId, first.editionId);
  assert.equal(canonicalJSON(loaded.prepared.pack), canonicalJSON(campaign.pack));
  assert.equal(canonicalJSON(loaded.prepared.evidence), canonicalJSON(campaign.evidence));
  store.close();
});

test('changed Team bytes create an immutable adjacent edition and never reinterpret the first', async () => {
  const memory = managedIndexedDB();
  let clock = 1;
  const store = createInstalledTeamCampaignStore({
      indexedDB: memory.indexedDB,
      now: () => clock++,
    }),
    firstCampaign = await prepared(2),
    secondCampaign = await prepared(3),
    first = await store.install(firstCampaign),
    second = await store.install(secondCampaign),
    inventory = await store.inventory();
  assert.notEqual(first.editionId, second.editionId);
  assert.equal(inventory.generation, 2);
  assert.deepEqual(
    inventory.editions.map((edition) => edition.editionId),
    [second.editionId, first.editionId],
  );
  assert.equal(
    canonicalJSON((await store.load(first.editionId)).prepared.pack),
    canonicalJSON(firstCampaign.pack),
  );
  assert.equal(
    canonicalJSON((await store.load(second.editionId)).prepared.pack),
    canonicalJSON(secondCampaign.pack),
  );
});

test('legal Team clears persist under the exact edition and reject mutable run identities', async () => {
  const memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    campaign = await prepared(7),
    { editionId } = await store.install(campaign),
    level = campaign.pack.levels[0],
    run = createInstalledTeamAttempt(campaign.pack, level.id, 'standard', 'full'),
    gameplayId = installedTeamGameplayId(campaign.pack, level.id, 'standard', 'full'),
    segments = recordRoute(run),
    attempt = createInstalledTeamAttemptSnapshot({
      editionId,
      attemptId: 'run-installed-team-1',
      gameplayId,
      presetId: 'full',
      run,
      segments,
    }),
    reward = {
      kind: 'picture',
      sourceKind: 'registered-original',
      sha256: 'a'.repeat(64),
      bytes: 1200,
      mime: 'image/png',
      width: 1152,
      height: 576,
    },
    receipt = {
      editionId,
      levelId: level.id,
      runId: 'run-installed-team-1',
      gameplayId,
      difficulty: 'standard',
      presetId: 'full',
      attempt,
      reward,
    };
  const first = await store.recordCompletion(receipt),
    duplicate = await store.recordCompletion(receipt),
    inventory = await store.inventory();
  assert.equal(first.generation, 1);
  assert.deepEqual(duplicate, first);
  assert.deepEqual(inventory.editions[0].progress.clears[level.id], {
    runId: receipt.runId,
    gameplayId: receipt.gameplayId,
    difficulty: 'standard',
    presetId: 'full',
    reward,
  });
  await assert.rejects(
    store.recordCompletion({
      ...receipt,
      gameplayId: installedTeamGameplayId(campaign.pack, level.id, 'gentle', 'full'),
      difficulty: 'gentle',
      attempt: { ...attempt, difficulty: 'gentle' },
    }),
    /cannot change identity/,
  );
  await assert.rejects(
    store.recordCompletion({
      ...receipt,
      runId: 'run-installed-team-2',
      gameplayId: 'changed-gameplay',
    }),
    /differs from its exact replayed attempt/,
  );
  await assert.rejects(
    store.recordCompletion({
      ...receipt,
      editionId: 'f'.repeat(64),
      runId: 'missing',
      attempt: { ...attempt, editionId: 'f'.repeat(64), attemptId: 'missing' },
    }),
    /no longer installed/,
  );
  store.close();
  const reopened = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    reopenedInventory = await reopened.inventory();
  assert.deepEqual(reopenedInventory.editions[0].progress.clears[level.id].reward, reward);
  reopened.close();
});

test('unfinished Team checkpoints replay exactly, reject stale writers and clear only their own attempt', async () => {
  const memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    campaign = await prepared(8),
    { editionId } = await store.install(campaign),
    level = campaign.pack.levels[0],
    run = createInstalledTeamAttempt(campaign.pack, level.id, 'expert', 'joint'),
    gameplayId = installedTeamGameplayId(campaign.pack, level.id, 'expert', 'joint'),
    commands = [
      { direction: 'down', boost: true, support: false },
      { direction: 'down', boost: true, support: false },
    ];
  for (let index = 0; index < 25; index++) stepCoop(run, commands);
  const snapshot = createInstalledTeamAttemptSnapshot({
      editionId,
      attemptId: 'saved-team-attempt',
      gameplayId,
      presetId: 'joint',
      run,
      segments: [{ ticks: 25, commands }],
    }),
    saved = await store.recordAttempt(snapshot, { expectedGeneration: 0 }),
    restored = await store.restoreAttempt(editionId, level.id);
  assert.equal(saved.generation, 1);
  assert.equal(restored.generation, 1);
  assert.deepEqual(restored.snapshot, snapshot);
  assert.equal(restored.run.tick, run.tick);
  assert.deepEqual(restored.run.players, run.players);
  await assert.rejects(
    store.recordAttempt(snapshot, { expectedGeneration: 0 }),
    /changed in another tab/,
  );
  await assert.rejects(
    store.clearAttempt({
      editionId,
      levelId: level.id,
      attemptId: 'newer-attempt',
      expectedGeneration: 1,
    }),
    /newer installed Team attempt/,
  );
  const cleared = await store.clearAttempt({
    editionId,
    levelId: level.id,
    attemptId: snapshot.attemptId,
    expectedGeneration: 1,
  });
  assert.equal(cleared.generation, 2);
  assert.deepEqual(cleared.attempts, {});
  await assert.rejects(store.restoreAttempt(editionId, level.id), /no saved attempt/);
});

test('inventory and launch reject changed stored package bytes before gameplay', async () => {
  const memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    campaign = await prepared(19),
    { editionId } = await store.install(campaign);
  store.close();
  await writeEdition(memory.indexedDB, editionId, (row) => ({
    ...row,
    portable: `${row.portable} `,
    bytes: row.bytes + 1,
  }));
  const reopened = createInstalledTeamCampaignStore({
    indexedDB: memory.indexedDB,
  });
  await assert.rejects(reopened.inventory(), /integrity check/);
  await assert.rejects(reopened.load(editionId), /integrity check/);
});
