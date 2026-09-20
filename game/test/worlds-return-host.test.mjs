import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { setImmediate } from 'node:timers/promises';

// Real shell, Solo host and catalogue; hold only the optional HTTP catalogue.
// This proves cancellation and return ownership, not native dialog behavior.
async function setup(t, options, { ignoreAbort = false } = {}) {
  const page = await soloPage(t, options);
  const previous = globalThis.fetch;
  globalThis.fetch = (url, options = {}) => {
    if (!String(url).startsWith('http')) return previous(url, options);
    assert.ok(String(url).endsWith('game/content/optional-worlds.json'));
    return new Promise((resolve, reject) => {
      page.resolveCatalogue = () =>
        resolve(
          new Response(JSON.stringify({ format: 'revealline-optional-chapters.v1', packs: [] })),
        );
      if (ignoreAbort) return;
      const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener('abort', abort, { once: true });
    });
  };
  t.after(() => {
    globalThis.fetch = previous;
  });
  return page;
}

for (const entry of ['home', 'field'])
  for (const back of ['button', 'escape', 'controller']) {
    test(`campaign browser ${back} restores Missions and its ${entry} return`, async (t) => {
      const p = await setup(t, { titleScreen: entry === 'home' });
      const opener = p.$(entry === 'home' ? 'shell-play' : 'shell-packs');
      opener.focus();
      opener.click();
      p.frame(0);
      const run = p.rendered.run;
      const checkpoint = authoritativeCheckpoint(run);
      const saved = new Map(p.storage.map);
      const worlds = p.$('shell-worlds');
      worlds.focus();
      worlds.click();
      assert.equal(p.$('optional-worlds-dialog').open, true);
      assert.equal(p.$('optional-worlds-back').textContent, 'Back to Missions');
      assert.equal(p.$('optional-worlds-top-back').getAttribute('aria-label'), 'Back to Missions');
      if (back === 'button') p.$('optional-worlds-back').click();
      else if (back === 'escape') p.$('optional-worlds-dialog').emit('cancel');
      else {
        let time = 1000;
        t.mock.method(performance, 'now', () => time);
        const pad = {
          index: 0,
          id: 'Campaign Back controller',
          mapping: 'standard',
          connected: true,
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        };
        navigator.getGamepads = () => [pad];
        const frame = () => {
          time += 20;
          p.frame(20);
        };
        frame();
        pad.buttons[1] = { pressed: true, value: 1 };
        frame();
        pad.buttons[1] = { pressed: false, value: 0 };
        frame();
      }
      assert.equal(p.$('shell-missions').open, true, 'Return to the actual Missions parent');
      assert.equal(
        p.doc.activeElement,
        worlds,
        'Restore More chapters rather than a different action',
      );
      assert.equal(p.$('shell-home').open, false);
      assert.equal(p.$('optional-worlds-dialog').open, false);
      p.$('shell-missions-back').click();
      if (entry === 'home') {
        assert.equal(p.$('shell-home').open, true);
        assert.equal(p.doc.activeElement, opener);
      } else {
        assert.equal(p.$('shell-home').open, false);
        assert.equal(p.rendered.paused, true);
      }
      p.frame(0);
      assert.equal(p.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.deepEqual(p.storage.map, saved);
      assert.deepEqual(p.errors, []);
    });
  }

for (const takeover of ['dialog', 'field-focus', 'hidden']) {
  test(`catalogue close preserves a newer ${takeover} owner`, async (t) => {
    const p = await setup(t, { titleScreen: true });
    p.$('shell-play').click();
    p.$('shell-worlds').click();
    const catalogue = p.$('optional-worlds-dialog');
    catalogue.addEventListener('close', () => {
      if (takeover === 'dialog') p.$('settings-dialog').showModal();
      if (takeover === 'field-focus') p.$('game-canvas').focus();
      if (takeover === 'hidden') p.doc.hidden = true;
    });
    p.$('optional-worlds-back').click();
    assert.equal(p.$('shell-missions').open, false);
    assert.equal(p.$('shell-home').open, false);
    if (takeover === 'dialog') assert.equal(p.$('settings-dialog').open, true);
    if (takeover === 'field-focus') assert.equal(p.doc.activeElement, p.$('game-canvas'));
    assert.deepEqual(p.errors, []);
  });
}

test('late catalogue response cannot reopen the browser or replace returned Missions focus', async (t) => {
  const p = await setup(t, { titleScreen: true }, { ignoreAbort: true });
  p.$('shell-play').click();
  p.$('shell-worlds').click();
  await waitFor(() => !!p.resolveCatalogue, {
    timeoutMs: 30000,
    message: 'Actual catalogue request reached',
  });
  p.$('optional-worlds-back').click();
  const selected = p.$('pack-select').value;
  p.resolveCatalogue();
  for (let i = 0; i < 4; i++) await setImmediate();
  assert.equal(p.$('optional-worlds-dialog').open, false);
  assert.equal(p.$('shell-missions').open, true);
  assert.equal(p.doc.activeElement, p.$('shell-worlds'));
  assert.equal(p.$('pack-select').value, selected);
  assert.deepEqual(p.errors, []);
});
