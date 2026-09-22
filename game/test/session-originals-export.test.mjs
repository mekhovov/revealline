import test from 'node:test';
import assert from 'node:assert/strict';
import { attachSessionOriginalsExport } from '../ui/session-originals-export.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
function fixture() {
  const state = { revision: 1, originals: 1, bytes: 1024, disposed: false };
  const root = {},
    note = {},
    prepare = {},
    download = {
      removeAttribute(key) {
        delete this[key];
      },
    };
  const urls = [],
    revoked = [],
    messages = [],
    errors = [];
  let response = () => new Blob(['test']),
    current = null;
  const panel = attachSessionOriginalsExport({
    registry: { status: () => ({ ...state }), exportBundle: (options) => response(options) },
    root,
    note,
    prepare,
    download,
    URLImpl: {
      createObjectURL(blob) {
        assert(blob instanceof Blob);
        const url = `blob:test-${urls.length}`;
        urls.push(url);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    setStatus: (message) => messages.push(message),
    async task(fn) {
      const controller = new AbortController();
      current = controller;
      const check = () => {
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      };
      try {
        await fn({
          signal: controller.signal,
          check,
          phase: (message) => {
            check();
            messages.push(message);
          },
        });
      } catch (error) {
        errors.push(error);
      } finally {
        if (current === controller) current = null;
      }
    },
  });
  return {
    panel,
    state,
    root,
    note,
    prepare,
    download,
    urls,
    revoked,
    messages,
    errors,
    response: (fn) => {
      response = fn;
    },
    cancel: () => current.abort(),
  };
}
test('offers a reusable real download without claiming durable save', async () => {
  const f = fixture();
  assert.equal(f.root.hidden, false);
  assert.match(f.note.textContent, /only in this tab/);
  await f.prepare.onclick();
  assert.equal(f.download.href, 'blob:test-0');
  assert.equal(f.download.hidden, false);
  assert.equal(f.download.download, 'RevealLine-session-originals.rlmedia');
  f.download.onclick({
    preventDefault() {
      assert.fail('Valid download blocked');
    },
  });
  assert.match(f.messages.at(-1), /requested.*Confirm it in your browser/);
  assert.deepEqual(f.revoked, []);
  await f.prepare.onclick();
  assert.deepEqual(f.revoked, ['blob:test-0']);
  assert.equal(f.download.href, 'blob:test-1');
  f.panel.dispose();
  f.panel.dispose();
  assert.deepEqual(f.revoked, ['blob:test-0', 'blob:test-1']);
  assert.equal(f.prepare.onclick, null);
});
test('new originals invalidate a prepared download before refresh', async () => {
  const f = fixture();
  await f.prepare.onclick();
  f.state.revision++;
  f.state.originals++;
  let prevented = false;
  f.download.onclick({
    preventDefault() {
      prevented = true;
    },
  });
  assert(prevented);
  assert.equal(f.download.hidden, true);
  assert.equal(f.download.href, undefined);
  assert.deepEqual(f.revoked, ['blob:test-0']);
  assert.match(f.messages.at(-1), /Prepare the current/);
  f.panel.dispose();
});
test('cancel or navigation prevents a late prepared download', async () => {
  for (const action of ['cancel', 'invalidate', 'dispose', 'revision']) {
    const f = fixture(),
      gate = deferred();
    f.response(() => gate.promise);
    const pending = f.prepare.onclick();
    if (action === 'cancel') f.cancel();
    else if (action === 'revision') f.state.revision++;
    else f.panel[action]();
    gate.resolve(new Blob(['late']));
    await pending;
    assert.equal(f.errors[0]?.name, 'AbortError', action);
    assert.deepEqual(f.urls, [], action);
    assert.equal(f.download.href, undefined, action);
    f.panel.dispose();
  }
});
test('export failure preserves originals and allows retry', async () => {
  const f = fixture();
  f.response(() => {
    throw new Error('Decode failed');
  });
  await f.prepare.onclick();
  assert.match(f.errors[0].message, /Decode failed/);
  assert.equal(f.state.originals, 1);
  assert.equal(f.download.hidden, true);
  f.response(() => new Blob(['verified']));
  await f.prepare.onclick();
  assert.equal(f.download.hidden, false);
  f.panel.dispose();
});
test('empty history hides the export controls', () => {
  const f = fixture();
  f.state.originals = 0;
  f.state.bytes = 0;
  f.panel.refresh();
  assert.equal(f.root.hidden, true);
  f.panel.dispose();
});
