import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { mountFlightNotebook } from '../../optional-practice/civilian-fpv/notebook.mjs';
import { createFlightAttemptStore } from '../../optional-practice/civilian-fpv/attempts.mjs';
test('mounted notebook exposes every part, localizes without changing bytes, and preserves pasted input', async () => {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const view = mountFlightNotebook({
    container,
    window: { indexedDB: null },
    courses: FLIGHT_COURSES,
  });
  const source = [];
  try {
    await view.ready;
    for (let n = 0; n < 17; n++) {
      const p = { ...structuredClone(FLIGHT_DEMONSTRATIONS[0]), session: 'practice' };
      p.frames = [...Array.from({ length: n }, () => [0, 0, 0, 0]), ...p.frames];
      source.push(p);
      await view.accept(p);
    }
    assert.equal(view.snapshot().attempts.length, 17);
    const button = (text) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent === text);
    const transfer = container.querySelector('textarea'),
      exporter = button('Export verified flight proofs'),
      next = button('Next backup part'),
      previous = button('Previous backup part');
    await exporter.onclick();
    const first = transfer.value;
    assert.equal(JSON.parse(first).attempts.length, 16);
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, false);
    assert.match(container.textContent, /Backup part 1 of 2.*save every part/);
    next.onclick();
    const second = transfer.value;
    assert.equal(JSON.parse(second).attempts.length, 1);
    assert.equal(next.disabled, true);
    assert.equal(previous.disabled, false);
    assert.deepEqual([...JSON.parse(first).attempts, ...JSON.parse(second).attempts], source);
    view.setLocale('uk');
    assert.equal(transfer.value, second);
    assert.match(container.textContent, /Частина резервної копії 2 із 2/);
    assert.equal(next.textContent, 'Наступна частина копії');
    previous.onclick();
    assert.equal(transfer.value, first);
    transfer.value = '{"my":"unsubmitted import"}';
    transfer.oninput();
    assert.equal(next.hidden, true);
    assert.equal(previous.hidden, true);
    next.onclick();
    assert.equal(transfer.value, '{"my":"unsubmitted import"}');
    view.setLocale('en');
    assert.equal(transfer.value, '{"my":"unsubmitted import"}');
    assert.equal(view.snapshot().attempts.length, 17);
    await view.dispose();
    assert.equal(transfer.oninput, null);
    assert.equal(next.onclick, null);
    assert.equal(exporter.onclick, null);
    assert.equal(transfer.value, '');
    assert.equal(container.children.length, 0);
  } finally {
    await view.dispose();
  }
});
test('empty and small legacy backups remain isolated lossless importable snapshots', async () => {
  const verify = async (_courses, p) => ({
    hash: 'a'.repeat(64),
    proof: p,
    record: { attemptId: 'one' },
    summary: {},
  });
  const store = createFlightAttemptStore({ courses: [], indexedDB: null, verify });
  const receiver = createFlightAttemptStore({ courses: [], indexedDB: null, verify });
  try {
    await store.load();
    await receiver.load();
    assert.deepEqual(store.exportParts(), [store.export()]);
    const p = { frames: [[0, 0, 0, 0]], note: 'exact' };
    await store.accept(p);
    const single = store.export(),
      parts = store.exportParts();
    assert.deepEqual(parts, [single]);
    parts[0].attempts[0].note = 'changed';
    assert.equal(store.export().attempts[0].note, 'exact');
    await receiver.import(JSON.stringify(single));
    assert.deepEqual(receiver.export(), single);
  } finally {
    await store.close();
    await receiver.close();
  }
});
