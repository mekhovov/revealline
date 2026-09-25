import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJSON, dataIdentity } from "../data-json.mjs";
import {
  createCreatorTeamAttempt,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
} from "../creator/team.mjs";
import {
  CREATOR_TEAM_DATABASE,
  createInstalledTeamCampaignStore,
} from "../creator/team-installed.mjs";
import { managedIndexedDB } from "./helpers/managed-idb.mjs";

async function prepared(seed = 12) {
  const generated = generateCreatorTeamCampaign({
    id: `installed-team-${seed}`,
    name: `Installed Team ${seed}`,
    seed,
  });
  return prepareCreatorTeamCampaign(generated.pack, generated.provenance);
}

function writeEdition(indexedDB, editionId, update) {
  return new Promise((resolve, reject) => {
    const opened = indexedDB.open(CREATOR_TEAM_DATABASE, 1);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result,
        tx = db.transaction("editions", "readwrite"),
        store = tx.objectStore("editions"),
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

test("verified Team portable bytes install once and reopen through exact replay verification", async () => {
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
  assert.equal(
    canonicalJSON(loaded.prepared.pack),
    canonicalJSON(campaign.pack),
  );
  assert.equal(
    canonicalJSON(loaded.prepared.evidence),
    canonicalJSON(campaign.evidence),
  );
  store.close();
});

test("changed Team bytes create an immutable adjacent edition and never reinterpret the first", async () => {
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

test("legal Team clears persist under the exact edition and reject mutable run identities", async () => {
  const memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    campaign = await prepared(7),
    { editionId } = await store.install(campaign),
    level = campaign.pack.levels[0],
    run = createCreatorTeamAttempt(campaign.pack, level.id, "standard", "full"),
    receipt = {
      editionId,
      levelId: level.id,
      runId: "run-installed-team-1",
      gameplayId: dataIdentity({ ruleset: run.ruleset, level: run.level }),
      difficulty: "standard",
      presetId: "full",
    };
  const first = await store.recordCompletion(receipt),
    duplicate = await store.recordCompletion(receipt),
    inventory = await store.inventory();
  assert.equal(first.generation, 1);
  assert.deepEqual(duplicate, first);
  assert.deepEqual(inventory.editions[0].progress.clears[level.id], {
    runId: receipt.runId,
    gameplayId: receipt.gameplayId,
    difficulty: "standard",
    presetId: "full",
  });
  const changedAttempt = createCreatorTeamAttempt(
    campaign.pack,
    level.id,
    "gentle",
    "full",
  );
  await assert.rejects(
    store.recordCompletion({
      ...receipt,
      gameplayId: dataIdentity({
        ruleset: changedAttempt.ruleset,
        level: changedAttempt.level,
      }),
      difficulty: "gentle",
    }),
    /cannot change identity/,
  );
  await assert.rejects(
    store.recordCompletion({
      ...receipt,
      runId: "run-installed-team-2",
      gameplayId: "changed-gameplay",
    }),
    /does not match the installed configuration/,
  );
  await assert.rejects(
    store.recordCompletion({
      ...receipt,
      editionId: "f".repeat(64),
      runId: "missing",
    }),
    /no longer installed/,
  );
});

test("inventory and launch reject changed stored package bytes before gameplay", async () => {
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
