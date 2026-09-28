import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Document } from './helpers/couch-dom.mjs';
import {
  rotorAnchors,
  validateAnimationRecipes,
  advanceAnimation,
  createAnimationState,
} from '../../authoring/motion-lab/animation.mjs';
import { freezeMotionPresets } from '../../authoring/motion-lab/copy.mjs';
import {
  validateRotorRig,
  rotorRigJSON,
  createRotorDraft,
  readRotorDraft,
  editRotorHub,
  rotorHubReview,
  rotorSamplingRecipe,
  createRotorEditor,
} from '../../authoring/motion-lab/rotor-editor.mjs';

const presets = freezeMotionPresets(
  JSON.parse(
    readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url), 'utf8'),
  ),
);

test('every historical Motion rig round-trips through the existing rotors array without rewriting defaults', () => {
  for (const [id, body] of Object.entries(presets.characters)) {
    const draft = createRotorDraft(id, body),
      restored = readRotorDraft(draft, draft.source, id, body);
    assert.deepEqual(restored, body.rotors);
    assert.notEqual(restored, body.rotors);
    const next = structuredClone(presets);
    next.characters[id].rotors = restored;
    validateAnimationRecipes(next);
  }
});

test('editing one tuple preserves its index direction, phase, anchors and radius and leaves other records verbatim', () => {
  const source = freezeMotionPresets([[-0.2, -0.1, 0.16], [0.3, 0.2, 0.2], { x: 0, y: 0 }]),
    edited = editRotorHub(source, 1, { phaseDegrees: -12.5 });
  assert.deepEqual(edited[0], source[0]);
  assert.deepEqual(edited[2], source[2]);
  assert.deepEqual(edited[1], {
    x: 0.3,
    y: 0.2,
    radiusScale: 1.25,
    direction: -1,
    phaseDegrees: -12.5,
  });
  const restored = JSON.parse(rotorRigJSON(edited));
  assert.deepEqual(rotorAnchors({ rotors: restored })[2], {
    x: 0,
    y: 0,
    radiusScale: 1,
    direction: 1,
    phaseDegrees: 0,
  });
  assert.equal(source[1].length, 3);
});

test('review composes actual recipe signs, offsets and per-hub blade counts without signing phase twice', () => {
  const body = { rotors: [{ x: 0.1, y: -0.2, direction: -1, phaseDegrees: 31, bladeCount: 4 }] },
    recipe = {
      components: [
        { id: 'backward', type: 'rotors', direction: -1, phaseDegrees: -23, bladeCount: 2 },
        { id: 'forward', type: 'rotors', direction: 1, phaseDegrees: 17, bladeCount: 3 },
        { id: 'light', type: 'blink' },
      ],
    };
  assert.deepEqual(rotorHubReview(body, recipe)[0].components, [
    { id: 'backward', direction: 1, phaseDegrees: 8, bladeCount: 4 },
    { id: 'forward', direction: -1, phaseDegrees: 48, bladeCount: 4 },
  ]);
});

test('malformed, unknown and out-of-bounds rotor edits fail before any accepted rig changes', () => {
  const valid = { x: 0.1, y: -0.2 };
  for (const invalid of [
    null,
    {},
    [null],
    [[0, 0]],
    [[0, 0, '0.16']],
    [[0, 0, 0.5]],
    Array.from({ length: 9 }, () => valid),
    [{ ...valid, z: 0 }],
    ...['0', 0, 2, null].map((direction) => [{ ...valid, direction }]),
    ...[361, -361, Infinity, NaN, null].map((phaseDegrees) => [{ ...valid, phaseDegrees }]),
    [{ ...valid, x: 0.7 }],
    [{ ...valid, y: '0' }],
    [{ ...valid, bladeCount: 5 }],
    [{ ...valid, radiusScale: 0 }],
    [{ y: 0 }],
  ])
    assert.throws(() => validateRotorRig(invalid), /invalid/);
  const body = { rotors: [valid] },
    draft = createRotorDraft('sample', body);
  for (const raw of ['{bad', ' '.repeat(16385), '[{"__proto__":{},"x":0,"y":0}]'])
    assert.throws(() => readRotorDraft(draft, raw, 'sample', body), /invalid/);
  assert.throws(() => editRotorHub(body.rotors, 0, { x: 0.2 }), /invalid/);
  assert.deepEqual(body.rotors, [valid]);
});

test('stale body or rig drafts cannot overwrite a newer accepted rig', () => {
  const body = { rotors: [[0.1, 0.2, 0.16]] },
    draft = createRotorDraft('first', body);
  assert.throws(() => readRotorDraft(draft, draft.source, 'second', body), /stale/);
  const changed = { rotors: editRotorHub(body.rotors, 0, { direction: -1 }) };
  assert.throws(() => readRotorDraft(draft, draft.source, 'first', changed), /stale/);
  assert.equal(changed.rotors[0].direction, -1);
});

test('mixed imported blade counts constrain phase sampling without rewriting rendered fallback counts', () => {
  const body = {
      rotors: [
        { x: 0, y: 0, bladeCount: 4 },
        { x: 0.2, y: 0.2 },
      ],
    },
    recipe = presets.animationRecipes['fpv-tri'],
    sampled = rotorSamplingRecipe(body, recipe),
    animation = advanceAnimation(
      createAnimationState(),
      sampled,
      { visualSpeed: 9, cruiseSpeed: 9 },
      0.25,
    );
  assert.equal(recipe.components[0].bladeCount, 3);
  assert.equal(sampled.components[0].bladeCount, 4);
  assert.ok(animation.phases.propellers < ((Math.PI * 2) / 4) * 0.25);
  assert.equal(rotorHubReview(body, recipe)[1].components[0].bladeCount, 3);
});

function editorFixture() {
  const doc = new Document(),
    elements = Object.fromEntries(
      [
        'root',
        'hub',
        'direction',
        'phase',
        'json',
        'apply',
        'reset',
        'export',
        'status',
        'summary',
      ].map((id) => [id, doc.createElement(id === 'hub' ? 'select' : 'input')]),
    ),
    original = freezeMotionPresets({
      rotors: [
        [-0.2, -0.1, 0.16],
        [0.3, 0.2, 0.2],
      ],
    }),
    recipe = {
      components: [{ type: 'rotors', id: 'motors', direction: 1, phaseDegrees: 17, bladeCount: 3 }],
    },
    downloads = [];
  let body = original,
    id = 'sample',
    changes = 0,
    reviews = 0;
  const editor = createRotorEditor({
    elements,
    getSelection: () => ({ id, body, recipe }),
    apply: (rotors) => {
      body = rotors === null ? original : { ...body, rotors };
      changes++;
    },
    listen: (element, event, handler) => element.addEventListener(event, handler),
    text: (key, values) => JSON.stringify({ key, ...values }),
    download: (text, name) => downloads.push({ text, name }),
    review: () => reviews++,
  });
  editor.refresh();
  return {
    elements,
    editor,
    original,
    recipe,
    downloads,
    get body() {
      return body;
    },
    get changes() {
      return changes;
    },
    get reviews() {
      return reviews;
    },
    select(next) {
      id = next;
    },
    change(key, value) {
      elements[key].value = value;
      elements[key].emit('change');
    },
  };
}

test('editor applies and exports the accepted rig, preserves an unsubmitted draft during refresh, and restores source', () => {
  const h = editorFixture();
  h.change('hub', '1');
  assert.equal(h.reviews, 1);
  assert.equal(h.elements.direction.value, '-1');
  h.change('phase', '12.5');
  assert.equal(h.body.rotors[1].phaseDegrees, 12.5);
  h.elements.json.value = '[invalid';
  h.editor.refresh();
  assert.equal(
    h.elements.json.value,
    '[invalid',
    'reading refresh never discards an unsubmitted draft',
  );
  h.elements.apply.click();
  assert.match(h.elements.status.textContent, /invalid/);
  assert.equal(h.changes, 1);
  h.elements.export.click();
  assert.equal(h.downloads[0].name, 'sample.rotors.json');
  assert.deepEqual(
    JSON.parse(h.downloads[0].text),
    h.body.rotors,
    'export uses the accepted rig, not invalid draft text',
  );
  h.elements.json.value = h.downloads[0].text;
  h.elements.apply.click();
  assert.equal(h.changes, 2);
  h.elements.reset.click();
  assert.equal(h.body, h.original);
  assert.deepEqual(JSON.parse(h.elements.json.value), h.original.rotors);
});

test('editor rejects a stale selection and hides rotor-only controls for non-rotor recipes', () => {
  const h = editorFixture();
  h.select('other');
  h.elements.apply.click();
  assert.match(h.elements.status.textContent, /stale/);
  h.change('phase', '180');
  assert.match(h.elements.status.textContent, /stale/);
  h.elements.reset.click();
  assert.match(h.elements.status.textContent, /stale/);
  assert.equal(h.changes, 0);
  h.editor.refresh();
  assert.equal(h.elements.root.hidden, false);
  h.recipe.components = [{ id: 'wings', type: 'wings' }];
  h.editor.refresh();
  assert.equal(h.elements.root.hidden, true);
});
