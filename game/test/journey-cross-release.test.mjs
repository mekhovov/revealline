import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as current from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createTeamJourneyProgress } from '../content-design/team-progress.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';

// Committed copies of exact earlier source, not today's validator pretending to
// be an old reader. No git, network, dependency install or filesystem write at test time.
const historical = JSON.parse(
  await readFile(new URL('./fixtures/journey-reader-v0693.json', import.meta.url), 'utf8'),
);
assert.equal(historical.sourceCommit, '406637f36c039f991e83d241cb49d4568a871109');
const pins = {
  'game/data-json.mjs': 'bcf8c3cb859473a39973cc93cee347085d3146164b0b92a02e81df57f6ffc823',
  'game/journey/catalog.mjs': '044104f8e766b474ac7b01fd218e3667412ff8104e998f133cc6e4492191f625',
  'game/journey/profile.mjs': 'bc1ba929661501d491e53b9ba043b8a27d474ef7c2da8a62b386eb08da8b69f3',
};
assert.deepEqual(Object.keys(historical.files), Object.keys(pins));
for (const [path, hash] of Object.entries(pins)) {
  assert.equal(historical.files[path].sha256, hash);
  assert.equal(
    createHash('sha256').update(historical.files[path].source).digest('hex'),
    hash,
    path,
  );
}
const moduleURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const dataURL = moduleURL(historical.files['game/data-json.mjs'].source);
function link(source, specifier, target) {
  const literal = `'${specifier}'`;
  assert.equal(source.split(literal).length, 2, 'Only the known import location may be relocated');
  return source.replace(literal, `'${target}'`);
}
const catalogURL = moduleURL(
  link(historical.files['game/journey/catalog.mjs'].source, '../data-json.mjs', dataURL),
);
const old = await import(
  moduleURL(
    link(
      link(historical.files['game/journey/profile.mjs'].source, '../data-json.mjs', dataURL),
      './catalog.mjs',
      catalogURL,
    ),
  )
);

const modes = ['solo', 'versus', 'team'];
function complete(mode, difficulty, suffix = '') {
  // Storage-only synthetic receipts, never claimed as earned gameplay evidence.
  return {
    type: 'complete',
    mode,
    difficulty,
    missionId: `candidate/future-pack/future-campaign/${difficulty}${suffix}`,
    runId: `synthetic/${mode}/${difficulty}${suffix}`,
    gameplayId: `future-edition-${mode}-${difficulty}${suffix}`,
  };
}
function events() {
  return modes.flatMap((mode) => [
    ...['gentle', 'standard', 'expert'].map((difficulty) => complete(mode, difficulty)),
    { type: 'skip', mode, missionId: 'candidate/future-pack/future-campaign/skipped' },
    { type: 'select', mode, missionId: 'candidate/future-pack/future-campaign/next' },
  ]);
}

test('earlier tagged reader opens current durable progress, preserves unknown editions, and writes without a database upgrade', async () => {
  const memory = managedIndexedDB(),
    opened = [];
  const environment = {
    indexedDB: {
      open(name, version) {
        opened.push({ name, version });
        return memory.indexedDB.open(name, version);
      },
    },
  };
  assert.equal(old.JOURNEY_PROFILE_VERSION, current.JOURNEY_PROFILE_VERSION);
  assert.equal(old.JOURNEY_PROFILE_DATABASE, current.JOURNEY_PROFILE_DATABASE);
  assert.equal(old.JOURNEY_BACKUP_VERSION, current.JOURNEY_BACKUP_VERSION);
  const now = current.createJourneyProfileStore({
    backend: current.createJourneyBackend(environment),
  });
  await now.load();
  now.recordMany(events());
  assert(await now.flush());
  const expected = now.snapshot(),
    previous = old.createJourneyProfileStore({ backend: old.createJourneyBackend(environment) });
  assert.deepEqual(await previous.load(), expected);
  for (const mode of modes)
    previous.record({ type: 'select', mode, missionId: `official/old/${mode}/level` });
  assert(await previous.flush());
  const upgraded = current.createJourneyProfileStore({
    backend: current.createJourneyBackend(environment),
  });
  const restored = await upgraded.load();
  assert.deepEqual(restored.clears, expected.clears);
  assert.deepEqual(restored.skipped, expected.skipped);
  for (const mode of modes) assert.equal(restored.cursors[mode], `official/old/${mode}/level`);
  assert(opened.every(({ name, version }) => name === 'revealline-journey-v1' && version === 1));
  assert.equal(memory.closed, 0, 'Neither reader requested a schema upgrade');
});

test('old and current open tabs preserve each other’s mode history in either transaction order', async () => {
  for (const oldFirst of [true, false]) {
    const memory = managedIndexedDB();
    const now = current.createJourneyProfileStore({
      backend: current.createJourneyBackend(memory),
    });
    const previous = old.createJourneyProfileStore({ backend: old.createJourneyBackend(memory) });
    await Promise.all([now.load(), previous.load()]);
    const currentWrite = () =>
      now.recordMany([
        complete('team', 'expert'),
        { type: 'skip', mode: 'team', missionId: 'new/skip' },
        { type: 'select', mode: 'team', missionId: 'new/next' },
      ]);
    const oldWrite = () => previous.record(complete('solo', 'gentle', '-old'));
    if (oldFirst) {
      oldWrite();
      currentWrite();
    } else {
      currentWrite();
      oldWrite();
    }
    assert.deepEqual(await Promise.all([now.flush(), previous.flush()]), [true, true]);
    const persisted = await current.createJourneyBackend(memory).read();
    assert.equal(
      persisted.clears.solo[complete('solo', 'gentle', '-old').missionId].runId,
      'synthetic/solo/gentle-old',
    );
    assert.equal(persisted.clears.team[complete('team', 'expert').missionId].difficulty, 'expert');
    assert.deepEqual(persisted.skipped.team, ['new/skip']);
    assert.equal(persisted.cursors.team, 'new/next');
    assert.deepEqual(old.validateJourneyProfile(persisted), persisted);
  }
});

test('current backup restores in the earlier reader and returns without losing any preset or unknown mission', async () => {
  const memory = managedIndexedDB();
  const now = current.createJourneyProfileStore({ backend: current.createJourneyBackend(memory) });
  await now.load();
  now.recordMany(events());
  await now.flush();
  const expected = now.snapshot();
  const otherDisk = managedIndexedDB();
  const previous = old.createJourneyProfileStore({ backend: old.createJourneyBackend(otherDisk) });
  await previous.load();
  previous.restore(now.export());
  assert(await previous.flush());
  for (const field of ['clears', 'skipped', 'cursors'])
    assert.deepEqual(previous.snapshot()[field], expected[field]);
  const roundTrip = current.inspectJourneyBackup(previous.export());
  assert.deepEqual(roundTrip.profile, previous.snapshot());
  const generation = previous.snapshot().generation;
  previous.restore(now.export());
  await previous.flush();
  assert.equal(previous.snapshot().generation, generation, 'Repeated restore remains idempotent');
  now.restore(previous.export());
  await now.flush();
  assert.deepEqual(
    now.snapshot(),
    expected,
    'A no-op round trip does not advance current generation',
  );
});

test('failed earlier-reader writes remain exportable and merge on retry without overwriting current history', async () => {
  const memory = managedIndexedDB();
  const now = current.createJourneyProfileStore({ backend: current.createJourneyBackend(memory) });
  await now.load();
  now.recordMany(events());
  await now.flush();
  const before = now.snapshot(),
    previous = old.createJourneyProfileStore({ backend: old.createJourneyBackend(memory) });
  await previous.load();
  memory.failAnyPutAt = 1;
  previous.record(complete('solo', 'expert', '-offline'));
  assert.equal(await previous.flush(), false);
  assert.equal(previous.status().durable, false);
  assert.deepEqual(await current.createJourneyBackend(memory).read(), before);
  const exported = current.inspectJourneyBackup(previous.export());
  assert(exported.profile.clears.solo[complete('solo', 'expert', '-offline').missionId]);
  memory.failAnyPutAt = null;
  now.record(complete('versus', 'standard', '-concurrent'));
  assert(await now.flush());
  assert(await previous.flush());
  const after = await current.createJourneyBackend(memory).read();
  assert(after.clears.versus[complete('versus', 'standard', '-concurrent').missionId]);
  assert(after.clears.solo[complete('solo', 'expert', '-offline').missionId]);
  assert.deepEqual(after.clears.team, before.clears.team);
});

test('a command-earned Team receipt survives an actual earlier reader and returns to the current host', async () => {
  const source = createTeamOpeningCandidates();
  const journey = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const memory = managedIndexedDB(),
    progress = createTeamJourneyProgress(journey, {
      backend: current.createJourneyBackend(memory),
      sessionId: 'rollback-legal-route',
    });
  await progress.load();
  const row = progress.initial('standard'),
    run = createCoop(row.level);
  assert(progress.started(row, run));
  startCoop(run);
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/team-opening-routes.json', import.meta.url), 'utf8'),
  );
  for (const segment of fixture.routes[0].log)
    for (let i = 0; i < segment.ticks && run.status === 'running'; i++)
      stepCoop(
        run,
        [segment.a, segment.b].map((direction) => ({ direction, boost: false, support: false })),
      );
  assert.equal(run.status, 'won');
  assert(progress.complete(run));
  assert(await progress.retry());
  const receipt = progress.snapshot().clears.team[row.mission.id];
  assert.equal(receipt.gameplayId, row.simulationIdentity);
  const previous = old.createJourneyProfileStore({ backend: old.createJourneyBackend(memory) });
  await previous.load();
  assert.deepEqual(previous.snapshot().clears.team[row.mission.id], receipt);
  previous.record({ type: 'select', mode: 'solo', missionId: 'official/older/opening' });
  assert(await previous.flush());
  const reopened = createTeamJourneyProgress(journey, {
    backend: current.createJourneyBackend(memory),
  });
  await reopened.load();
  assert.deepEqual(reopened.snapshot().clears.team[row.mission.id], receipt);
  assert.equal(reopened.snapshot().cursors.solo, 'official/older/opening');
  progress.dispose();
  reopened.dispose();
});
