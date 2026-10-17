import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage, SoloElement } from './helpers/solo-dom.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';

test('actual app initialization failure retains inert gameplay and does not overwrite saved profile', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const storage = memoryStorage({ 'owned-profile-sentinel': 'keep my saved data' });
  const before = [...storage.map];
  let bootFailure;
  await assert.rejects(
    soloPage(t, {
      storage,
      browserSetup({ globals }) {
        globals.RevealLineBoot = {
          fail(error) {
            bootFailure = error;
          },
        };
      },
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
  const focused = doc.activeElement;
  doc.documentElement.scrollTop = 37;
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.equal(bootFailure.message, translate('interface:solo.startupFailed'));
    assert.doesNotMatch(bootFailure.message, /Owned boot fixture/);
    assert.equal(
      doc.getElementById('overlay-copy').textContent,
      translate('interface:solo.startupFailed'),
    );
    assert.doesNotMatch(doc.getElementById('overlay-copy').textContent, /Owned boot fixture/);
    assert.equal(doc.activeElement, focused);
    assert.equal(doc.documentElement.scrollTop, 37);
    assert.equal(doc.getElementById('start-button').hidden, true);
  }
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
