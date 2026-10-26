import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { FIXED_DT } from '../core/index.mjs';

// Real host actions with controlled callback schedules. These are correctness
// cases; inert Canvas and synthetic events do not qualify native device pacing.
const tickMs = FIXED_DT * 1000;
async function runningVersus(t, options = {}) {
  const page = await couchPage(t, options);
  page.$('race-class').value = 'bomber';
  await page.$('race-class').onchange();
  await activateHostAction(page.$('race-start'));
  page.frame(tickMs); // The existing helper settles the real Start cue first.
  assert.equal(page.state(), 'running');
  return page;
}

for (const gap of [100, 250, 500]) {
  test(`Versus accepted Resume excludes the prior ${gap}ms menu interval`, async (t) => {
    const page = await runningVersus(t);
    page.$('race-pause').click();
    page.frame(0);
    const before = page.checkpoint(),
      beforeTick = page.tick();
    await activateHostAction(page.$('race-start'));
    page.frame(gap);
    assert.equal(page.state(), 'running');
    assert.equal(page.tick(), beforeTick);
    assert.deepEqual(page.checkpoint(), before);
    page.frame(tickMs);
    assert.equal(page.tick(), beforeTick + 1);
    page.frame(250);
    assert.equal(page.tick(), beforeTick + 31, 'Exactly 250ms still advances all 30 fixed ticks.');
    page.frame(251);
    assert.equal(
      page.state(),
      'paused',
      'The existing interruption boundary remains strictly above 250ms.',
    );
    assert.equal(page.tick(), beforeTick + 31);
  });
}

for (const catchUp of [false, true]) {
  test(`Versus fresh Resume requests survive the neutral tick with catch-up=${catchUp}`, async (t) => {
    const page = await runningVersus(t, { coarse: true });
    page.$('race-pause').click();
    page.frame(0);
    await activateHostAction(page.$('race-start'));
    page.frame(0);
    const beforeTick = page.tick();
    page.key('KeyQ');
    page.key('KeyQ', false);
    const pad = [...page.doc.querySelectorAll('.race-pad')].find(
      (node) => node.dataset.player === '1',
    );
    assert.equal(pad.hidden, false, 'Auto touch controls must be visible before their gesture.');
    assert.equal(pad.inert, false);
    const pickup = pad.querySelector('[data-action="pickup"]');
    pickup.emit('pointerdown', { pointerId: 71, pointerType: 'touch', button: 0 });
    pickup.emit('pointerup', { pointerId: 71, pointerType: 'touch', button: 0 });
    if (catchUp) page.frame(tickMs * 2);
    else {
      page.frame(tickMs);
      assert.deepEqual(
        page.renders.map((run) => [run._input.action, run._input.pickup]),
        [
          [false, false],
          [false, false],
        ],
      );
      page.frame(tickMs);
    }
    assert.equal(page.tick(), beforeTick + 2);
    assert.deepEqual(
      page.renders.map((run) => [run._input.action, run._input.pickup]),
      [
        [true, false],
        [false, true],
      ],
    );
    page.frame(tickMs);
    assert.deepEqual(
      page.renders.map((run) => [run._input.action, run._input.pickup]),
      [
        [false, false],
        [false, false],
      ],
    );
    assert.equal(page.tick(), beforeTick + 3);
  });
}

for (const gap of [100, 500]) {
  test(`Team fresh Start and confirmed Retry exclude the prior ${gap}ms menu interval`, async (t) => {
    const page = await teamPage(t, { nativeFocus: true });
    page.tick(); // Establish an ordinary lobby callback before Start.
    await activateHostAction(page.$('coop-start'));
    for (const attempt of ['start', 'retry']) {
      if (attempt === 'retry') {
        page.$('coop-pause').click();
        page.tick(1, 0);
        page.$('coop-retry').click();
        assert.equal(page.$('coop-discard-dialog').open, true);
        await activateHostAction(page.$('coop-discard-confirm'));
      }
      page.tick(1, gap);
      assert.equal(
        page.$('coop-overlay').hidden,
        true,
        'A stale lobby interval cannot immediately pause the accepted attempt.',
      );
      page.tick(110);
      assert.equal(
        page.$('coop-clock').textContent,
        '0:00',
        'Only the 110 subsequent fixed ticks advance the new clock.',
      );
      page.tick(2, 100);
      assert.equal(page.$('coop-clock').textContent, '0:01');
      page.tick(1, 251);
      assert.equal(
        page.$('coop-overlay').hidden,
        false,
        'An actual active-play interruption still pauses.',
      );
    }
  });
}
