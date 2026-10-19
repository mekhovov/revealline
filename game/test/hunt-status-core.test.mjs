import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun } from '../core/index.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';
import { prepareHuntLevel } from '../hunt/level.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamHuntTrainingCandidates } from '../content-design/team-hunt-training-candidates.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { attachHuntStatus } from '../ui/hunt-status.mjs';
import { createHuntRecords, runHuntMilestones, HUNT_RECORDS_KEY } from '../hunt/records.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Command-completed, validated core fixtures. Separate from the application
// adapter tests: no browser/media/device acceptance is implied.
function observe(t, run, mode) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  const saved = new Map();
  let writes = 0;
  const records = createHuntRecords({
    getStorage: () => ({
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => {
        writes++;
        saved.set(key, value);
      },
    }),
  });
  const doc = new Document(),
    button = doc.createElement('button');
  doc.body.append(button);
  const live = attachHuntStatus({ document: doc, container: doc.body, mode, records });
  const result = attachHuntStatus({
    document: doc,
    container: doc.body,
    mode,
    records,
    record: false,
  });
  t.after(() => {
    live.dispose();
    result.dispose();
    records.dispose();
    setLocale(locale, { persist: false });
  });
  const before = structuredClone(run);
  live.render(run);
  result.render(run);
  live.render(run);
  assert.deepEqual(structuredClone(run), before);
  assert.deepEqual(runHuntMilestones(run), { all: true, contact: true, clean: true });
  for (const node of doc.querySelectorAll('.hunt-status')) {
    assert.match(
      node.textContent,
      /^This attempt:.*Style goals met this attempt: All targets · All by contact · No damage/,
    );
    assert.match(node.textContent, /Personal progress for this exact setup:.*Best hunt: 100/);
    assert.ok(node.textContent.endsWith('All three style goals earned for this setup.'));
  }
  assert.equal(writes, 1);
  assert.deepEqual([...saved.keys()], [HUNT_RECORDS_KEY]);
  assert.ok(records.snapshot().records[0].key.startsWith(`${mode}/`));
  const raw = saved.get(HUNT_RECORDS_KEY);
  button.focus();
  setLocale('uk', { persist: false });
  setLocale('en', { persist: false });
  assert.equal(doc.activeElement, button);
  assert.equal(writes, 1);
  assert.equal(saved.get(HUNT_RECORDS_KEY), raw);
  assert.deepEqual(structuredClone(run), before);
}

for (const mode of ['solo', 'versus'])
  test(`${mode} command-completed Hunt uses the same exact current-attempt and saved milestones`, (t) => {
    const source = combatLevel('scout');
    source.classic.combatPatrols.actors[0].turnTicks = 60;
    const level = prepareHuntLevel(source, {
      id: 'hunt-status-core-fixture',
      revision: '1',
      actors: structuredClone(source.classic.combatPatrols.actors),
      hunt: {
        version: 'humanoid-hunt.v1',
        mode: 'hunt',
        quota: 1,
        targets: [{ id: 'patrol', kind: 'runner' }],
      },
    });
    const run = createRun(level, { seed: 47 });
    for (let i = 0; i < 300 && run.status === 'running'; i++) stepRun(run, { direction: 'right' });
    assert.equal(run.status, 'won');
    assert.equal(run.classic.hunt.touchKills, 1);
    observe(t, run, mode);
  });

test('Team command-completed Hunt uses the shared cumulative-down milestone owner', (t) => {
  const source = createTeamHuntTrainingCandidates();
  source.missions[0].hunt.mode = 'hunt';
  source.missions[0].hunt.quota = 1;
  source.missions[0].hunt.targets = source.missions[0].hunt.targets.filter(
    (target) => target.id === 'near-runner',
  );
  source.missions[0].actors = source.missions[0].actors.filter(
    (actor) => actor.id !== 'far-runner',
  );
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const row = host.rows.find((candidate) => candidate.difficulty === 'standard');
  const run = startCoop(createCoop(row.level, { seed: 47 }));
  const commands = [
    { direction: 'down', boost: true, support: false },
    { direction: null, boost: false, support: false },
  ];
  for (let i = 0; i < 240 && run.status === 'running'; i++) stepCoop(run, commands);
  assert.equal(run.status, 'won');
  assert.equal(run.hunt.touchKills, 1);
  observe(t, run, 'team');
});
