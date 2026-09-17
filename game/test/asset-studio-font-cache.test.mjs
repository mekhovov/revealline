import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateAssetRevision } from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';

// The real handler and validated revisions use genuine committed variable Exo
// bytes. DOM, FontFace decoding and FontFaceSet registration are explicitly
// modeled. No native font selection, glyph, axis, CSS, reflow or release proof.
const options = { concurrency: false, timeout: 10000 };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const statusText = (target) => target.querySelector('.operation-status-label').textContent;
// Only model-validated ordinary JSON values enter this receipt helper. Hash the
// same ordered JSON structure a piece at a time; never allocate one serialized
// full-registry string or a second full graph merely to check nonmutation.
function fingerprint(value) {
  const hash = createHash('sha256');
  const visit = (entry) => {
    if (Array.isArray(entry)) {
      hash.update('[');
      entry.forEach((child, index) => {
        if (index) hash.update(',');
        visit(child);
      });
      hash.update(']');
    } else if (entry !== null && typeof entry === 'object') {
      hash.update('{');
      Object.keys(entry).forEach((key, index) => {
        if (index) hash.update(',');
        hash.update(JSON.stringify(key));
        hash.update(':');
        visit(entry[key]);
      });
      hash.update('}');
    } else hash.update(JSON.stringify(entry));
  };
  visit(value);
  return hash.digest('hex');
}
let moduleId = 0;
let fontInput;

async function exoInput() {
  fontInput ||= (async () => {
    const provenance = JSON.parse(
      await readFile(new URL('../ui/fonts/field-kit/provenance.json', import.meta.url), 'utf8'),
    );
    const row = provenance.fonts.find((entry) => entry.role === 'ui');
    assert.equal(row.family, 'Exo 2');
    assert.deepEqual(row.outputAxes.wght, [400, 400, 600]);
    const bytes = await readFile(new URL(`../ui/fonts/field-kit/${row.file}`, import.meta.url));
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    return { row, bytes };
  })();
  return fontInput;
}

class PreviewElement extends Element {
  constructor(doc, tag) {
    super(doc, tag);
    this.style.getPropertyValue = (name) => this.style[name] || '';
    this.style.getPropertyPriority = () => '';
    this.style.removeProperty = (name) => delete this.style[name];
  }
}

// The module cache intentionally retains a loaded FontFace. Keep its mock
// methods in this small lexical scope so it cannot retain full per-case DOM or
// presentation snapshots after the case ends.
function createFontBoundary(bytes, family) {
  const state = {
    nextRead: null,
    nextLoad: null,
    weightFailure: null,
    calls: { reads: 0, loads: 0 },
    constructed: [],
  };
  class FontBlob extends Blob {
    async arrayBuffer() {
      state.calls.reads++;
      const gate = state.nextRead;
      state.nextRead = null;
      if (gate) {
        gate.started.resolve();
        await gate.completed.promise;
      }
      return super.arrayBuffer();
    }
  }
  class FixtureFontFace {
    constructor(requestedFamily, source, descriptors = {}) {
      assert.equal(requestedFamily, family);
      assert.deepEqual(Buffer.from(source), bytes, 'The handler passes the complete genuine font.');
      this.family = requestedFamily;
      this.weight = descriptors.weight || 'normal';
      this.style = descriptors.style || 'normal';
      this.display = descriptors.display || 'auto';
      this.status = 'unloaded';
      this.gate = state.nextLoad;
      state.nextLoad = null;
      this.promise = null;
      state.constructed.push(this);
    }
    get weight() {
      return this.currentWeight;
    }
    set weight(value) {
      if (state.weightFailure) {
        const error = state.weightFailure;
        state.weightFailure = null;
        throw error;
      }
      this.currentWeight = String(value);
    }
    load() {
      state.calls.loads++;
      if (!this.promise) {
        this.status = 'loading';
        this.promise = (async () => {
          try {
            if (this.gate) {
              this.gate.started.resolve(this);
              await this.gate.completed.promise;
            }
            this.status = 'loaded';
            return this;
          } catch (error) {
            this.status = 'error';
            throw error;
          }
        })();
      }
      return this.promise;
    }
  }
  return { state, FontFace: FixtureFontFace, blob: new FontBlob([bytes], { type: 'font/woff2' }) };
}

// Full source documents are transient setup inputs, never captured by draw or
// teardown. Each real immutable transition is checked before its predecessor is
// released; only snapshots actually needed by a case survive setup.
function advanceDocument(source, change) {
  const before = fingerprint(source);
  const next = reviseStudioTheme(source, change);
  assert.equal(fingerprint(source), before, 'Revision creation preserves its predecessor.');
  return next;
}
function capturePresentation(source) {
  const before = fingerprint(source);
  const resolved = resolvePresentation(source);
  assert.equal(fingerprint(source), before, 'Resolution preserves its full input document.');
  return resolved;
}
function initialFontMetadata(source) {
  const resolved = capturePresentation(source);
  const originalUI = resolved.assets['font.ui'];
  return {
    slots: new Map(
      source.slots
        .filter((slot) => ['font.display', 'font.ui', 'font.numeric'].includes(slot.id))
        .map((slot) => [slot.id, slot]),
    ),
    displayRecipe: resolved.assets['font.display'],
    originalUI: { id: originalUI.id, revision: originalUI.revision },
  };
}
function revisionInputs(row, bytes, requested) {
  let current = createDefaultThemeBundle();
  const metadata = initialFontMetadata(current);
  const font = validateAssetRevision({
    ...metadata.displayRecipe,
    id: 'font.shared.exo',
    revision: 1,
    kind: 'font',
    description: 'Genuine Exo 2 variable font for compatible role-transition tests.',
    provenance: {
      creator: 'Exo 2 upstream authors',
      source: row.sourceUrl,
      license: row.license,
      prompt: '',
      parent: null,
    },
    recipe: null,
    file: {
      sha256: row.sha256,
      bytes: bytes.length,
      mime: 'font/woff2',
      width: null,
      height: null,
    },
  });
  const ref = { id: font.id, revision: font.revision },
    snapshots = {};
  current = advanceDocument(current, { assets: [font], bindings: { 'font.display': ref } });
  if (requested.includes('narrow')) snapshots.narrow = capturePresentation(current);
  current = advanceDocument(current, { bindings: { 'font.ui': ref } });
  if (requested.includes('wide')) snapshots.wide = capturePresentation(current);
  if (requested.includes('narrowed')) {
    current = advanceDocument(current, { bindings: { 'font.ui': metadata.originalUI } });
    snapshots.narrowed = capturePresentation(current);
  }
  current = null;
  if (snapshots.narrow) assert.equal(snapshots.narrow.assets['font.ui'].kind, 'recipe');
  if (snapshots.wide) assert.equal(snapshots.wide.assets['font.ui'].file.sha256, font.file.sha256);
  if (snapshots.narrowed) assert.equal(snapshots.narrowed.assets['font.ui'].kind, 'recipe');
  assert.equal(metadata.slots.size, 3);
  return { snapshots, slots: metadata.slots };
}

async function harness(t, requested = ['narrow', 'wide']) {
  const { row, bytes } = await exoInput();
  const { snapshots, slots } = revisionInputs(row, bytes, requested);
  const beforeSnapshots = Object.fromEntries(
    Object.entries(snapshots).map(([name, snapshot]) => [name, fingerprint(snapshot)]),
  );
  const gates = [],
    pending = [],
    surfaces = [];
  const boundary = createFontBoundary(bytes, `RLAsset-${row.sha256}`);
  const { state } = boundary;
  const calls = state.calls;
  // One Blob is shared by every valid revision/surface within this case.
  const blob = boundary.blob;
  const blobs = new Map([[row.sha256, blob]]);
  const doc = new Document();
  doc.createElement = (tag) => new PreviewElement(doc, tag);
  const registered = new Set(),
    registrations = [],
    deletions = [],
    constructed = state.constructed;
  doc.fonts = {
    add(face) {
      assert.equal(face.status, 'loaded');
      registered.add(face);
      registrations.push(face);
      return this;
    },
    delete(face) {
      deletions.push(face);
      return registered.delete(face);
    },
    has: (face) => registered.has(face),
    values: () => registered.values(),
    [Symbol.iterator]: () => registered[Symbol.iterator](),
  };
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
    value: boundary.FontFace,
  });
  const focus = doc.createElement('input');
  doc.body.append(focus);
  focus.focus();
  t.after(async () => {
    for (const surface of surfaces) surface.element.previewCleanup?.();
    for (const gate of gates) gate.completed.resolve();
    await Promise.allSettled(pending);
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(snapshots).map(([name, snapshot]) => [name, fingerprint(snapshot)]),
      ),
      beforeSnapshots,
    );
    assert.equal(blobs.size, 1);
    assert.equal(blobs.get(row.sha256), blob);
    assert.equal(
      createHash('sha256')
        .update(Buffer.from(await Blob.prototype.arrayBuffer.call(blob)))
        .digest('hex'),
      row.sha256,
    );
    for (const name of Object.keys(snapshots)) delete snapshots[name];
    slots.clear();
    surfaces.length = pending.length = gates.length = 0;
  });
  // Isolate cases, but retain THIS module/cache across all revisions and both
  // independently current surfaces in each case. No import between transitions.
  const { drawAssetPreview } = await import(
    `../../authoring/asset-studio/preview.mjs?font-role-cache=${++moduleId}`
  );
  const addSurface = (label) => {
    const element = doc.createElement('div'),
      status = doc.createElement('p'),
      cancel = doc.createElement('button');
    doc.body.append(element, status, cancel);
    const surface = { element, status, cancel, label };
    surfaces.push(surface);
    return surface;
  };
  const a = addSurface('Saved font preview'),
    b = addSurface('Draft font preview');
  const draw = (surface, snapshot, role = 'display') => {
    const slot = slots.get(`font.${role}`);
    const result = drawAssetPreview(
      surface.element,
      slot,
      snapshot.assets[slot.id],
      snapshot,
      blobs,
      {
        mode: 'native',
        background: 'checker',
        geometry: false,
        motion: 'paused',
        statusTarget: surface.status,
        cancelButton: surface.cancel,
        label: surface.label,
      },
    );
    pending.push(result);
    return result;
  };
  const delay = (boundary) => {
    const gate = { started: deferred(), completed: deferred() };
    gates.push(gate);
    if (boundary === 'bytes') state.nextRead = gate;
    else state.nextLoad = gate;
    return gate;
  };
  const remember = (result) => {
    pending.push(result);
    return result;
  };
  const rejectNextWeightUpdate = () => {
    state.weightFailure = new DOMException(
      'Fixture font weight update was rejected.',
      'SyntaxError',
    );
  };
  return {
    a,
    b,
    snapshots,
    draw,
    delay,
    remember,
    rejectNextWeightUpdate,
    calls,
    doc,
    focus,
    registered,
    registrations,
    deletions,
    constructed,
    family: `RLAsset-${row.sha256}`,
  };
}

function assertCoverage(face, low, high) {
  const weights = String(face.weight).trim().split(/\s+/).map(Number);
  assert.ok(
    weights.length === 1 || weights.length === 2,
    'A single weight or range is registered.',
  );
  assert.ok(
    weights.every((weight) => Number.isFinite(weight) && weight >= 400 && weight <= 600),
    'Descriptor remains within this actual Exo fixture’s supported 400–600 range.',
  );
  const min = weights[0],
    max = weights.at(-1);
  assert.ok(min <= low && max >= high, `Registered ${face.weight} must cover ${low}–${high}.`);
}
function assertSharedFace(view, low = 400, high = 600) {
  assert.equal(view.registered.size, 1, 'One successful font is registered for this hash.');
  assert.equal(
    view.registrations.length,
    1,
    'A compatible role change does not register a competing face.',
  );
  assert.equal(view.deletions.length, 0, 'A shared live face is not removed.');
  const face = [...view.registered][0];
  assert.equal(face.family, view.family);
  assert.equal(face.style, 'normal');
  assertCoverage(face, low, high);
  return face;
}
function assertReady(view, surface) {
  assert.equal(surface.status.dataset.state, 'ready');
  assert.match(statusText(surface.status), /ready\./);
  assert.equal(surface.element.getAttribute('aria-busy'), 'false');
  const samples = surface.element.querySelectorAll('.font-file-sample');
  assert.ok(samples.length > 0, 'The actual handler renders the current font sample.');
  for (const sample of samples) assert.equal(sample.style.fontFamily, view.family);
  assert.equal(view.doc.activeElement, view.focus);
}
function frozenSurface(surface) {
  return {
    children: [...surface.element.children],
    text: surface.element.textContent,
    message: statusText(surface.status),
    state: surface.status.dataset.state,
    busy: surface.element.getAttribute('aria-busy'),
    cancelText: surface.cancel.textContent,
    cancelHidden: surface.cancel.hidden,
  };
}
function assertUnchanged(view, surface, before) {
  assert.deepEqual(
    frozenSurface(surface),
    before,
    'Late work cannot mutate an abandoned surface, status or recovery action.',
  );
  assert.equal(view.doc.activeElement, view.focus);
}
async function overlapping(view, boundary) {
  const gate = view.delay(boundary);
  const older = view.draw(view.a, view.snapshots.narrow);
  const reached = await Promise.race([
    gate.started.promise.then(() => true),
    older.then(() => false),
  ]);
  assert.ok(reached, `The actual handler must reach the held ${boundary} boundary.`);
  const newer = view.draw(view.b, view.snapshots.wide, 'ui');
  assert.equal(view.a.element.getAttribute('aria-busy'), 'true');
  assert.equal(view.b.element.getAttribute('aria-busy'), 'true');
  assert.match(statusText(view.b.status), /reading and decoding/);
  return { gate, older, newer };
}

test(
  'sequential same-file role expansion widens the one face while both previews remain current',
  options,
  async (t) => {
    const view = await harness(t);
    await view.draw(view.a, view.snapshots.narrow);
    assertReady(view, view.a);
    const face = assertSharedFace(view, 600, 600);
    const original = frozenSurface(view.a);
    await view.draw(view.b, view.snapshots.wide, 'ui');
    assertReady(view, view.b);
    assert.equal(assertSharedFace(view), face);
    assertUnchanged(view, view.a, original);
  },
);

for (const boundary of ['bytes', 'load']) {
  test(
    `same-file widening during pending ${boundary} serves both current surfaces`,
    options,
    async (t) => {
      const view = await harness(t);
      const { gate, older, newer } = await overlapping(view, boundary);
      gate.completed.resolve();
      await Promise.all([older, newer]);
      assertReady(view, view.a);
      assertReady(view, view.b);
      assertSharedFace(view);
      assert.equal(
        view.constructed.length,
        1,
        'The two current consumers share the same compatible face.',
      );
    },
  );
}

test(
  'a later narrow snapshot cannot shrink a face still serving a wider current surface',
  options,
  async (t) => {
    const view = await harness(t, ['wide', 'narrowed']);
    await view.draw(view.b, view.snapshots.wide, 'ui');
    const face = assertSharedFace(view),
      wider = frozenSurface(view.b);
    await view.draw(view.a, view.snapshots.narrowed);
    assertReady(view, view.a);
    assert.equal(assertSharedFace(view), face);
    assertUnchanged(view, view.b, wider);
  },
);

for (const boundary of ['bytes', 'load']) {
  for (const cancelled of ['narrow', 'wide']) {
    for (const outcome of ['success', 'failure']) {
      test(
        `cancel ${cancelled} consumer during shared ${boundary}; late ${outcome} respects both owners`,
        options,
        async (t) => {
          const view = await harness(t);
          const { gate, older, newer } = await overlapping(view, boundary);
          const abandoned = cancelled === 'narrow' ? view.a : view.b;
          const live = cancelled === 'narrow' ? view.b : view.a;
          abandoned.cancel.onclick();
          assert.equal(abandoned.status.dataset.state, 'detached');
          assert.equal(abandoned.element.getAttribute('aria-busy'), 'false');
          const kept = frozenSurface(abandoned);
          if (outcome === 'failure')
            gate.completed.reject(new Error('Fixture font preparation failed.'));
          else gate.completed.resolve();
          await Promise.all([older, newer]);
          assertUnchanged(view, abandoned, kept);
          if (outcome === 'success') {
            assertReady(view, live);
            assertSharedFace(view);
          } else {
            assert.equal(live.status.dataset.state, 'error');
            assert.match(statusText(live.status), /Fixture font preparation failed/);
            assert.equal(live.cancel.textContent, 'Retry preview');
            assert.equal(live.element.getAttribute('aria-busy'), 'false');
            assert.equal(view.registered.size, 0);
            // Real recovery action, not a cache reset or new module import.
            await view.remember(live.cancel.onclick());
            assertReady(view, live);
            assertSharedFace(view, cancelled === 'narrow' ? 400 : 600, 600);
            assertUnchanged(view, abandoned, kept);
          }
          // The cancelled observer can deliberately retry after shared settlement.
          await view.remember(abandoned.cancel.onclick());
          assertReady(view, abandoned);
          assertReady(view, live);
          assertSharedFace(view);
        },
      );
    }
  }
}

test(
  'a failed shared FontFace.load can retry without cache reset and register one successful face',
  options,
  async (t) => {
    const view = await harness(t);
    const { gate, older, newer } = await overlapping(view, 'load');
    gate.completed.reject(new Error('Fixture font decoder rejected the bytes.'));
    await Promise.all([older, newer]);
    for (const surface of [view.a, view.b]) {
      assert.equal(surface.status.dataset.state, 'error');
      assert.match(statusText(surface.status), /Fixture font decoder rejected/);
      assert.equal(surface.element.getAttribute('aria-busy'), 'false');
    }
    assert.equal(view.registrations.length, 0);
    await view.remember(view.b.cancel.onclick());
    assertReady(view, view.b);
    const face = assertSharedFace(view),
      wider = frozenSurface(view.b);
    await view.remember(view.a.cancel.onclick());
    assertReady(view, view.a);
    assert.equal(assertSharedFace(view), face);
    assertUnchanged(view, view.b, wider);
  },
);

test(
  'a rejected weight setter preserves the loaded narrow face and permits a real widening Retry',
  options,
  async (t) => {
    const view = await harness(t);
    await view.draw(view.a, view.snapshots.narrow);
    const face = assertSharedFace(view, 600, 600),
      older = frozenSurface(view.a);
    const priorWeight = face.weight,
      priorCalls = { ...view.calls };
    view.rejectNextWeightUpdate();
    await view.draw(view.b, view.snapshots.wide, 'ui');
    assert.equal(view.b.status.dataset.state, 'error');
    assert.match(statusText(view.b.status), /Fixture font weight update was rejected/);
    assert.equal(view.b.cancel.textContent, 'Retry preview');
    assert.equal(view.b.element.querySelectorAll('.font-file-sample').length, 0);
    assert.equal(
      face.weight,
      priorWeight,
      'A rejected API update preserves the loaded descriptor.',
    );
    assert.equal(assertSharedFace(view, 600, 600), face);
    assertUnchanged(view, view.a, older);
    await view.remember(view.b.cancel.onclick());
    assertReady(view, view.b);
    assert.equal(
      assertSharedFace(view),
      face,
      'Retry widens the existing successful registration.',
    );
    assert.deepEqual(
      view.calls,
      priorCalls,
      'A descriptor retry does not reread or reload these bytes.',
    );
    assertUnchanged(view, view.a, older);
  },
);

test(
  'repeated equal and narrower role requests reuse the loaded face without another byte read or load',
  options,
  async (t) => {
    const view = await harness(t, ['narrow', 'wide', 'narrowed']);
    await view.draw(view.b, view.snapshots.wide, 'ui');
    const face = assertSharedFace(view),
      wider = frozenSurface(view.b);
    const priorCalls = { ...view.calls };
    for (const [snapshot, role] of [
      [view.snapshots.narrow, 'display'],
      [view.snapshots.wide, 'ui'],
      [view.snapshots.narrowed, 'display'],
      [view.snapshots.narrowed, 'display'],
      [view.snapshots.wide, 'ui'],
    ]) {
      await view.draw(view.a, snapshot, role);
      assertReady(view, view.a);
      assert.equal(assertSharedFace(view), face);
      assert.deepEqual(view.calls, priorCalls);
      assertUnchanged(view, view.b, wider);
    }
  },
);
