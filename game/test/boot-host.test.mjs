import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage, SoloElement } from './helpers/solo-dom.mjs';

test('actual app initialization failure retains inert gameplay and does not overwrite saved profile', async (t) => {
  const storage = memoryStorage({ 'owned-profile-sentinel': 'keep my saved data' });
  const before = [...storage.map];
  await assert.rejects(
    soloPage(t, {
      storage,
      fetchJSON(path) {
        if (path === 'content/campaign.json')
          throw new Error('Owned boot fixture: chapter unavailable');
      },
    }),
    /Owned boot fixture: chapter unavailable/,
  );
  // The actual host catches the content failure. The helper then rejects because
  // no scene was created; inspect that failed host before its registered cleanup.
  // Classic-script error rendering is covered separately in boot.test.mjs.
  const doc = globalThis.document;
  assert.ok(doc.querySelectorAll('[data-boot-inert]').length > 0);
  for (const element of doc.querySelectorAll('[data-boot-inert]'))
    assert.equal(element.inert, true);
  assert.equal(doc.getElementById('start-button').hidden, true);
  assert.equal(doc.getElementById('boot-screen').hidden, false);
  assert.equal(doc.getElementById('game-canvas').children.length, 0);
  assert.deepEqual([...storage.map], before);
  assert.deepEqual(storage.writes, []);
});

test('actual app fallback readiness exposes native title without starting a flight', async (t) => {
  const focus = SoloElement.prototype.focus;
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    // Native focus cannot enter the boot-inert tree or a closed dialog. The
    // host must choose its ready title target after that guard is removed.
    if (!this.closest('[hidden],[inert],dialog:not([open])')) return focus.apply(this, args);
  });
  const page = await soloPage(t, { titleScreen: true });
  for (const element of page.doc.querySelectorAll('[data-boot-inert]'))
    assert.equal(element.inert, false);
  assert.equal(page.$('shell-home').open, true);
  assert.equal(page.rendered.run.time, 0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.doc.activeElement.closest('dialog'), page.$('shell-home'));
  const initial = page.rendered.run.tick;
  page.frame(1000);
  assert.equal(page.rendered.run.tick, initial);
});
