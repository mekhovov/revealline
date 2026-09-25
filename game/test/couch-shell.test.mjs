import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { couchEquipment } from '../couch/couch-shell.mjs';
import { createRun } from '../core/index.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const pad = (index) => ({
  index,
  id: `Pad ${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
});
const touch = (f, seat, kind) =>
  f.doc.querySelectorAll('.race-pad')[seat].querySelector(`[data-direction="${kind}"]`);
const change = (f, id, value) => {
  f.$(id).value = value;
  f.$(id).emit('change');
};
const press = (f, key, target = f.doc.activeElement, extra = {}) =>
  target.emit('keydown', { key, code: key, repeat: false, ...extra });

test('ordinary running frames retain the Pause label node between pointer edges', async (t) => {
  const f = await couchPage(t);
  f.$('race-start').click();
  f.frame();
  const pause = f.$('race-pause'),
    label = f.doc.createElement('span');
  label.textContent = 'Pause';
  pause.replaceChildren(label);
  const checkpoint = f.checkpoint();
  pause.emit('pointerdown', { pointerType: 'mouse', button: 0 });
  f.frames(3, 0);
  assert.equal(label.parentNode, pause, 'unchanged labels must not be replaced during a gesture');
  assert.equal(pause.disabled, false);
  pause.emit('pointerup', { pointerType: 'mouse', button: 0 });
  pause.click();
  f.frame(0);
  assert.equal(f.state(), 'paused');
  assert.deepEqual(f.checkpoint(), checkpoint);
});

// These assert the real shell's scrolling intent and owner checks, not viewport
// geometry. Root's separate browser samples qualify actual visible focus.
for (const interruption of [
  'other-focus',
  'new-screen',
  'background',
  'hidden',
  'destroyed',
  'detached',
])
  test(`Couch return reveal cannot outlive a focus callback's ${interruption}`, async (t) => {
    const f = await couchPage(t),
      target = f.$('race-options'),
      before = f.checkpoint();
    target.click();
    const focus = target.focus.bind(target),
      reveals = [];
    t.mock.method(target, 'scrollIntoView', (options) => reveals.push(options));
    t.mock.method(target, 'focus', (options) => {
      focus(options);
      if (interruption === 'other-focus') f.$('race-help').focus();
      if (interruption === 'new-screen') f.$('race-help').click();
      if (interruption === 'background') f.doc.focused = false;
      if (interruption === 'hidden') f.doc.hidden = true;
      if (interruption === 'destroyed') f.win.emit('pagehide', { persisted: false });
      if (interruption === 'detached') target.remove();
    });
    f.$('race-options-back').click();
    assert.deepEqual(reveals, []);
    if (interruption === 'other-focus') assert.equal(f.doc.activeElement.id, 'race-help');
    if (interruption === 'new-screen') {
      assert.equal(f.$('race-help-panel').hidden, false);
      assert.equal(f.doc.activeElement.id, 'race-help-read');
    }
    assert.deepEqual(f.checkpoint(), before);
    assert.equal(f.tick(), 0);
  });

test('Couch main Back reveals the same already-focused action without activating it', async (t) => {
  const f = await couchPage(t),
    target = f.$('race-start'),
    before = f.checkpoint(),
    reveals = [];
  target.focus();
  t.mock.method(target, 'scrollIntoView', (options) => {
    assert.equal(f.doc.activeElement === target, true);
    reveals.push(options);
  });
  press(f, 'Escape');
  assert.deepEqual(reveals, [{ block: 'nearest', inline: 'nearest', behavior: 'auto' }]);
  assert.equal(f.doc.activeElement === target, true);
  assert.deepEqual(f.checkpoint(), before);
  assert.equal(f.tick(), 0);
});

test('lobby, setup and children use reachable native controls and Back restores the actual opener', async (t) => {
  const f = await couchPage(t);
  assert.equal(f.doc.documentElement.dataset.toolState, 'ready');
  assert.equal(f.$('race-main').hidden, false);
  assert.equal(f.$('race-boards').hidden, true);
  assert.equal(f.$('race-setup').inert, true);
  const modes = f.$('race-mode-choices');
  assert.deepEqual(
    modes.children.map((element) => element.dataset.gameMode),
    ['solo', 'versus', 'team'],
  );
  const currentMode = modes.querySelector('[aria-current="page"]');
  assert.equal(currentMode.tagName, 'SPAN');
  assert.equal(currentMode.getAttribute('tabindex'), null);
  assert.equal(currentMode.getAttribute('href'), null);
  assert.equal(f.doc.activeElement.id, 'race-start');
  // Optional tuning stays out of the quick-start path while the disclosure is
  // closed. Mode links and Start retain a short native Tab order.
  for (const id of ['race-coop', 'race-solo-return']) {
    press(f, 'Tab', f.doc.activeElement, { shiftKey: true });
    assert.equal(f.doc.activeElement.id, id);
  }
  assert.equal(f.doc.activeElement.getAttribute('href'), '../?journey=legacy');
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-coop');
  assert.equal(
    f.doc.activeElement.getAttribute('href'),
    'relay-rescue.html?journey=legacy&return=versus',
  );
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-start');
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-chapters');
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-optional-setup-toggle');
  f.doc.activeElement.click();
  assert.equal(f.$('race-optional-setup').open, true);
  for (const id of [
    'race-actor-style',
    'race-journey-difficulty',
    'race-journey-preferences-retry',
    'race-journey-preferences-export',
    'race-focus',
  ]) {
    press(f, 'Tab');
    assert.equal(f.doc.activeElement.id, id);
  }
  assert.equal(f.doc.activeElement.id, 'race-focus');
  f.doc.activeElement.click();
  assert.equal(f.doc.activeElement.id, 'race-level');
  assert.equal(f.$('race-main').inert, true);
  const before = f.renders[0];
  press(f, 'ArrowDown');
  assert.equal(f.doc.activeElement.id, 'race-level', 'native select keeps native editing');
  press(f, 'Escape');
  assert.equal(f.doc.activeElement.id, 'race-focus');
  assert.equal(f.renders[0], before);
  for (const [button, screen] of [
    ['race-options', 'race-options-panel'],
    ['race-help', 'race-help-panel'],
  ]) {
    f.$(button).click();
    assert.equal(f.$(screen).hidden, false);
    press(f, 'Escape');
    assert.equal(f.doc.activeElement.id, button);
    assert.equal(f.$(screen).inert, true);
  }
  assert.equal(f.tick(), 0);
  for (const id of ['race-solo-return', 'race-coop']) {
    assert.equal(f.$(id).emit('click').defaultPrevented, false, 'ready mode links stay direct');
    assert.equal(f.$('race-leave-panel').hidden, true);
  }
});

test('an embedded Couch route stays loading until its actual setup is prepared', async (t) => {
  let began, finish;
  const requested = new Promise((resolve) => {
    began = resolve;
  });
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const opening = couchPage(t, {
    async fetchResponse(path) {
      if (path === '../content/campaign.json') {
        began();
        await pending;
      }
    },
  });
  await requested;
  const doc = globalThis.document;
  assert.equal(doc.documentElement.dataset.toolState, 'loading');
  assert.equal(doc.getElementById('boot-return').hidden, false);
  assert.equal(doc.getElementById('boot-return').closest('[inert]'), null);
  finish();
  const f = await opening;
  assert.equal(f.doc.documentElement.dataset.toolState, 'ready');
  assert.equal(f.tick(), 0);
  assert.equal(f.$('race-start').disabled, false);
});

test('pause children and cancelled new match preserve two different continuations; reset is explicit', async (t) => {
  const f = await couchPage(t);
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.key('ArrowLeft');
  f.frames(4);
  f.key('KeyD', false);
  f.key('ArrowLeft', false);
  f.$('race-pause').click();
  f.frame();
  const held = f.checkpoint(),
    oldRuns = [...f.renders];
  assert.equal(
    f
      .$('race-main')
      .querySelectorAll('button')
      .filter((b) => /^New match/.test(b.textContent)).length,
    1,
  );
  for (const id of ['race-options', 'race-help', 'race-focus', 'race-solo-return', 'race-coop']) {
    f.$(id).click();
    f.frames(4, 100);
    assert.deepEqual(f.checkpoint(), held);
    press(f, 'Escape');
    assert.equal(f.state(), 'paused');
  }
  f.$('race-start').click();
  f.frame();
  f.frames(4);
  assert.ok(f.renders[0].player.x > oldRuns[0].level.spawn.x);
  assert.ok(f.renders[1].player.x < oldRuns[1].level.spawn.x);
  f.$('race-pause').click();
  f.$('race-focus').click();
  assert.equal(f.$('race-confirm').hidden, false);
  f.$('race-confirm-reset').click();
  f.frame();
  await waitFor(
    () => {
      f.frame(0);
      return f.state() === 'ready';
    },
    { message: 'The explicit new-match replacement did not finish staging.' },
  );
  assert.equal(f.state(), 'ready');
  assert.notEqual(f.renders[0], oldRuns[0]);
  assert.equal(f.$('race-setup').hidden, false);
  assert.equal(f.tick(), 0);
  assert.equal(f.$('series-score').textContent, '0 : 0');
});

test('per-seat Auto expands on touch and defers collapse until pause without changing movement', async (t) => {
  const f = await couchPage(t, { pads: [pad(0), pad(1)] });
  const pads = f.doc.querySelectorAll('.race-pad');
  f.$('race-start').click();
  f.frame();
  assert.ok(pads.every((p) => p.hidden));
  f.$('race-canvas-0').emit('pointerdown', { pointerType: 'touch', pointerId: 60 });
  assert.equal(pads[0].hidden, false);
  assert.equal(pads[1].hidden, true);
  touch(f, 0, 'right').emit('pointerdown', { pointerType: 'touch', pointerId: 61, button: 0 });
  f.frames(5);
  f.key('KeyD');
  f.key('KeyD', false);
  assert.equal(pads[0].hidden, false, 'held pad cannot vanish while running');
  assert.match(f.$('racer-input-0').textContent, /until pause/);
  touch(f, 0, 'right').emit('pointerup', { pointerId: 61 });
  f.$('race-pause').click();
  f.frame();
  const before = f.renders[0].player.x;
  f.$('race-start').click();
  f.frame();
  f.frames(3);
  assert.equal(pads[0].hidden, true);
  assert.ok(f.renders[0].player.x > before, 'only physical visibility changed');
});

test('Always supports independent pointer players; Off wins over coarse and later touch', async (t) => {
  const f = await couchPage(t, { coarse: true });
  f.$('race-options').click();
  f.$('race-settings-tab-controls').click();
  change(f, 'race-touch-0', 'off');
  change(f, 'race-touch-1', 'always');
  f.$('race-options-back').click();
  f.$('race-start').click();
  f.frame();
  const pads = f.doc.querySelectorAll('.race-pad');
  assert.equal(pads[0].hidden, true);
  assert.equal(pads[1].hidden, false);
  f.$('race-canvas-0').emit('pointerdown', { pointerType: 'touch', pointerId: 70 });
  assert.equal(pads[0].hidden, true);
  const steering = pads[1].querySelector('.touch-surface');
  steering.getBoundingClientRect = () => ({ left: 0, top: 0, width: 156, height: 156 });
  steering.emit('pointerdown', {
    pointerType: 'touch',
    pointerId: 71,
    button: 0,
    clientX: 78,
    clientY: 78,
  });
  steering.emit('pointermove', {
    pointerType: 'touch',
    pointerId: 71,
    button: 0,
    clientX: 12,
    clientY: 78,
  });
  f.frames(6);
  assert.ok(f.renders[1].player.x < f.renders[1].level.spawn.x);
  assert.equal(f.renders[0].player.x, f.renders[0].level.spawn.x);
});

test('authored Arcade removes equipment controls and hints; Tactical reflects the equipped recipe', async (t) => {
  const fixture = {
    version: 'xonix-level.v4',
    id: 'shell-authored-arcade',
    revision: '1',
    name: 'Authored Arcade',
    width: 72,
    height: 36,
    encounter: null,
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      arcadeActions: { version: 'arcade-actions.v1' },
    },
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 60.5, y: 20.5, vx: 0.1, vy: 0 }],
    rules: { lives: 3, stopOnCapture: true },
  };
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'shell-arcade',
    title: 'Shell Arcade',
    revision: '1',
    levels: [fixture],
  };
  const f = await couchPage(t, { campaign, coarse: true });
  f.$('race-help').click();
  assert.doesNotMatch(f.$('race-help-0').textContent, /Shift|Scan|supply|Boost/);
  assert.doesNotMatch(f.$('race-controller-help').textContent, /South|West|shoulder/);
  f.$('race-help-back').click();
  f.$('race-options').click();
  assert.equal(f.$('race-tap-field').hidden, true);
  f.$('race-options-back').click();
  f.$('race-start').click();
  f.frame();
  for (const p of f.doc.querySelectorAll('.race-pad')) {
    assert.equal(p.hidden, false);
    for (const b of p.querySelectorAll('[data-action]')) assert.ok(b.hidden && b.disabled);
  }
  const base = JSON.parse(
    await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  );
  const scout = createRun(base.levels[0], { classId: 'scout' });
  assert.deepEqual(couchEquipment(scout), {
    action: true,
    pickup: false,
    boost: true,
    label: 'Scan',
    description: scout.classRecipe.description,
  });
  const carrier = createRun(base.levels[0], { classId: 'bomber' });
  assert.equal(couchEquipment(carrier).pickup, carrier.supplies.length > 0);
  assert.equal(couchEquipment(carrier).label, 'Stun field');
});

test('controller setup/help and repeated keyboard Confirm cannot leak through the flight boundary', async (t) => {
  const f = await couchPage(t, { pads: [pad(0)] });
  f.join(0);
  f.focus('race-help');
  f.pulse(0, 0);
  assert.equal(f.$('race-help-panel').hidden, false);
  f.pulse(0, 1);
  assert.equal(f.doc.activeElement.id, 'race-help');
  f.focus('race-start');
  f.pulse(0, 0);
  f.frame();
  f.key('Escape');
  f.key('Escape', false);
  f.frame();
  assert.equal(f.state(), 'paused');
  const held = f.checkpoint();
  const e = press(f, 'Enter', f.$('race-start'), { repeat: true });
  assert.equal(e.defaultPrevented, true);
  f.frames(4);
  assert.deepEqual(f.checkpoint(), held);
  f.$('race-start').click();
  f.frame();
  assert.equal(f.state(), 'running');
  assert.equal(f.renders[0].ability.cooldownUntil, 0);
});

test('markup keeps touch crosses outside both arenas and uses separate screen roots', async () => {
  const css = await readFile(new URL('../couch/couch.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: repeat\(3, 44px\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /grid-template-rows: auto minmax\(48px, 1fr\)/);
  assert.match(css, /\.race-pad button\.pressed/);
  // A modal may reserve a viewport gutter. The actual boards must still derive
  // their space from the layout rather than subtracting a guessed HUD height.
  const boardLayout = css.replace(/\.race-chapter-replace\s*\{[^{}]*\}/g, '');
  assert.doesNotMatch(boardLayout, /100dvh\s*-/);
  assert.doesNotMatch(css, /visibility: hidden/);
  // Actual host tests above assert mounted ancestry and lifecycle; pixel fit needs a browser.
});

test('controller can read and scroll Help without starting; Back exits reading then the child', async (t) => {
  const f = await couchPage(t, { pads: [pad(0)] });
  f.join(0);
  f.focus('race-help');
  f.pulse(0, 0);
  f.frame();
  const region = f.$('race-help-reading');
  region.clientHeight = 100;
  region.scrollHeight = 450;
  f.pulse(0, 0);
  assert.equal(f.doc.activeElement.id, 'race-help-reading');
  f.pulse(0, 13);
  assert.ok(region.scrollTop > 0);
  f.pulse(0, 1);
  assert.equal(f.doc.activeElement.id, 'race-help-read');
  f.pulse(0, 1);
  assert.equal(f.doc.activeElement.id, 'race-help');
  assert.equal(f.tick(), 0);
});

test('a real finished draw exposes both frozen boards, Results returns without a new round', async (t) => {
  const base = JSON.parse(
    await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  );
  const campaign = { ...base, briefs: [], levels: [retryFixture('enemy-player').level] };
  const f = await couchPage(t, { campaign }),
    firstResultsReveal = [];
  t.mock.method(f.$('race-start'), 'scrollIntoView', (options) => {
    firstResultsReveal.push({
      options,
      title: f.$('race-title').textContent,
      rows: [0, 1].map((i) => ({
        hidden: f.$(`race-result-${i}`).hidden,
        text: f.$(`race-result-${i}`).textContent,
      })),
    });
  });
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.key('ArrowRight');
  f.frames(60);
  assert.equal(f.state(), 'finished');
  const before = f.checkpoint();
  const score = f.$('series-score').textContent;
  assert.match(f.$('race-title').textContent, /Race complete/);
  assert.equal(f.$('race-result-0').hidden, false);
  assert.equal(f.$('race-result-1').hidden, false);
  assert.deepEqual(firstResultsReveal, [
    {
      options: { block: 'nearest', inline: 'nearest', behavior: 'auto' },
      title: 'Race complete.',
      rows: [0, 1].map((i) => ({ hidden: false, text: f.$(`race-result-${i}`).textContent })),
    },
  ]);
  f.$('race-review').click();
  assert.equal(f.$('race-boards').hidden, false);
  assert.equal(f.$('race-shell').hidden, true);
  assert.equal(f.doc.activeElement.id, 'race-pause');
  for (const i of [0, 1]) assert.match(f.$(`racer-input-${i}`).textContent, /Results for Settings/);
  f.frames(10, 200);
  assert.deepEqual(f.checkpoint(), before);
  const revealed = [];
  t.mock.method(f.$('race-review'), 'scrollIntoView', (options) => {
    assert.equal(f.doc.activeElement === f.$('race-review'), true);
    assert.equal(f.$('race-main').hidden || f.$('race-main').inert, false);
    revealed.push(options);
  });
  f.$('race-pause').click();
  assert.equal(f.$('race-main').hidden, false);
  assert.equal(f.doc.activeElement.id, 'race-review');
  assert.deepEqual(revealed, [{ block: 'nearest', inline: 'nearest', behavior: 'auto' }]);
  assert.equal(
    f
      .$('race-main')
      .querySelectorAll('button')
      .filter((b) => /^New match/.test(b.textContent)).length,
    1,
  );
  f.$('race-focus').click();
  assert.equal(f.$('race-confirm').hidden, false);
  f.$('race-confirm-back').click();
  assert.equal(f.doc.activeElement.id, 'race-focus');
  assert.equal(f.$('series-score').textContent, score);
  assert.deepEqual(f.checkpoint(), before);
});

test('an old held controller cannot reclaim a seat from accepted touch across pause and resume', async (t) => {
  const f = await couchPage(t, { pads: [pad(0), pad(1)] });
  f.$('race-start').click();
  f.frame();
  f.pads()[0].axes[0] = 1;
  f.frame();
  assert.equal(f.$('race-seat-0').textContent, 'Controller');
  f.$('race-canvas-0').emit('pointerdown', { pointerType: 'touch', pointerId: 80 });
  const right = touch(f, 0, 'right');
  right.emit('pointerdown', { pointerType: 'touch', pointerId: 81, button: 0 });
  right.emit('pointerup', { pointerId: 81 });
  f.frames(8);
  assert.equal(
    f.$('race-seat-0').textContent,
    'Touch',
    'steady old stick is not a new accepted gesture',
  );
  assert.ok(right.classList.contains('pressed'), 'actual continuous direction state is visible');
  const pads = f.doc.querySelectorAll('.race-pad');
  assert.equal(pads[0].hidden, false);
  assert.equal(pads[1].hidden, true);
  f.key('ArrowLeft');
  f.key('ArrowLeft', false);
  f.frames(3);
  assert.equal(f.$('race-seat-0').textContent, 'Touch', 'Player 2 cannot change Player 1 modality');
  f.$('race-pause').click();
  f.frame();
  f.$('race-start').click();
  f.frame();
  f.frames(5);
  assert.equal(f.$('race-seat-0').textContent, 'Touch', 'still-held pad is blocked after resume');
  assert.equal(pads[0].hidden, false);
  f.pads()[0].axes[0] = 0;
  f.frame();
  f.pads()[0].axes[0] = -1;
  f.frame();
  assert.equal(
    f.$('race-seat-0').textContent,
    'Controller',
    'neutral then a fresh accepted edge can switch back',
  );
  assert.equal(pads[0].hidden, false, 'collapse still waits for pause');
});

test('blocked pad input and held keyboard repeats never replace newer touch modality', async (t) => {
  const blocked = pad(0);
  blocked.axes[0] = 1;
  const f = await couchPage(t, { pads: [blocked] });
  f.$('race-start').click();
  f.frame();
  f.frames(4);
  assert.equal(f.$('race-seat-0').textContent, 'W A S D');
  assert.equal(f.renders[0].player.x, f.renders[0].level.spawn.x);
  f.key('KeyD');
  f.$('race-canvas-0').emit('pointerdown', { pointerType: 'touch', pointerId: 90 });
  f.$('race-canvas-0').emit('keydown', { key: 'd', code: 'KeyD', repeat: true });
  f.frames(5);
  assert.equal(f.$('race-seat-0').textContent, 'Touch');
  assert.equal(f.$('race-seat-1').textContent, 'Arrow keys');
  assert.equal(f.doc.querySelectorAll('.race-pad')[1].hidden, true);
  f.key('KeyD', false);
});

test('accepted-input observer is optional and observer failures cannot reject or replay commands', async (t) => {
  const { attachCouchInput } = await import('../couch/couch-input.mjs');
  const { Document, Events } = await import('./helpers/couch-dom.mjs');
  const { mountCouch } = await import('./helpers/couch-host.mjs');
  const doc = new Document(),
    win = new Events(),
    hardware = pad(0),
    events = [];
  doc.parentNode = win;
  mountCouch(doc, await readFile(new URL('../couch/index.html', import.meta.url), 'utf8'));
  const input = attachCouchInput({
    window: win,
    document: doc,
    continuousSteering: () => true,
    getGamepads: () => [hardware],
    onAcceptedInput: (seat, source) => {
      events.push([seat, source]);
      throw new Error('Display unavailable');
    },
  });
  t.after(() => input.destroy());
  input.poll();
  hardware.axes[0] = 1;
  assert.equal(input.poll()[0].direction, 'right');
  assert.deepEqual(events, [[0, 'controller']]);
  input.poll();
  input.consume();
  assert.equal(events.length, 1, 'no observer replay for a held sample or fixed substep');
  const canvas = doc.getElementById('race-canvas-0');
  canvas.emit('keydown', { key: 'a', code: 'KeyA', repeat: false });
  assert.equal(input.consume()[0].direction, 'left');
  assert.deepEqual(events.at(-1), [0, 'keyboard']);
  input.poll();
  assert.equal(
    input.consume()[0].direction,
    'left',
    'local accepted heading still wins over the same held pad',
  );
  assert.equal(events.length, 2);
  input.clearPhysical();
  input.poll();
  assert.equal(events.length, 2, 'held controller blocked by clearPhysical is not accepted');
});

test('Couch timed clock retains accessible meaning in its compact display', async (t) => {
  const f = await couchPage(t, { seconds: '30' });
  await f.$('race-start').onclick();
  f.frame(0);
  assert.equal(f.$('race-clock').textContent, '0:30');
  assert.equal(f.$('race-clock').dataset.compact, '0:30');
  const before = f.checkpoint();
  f.$('race-pause').click();
  assert.deepEqual(f.checkpoint(), before);
  assert.equal(f.$('race-clock').textContent, '0:30');
});
