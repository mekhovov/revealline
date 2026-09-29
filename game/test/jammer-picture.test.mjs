import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { updateSignal } from '../core/systems.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createJammerPictureFilter, jammerPictureStrength } from '../ui/jammer-picture.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const presets = read('../../authoring/motion-lab/presets.json');
const theme = read('../content/themes.json').themes[0];
const level = {
  version: 'xonix-level.v1',
  id: 'picture-radio',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.8 },
  enemies: [{ id: 'e', type: 'bouncer', x: 40.5, y: 24.5, vx: 0, vy: 0 }],
  signalZones: [
    {
      id: 'radio',
      x: 20,
      y: 1,
      w: 8,
      h: 10,
      speedFactor: 0.5,
      disableBoost: true,
      lockAbility: true,
    },
  ],
};
const pixels = (width, height, offset = 0) =>
  new Uint8ClampedArray(
    Array.from({ length: width * height }, (_, index) => [
      80 + ((index + offset) % 64),
      112 + ((index * 3 + offset) % 64),
      144 + ((index * 7 + offset) % 64),
      255,
    ]).flat(),
  );
const image = (width = 64, height = 32, offset = 0) => ({
  width,
  height,
  pixels: pixels(width, height, offset),
});
function canvasFactory(created = []) {
  return () => {
    const canvas = { width: 0, height: 0, reads: 0, writes: 0 };
    const context = {
      drawImage(source) {
        canvas.original = source;
      },
      getImageData() {
        canvas.reads++;
        if (canvas.original?.unreadable) throw Error('Tainted source');
        return {
          data:
            canvas.original?.pixels?.length === canvas.width * canvas.height * 4
              ? canvas.original.pixels.slice()
              : pixels(canvas.width, canvas.height),
          width: canvas.width,
          height: canvas.height,
        };
      },
      putImageData(frame) {
        canvas.writes++;
        canvas.pixels = frame.data.slice();
      },
    };
    canvas.getContext = () => context;
    created.push(canvas);
    return canvas;
  };
}
function surface() {
  const calls = [],
    stack = [],
    values = { globalAlpha: 1, imageSmoothingEnabled: true, fillStyle: '', strokeStyle: '' };
  const ctx = new Proxy(
    { canvas: { width: 768, height: 576, clientWidth: 768 } },
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
      set(_, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}
function painter(options = {}) {
  const result = new BoardPainter(presets, options);
  result.theme = theme;
  result.body = presets.characters['neutral-marker'];
  result.recipe = presets.animationRecipes[result.body.animationRecipe];
  result.background = image();
  result.image = { width: 32, height: 32, label: 'sharp player' };
  return result;
}
function jammedRun() {
  const run = createRun(level);
  stepRun(run, { direction: 'down' }, 0.5);
  assert.ok(run.signal.zoneIds.includes('radio'));
  return run;
}
const pictureCall = (drawing) => drawing.calls.find((call) => call.op === 'drawImage');
const otherCalls = (drawing) => drawing.calls.filter((call) => call !== pictureCall(drawing));
let sentinelLevel;
function sentinelRun() {
  sentinelLevel ??= resolveMission(
    compileContentProject(createAuthoredJourneyRoute('whole-spatial-v25').source),
    'relay-perimeter',
  ).level;
  return createRun(sentinelLevel);
}
function until(run, condition) {
  for (let tick = 0; tick < 2400 && !condition(); tick++) {
    assert.equal(run.status, 'running');
    stepRun(run, {}, FIXED_DT);
  }
  assert.ok(condition(), 'The authoritative timed phase should be reached within its cycle.');
}
function activeSentinelRun() {
  const run = sentinelRun();
  until(run, () => run.encounter.phase === 'active');
  return run;
}

test('the actual Whole Journey Relay perimeter cycle gives a mild warning, strong active interference, then a clear rest', () => {
  const run = sentinelRun();
  assert.equal(run.levelId, 'relay-perimeter');
  assert.deepEqual(run.signal.zoneIds, []);
  assert.equal(run.encounter.phase, 'delay');
  assert.equal(jammerPictureStrength(run), 0);
  until(run, () => run.encounter.phase === 'warning');
  assert.ok(Number.isFinite(run.encounter.lane));
  const warning = jammerPictureStrength(run);
  assert.ok(warning > 0 && warning < 0.5);
  until(run, () => run.encounter.phase === 'active');
  const active = jammerPictureStrength(run),
    before = authoritativeCheckpoint(run);
  assert.ok(active > warning && active <= 1);
  assert.equal(jammerPictureStrength(run), active);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  until(run, () => run.encounter.phase === 'rest');
  assert.equal(jammerPictureStrength(run), 0);
  assert.equal(run.lives, run.rules.lives);
});

test('legacy lane-boss cycles follow their own phase, not zone resistance or an invented picture clock', () => {
  const run = createRun(
    {
      ...level,
      signalZones: [],
      enemies: [
        {
          id: 'emitter',
          type: 'lane-boss',
          x: 35.5,
          y: 20.5,
          axis: 'horizontal',
          warningSeconds: 0.5,
          activeSeconds: 0.2,
          period: 3,
        },
      ],
    },
    { classId: 'fiber' },
  );
  const actor = run.enemies[0];
  assert.equal(jammerPictureStrength(run), 0);
  assert.equal(run.signal.resistant, true);
  until(run, () => actor.bossPhase === 'warning');
  const warning = jammerPictureStrength(run);
  assert.ok(warning > 0);
  until(run, () => actor.bossPhase === 'active');
  const active = jammerPictureStrength(run);
  assert.ok(active > warning);
  actor.stunnedUntil = run.time + 1;
  assert.equal(jammerPictureStrength(run), 0);
  actor.stunnedUntil = run.time;
  assert.equal(jammerPictureStrength(run), active);
  for (const lane of [null, undefined, NaN, Infinity])
    assert.equal(jammerPictureStrength({ ...run, enemies: [{ ...actor, lane }] }), 0);
  until(run, () => actor.bossPhase === 'idle');
  assert.equal(jammerPictureStrength(run), 0);
});

test('timed sentinel interference respects suppression, ownership, inactive phases and terminal states', () => {
  const run = activeSentinelRun(),
    active = jammerPictureStrength(run),
    source = run.enemies.find((enemy) => enemy.id === run.level.encounter.enemyId),
    before = authoritativeCheckpoint(run);
  for (const phase of ['delay', 'rest', 'open', 'transition', 'defeated', 'idle', 'cooldown'])
    assert.equal(jammerPictureStrength({ ...run, encounter: { ...run.encounter, phase } }), 0);
  for (const lane of [null, undefined, NaN, Infinity])
    assert.equal(jammerPictureStrength({ ...run, encounter: { ...run.encounter, lane } }), 0);
  assert.equal(
    jammerPictureStrength({ ...run, encounter: { ...run.encounter, defeated: true } }),
    0,
  );
  for (const enemies of [
    [],
    [{ ...source, id: 'another-sentinel' }],
    [{ ...source, type: 'bouncer' }],
    [{ ...source, stunnedUntil: run.time + 1 }],
  ])
    assert.equal(jammerPictureStrength({ ...run, enemies }), 0);
  assert.equal(
    jammerPictureStrength({ ...run, enemies: [{ ...source, stunnedUntil: run.time }] }),
    active,
  );
  for (const status of ['lost', 'won', 'respawning'])
    assert.equal(jammerPictureStrength({ ...run, status }), 0);
  assert.equal(jammerPictureStrength(run, { fullReveal: true }), 0);
  const frozen = (from, until) => ({
    ...run,
    classic: {
      ...run.classic,
      effects: { ...run.classic.effects, 'enemy-freeze': { from, until } },
    },
  });
  assert.equal(jammerPictureStrength(frozen(run.tick, run.tick + 30)), 0);
  assert.equal(jammerPictureStrength(frozen(run.tick + 1, run.tick + 30)), active);
  assert.equal(jammerPictureStrength(frozen(run.tick - 30, run.tick)), active);
  assert.equal(
    jammerPictureStrength({ ...run, signal: { ...run.signal, resistant: true } }),
    active,
  );
  const zone = jammedRun();
  assert.equal(
    jammerPictureStrength({ ...run, signal: zone.signal }),
    Math.max(active, jammerPictureStrength(zone)),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('the actual Relay perimeter picture changes beneath unchanged lane cues, masks and actors', () => {
  const run = activeSentinelRun(),
    before = authoritativeCheckpoint(run),
    original = image(),
    baseline = painter({
      jammerCanvasFactory: () => {
        throw Error('No pixel support');
      },
    }),
    active = painter({ jammerCanvasFactory: canvasFactory() }),
    a = surface(),
    b = surface();
  active.image = baseline.image;
  const options = { paused: true, backdrop: { image: original, fit: 'contain' } };
  baseline.draw(a.ctx, run, 0, options);
  active.draw(b.ctx, run, 0, options);
  assert.equal(pictureCall(a).args[0], original);
  assert.notEqual(pictureCall(b).args[0], original);
  assert.deepEqual(pictureCall(b).args.slice(1), pictureCall(a).args.slice(1));
  assert.deepEqual(
    otherCalls(b),
    otherCalls(a),
    'The timed sweep keeps all functional marks and actors sharp.',
  );
  assert.ok(
    b.calls.some((call) => call.op === 'fillRect' && call.globalAlpha === 0.48),
    'The active lane remains visible above the picture.',
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
  active.dispose();
  baseline.dispose();
});

test('picture jamming follows actual entry, exit, Fiber resistance and suppressed signal fields', () => {
  const run = createRun(level);
  assert.equal(
    jammerPictureStrength(run),
    0,
    'Merely installing an emitter does not jam the picture.',
  );
  stepRun(run, { direction: 'down' }, 0.5);
  const strength = jammerPictureStrength(run);
  assert.ok(strength > 0 && strength <= 1);
  stepRun(run, { direction: 'up' }, 1);
  assert.deepEqual(run.signal.zoneIds, []);
  assert.equal(jammerPictureStrength(run), 0);

  const fiber = createRun(level, { classId: 'fiber' });
  stepRun(fiber, { direction: 'down' }, 0.5);
  assert.ok(fiber.signal.zoneIds.length > 0);
  assert.equal(fiber.signal.resistant, true);
  assert.equal(jammerPictureStrength(fiber), 0);

  const suppressed = jammedRun();
  suppressed.ability.fields.push({
    kind: 'stun-field',
    x: 24,
    y: 6,
    radius: 8,
    until: suppressed.time + 2,
  });
  updateSignal(suppressed);
  assert.ok(suppressed.signalZones[0].suppressedUntil > suppressed.time);
  assert.deepEqual(suppressed.signal.zoneIds, []);
  assert.equal(jammerPictureStrength(suppressed), 0);
});

test('terminal and full-reveal states cannot keep stale jammer state on earned art', () => {
  const run = jammedRun(),
    before = authoritativeCheckpoint(run);
  assert.equal(jammerPictureStrength(run, { fullReveal: true }), 0);
  for (const status of ['won', 'lost', 'respawning', 'paused'])
    assert.equal(jammerPictureStrength({ ...run, status }), 0);
  assert.equal(jammerPictureStrength({}), 0);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('inactive jamming retains the exact original without allocating or reading pixels', () => {
  let allocations = 0;
  const original = image(),
    before = original.pixels.slice(),
    filter = createJammerPictureFilter({
      canvasFactory: () => {
        allocations++;
        throw Error('No active signal');
      },
    });
  assert.equal(filter.select(original), original);
  assert.equal(filter.select(original, { strength: 0, time: 100, animate: true }), original);
  assert.equal(allocations, 0);
  assert.deepEqual(original.pixels, before);
});

test('temporary jamming retains the original alpha footprint and restores its exact source on recovery', () => {
  const original = image(8, 4);
  for (let i = 3; i < original.pixels.length; i += 4) original.pixels[i] = (i * 17) % 256;
  const before = original.pixels.slice(),
    filter = createJammerPictureFilter({ canvasFactory: canvasFactory() }),
    frame = filter.select(original, { strength: 0.8, animate: true, time: 1 });
  assert.notEqual(frame, original);
  for (let i = 3; i < before.length; i += 4) assert.equal(frame.pixels[i], before[i]);
  assert.equal(filter.select(original, { strength: 0 }), original);
  assert.deepEqual(original.pixels, before);
});

test('active noise has one bounded cache, advances by frame and freezes in reduced/static selection', () => {
  const created = [],
    filter = createJammerPictureFilter({ canvasFactory: canvasFactory(created) }),
    original = image(),
    before = original.pixels.slice();
  const first = filter.select(original, { strength: 0.7, time: 0, animate: true }),
    firstPixels = first.pixels.slice();
  assert.notEqual(first, original);
  assert.notDeepEqual(firstPixels, original.pixels);
  assert.equal(filter.select(original, { strength: 0.7, time: 0.001, animate: true }), first);
  assert.deepEqual(first.pixels, firstPixels);
  filter.select(original, { strength: 0.7, time: 0.25, animate: true });
  assert.notDeepEqual(first.pixels, firstPixels);
  assert.equal(created.length, 1);
  assert.equal(first.reads, 1);
  const staticFrame = filter
    .select(original, { strength: 0.7, time: 20, animate: false })
    .pixels.slice();
  filter.select(original, { strength: 0.7, time: 40, animate: false });
  assert.deepEqual(first.pixels, staticFrame);
  assert.deepEqual(original.pixels, before);
  const bounded = filter.select({ width: 2048, height: 1024 }, { strength: 0.7 });
  assert.ok(bounded.width <= 512 && bounded.height <= 512);
  assert.equal(bounded.width / bounded.height, 2);
  assert.equal(first.width, 0, 'Replacing artwork releases the previous filtered surface.');
  filter.clear();
  assert.equal(bounded.width, 0);
  assert.equal(bounded.height, 0);
});

test('undecoded or unreadable ordinary art remains permitted and a new ready source can recover', () => {
  const created = [],
    filter = createJammerPictureFilter({ canvasFactory: canvasFactory(created) }),
    pending = { ...image(), complete: false },
    unreadable = { ...image(), unreadable: true };
  assert.equal(filter.select(pending, { strength: 0.7 }), pending);
  assert.equal(filter.select(unreadable, { strength: 0.7 }), unreadable);
  const reads = created.reduce((sum, canvas) => sum + canvas.reads, 0);
  assert.equal(filter.select(unreadable, { strength: 0.7, time: 2, animate: true }), unreadable);
  assert.equal(
    created.reduce((sum, canvas) => sum + canvas.reads, 0),
    reads,
  );
  pending.complete = true;
  assert.notEqual(filter.select(pending, { strength: 0.7 }), pending);
  const unavailable = createJammerPictureFilter({
    canvasFactory: () => {
      throw Error('No canvas');
    },
  });
  assert.equal(unavailable.select(pending, { strength: 0.7 }), pending);
});

for (const fit of ['contain', 'cover'])
  test(`${fit}: actual painter changes only the picture before opaque masks, terrain and sharp actors`, () => {
    const run = jammedRun(),
      before = authoritativeCheckpoint(run),
      original = image(),
      baseline = painter({
        jammerCanvasFactory: () => {
          throw Error('No pixel support');
        },
      }),
      active = painter({ jammerCanvasFactory: canvasFactory() }),
      a = surface(),
      b = surface();
    active.image = baseline.image;
    const options = { paused: true, backdrop: { image: original, fit } };
    baseline.draw(a.ctx, run, 0, options);
    active.draw(b.ctx, run, 0, options);
    assert.equal(pictureCall(a).args[0], original);
    assert.notEqual(pictureCall(b).args[0], original);
    assert.deepEqual(pictureCall(b).args.slice(1), pictureCall(a).args.slice(1));
    assert.deepEqual(otherCalls(b), otherCalls(a));
    assert.ok(
      b.calls.some(
        (call) => call.op === 'fillRect' && call.fillStyle === '#000000' && call.globalAlpha === 1,
      ),
    );
    assert.ok(b.calls.some((call) => call.op === 'drawImage' && call.args[0] === active.image));
    assert.deepEqual(authoritativeCheckpoint(run), before);
    active.dispose();
    baseline.dispose();
  });

test('renderer freezes paused and reduced picture noise, while terminal and gallery art stay clear', () => {
  const run = jammedRun(),
    created = [],
    active = painter({ jammerCanvasFactory: canvasFactory(created) });
  active.draw(surface().ctx, run, 0.1);
  const filtered = created[0],
    moving = filtered.pixels.slice();
  active.draw(surface().ctx, run, 0.5, { paused: true });
  assert.deepEqual(filtered.pixels, moving);
  active.draw(surface().ctx, run, 0.1, { reduced: true });
  const reduced = filtered.pixels.slice();
  active.draw(surface().ctx, run, 0.5, { reduced: true });
  assert.deepEqual(filtered.pixels, reduced);
  for (const status of ['won', 'lost']) {
    const terminal = surface();
    active.draw(terminal.ctx, { ...run, status }, 0, { fullReveal: status === 'won' });
    assert.equal(pictureCall(terminal).args[0], active.background);
  }
  const gallery = surface();
  active.drawGallery(gallery.ctx, { image: active.background });
  assert.equal(pictureCall(gallery).args[0], active.background);
  active.dispose();
  assert.equal(filtered.width, 0);
  assert.equal(filtered.height, 0);
});

test('two painter owners remain independent and hidden demo pictures never acquire a raw jammer path', () => {
  const run = jammedRun(),
    leftCanvases = [],
    rightCanvases = [],
    left = painter({ jammerCanvasFactory: canvasFactory(leftCanvases) }),
    right = painter({ jammerCanvasFactory: canvasFactory(rightCanvases) });
  left.draw(surface().ctx, run, 0.1);
  right.draw(surface().ctx, run, 0.1);
  assert.notEqual(leftCanvases[0], rightCanvases[0]);
  const rightBefore = rightCanvases[0].pixels.slice();
  left.draw(surface().ctx, run, 0.2);
  assert.deepEqual(rightCanvases[0].pixels, rightBefore);
  left.dispose();
  assert.ok(rightCanvases[0].width > 0);
  right.dispose();

  let hiddenJammerAllocations = 0;
  const hidden = painter({
    pictureCanvasFactory: canvasFactory(),
    jammerCanvasFactory: () => {
      hiddenJammerAllocations++;
      throw Error('Hidden demos already have signal concealment');
    },
  });
  const drawing = surface();
  hidden.draw(drawing.ctx, activeSentinelRun(), 0.1, { pictureVisibility: 'blurred' });
  assert.equal(hiddenJammerAllocations, 0);
  assert.notEqual(pictureCall(drawing).args[0], hidden.background);
  assert.ok(
    !drawing.calls.some((call) => call.op === 'drawImage' && call.args[0] === hidden.background),
  );
  hidden.dispose();
});
