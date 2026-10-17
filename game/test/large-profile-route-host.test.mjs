import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PNGImage } from './helpers/png-image.mjs';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
function nativeDialogs(t) {
  const originalOpen = SoloElement.prototype.showModal,
    originalClose = SoloElement.prototype.close;
  const origins = new WeakMap();
  // SoloElement.click() already models the browser's one native <summary>
  // toggle. Do not add another local toggle here: keyboard, touch and the
  // controller adapter all finish through that same default click.
  const originalAttribute = SoloElement.prototype.setAttribute;
  SoloElement.prototype.setAttribute = function (key, value) {
    originalAttribute.call(this, key, value);
    if (['type', 'min', 'max', 'step', 'size'].includes(key)) this[key] = String(value);
  };
  SoloElement.prototype.showModal = function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    originalOpen.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  };
  SoloElement.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    const origin = origins.get(this);
    if (origin?.isConnected && !origin.disabled) origin.focus();
    // Native close restores the opener before dispatching its queued close event.
    queueMicrotask(() => this.emit('close', { bubbles: false }));
  };
  t.after(() => {
    SoloElement.prototype.setAttribute = originalAttribute;
    SoloElement.prototype.showModal = originalOpen;
    SoloElement.prototype.close = originalClose;
  });
}

test(
  'paused public Settings returns to the same run before explicit Resume and replay export',
  { timeout: 60000 },
  async (t) => {
    nativeDialogs(t);
    const h = await soloPage(t, {
      search: '?journey=opening',
      pictures: { Image: PNGImage },
      fetchResponse: async (path) =>
        String(path).includes('/content-design/assets/')
          ? new Response(await readFile(path))
          : undefined,
      initialReadyTimeoutMs: 15000,
    });
    h.$('start-button').click();
    await settle(() => h.doc.body.dataset.flightState === 'running', 'public Start', {
      timeoutMs: 15000,
    });
    h.frame(1000 / 60);
    h.frame(1000 / 60);
    h.$('pause-button').click();
    h.frame(0);
    assert.equal(h.doc.body.dataset.flightState, 'paused');
    const run = h.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      tick = run.tick,
      rows = [];
    for (let visit = 0; visit < 2; visit++) {
      assert.equal(h.$('overlay-settings').hidden, false);
      h.$('overlay-settings').focus();
      h.$('overlay-settings').click();
      assert.equal(h.$('shell-home').open, false);
      assert.equal(h.$('settings-dialog').open, true);
      h.$('settings-tab-data').click();
      h.$('settings-saves').click();
      assert.equal(h.$('library-dialog').open, true);
      h.doc.querySelector('[data-close="library-dialog"]').click();
      await Promise.resolve();
      assert.equal(h.$('library-dialog').open, false);
      assert.equal(h.$('settings-dialog').open, true);
      h.doc.querySelector('[data-close="settings-dialog"]').click();
      await Promise.resolve();
      h.frame(0);
      assert.equal(h.$('settings-dialog').open, false);
      assert.equal(h.$('shell-home').open, false);
      assert.equal(h.doc.body.dataset.flightState, 'paused');
      assert.equal(h.$('start-button').hidden, false);
      assert.equal(h.$('start-button').disabled, false);
      assert.equal(h.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      rows.push({
        visit,
        phase: h.doc.body.dataset.flightState,
        focus: h.doc.activeElement?.id,
        open: [...h.doc.querySelectorAll('dialog[open]')].map((x) => x.id),
        tick: run.tick,
      });
    }
    h.$('start-button').click();
    await settle(() => h.doc.body.dataset.flightState === 'running', 'explicit Resume', {
      timeoutMs: 15000,
    });
    h.frame(1000 / 60);
    assert.equal(h.rendered.run, run);
    assert(run.tick > tick);
    h.$('pause-button').click();
    h.frame(0);
    // Public export uses a 60-second URL retention timer; close only its exact modeled handles.
    const timers = [],
      urls = [],
      set = globalThis.setTimeout,
      create = URL.createObjectURL;
    t.mock.method(globalThis, 'setTimeout', (cb, delay, ...args) => {
      const timer = set(cb, delay, ...args);
      if (delay === 60000) {
        timer.unref();
        timers.push(timer);
      }
      return timer;
    });
    t.mock.method(URL, 'createObjectURL', (blob) => {
      const url = create(blob);
      urls.push(url);
      return url;
    });
    t.after(() => {
      timers.forEach(clearTimeout);
      urls.forEach(URL.revokeObjectURL);
    });
    await h.$('export-replay').onclick();
    const output = JSON.parse(h.$('replay-json').value),
      replay = output.replay ?? output;
    const verified = verifyReplay(replay);
    assert.equal(verified.match, true);
    assert.deepEqual(replay.checkpoint, authoritativeCheckpoint(run));
    assert.deepEqual(h.errors, []);
    t.diagnostic(
      JSON.stringify({
        rows,
        replay: {
          ticks: replay.ticks ?? null,
          checkpoint: replay.checkpoint,
          match: verified.match,
        },
        scope:
          'Node modeled native DOM only; no layout, native WebKit, imported profile, reload or timing qualification',
      }),
    );
  },
);
