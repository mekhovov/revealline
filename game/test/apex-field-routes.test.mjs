import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexFieldCandidates } from '../content-design/apex-field-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { playApexFieldRoute } from './helpers/apex-field-route.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/apex-field-clear-routes.json', import.meta.url)),
);
const rejected = JSON.parse(
  await readFile(new URL('./fixtures/apex-field-rejected-control.json', import.meta.url)),
);
const project = compileContentProject(createApexFieldCandidates());

test('eight samples cover six preset/steering combinations and separate opening choices, not human acceptance', () => {
  assert.equal(fixture.format, 'ApexFieldFeasibilityV1');
  assert.equal(fixture.revision, project.source.revision);
  assert.equal(fixture.status, 'balance-pending');
  assert.equal(fixture.rows.length, 8);
  assert.deepEqual(
    fixture.rows.map((r) => `${r.id}/${r.seed}/${r.route}/${r.difficulty}/${r.turnPolicy}`).sort(),
    [
      ...['gentle', 'standard', 'expert'].flatMap((d) =>
        ['immediate', 'grid-center'].map((c) => `home-signal/1/ordinary/${d}/${c}`),
      ),
      'home-signal/1/up-first/standard/immediate',
      'home-signal/1/dock-first/standard/immediate',
    ].sort(),
  );
  assert.deepEqual(
    fixture.rows
      .filter((r) => r.route === 'ordinary')
      .map((r) => `${r.difficulty}/${r.turnPolicy}`)
      .sort(),
    ['gentle', 'standard', 'expert']
      .flatMap((d) => ['immediate', 'grid-center'].map((c) => `${d}/${c}`))
      .sort(),
  );
  const dockFirst = fixture.rows.find((r) => r.route === 'dock-first');
  assert.equal(dockFirst.evidence.objectives[0][1], 'dock-relay');
  assert(
    fixture.rows
      .filter((r) => r.route !== 'dock-first')
      .every((r) => r.evidence.objectives[0][1] === 'north-relay'),
  );
  assert.equal(
    dockFirst.evidence.ticks,
    3450,
    'Retain the observed short clear, not a minimum-duration fiction',
  );
  assert.equal(fixture.rows.filter((r) => r.evidence.mastery).length, 2);
  assert.equal(
    fixture.rows.filter((r) => r.evidence.used.some(([id]) => id === 'home-dock')).length,
    2,
  );
  assert(
    fixture.rows.some((r) => r.evidence.ticksAfterRequiredObjectives === 3900),
    'Retain cleanup concern',
  );
  assert(
    fixture.rows.some(
      (r) => !r.evidence.roverEvents.some(([, type]) => type === 'rover.activated'),
    ),
    'Some legal wins bypass active roamer pressure',
  );
});

for (const row of fixture.rows)
  test(`field finale clear/replay/equal race: ${row.difficulty}/${row.turnPolicy}/${row.route}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const evidence = playApexFieldRoute(manifest, row, { race: true });
    assert.deepEqual(evidence, row.evidence);
    assert.equal(evidence.checkpoint, row.checkpoint);
    assert.equal(evidence.denominator, 1921);
    assert.equal(evidence.ticksAfterQuota, 0);
    assert.deepEqual(evidence.collectedBonusIds, []);
    for (const [tick, type] of evidence.roverEvents)
      if (type === 'rover.activated')
        assert(evidence.roverEvents.some(([t, e]) => e === 'rover.warning' && tick - t === 120));
  });

test('failed delayed routes remain explicit negative evidence, not adaptive qualification', () => {
  assert.deepEqual(
    fixture.delayedProbes.map((p) => `${p.route}/${p.seed}/${p.delay}`).sort(),
    ['ordinary', 'dock-first']
      .flatMap((route) => [30, 60, 120].map((delay) => `${route}/2/${delay}`))
      .sort(),
  );
  for (const probe of fixture.delayedProbes) {
    const row = fixture.rows.find(
      (r) => r.route === probe.route && r.difficulty === 'standard' && r.turnPolicy === 'immediate',
    );
    const actual = assessPressureRoute(
      resolveMission(project, row.id, { difficulty: row.difficulty }).level,
      {
        segments: row.segments.map(({ direction, ticks }) => [direction, ticks]),
        turnPolicy: row.turnPolicy,
        seed: probe.seed,
        initialDelayTicks: probe.delay,
      },
    );
    assert.deepEqual(actual, probe.metrics);
    assert.equal(actual.status, 'life-lost');
  }
});

test('rejected right-pocket control preserves both real clears and the unmotivated objective tail', () => {
  assert.equal(rejected.status, 'rejected-control');
  assert.equal(rejected.rows.length, 2);
  assert.deepEqual(
    rejected.rows.map((r) => `${r.id}/${r.seed}/${r.difficulty}/${r.turnPolicy}`).sort(),
    ['home-signal/1/expert/immediate', 'home-signal/1/standard/immediate'],
  );
  const before = compileContentProject(rejected.source);
  for (const row of rejected.rows) {
    const manifest = resolveMission(before, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const evidence = playApexFieldRoute(manifest, row);
    assert.equal(evidence.checkpoint, row.checkpoint);
    assert.equal(evidence.allRequiredCapturedTick, 3126);
    assert(evidence.ticksAfterRequiredObjectives >= 3480);
    assert.deepEqual(evidence.used, []);
    const atObjectives = evidence.closures.find((c) => c.tick === evidence.allRequiredCapturedTick);
    assert(atObjectives.coverage < 0.28);
  }
});
