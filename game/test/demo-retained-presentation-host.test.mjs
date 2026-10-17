import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const frames = (page, count) => {
  for (let index = 0; index < count; index++) page.frame(1000 / 60);
};

test('paused Demo retains its board and controls, invalidates on visible changes, and resumes normally', async (t) => {
  const page = await demoPage(t);
  await page.open();
  frames(page, 12);
  page.$('demo-watch-pause').click();
  // The already-started finite scene fade can finish before measuring idle work.
  frames(page, 60);
  const run = page.demoFrame.run,
    checkpoint = authoritativeCheckpoint(run).hash,
    draw = BoardPainter.prototype.draw,
    button = page.$('demo-watch-pause'),
    attribute = button.setAttribute;
  let draws = 0,
    controlWrites = 0;
  t.mock.method(BoardPainter.prototype, 'draw', function (...args) {
    if (args[0]?.canvas?.id === 'demo-canvas') draws++;
    return draw.apply(this, args);
  });
  t.mock.method(button, 'setAttribute', function (...args) {
    controlWrites++;
    return attribute.apply(this, args);
  });
  const reads = page.padReads;
  frames(page, 24);
  assert.equal(authoritativeCheckpoint(run).hash, checkpoint);
  assert.ok(page.padReads >= reads + 24, 'Native callback controller polling continues.');
  assert.equal(draws, 0, 'An unchanged paused Demo must retain its already-painted board.');
  assert.equal(controlWrites, 0, 'Unchanged controls must not be rewritten every callback.');

  page.win.emit('resize');
  page.frame(0);
  assert.equal(draws, 1, 'A viewport change invalidates the paused board once.');
  frames(page, 4);
  assert.equal(draws, 1);
  const preview = page.$('demo-show-all-pictures-live');
  preview.checked = true;
  preview.emit('change');
  page.frame(0);
  assert.equal(page.demoFrame.options.pictureVisibility, 'clear');
  assert.equal(draws, 2, 'An explicit picture preference repaints the paused board.');
  assert.equal(authoritativeCheckpoint(run).hash, checkpoint);
  button.click();
  frames(page, 12);
  assert.ok(run.tick > 24, 'Keep watching advances the retained recording again.');
  assert.ok(draws > 2);
  assert.equal(page.errors.length, 0);
});

test('Demo takeover has one native paint owner and preserves the recorded spectator state', async (t) => {
  const page = await demoPage(t);
  await page.open();
  frames(page, 12);
  const watched = page.demoFrame.run,
    before = authoritativeCheckpoint(watched).hash;
  demoKey(page, 'ArrowRight');
  demoKey(page, 'ArrowRight', false);
  await settle(() => !page.$('demo-practice-controls').hidden);
  page.frame(0);
  const practice = page.demoFrame.run,
    tick = practice.tick,
    draw = BoardPainter.prototype.draw;
  assert.notEqual(practice, watched);
  let draws = 0;
  t.mock.method(BoardPainter.prototype, 'draw', function (...args) {
    if (args[0]?.canvas?.id === 'demo-canvas') draws++;
    return draw.apply(this, args);
  });
  frames(page, 12);
  assert.equal(practice.tick, tick + 24, 'Practice preserves the ordinary 120Hz fixed-step clock.');
  assert.equal(draws, 12, 'The stopped spectator clock cannot add a second practice paint.');
  assert.equal(authoritativeCheckpoint(watched).hash, before);
  assert.equal(page.errors.length, 0);
});
