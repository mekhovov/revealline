import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { PRESENTATION_INK } from '../ui/actor-presentation.mjs';

const presets = JSON.parse(
    readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  ),
  theme = JSON.parse(readFileSync(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)))
    .themes[0],
  disabled = Object.freeze({ captureAccent: false, eventAccents: false });

// Canvas command evidence only. Images are finite stand-ins; no raster, host,
// physical input or public-release qualification is claimed by these tests.
function surface() {
  const calls = [],
    stack = [],
    values = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1 };
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: 1152 } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in values) return values[key];
        return (...args) => {
          calls.push({ op: key, args, ...values });
          if (key === 'save') stack.push({ ...values });
          if (key === 'restore') Object.assign(values, stack.pop());
        };
      },
      set(_target, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}
function painter() {
  const p = new BoardPainter(presets);
  p.theme = theme;
  p.bodyId = 'neutral-marker';
  p.body = presets.characters[p.bodyId];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 768, height: 576, id: 'retained-picture' };
  // Decoding is outside the command comparison: explicitly unavailable enemy
  // bitmaps retain the real built-in silhouettes and functional draw paths.
  p.enemyBodies = { update() {}, current: () => null };
  return p;
}
function runFor(phase = 'warning') {
  const run = createRun({
    version: 'xonix-level.v4',
    id: 'feedback-comparison',
    revision: '1',
    name: 'Feedback comparison',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [{ id: 'hunter', type: 'bouncer', x: 23.5, y: 10.5, vx: 2, vy: 1, radius: 0.25 }],
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      enemyPressure: {
        version: 'enemy-pressure.v1',
        actors: [
          {
            id: 'hunter',
            mode: 'trail-pursuit',
            senseRadius: 20,
            scanTicks: 24,
            warningTicks: 60,
            commitTicks: 120,
            cooldownTicks: 180,
            leadTicks: 0,
          },
        ],
      },
    },
    rules: { moveSpeed: 12, lives: 3, stopOnCapture: true },
  });
  for (let i = 0; i < 400 && run.enemies[0].classic.pressure.phase !== phase; i++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.enemies[0].classic.pressure.phase, phase);
  return run;
}
function events(run) {
  return [
    { type: 'cells.claimed', indices: [1], tick: run.tick },
    { type: 'player.failed', x: 7.25, y: 9.5, tick: run.tick },
    { type: 'craft.redeployed', x: 3.5, y: 5.5, radius: 2, tick: run.tick },
    { type: 'shield.absorbed', x: 7.25, y: 9.5, tick: run.tick },
  ];
}
const texts = (calls) => calls.filter((call) => call.op === 'fillText').map((call) => call.args[0]);
const borderFlash = (calls) =>
  calls.filter((call) => call.op === 'strokeRect' && call.args.join() === '2,2,1148,572');
const captureRim = (calls) =>
  calls.filter(
    (call) =>
      call.op === 'fillRect' &&
      call.args[0] === 16 &&
      call.args[1] === 0 &&
      call.fillStyle === PRESENTATION_INK &&
      call.globalAlpha > 0 &&
      call.globalAlpha <= 0.2,
  );

for (const reduced of [false, true])
  test(`comparison defaults preserve complete Canvas command stream (reduced=${reduced})`, () => {
    const run = runFor(),
      before = authoritativeCheckpoint(run),
      baseline = surface(),
      basePainter = painter();
    basePainter.effectsFor(events(run), run);
    basePainter.draw(baseline.ctx, run, 0.04, { reduced });
    for (const options of [
      null,
      {},
      { captureAccent: true, eventAccents: true },
      { captureAccent: undefined, eventAccents: undefined },
      { trail: false, contacts: false, threats: false, actorReactions: false },
    ]) {
      const p = painter(),
        view = surface();
      p.effectsFor(events(run), run);
      p.draw(view.ctx, run, 0.04, { reduced, feedbackComparison: options });
      assert.deepEqual(view.calls, baseline.calls);
      assert.deepEqual(p.effects, basePainter.effects);
      assert.deepEqual(p.animation, basePainter.animation);
    }
    assert.deepEqual(authoritativeCheckpoint(run), before);
  });

for (const [phase, label] of [
  ['warning', 'AIM TRAIL'],
  ['committed', 'CHASE TRAIL'],
  ['cooldown', 'REST TRAIL'],
])
  test(`${phase}: disabling accents cannot hide live cut, contact, threat or functional status`, () => {
    const run = runFor(phase),
      before = authoritativeCheckpoint(run),
      baseline = surface(),
      actual = surface();
    painter().draw(baseline.ctx, run, 0.04);
    painter().draw(actual.ctx, run, 0.04, { feedbackComparison: disabled });
    assert.deepEqual(
      actual.calls,
      baseline.calls,
      'all underlying gameplay commands remain byte-for-byte identical without cosmetic events',
    );
    assert.ok(texts(actual.calls).includes(label));
    assert.ok(
      actual.calls.some(
        (call) => call.op === 'arc' && call.args[2] === run.rules.playerRadius * 16,
      ),
    );
    assert.ok(
      actual.calls.some((call) => call.op === 'stroke' && call.strokeStyle === PRESENTATION_INK),
      'active cut and contact core remain',
    );
    assert.deepEqual(authoritativeCheckpoint(run), before);
  });

test('capture toggle removes only safe-cell decoration and retains reveal cells, pressure and the new live cut', () => {
  const run = runFor(),
    before = authoritativeCheckpoint(run),
    enabled = painter(),
    disabledPainter = painter(),
    noEvent = painter(),
    a = surface(),
    b = surface(),
    c = surface();
  for (const p of [enabled, disabledPainter])
    p.effectsFor([{ type: 'cells.claimed', indices: [1], tick: run.tick }], run);
  enabled.draw(a.ctx, run, 0.04);
  disabledPainter.draw(b.ctx, run, 0.04, { feedbackComparison: { captureAccent: false } });
  noEvent.draw(c.ctx, run, 0.04);
  assert.ok(captureRim(a.calls).length);
  assert.equal(captureRim(b.calls).length, 0);
  assert.deepEqual(b.calls, c.calls, 'only the optional capture pulse disappeared');
  assert.equal(disabledPainter.effects[0].age, 0.04);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('event toggle keeps exact loss contact, local cause label, pickup/shield and recovery information', () => {
  const run = runFor();
  run.status = 'respawning';
  run.respawnAt = run.time + 1;
  const before = authoritativeCheckpoint(run),
    p = painter(),
    q = painter(),
    a = surface(),
    b = surface();
  p.effectsFor(events(run), run);
  q.effectsFor(events(run), run);
  p.draw(a.ctx, run, 0.04);
  q.draw(b.ctx, run, 0.04, { feedbackComparison: { eventAccents: false } });
  assert.equal(borderFlash(a.calls).length, 1);
  assert.equal(borderFlash(b.calls).length, 0);
  assert.deepEqual(texts(b.calls), texts(a.calls));
  assert.ok(texts(b.calls).some((text) => text.includes('LIFE')));
  assert.ok(texts(b.calls).some((text) => /SHIELD/i.test(text)));
  assert.ok(texts(b.calls).some((text) => /RECOVER/i.test(text)));
  const contact = b.calls.filter(
    (call) => call.op === 'translate' && call.args.join() === '116,152',
  );
  assert.equal(contact.length, 2, 'loss and shield still point at their actual event coordinate');
  assert.ok(
    b.calls.some((call) => call.op === 'fillRect' && call.args.join() === '-2,-4,4,8'),
    'local FPV loss marker remains',
  );
  assert.ok(
    captureRim(b.calls).length,
    'event toggle does not also disable the separate capture pulse',
  );
  assert.deepEqual(q.effects, p.effects);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('hidden accents age and expire; enabling them later cannot replay stale events', () => {
  const run = runFor(),
    p = painter();
  p.effectsFor(events(run), run);
  for (let i = 0; i < 8; i++) p.draw(surface().ctx, run, 0.1, { feedbackComparison: disabled });
  assert.equal(p.effects.length, 0);
  const actual = surface();
  p.draw(actual.ctx, run, 0.04);
  assert.equal(captureRim(actual.calls).length, 0);
  assert.equal(borderFlash(actual.calls).length, 0);
  assert.equal(
    texts(actual.calls).some((text) => text.includes('LIFE')),
    false,
  );
});

test('hidden accents preserve pause ownership and the existing terminal-failure clock exception', () => {
  const run = runFor(),
    p = painter();
  p.effectsFor(events(run), run);
  p.draw(surface().ctx, run, 0.1, { paused: true, feedbackComparison: disabled });
  assert.ok(p.effects.every((effect) => effect.age === 0));
  run.status = 'lost';
  const before = authoritativeCheckpoint(run);
  p.draw(surface().ctx, run, 0.1, {
    paused: true,
    defeatEffectsRunning: true,
    feedbackComparison: disabled,
  });
  assert.equal(p.effects.find((effect) => effect.type === 'player.failed').age, 0.1);
  assert.ok(
    p.effects
      .filter((effect) => effect.type !== 'player.failed')
      .every((effect) => effect.age === 0),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});
