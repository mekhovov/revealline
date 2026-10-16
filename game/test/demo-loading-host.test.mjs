import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { DEMO_LOAD_TIMEOUT_MS } from '../demo-loading.mjs';

for (const exit of ['deadline', 'Back'])
  test(`a pending scene picture releases its painter on ${exit} before the decoder settles`, async (t) => {
    const page = await demoPage(t),
      ordinary = authoritativeCheckpoint(page.rendered.run),
      saved = [...page.storage.map],
      timers = new Map(),
      realSet = globalThis.setTimeout,
      realClear = globalThis.clearTimeout,
      realDispose = BoardPainter.prototype.dispose;
    // Control only the production loading deadline; real core verification,
    // host input, and ordinary app scheduling keep their normal behavior.
    t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
      if (ms !== DEMO_LOAD_TIMEOUT_MS) return realSet(callback, ms, ...args);
      const token = {};
      timers.set(token, () => callback(...args));
      return token;
    });
    t.mock.method(globalThis, 'clearTimeout', (token) => {
      if (!timers.delete(token)) realClear(token);
    });
    let pendingPainter,
      completeImage,
      disposals = 0;
    const decoding = new Promise((resolve) => {
      completeImage = resolve;
    });
    const loading = t.mock.method(BoardPainter.prototype, 'setLook', function () {
      pendingPainter ??= this;
      return decoding;
    });
    t.mock.method(BoardPainter.prototype, 'dispose', function () {
      if (this === pendingPainter) disposals++;
      return realDispose.call(this);
    });
    try {
      page.$('shell-demo').click();
      await waitFor(() => !!pendingPainter, {
        message: 'The real demo should reach picture preparation.',
      });
      assert.equal(page.$('demo-dialog').open, true);
      assert.equal(disposals, 0);
      if (exit === 'deadline') {
        assert.equal(timers.size, 1, 'Only full scene preparation is still awaiting its deadline.');
        [...timers.values()][0]();
        await waitFor(() => disposals === 1, {
          message: 'The timed-out scene must release its painter before fallback.',
        });
        // Other installed maps have improvised sources even when the fixture
        // restricts the reviewed catalogue to one clip. Cancel their fallback
        // preparation; the source bank is not exhausted after one deadline.
        page.$('demo-back').click();
      } else page.$('demo-back').click();
      assert.equal(
        disposals,
        1,
        'Abort retires the partially prepared painter without waiting for decode.',
      );
      assert.equal(page.$('demo-dialog').open, false);
      assert.equal(page.$('shell-home').open, true);
      assert.equal(timers.size, 0);
      completeImage();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(disposals, 1, 'The late decode cannot dispose the same owner twice.');
      assert.equal(page.$('demo-dialog').open, false);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), ordinary);
      assert.deepEqual([...page.storage.map], saved);
      assert.deepEqual(page.errors, []);
      loading.mock.restore();
      await page.open();
      assert.equal(
        page.$('demo-dialog').open,
        true,
        'A fresh session remains usable after the abandoned decode.',
      );
      page.$('demo-back').click();
      assert.deepEqual(page.errors, []);
    } finally {
      completeImage();
      loading.mock.restore();
    }
  });
