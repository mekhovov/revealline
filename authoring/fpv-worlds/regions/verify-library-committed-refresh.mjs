import assert from 'node:assert/strict';
import { Document } from '../../../game/test/helpers/couch-dom.mjs';
import { mountRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-library.mjs';

// A completed atomic store operation and an independently stalled metadata read.
// Production UI with disposable memory records and deterministic clock; no user DB.
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function clock() {
  let time = 0,
    next = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      const id = ++next;
      timers.set(id, { at: time + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = time + ms;
      while (true) {
        const due = [...timers]
          .filter(([, value]) => value.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at;
        timers.delete(due[0]);
        due[1].fn();
      }
      time = end;
    },
    get pending() {
      return timers.size;
    },
  };
}
const hash = 'a'.repeat(64),
  oldHash = 'b'.repeat(64);
const descriptor = {
  id: 'refresh-fixture',
  revision: 'r2',
  title: { en: 'Refresh fixture', uk: 'Тест оновлення' },
};
const saved = (sha256, revision) => ({
  id: descriptor.id,
  sha256,
  descriptor: { ...descriptor, revision },
  bytes: 100,
  generation: 1,
});
const checks = [];
for (const mode of ['navigation', 'deadline', 'cancel', 'atomic']) {
  const doc = new Document(),
    parent = doc.createElement('div'),
    time = clock(),
    stalled = deferred(),
    transaction = deferred();
  doc.body.append(parent);
  const records = [saved(oldHash, 'r1')];
  let locale = 'en',
    lists = 0,
    flights = 0,
    removals = 0,
    signal;
  const store = {
    list: async () => {
      lists++;
      return lists === 2 && mode !== 'atomic' ? stalled.promise : [...records];
    },
    inspect: async () => ({ descriptor }),
    install: async (_pin, options) => {
      signal = options.signal;
      options.onProgress({ phase: 'commit', loadedBytes: 100, totalBytes: 100 });
      if (mode === 'atomic') await transaction.promise;
      records.push(saved(hash, 'r2'));
    },
    close() {},
    remove() {
      removals++;
    },
  };
  const ui = mountRegionalLibrary({
    parent,
    window: { ...time, location: { href: 'https://example.invalid/' } },
    pins: [
      {
        id: descriptor.id,
        title: descriptor.title,
        pin: { url: 'https://example.invalid/delivery.json', bytes: 100, sha256: hash },
      },
    ],
    el(tag, text, className) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    },
    txt: (en, uk) => (locale === 'uk' ? uk : en),
    openLibrary: async () => store,
    fly: async () => {
      flights++;
    },
  });
  const button = (label) =>
    [...doc.querySelectorAll('button')].find((node) => node.textContent === label);
  const notice = () => doc.querySelector('[role="status"]').textContent;
  try {
    ui.open();
    await settle();
    doc.querySelector('[data-region-action="install"]').click();
    await settle();
    if (mode === 'atomic') {
      assert(button('Cancel').disabled, 'Atomic transaction remains uncancellable');
      time.advance(700000);
      await settle();
      assert.equal(signal.aborted, false);
      assert.equal(records.length, 1);
      transaction.resolve();
      await settle();
      assert.equal(records.length, 2);
      assert.match(notice(), /Region saved/);
    } else {
      assert.equal(records.length, 2, 'Both revisions committed before metadata stalls');
      if (mode === 'navigation') {
        ui.deactivate();
        ui.open();
        await settle();
        assert(
          !button('Refresh saved regions').disabled,
          'Reopening must escape an old stalled metadata read',
        );
      } else if (mode === 'deadline') {
        time.advance(119999);
        await settle();
        assert(button('Refresh saved regions').disabled);
        time.advance(1);
        await settle();
        assert(
          !button('Refresh saved regions').disabled,
          'Post-commit metadata refresh has a bounded wait',
        );
        assert.match(notice(), /Saved changes are retained/);
        assert(!notice().includes('Cancelled'));
        locale = 'uk';
        ui.refresh();
        assert.match(notice(), /Зміни збережено/);
        locale = 'en';
        ui.refresh();
        button('Refresh saved regions').click();
        await settle();
      } else {
        assert(
          !button('Cancel').disabled,
          'Completed transaction no longer blocks cancellation of metadata read',
        );
        button('Cancel').click();
        await settle();
        assert.match(notice(), /Saved changes are retained/);
        button('Refresh saved regions').click();
        await settle();
      }
      assert.equal(doc.querySelectorAll('[data-region-action="fly"]').length, 2);
      stalled.resolve([saved(oldHash, 'r1')]);
      await settle();
      assert.equal(
        doc.querySelectorAll('[data-region-action="fly"]').length,
        2,
        'Late stale metadata must not overwrite refreshed cards',
      );
    }
    assert.equal(flights, 0);
    assert.equal(removals, 0);
    assert.equal(records.length, 2);
    assert.equal(time.pending, 0);
    checks.push(mode);
  } finally {
    ui.dispose();
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Production Library UI; committed data retained, isolated memory store and virtual time only',
    },
    null,
    2,
  ),
);
