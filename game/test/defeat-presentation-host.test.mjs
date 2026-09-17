import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const impactDemo = JSON.parse(
  readFileSync(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
);
// The real host/core/renderer execute. Canvas drawing, Phaser and image decode are boundaries.
function rendering() {
  let frame;
  const contexts = new WeakMap();
  return {
    displayCSSWidth: 600,
    Image: class {
      width = 64;
      height = 64;
      set src(value) {
        this.source = value;
        queueMicrotask(() => this.onload?.());
      }
    },
    contextFor(canvas) {
      if (contexts.has(canvas)) return contexts.get(canvas);
      const calls = [],
        values = {},
        stack = [];
      const context = new Proxy(
        { canvas, calls },
        {
          get: (obj, key) =>
            key in obj
              ? obj[key]
              : key in values
                ? values[key]
                : (...args) => {
                    if (key === 'clearRect') calls.length = 0;
                    calls.push({ op: key, args, ...values });
                    if (key === 'save') stack.push({ ...values });
                    if (key === 'restore') Object.assign(values, stack.pop());
                  },
          set: (_, key, value) => {
            values[key] = value;
            return true;
          },
        },
      );
      contexts.set(canvas, context);
      return context;
    },
    onDraw(value) {
      frame = value;
    },
    get frame() {
      return frame;
    },
  };
}
async function setup(t, { themeId = 'fpv', lives = 1, classic = false, reduced = false } = {}) {
  const level = structuredClone(classic ? impactDemo.level : retryFixture('self-contact').level);
  level.rules.lives = lives;
  const surface = rendering(),
    page = await soloPage(t, {
      ...(classic
        ? {
            search: '?practice=1',
            previewStorage: memoryStorage({
              'revealline.playground.current': JSON.stringify({ ...impactDemo, level }),
            }),
          }
        : {
            campaign: {
              version: 'xonix-campaign.v1',
              id: 'defeat-presentation',
              revision: '1',
              title: 'Defeat presentation',
              themeId,
              classRecipes: classes,
              levels: [level],
            },
          }),
      rendering: surface,
    });
  await settle(() => surface.frame.painter.image !== null);
  page.$('reduced-effects').checked = reduced;
  page.$('start-button').click();
  page.key('ArrowDown');
  for (let i = 0; i < (classic ? 292 : 30); i++) page.frame();
  page.key('ArrowDown', false);
  if (!classic) {
    page.key('ArrowUp');
    page.frame();
    page.key('ArrowUp', false);
  }
  return {
    page,
    surface,
    run: page.rendered.run,
    effect: () => surface.frame.painter.effects.find((e) => e.type === 'player.failed'),
  };
}
function key(page, key, extra = {}) {
  const target = page.doc.activeElement,
    event = target.emit('keydown', { key, code: key, ...extra });
  if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
  return event;
}

for (const themeId of ['fpv', 'ukraine', 'retro', 'coupa'])
  test(`${themeId}: real terminal failure is visible before menu; only wreck age advances`, async (t) => {
    const { page, surface, run, effect } = await setup(t, { themeId }),
      checkpoint = authoritativeCheckpoint(run),
      animation = structuredClone(surface.frame.painter.animation),
      time = surface.frame.painter.time,
      firstAge = effect().age;
    assert.equal(run.status, 'lost');
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(page.doc.activeElement.id, 'skip-celebration');
    assert.equal(page.rendered.paused, true);
    assert.equal(page.rendered.defeatEffectsRunning, true);
    const label = `${themeId === 'fpv' ? 'CRAFT LOST' : themeId === 'coupa' ? 'LINK LOST' : 'LIFE LOST'} · -1 LIFE`;
    assert.ok(surface.frame.context.calls.some((c) => c.op === 'fillText' && c.args[0] === label));
    page.frame(100);
    assert.ok(effect().age > firstAge);
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(surface.frame.painter.time, time);
    assert.deepEqual(surface.frame.painter.animation, animation);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    for (let i = 0; i < 6; i++) page.frame(100);
    assert.equal(page.$('game-overlay').hidden, false);
    assert.equal(page.$('game-overlay').dataset.kind, 'lost');
    assert.equal(page.doc.activeElement.id, 'retry-button');
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  });
test('Classic traveling-front defeat, reduced effects, focus loss and explicit skip preserve the terminal run', async (t) => {
  const { page, run, effect } = await setup(t, { classic: true, reduced: true });
  assert.equal(run.status, 'lost');
  assert.equal(run.failureCause, 'enemy-trail');
  assert.equal(page.$('game-overlay').hidden, true);
  const checkpoint = authoritativeCheckpoint(run),
    age = effect().age;
  page.doc.hidden = true;
  page.win.emit('blur');
  page.frame(100);
  assert.equal(effect().age, age);
  page.doc.hidden = false;
  page.win.emit('focus');
  for (let i = 0; i < 10; i++) page.frame(100);
  assert.equal(effect().age, age);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.rendered.defeatEffectsRunning, false);
  key(page, 'Enter');
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  assert.equal(page.doc.activeElement.id, 'retry-button');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  const held = key(page, 'Enter', { repeat: true });
  assert.equal(held.defaultPrevented, true);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  key(page, 'Enter');
  page.frame(0);
  assert.notEqual(page.rendered.run, run);
  assert.equal(page.rendered.run.status, 'running');
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.rendered.run.levelId, impactDemo.level.id);
  assert.equal(page.rendered.run.lives, 1);
  assert.equal(page.rendered.run.level.goal.coverage, impactDemo.level.goal.coverage);
});
test('controller skip cannot carry held Confirm into Retry', async (t) => {
  const { page, run } = await setup(t),
    checkpoint = authoritativeCheckpoint(run),
    pad = {
      index: 0,
      id: 'Defeat controller',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
  navigator.getGamepads = () => [pad];
  // Neutral auto-join does not consume a Confirm press. The first press below
  // skips the wreck, and its held state must not activate the focused Retry.
  page.frame(0);
  pad.buttons[0] = { pressed: true, value: 1 };
  page.frame(0);
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  assert.equal(page.doc.activeElement.id, 'retry-button');
  for (let i = 0; i < 4; i++) page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  pad.buttons[0] = { pressed: false, value: 0 };
  page.frame(0);
  pad.buttons[0] = { pressed: true, value: 1 };
  page.frame(0);
  assert.equal(
    page.rendered.run,
    run,
    'The failed run stays owned during fresh Retry preparation.',
  );
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  const retried = page.rendered.run;
  assert.notEqual(retried, run);
  assert.equal(retried.tick, 0);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.doc.activeElement.id, 'game-canvas');
  for (let i = 0; i < 4; i++) page.frame(0);
  assert.equal(page.rendered.run, retried, 'Held Confirm cannot trigger another Retry.');
  assert.equal(retried.tick, 0);
  assert.deepEqual(page.errors, []);
});
test('nonterminal wreck follows ordinary recovery; Pause holds both recovery and effect until explicit Resume', async (t) => {
  const { page, run, effect } = await setup(t, { lives: 2 });
  assert.equal(run.status, 'respawning');
  assert.equal(run.lives, 1);
  assert.equal(page.$('skip-celebration').hidden, true);
  assert.equal(page.rendered.defeatEffectsRunning, false);
  const age = effect().age;
  page.$('pause-button').click();
  const checkpoint = authoritativeCheckpoint(run);
  page.frame(100);
  assert.equal(effect().age, age);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  page.$('start-button').click();
  for (let i = 0; i < 80; i++) page.frame();
  assert.equal(run.status, 'running');
  assert.equal(run.lives, 1);
  assert.equal(page.$('game-overlay').hidden, true);
});

test('terminal Pause freezes the brief cue; mouse/touch skip reaches results without a gameplay tick', async (t) => {
  const { page, run, effect } = await setup(t),
    checkpoint = authoritativeCheckpoint(run);
  page.$('pause-button').click();
  const age = effect().age;
  for (let i = 0; i < 10; i++) page.frame(100);
  assert.equal(effect().age, age);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.match(page.$('run-message').textContent, /presentation paused/);
  page.$('skip-celebration').click();
  page.frame(0);
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
});
