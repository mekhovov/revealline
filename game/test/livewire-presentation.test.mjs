import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { drawLaneAttack } from '../ui/lane-presentation.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { drawClassicEnemy } from '../ui/classic-view.mjs';
import {
  createActorPresentation,
  PRESENTATION_INK,
  PRESENTATION_PLATE,
} from '../ui/actor-presentation.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { enemyContact } from '../core/contacts.mjs';
import { nextLineImpactSeed } from '../core/line-impact.mjs';

const palette = { danger: '#ff805e', muted: '#777' };
function surface() {
  const calls = [],
    state = {};
  return {
    calls,
    ctx: new Proxy(
      {},
      {
        set: (_, key, value) => {
          state[key] = value;
          return true;
        },
        get:
          (_, method) =>
          (...args) =>
            calls.push({ method, args, ...state }),
      },
    ),
  };
}
const level = resolveMission(
  compileContentProject(createLivewireCandidates()),
  'read-the-lock',
).level;

for (const screenScale of [294 / 1152, 1])
  for (const axis of ['horizontal', 'vertical'])
    test(`${axis}/${screenScale}: warning and active boundaries differ without color, flashing or audio`, () => {
      const actor = { type: 'lane-boss', axis, lane: 10.5, laneWidth: 1.2, bossPhase: 'warning' };
      const before = structuredClone(actor),
        warning = surface(),
        active = surface();
      assert(drawLaneAttack(warning.ctx, actor, palette, { screenScale }));
      assert(
        drawLaneAttack(active.ctx, { ...actor, bossPhase: 'active' }, palette, { screenScale }),
      );
      const box = axis === 'horizontal' ? [16, 144, 1120, 48] : [144, 16, 48, 544];
      for (const s of [warning, active]) {
        assert.deepEqual(s.calls.find((c) => c.method === 'fillRect').args, box);
        assert.deepEqual(
          s.calls.filter((c) => c.method === 'strokeRect').map((c) => c.strokeStyle),
          [PRESENTATION_PLATE, PRESENTATION_INK],
        );
        assert.equal(
          s.calls.filter((c) => c.method === 'strokeRect').at(-1).lineWidth * screenScale,
          1,
        );
      }
      assert.deepEqual(warning.calls.find((c) => c.method === 'setLineDash').args, [
        [6 / screenScale, 4 / screenScale],
      ]);
      assert.deepEqual(active.calls.find((c) => c.method === 'setLineDash').args, [[]]);
      assert.deepEqual(actor, before);
    });

test('idle/non-lane actors draw no attack; freeze preserves the locked geometry and custom boards keep their extents', () => {
  for (const actor of [{ type: 'bouncer' }, { type: 'lane-boss', bossPhase: 'idle' }]) {
    const s = surface();
    assert.equal(drawLaneAttack(s.ctx, actor, palette), false);
    assert.equal(s.calls.length, 0);
  }
  const s = surface();
  drawLaneAttack(
    s.ctx,
    { type: 'lane-boss', bossPhase: 'warning', axis: 'horizontal', lane: 10.5 },
    palette,
    { frozen: true, boardWidth: 800, boardHeight: 400 },
  );
  const fill = s.calls.find((c) => c.method === 'fillRect');
  assert.equal(fill.fillStyle, palette.muted);
  assert.equal(fill.globalAlpha, 0.12);
  assert.deepEqual(fill.args, [16, 144, 768, 48]);
});

test('the cue contains exactly every interior trail cell affected by lane contact, including edge rows and columns', () => {
  for (const axis of ['horizontal', 'vertical'])
    for (const lane of [1.5, 10.5, 34.5])
      for (const laneWidth of [1, 1.2, 2]) {
        const run = createRun(level);
        const enemy = run.enemies.find((actor) => actor.type === 'lane-boss');
        Object.assign(enemy, { axis, lane, laneWidth, bossPhase: 'active', stunnedUntil: 0 });
        run.enemies = [enemy];
        run.player.graceUntil = 0;
        run.player.cutting = false; // Isolate trail contact from body contact.
        const s = surface();
        drawLaneAttack(s.ctx, enemy, palette);
        const box = s.calls.find((call) => call.method === 'fillRect').args;
        const low = box[axis === 'horizontal' ? 1 : 0] / 16;
        const high = low + box[axis === 'horizontal' ? 3 : 2] / 16;
        const limit = axis === 'horizontal' ? run.height : run.width;
        // Test the original v1 travelling-impact contact too, without changing
        // campaign rules: v2 correctly excludes lane emitters from grace.
        run.level = structuredClone(run.level);
        run.level.classic.lineImpact = { version: 'line-impact.v1', speed: 24 };
        run.classic.lineImpact = { seededActorIds: [] };
        for (let cell = 1; cell < limit - 1; cell++) {
          const x = axis === 'horizontal' ? 20 : cell;
          const y = axis === 'horizontal' ? cell : 20;
          run.trail = [{ x, y, index: y * run.width + x }];
          run.trailSegments = [{ x1: x, y1: y, x2: x + 1, y2: y + 1 }];
          const plans = [{ paths: [] }],
            trace = { cells: [], additions: [] };
          const immediate = enemyContact(run, [], plans, trace, 1);
          const impact = nextLineImpactSeed(run, plans, trace, 1);
          const shown = cell >= low && cell + 1 <= high;
          assert.equal(Boolean(immediate), shown, `${axis}/${lane}/${laneWidth}/cell${cell}`);
          assert.equal(Boolean(impact), shown, 'Travelling contact uses the same cell envelope');
          if (immediate) assert.equal(immediate.kind, 'boss-lane');
        }
      }
});

test('actual runtime emitter shares the twin-post silhouette, unchanged contact radius and readable compact size', () => {
  const run = createRun(level),
    before = authoritativeCheckpoint(run);
  const view = foundationCompatibleView(run);
  assert.match(view.summary, /1 lane emitter/);
  const enemy = view.enemies.find((a) => a.type === 'lane-boss');
  for (const width of [294, 1152]) {
    const frame = createActorPresentation()
      .sample([enemy], { screenScale: width / 1152, canvasCSSWidth: width, reduced: true })
      .get(enemy.id);
    const s = surface();
    assert(drawClassicEnemy(s.ctx, enemy, palette, {}, frame));
    const radius = Math.max(11, frame.diameter / 2);
    assert.deepEqual(
      s.calls.filter((c) => c.method === 'rect').map((c) => c.args),
      [
        [-radius, -radius, radius * 0.45, radius * 2],
        [radius * 0.55, -radius, radius * 0.45, radius * 2],
        [-radius * 0.55, -radius * 0.2, radius * 1.1, radius * 0.4],
      ],
    );
    assert((radius * 2 * width) / 1152 >= 11);
    assert(s.calls.some((c) => c.method === 'arc' && c.args[2] === enemy.radius * 16));
  }
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('an explicit emitter body retains its own image beneath the functional twin-post cue', () => {
  const run = createRun(level),
    enemy = foundationCompatibleView(run).enemies.find((a) => a.type === 'lane-boss');
  const frame = createActorPresentation().sample([enemy], { reduced: true }).get(enemy.id);
  const image = { id: 'authored-emitter' },
    s = surface();
  assert(drawClassicEnemy(s.ctx, enemy, palette, {}, frame, { image }));
  assert(s.calls.some((c) => c.method === 'drawImage' && c.args[0] === image));
  assert.equal(s.calls.filter((c) => c.method === 'rect').length, 3);
  assert.equal(s.calls.filter((c) => c.method === 'fill').length, 0);
});

test('paused details explain lane retention and trail exposure using the actual locked clock', () => {
  const run = createRun(level);
  for (let tick = 0; tick < 250; tick++) stepRun(run, { direction: null }, FIXED_DT);
  const snapshot = flightInformationSnapshot(run, { started: true, paused: true });
  const details = flightDetailsModel(
    { snapshot },
    {
      mission: 'Read the lock',
      goal: 'Reveal 79%',
      steering: 'Immediate',
      objectiveLabel: 'Objective',
      actions: [],
    },
  );
  const text = details.flatMap((s) => s.lines).join('\n');
  assert.match(text, /Lane emitter: stationary field anchor/);
  assert.match(text, /secure any unfinished trail/);
  assert.match(text, /enclosure does not disable/);
  assert.match(text, /Leave the highlighted horizontal lane/);
  assert.match(text, /1.4s remaining/);
});
