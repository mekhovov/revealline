import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, SoloElement } from './helpers/solo-dom.mjs';
import { verifyReplay } from '../replay.mjs';

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
    pad.buttons.forEach((b) => (b.pressed = false));
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
