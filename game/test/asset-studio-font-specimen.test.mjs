import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateAssetRevision } from '../presentation/model.mjs';

// Actual drawAssetPreview handlers and genuine committed font bytes. FontFace
// decoding and DOM/CSS are modeled: these assertions do not prove native glyphs,
// computed cascade, Plain rendering, readability, cmap coverage or reflow.
const roles = ['display', 'ui', 'numeric'];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const statusText = (node) => node.querySelector('.operation-status-label').textContent;
let moduleId = 0;

class PreviewElement extends Element {
  constructor(doc, tag) {
    super(doc, tag);
    this.style.getPropertyValue = (name) => this.style[name] || '';
    this.style.removeProperty = (name) => delete this.style[name];
  }
}

async function fontPreview(t, { shared = false, tokens = {} } = {}) {
  const provenance = JSON.parse(
    await readFile(new URL('../ui/fonts/field-kit/provenance.json', import.meta.url), 'utf8'),
  );
  const inputs = new Map();
  for (const row of provenance.fonts) {
    const bytes = await readFile(new URL(`../ui/fonts/field-kit/${row.file}`, import.meta.url));
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    inputs.set(row.role, { ...row, bytes });
  }
  const bundle = createDefaultThemeBundle();
  const resolved = structuredClone(resolvePresentation(bundle));
  Object.assign(resolved.tokens, tokens);
  const blobs = new Map(),
    expected = new Map();
  for (const role of roles) {
    const input = inputs.get(shared ? 'ui' : role),
      slotId = `font.${role}`;
    const asset = validateAssetRevision({
      ...resolved.assets[slotId],
      kind: 'font',
      recipe: null,
      file: {
        sha256: input.sha256,
        bytes: input.bytes.length,
        mime: 'font/woff2',
        width: null,
        height: null,
      },
    });
    resolved.assets[slotId] = asset;
    blobs.set(input.sha256, new Blob([input.bytes], { type: 'font/woff2' }));
    expected.set(`RLAsset-${input.sha256}`, {
      bytes: input.bytes,
      weight: shared || role === 'ui' ? '400 600' : role === 'display' ? '600' : '500',
    });
  }
  const before = structuredClone(resolved),
    originalBlobs = [...blobs];
  const doc = new Document();
  doc.createElement = (tag) => new PreviewElement(doc, tag);
  doc.body.classList.add('field-kit');
  const registered = new Set(),
    constructed = [],
    surfaces = [],
    pending = [],
    gates = [];
  doc.fonts = { add: (face) => registered.add(face) };
  let nextLoad = null;
  class FixtureFontFace {
    constructor(family, bytes, descriptors) {
      const target = expected.get(family);
      assert.ok(target, 'The requested family must name an exact supplied font.');
      assert.deepEqual(Buffer.from(bytes), target.bytes);
      assert.deepEqual(descriptors, { weight: target.weight, style: 'normal', display: 'swap' });
      this.family = family;
      constructed.push(this);
    }
    async load() {
      if (nextLoad) {
        const gate = nextLoad;
        nextLoad = null;
        gate.started.resolve(this);
        await gate.completed.promise;
      }
      return this;
    }
  }
  const previous = new Map(
    ['document', 'FontFace'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: doc });
  Object.defineProperty(globalThis, 'FontFace', {
    configurable: true,
    writable: true,
    value: FixtureFontFace,
  });
  t.after(async () => {
    for (const surface of surfaces) surface.previewCleanup?.();
    for (const gate of gates) gate.completed.resolve();
    await Promise.allSettled(pending);
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    assert.deepEqual(resolved, before);
    assert.deepEqual([...blobs], originalBlobs);
    for (const [hash, blob] of blobs)
      assert.equal(
        createHash('sha256')
          .update(Buffer.from(await blob.arrayBuffer()))
          .digest('hex'),
        hash,
      );
  });
  // A fresh module instance isolates its existing font cache across test cases;
  // each case still exercises real cache reuse, loading and ownership internally.
  const { drawAssetPreview } = await import(
    `../../authoring/asset-studio/preview.mjs?font-specimen=${++moduleId}`
  );
  const surface = doc.createElement('div'),
    target = doc.createElement('p'),
    cancelButton = doc.createElement('button'),
    focus = doc.createElement('input');
  doc.body.append(surface, target, cancelButton, focus);
  surfaces.push(surface);
  focus.focus();
  const draw = (role, { absent = false } = {}) => {
    const slot = bundle.slots.find((entry) => entry.id === `font.${role}`);
    const operation = drawAssetPreview(
      surface,
      slot,
      absent ? null : resolved.assets[slot.id],
      resolved,
      blobs,
      {
        mode: 'native',
        background: 'checker',
        geometry: false,
        statusTarget: target,
        cancelButton,
        label: 'Font preview',
      },
    );
    pending.push(operation);
    return operation;
  };
  const delay = () => {
    const gate = { started: deferred(), completed: deferred() };
    gates.push(gate);
    nextLoad = gate;
    return gate;
  };
  return {
    doc,
    surface,
    target,
    cancelButton,
    focus,
    draw,
    delay,
    resolved,
    registered,
    constructed,
  };
}

function assertSpecimens(view, role, size, weights) {
  const samples = view.surface.querySelectorAll('.font-file-sample');
  assert.equal(samples.length, weights.length);
  assert.equal(view.target.dataset.state, 'ready');
  assert.equal(view.surface.getAttribute('aria-busy'), 'false');
  assert.deepEqual(
    samples.map((sample) => sample.style.fontWeight),
    weights.map(String),
  );
  for (const sample of samples) {
    assert.equal(sample.style.fontSize, `${size}px`);
    assert.equal(
      sample.style.fontFamily,
      `RLAsset-${view.resolved.assets[`font.${role}`].file.sha256}`,
    );
    assert.match(sample.textContent, /Flight ready · Політ готовий/);
    assert.match(sample.textContent, /Continue mission · Продовжити місію/);
    assert.match(sample.textContent, /Ґґ Єє Іі Її Йй Щщ/);
    assert.match(sample.textContent, /01:24 · 75% · 0123456789 ₴/);
    assert.ok(sample.textContent.includes('І l 1 · О O 0 · ʼ ’'));
  }
  assert.equal(view.doc.activeElement, view.focus);
}

test('display file uses its exact Handjet family at 600 and floors legacy display size at 40', async (t) => {
  const view = await fontPreview(t, { tokens: { displaySize: 32 } });
  await view.draw('display');
  assertSpecimens(view, 'display', 40, [600]);
  assert.equal(view.constructed.length, 3);
  assert.equal(view.registered.size, 3);
});

test('UI file offers Exo weights 400, 500 and 600 at the readable body size', async (t) => {
  const view = await fontPreview(t, { tokens: { textSize: 16 } });
  await view.draw('ui');
  assertSpecimens(view, 'ui', 18, [400, 500, 600]);
});

test('numeric file uses the exact Plex family at 500 and the resolved counter size', async (t) => {
  const view = await fontPreview(t, { tokens: { textSize: 22 } });
  await view.draw('numeric');
  assertSpecimens(view, 'numeric', 30, [500]);
});

test('selected slot wins when one file serves every role, including under Plain tokens', async (t) => {
  const view = await fontPreview(t, {
    shared: true,
    tokens: {
      textSize: 22,
      displaySize: 48,
      fontDisplay: 'system-ui',
      fontUI: 'system-ui',
      fontNumeric: 'monospace',
    },
  });
  view.doc.body.dataset.textFace = 'plain';
  // Numeric first exposes a hash-order mistake: prepareFont visits display first.
  for (const [role, size, weights] of [
    ['numeric', 30, [500]],
    ['ui', 22, [400, 500, 600]],
    ['display', 48, [600]],
  ]) {
    await view.draw(role);
    assertSpecimens(view, role, size, weights);
  }
  assert.equal(view.constructed.length, 1, 'Shared font registration is retained.');
  assert.equal(view.registered.size, 1);
});

for (const action of ['cancel', 'supersede']) {
  for (const outcome of ['success', 'failure']) {
    test(`${action} fences late font-load ${outcome} and retains a usable retry`, async (t) => {
      const view = await fontPreview(t),
        gate = view.delay();
      const older = view.draw('ui');
      t.after(async () => {
        gate.completed.resolve();
        await older;
      });
      const reached = await Promise.race([gate.started.promise, older.then(() => null)]);
      assert.ok(reached, 'The actual preview must reach its real FontFace.load boundary.');
      assert.equal(view.surface.children.length, 0);
      assert.equal(view.surface.getAttribute('aria-busy'), 'true');
      assert.match(statusText(view.target), /reading and decoding font.display/);
      if (action === 'cancel') view.cancelButton.onclick();
      else await view.draw('numeric', { absent: true });
      const nodes = [...view.surface.children],
        message = statusText(view.target),
        state = view.target.dataset.state,
        button = view.cancelButton.textContent;
      assert.equal(state, action === 'cancel' ? 'detached' : 'ready');
      if (outcome === 'failure')
        gate.completed.reject(new Error('Font decoder rejected the file.'));
      else gate.completed.resolve();
      await older;
      assert.deepEqual(view.surface.children, nodes);
      assert.equal(statusText(view.target), message);
      assert.equal(view.target.dataset.state, state);
      assert.equal(view.cancelButton.textContent, button);
      assert.equal(view.surface.getAttribute('aria-busy'), 'false');
      assert.equal(view.doc.activeElement, view.focus);
      if (action === 'cancel') await view.cancelButton.onclick();
      else await view.draw('ui');
      assertSpecimens(view, 'ui', 18, [400, 500, 600]);
      assert.equal(view.registered.size, 3);
      assert.equal(
        view.constructed.length,
        outcome === 'failure' ? 4 : 3,
        'Successful shared loading is reused; a failed cache entry can be retried.',
      );
    });
  }
}
