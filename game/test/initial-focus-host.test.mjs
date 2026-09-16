import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Model only native focus eligibility and the actual boot visibility handshake.
// The app, shell, menu markup, saved-flight data and handlers are real.
function nativeBoot(t, onReady = () => {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'RevealLineBoot');
  const rects = SoloElement.prototype.getClientRects;
  const focus = SoloElement.prototype.focus;
  let ready = false;
  const attempts = [];
  t.mock.method(SoloElement.prototype, 'getClientRects', function () {
    if (!ready && this !== this.ownerDocument.body && !this.closest('#boot-screen')) return [];
    return rects.call(this);
  });
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    attempts.push({ id: this.id, ready });
    if (!this.disabled && !this.closest('[hidden],[inert]') && this.getClientRects().length)
      focus.apply(this, args);
  });
  Object.defineProperty(globalThis, 'RevealLineBoot', {
    configurable: true,
    value: {
      progress() {},
      fail(error) {
        throw error;
      },
      ready() {
        const doc = globalThis.document;
        assert.equal(doc.getElementById('shell-home').open, true);
        ready = true;
        doc.documentElement.dataset.bootState = 'ready';
        for (const element of doc.querySelectorAll('[data-boot-inert]')) element.inert = false;
        doc.getElementById('boot-screen').hidden = true;
        onReady(doc);
        return true;
      },
    },
  });
  t.after(() =>
    original
      ? Object.defineProperty(globalThis, 'RevealLineBoot', original)
      : delete globalThis.RevealLineBoot,
  );
  return attempts;
}

test('the actual inline guard hides the title until the ready handshake', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(
    html,
    /html:not\(\[data-boot-state='ready'\]\) body > :not\(#boot-screen\):not\(script\)\s*\{\s*display: none !important;/,
  );
});

test('fresh title focuses visible Deploy only after boot reveals it', async (t) => {
  const attempts = nativeBoot(t);
  const page = await soloPage(t, { titleScreen: true });
  assert.equal(page.doc.activeElement.id, 'shell-featured');
  assert.equal(page.$('shell-course-return').hidden, true);
  assert.equal(page.$('shell-continue').hidden, true);
  assert.equal(
    attempts.some((item) => item.id === 'shell-featured' && !item.ready),
    false,
  );
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});

test('ready handoff keeps a deliberate visible menu focus instead of selecting another action', async (t) => {
  nativeBoot(t, (doc) => doc.getElementById('shell-options').focus());
  const page = await soloPage(t, { titleScreen: true });
  assert.equal(page.doc.activeElement.id, 'shell-options');
  page.frame();
  assert.equal(page.doc.activeElement.id, 'shell-options');
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});

test('saved-flight title selects visible Continue or the next enabled action without adopting the flight', async (t) => {
  const storage = memoryStorage();
  let saved;
  await t.test('prepare a legitimate saved cut', async (t) => {
    const page = await soloPage(t, { storage });
    page.$('start-button').click();
    page.key('ArrowDown');
    for (let i = 0; i < 24; i++) page.frame();
    page.key('ArrowDown', false);
    page.$('pause-button').click();
    assert.equal(page.rendered.run.player.cutting, true);
    saved = storage.getItem('revealline.suspended.dev.v1');
    assert.ok(saved);
  });
  // The departing source host's pagehide completes its existing autosave.
  // Bind the received bytes after that lifecycle boundary, before reload.
  saved = storage.getItem('revealline.suspended.dev.v1');
  for (const disableContinue of [false, true])
    await t.test(
      disableContinue ? 'disabled Continue falls back to Missions' : 'Continue owns initial focus',
      async (t) => {
        const attempts = nativeBoot(t, (doc) => {
          doc.getElementById('shell-continue').disabled = disableContinue;
        });
        const page = await soloPage(t, { storage, titleScreen: true });
        assert.equal(page.$('shell-featured').hidden, true);
        assert.equal(page.$('shell-continue').hidden, false);
        assert.equal(page.doc.activeElement.id, disableContinue ? 'shell-play' : 'shell-continue');
        assert.equal(
          attempts.some((item) => item.id === 'shell-continue' && !item.ready),
          false,
        );
        assert.equal(
          page.rendered.run.tick,
          0,
          'The saved run still requires explicit Continue and Resume.',
        );
        const checkpoint = authoritativeCheckpoint(page.rendered.run);
        for (let i = 0; i < 30; i++) page.frame();
        assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
        assert.equal(storage.getItem('revealline.suspended.dev.v1'), saved);
        assert.deepEqual(page.errors, []);
      },
    );
});

test('a background ready handoff does not claim keyboard focus', async (t) => {
  nativeBoot(t, (doc) => {
    doc.focused = false;
  });
  const page = await soloPage(t, { titleScreen: true });
  assert.equal(page.doc.activeElement, page.doc.body);
  assert.equal(page.$('shell-home').open, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});
