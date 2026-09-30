import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemoIdle,
  createDemoPractice,
  createDemoCaptions,
  readDemoSettings,
} from '../demo-experience.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'practice-clock',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.9 },
  enemies: [{ id: 'anchor', type: 'bouncer', x: 39.5, y: 25.5, vx: 0, vy: 0 }],
};

test('idle countdown counts only contiguous eligible foreground frames', () => {
  const idle = createDemoIdle(1);
  assert.equal(idle.advance(0.25, true), false);
  assert.equal(idle.advance(30, true), false);
  for (let i = 0; i < 3; i++) assert.equal(idle.advance(0.25, true), false);
  assert.equal(idle.advance(0.25, false), false);
  for (let i = 0; i < 3; i++) assert.equal(idle.advance(0.25, true), false);
  assert.equal(idle.advance(0.25, true), true);
  idle.advance(0.25, true);
  idle.activity();
  for (let i = 0; i < 3; i++) assert.equal(idle.advance(0.25, true), false);
});

test('reduced-motion default is manual; malformed preferences fail safely', () => {
  const storage = (value) => ({ getItem: () => value });
  assert.deepEqual(readDemoSettings(storage(null), 'demo', true), {
    auto: false,
    collect: false,
    gameSounds: false,
    hidePictures: false,
  });
  assert.deepEqual(readDemoSettings(storage('{broken'), 'demo'), {
    auto: true,
    collect: false,
    gameSounds: false,
    hidePictures: false,
  });
  assert.deepEqual(readDemoSettings(storage('{"version":1,"auto":false,"collect":true}'), 'demo'), {
    auto: false,
    collect: true,
    gameSounds: false,
    hidePictures: false,
  });
  assert.deepEqual(
    readDemoSettings(storage('{"version":1,"auto":true,"collect":true,"extra":1}'), 'demo', true),
    { auto: false, collect: false, gameSounds: false, hidePictures: false },
  );
});

test('demo sound preference is opt-in and preserves existing v1 settings', () => {
  const stored = { version: 1, auto: false, collect: true, gameSounds: true };
  const storage = { getItem: () => JSON.stringify(stored) };
  assert.deepEqual(readDemoSettings(storage, 'demo'), {
    auto: false,
    collect: true,
    gameSounds: true,
    hidePictures: false,
  });
  stored.gameSounds = 'yes';
  assert.deepEqual(readDemoSettings(storage, 'demo'), {
    auto: true,
    collect: false,
    gameSounds: false,
    hidePictures: false,
  });
});

test('demo picture privacy is opt-in and survives existing v1 settings', () => {
  const stored = { version: 1, auto: true, collect: false, hidePictures: true };
  const storage = { getItem: () => JSON.stringify(stored) };
  assert.deepEqual(readDemoSettings(storage, 'demo'), {
    auto: true,
    collect: false,
    gameSounds: false,
    hidePictures: true,
  });
  stored.hidePictures = 'yes';
  assert.deepEqual(readDemoSettings(storage, 'demo'), {
    auto: true,
    collect: false,
    gameSounds: false,
    hidePictures: false,
  });
});

test('practice waits for fresh steering, consumes input at real ticks, and suspends long gaps', () => {
  const practice = createDemoPractice(createRun(level));
  let reads = 0;
  const controls = () => {
    reads++;
    return {};
  };
  practice.advance(0.1, controls);
  assert.equal(reads, 0);
  assert.equal(practice.state.tick, 0);
  practice.steer('down');
  practice.advance(FIXED_DT / 2, controls);
  assert.equal(reads, 0, 'an impulse is retained across a frame shorter than one tick');
  practice.advance(FIXED_DT / 2, controls);
  assert.equal(reads, 1);
  assert.equal(practice.state.tick, 1);
  const checkpoint = authoritativeCheckpoint(practice.state);
  assert.equal(practice.advance(8, controls).reason, 'frame-gap');
  assert.deepEqual(authoritativeCheckpoint(practice.state), checkpoint);
  practice.advance(0.1, controls);
  assert.equal(reads, 1, 'visibility return does not advance or consume input');
  practice.steer('right');
  practice.advance(FIXED_DT, controls);
  assert.equal(practice.state.tick, 2);
  const paused = authoritativeCheckpoint(practice.state);
  practice.pause();
  assert.deepEqual(
    authoritativeCheckpoint(practice.state),
    paused,
    'pausing preserves the displayed checkpoint',
  );
});

test('direct takeover applies its initiating action once at the first real tick without inventing steering', () => {
  for (const [action, field] of [
    ['ability', 'action'],
    ['pickup', 'pickup'],
    ['boost', 'boost'],
  ]) {
    const options = action === 'pickup' ? { classId: 'bomber' } : {};
    const source = {
      ...level,
      supplies: [{ id: 'home', x: level.spawn.x, y: level.spawn.y, radius: 2 }],
      objectives: [{ id: 'hidden', x: level.spawn.x, y: 8, required: false, hidden: true }],
    };
    const practice = createDemoPractice(createRun(source, options)),
      expected = createRun(source, options);
    practice.start({ action });
    assert.equal(practice.phase, 'playing');
    practice.advance(FIXED_DT / 2);
    assert.equal(practice.state.tick, 0, 'The pending first action survives a sub-tick frame.');
    practice.advance(FIXED_DT / 2);
    stepRun(expected, { [field]: true }, FIXED_DT);
    assert.deepEqual(authoritativeCheckpoint(practice.state), authoritativeCheckpoint(expected));
    const result = practice.advance(FIXED_DT);
    stepRun(expected, {}, FIXED_DT);
    assert.deepEqual(authoritativeCheckpoint(practice.state), authoritativeCheckpoint(expected));
    assert.ok(!result.events.some((event) => event.type === 'ability.rejected'));
  }
  const practice = createDemoPractice(createRun(level));
  practice.start({ direction: 'down', action: 'ability' });
  practice.pause();
  practice.steer('right');
  assert.ok(!practice.advance(FIXED_DT).events.some((event) => event.type === 'ability.used'));
});

test('captions use emitted core events and maintain a six-second reading interval', () => {
  const captions = createDemoCaptions();
  captions.reset();
  for (let i = 0; i < 23; i++) assert.equal(captions.advance(0.25), 'demo:tipStart');
  assert.equal(captions.advance(0.25, [{ type: 'lineImpact.seeded' }]), 'demo:tipImpact');
  assert.equal(captions.advance(0.25, [{ type: 'powerup.collected' }]), 'demo:tipImpact');
  for (let i = 0; i < 22; i++) assert.equal(captions.advance(0.25), 'demo:tipImpact');
  assert.equal(captions.advance(0.25), 'demo:tipPowerup');
});

function readCaption(captions, events = []) {
  let key = captions.advance(0.25, events);
  for (let index = 1; index < 24; index++) key = captions.advance(0.25);
  return key;
}

test('captions distinguish a real scan from other equipment without claiming a revealed objective', () => {
  for (const [classId, primitive, expected] of [
    ['scout', 'scan', 'demo:tipScan'],
    ['interceptor', 'shield', 'demo:tipAbility'],
  ]) {
    const run = createRun(level, { classId });
    stepRun(run, { action: true }, FIXED_DT);
    const used = run.events.find((event) => event.type === 'ability.used');
    assert.equal(used.primitive, primitive);
    assert.equal(run.objectives.length, 0, 'Using a scan need not find a hidden objective.');
    const captions = createDemoCaptions();
    captions.reset();
    assert.equal(readCaption(captions, run.events), expected);
    assert.equal(
      readCaption(captions, run.events),
      expected,
      'Repeated events do not duplicate it.',
    );
  }
});

test('same-tick real cut and relay capture keep distinct captions in order until scene reset', () => {
  const run = createRun({
    ...level,
    objectives: [{ id: 'hidden-relay', x: 20.5, y: 4.5, required: true, hidden: true }],
  });
  let captured;
  for (const direction of ['down', 'left', 'up'])
    for (let tick = 0; tick < 120; tick++) {
      stepRun(run, { direction }, FIXED_DT);
      if (run.events.some((event) => event.type === 'objective.captured'))
        captured = structuredClone(run.events);
    }
  assert.ok(captured, 'An ordinary closed cut captures the actual hidden relay.');
  assert.deepEqual(
    captured
      .filter((event) => ['cut.closed', 'objective.captured'].includes(event.type))
      .map((event) => event.type),
    ['cut.closed', 'objective.captured'],
  );
  assert.equal(run.objectives[0].captured, true);
  const captions = createDemoCaptions();
  captions.reset();
  assert.equal(readCaption(captions, [...captured, ...captured]), 'demo:tipClose');
  for (let index = 0; index < 23; index++)
    assert.equal(captions.advance(0.25, captured), 'demo:tipClose');
  assert.equal(captions.advance(0.25), 'demo:tipObjective');
  assert.equal(readCaption(captions, captured), 'demo:tipObjective');
  assert.equal(
    readCaption(captions, [{ type: 'ability.used', primitive: 'shield' }]),
    'demo:tipAbility',
  );
  captions.reset();
  captions.advance(0.25, captured);
  captions.reset();
  assert.equal(readCaption(captions), 'demo:tipStart', 'A new scene drops pending old lessons.');
  assert.equal(readCaption(captions, captured), 'demo:tipClose', 'A new scene may teach it again.');
});

function signalRun({ classId = 'scout', ...zone } = {}) {
  return createRun(
    {
      ...level,
      supplies: [{ id: 'home', ...level.spawn, radius: 2 }],
      signalZones: [
        {
          id: 'emitter',
          x: 23,
          y: 1,
          w: 3,
          h: 3,
          speedFactor: 0.5,
          disableBoost: true,
          lockAbility: false,
          ...zone,
        },
      ],
    },
    { classId },
  );
}

function enterSignal(run) {
  for (let tick = 0; tick < 120; tick++) {
    stepRun(run, { direction: 'down' }, FIXED_DT);
    const event = run.events.find((event) => event.type === 'signal.changed');
    if (event) return structuredClone(event);
  }
  assert.fail('The craft must enter the authored signal zone through normal movement.');
}

test('signal captions require an actual slowing or blocked-equipment event', () => {
  for (const zone of [
    { speedFactor: 0.5, disableBoost: false },
    { speedFactor: 1, disableBoost: true },
    { speedFactor: 1, disableBoost: false, lockAbility: true },
  ]) {
    const entered = enterSignal(signalRun(zone));
    assert.equal(entered.resistant, false);
    assert.deepEqual(entered.zoneIds, ['emitter']);
    const captions = createDemoCaptions();
    captions.reset();
    assert.equal(readCaption(captions, [entered]), 'demo:tipSignal');
  }
});

test('signal clearing, suppression, resistance and harmless zones never manufacture a jam caption', () => {
  const clearedRun = signalRun();
  enterSignal(clearedRun);
  let cleared;
  for (let tick = 0; tick < 240 && !cleared; tick++) {
    stepRun(clearedRun, { direction: 'down' }, FIXED_DT);
    cleared = clearedRun.events.find((event) => event.type === 'signal.changed');
  }
  assert.deepEqual(cleared.zoneIds, []);
  const suppressedRun = signalRun({ classId: 'bomber' });
  enterSignal(suppressedRun);
  stepRun(suppressedRun, { pickup: true, action: true }, FIXED_DT);
  const suppressed = suppressedRun.events.find((event) => event.type === 'signal.changed');
  assert.deepEqual(suppressed.zoneIds, []);
  assert.ok(suppressedRun.signalZones[0].suppressedUntil > suppressedRun.time);
  const resistant = enterSignal(signalRun({ classId: 'fiber' }));
  assert.equal(resistant.resistant, true);
  const harmless = enterSignal(signalRun({ speedFactor: 1, disableBoost: false }));
  for (const event of [cleared, suppressed, resistant, harmless, { type: 'signal.changed' }]) {
    const captions = createDemoCaptions();
    captions.reset();
    assert.equal(readCaption(captions, [event]), 'demo:tipStart');
  }
});
