import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { CELEBRATION_SECONDS } from '../ui/celebration.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'win-picture-presentation',
  revision: '1',
  title: 'Win picture presentation',
  levels: [
    { ...retryFixture('self-contact').level, id: 'earned-picture', goal: { coverage: 0.1 } },
    { ...retryFixture('self-contact').level, id: 'next-picture', goal: { coverage: 0.1 } },
  ],
};

// The actual host, simulation and painter run; only Phaser, image decode and
// canvas operations are modeled. These checks make no browser pixel claims.
function rendering() {
  let frame;
  const contexts = new WeakMap();
  const pictures = new WeakMap();
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
      if (!contexts.has(canvas)) {
        const values = {};
        contexts.set(
          canvas,
          new Proxy(
            {
              canvas,
              drawImage(image) {
                pictures.set(canvas, image);
              },
            },
            {
              get: (target, key) =>
                key in target ? target[key] : key in values ? values[key] : () => {},
              set: (_, key, value) => {
                values[key] = value;
                return true;
              },
            },
          ),
        );
      }
      return contexts.get(canvas);
    },
    onDraw(value) {
      frame = value;
    },
    get frame() {
      return frame;
    },
    pictureFor(canvas) {
      return pictures.get(canvas);
    },
  };
}

async function win(t, { reduced = false, readPads, beforeFrame } = {}) {
  const surface = rendering();
  const page = await soloPage(t, { campaign, rendering: surface, readPads });
  await settle(() => surface.frame.painter.image !== null);
  if (reduced) {
    page.$('reduced-effects').checked = true;
    page.$('reduced-effects').emit('change');
  }
  assert.equal(page.$('game-overlay').hidden, false);
  await activateHostAction(page.$('start-button'));
  assert.equal(page.doc.body.dataset.flightState, 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let tick = 0; tick < 900 && page.rendered.run.status === 'running'; tick++) {
    beforeFrame?.(page.rendered.run);
    page.frame();
  }
  assert.equal(page.rendered.run.status, 'won', 'Real controls earn the picture.');
  assert.equal(page.rendered.fullReveal, true);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('game-overlay').hidden, false, 'Victory actions are immediately available.');
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.equal(page.$('show-result').hidden, true, 'No full-screen picture gate blocks results.');
  for (const id of ['next-button', 'retry-button']) {
    assert.equal(page.$(id).hidden, false, `${id} is visible during celebration.`);
    assert.equal(page.$(id).disabled, false, `${id} is usable during celebration.`);
  }
  return { page, surface };
}

for (const reduced of [false, true])
  test(`${reduced ? 'reduced' : 'full'} effects: results celebrate before auto-next and explicit viewing preserves the earned picture`, async (t) => {
    const { page, surface } = await win(t, { reduced });
    const flow = page.$('result-flow-controls');
    const status = flow.querySelector('[role="status"]');
    assert.equal(status.textContent, 'Mission complete!');
    assert.equal(page.doc.body.dataset.flightState, 'result');
    assert.equal(page.doc.activeElement.id, 'next-button');
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    const earned = page.storage.getItem('revealline.library.dev.v1');
    const picture =
      surface.frame.options.backdrop?.image ||
      surface.frame.painter.images.background ||
      surface.frame.painter.background;
    assert.ok(earned, 'The win has persisted its collection progress.');
    assert.ok(picture, 'The completed attempt has an earned picture.');
    assert.equal(page.$('result-picture').hidden, false);
    assert.equal(surface.pictureFor(page.$('result-picture')), picture);
    if (!reduced) {
      assert.equal(surface.frame.painter.celebrationStatus.active, true);
    }
    for (let i = 0; i < Math.ceil(CELEBRATION_SECONDS * 10) - 1; i++) page.frame(100);
    assert.equal(status.textContent, 'Mission complete!', 'The full celebration time is retained.');
    page.frame(100);
    assert.match(status.textContent, /^Next level in 5s$/);
    assert.equal(surface.frame.painter.celebrationStatus.finished, true);
    assert.equal(page.$('game-overlay').hidden, false);
    assert.equal(page.doc.activeElement.id, 'next-button');
    assert.equal(page.rendered.fullReveal, true);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), earned);
    const more = page.$('earned-result-more');
    assert.equal(more.hidden, false);
    more.querySelector('summary').click();
    assert.equal(
      more.open,
      true,
      'More exposes secondary picture controls through its real action.',
    );
    await activateHostAction(page.$('view-picture'));
    page.frame(100);
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(page.$('show-result').hidden, false);
    assert.equal(page.doc.activeElement.id, 'show-result');
    assert.equal(page.doc.body.dataset.flightState, 'picture');
    assert.equal(page.doc.body.dataset.winPicture, 'settled');
    assert.equal(flow.hidden, true, 'Viewing explicitly cancels auto-next.');
    for (let i = 0; i < 110; i++) page.frame(100);
    assert.equal(page.rendered.run, run, 'Picture viewing cannot launch the next attempt.');
    assert.equal(page.rendered.fullReveal, true);
    assert.equal(
      surface.frame.options.backdrop?.image ||
        surface.frame.painter.images.background ||
        surface.frame.painter.background,
      picture,
      "The viewer retains the completed attempt's picture.",
    );
    assert.equal(
      surface.frame.painter.celebrationStatus.finished,
      true,
      'Viewing does not replay the celebration.',
    );
    await activateHostAction(page.$('show-result'));
    assert.equal(page.$('game-overlay').hidden, false);
    assert.equal(page.$('game-overlay').dataset.kind, 'won');
    assert.equal(page.doc.activeElement.id, 'view-picture');
    assert.equal(flow.hidden, true, 'Returning to results does not silently rearm auto-next.');
    assert.equal(surface.pictureFor(page.$('result-picture')), picture);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), earned);
    assert.deepEqual(page.errors, []);
  });

for (const [action, levelId] of [
  ['next-button', 'next-picture'],
  ['retry-button', 'earned-picture'],
])
  test(`${action}: one activation during celebration launches directly without a picture gate`, async (t) => {
    const { page, surface } = await win(t);
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    assert.equal(surface.frame.painter.celebrationStatus.active, true);
    await activateHostAction(page.$(action));
    await settle(() => {
      page.frame(0);
      return page.rendered.run !== run && page.rendered.run.status === 'running';
    });
    assert.equal(page.rendered.run.levelId, levelId);
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(page.$('show-result').hidden, true);
    assert.equal(page.doc.body.dataset.flightState, 'running');
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(page.errors, []);
  });

test('held controller Confirm cannot launch past victory or leak through the explicit picture viewer', async (t) => {
  let now = 1000;
  const previous = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    previous ? Object.defineProperty(performance, 'now', previous) : delete performance.now,
  );
  const pad = {
    index: 0,
    id: 'Win picture controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const confirm = (pressed) => (pad.buttons[0] = { pressed, value: Number(pressed) });
  const { page } = await win(t, {
    readPads: () => [pad],
    beforeFrame(run) {
      now += 1000 / 120;
      if (run.player.y > 34) confirm(true);
    },
  });
  assert.equal(pad.buttons[0].pressed, true, 'Confirm was already held at the legal winning cut.');
  const run = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(run);
  const frame = (ms = 16) => {
    now += ms;
    page.frame(ms);
  };
  for (let i = 0; i < Math.ceil((CELEBRATION_SECONDS * 1000 + 200) / 100); i++) frame(100);
  assert.equal(page.rendered.run, run, 'Held Confirm cannot activate the initially focused Next.');
  assert.equal(page.$('game-overlay').hidden, false);
  confirm(false);
  frame();
  assert.equal(page.rendered.run, run, 'Releasing the inherited hold cannot activate Next.');
  const more = page.$('earned-result-more');
  more.querySelector('summary').focus();
  confirm(true);
  frame();
  assert.equal(more.open, false, 'More waits for Confirm release.');
  assert.equal(
    page.$('result-flow-controls').hidden,
    true,
    'A fresh menu action cancels auto-next.',
  );
  confirm(false);
  frame();
  assert.equal(more.open, true, 'The real controller action exposes secondary picture controls.');
  page.$('view-picture').focus();
  confirm(true);
  frame();
  assert.equal(page.$('game-overlay').hidden, false, 'View picture waits for Confirm release.');
  confirm(false);
  frame();
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.$('show-result').hidden, false);
  confirm(true);
  for (let i = 0; i < 12; i++) frame();
  assert.equal(
    page.$('game-overlay').hidden,
    true,
    'The opening Confirm action cannot leak into the picture viewer.',
  );
  confirm(false);
  frame();
  confirm(true);
  frame();
  assert.equal(page.$('game-overlay').hidden, true, 'Continue also waits for release.');
  confirm(false);
  frame();
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});
