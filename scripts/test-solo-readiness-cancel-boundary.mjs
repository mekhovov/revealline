import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { Document } from '../game/test/helpers/couch-dom.mjs';
import { attachControllerNavigation } from '../game/ui/controller-navigation.mjs';
import { createBrowserReadinessProbe } from './solo-qualification-readiness.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const defaultBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-readiness-geometry/default-cancel-observation.json',
    import.meta.url,
  ),
);
assert.equal(
  createHash('sha256').update(defaultBytes).digest('hex'),
  'bb0bc9ec664c521697c20f7158a29570fc0a92b53c6583d98d43b3ac9a922bd2',
);
const originalObservation = JSON.parse(defaultBytes);

function model(
  t,
  {
    enabled = true,
    root = 'body',
    hidden = false,
    display = 'block',
    faces = [],
    serialized = false,
    postCommand = false,
    nativeMicrotasks = false,
  } = {},
) {
  const doc = new Document(),
    win = doc.defaultView,
    microtasks = [];
  const add = (id, tag = 'div') => {
    const e = doc.createElement(tag);
    e.id = id;
    doc.body.append(e);
    return e;
  };
  const overlay = add('game-overlay'),
    status = add('flight-preparation-status'),
    result = add('show-result'),
    button = add('start-button', 'button');
  add('arena-shell');
  overlay.hidden = hidden;
  overlay.style.display = display;
  status.dataset.state = 'busy';
  result.hidden = true;
  doc.body.dataset.flightState = 'briefing';
  doc.documentElement.dataset.interfaceTheme = 'industrial';
  button.focus();
  doc.fonts = { check: () => true, [Symbol.iterator]: () => faces[Symbol.iterator]() };
  const run = { tick: 0, status: 'running', level: { id: 'first-return' } },
    scene = { lastPaint: { run }, cadence: { snapshot: () => null } };
  const env = {
    document: doc,
    performance: { now: () => 100 },
    queueMicrotask: (fn) => microtasks.push(fn),
    addEventListener: win.addEventListener.bind(win),
    removeEventListener: win.removeEventListener.bind(win),
    getComputedStyle: win.getComputedStyle,
  };
  const fn = serialized
    ? runInNewContext('(' + createBrowserReadinessProbe.toString() + ')', {
        TextEncoder,
        structuredClone,
      })
    : createBrowserReadinessProbe;
  const addListener = doc.addEventListener.bind(doc);
  let firstKeyListener = true;
  if (nativeMicrotasks)
    doc.addEventListener = (name, fn, options) => {
      if (name === 'keydown' && firstKeyListener) {
        firstKeyListener = false;
        return addListener(
          name,
          (event) => {
            fn(event);
            while (microtasks.length) microtasks.shift()();
          },
          options,
        );
      }
      return addListener(name, fn, options);
    };
  const probe = fn(
    () => scene,
    env,
    postCommand ? 'selected-font-cancel-post-command-v3' : 'selected-font-cancel-joined-v2',
    false,
    enabled,
  );
  t.after(() => probe.dispose());
  let calls = 0;
  const actualRoot =
    root === 'body'
      ? doc.body
      : root === 'document'
        ? doc
        : root === 'null'
          ? null
          : add('native-dialog', 'dialog');
  if (root === 'dialog') actualRoot.showModal();
  const nav = attachControllerNavigation({
    document: doc,
    getRoot: () => actualRoot,
    getScope: () => (root === 'flight' ? 'flight' : 'ready:first-return'),
    keyboard: true,
    onBack: () => {
      calls++;
      status.dataset.state = 'cancelled';
    },
    getControlLabels: () => ({ confirm: 'Enter', back: 'Escape' }),
  });
  t.after(() => nav.destroy());
  function escape() {
    const path = [button, doc.body, doc.documentElement, doc, env];
    let live = true;
    const event = button.emit('keydown', {
      key: 'Escape',
      code: 'Escape',
      isTrusted: true,
      repeat: false,
      eventPhase: 1,
      composedPath: () => (live ? path : []),
    });
    live = false;
    while (microtasks.length) microtasks.shift()();
    if (postCommand) probe.cancelCommandComplete();
    return { event, calls, observation: JSON.parse(JSON.stringify(probe.export())) };
  }
  return { doc, env, scene, probe, escape, overlay, button, actualRoot };
}
test('serialized boundary preserves actual body-owned Escape and captures event path before dispatch ends', (t) => {
  const h = model(t, {
    serialized: true,
    faces: [{ family: '"Field Kit Display"', weight: '600', status: 'loading' }],
  });
  const r = h.escape();
  assert.equal(r.calls, 1);
  assert.equal(r.event.defaultPrevented, true);
  const [a, b] = r.observation.records;
  assert.equal(a.cancelBoundary.sourceDerivedRoot, 'body-composite-from-reflected-overlay');
  assert.equal(a.cancelBoundary.privateRootObserved, false);
  assert.equal(a.cancelBoundary.defaultPrevented, false);
  assert.equal(b.cancelBoundary.defaultPrevented, true);
  assert.deepEqual(a.cancelBoundary.eventPath, b.cancelBoundary.eventPath);
  assert.equal(a.cancelBoundary.eventPath.length, 5);
  assert.equal(b.font.preparation, 'cancelled');
  assert.equal(a.cancelBoundary.exactFontInventory.faces[0].status, 'loading');
  assert.equal(
    a.font.loaded,
    true,
    'Legacy check raw true is retained independently of an actual loading face',
  );
  assert(Buffer.byteLength(JSON.stringify(r.observation)) <= 16384);
});
for (const kind of ['document', 'null'])
  test(
    'actual ' + kind + ' root leaves Escape unclaimed with bounded source-derived evidence',
    (t) => {
      const h = model(t, { root: kind, hidden: true });
      const r = h.escape();
      assert.equal(r.calls, 0);
      assert.equal(r.event.defaultPrevented, false);
      assert.equal(
        r.observation.records[0].cancelBoundary.sourceDerivedRoot,
        'document-from-no-overlay',
      );
      assert.equal(r.observation.records[0].cancelBoundary.privateRootObserved, false);
    },
  );
test('CSS-hidden HUD and reflected hidden flag are kept separate', (t) => {
  const h = model(t, { display: 'none' });
  const r = h.escape();
  const b = r.observation.records[0].cancelBoundary;
  assert.equal(b.overlay.hidden, false);
  assert.equal(b.overlay.display, 'none');
  assert.equal(b.sourceDerivedRoot, 'body-composite-from-reflected-overlay');
  assert.equal(r.calls, 1);
});
test('unexpected run and embedded focus remain unknown, markers do not assert a private root', (t) => {
  const h = model(t, { root: 'null' });
  h.scene.lastPaint.run.tick = 1;
  h.doc.body.setAttribute('data-menu-input', 'keyboard');
  const r = h.escape();
  assert.equal(r.observation.records[0].cancelBoundary.sourceDerivedRoot, 'unknown');
  assert.equal(r.observation.records[0].cancelBoundary.markedRoots.length, 1);
});
test('native dialog boundary does not manufacture a Cancel observation or invoke Back', (t) => {
  const h = model(t, { root: 'dialog' });
  const r = h.escape();
  assert.equal(r.calls, 0);
  assert.equal(r.event.defaultPrevented, false);
  assert.equal(r.observation.records.length, 0);
});
test('absent exact face and true check remain absence, not loaded proof', (t) => {
  const h = model(t);
  const r = h.escape();
  const f = r.observation.records[0].cancelBoundary.exactFontInventory;
  assert.equal(f.available, true);
  assert.deepEqual(f.faces, []);
  assert.equal(f.overflow, false);
  assert.equal(r.observation.records[0].font.loaded, true);
});
test('font scan and matches are independently bounded and fail visibly', (t) => {
  const h = model(t, {
    faces: Array.from({ length: 100 }, () => ({
      family: 'Field Kit Display',
      weight: '600',
      status: 'loading',
    })),
  });
  const r = h.escape();
  const f = r.observation.records[0].cancelBoundary.exactFontInventory;
  assert.equal(f.scanned, 64);
  assert.equal(f.faces.length, 8);
  assert.equal(f.overflow, true);
  assert.equal(f.matchesOverflow, true);
  assert(Buffer.byteLength(JSON.stringify(r.observation)) <= 16384);
});
test('unavailable and malformed face properties do not become absent known-zero', (t) => {
  const h = model(t, {
    faces: [{ family: 'Field Kit Display', weight: 'x'.repeat(33), status: 'invented' }],
  });
  const r = h.escape();
  assert.equal(r.observation.records[0].cancelBoundary.exactFontInventory.invalid, true);
});
test('default collector remains exact and does not read diagnostic DOM styles/font iterator', (t) => {
  const a = model(t, { enabled: false });
  for (const h of [a]) {
    h.env.getComputedStyle = () => {
      throw Error('default diagnostic read');
    };
    h.doc.fonts[Symbol.iterator] = () => {
      throw Error('default font iteration');
    };
  }
  assert.deepEqual(a.escape().observation, originalObservation);
  assert(!a.probe.export().records[0].cancelBoundary);
});
test('unadmitted protocols/options reject before listener installation', () => {
  for (const p of ['first-running-v1', 'saved-resume-v1', 'selected-font-cancel-v1'])
    assert.throws(
      () => createBrowserReadinessProbe(() => null, {}, p, false, true),
      /explicit joined/,
    );
  assert.throws(
    () =>
      createBrowserReadinessProbe(() => null, {}, 'selected-font-cancel-joined-v2', false, 'true'),
    /explicit joined/,
  );
});

test('export copies nested optional boundary records without changing retained evidence', (t) => {
  const h = model(t, {
    faces: [{ family: 'Field Kit Display', weight: '600', status: 'loading' }],
  });
  h.escape();
  const expected = h.probe.export();
  const changed = h.probe.export();
  changed.records[0].cancelBoundary.exactFontInventory.faces[0].status = 'loaded';
  changed.records[0].cancelBoundary.eventPath[0].id = 'changed';
  changed.records[0].cancelBoundary.modifiers[0] = true;
  changed.records[0].cancelBoundary.overlay.identity.id = 'changed';
  assert.deepEqual(h.probe.export(), expected);
});
test('marked roots inspect only the first four identities without expanding the collection', (t) => {
  const h = model(t),
    query = h.doc.querySelectorAll.bind(h.doc);
  let reads = 0;
  const nodes = new Proxy(
    { length: 100 },
    {
      get(target, key) {
        if (key === 'length') return target.length;
        if (typeof key === 'symbol') throw Error('collection iteration is not bounded');
        const index = Number(key);
        assert(index < 4, 'read beyond identity bound');
        reads++;
        return h.button;
      },
    },
  );
  h.doc.querySelectorAll = (selector) =>
    selector === '[data-menu-input]' ? nodes : query(selector);
  const r = h.escape();
  assert.equal(reads, 8, 'four direct reads at each of two fixed boundaries');
  for (const row of r.observation.records) {
    assert.equal(row.cancelBoundary.markedRoots.length, 4);
    assert.equal(row.cancelBoundary.markedRootsTruncated, true);
  }
});

test('native-between-listener checkpoint remains early raw evidence; V3 reads after actual navigation handler', (t) => {
  const h = model(t, {
    postCommand: true,
    nativeMicrotasks: true,
    serialized: true,
    faces: [{ family: 'Field Kit Display', weight: '600', status: 'loading' }],
  });
  const { observation, calls } = h.escape();
  assert.equal(calls, 1);
  assert.deepEqual(
    observation.records.map((r) => r.kind),
    ['cancel-back', 'cancel-early-microtask', 'cancel-command-complete'],
  );
  assert.equal(observation.records[1].font.preparation, 'busy');
  assert.equal(observation.records[1].font.defaultPrevented, false);
  assert.equal(observation.records[2].font.preparation, 'cancelled');
  assert.equal(observation.records[2].font.defaultPrevented, true);
  assert.equal(observation.records[2].cancelBoundary.defaultPrevented, true);
  assert.throws(() => h.probe.cancelCommandComplete(), /Invalid/);
});
test('old V2 keeps its native early snapshot and no post-command reinterpretation', (t) => {
  const h = model(t, { nativeMicrotasks: true });
  const { observation, calls } = h.escape();
  assert.equal(calls, 1);
  assert.equal(observation.records[1].kind, 'cancel-complete');
  assert.equal(observation.records[1].font.preparation, 'busy');
  assert.equal(observation.records[1].font.defaultPrevented, false);
  assert.throws(() => h.probe.cancelCommandComplete(), /Invalid/);
});
test('V3 cannot invent completion without a captured native key or after disposal', (t) => {
  const h = model(t, { postCommand: true });
  assert.throws(() => h.probe.cancelCommandComplete(), /Invalid/);
  h.probe.dispose();
  assert.throws(() => h.probe.cancelCommandComplete(), /Invalid/);
});
