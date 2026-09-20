import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamJourneyProgress } from '../content-design/team-progress.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import {
  createJourneyBackend,
  emptyJourneyProfile,
  applyJourneyEvent,
  inspectJourneyBackup,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const source = createTeamJourneyCandidates(),
  corePackIds = source.packs.map((pack) => pack.id);
const journey = createCandidateTeamHost(source, { corePackIds });
const first = journey.row(journey.catalog.missions[0]),
  second = journey.destination(first).next;
const log = JSON.parse(
  await readFile(new URL('./fixtures/team-opening-routes.json', import.meta.url)),
).routes[0].log;
function win(run) {
  startCoop(run);
  for (const segment of log)
    for (let i = 0; i < segment.ticks && run.status === 'running'; i++)
      stepCoop(
        run,
        [segment.a, segment.b].map((direction) => ({ direction, boost: false, support: false })),
      );
  assert.equal(run.status, 'won');
}
function memory() {
  let saved = emptyJourneyProfile();
  return {
    read: async () => structuredClone(saved),
    commit: async (events) => {
      saved = events.reduce(applyJourneyEvent, saved);
      return structuredClone(saved);
    },
  };
}

test('Team selection/command-earned receipt survives store recreation and resumes across a campaign boundary', async () => {
  const indexedDB = managedIndexedDB();
  const progress = createTeamJourneyProgress(journey, {
    backend: createJourneyBackend(indexedDB),
    sessionId: 'visit-a',
  });
  await progress.load();
  assert.equal(progress.initial('standard'), first);
  const run = createCoop(first.level);
  assert(progress.started(first, run));
  assert.equal(progress.complete(run), false);
  win(run);
  assert(progress.complete(run));
  const generation = progress.snapshot().generation;
  assert.equal(progress.complete(run), false);
  assert.equal(progress.snapshot().generation, generation);
  await progress.retry();
  const receipt = progress.snapshot().clears.team[first.mission.id];
  assert.deepEqual(receipt, {
    runId: 'visit-a/1',
    gameplayId: first.simulationIdentity,
    difficulty: 'standard',
  });
  const renamed = structuredClone(source);
  renamed.revision = 'next-release';
  renamed.missions[0].name = 'Renamed first mission';
  const nextJourney = createCandidateTeamHost(renamed, { corePackIds });
  const reopened = createTeamJourneyProgress(nextJourney, {
    backend: createJourneyBackend(indexedDB),
  });
  await reopened.load();
  assert.equal(reopened.initial('expert').mission.id, second.mission.id);
  assert.deepEqual(reopened.snapshot().clears.team[first.mission.id], receipt);
  assert.deepEqual(reopened.snapshot().clears.solo, {});
  assert.deepEqual(reopened.snapshot().clears.versus, {});
});

test('unowned rows, unsupported presets, late admissions and imported-looking runs cannot write Team receipts', async () => {
  const progress = createTeamJourneyProgress(journey, { backend: memory() });
  await progress.load();
  const unadmitted = createCoop(first.level);
  assert.equal(progress.started({ ...first }, unadmitted), false);
  assert.equal(progress.started(journey.row(first.mission, 'expert'), unadmitted), false);
  win(unadmitted);
  assert.equal(progress.started(first, unadmitted), false);
  assert.equal(progress.complete(unadmitted), false);
  assert.equal(progress.snapshot().generation, 0);
  assert.equal(progress.initial('random'), null);
  progress.dispose();
  assert.equal(progress.started(first, createCoop(first.level)), false);
});

test('storage denial retains accepted progress, exports truthful session state, retries and merges other mode writes', async () => {
  const backing = memory();
  let denied = true;
  const backend = {
    async read() {
      if (denied) throw new Error('Test storage denial');
      return backing.read();
    },
    commit: backing.commit,
  };
  const progress = createTeamJourneyProgress(journey, { backend, sessionId: 'offline' });
  await progress.load();
  assert.equal(progress.status().durable, false);
  const run = createCoop(first.level);
  progress.started(first, run);
  win(run);
  progress.complete(run);
  await progress.retry();
  assert(progress.status().pending > 0);
  assert.equal(progress.initial('standard'), second);
  const backup = inspectJourneyBackup(JSON.parse(progress.export()));
  assert(backup.profile.clears.team[first.mission.id]);
  await backing.commit([{ type: 'select', mode: 'solo', missionId: 'other-tab/solo' }]);
  denied = false;
  assert(await progress.retry());
  assert.equal(progress.status().pending, 0);
  assert.equal(progress.snapshot().cursors.solo, 'other-tab/solo');
  assert(progress.snapshot().clears.team[first.mission.id]);
});

test('skip is a reversible navigation record, not a clear or permission to skip a different successor', async () => {
  const progress = createTeamJourneyProgress(journey, { backend: memory() });
  await progress.load();
  assert.equal(progress.skipped(first, journey.rows.at(-1)), false);
  assert.equal(progress.skipped({ ...first }, second), false);
  assert(progress.skipped(first, second));
  progress.started(second, createCoop(second.level));
  assert.equal(progress.initial('standard'), second);
  assert.deepEqual(progress.snapshot().skipped.team, [first.mission.id]);
  assert.deepEqual(progress.snapshot().clears.team, {});
  const replay = createCoop(first.level);
  progress.started(first, replay);
  win(replay);
  progress.complete(replay);
  assert.deepEqual(progress.snapshot().skipped.team, []);
});

test('unknown or archived saved Team cursor falls back without deleting historical receipts', async () => {
  const backend = memory();
  await backend.commit([
    {
      type: 'complete',
      mode: 'team',
      missionId: 'retired/mission',
      runId: 'old-run',
      gameplayId: 'old-edition',
      difficulty: 'gentle',
    },
    { type: 'select', mode: 'team', missionId: 'retired/mission' },
  ]);
  const progress = createTeamJourneyProgress(journey, { backend });
  await progress.load();
  assert.equal(progress.initial('standard'), first);
  assert(progress.snapshot().clears.team['retired/mission']);
});
