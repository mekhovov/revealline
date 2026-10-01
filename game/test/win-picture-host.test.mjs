import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
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
  ],
};

// The actual host, simulation and painter run; only Phaser, image decode and
// canvas operations are modeled. These checks make no browser pixel claims.
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
      if (!contexts.has(canvas)) {
        const values = {};
        contexts.set(
          canvas,
          new Proxy(
            { canvas },
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
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let tick = 0; tick < 900 && page.rendered.run.status === 'running'; tick++) {
    beforeFrame?.(page.rendered.run);
    page.frame();
  }
  assert.equal(page.rendered.run.status, 'won', 'Real controls earn the picture.');
  assert.equal(page.rendered.fullReveal, true);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('game-overlay').hidden, true);
  return { page, surface };
}

for (const reduced of [false, true])
  test(`${reduced ? 'reduced' : 'full'} effects: a legal win keeps its full picture after the celebration finishes`, async (t) => {
    const { page, surface } = await win(t, { reduced });
    assert.equal(
      page.doc.body.dataset.winPicture,
      'revealing',
      'The final capture retains its board position.',
    );
    for (let i = 0; i < 18; i++) page.frame(100);
    assert.equal(
      page.doc.body.dataset.winPicture,
      'revealing',
      'Full and reduced effects both leave time to enjoy the win.',
    );
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    const earned = page.storage.getItem('revealline.library.dev.v1');
    assert.ok(earned, 'The win has persisted its collection progress.');
    if (!reduced) {
      assert.equal(surface.frame.painter.celebrationStatus.active, true);
      assert.equal(page.doc.activeElement.id, 'skip-celebration');
    }
    for (let i = 0; i < Math.ceil(CELEBRATION_SECONDS * 10) + 50; i++) page.frame(100);
    assert.equal(surface.frame.painter.celebrationStatus.finished, true);
    assert.equal(page.$('game-overlay').hidden, true, 'No timer opens the result menu.');
    assert.equal(page.$('show-result').hidden, false);
    assert.equal(page.doc.activeElement.id, 'show-result');
    assert.equal(page.doc.body.dataset.flightState, 'picture');
    assert.equal(page.rendered.fullReveal, true);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), earned);
    page.$('show-result').click();
    assert.equal(page.$('game-overlay').hidden, false, 'Only an explicit action opens results.');
    assert.equal(page.$('game-overlay').dataset.kind, 'won');
    page.$('view-picture').click();
    page.frame(100);
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(
      surface.frame.painter.celebrationStatus.finished,
      true,
      'Viewing does not replay the celebration.',
    );
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), earned);
    assert.deepEqual(page.errors, []);
  });

test('skipping the win animation settles the picture without opening results', async (t) => {
  const { page, surface } = await win(t);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('skip-celebration').click();
  page.frame(100);
  assert.equal(surface.frame.painter.celebrationStatus.finished, true);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.equal(page.$('skip-celebration').hidden, true);
  assert.equal(page.$('show-result').hidden, false);
  assert.equal(page.doc.activeElement.id, 'show-result');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('held controller Confirm cannot skip the earned picture or activate its result action', async (t) => {
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
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const frame = () => {
    now += 16;
    page.frame(16);
  };
  for (let i = 0; i < 12; i++) frame();
  assert.equal(page.$('skip-celebration').hidden, false);
  assert.equal(page.$('game-overlay').hidden, true);
  confirm(false);
  frame();
  confirm(true);
  frame();
  assert.equal(page.$('skip-celebration').hidden, false, 'Confirm waits for its release.');
  confirm(false);
  frame();
  assert.equal(page.$('skip-celebration').hidden, true);
  assert.equal(page.$('show-result').hidden, false);
  confirm(true);
  for (let i = 0; i < 12; i++) frame();
  assert.equal(
    page.$('game-overlay').hidden,
    true,
    'Settling the picture requires another fresh action to continue.',
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
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
