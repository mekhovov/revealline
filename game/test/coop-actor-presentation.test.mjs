import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCoop, startCoop, pauseCoop, stepCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { actorDiameter } from '../ui/actor-presentation.mjs';
import {
  COOP_ACTOR_ROLES,
  createCoopActorPresentation,
} from '../couch/coop-actor-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';

const compiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const SLOTS = [
  [
    'player.scout.compact',
    '827da59e870daf2e8548168399449bd894b4cdf7953a1f8ca48a7ed6df8f8d91',
    325,
    32,
  ],
  [
    'player.scout.detailed',
    '3fa6527474d2da84fed128052df7ee8ac2b34a25eaf5a162d21be849a12fd65c',
    600,
    64,
  ],
  ['enemy.bouncer', 'e35ca174c360d5a572c72e6be448666cf3da1438cf0d91f8ea7ff8c221b8eb5e', 290, 32],
  [
    'enemy.border-patrol',
    '5c51f6d7b29af2e8be90adc5d01257f1b5d34ac5aaf0bb533fd2088bd944b683',
    295,
    32,
  ],
  [
    'enemy.relay-sentinel',
    '2d4e0eafa015c8e434082b8be0552556e0abfe057248233a701cac4d1b3f4cd0',
    515,
    64,
  ],
];
const palette = Object.freeze({
  ink: '#f6f3e8',
  paper: '#071527',
  muted: '#a8b8cc',
  accent: '#ffd64a',
  safe: '#67aaff',
  danger: '#ff7169',
  field: '#10243e',
  grid: '#182b43',
  sky: '#233950',
  land: '#526e67',
});
function prepared({ missing = null, motionScale = 1 } = {}) {
  const reads = [],
    images = new Map();
  let closed = 0;
  for (const [slot] of SLOTS) {
    const asset = compiled.resolved.assets[slot];
    images.set(
      slot,
      Object.freeze({
        image: Object.freeze({
          slot,
          width: asset.file.width,
          height: asset.file.height,
          close: () => closed++,
        }),
        asset,
        geometry: imagePresentation(asset),
      }),
    );
  }
  return {
    reads,
    images,
    closed: () => closed,
    snapshot: Object.freeze({
      resolved: compiled.resolved,
      canvas: { palette, motionScale },
      fonts: { ui: 'Prepared UI', numeric: 'Prepared Mono' },
      image(slot) {
        reads.push(slot);
        return slot === missing ? null : (images.get(slot) ?? null);
      },
    }),
  };
}
// This finite canvas records commands and prepared-object identity. Real PNG
// hashes/headers are checked separately; it does not decode pixels or prove contrast.
function surface(clientWidth = 1152) {
  const calls = [],
    stack = [];
  let values = { globalAlpha: 1, imageSmoothingEnabled: true };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in values) return values[name];
        return (...args) => {
          calls.push({ name, args, state: { ...values } });
          if (name === 'save') stack.push({ ...values });
          if (name === 'restore') values = stack.pop();
        };
      },
      set(_, name, value) {
        values[name] = value;
        return true;
      },
    },
  );
  return {
    ctx,
    calls,
    stack,
    canvas: { width: 1152, height: 576, clientWidth, getContext: () => ctx },
    reset: () => {
      calls.length = 0;
    },
  };
}
const neutral = () => [
  { direction: null, boost: false, support: false },
  { direction: null, boost: false, support: false },
];
const poses = (adapter, run) => [
  ...run.players.map((actor) => adapter.frame('pilot', actor.id)),
  ...run.enemies
    .filter((actor) => actor.active !== false)
    .map((actor) => adapter.frame('enemy', actor.id)),
  ...run.strongholds.map((actor) => adapter.frame('core', actor.id)),
];
const labels = (calls) => calls.filter((call) => call.name === 'fillText');

// The source slots are existing artwork, not newly produced Team character sets.
test('five approved source frames retain exact IDs, revisions, PNG hashes and dimensions', async () => {
  assert.deepEqual(compiled.resolved.theme, {
    id: 'fpv',
    revision: 26,
    name: compiled.resolved.theme.name,
  });
  assert.equal(compiled.resolved.collection, null);
  for (const [slot, sha, size, width] of SLOTS) {
    const asset = compiled.resolved.assets[slot],
      bytes = await readFile(
        new URL(`../presentation/compiled/${compiled.urls[sha]}`, import.meta.url),
      );
    assert.equal(asset.id, `${slot}.field-kit`);
    assert.equal(asset.revision, 2);
    assert.equal(asset.file.sha256, sha);
    assert.equal(bytes.length, size);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), width);
    assert.deepEqual(asset.geometry.frame, { x: 0, y: 0, width, height: width });
  }
});

test('explicit Team roles reuse prepared slots without changing actual types or run state', () => {
  const p = prepared(),
    adapter = createCoopActorPresentation(),
    run = createCoop(RELAY_YARD),
    before = structuredClone(run);
  adapter.setPresentation(p.snapshot);
  adapter.update(run);
  assert.equal(Object.isFrozen(COOP_ACTOR_ROLES.hunter), true);
  assert.deepEqual(adapter.frame('pilot', 0).sourceSlot, 'player.scout.detailed');
  assert.equal(adapter.frame('pilot', 1).role, 'team-pilot');
  for (const enemy of run.enemies) {
    const frame = adapter.frame('enemy', enemy.id);
    assert.equal(frame.type, enemy.type);
    assert.equal(frame.role, enemy.type === 'hunter' ? 'team-line-hunter' : 'team-field-bouncer');
    assert.equal(
      frame.sourceSlot,
      enemy.type === 'hunter' ? 'enemy.border-patrol' : 'enemy.bouncer',
    );
  }
  assert.equal(adapter.frame('core', run.strongholds[0].id).role, 'team-stronghold');
  assert.equal(
    new Set(poses(adapter, run).map((frame) => frame.id)).size,
    poses(adapter, run).length,
  );
  assert.deepEqual(run, before);
  assert.deepEqual(new Set(p.reads), new Set(SLOTS.map(([slot]) => slot)));
});

for (const [width, style, source] of [
  [1152, 'hybrid', 'detailed'],
  [479, 'hybrid', 'compact'],
  [1152, 'microtile', 'compact'],
  [640, 'props', 'detailed'],
]) {
  test(`Team ${width}px ${style} source detail and CSS body size stay separate from contact radii`, () => {
    const adapter = createCoopActorPresentation(),
      run = createCoop(RELAY_YARD),
      p = prepared(),
      before = structuredClone(run);
    adapter.setPresentation(p.snapshot);
    adapter.update(run, { canvasCSSWidth: width, style });
    assert.equal(adapter.frame('pilot', 0).sourceSlot, `player.scout.${source}`);
    for (const frame of poses(adapter, run)) {
      const core = frame.role === 'team-stronghold',
        css = (frame.diameter * width) / 1152;
      assert.equal(
        frame.diameter,
        actorDiameter({
          role: core ? 'boss' : 'enemy',
          style,
          screenScale: width / 1152,
          canvasCSSWidth: width,
        }),
      );
      assert.ok(css >= (width >= 480 ? 24 : 16) - 1e-9);
      assert.ok(css <= (core ? 40 : 32) + 1e-9);
    }
    assert.equal(adapter.frame('pilot', 0).radius, run.players[0].radius * 16);
    for (const enemy of run.enemies)
      assert.equal(adapter.frame('enemy', enemy.id).radius, enemy.radius * 16);
    assert.deepEqual(run, before);
  });
}

test('real successive ticks animate pilots; pause and repeated paints preserve every cosmetic clock', () => {
  const run = createCoop(FIRST_CONNECTION),
    control = createCoop(FIRST_CONNECTION),
    adapter = createCoopActorPresentation();
  adapter.setPresentation(prepared().snapshot);
  startCoop(run);
  startCoop(control);
  adapter.update(run);
  const initial = adapter.frame('pilot', 0);
  const input = neutral();
  input[0].direction = 'right';
  for (let i = 0; i < 10; i++) {
    stepCoop(run, input, 1 / 120);
    stepCoop(control, input, 1 / 120);
    adapter.update(run);
  }
  assert.ok(adapter.frame('pilot', 0).phase > initial.phase);
  assert.ok(adapter.frame('pilot', 0).x > initial.x);
  assert.deepEqual(run, control);
  pauseCoop(run);
  adapter.update(run);
  const held = poses(adapter, run),
    before = structuredClone(run);
  for (let i = 0; i < 10; i++) adapter.update(run);
  assert.deepEqual(poses(adapter, run), held);
  assert.deepEqual(run, before);
});

test('heading follows observed movement even when stale enemy velocity points elsewhere', () => {
  const run = createCoop(FIRST_CONNECTION),
    adapter = createCoopActorPresentation(),
    enemy = run.enemies[0];
  adapter.setPresentation(prepared().snapshot);
  startCoop(run);
  adapter.update(run, { reduced: true });
  enemy.x += 0.2;
  enemy.vx = 0;
  enemy.vy = -5;
  run.tick++;
  run.time += 1 / 120;
  const before = structuredClone(run);
  adapter.update(run, { reduced: true });
  assert.equal(adapter.frame('enemy', enemy.id).heading, Math.PI / 2);
  assert.deepEqual(run, before);
});

test('reduced motion and zero motion scale keep poses static while real movement still advances', () => {
  for (const options of [{ reduced: true }, { motionScale: 0 }]) {
    const run = createCoop(FIRST_CONNECTION),
      adapter = createCoopActorPresentation();
    adapter.setPresentation(prepared().snapshot);
    startCoop(run);
    adapter.update(run, options);
    const first = adapter.frame('pilot', 0),
      input = neutral();
    input[0].direction = 'right';
    for (let i = 0; i < 20; i++) {
      stepCoop(run, input, 1 / 120);
      adapter.update(run, options);
    }
    const final = adapter.frame('pilot', 0);
    assert.ok(final.x > first.x);
    assert.equal(final.phase, first.phase);
    assert.equal(final.travelPhase, first.travelPhase);
    assert.equal(final.bank, 0);
    assert.deepEqual(final.tail, []);
  }
});

test('downed pilots freeze cosmetic motion and fresh attempts or replacement snapshots reset it', () => {
  const run = createCoop(FIRST_CONNECTION),
    adapter = createCoopActorPresentation(),
    p = prepared();
  adapter.setPresentation(p.snapshot);
  startCoop(run);
  adapter.update(run);
  stepCoop(run, neutral(), 1 / 120);
  adapter.update(run);
  run.players[0].status = 'downed';
  const phase = adapter.frame('pilot', 0).phase;
  run.time += 1 / 120;
  run.tick++;
  adapter.update(run);
  assert.equal(adapter.frame('pilot', 0).phase, phase);
  assert.equal(adapter.frame('pilot', 0).stunned, true);
  const fresh = createCoop(FIRST_CONNECTION);
  adapter.update(fresh);
  assert.equal(adapter.frame('pilot', 0).phase, 0);
  startCoop(fresh);
  stepCoop(fresh, neutral(), 1 / 120);
  adapter.update(fresh);
  adapter.setPresentation(p.snapshot);
  adapter.update(fresh);
  assert.equal(adapter.frame('pilot', 0).phase, 0);
});

test('prepared image and pivot geometry are borrowed once; reset and replacement never close shared images', () => {
  const run = createCoop(RELAY_YARD),
    p = prepared(),
    adapter = createCoopActorPresentation(),
    view = surface();
  adapter.setPresentation(p.snapshot);
  adapter.update(run);
  for (const [kind, list] of [
    ['pilot', run.players],
    ['enemy', run.enemies],
    ['core', run.strongholds],
  ]) {
    for (const actor of list) {
      const frame = adapter.frame(kind, actor.id);
      view.reset();
      assert.equal(adapter.draw(view.ctx, kind, actor.id, palette), true);
      const draw = view.calls.find((call) => call.name === 'drawImage');
      assert.equal(draw.args[0], p.images.get(frame.sourceSlot).image);
      assert.equal(draw.state.imageSmoothingEnabled, false);
      assert.equal(draw.args.at(-1), frame.diameter);
      assert.equal(view.stack.length, 0);
      if (kind === 'core')
        assert.equal(
          view.calls.some((call) => call.name === 'arc'),
          false,
          'A stationary core gains no contact circle.',
        );
    }
  }
  assert.equal(p.reads.length, 5);
  adapter.reset();
  adapter.setPresentation(null);
  adapter.update(run);
  assert.equal(adapter.draw(view.ctx, 'pilot', 0, palette), false);
  assert.equal(p.closed(), 0);
});

test('absent prepared roles keep truthful geometric fallback and failed snapshot reads leave old art usable', () => {
  const run = createCoop(FIRST_CONNECTION),
    p = prepared({ missing: 'enemy.border-patrol' }),
    adapter = createCoopActorPresentation(),
    view = surface();
  adapter.setPresentation(p.snapshot);
  adapter.update(run);
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  assert.equal(adapter.draw(view.ctx, 'enemy', hunter.id, palette), false);
  assert.equal(adapter.draw(view.ctx, 'pilot', 0, palette), true);
  assert.throws(
    () =>
      adapter.setPresentation({
        image: () => {
          throw new Error('retired');
        },
      }),
    /retired/,
  );
  view.reset();
  assert.equal(adapter.draw(view.ctx, 'pilot', 0, palette), true);
  assert.equal(
    view.calls.find((call) => call.name === 'drawImage').args[0],
    p.images.get('player.scout.detailed').image,
  );
});

test('actual painter places body images below 1/2, down/grace, lock/recovery/slow and stronghold cues', () => {
  const run = createCoop(RELAY_YARD),
    p = prepared(),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  run.status = 'paused';
  run.time = 2;
  run.players[0].status = 'downed';
  run.players[1].graceUntil = 4;
  const hunters = run.enemies.filter((enemy) => enemy.type === 'hunter');
  Object.assign(hunters[0], { phase: 'warning', target: 1, targetPoint: { x: 40, y: 20 } });
  Object.assign(hunters[1], { phase: 'recovery', speedScale: 0.5, slowUntil: 4 });
  run.strongholds[0].anchors[0].captured = true;
  const before = structuredClone(run);
  painter.setPresentation(p.snapshot);
  painter.paint(run, { reduced: true });
  const lastBody = view.calls.findLastIndex((call) => call.name === 'drawImage');
  assert.equal(
    view.calls.filter((call) => call.name === 'drawImage').length,
    run.players.length + run.enemies.length + run.strongholds.length,
  );
  for (const label of ['1', '+', '2', '✓', 'B', 'SHIELD', 'LOCK 2', 'RECOVER', 'SLOWED']) {
    const call = labels(view.calls).find((item) => item.args[0] === label);
    assert.ok(call, label);
    assert.ok(view.calls.indexOf(call) > lastBody, `${label} is never covered by a later body`);
  }
  const first = view.calls.slice();
  view.reset();
  painter.paint(run, { reduced: true });
  assert.equal(view.stack.length, 0);
  assert.deepEqual(view.calls, first, 'Paused reduced painting has no independent clock.');
  assert.deepEqual(run, before);
  assert.ok(
    first.some((call) => call.name === 'setLineDash' && call.args[0][0] === 0.2),
    'Grace stays patterned.',
  );
});

test('stronghold boss body stays beneath authored anchors and marker labels clear its envelope', () => {
  const run = createCoop(RELAY_YARD),
    view = surface(479),
    painter = createCoopPainter(view.canvas),
    p = prepared();
  painter.setPresentation(p.snapshot);
  painter.paint(run);
  const index = view.calls.findIndex(
    (call) => call.name === 'drawImage' && call.args[0].slot === 'enemy.relay-sentinel',
  );
  assert.ok(index >= 0);
  const body = view.calls[index],
    d = body.args.at(-1),
    core = run.strongholds[0].core;
  const label = labels(view.calls).find((call) => call.args[0] === 'SHIELD');
  assert.ok(label.args[2] < core.y - d / 32);
  for (const anchor of run.strongholds[0].anchors)
    assert.ok(
      view.calls
        .slice(index + 1)
        .some(
          (call) =>
            call.name === 'strokeRect' &&
            call.args[0] === anchor.x - 0.7 &&
            call.args[1] === anchor.y - 0.7,
        ),
    );
});

test('bright required picture stays exact beneath actors while painting and body detail never change gameplay', () => {
  const run = createCoop(FIRST_CONNECTION),
    control = createCoop(FIRST_CONNECTION),
    p = prepared(),
    view = surface(),
    painter = createCoopPainter(view.canvas),
    image = { width: 1152, height: 576 };
  const picture = {
    snapshot: p.snapshot,
    image,
    choice: { kind: 'image', levelId: run.level.id, levelRevision: run.level.revision },
    fit: 'contain',
    sampling: 'nearest',
  };
  painter.setPresentation(p.snapshot);
  startCoop(run);
  startCoop(control);
  for (let i = 0; i < 24; i++) {
    painter.paint(run, {
      picture,
      actorStyle: i % 2 ? 'microtile' : 'hybrid',
      reduced: i % 3 === 0,
    });
    stepCoop(run, neutral(), 1 / 120);
    stepCoop(control, neutral(), 1 / 120);
    view.reset();
  }
  assert.deepEqual(run, control);
  painter.paint(run, { picture });
  const draw = view.calls.find((call) => call.name === 'drawImage');
  assert.equal(draw.args[0], image);
  assert.deepEqual(draw.args.slice(1), [0, 0, 1152, 576, 0, 0, 72, 36]);
  assert.equal(view.ctx.imageSmoothingEnabled, true);
  assert.equal(view.stack.length, 0);
  assert.equal(p.closed(), 0);
});

test('overlapping actor images cannot cover the final real enemy contact rings', () => {
  const run = createCoop(FIRST_CONNECTION),
    p = prepared(),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  const [first, second] = run.enemies;
  Object.assign(second, { x: first.x + first.radius, y: first.y });
  const before = structuredClone(run);
  painter.setPresentation(p.snapshot);
  painter.paint(run);
  const lastBody = view.calls.findLastIndex((call) => call.name === 'drawImage');
  const overlays = view.calls.slice(lastBody + 1);
  for (const enemy of run.enemies) {
    const placement = overlays.findIndex(
      (call) => call.name === 'translate' && call.args[0] === enemy.x && call.args[1] === enemy.y,
    );
    assert.ok(placement >= 0, `${enemy.id} owns a final overlay placement`);
    const nextPlacement = overlays.findIndex(
      (call, index) => index > placement && call.name === 'translate',
    );
    const ownOverlay = overlays.slice(placement + 1, nextPlacement < 0 ? undefined : nextPlacement);
    assert.ok(
      ownOverlay.some(
        (call) =>
          call.name === 'arc' &&
          call.args[0] === 0 &&
          call.args[1] === 0 &&
          call.args[2] === enemy.radius,
      ),
      `${enemy.id} contact radius must be restored after every cosmetic image`,
    );
  }
  assert.ok(
    overlays.some(
      (call) =>
        call.name === 'fillRect' &&
        call.args[0] === -1 / 16 &&
        call.args[1] === -1 / 16 &&
        call.args[2] === 2 / 16 &&
        call.state.fillStyle === '#f1f7ed',
    ),
  );
  assert.deepEqual(run, before);
});

test('charging hunters keep explicit phase text and slow pattern above their borrowed quad image', () => {
  const run = createCoop(FIRST_CONNECTION),
    p = prepared(),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  run.time = 3;
  run.status = 'paused';
  Object.assign(hunter, { phase: 'commit', speedScale: 0.5, slowUntil: 4 });
  const before = structuredClone(run);
  painter.setPresentation(p.snapshot);
  painter.paint(run, { reduced: true });
  const lastBody = view.calls.findLastIndex((call) => call.name === 'drawImage');
  for (const label of ['CHARGE', 'SLOWED']) {
    const call = labels(view.calls).find((item) => item.args[0] === label);
    assert.ok(call, label);
    assert.ok(view.calls.indexOf(call) > lastBody);
  }
  assert.ok(
    view.calls
      .slice(lastBody + 1)
      .some((call) => call.name === 'setLineDash' && call.args[0][0] === 0.16),
  );
  assert.deepEqual(run, before);
});

test('exposed and secured strongholds retain functional labels and anchors over stationary body art', () => {
  const run = createCoop(RELAY_YARD),
    p = prepared(),
    view = surface(),
    painter = createCoopPainter(view.canvas),
    stronghold = run.strongholds[0];
  painter.setPresentation(p.snapshot);
  for (const defeated of [false, true]) {
    stronghold.shielded = false;
    stronghold.defeated = defeated;
    for (const anchor of stronghold.anchors) anchor.captured = true;
    const before = structuredClone(run);
    view.reset();
    painter.paint(run, { reduced: true });
    const draw = view.calls.find(
      (call) => call.name === 'drawImage' && call.args[0].slot === 'enemy.relay-sentinel',
    );
    assert.equal(draw.state.globalAlpha, defeated ? 0.45 : 1);
    const text = labels(view.calls),
      expected = defeated ? 'SECURED' : 'CAPTURE';
    assert.ok(
      text.some(
        (call) => call.args[0] === expected && view.calls.indexOf(call) > view.calls.indexOf(draw),
      ),
    );
    assert.equal(text.filter((call) => call.args[0] === '✓').length, stronghold.anchors.length);
    assert.deepEqual(run, before);
  }
});

test('minimum authored Team radius stays exact in the sampled frame and final footprint', () => {
  const level = structuredClone(FIRST_CONNECTION);
  const authored = level.enemies.find((enemy) => enemy.type === 'hunter');
  authored.radius = 0.01;
  const run = createCoop(level),
    enemy = run.enemies.find((actor) => actor.id === authored.id),
    p = prepared(),
    adapter = createCoopActorPresentation(),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  const before = structuredClone(run);
  adapter.setPresentation(p.snapshot);
  adapter.update(run);
  assert.equal(
    adapter.frame('enemy', enemy.id).radius,
    0.01 * 16,
    'The shared cosmetic sampler minimum is not Team collision authority.',
  );
  painter.setPresentation(p.snapshot);
  painter.paint(run);
  const lastBody = view.calls.findLastIndex((call) => call.name === 'drawImage');
  assert.ok(
    view.calls
      .slice(lastBody + 1)
      .some(
        (call) =>
          call.name === 'arc' && call.args[0] === 0 && call.args[1] === 0 && call.args[2] === 0.01,
      ),
  );
  assert.deepEqual(run, before);
});
