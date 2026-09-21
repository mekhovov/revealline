import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { combatLevel, combat, ticks } from './helpers/combat-fixture.mjs';

const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const theme = {
  ...JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes[0],
  id: 'combat-render-test',
  family: 'test',
};
const image = (id, width = 32, height = width) => ({ id, width, height });
let oldDocument;
let canvases;

function surface(width = 1152) {
  const calls = [],
    stack = [],
    values = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, lineDash: [] };
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

before(() => {
  oldDocument = globalThis.document;
  canvases = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { id: `offscreen-${canvases.length}`, width: 0, height: 0 },
        drawing = surface();
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
});

function painter() {
  const result = new BoardPainter(presets);
  result.theme = theme;
  result.bodyId = 'neutral-marker';
  result.body = presets.characters[result.bodyId];
  result.recipe = presets.animationRecipes[result.body.animationRecipe];
  result.image = image('player');
  result.images.enemy = image('keeper');
  result.background = image('picture', 768, 576);
  return result;
}

function sample(kind, count, { capture = false } = {}) {
  const level = combatLevel(kind);
  if (capture) level.classic.combatPatrols.actors[0].y = 25.5;
  const run = createRun(level, { seed: 7 });
  ticks(run, count, 'right');
  return run;
}

function render(run, { width = 1152, dt = 0, ...options } = {}) {
  const board = painter(),
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

test('absent and disabled combat keep identical board command streams', () => {
  const absentLevel = combatLevel();
  delete absentLevel.classic.combatPatrols;
  const disabledLevel = combatLevel();
  disabledLevel.classic.combatPatrols.enabled = false;
  const absent = createRun(absentLevel, { seed: 7 }),
    disabled = createRun(disabledLevel, { seed: 7 });
  ticks(absent, 120, 'right');
  ticks(disabled, 120, 'right');
  for (const width of [294, 1152]) {
    const absentBefore = authoritativeCheckpoint(absent),
      disabledBefore = authoritativeCheckpoint(disabled),
      absentPaint = render(absent, { width }),
      disabledPaint = render(disabled, { width });
    assert.deepEqual(disabledPaint.calls, absentPaint.calls);
    assert.equal(spriteDraws(absentPaint.calls).length, 0);
    assert.deepEqual(authoritativeCheckpoint(absent), absentBefore);
    assert.deepEqual(authoritativeCheckpoint(disabled), disabledBefore);
  }
});

test('malformed active combat throws before drawing or allocating presentation sprites', () => {
  const run = sample('sentry', 300),
    board = painter(),
    canvas = surface(),
    beforeCanvases = canvases.length;
  let invoked = 0;
  Object.defineProperty(combat(run).actors[0], 'x', {
    enumerable: true,
    get() {
      invoked++;
      return 12;
    },
  });
  assert.throws(
    () => board.draw(canvas.ctx, run, 1, { fullReveal: false }),
    /Cannot render optional combat/,
  );
  assert.equal(invoked, 0);
  assert.deepEqual(canvas.calls, []);
  assert.equal(canvases.length, beforeCanvases);
});

test('warning body and locked ray draw below trail, keeper and craft', () => {
  const run = sample('sentry', 300),
    view = combatView(run),
    before = authoritativeCheckpoint(run),
    { calls } = render(run);
  assert.equal(view.actors[0].phase, 'warning');
  const body = commandIndex(calls, (entry) => spriteDraws([entry]).length === 1),
    ray = commandIndex(
      calls,
      (entry) => entry.op === 'stroke' && entry.lineDash[0] === 4 && entry.lineDash[1] === 3,
    ),
    trail = commandIndex(
      calls,
      (entry) =>
        entry.op === 'stroke' &&
        entry.strokeStyle === theme.palette.accent &&
        entry.lineWidth === 3 &&
        entry.lineDash.length === 0,
    ),
    keeper = commandIndex(
      calls,
      (entry) => entry.op === 'drawImage' && entry.args[0].id === 'keeper',
    ),
    player = commandIndex(
      calls,
      (entry) => entry.op === 'drawImage' && entry.args[0].id === 'player',
    );
  assert(body < ray && ray < trail && trail < keeper && keeper < player);
  assert(
    calls.some(
      (entry) =>
        entry.op === 'lineTo' &&
        atPoint(entry.args, view.actors[0].rayEnd.x * 16, view.actors[0].rayEnd.y * 16),
    ),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('live projectile draws above keepers and below the craft', () => {
  const run = sample('sentry', 380),
    view = combatView(run),
    { calls } = render(run),
    projectile = view.projectiles[0];
  assert(projectile);
  const keeper = commandIndex(
      calls,
      (entry) => entry.op === 'drawImage' && entry.args[0].id === 'keeper',
    ),
    diamond = commandIndex(
      calls,
      (entry) =>
        entry.op === 'moveTo' && atPoint(entry.args, projectile.x * 16, projectile.y * 16 - 4),
    ),
    player = commandIndex(
      calls,
      (entry) => entry.op === 'drawImage' && entry.args[0].id === 'player',
    );
  assert(keeper < diamond && diamond < player);
});

test('scrap is the only layer hidden by its cosmetic toggle, including terminal frames', () => {
  const removed = sample('scout', 150),
    mark = combatView(removed).eliminations[0],
    shown = render(removed, { showCombatScrap: true }),
    hidden = render(removed, { showCombatScrap: false });
  const isScrap = (entry) =>
    entry.op === 'fillRect' &&
    atPoint(entry.args, mark.x * 16 - 4, mark.y * 16 - 2) &&
    entry.args[2] === 8 &&
    entry.args[3] === 4;
  assert(shown.calls.some(isScrap));
  assert(!hidden.calls.some(isScrap));

  for (const count of [300, 380]) {
    const run = sample('sentry', count),
      board = painter(),
      withScrap = surface(),
      withoutScrap = surface();
    board.draw(withScrap.ctx, run, 0, { paused: true, reduced: true });
    board.draw(withoutScrap.ctx, run, 0, {
      paused: true,
      reduced: true,
      showCombatScrap: false,
    });
    assert.deepEqual(withoutScrap.calls, withScrap.calls);
    assert.equal(spriteDraws(withoutScrap.calls).length, 1);
    if (count === 300)
      assert(
        withoutScrap.calls.some((entry) => entry.op === 'setLineDash' && entry.args[0][0] === 4),
      );
    else {
      const shot = combatView(run).projectiles[0];
      assert(
        withoutScrap.calls.some(
          (entry) => entry.op === 'moveTo' && atPoint(entry.args, shot.x * 16, shot.y * 16 - 4),
        ),
      );
    }
  }

  const terminal = sample('scout', 1000, { capture: true }),
    terminalView = combatView(terminal),
    terminalPaint = render(terminal, { fullReveal: true, reduced: false });
  assert.equal(terminalView.status, 'won');
  assert.equal(terminalView.eliminations.length, 1);
  assert.equal(spriteDraws(terminalPaint.calls).length, 0);
});
