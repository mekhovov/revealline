import test from 'node:test';
import assert from 'node:assert/strict';
import { mountTitleCharacter } from '../ui/title-character.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture(t) {
  const document = new Document(),
    container = document.createElement('div'),
    calls = [],
    original = document.createElement.bind(document);
  let clears = 0;
  t.mock.method(document, 'createElement', (tag) => {
    const element = original(tag);
    if (tag === 'canvas') element.getContext = () => ({ clearRect: () => clears++ });
    return element;
  });
  document.body.append(container);
  container.prepend = (...nodes) => container.replaceChildren(...nodes, ...container.children);
  const body = Object.freeze({
      src: 'registered.png',
      widthCells: 2,
      heightCells: 2,
      bodyMotion: Object.freeze({ kind: 'rigid-spin', radiansPerSecond: 4, travelGain: 0 }),
    }),
    recipe = Object.freeze({ components: Object.freeze([]) }),
    image = Object.freeze({ width: 256, height: 256 });
  let character = { body, recipe, image, bodyColor: '#ffffff', accentColor: '#333333' };
  const view = mountTitleCharacter({
    container,
    getCharacter: () => character,
    paint: (_, value) => calls.push(value),
  });
  return {
    view,
    container,
    calls,
    body,
    image,
    recipe,
    set: (value) => (character = value),
    clears: () => clears,
  };
}

test('title character reuses the exact selected image without mutating presets or scheduling another clock', (t) => {
  const f = fixture(t),
    before = JSON.stringify(f.body);
  f.view.update(1 / 60, { visible: true });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].image, f.image);
  assert.equal(f.calls[0].body, f.body);
  assert.equal(f.calls[0].recipe, f.recipe);
  assert.equal(f.container.querySelector('canvas').getAttribute('aria-hidden'), 'true');
  for (let index = 0; index < 120; index++) f.view.update(1 / 120, { visible: true });
  assert(f.calls.length >= 29 && f.calls.length <= 32, 'decorative drawing is bounded near 30 Hz');
  assert(f.calls.at(-1).heading > f.calls[0].heading);
  assert.equal(JSON.stringify(f.body), before);
});

test('closed or background home does no drawing and reduced motion is a static upright pose', (t) => {
  const f = fixture(t);
  f.view.update(0.01, { visible: true });
  for (let index = 0; index < 100; index++) f.view.update(100, { visible: false });
  assert.equal(f.calls.length, 1);
  assert.equal(f.container.querySelector('canvas').hidden, true);
  f.view.update(0, { visible: true, reduced: true });
  assert.equal(f.calls.at(-1).heading, 0);
  const count = f.calls.length;
  for (let index = 0; index < 100; index++) f.view.update(1, { visible: true, reduced: true });
  assert.equal(f.calls.length, count);
  f.view.update(0.04, { visible: true, reduced: false });
  assert.equal(f.calls.length, count + 1);
});

test('missing exact artwork stays hidden, selected image changes redraw, and twenty lifetimes release DOM ownership', (t) => {
  const f = fixture(t);
  f.set({ body: f.body, recipe: f.recipe, image: null });
  f.view.update(0, { visible: true });
  assert.equal(f.calls.length, 0);
  assert.equal(f.container.querySelector('canvas').hidden, true);
  f.set({ body: f.body, recipe: f.recipe, image: f.image });
  f.view.update(0, { visible: true, reduced: true });
  const replacement = { width: 128, height: 128 };
  f.set({ body: f.body, recipe: f.recipe, image: replacement });
  f.view.update(0, { visible: true, reduced: true });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls.at(-1).image, replacement);
  f.view.dispose();
  f.view.dispose();
  f.view.update(1, { visible: true });
  assert.equal(f.calls.length, 2);
  assert.equal(f.container.querySelector('canvas'), null);
  for (let cycle = 0; cycle < 20; cycle++) {
    const viewer = mountTitleCharacter({ container: f.container, getCharacter: () => null });
    viewer.dispose();
    assert.equal(f.container.children.length, 0);
  }
});
