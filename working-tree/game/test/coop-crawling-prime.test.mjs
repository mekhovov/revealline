import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { stepCoop, FIXED_DT } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';

const fixture = (seat = 0) =>
  createStudioTeamFixture({ arena: 'relay-yard', scenario: `crawling-p${seat + 1}` });
function view(width, motionScale = 1) {
  const calls = [],
    stack = [];
  const context = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          calls.push({ key, args });
          if (key === 'save') stack.push(true);
          if (key === 'restore') stack.pop();
          if (key === 'measureText') return { width: String(args[0]).length * 0.7 };
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = { width: 1152, height: 576, clientWidth: width, getContext: () => context };
  const painter = createCoopPainter(canvas),
    assets = {},
    frames = new Map();
  for (const seat of [1, 2])
    for (const treatment of ['compact', 'detailed']) {
      const id = `team.player.${seat}.crawling.${treatment}`,
        size = treatment === 'compact' ? 32 : 64;
      const asset = { id: `${id}.test`, revision: 1, kind: 'image' },
        image = { id, width: size, height: size };
      assets[id] = asset;
      frames.set(id, {
        asset,
        image,
        geometry: {
          frame: { x: 0, y: 0, width: size, height: size },
          pivot: { x: 0.5, y: 0.5 },
          occupiedBounds: null,
          nineSlice: null,
          rotors: [],
        },
      });
    }
  const snapshot = {
    resolved: { assets },
    image: (id) => frames.get(id) ?? null,
    fonts: { ui: 'Test', numeric: 'Test' },
    canvas: {
      motionScale,
      palette: {
        ink: '#ffffff',
        paper: '#071527',
        muted: '#a8b8cc',
        accent: '#ffd64a',
        safe: '#67aaff',
        danger: '#ff7169',
        field: '#10243e',
        grid: '#182b43',
        sky: '#233950',
        land: '#526e67',
      },
    },
  };
  painter.setPresentation(snapshot);
  return { painter, calls, stack, frames };
}

for (const seat of [0, 1])
  for (const [width, reduced, motionScale] of [
    [238, false, 1],
    [1152, true, 1],
    [1152, false, 0],
  ])
    test(`P${seat + 1} earned crawling primes held painter at width ${width}, reduced ${reduced}, motion ${motionScale}`, () => {
      const f = fixture(seat),
        initial = f.run,
        selected = structuredClone(initial),
        level = structuredClone(RELAY_YARD);
      const target = view(width, motionScale),
        samples = [];
      target.painter.paint(initial, { reduced });
      assert.equal(
        target.painter.actorFrame('pilot', seat).pilotState,
        'downed',
        'one still sample must not invent motion',
      );
      const returned = f.prime((run) => {
        assert.equal(f.run, initial, 'partial primer must not publish intermediate state');
        samples.push({ reference: run, state: structuredClone(run) });
        target.painter.paint(run, { reduced });
      });
      assert.equal(samples.length, 2);
      assert.equal(samples[0].reference, samples[1].reference);
      assert.equal(returned, samples[1].reference);
      assert.equal(f.run, returned);
      assert.notEqual(f.run, initial);
      assert.equal(samples[0].state.tick, 494);
      assert.equal(samples[1].state.tick, 495);
      assert.deepEqual(
        samples[1].state,
        selected,
        'prime ends at the exact command-earned selected state',
      );
      assert.deepEqual(f.run, selected);
      const dx = samples[1].state.players[seat].x - samples[0].state.players[seat].x;
      assert.ok(seat === 0 ? dx > 0 : dx < 0);
      assert.equal(samples[0].state.players[seat].status, 'downed');
      assert.equal(samples[1].state.players[seat].status, 'downed');
      const replay = structuredClone(samples[0].state);
      stepCoop(
        replay,
        [0, 1].map((id) => ({
          direction: id === seat ? (seat === 0 ? 'right' : 'left') : null,
          boost: false,
          support: false,
        })),
        FIXED_DT,
      );
      assert.deepEqual(replay, selected, 'the primer is one actual public-command simulation step');
      const slot = `team.player.${seat + 1}.crawling.${width < 480 ? 'compact' : 'detailed'}`;
      assert.equal(target.painter.actorFrame('pilot', seat).sourceSlot, slot);
      assert.equal(target.painter.actorFrame('pilot', seat).pilotState, 'crawling');
      assert.ok(
        target.calls.some(
          (call) => call.key === 'drawImage' && call.args[0] === target.frames.get(slot).image,
        ),
      );
      for (let paint = 0; paint < 20; paint++) target.painter.paint(f.run, { reduced });
      assert.equal(
        target.painter.actorFrame('pilot', seat).pilotState,
        'crawling',
        'held scene retains observed movement',
      );
      assert.deepEqual(f.run, selected, 'paused/reduced repaint never advances the simulation');
      assert.deepEqual(RELAY_YARD, level, 'authored arena remains unchanged');
      assert.equal(target.stack.length, 0);
    });

for (const failAt of [1, 2])
  test(`primer observer failure ${failAt} leaves clock, identity, cursor and retry opportunity unchanged`, () => {
    const f = fixture(),
      control = fixture(),
      initial = f.run,
      before = structuredClone(initial),
      target = view(238);
    let calls = 0;
    assert.throws(
      () =>
        f.prime((run) => {
          target.painter.paint(run);
          if (++calls === failAt) throw new Error('modeled painter failure');
        }),
      /modeled painter failure/,
    );
    assert.equal(f.run, initial);
    assert.deepEqual(f.run, before);
    assert.equal(calls, failAt);
    assert.doesNotThrow(() => f.prime((run) => target.painter.paint(run)));
    assert.equal(target.painter.actorFrame('pilot', 0).pilotState, 'crawling');
    assert.throws(() => f.prime(() => {}), /only once/);
    for (const dt of [FIXED_DT / 2, FIXED_DT / 2, 8 * FIXED_DT, 1 / 90, 8 * FIXED_DT]) {
      f.advance(dt);
      control.advance(dt);
      assert.deepEqual(
        f.run,
        control.run,
        'successful/retried prime does not consume trace cursor or accumulator',
      );
    }
  });

test('invalid primer and invalid elapsed time preserve readiness; positive advance closes it', () => {
  const f = fixture(),
    initial = f.run;
  for (const observer of [null, undefined, 42, {}])
    assert.throws(() => f.prime(observer), TypeError);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(f.advance(dt), initial);
  assert.doesNotThrow(() => f.prime(() => {}));
  f.reset();
  const selected = structuredClone(f.run);
  f.advance(FIXED_DT / 2);
  assert.deepEqual(f.run, selected, 'fractional frame has not completed a step');
  assert.throws(() => f.prime(() => {}), /before advancing/);
});

test('explicit reset and bounded-loop reset reopen truthful priming without moving selected clock', () => {
  const f = fixture(1),
    target = view(238),
    selected = structuredClone(f.run);
  const prime = () => f.prime((run) => target.painter.paint(run, { reduced: true }));
  prime();
  f.advance(8 * FIXED_DT);
  const old = f.run;
  f.reset();
  assert.notEqual(f.run, old);
  assert.deepEqual(f.run, selected);
  prime();
  assert.equal(target.painter.actorFrame('pilot', 1).pilotState, 'crawling');
  const primed = f.run;
  for (let frame = 0; frame < 100 && f.run === primed; frame++) f.advance(8 * FIXED_DT);
  assert.notEqual(f.run, primed, 'fixture reaches its existing bounded reset');
  assert.deepEqual(f.run, selected);
  prime();
  assert.equal(target.painter.actorFrame('pilot', 1).pilotState, 'crawling');
  assert.deepEqual(f.run, selected);
});

test('initial scene primes one authentic sample and cannot invent crawling', () => {
  const f = createStudioTeamFixture(),
    target = view(238),
    before = structuredClone(f.run);
  let calls = 0;
  f.prime((run) => {
    calls++;
    target.painter.paint(run, { reduced: true });
  });
  assert.equal(calls, 1);
  assert.deepEqual(f.run, before);
  assert.equal(target.painter.actorFrame('pilot', 0).pilotState, 'normal');
  assert.equal(target.painter.actorFrame('pilot', 1).pilotState, 'normal');
});

test('normal playback leaves crawling when the recorded trace releases movement', () => {
  const f = fixture(),
    control = fixture(),
    target = view(238);
  f.prime((run) => target.painter.paint(run));
  for (let tick = 0; tick < 60; tick++) {
    f.advance(FIXED_DT);
    control.advance(FIXED_DT);
    target.painter.paint(f.run);
    assert.deepEqual(f.run, control.run);
  }
  assert.equal(f.run.tick, 555);
  assert.equal(target.painter.actorFrame('pilot', 0).pilotState, 'crawling');
  f.advance(FIXED_DT);
  control.advance(FIXED_DT);
  target.painter.paint(f.run);
  assert.deepEqual(f.run, control.run, 'prime preserves the exact trace segment boundary');
  assert.equal(f.run.tick, 556);
  assert.equal(f.run.players[0].status, 'downed');
  assert.equal(
    target.painter.actorFrame('pilot', 0).pilotState,
    'downed',
    'released input cannot retain a fabricated crawling pose',
  );
});
