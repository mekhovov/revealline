// Actual solo host/course/reading adapters; DOM and Phaser are modeled browser
// boundaries. No course/reading callback, authoritative state or awards are stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function nativeKey(page, key, repeat = false) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key, code: key, repeat });
  if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
  target.emit('keyup', { key, code: key });
  return event;
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: embedded First Flight Pause → End course restores the visible reader without resuming or awarding`, async (t) => {
    const page = await soloPage(t, {
      search: `?course=first-flight&lesson=close-line&turn-policy=${turnPolicy}`,
      parentWindow: {},
    });
    const region = page.$('overlay-reading'),
      entry = page.$('overlay-read'),
      toolbar = entry.closest('.reading-toolbar');
    assert.equal(page.rendered.run.turnPolicy, turnPolicy);
    assert.equal(entry.hidden, false);
    page.$('start-button').click();
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let tick = 0; tick < 20; tick++) page.frame();
    assert.equal(page.rendered.run.player.cutting, true);
    page.key('Escape');
    page.key('Escape', false);
    page.frame(0);
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      bytes = [...page.storage.map],
      writes = page.storage.writes.length;
    assert.equal(page.rendered.paused, true);
    assert.equal(page.$('game-overlay').dataset.kind, 'pause');
    assert.equal(page.$('pause-label').hidden, false);
    assert.equal(region.hidden, true);
    assert.equal(region.tabIndex, -1);
    assert.equal(entry.hidden, true);
    assert.equal(toolbar.hidden, true);
    page.$('first-flight-exit').focus();
    nativeKey(page, 'Enter');
    assert.equal(page.$('game-overlay').dataset.kind, 'course-ended');
    assert.equal(page.$('pause-label').hidden, true);
    assert.equal(region.hidden, false);
    assert.equal(region.tabIndex, 0, 'ended course re-enables the reading region');
    assert.equal(entry.hidden, false, 'reader entry is restored synchronously before focus');
    assert.equal(toolbar.hidden, false);
    assert.equal(page.doc.activeElement, entry);
    assert.match(page.$('overlay-copy').textContent, /no progress.*parent page/i);
    assert.equal(page.$('start-button').hidden, true);
    assert.equal(page.$('first-flight-exit').disabled, true);
    assert.equal(nativeKey(page, 'Enter', true).defaultPrevented, true);
    assert.equal(
      region.getAttribute('data-controller-reading'),
      null,
      'held End cannot enter reader',
    );
    nativeKey(page, 'Enter');
    assert.equal(page.doc.activeElement, region);
    assert.equal(region.getAttribute('data-controller-reading'), 'true');
    nativeKey(page, 'Escape');
    assert.equal(page.doc.activeElement, entry);
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let tick = 0; tick < 30; tick++) page.frame();
    assert.strictEqual(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual([...page.storage.map], bytes);
    assert.equal(page.storage.writes.length, writes, 'ending training writes no campaign data');
    assert.deepEqual(page.errors, []);
  });
}
