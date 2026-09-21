import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';

const classic = JSON.parse(
  readFileSync(new URL('../content/packs/classic-lab.json', import.meta.url)),
);
function controller() {
  return {
    index: 0,
    id: 'DualSense Wireless Controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}
async function classicPage(t, options = {}) {
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const page = await soloPage(t, options);
  page.$('library-button').click();
  page.doc.querySelector('[data-library-panel="packs"]').click();
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.$('library-packs').hidden, false);
  const arcade = structuredClone(classic);
  arcade.campaigns[0].levels[0].classic.arcadeActions = { version: 'arcade-actions.v1' };
  page.$('pack-json').value = JSON.stringify(arcade);
  page.$('install-pack').click();
  await settle(() => !page.$('install-pack').disabled, 'Classic pack installed');
  const play = page
    .$('installed-packs')
    .querySelectorAll('button')
    .find((button) => button.textContent === `Play ${classic.campaigns[0].title}`);
  assert.ok(play);
  play.click();
  await settle(
    () =>
      !page.$('library-dialog').open &&
      page.$('pack-select').value === classic.id &&
      page.doc.body.dataset.pictureState === 'ready' &&
      !page.$('start-button').disabled,
    'Visible installed campaign launch completes before input testing',
  );
  page.frame(0);
  assert.equal(page.rendered.run.levelId, arcade.campaigns[0].levels[0].id);
  assert.equal(page.doc.body.dataset.flightState, 'briefing');
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.$('game-overlay').dataset.kind, 'ready');
  return page;
}
async function setup(t) {
  const pad = controller();
  const page = await classicPage(t, { readPads: () => [pad] });
  const release = () => {
    pad.axes.fill(0);
    pad.buttons.forEach((b) => {
      b.pressed = false;
      b.value = 0;
    });
    page.frame();
    page.frame();
  };
  const press = (index) => {
    release();
    pad.buttons[index].pressed = true;
    page.frame();
  };
  async function start() {
    release();
    press(0);
    await settle(() => page.doc.body.dataset.flightState === 'running', 'Flight starts');
    release();
  }
  return { page, pad, press, release, start };
}

test('actual host: either stick moves, face pause/resume preserves the run and replay, disconnect pauses', async (t) => {
  const { page, pad, press, release, start } = await setup(t);
  await start();
  const x = page.rendered.run.player.x;
  pad.axes[0] = 1;
  for (let i = 0; i < 30; i++) page.frame();
  assert.ok(page.rendered.run.player.x > x);
  release();
  pad.axes[2] = -1;
  for (let i = 0; i < 10; i++) page.frame();
  assert.ok(page.rendered.run.player.x < x + 3);
  press(0);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  const paused = [page.rendered.run.player.x, page.rendered.run.player.y];
  page.frame();
  page.frame();
  assert.deepEqual([page.rendered.run.player.x, page.rendered.run.player.y], paused);
  const saved = JSON.parse(page.storage.getItem('revealline.suspended.dev.v1'));
  assert.equal(verifyReplay(saved.replay).match, true);
  press(9);
  await settle(() => page.doc.body.dataset.flightState === 'running', 'Menu resumes');
  release();
  pad.connected = false;
  page.frame();
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(page.errors, []);
});

test('actual host: B pauses, X opens field guide, Y opens missions; back closes the active modal', async (t) => {
  const { page, press, release, start } = await setup(t);
  await start();
  press(1);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  await start();
  press(2);
  assert.equal(page.$('enemy-guide-dialog').open, true);
  press(1);
  release();
  assert.equal(page.$('enemy-guide-dialog').open, false);
  await start();
  press(3);
  assert.equal(page.$('shell-missions').open, true);
  press(1);
  release();
  assert.equal(page.$('shell-missions').open, false);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(page.errors, []);
});

for (const mode of ['stick', 'swipe', 'dpad']) {
  test(`actual host: ${mode} changes direction and gesture release keeps continuous flight`, async (t) => {
    const page = await classicPage(t);
    page.change('touch-mode', mode);
    for (const hand of ['right', 'left']) {
      page.change('touch-side', hand);
      assert.equal(page.doc.body.dataset.touchSide, hand);
      assert.equal(page.doc.body.dataset.screenSteeringHand, hand);
      assert.deepEqual(
        page.doc.querySelector('.play-controls').children.map((node) => node.id || node.className),
        hand === 'right'
          ? ['ability-buttons', 'touch-surface', 'direction-controls']
          : ['touch-surface', 'direction-controls', 'ability-buttons'],
      );
    }
    page.change('screen-controls', 'always');
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running', 'Flight starts');
    const surface =
      mode === 'dpad' ? page.doc.querySelector('.direction-controls') : page.$('touch-surface');
    surface._rect = { x: 0, y: 0, width: 156, height: 156 };
    const event = (type, x, y) =>
      surface.emit(type, { pointerId: 7, pointerType: 'touch', button: 0, clientX: x, clientY: y });
    event('pointerdown', mode === 'dpad' ? 145 : 78, 78);
    if (mode !== 'dpad') event('pointermove', 110, 78);
    page.frame();
    const x = page.rendered.run.player.x;
    event('pointerup', 110, 78);
    for (let i = 0; i < 10; i++) page.frame();
    assert.ok(page.rendered.run.player.x > x, `${mode} keeps flying after release`);
    page.$('pause-button').click();
    const position = page.rendered.run.player.x;
    event('pointermove', 10, 78);
    page.frame();
    assert.equal(page.rendered.run.player.x, position);
    assert.deepEqual(page.errors, []);
  });
}

test('cold Steam Deck-style discovery: fresh A starts the selected flight after neutral input', async (t) => {
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const pad = controller();
  pad.id = 'Steam Deck Controller';
  let connected = false;
  const page = await soloPage(t, { titleScreen: true, readPads: () => (connected ? [pad] : []) });
  const release = () => {
    pad.buttons.forEach((b) => {
      b.pressed = false;
      b.value = 0;
    });
    pad.axes.fill(0);
    page.frame();
    page.frame();
  };
  const press = (index) => {
    release();
    pad.buttons[index].pressed = true;
    pad.buttons[index].value = 1;
    page.frame();
  };
  assert.equal(page.$('shell-home').open, true);
  connected = true;
  pad.buttons[0].pressed = true;
  page.frame();
  assert.equal(page.$('shell-home').open, true, 'Discovery press cannot accidentally launch');
  release();
  press(0);
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.rendered.run.player.speed, 0, 'The title Confirm is not a flight command');
  release();
  assert.deepEqual(page.errors, []);
});

test('Solo adopts the shared couch choice and editing opacity preserves its other fields', async (t) => {
  const shared = { mode: 'swipe', side: 'left', size: 'large', opacity: 0.7 };
  const storage = memoryStorage({ [TOUCH_PREFERENCES_KEY]: JSON.stringify(shared) });
  const page = await soloPage(t, { titleScreen: true, storage });
  page.$('shell-options').click();
  page.$('settings-tab-controls').click();
  assert.equal(page.$('touch-mode').value, 'swipe');
  assert.equal(page.$('touch-side').value, 'left');
  assert.equal(page.$('touch-size').value, 'large');
  page.change('touch-opacity', '0.8');
  assert.deepEqual(JSON.parse(storage.getItem(TOUCH_PREFERENCES_KEY)), { ...shared, opacity: 0.8 });
  assert.equal(page.$('touch-mode').value, 'swipe');
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('Solo reports a denied shared save while retaining the current touch choice', async (t) => {
  const storage = memoryStorage(),
    setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === TOUCH_PREFERENCES_KEY) throw new DOMException('Full', 'QuotaExceededError');
    setItem(key, value);
  };
  const page = await soloPage(t, { titleScreen: true, storage });
  page.$('shell-options').click();
  page.$('settings-tab-controls').click();
  page.change('touch-mode', 'swipe');
  assert.equal(page.$('touch-mode').value, 'swipe');
  assert.equal(page.$('screen-steering-status').hidden, false);
  assert.match(page.$('screen-steering-status').textContent, /for this visit/);
  assert.equal(storage.getItem(TOUCH_PREFERENCES_KEY), null);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('modeled controller: Missions selection, Deploy, Pause and explicit Resume need no pointer click', async (t) => {
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const pad = controller();
  const page = await soloPage(t, { titleScreen: true, readPads: () => [pad] });
  const release = () => {
    pad.buttons.forEach((b) => {
      b.pressed = false;
      b.value = 0;
    });
    pad.axes.fill(0);
    page.frame();
    page.frame();
  };
  const press = (index) => {
    release();
    pad.buttons[index].pressed = true;
    pad.buttons[index].value = 1;
    page.frame();
  };
  const navigate = (id) => {
    const visited = [];
    for (let count = 0; count < 40 && page.doc.activeElement?.id !== id; count++) {
      visited.push(page.doc.activeElement?.id || page.doc.activeElement?.className);
      press(13);
    }
    assert.equal(page.doc.activeElement?.id, id, `Controller focus path: ${visited.join(' → ')}`);
  };
  release();
  navigate('shell-play');
  press(0);
  assert.equal(page.$('shell-missions').open, true);
  navigate('shell-deploy');
  assert.equal(page.$('shell-deploy').disabled, false);
  press(0);
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  release();
  assert.equal(page.$('shell-missions').open, false);
  assert.equal(page.rendered.run.player.speed, 0);
  press(9);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  const checkpoint = page.rendered.run.tick;
  release();
  page.frame();
  assert.equal(page.rendered.run.tick, checkpoint);
  press(0);
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  assert.deepEqual(page.errors, []);
});

for (const mode of ['stick', 'swipe', 'dpad'])
  test(`actual host: ${mode} hands steering to and from a held controller without stealing direction`, async (t) => {
    const { page, pad, press, release, start } = await setup(t);
    page.change('touch-mode', mode);
    page.change('screen-controls', 'always');
    await start();
    const surface =
      mode === 'dpad' ? page.doc.querySelector('.direction-controls') : page.$('touch-surface');
    surface._rect = { x: 0, y: 0, width: 156, height: 156 };
    const pointer = (type, x, y = 78) =>
      surface.emit(type, {
        pointerId: 71,
        pointerType: 'touch',
        button: 0,
        clientX: x,
        clientY: y,
      });
    pad.axes[0] = 1;
    for (let i = 0; i < 5; i++) page.frame();
    assert.equal(page.rendered.run.player.direction, 'right');
    const beforeTouch = page.rendered.run.player.x;
    pointer('pointerdown', mode === 'dpad' ? 8 : 78);
    if (mode !== 'dpad') pointer('pointermove', 40);
    for (let i = 0; i < 5; i++) page.frame();
    assert.equal(page.rendered.run.player.direction, 'left');
    assert.ok(page.rendered.run.player.x < beforeTouch, 'New touch input beats the old held stick');
    pointer('pointerup', 40);
    for (let i = 0; i < 5; i++) page.frame();
    assert.equal(
      page.rendered.run.player.direction,
      'left',
      'Releasing touch does not hand back to stale stick',
    );
    release();
    pad.axes[0] = 1;
    for (let i = 0; i < 5; i++) page.frame();
    assert.equal(
      page.rendered.run.player.direction,
      'right',
      'Fresh controller movement can reclaim steering',
    );
    pointer('pointerdown', mode === 'dpad' ? 8 : 78);
    if (mode !== 'dpad') pointer('pointermove', 40);
    page.frame();
    pointer('pointercancel', 40);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    const pausedTick = page.rendered.run.tick;
    pointer('pointermove', 145);
    for (let i = 0; i < 5; i++) page.frame();
    assert.equal(
      page.rendered.run.tick,
      pausedTick,
      'Interrupted finger and held stick cannot resume',
    );
    press(0);
    await settle(() => {
      page.frame(0);
      return page.doc.body.dataset.flightState === 'running';
    });
    release();
    press(9);
    const saved = JSON.parse(page.storage.getItem('revealline.suspended.dev.v1'));
    assert.equal(verifyReplay(saved.replay).match, true);
    assert.deepEqual(page.errors, []);
  });

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`actual host: ${turnPolicy} reconnect requires neutral then fresh Resume without losing the cut`, async (t) => {
    const { page, pad, press, release, start } = await setup(t);
    page.change('turn-select', turnPolicy);
    await settle(
      () => !page.$('start-button').disabled && page.$('turn-select').value === turnPolicy,
    );
    await start();
    assert.equal(page.rendered.run.turnPolicy, turnPolicy);
    pad.axes[0] = 1;
    for (let i = 0; i < 25; i++) page.frame();
    release();
    pad.axes[0] = 0;
    pad.axes[1] = 1;
    for (let i = 0; i < 20; i++) page.frame();
    assert.ok(page.rendered.run.trail.length > 0, 'Disconnect occurs during an unfinished cut.');
    pad.connected = false;
    page.frame();
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    const suspended = page.storage.getItem('revealline.suspended.dev.v1');
    assert.equal(verifyReplay(JSON.parse(suspended).replay).match, true);
    pad.buttons[0].pressed = true;
    pad.buttons[0].value = 1;
    pad.connected = true;
    for (let i = 0; i < 20; i++) page.frame();
    assert.equal(page.doc.body.dataset.flightState, 'paused', 'Held reconnect is not Resume.');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), suspended);
    release();
    assert.equal(page.doc.body.dataset.flightState, 'paused', 'Neutral alone does not resume.');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    pad.buttons[0].pressed = true;
    pad.buttons[0].value = 1;
    page.frame(0);
    await settle(() => {
      page.frame(0);
      return page.doc.body.dataset.flightState === 'running';
    }, 'Fresh A explicitly resumes the retained flight');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    release();
    press(9);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.equal(
      verifyReplay(JSON.parse(page.storage.getItem('revealline.suspended.dev.v1')).replay).match,
      true,
    );
    assert.deepEqual(page.errors, []);
  });

test('actual host: ignored extra D-pad finger cannot release the active steering finger', async (t) => {
  const page = await classicPage(t);
  page.change('touch-mode', 'dpad');
  page.change('screen-controls', 'always');
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  const surface = page.doc.querySelector('.direction-controls');
  surface._rect = { x: 0, y: 0, width: 156, height: 156 };
  surface.emit('pointerdown', {
    pointerId: 11,
    pointerType: 'touch',
    button: 0,
    clientX: 145,
    clientY: 78,
  });
  page.frame();
  assert.equal(page.rendered.run.player.direction, 'right');
  const extra = surface.querySelector('[data-move="left"]');
  extra.emit('pointerdown', {
    pointerId: 99,
    pointerType: 'touch',
    button: 0,
    clientX: 5,
    clientY: 78,
  });
  extra.emit('pointercancel', { pointerId: 99, pointerType: 'touch' });
  assert.equal(
    surface.hasPointerCapture(11),
    true,
    'An ignored finger cannot release the active gesture.',
  );
  assert.equal(page.doc.body.dataset.flightState, 'running');
  surface.emit('pointermove', { pointerId: 11, pointerType: 'touch', clientX: 78, clientY: 145 });
  page.frame();
  assert.equal(
    page.rendered.run.player.direction,
    'down',
    'The same active finger can still turn.',
  );
  surface.emit('pointercancel', { pointerId: 11, pointerType: 'touch' });
  assert.equal(
    page.doc.body.dataset.flightState,
    'paused',
    'Real steering interruption still pauses.',
  );
  assert.deepEqual(page.errors, []);
});

for (const mode of ['stick', 'swipe', 'dpad'])
  test(`actual host: ${mode} resize interruption pauses until explicit Resume and a fresh gesture`, async (t) => {
    const page = await classicPage(t);
    page.change('touch-mode', mode);
    page.change('screen-controls', 'always');
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.win.emit('resize');
    assert.equal(page.doc.body.dataset.flightState, 'running');
    const surface =
      mode === 'dpad' ? page.doc.querySelector('.direction-controls') : page.$('touch-surface');
    surface._rect = { x: 0, y: 0, width: 156, height: 156 };
    const pointer = (type, x, y, pointerId = 11) =>
      surface.emit(type, { pointerId, pointerType: 'touch', button: 0, clientX: x, clientY: y });
    pointer('pointerdown', mode === 'dpad' ? 145 : 78, 78);
    if (mode !== 'dpad') pointer('pointermove', 115, 78);
    page.frame();
    assert.equal(page.rendered.run.player.direction, 'right');
    page.win.emit('resize');
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.equal(surface.hasPointerCapture(11), false);
    const paused = authoritativeCheckpoint(page.rendered.run);
    page.win.emit('resize');
    page.win.emit('focus');
    pointer('pointermove', 5, 78);
    pointer('lostpointercapture', 5, 78);
    page.frame();
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), paused);
    page.$('start-button').click();
    page.frame(0);
    assert.equal(page.doc.body.dataset.flightState, 'running');
    pointer('pointerdown', 78, mode === 'dpad' ? 145 : 78, 33);
    if (mode !== 'dpad') pointer('pointermove', 78, 115, 33);
    page.frame();
    assert.equal(page.rendered.run.player.direction, 'down');
    assert.deepEqual(page.errors, []);
  });
