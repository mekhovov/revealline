import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('Demo retains the covered Solo canvas while continuing controller polls and restores rendering on close', async (t) => {
  const page = await demoPage(t);
  const ordinary = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(ordinary);
  await page.open();
  const before = page.displayRender;
  const reads = page.padReads;
  const demo = page.demoFrame.run;
  const tick = demo.tick;
  for (let index = 0; index < 24; index++) {
    page.frame(1000 / 60);
    assert.equal(page.displayRender.cameraVisible, true, 'Each submission restores camera state');
    assert.equal(
      page.displayRender.clearBeforeRender,
      true,
      'Each submission restores clear state',
    );
  }
  assert.equal(page.displayRender.draws, before.draws, 'The covered Solo board is not resubmitted');
  assert.equal(page.displayRender.clears, before.clears, 'The covered Solo board is not cleared');
  assert.ok(page.padReads >= reads + 24, 'Controller polling continues on every native callback');
  assert.ok(demo.tick > tick, 'The visible spectator continues playing');
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);

  page.win.emit('resize');
  for (let index = 0; index < 12; index++) page.frame(1000 / 60);
  assert.equal(
    page.displayRender.draws,
    before.draws,
    'Resizing a covered board defers its redraw',
  );
  assert.equal(page.displayRender.clears, before.clears);

  // Model an aborted submission before closing the covering dialog. The next
  // callback must restore the renderer before the main canvas becomes visible.
  page.frame(0, { dispatchRender: false });
  assert.equal(page.displayRender.cameraVisible, false);
  assert.equal(page.displayRender.clearBeforeRender, false);
  page.$('demo-back').click();
  page.win.emit('resize');
  page.frame(0);
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(page.displayRender.cameraVisible, true);
  assert.equal(page.displayRender.clearBeforeRender, true);
  assert.ok(page.displayRender.draws > before.draws, 'The uncovered dirty board is submitted');
  assert.equal(page.rendered.run, ordinary);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  assert.deepEqual(page.errors, []);
});
