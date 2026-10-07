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
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.equal(page.$('skip-celebration').hidden, true);
  return { page, surface };
}

for (const reduced of [false, true])
  test(`${reduced ? 'reduced' : 'full'} effects: a legal win keeps results usable while its celebration finishes`, async (t) => {
    const { page, surface } = await win(t, { reduced });
    assert.equal(
      page.doc.body.dataset.winPicture,
      'off',
      'The result controls remain available while the final capture animates.',
    );
    for (let i = 0; i < 18; i++) page.frame(100);
    assert.equal(
      page.doc.body.dataset.winPicture,
      'off',
      'Full and reduced effects do not add a picture gate before results.',
    );
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    const earned = page.storage.getItem('revealline.library.dev.v1');
    assert.ok(earned, 'The win has persisted its collection progress.');
    if (!reduced) {
      assert.equal(surface.frame.painter.celebrationStatus.active, true);
      assert.equal(page.$('skip-celebration').hidden, true);
    }
    for (
      let i = 0;
      i < Math.ceil(CELEBRATION_SECONDS * 10) + 2 && !surface.frame.painter.celebrationStatus.finished;
      i++
    )
      page.frame(100);
    assert.equal(surface.frame.painter.celebrationStatus.finished, true);
    // The painter reaches its terminal frame before the host consumes that
    // status on the following update.
    page.frame(0);
    assert.equal(page.$('game-overlay').hidden, false, 'Results remain open after the celebration.');
    assert.equal(page.$('game-overlay').dataset.kind, 'won');
    assert.equal(page.$('show-result').hidden, true);
    assert.equal(page.$('next-button').hidden, false, 'Next remains available without a picture gate.');
    if (!reduced) {
      assert.equal(page.$('result-auto-next').hidden, false);
      assert.match(page.$('result-auto-next').textContent, /starts automatically/);
    }
    assert.equal(page.doc.activeElement.id, 'next-button');
    assert.equal(
      page.doc.body.dataset.flightState,
      reduced ? 'picture' : 'result',
      'Reduced effects retain their short presentation state without hiding result actions.',
    );
    assert.equal(page.rendered.fullReveal, true);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), earned);
    page.$('view-picture').click();
    page.frame(100);
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(
      page.$('result-auto-next').hidden,
      true,
      'Choosing another action stops auto-next.',
    );
    assert.equal(
      surface.frame.painter.celebrationStatus.finished,
      true,
      'Viewing does not replay the celebration.',
    );
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.storage.getItem('revealline.library.dev.v1'), earned);
    assert.deepEqual(page.errors, []);
  });

test('the direct victory result does not expose a redundant animation-skip step', async (t) => {
  const { page, surface } = await win(t);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  assert.equal(page.$('skip-celebration').hidden, true);
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  for (let i = 0; i < Math.ceil(CELEBRATION_SECONDS * 10) + 2; i++) page.frame(100);
  assert.equal(surface.frame.painter.celebrationStatus.finished, true);
  page.frame(0);
  assert.equal(page.$('skip-celebration').hidden, true);
  assert.equal(page.$('show-result').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('held controller Confirm cannot activate a direct victory result action', async (t) => {
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
  for (let i = 0; i < 24; i++) frame();
  assert.equal(page.$('skip-celebration').hidden, true);
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
