import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTeamDiscoveryPictures } from '../couch/team-discovery-pictures.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Real gallery scheduler, finite DOM/canvas. Exact originals and game ownership
// are qualified separately through the host and production picture lease.
function fixture(t) {
  const doc = new Document(),
    traces = new Map();
  let failPaint = false;
  doc.createElement = (tag) => {
    const node = new Element(doc, tag);
    if (tag === 'canvas') {
      const trace = [];
      traces.set(node, trace);
      const context = {
        drawImage(...args) {
          if (failPaint) {
            failPaint = false;
            throw new Error('paint failure');
          }
          trace.push(['image', ...args]);
        },
        fillRect(...args) {
          trace.push(['mask', context.fillStyle, ...args]);
        },
      };
      node.getContext = () => context;
    }
    return node;
  };
  const node = (tag) => doc.createElement(tag),
    dialog = node('dialog'),
    list = node('div'),
    back = node('button'),
    other = node('button'),
    preview = {
      panel: node('section'),
      canvas: node('canvas'),
      title: node('h3'),
      status: node('p'),
      retry: node('button'),
    };
  dialog.open = true;
  preview.panel.hidden = true;
  preview.retry.hidden = true;
  preview.panel.append(preview.title, preview.canvas, preview.status, preview.retry);
  dialog.append(back, list, preview.panel);
  doc.body.append(dialog, other);
  const calls = [];
  let onView = () => {};
  const pictures = attachTeamDiscoveryPictures({
    document: doc,
    dialog,
    list,
    back,
    preview,
    prepare(row, options) {
      let resolve, reject;
      const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const call = { row, ...options, resolve, reject, releases: 0, confirmations: 0 };
      calls.push(call);
      return promise;
    },
    onViewChange: () => onView(),
  });
  function populate(prefix = 'one', count = 2) {
    const cards = Array.from({ length: count }, (_, index) => {
      const card = node('article'),
        button = node('button'),
        row = {
          key: `${prefix}-${index}`,
          title: `${prefix} ${index}`,
          packName: prefix,
          sourceLabel: 'Test',
        };
      card.append(button);
      return { card, button, row };
    });
    list.replaceChildren(...cards.map(({ card }) => card));
    pictures.populate(cards);
    return cards;
  }
  function complete(index, image = { identity: index }) {
    const call = calls[index];
    call.resolve({
      image,
      confirm() {
        call.confirmations++;
        return image;
      },
      release() {
        call.releases++;
      },
    });
  }
  const previewButtons = () => [...list.querySelectorAll('.team-discovery-preview-button')];
  t.after(() => {
    pictures.dispose();
    for (const call of calls) call.resolve({ image: null, release() {} });
  });
  return {
    doc,
    dialog,
    list,
    back,
    other,
    preview,
    traces,
    calls,
    pictures,
    populate,
    complete,
    previewButtons,
    failPaint: () => {
      failPaint = true;
    },
    onView: (fn) => {
      onView = fn;
    },
  };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

test('cancelled visits retain the single actual preparation permit until the old work settles', async (t) => {
  const f = fixture(t);
  f.populate('old');
  f.pictures.start();
  assert.equal(f.calls.length, 1);
  f.pictures.close();
  f.populate('new');
  f.pictures.start();
  assert.equal(f.calls[0].signal.aborted, true);
  assert.equal(f.calls.length, 1, 'Cancellation does not invent a free preparation slot');
  f.complete(0);
  await waitFor(() => f.calls.length === 2);
  assert.equal(f.calls[0].releases, 1);
  assert.equal(f.calls[0].confirmations, 0, 'Retired pictures never reach a draw');
  assert.equal(f.calls[1].row.key, 'new-0');
});

test('explicit full preview has priority after cancelled teaser settles, then Back restores its exact opener', async (t) => {
  const f = fixture(t);
  f.populate();
  f.pictures.start();
  const opener = f.previewButtons()[1];
  opener.focus();
  opener.click();
  assert.equal(f.preview.panel.hidden, false);
  assert.equal(f.list.hidden, true);
  assert.equal(f.back.textContent, 'Back to arenas');
  assert.equal(f.preview.status.dataset.state, 'busy');
  assert.equal(f.doc.activeElement === f.back, true);
  assert.equal(f.calls.length, 1);
  f.complete(0);
  await waitFor(() => f.calls.length === 2);
  assert.equal(f.calls[1].row.key, 'one-1');
  f.complete(1);
  await waitFor(() => f.preview.status.dataset.state === 'ready');
  assert.equal(f.calls[1].releases, 1);
  assert.equal(f.preview.canvas.width, 1152);
  assert.equal(f.preview.canvas.height, 576);
  assert.deepEqual(f.traces.get(f.preview.canvas), [['image', { identity: 1 }, 0, 0, 1152, 576]]);
  assert.equal(f.pictures.back(), true);
  assert.equal(f.doc.activeElement === opener, true);
  assert.equal(f.preview.panel.hidden, true);
  assert.equal(f.list.hidden, false);
  assert.equal(f.preview.canvas.width, 0);
});

test('teaser reveals only the defined border and releases its original before the next preparation', async (t) => {
  const f = fixture(t);
  const cards = f.populate();
  f.pictures.start();
  f.complete(0);
  await waitFor(() => f.calls.length === 2);
  const canvas = cards[0].card.querySelector('canvas'),
    operations = f.traces.get(canvas);
  assert.equal(canvas.hidden, false);
  assert.equal(f.calls[0].releases, 1);
  assert.deepEqual(operations, [
    ['image', { identity: 0 }, 0, 0, 288, 144],
    ['mask', '#0b1a24', 24, 24, 240, 96],
  ]);
  // Visible outcomes: centre is masked; both ends retain the copied picture.
  const at = (x, y) => (x >= 24 && x < 264 && y >= 24 && y < 120 ? 'mask' : 'image');
  assert.equal(at(144, 72), 'mask');
  assert.equal(at(12, 72), 'image');
  assert.equal(at(276, 72), 'image');
});

test('paint failure releases the original, leaves Play available and permits a successful explicit Retry', async (t) => {
  const f = fixture(t);
  const cards = f.populate('one', 1);
  f.pictures.start();
  f.complete(0);
  await settled();
  f.previewButtons()[0].click();
  f.failPaint();
  f.complete(1);
  await waitFor(() => f.preview.status.dataset.state === 'error');
  assert.equal(f.calls[1].releases, 1);
  assert.equal(cards[0].button.disabled, false);
  assert.equal(f.preview.retry.hidden, false);
  assert.equal(f.preview.canvas.hidden, true);
  f.preview.retry.click();
  f.complete(2);
  await waitFor(() => f.preview.status.dataset.state === 'ready');
  assert.equal(f.calls[2].releases, 1);
});

test('Back completion and foreground cancellation never take a newer focus choice', async (t) => {
  const f = fixture(t);
  f.populate('one', 1);
  f.pictures.start();
  f.complete(0);
  await settled();
  f.previewButtons()[0].click();
  f.other.focus();
  f.complete(1);
  await waitFor(() => f.preview.status.dataset.state === 'ready');
  assert.equal(f.doc.activeElement === f.other, true);
  f.onView(() => f.other.focus());
  f.pictures.back();
  assert.equal(f.doc.activeElement === f.other, true);
});

test('abort reentry cannot let an older close or populate replace the newer visit', async (t) => {
  const f = fixture(t);
  f.populate('old', 1);
  f.pictures.start();
  f.calls[0].signal.addEventListener(
    'abort',
    () => {
      f.populate('new', 1);
      f.pictures.start();
    },
    { once: true },
  );
  f.populate('overtaken', 1);
  f.pictures.start();
  assert.equal(f.calls.length, 1);
  f.complete(0);
  await waitFor(() => f.calls.length === 2);
  assert.equal(f.calls[1].row.key, 'new-0');
});

test('terminal disposal prevents abort callbacks from reviving preview work', async (t) => {
  const f = fixture(t);
  f.populate('old', 1);
  f.pictures.start();
  f.calls[0].signal.addEventListener(
    'abort',
    () => {
      f.populate('revive', 1);
      f.pictures.start();
    },
    { once: true },
  );
  f.pictures.dispose();
  f.complete(0);
  await settled();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].releases, 1);
  assert.equal(f.preview.panel.hidden, true);
});
