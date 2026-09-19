import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { classicView } from '../ui/classic-view.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import {
  flightInformationSnapshot,
  flightInformationBatch,
  flightEventKind,
} from '../ui/flight-information-source.mjs';

const host = { started: true, paused: false };
const owner = { attempt: 'accepted-attempt', generation: 3 };
const pack = JSON.parse(
  readFileSync(new URL('../content/packs/sentinel-relay.json', import.meta.url)),
);
const proof = JSON.parse(readFileSync(new URL('../replays/sentinel-routes.json', import.meta.url)));
const fixture = (classic = true) => ({
  version: classic ? 'xonix-level.v4' : 'xonix-level.v1',
  id: 'hud-source-contract',
  revision: '1',
  name: 'HUD source contract',
  width: classic ? 72 : 48,
  height: 36,
  ...(classic
    ? { encounter: null, classic: { version: 'classic.v1', terrain: [], powerups: [] } }
    : {}),
  spawn: { x: 40.5, y: 0.5 },
  goal: { coverage: 0.9 },
  enemies: [
    {
      id: 'lane',
      type: 'lane-boss',
      x: 25.5,
      y: 15.5,
      axis: 'horizontal',
      warningSeconds: 1,
      activeSeconds: 0.5,
      period: 4,
    },
  ],
  objectives: [
    { id: 'required', x: 45.5, y: 15.5, required: true },
    { id: 'optional', x: 44.5, y: 14.5, required: false },
  ],
});
const ticks = (run, count) => {
  for (let i = 0; i < count; i++) stepRun(run, {}, FIXED_DT);
};
const event = (type, extra = {}) => ({ type, tick: 20, time: 0.2, ...extra });
const caption = (eventIndex, fullText, cue = null) => ({
  eventIndex,
  fullText,
  cue,
  expiresAt: 5.2,
});
const batch = (events, messages = []) =>
  flightInformationBatch({ owner, sequence: 4, events, messages });

test('real Classic run preserves existing projections and required-objective contract without mutation', () => {
  const run = createRun(fixture());
  run.objectives[0].captured = true;
  const before = JSON.stringify(run);
  const snapshot = flightInformationSnapshot(run, host);
  assert.deepEqual(snapshot.classic, classicView(run));
  assert.deepEqual(snapshot.encounter, encounterView(run));
  assert.deepEqual(snapshot.objectives, { done: 1, total: 1 });
  assert.deepEqual(snapshot.issues, []);
  assert.equal(snapshot.classicExpected, true);
  assert.equal(snapshot.encounterExpected, false);
  assert.equal(JSON.stringify(run) === before, true, 'No simulation mutation');
  assert.equal(Object.isFrozen(run), false);
  assert.equal(Object.isFrozen(snapshot.laneBosses[0]), true);
  assert.equal(snapshot.laneBosses[0].phase, 'idle');
});

for (const classic of [false, true])
  test(`${classic ? 'Classic' : 'legacy'} lane phases follow actual engine state and seconds clock`, () => {
    const run = createRun(fixture(classic));
    for (const count of [241, 121, 61]) {
      ticks(run, count);
      const enemy = run.enemies[0];
      const lane = flightInformationSnapshot(run, host).laneBosses[0];
      assert.equal(lane.phase, enemy.bossPhase);
      assert.equal(lane.axis, enemy.axis);
      assert.equal(lane.lane, enemy.lane);
      assert.equal(lane.clock, classic ? 'actor-seconds' : 'simulation-seconds');
      const deadline = {
        warning: enemy.warningUntil,
        active: enemy.activeUntil,
        idle: enemy.nextWarningAt,
      }[lane.phase];
      assert.equal(
        lane.seconds,
        Math.max(0, deadline - (classic ? run.classic.actorTime : run.time)),
      );
    }
    assert.equal(run.enemies[0].bossPhase, 'idle');
  });

test('freeze holds the lane actor clock while simulation time and effect expiry continue', () => {
  const run = createRun(fixture());
  ticks(run, 241);
  const initial = flightInformationSnapshot(run, host).laneBosses[0];
  assert.equal(initial.phase, 'warning');
  run.classic.effects['enemy-freeze'] = { from: run.tick, until: run.tick + 120 };
  const beforeTime = run.time;
  ticks(run, 60);
  const held = flightInformationSnapshot(run, host).laneBosses[0];
  assert.equal(held.clockFrozen, true);
  assert.equal(held.suppressed, true);
  assert.equal(held.seconds, initial.seconds);
  assert.ok(run.time > beforeTime);
  ticks(run, 61);
  assert.equal(flightInformationSnapshot(run, host).laneBosses[0].clockFrozen, false);
});

test('individual stun suppresses a lane without freezing its clock or recomputing its phase', () => {
  const run = createRun(fixture());
  ticks(run, 241);
  run.ability.fields.push({ kind: 'stun-field', x: 25.5, y: 15.5, radius: 2, until: run.time + 1 });
  ticks(run, 1);
  const before = flightInformationSnapshot(run, host).laneBosses[0];
  ticks(run, 30);
  const after = flightInformationSnapshot(run, host).laneBosses[0];
  assert.equal(after.stunned, true);
  assert.equal(after.suppressed, true);
  assert.equal(after.clockFrozen, false);
  assert.ok(after.seconds < before.seconds);
  assert.equal(after.phase, run.enemies[0].bossPhase);
});

test('missing Classic projection and missing lane fields remain explicit unknown information', () => {
  const run = createRun(fixture());
  run.classic.actorTick = -1;
  const malformed = flightInformationSnapshot(run, host);
  assert.equal(malformed.classic, null);
  assert.ok(malformed.issues.includes('classic-projection'));
  assert.ok(malformed.issues.includes('lane-boss:lane'));
  assert.deepEqual(malformed.laneBosses, []);
  const second = createRun(fixture(false));
  delete second.enemies[0].bossPhase;
  assert.ok(flightInformationSnapshot(second, host).issues.includes('lane-boss:lane'));
});

test('host states and terminal status survive unchanged; terminal countdowns are not live', () => {
  const run = createRun(fixture());
  for (const status of ['running', 'respawning', 'won', 'lost']) {
    run.status = status;
    const snapshot = flightInformationSnapshot(run, { started: false, paused: true });
    assert.equal(snapshot.status, status);
    assert.equal(snapshot.started, false);
    assert.equal(snapshot.paused, true);
    if (status === 'won' || status === 'lost') assert.equal(snapshot.laneBosses[0].seconds, 0);
  }
  run.status = 'future-status';
  assert.ok(flightInformationSnapshot(run, host).issues.includes('status'));
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: authored legal encounter route retains exact view and typed lane facts`, () => {
    const route = proof.routes.find(
      (item) =>
        item.turnPolicy === turnPolicy && item.variant === 'ordinary' && item.classId === 'scout',
    );
    const run = createRun(pack.campaigns[0].levels[0], {
      turnPolicy,
      classRecipes: pack.classRecipes,
    });
    const phases = new Set();
    for (const segment of route.segments) {
      if (segment.releaseBefore) releaseInputs(run);
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(run, segment.input, FIXED_DT);
        if (![240, 241, 1084, 1265, 1505, 1589, 1791, 1792].includes(run.tick)) continue;
        const before = JSON.stringify(run);
        const snapshot = flightInformationSnapshot(run, host);
        assert.deepEqual(snapshot.issues, []);
        assert.deepEqual(snapshot.encounter, encounterView(run));
        assert.equal(snapshot.encounterExpected, true);
        assert.equal(snapshot.encounterLane.axis, run.encounter.axis);
        assert.equal(snapshot.encounterLane.lane, run.encounter.lane);
        assert.equal(snapshot.encounterLane.clock, 'simulation-ticks');
        assert.equal(
          snapshot.encounterLane.marked,
          ['warning', 'active'].includes(run.encounter.phase),
        );
        assert.equal(JSON.stringify(run) === before, true, 'No simulation mutation');
        phases.add(snapshot.encounter.phase);
      }
    }
    assert.deepEqual([...phases].sort(), [
      'active',
      'defeated',
      'delay',
      'open',
      'transition',
      'warning',
    ]);
  });

test('complete feedback preserves earlier danger and last shield caption without inventing life loss', () => {
  const events = [
    event('lineImpact.arrived', { id: 'spark-1' }),
    event('shield.absorbed', { actorId: 'enemy-1' }),
  ];
  const messages = [
    caption(0, 'The travelling impact reached your craft. One life lost.'),
    caption(1, 'Shield absorbed the hit. Your unfinished line is cancelled; no life lost.'),
  ];
  const before = structuredClone({ events, messages });
  const feedback = batch(events, messages);
  assert.equal(feedback.events.length, 2);
  assert.equal(feedback.messages.length, 2);
  assert.equal(feedback.lastCaption.fullText, messages[1].fullText);
  assert.equal(feedback.events[1].sourceId, 'enemy-1');
  assert.equal('lifeLost' in feedback, false);
  assert.deepEqual({ events, messages }, before);
  assert.equal(Object.isFrozen(events[0]), false);
});

test('conditional cut-start has no fabricated caption; complete source events and repeated actors stay ordered', () => {
  const events = [
    event('cut.started'),
    event('boss.warning', { id: 'a', lane: 2.5, activeAt: 3.5 }),
    event('boss.warning', { id: 'b', lane: 7.5, activeAt: 3.5 }),
    event('boss.warning', { id: 'a', lane: 2.5, activeAt: 3.5 }),
  ];
  const feedback = batch(events, [
    caption(1, 'Lane A'),
    caption(2, 'Lane B'),
    caption(3, 'Lane A'),
  ]);
  assert.deepEqual(
    feedback.messages.map((item) => item.index),
    [1, 2, 3],
  );
  assert.deepEqual(
    feedback.events.map((item) => item.event),
    events,
  );
  assert.equal(feedback.messages[0].event.activeAt, 3.5);
  assert.equal(batch([event('cut.started')]).lastCaption, null);
});

test('unknown typed events preserve complete explanations and raw facts even without a caption', () => {
  const feedback = batch(
    [event('new.role', { detail: { requiredAction: 'future-action' } }), event('another.role')],
    [caption(0, 'Повний невідомий опис. Retain every word.', 'custom-cue')],
  );
  assert.equal(feedback.unknownEvents.length, 2);
  assert.equal(feedback.messages[0].kind, 'unknown');
  assert.equal(feedback.lastCaption.fullText, 'Повний невідомий опис. Retain every word.');
  assert.equal(feedback.lastCaption.cue, 'custom-cue');
  assert.equal(feedback.lastCaption.expiresAt, 5.2);
  assert.equal(feedback.events[0].event.detail.requiredAction, 'future-action');
});

test('event roles are exact typed classifications, independent of prose or prototype keys', () => {
  for (const type of ['cells.claimed', 'capture.stopped', 'class.switched', 'powerup.collected'])
    assert.equal(flightEventKind(type), 'ordinary');
  for (const type of ['lineImpact.seeded', 'player.failed', 'boss.warning', 'pressure.committed'])
    assert.equal(flightEventKind(type), 'critical');
  for (const type of ['fake.warning', 'constructor', '__proto__', null])
    assert.equal(flightEventKind(type), 'unknown');
  const feedback = batch(
    [event('powerup.collected', { kind: 'enemy-freeze', gain: 1 })],
    [caption(0, 'Threat warning prose')],
  );
  assert.equal(feedback.messages[0].kind, 'ordinary');
  assert.equal(feedback.messages[0].event.kind, 'enemy-freeze');
});

test('several engine ticks in one call retain identity; owner tokens are copied without inferring a new run', () => {
  const feedback = batch(
    [event('cells.claimed'), event('capture.stopped', { tick: 21, time: 0.21 })],
    [caption(0, 'Secured', 'secured'), caption(1, 'Stopped', 'secured-stopped')],
  );
  assert.deepEqual(
    feedback.events.map((item) => item.tick),
    [20, 21],
  );
  assert.deepEqual(feedback.owner, owner);
  assert.notEqual(feedback.owner, owner);
  assert.equal(feedback.sequence, 4);
  assert.equal(feedback.lastCaption.cue, 'secured-stopped');
  assert.equal(Object.isFrozen(feedback.events[0].event), true);
  assert.equal(Object.isFrozen(owner), false);
});

test('malformed ownership, event clocks and out-of-order warning observations are rejected', () => {
  assert.throws(
    () =>
      flightInformationBatch({
        owner: { attempt: 'a', generation: -1 },
        sequence: 0,
        events: [],
        messages: [],
      }),
    TypeError,
  );
  assert.throws(() => batch([{ type: 'boss.warning' }]), TypeError);
  const events = [event('boss.warning'), event('cells.claimed')];
  assert.throws(() => batch(events, [caption(2, 'outside')]), TypeError);
  assert.throws(() => batch(events, [caption(1, 'later'), caption(0, 'earlier')]), TypeError);
  assert.throws(
    () => batch(events, [{ eventIndex: 0, fullText: 'missing original cue and expiry' }]),
    TypeError,
  );
});

test('missing encounter deadline or actor clock cannot present an unexplained zero/NaN countdown', () => {
  const legacy = createRun(pack.campaigns[0].levels[0], { classRecipes: pack.classRecipes });
  delete legacy.encounter.phaseEndTick;
  assert.ok(flightInformationSnapshot(legacy, host).issues.includes('encounter-clock'));
  const classicLevel = {
    ...pack.campaigns[0].levels[0],
    version: 'xonix-level.v4',
    width: 72,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
  };
  const classic = createRun(classicLevel, { classRecipes: pack.classRecipes });
  delete classic.classic.actorTick;
  assert.ok(flightInformationSnapshot(classic, host).issues.includes('encounter-clock'));
});
