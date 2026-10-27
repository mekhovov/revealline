import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { combatLevel, combat, ticks } from './helpers/combat-fixture.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

// Retain immutable held-artifact evidence; integration tests import the actual
// BoardPainter directly. Generated baselines never replace the checked-out file.
const root = fileURLToPath(new URL('../../', import.meta.url));
const moduleURL = new URL('../ui/render.mjs', import.meta.url);
const patchPath = fileURLToPath(
  new URL('../../docs/patches/combat-board-e9434d03.patch', import.meta.url),
);
const baseBlob = 'f93317fa0d48d862ecffa29d4cd3b854d04a35b9';
const locatorBlob = '37b1bfcb14f2e3c20ad5f3fd588f78cdb51ee8d4';
const git = (args, options = {}) =>
  execFileSync('git', ['--no-lazy-fetch', '--no-optional-locks', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
// Exact e9434d03 renderer fixture: fresh/shallow CI needs no unrelated Git object.
const pinned = readFileSync(
  new URL('./fixtures/combat-board-render-e9434d03.txt', import.meta.url),
  'utf8',
);
const pinnedLocator = readFileSync(
  new URL('./fixtures/combat-board-player-locator-e9434d03.txt', import.meta.url),
  'utf8',
);
const blobFor = (source) =>
  createHash('sha1')
    .update(`blob ${Buffer.byteLength(source)}\0`)
    .update(source)
    .digest('hex');
const current = readFileSync(moduleURL, 'utf8');
const patch = readFileSync(patchPath, 'utf8');
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const theme = {
  ...JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes[0],
  id: 'adapter-study',
  family: 'study',
};
const image = (id, width = 32, height = width) => ({ id, width, height });
const scratch = [];
let OriginalPainter, PatchedPainter, UnadoptedPainter, patchedPinned;
let oldDocument, canvases;

function applyTo(source) {
  const directory = mkdtempSync(join(tmpdir(), 'combat-board-adapter-'));
  scratch.push(directory);
  const target = join(directory, 'game/ui/render.mjs');
  mkdirSync(join(directory, 'game/ui'), { recursive: true });
  writeFileSync(target, source);
  git(['apply', '--check', patchPath], { cwd: directory });
  git(['apply', patchPath], { cwd: directory });
  const result = readFileSync(target, 'utf8');
  git(['apply', '--reverse', '--check', patchPath], { cwd: directory });
  git(['apply', '--reverse', patchPath], { cwd: directory });
  assert.equal(
    readFileSync(target, 'utf8'),
    source,
    'Reverse application restores every original byte.',
  );
  return result;
}

function removeFromCurrent() {
  const directory = mkdtempSync(join(tmpdir(), 'combat-board-baseline-'));
  scratch.push(directory);
  const target = join(directory, 'game/ui/render.mjs');
  mkdirSync(join(directory, 'game/ui'), { recursive: true });
  writeFileSync(target, current);
  // The actual renderer has newer comments/options inside the old context.
  // Match the exact added lines without requiring obsolete surrounding lines.
  git(['apply', '--reverse', '-C0', '--check', patchPath], { cwd: directory });
  git(['apply', '--reverse', '-C0', patchPath], { cwd: directory });
  const source = readFileSync(target, 'utf8');
  assert(!source.includes('combatView'));
  assert(!source.includes('combatPresentation'));
  return source;
}

async function renderer(source, label) {
  // The historical renderer's exact locator dependency was later retired.
  // Keep that source test-only; never restore or substitute a production cue.
  const locatorURL = `data:text/javascript;base64,${Buffer.from(
    pinnedLocator.replace(
      "'./actor-presentation.mjs'",
      JSON.stringify(new URL('./actor-presentation.mjs', moduleURL).href),
    ),
  ).toString('base64')}`;
  const resolved = source
    .replace(
      /from (['"])(\.{1,2}\/[^'"]+)\1/g,
      (_, quote, specifier) =>
        `from ${quote}${specifier === './player-locator.mjs' ? locatorURL : new URL(specifier, moduleURL).href}${quote}`,
    )
    .replaceAll('import.meta.url', JSON.stringify(moduleURL.href));
  return (
    await import(
      `data:text/javascript;base64,${Buffer.from(`${resolved}\n// ${label}`).toString('base64')}`
    )
  ).BoardPainter;
}

function surface(width = 1152) {
  const calls = [],
    stack = [];
  const values = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, lineDash: [] };
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: width } },
    {
      get(target, name) {
        if (name in target) return target[name];
        if (name in values) return values[name];
        return (...args) => {
          if (name === 'setLineDash') values.lineDash = [...args[0]];
          calls.push({ op: name, args, ...values });
          if (name === 'save') stack.push({ ...values });
          if (name === 'restore') Object.assign(values, stack.pop());
        };
      },
      set(_, name, value) {
        calls.push({ op: 'set', args: [name, value] });
        values[name] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

before(async () => {
  assert.equal(blobFor(pinned), baseBlob);
  assert.equal(blobFor(pinnedLocator), locatorBlob);
  patchedPinned = applyTo(pinned);
  [OriginalPainter, PatchedPainter, UnadoptedPainter] = await Promise.all([
    renderer(pinned, 'pinned original'),
    renderer(patchedPinned, 'pinned held patch'),
    renderer(removeFromCurrent(), 'current without additive combat layers'),
  ]);
  oldDocument = globalThis.document;
  canvases = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { id: `offscreen-${canvases.length}`, width: 0, height: 0 };
      const drawing = surface();
      canvas.getContext = () => drawing.ctx;
      canvas.calls = drawing.calls;
      canvases.push(canvas);
      return canvas;
    },
  };
});
after(() => {
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
  for (const directory of scratch) rmSync(directory, { recursive: true, force: true });
});

function painter(Class = BoardPainter) {
  const result = new Class(presets);
  result.theme = theme;
  result.bodyId = 'neutral-marker';
  result.body = presets.characters[result.bodyId];
  result.recipe = presets.animationRecipes[result.body.animationRecipe];
  result.image = image('player');
  result.images.enemy = image('keeper');
  result.background = image('picture', 768, 576);
  return result;
}
function sample(kind, count, { freezeAt = null, capture = false } = {}) {
  const level = combatLevel(kind);
  if (capture) level.classic.combatPatrols.actors[0].y = 25.5;
  if (freezeAt !== null)
    level.classic.powerups.push({
      id: 'freeze-window',
      kind: 'enemy-freeze',
      x: freezeAt,
      y: 18.5,
    });
  const run = createRun(level, { seed: 7 });
  ticks(run, count, 'right');
  return run;
}
function combinedLevel(role) {
  const source = createStarterProject('combined-renderer-study');
  source.actorCatalogId = 'journey-actors-v9';
  source.difficultyCatalogId = 'journey-difficulty-v2';
  source.missions[0].actors = [
    {
      id: 'keeper',
      role,
      tier: 'measured',
      x: 40.5,
      y: 12.5,
      heading: [-1, -1],
    },
  ];
  const prepared = prepareCombatAuthoring(source, 'nearby-shore');
  prepared.missions[0].actors.push({
    id: 'optional-sentry',
    role: 'optional-sentry',
    tier: 'measured',
    x: 44.5,
    y: 10.5,
    heading: [-1, 0],
  });
  return resolveMission(
    compileContentProject(setMissionCombatEnabled(prepared, 'nearby-shore', true)),
    'nearby-shore',
  ).level;
}
function render(run, { Class = BoardPainter, width = 1152, dt = 0, ...options } = {}) {
  const board = painter(Class),
    canvas = surface(width);
  board.draw(canvas.ctx, run, dt, {
    paused: true,
    reduced: true,
    displayCSSWidth: width,
    ...options,
  });
  return { board, ...canvas };
}
const spriteDraws = (calls) =>
  calls.filter(
    (entry) => entry.op === 'drawImage' && entry.args[0].getContext && entry.args[0].width === 16,
  );
const commandIndex = (calls, predicate) => {
  const index = calls.findIndex(predicate);
  assert(index >= 0, 'Expected drawing command is present.');
  return index;
};
const atPoint = (args, x, y) => Math.abs(args[0] - x) < 1e-7 && Math.abs(args[1] - y) < 1e-7;
function paintSnapshot(board) {
  return structuredClone({
    time: board.time,
    heading: board.heading,
    bank: board.bank,
    speedRatio: board.speedRatio,
    animation: board.animation,
    effects: board.effects,
    celebration: board.celebration,
    winState: board._winState,
    celebrationPrepared: board._celebrationPrepared,
  });
}

test('immutable held patch pins its base while the actual renderer retains newer adapters', (t) => {
  assert.match(patch, new RegExp(baseBlob));
  assert.equal(patch.match(/^diff --git /gm).length, 1);
  assert.equal(
    patch.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
    0,
    'The held patch is strictly additive.',
  );
  for (const text of [
    "import { drawRelayGates, drawRelayTriggers, relayView } from './relay-view.mjs';",
    "import { drawDirectionalFields, directionalView } from './directional-view.mjs';",
    'drawRelayGates(ctx, relays, p, CELL);',
    'drawRelayTriggers(ctx, relays, CELL);',
    'if (!fullReveal) drawDirectionalFields(ctx, directionalView(state), CELL);',
    'const { width: columns, height: rows } = geometryForRun(state);',
  ]) {
    assert(current.includes(text));
  }
  assert.equal(
    readFileSync(moduleURL, 'utf8'),
    current,
    'Tests never rewrite the actual renderer.',
  );
  const blob = blobFor(patchedPinned);
  assert(patch.includes(`index ${baseBlob}..${blob} 100644`));
  t.diagnostic(
    `Pinned renderer ${baseBlob}; patched renderer ${blob}; patch SHA-256 ${createHash('sha256').update(patch).digest('hex')}.`,
  );
});

test('absent and disabled combat preserve both historical and current command streams and authority exactly', () => {
  for (const enabled of [null, false]) {
    const level = combatLevel();
    if (enabled === null) delete level.classic.combatPatrols;
    else level.classic.combatPatrols.enabled = false;
    const run = createRun(level);
    ticks(run, 300, 'right');
    for (const fullReveal of [false, true])
      for (const width of [294, 1152])
        for (const [Original, Adopted] of [
          [OriginalPainter, PatchedPainter],
          [UnadoptedPainter, BoardPainter],
        ]) {
          const checkpoint = authoritativeCheckpoint(run);
          const original = render(run, { Class: Original, width, fullReveal });
          const patched = render(run, { Class: Adopted, width, fullReveal });
          assert.deepEqual(patched.calls, original.calls);
          assert.deepEqual(paintSnapshot(patched.board), paintSnapshot(original.board));
          assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
          assert.equal(spriteDraws(patched.calls).length, 0);
        }
  }
});

test('absent and disabled combat leave current pursuit/interception warnings byte-for-command unchanged', () => {
  for (const role of ['trail-pursuer', 'heading-interceptor'])
    for (const enabled of [null, false]) {
      const level = structuredClone(combinedLevel(role));
      if (enabled === null) delete level.classic.combatPatrols;
      else level.classic.combatPatrols.enabled = false;
      const run = createRun(level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
      ticks(run, 480);
      ticks(run, 140, 'right');
      ticks(run, 80, 'down');
      assert.equal(run.enemies[0].classic.pressure.phase, 'warning');
      const before = authoritativeCheckpoint(run);
      for (const reduced of [false, true])
        for (const width of [294, 1152]) {
          const original = render(run, { Class: UnadoptedPainter, reduced, width });
          const adopted = render(run, { reduced, width });
          assert.deepEqual(adopted.calls, original.calls);
          assert.deepEqual(paintSnapshot(adopted.board), paintSnapshot(original.board));
          assert.equal(spriteDraws(adopted.calls).length, 0);
        }
      assert.deepEqual(authoritativeCheckpoint(run), before);
    }
});

test('malformed active combat throws before canvas, caches, animation or painter state changes', () => {
  for (const terminal of [false, true]) {
    const run = terminal ? sample('scout', 1000, { capture: true }) : sample('sentry', 300);
    if (terminal) assert.equal(run.status, 'won');
    const board = painter(),
      canvas = surface();
    board.effectsFor(run.events, run);
    const before = paintSnapshot(board),
      allocated = canvases.length;
    let samples = 0,
      updates = 0;
    const actorSample = board.actorPresentation.sample;
    board.actorPresentation = {
      ...board.actorPresentation,
      sample(...args) {
        samples++;
        return actorSample(...args);
      },
    };
    const enemyUpdate = board.enemyBodies.update;
    board.enemyBodies = {
      ...board.enemyBodies,
      update(...args) {
        updates++;
        return enemyUpdate(...args);
      },
    };
    let invoked = 0;
    Object.defineProperty(combat(run).actors[0], 'x', {
      enumerable: true,
      get() {
        invoked++;
        return 12;
      },
    });
    assert.throws(
      () => board.draw(canvas.ctx, run, 1, { fullReveal: terminal }),
      /Cannot render optional combat/,
    );
    assert.equal(invoked, 0);
    assert.deepEqual(canvas.calls, []);
    assert.equal(canvases.length, allocated);
    assert.equal(samples, 0);
    assert.equal(updates, 0);
    assert.deepEqual(paintSnapshot(board), before);
  }
});

test('actual warning bodies and rays sit below the live trail, ordinary keepers and craft', () => {
  const run = sample('sentry', 300),
    view = combatView(run);
  assert.equal(view.actors[0].phase, 'warning');
  assert(run.trailSegments.length > 0);
  const before = authoritativeCheckpoint(run),
    { calls } = render(run);
  const body = commandIndex(
    calls,
    (c) => c.op === 'drawImage' && c.args[0].width === 16 && c.args[0].getContext,
  );
  const ray = commandIndex(
    calls,
    (c) => c.op === 'stroke' && c.lineDash[0] === 4 && c.lineDash[1] === 3,
  );
  const trail = commandIndex(
    calls,
    (c) =>
      c.op === 'stroke' &&
      c.strokeStyle === theme.palette.accent &&
      c.lineWidth === 3 &&
      c.lineDash.length === 0,
  );
  const keeper = commandIndex(calls, (c) => c.op === 'drawImage' && c.args[0].id === 'keeper');
  const player = commandIndex(calls, (c) => c.op === 'drawImage' && c.args[0].id === 'player');
  assert(body < ray && ray < trail && trail < keeper && keeper < player);
  assert(
    calls.some(
      (c) =>
        c.op === 'lineTo' &&
        atPoint(c.args, view.actors[0].rayEnd.x * 16, view.actors[0].rayEnd.y * 16),
    ),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

for (const role of ['trail-pursuer', 'heading-interceptor'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`actual painter layers ${role}/${turnPolicy} with sentry warning, shot and real capture cancellation`, () => {
      const level = combinedLevel(role),
        run = createRun(level, { seed: 1, classId: 'scout', turnPolicy });
      ticks(run, 480);
      ticks(run, 140, 'right');
      ticks(run, 80, 'down');
      assert.equal(run.enemies[0].classic.pressure.phase, 'warning');
      assert.equal(combatView(run).actors[0].phase, 'warning');
      assert(run.trailSegments.length > 0);
      for (const reduced of [false, true])
        for (const width of [294, 1152]) {
          const before = authoritativeCheckpoint(run),
            { board, calls } = render(run, { reduced, width });
          assert.equal(board.constructor, BoardPainter);
          const unit = 1152 / width;
          const body = commandIndex(calls, (c) => spriteDraws([c]).length === 1);
          const pressure = commandIndex(
            calls,
            (c) =>
              c.op === 'stroke' &&
              Math.abs(c.lineDash[0] - 3 * unit) < 1e-7 &&
              Math.abs(c.lineDash[1] - 5 * unit) < 1e-7,
          );
          const warning = commandIndex(
            calls,
            (c) =>
              c.op === 'stroke' &&
              Math.abs(c.lineDash[0] - 4 * unit) < 1e-7 &&
              Math.abs(c.lineDash[1] - 3 * unit) < 1e-7,
          );
          const trail = commandIndex(
            calls,
            (c) =>
              c.op === 'stroke' &&
              c.strokeStyle === theme.palette.accent &&
              c.lineDash.length === 0,
          );
          const keeper = commandIndex(
            calls,
            (c) => c.op === 'drawImage' && c.args[0].id === 'keeper',
          );
          const player = commandIndex(
            calls,
            (c) => c.op === 'drawImage' && c.args[0].id === 'player',
          );
          assert(body < pressure && pressure < warning && warning < trail);
          assert(trail < keeper && keeper < player);
          assert.equal(calls[warning].globalAlpha, 1);
          const paused = surface(width);
          board.draw(paused.ctx, run, 5, { paused: true, reduced, displayCSSWidth: width });
          assert.deepEqual(paused.calls, calls, 'Repeated paused draws retain both locked cues.');
          assert.deepEqual(authoritativeCheckpoint(run), before);
        }

      const events = ticks(run, 160, 'down'),
        view = combatView(run);
      assert(events.some((event) => event.type === 'pressure.committed'));
      assert(events.some((event) => event.type === 'combat.fired'));
      assert.equal(run.enemies[0].classic.pressure.phase, 'committed');
      assert.equal(view.actors[0].phase, 'recovery');
      assert.equal(view.projectiles.length, 1);
      for (const reduced of [false, true])
        for (const width of [294, 1152]) {
          const before = authoritativeCheckpoint(run),
            { calls } = render(run, { reduced, width });
          const shot = view.projectiles[0],
            unit = 1152 / width;
          const keeper = commandIndex(
            calls,
            (c) => c.op === 'drawImage' && c.args[0].id === 'keeper',
          );
          const diamond = commandIndex(
            calls,
            (c) => c.op === 'moveTo' && atPoint(c.args, shot.x * 16, shot.y * 16 - 4 * unit),
          );
          const player = commandIndex(
            calls,
            (c) => c.op === 'drawImage' && c.args[0].id === 'player',
          );
          assert(keeper < diamond && diamond < player);
          assert(
            !calls.some(
              (c) =>
                c.op === 'stroke' &&
                Math.abs(c.lineDash[0] - 4 * unit) < 1e-7 &&
                Math.abs(c.lineDash[1] - 3 * unit) < 1e-7,
            ),
            'A fired shot no longer carries its old locked warning ray.',
          );
          assert.deepEqual(authoritativeCheckpoint(run), before);
        }

      const safe = createRun(level, { seed: 1, classId: 'scout', turnPolicy });
      ticks(safe, 480);
      ticks(safe, 170, 'down');
      assert.equal(safe.enemies[0].classic.pressure.phase, 'committed');
      assert.equal(combatView(safe).actors[0].phase, 'warning');
      const board = render(safe).board;
      const captureEvents = ticks(safe, 4, 'down');
      assert(captureEvents.some((event) => event.type === 'cells.claimed'));
      for (const [type, reason] of [
        ['pressure.cancelled', 'trail-closed'],
        ['combat.cancelled', 'capture'],
      ])
        assert(captureEvents.some((event) => event.type === type && event.reason === reason));
      assert.equal(safe.enemies[0].classic.pressure.target, null);
      assert.equal(combatView(safe).actors[0].phase, 'cooldown');
      assert.equal(combatView(safe).projectiles.length, 0);
      const before = authoritativeCheckpoint(safe),
        closed = surface();
      board.draw(closed.ctx, safe, 0, { paused: true, reduced: true });
      assert(
        !closed.calls.some(
          (c) =>
            c.op === 'stroke' &&
            ((c.lineDash[0] === 4 && c.lineDash[1] === 3) ||
              (c.lineDash[0] === 3 && c.lineDash[1] === 5)),
        ),
        'Neither attack retains a stale warning after the real return.',
      );
      assert.equal(spriteDraws(closed.calls).length, 1, 'Capture cancellation keeps the survivor.');
      assert.equal(safe.lives, 3);
      assert.deepEqual(authoritativeCheckpoint(safe), before);
    });

test('actual fired projectiles draw above keepers and below the craft with a readable diamond', () => {
  const run = sample('sentry', 380),
    view = combatView(run);
  assert.equal(view.projectiles.length, 1);
  for (const Class of [PatchedPainter, BoardPainter]) {
    const { calls } = render(run, { Class });
    const projectile = view.projectiles[0];
    const keeper = commandIndex(calls, (c) => c.op === 'drawImage' && c.args[0].id === 'keeper');
    const diamond = commandIndex(
      calls,
      (c) => c.op === 'moveTo' && atPoint(c.args, projectile.x * 16, projectile.y * 16 - 4),
    );
    const player = commandIndex(calls, (c) => c.op === 'drawImage' && c.args[0].id === 'player');
    assert(keeper < diamond && diamond < player);
    assert(
      calls.some(
        (c) => c.op === 'lineTo' && atPoint(c.args, projectile.x * 16 + 4, projectile.y * 16),
      ),
    );
  }
});

test('real ram and terminal capture place inert scrap over the picture with no terminal live threats', () => {
  for (const [cause, count, options] of [
    ['ram', 150, {}],
    ['capture', 1000, { capture: true }],
  ]) {
    const run = sample('scout', count, options),
      view = combatView(run);
    assert.equal(view.eliminations.length, 1);
    assert.equal(view.eliminations[0].cause, cause);
    const mark = view.eliminations[0];
    const before = authoritativeCheckpoint(run);
    const fullReveal = cause === 'capture';
    if (fullReveal) assert.equal(run.status, 'won');
    const shown = render(run, { fullReveal });
    const picture = commandIndex(
      shown.calls,
      (c) => c.op === 'drawImage' && c.args[0].id === 'picture',
    );
    const scrap = commandIndex(
      shown.calls,
      (c) =>
        c.op === 'fillRect' &&
        atPoint(c.args, mark.x * 16 - 4, mark.y * 16 - 2) &&
        c.args[2] === 8 &&
        c.args[3] === 4,
    );
    assert(picture < scrap);
    const hidden = render(run, { fullReveal, showCombatScrap: false });
    assert(
      !hidden.calls.some(
        (c) =>
          c.op === 'fillRect' &&
          atPoint(c.args, mark.x * 16 - 4, mark.y * 16 - 2) &&
          c.args[2] === 8 &&
          c.args[3] === 4,
      ),
    );
    assert.equal(spriteDraws(shown.calls).length, 0);
    if (fullReveal) {
      assert(
        !shown.calls.some(
          (c) => c.op === 'drawImage' && ['keeper', 'player'].includes(c.args[0].id),
        ),
      );
      assert(!shown.calls.some((c) => c.op === 'setLineDash' && c.args[0].length));
      assert.equal(shown.board.celebrationStatus.phase, 'picture');
    }
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
});

test('small and reduced viewports retain warning and shot cues, including real freeze pickups and pause', () => {
  for (const [count, freezeAt, kind] of [
    [300, 25.5, 'warning'],
    [410, 34.5, 'shot'],
  ]) {
    const run = sample('sentry', count, { freezeAt }),
      view = combatView(run);
    assert.equal(view.frozen, true);
    if (kind === 'warning') assert.equal(view.actors[0].phase, 'warning');
    else assert.equal(view.projectiles.length, 1);
    for (const reduced of [false, true])
      for (const width of [294, 1152]) {
        const board = painter(),
          first = surface(width),
          second = surface(width);
        const options = { paused: true, reduced, displayCSSWidth: width };
        const before = authoritativeCheckpoint(run);
        board.draw(first.ctx, run, 0.016, options);
        board.draw(second.ctx, run, 5, options);
        assert.deepEqual(
          second.calls,
          first.calls,
          'Paused combat has no independent cosmetic clock.',
        );
        const body = spriteDraws(first.calls)[0],
          scale = width / 1152;
        assert(body.args[3] * scale >= (width < 480 ? 16 : 24));
        assert(body.args[3] * scale <= 32);
        assert(
          first.calls.some(
            (c) =>
              c.op === 'fillRect' &&
              Math.abs(c.args[2] * scale - 1) < 1e-7 &&
              Math.abs(c.args[3] * scale - 4) < 1e-7,
          ),
          'Frozen pause bars stay visible.',
        );
        if (kind === 'warning')
          assert(
            first.calls.some(
              (c) => c.op === 'setLineDash' && Math.abs(c.args[0][0] * scale - 4) < 1e-7,
            ),
          );
        else {
          const shot = view.projectiles[0];
          assert(
            first.calls.some(
              (c) => c.op === 'moveTo' && atPoint(c.args, shot.x * 16, shot.y * 16 - 4 / scale),
            ),
          );
        }
        for (const call of first.calls)
          for (const value of call.args.flat())
            if (typeof value === 'number') assert(Number.isFinite(value));
        assert.deepEqual(authoritativeCheckpoint(run), before);
      }
  }
});

test('the cosmetic scrap toggle cannot hide live warning bodies or projectiles', () => {
  for (const count of [300, 380]) {
    const run = sample('sentry', count);
    const board = painter(),
      shown = surface(),
      hidden = surface();
    const before = authoritativeCheckpoint(run);
    board.draw(shown.ctx, run, 0, { paused: true, reduced: true });
    board.draw(hidden.ctx, run, 0, { paused: true, reduced: true, showCombatScrap: false });
    assert.deepEqual(hidden.calls, shown.calls);
    assert.equal(spriteDraws(hidden.calls).length, 1);
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
});

test('a real terminal capture is immediately static even unreduced, while surviving sentries stay hidden', () => {
  const captured = sample('scout', 1000, { capture: true });
  const view = combatView(captured),
    mark = view.eliminations[0];
  assert.equal(view.status, 'won');
  assert.equal(view.tick, mark.tick, 'The real terminal event is still at spark age zero.');
  const { calls } = render(captured, { fullReveal: true, reduced: false });
  assert(
    calls.some(
      (c) =>
        c.op === 'fillRect' &&
        atPoint(c.args, mark.x * 16 - 4, mark.y * 16 - 2) &&
        c.args[2] === 8 &&
        c.args[3] === 4,
    ),
  );
  assert(
    !calls.some(
      (c) =>
        c.op === 'fillRect' &&
        atPoint(c.args, mark.x * 16 - 4, mark.y * 16 - 1) &&
        c.args[2] === 3 &&
        c.args[3] === 3,
    ),
    'The terminal frame does not retain a young capture spark.',
  );
  const survivor = sample('sentry', 1000);
  assert.equal(survivor.status, 'won');
  assert.equal(combatView(survivor).actors.length, 1);
  const before = authoritativeCheckpoint(survivor);
  const result = render(survivor, { fullReveal: true, reduced: false });
  assert.equal(spriteDraws(result.calls).length, 0);
  assert(!result.calls.some((c) => c.op === 'setLineDash' && c.args[0].length));
  assert.deepEqual(authoritativeCheckpoint(survivor), before);
});

test('one painter reuses a bounded sprite cache and resets it on setLevel and setLook', async () => {
  const run = sample('scout', 24),
    board = painter();
  const draw = () => {
    const result = surface();
    board.draw(result.ctx, run, 0, { paused: true, reduced: true });
    return spriteDraws(result.calls)[0].args[0];
  };
  const first = draw();
  assert.equal(draw(), first);
  board.setLevel(run.level, { seed: 7 });
  const second = draw();
  assert.notEqual(second, first);
  assert.equal(draw(), second);
  await board.setLook(theme, 'neutral-marker');
  const third = draw();
  assert.notEqual(third, second);
  assert.equal(draw(), third);
  const before = canvases.filter((canvas) => canvas.width === 16).length;
  for (let n = 0; n < 200; n++) {
    stepRun(run, { direction: null }, FIXED_DT);
    const canvas = surface();
    board.draw(canvas.ctx, run, 0, { paused: true });
  }
  assert(
    canvases.filter((canvas) => canvas.width === 16).length - before <= 2,
    'Only the two additional walking poses are allocated for this role/palette.',
  );
});
