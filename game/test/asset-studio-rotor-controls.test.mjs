import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { setLocale, t } from '../i18n/index.mjs';
import {
  editStudioRotorAnchor,
  mountStudioRotorControls,
} from '../../authoring/asset-studio/rotor-controls.mjs';

function fixture() {
  const bundle = createDefaultThemeBundle();
  const slot = bundle.slots.find((entry) => entry.id === 'player.scout.compact');
  const asset = {
    ...resolvePresentation(bundle).assets[slot.id],
    kind: 'image',
    recipe: null,
    geometry: structuredClone(slot.geometry),
    file: { sha256: 'a'.repeat(64), bytes: 1, mime: 'image/png', width: 32, height: 32 },
  };
  return { slot, asset };
}
const values = (anchor, overrides = {}) => ({
  x: String(anchor.x),
  y: String(anchor.y),
  radius: String(anchor.radius),
  direction: Object.hasOwn(anchor, 'direction') ? String(anchor.direction) : 'inherit',
  phaseDegrees: Object.hasOwn(anchor, 'phaseDegrees') ? String(anchor.phaseDegrees) : '',
  ...overrides,
});

test('untouched historical anchors retain exact JSON and effective runtime defaults', () => {
  const { asset } = fixture(),
    before = JSON.stringify(asset);
  const anchors = editStudioRotorAnchor(asset, 1, values(asset.geometry.rotorAnchors[1]));
  assert.equal(JSON.stringify(anchors), JSON.stringify(asset.geometry.rotorAnchors));
  assert.equal(JSON.stringify(asset), before);
  assert.deepEqual(
    imagePresentation({ ...asset, geometry: { ...asset.geometry, rotorAnchors: anchors } }).rotors,
    imagePresentation(asset).rotors,
  );
  assert.equal(Object.hasOwn(anchors[1], 'direction'), false);
  assert.equal(Object.hasOwn(anchors[1], 'phaseDegrees'), false);
});

test('one explicit hub keeps blade count and other anchors, and can return to inheritance', () => {
  const { asset } = fixture(),
    original = structuredClone(asset);
  const anchors = editStudioRotorAnchor(
    asset,
    1,
    values(asset.geometry.rotorAnchors[1], {
      x: '0.7',
      radius: '0.15',
      direction: '1',
      phaseDegrees: '0',
    }),
  );
  assert.deepEqual(anchors[1], {
    x: 0.7,
    y: 0.25,
    radius: 0.15,
    blades: 3,
    direction: 1,
    phaseDegrees: 0,
  });
  for (const index of [0, 2, 3])
    assert.deepEqual(anchors[index], original.geometry.rotorAnchors[index]);
  asset.geometry.rotorAnchors = anchors;
  const inherited = editStudioRotorAnchor(
    asset,
    1,
    values(anchors[1], { direction: 'inherit', phaseDegrees: '' }),
  );
  const rendered = imagePresentation({
    ...asset,
    geometry: { ...asset.geometry, rotorAnchors: inherited },
  });
  assert.equal(rendered.rotors[1].direction, -1);
  assert.equal(rendered.rotors[1].phaseDegrees, 23);
  assert.equal(Object.hasOwn(inherited[1], 'phaseDegrees'), false);
  assert.equal(
    Object.hasOwn(asset.geometry.rotorAnchors[1], 'phaseDegrees'),
    true,
    'input record stays unchanged',
  );
});

test('production validation rejects clipping, duplicate centers and unknown anchor fields without mutation', () => {
  const { asset } = fixture();
  const before = structuredClone(asset),
    base = values(asset.geometry.rotorAnchors[0]);
  assert.throws(() => editStudioRotorAnchor(asset, 0, { ...base, x: '0.05' }), /envelope exceeds/);
  assert.throws(() => editStudioRotorAnchor(asset, 0, { ...base, x: '0.75' }), /Duplicate rotor/);
  const unknown = structuredClone(asset);
  unknown.geometry.rotorAnchors[2].spin = 'future';
  assert.throws(
    () => editStudioRotorAnchor(unknown, 0, base),
    /rotor anchor\.spin is not supported/,
  );
  assert.equal(unknown.geometry.rotorAnchors[2].spin, 'future');
  assert.deepEqual(asset, before);
});

test('invalid numeric, direction and phase inputs never coerce to a silently accepted rig', () => {
  const { asset } = fixture(),
    base = values(asset.geometry.rotorAnchors[0]);
  for (const update of [
    { x: '' },
    { y: 'NaN' },
    { radius: 'Infinity' },
    { radius: '0' },
    { direction: '0' },
    { direction: 'clockwise' },
    { phaseDegrees: '-1' },
    { phaseDegrees: '360' },
    { phaseDegrees: 'NaN' },
  ])
    assert.throws(() => editStudioRotorAnchor(asset, 0, { ...base, ...update }));
  assert.throws(() => editStudioRotorAnchor(asset, 8, base), /existing motor hub/);
});

function controls({ onApply = () => {} } = {}) {
  const document = new Document();
  for (const [id, tag] of [
    ['controls', 'section'],
    ['controls-status', 'p'],
    ['hub', 'select'],
    ['x', 'input'],
    ['y', 'input'],
    ['radius', 'input'],
    ['direction', 'select'],
    ['phase', 'input'],
    ['apply', 'button'],
  ]) {
    const element = document.createElement(tag);
    element.id = `rotor-${id}`;
    document.body.append(element);
  }
  let context = { ...fixture(), owner: {}, geometryText: 'accepted geometry text' };
  const errors = [];
  const controller = mountStudioRotorControls({
    document,
    getContext: () => context,
    onApply,
    onError: (error) => errors.push(error),
  });
  return {
    document,
    controller,
    errors,
    get context() {
      return context;
    },
    set context(value) {
      context = value;
    },
    $: (id) => document.getElementById(`rotor-${id}`),
  };
}

test('hub selection shows actual inherited phase and advanced text must be applied first', async () => {
  let accepted = 0;
  const h = controls({ onApply: () => accepted++ });
  h.$('hub').value = '1';
  h.$('hub').onchange();
  assert.equal(h.$('direction').value, 'inherit');
  assert.equal(h.$('phase').value, '');
  assert.match(h.$('controls-status').textContent, /Counterclockwise.*23°/);
  h.context.geometryText = '{ malformed advanced edit';
  await h.$('apply').onclick();
  assert.equal(accepted, 0);
  assert.match(h.errors[0].message, /Apply the advanced geometry edits first/);
  assert.equal(h.context.geometryText, '{ malformed advanced edit');
  h.controller.dispose();
});

test('late control work cannot adopt old anchors after a new preparation refreshes the panel', async () => {
  let release,
    accepted = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const h = controls({
    onApply: async (_anchors, checkCurrent) => {
      await gate;
      checkCurrent();
      accepted++;
    },
  });
  const previous = h.context.asset;
  h.$('x').value = '0.3';
  const applying = h.$('apply').onclick();
  h.context = { ...fixture(), owner: {}, geometryText: 'new prepared geometry' };
  h.controller.refresh();
  release();
  await applying;
  assert.equal(accepted, 0);
  assert.match(h.errors[0].message, /earlier prepared image/);
  assert.equal(h.context.asset.geometry.rotorAnchors[0].x, 0.25);
  assert.equal(previous.geometry.rotorAnchors[0].x, 0.25);
  h.controller.dispose();
});

test('no-anchor images disable controls, nonimages hide them, and disposal rejects retained actions', async () => {
  let accepted = 0;
  const h = controls({ onApply: () => accepted++ });
  h.context.asset.geometry.rotorAnchors = [];
  h.controller.refresh();
  assert.equal(h.$('controls').hidden, false);
  assert.equal(h.$('apply').disabled, true);
  assert.match(h.$('controls-status').textContent, /no motor hubs/);
  h.context.asset = { kind: 'recipe' };
  h.controller.refresh();
  assert.equal(h.$('controls').hidden, true);
  assert.equal(h.$('hub').disabled, true);
  const oldAction = h.$('apply').onclick;
  h.controller.dispose();
  await oldAction();
  assert.equal(accepted, 0);
  assert.equal(h.$('apply').onclick, null);
});

test('classic EN/UK catalogs resolve inherited motion copy without raw keys', (context) => {
  context.after(() => setLocale('en', { persist: false }));
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    const h = controls();
    for (const key of [
      'heading',
      'help',
      'hub',
      'radius',
      'x',
      'y',
      'direction',
      'phase',
      'apply',
      'inherit',
    ])
      assert.notEqual(t(`tools:studio.rotors.${key}`), `studio.rotors.${key}`);
    assert.doesNotMatch(h.$('controls-status').textContent, /studio\.rotors\.|\{\{/);
    assert.match(h.$('controls-status').textContent, /0°/);
    h.controller.dispose();
  }
});
