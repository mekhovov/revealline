import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountWorldEditor } from '../../optional-practice/civilian-fpv/world-editor.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';

test('spatial editor applies current presentation before every course build without changing authored source or scene bytes', async () => {
  const document = new Document(),
    window = new Events(),
    calls = [];
  Object.assign(window, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({ width: 640, height: 480 });
  const course = structuredClone(WORLD_CATALOGUE.find((entry) => !entry.legacy).course);
  const original = structuredClone(course);
  let desired = { collectionId: 'industrial-workshop', revision: 'r1' };
  const renderer = {
    available: true,
    setQuality() {},
    setPresentation(value) {
      calls.push(['presentation', value]);
    },
    setCourse(value, mode) {
      calls.push(['course', value, mode]);
    },
    async createEditor() {
      return { select() {} };
    },
    draw() {},
    async loadScene(bytes) {
      calls.push(['scene', bytes]);
      return bytes;
    },
    dispose() {},
  };
  const editor = mountWorldEditor({
    canvas,
    window,
    course,
    getPresentation: () => desired,
    rendererFactory: () => renderer,
  });
  try {
    await editor.ready;
    assert.deepEqual(calls.slice(0, 2), [
      ['presentation', desired],
      ['course', course, 'self-level'],
    ]);
    desired = { collectionId: 'authored', revision: 'r1' };
    editor.setCourse(course, 'acro');
    assert.deepEqual(calls.slice(-2), [
      ['presentation', desired],
      ['course', course, 'acro'],
    ]);
    const bytes = new Uint8Array([1, 2, 3]);
    await editor.loadScene(bytes);
    assert.equal(calls.at(-1)[1], bytes);
    assert.deepEqual(course, original);
  } finally {
    editor.dispose();
  }
});

test('spatial editor preserves an authenticated retained binding when a proposed drag is rejected', async () => {
  const { prepareNativeIndustrialAttempt } = await import(
    '../../optional-practice/civilian-fpv/industrial-environment.mjs'
  );
  const { resolveIndustrialEnvironment } = await import(
    '../presentation/industrial-environments.mjs'
  );
  const entry = WORLD_CATALOGUE.find((e) => e.id === 'native-pursuit-runner-court');
  const accepted = await prepareNativeIndustrialAttempt({
    entry,
    mode: 'acro',
    presentation: { collectionId: 'military-field', revision: 'r1' },
    artRevision: 'industrial-roster-v3',
  });
  const document = new Document(),
    window = new Events(),
    calls = [],
    errors = [];
  let controls;
  Object.assign(window, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({ width: 640, height: 480 });
  const renderer = {
    available: true,
    setQuality() {},
    setPresentation() {},
    setCourse(course, mode, options) {
      assert.equal(
        resolveIndustrialEnvironment(options.industrialEnvironment).artRevision,
        'industrial-roster-v3',
      );
      calls.push({ course, mode, options });
    },
    async createEditor(value) {
      controls = value;
      return { select() {} };
    },
    draw() {},
    dispose() {},
  };
  const editor = mountWorldEditor({
    canvas,
    window,
    rendererFactory: () => renderer,
    onChange() {
      throw new Error('Pinned source edit rejected');
    },
    onError: (error) => errors.push(error),
  });
  try {
    await editor.ready;
    const options = {
      industrialEnvironment: accepted.pin,
      artRevision: accepted.artRevision,
      presentation: { collectionId: 'military-field', revision: 'r1' },
    };
    editor.setCourse(accepted.course, 'acro', options);
    controls.onCommit({ kind: 'actor', id: 'pursuit-1', position: { x: 1, y: 0, z: 0 } });
    assert.equal(calls.length, 2);
    assert.equal(
      calls[1].options.industrialEnvironment,
      accepted.pin,
      'rollback retains branded rendering authority',
    );
    assert.equal(calls[1].course, accepted.course);
    assert.equal(calls[1].mode, 'acro');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Pinned source edit rejected/);
  } finally {
    editor.dispose();
  }
});

test('spatial editor offers bounded-renderer camera actions for radio menus without editing source', async () => {
  const document = new Document(),
    window = new Events(),
    calls = [];
  let frame,
    resolveControls,
    draws = 0;
  Object.assign(window, {
    requestAnimationFrame(callback) {
      frame = callback;
      return 1;
    },
    cancelAnimationFrame() {},
  });
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({ width: 640, height: 480 });
  const course = structuredClone(WORLD_CATALOGUE.find((entry) => !entry.legacy).course);
  const original = structuredClone(course);
  const editor = mountWorldEditor({
    canvas,
    window,
    course,
    rendererFactory: () => ({
      available: true,
      setQuality() {},
      setCourse() {},
      createEditor: () =>
        new Promise((resolve) => {
          resolveControls = resolve;
        }),
      draw() {
        draws++;
      },
      dispose() {
        calls.push(['dispose']);
      },
    }),
    onChange() {
      assert.fail('View actions must not change authored objects');
    },
  });
  assert.equal(editor.orbitView(40, -20), false);
  assert.equal(editor.zoomView(-120), false);
  assert.equal(editor.resetView(), false);
  resolveControls({
    select() {},
    orbit(...values) {
      calls.push(['orbit', ...values]);
    },
    zoom(...values) {
      calls.push(['zoom', ...values]);
    },
    home() {
      calls.push(['home']);
    },
  });
  await editor.ready;
  assert.equal(draws, 1);
  frame();
  assert.equal(draws, 1);
  assert.equal(editor.orbitView(40, -20), true);
  frame();
  assert.equal(draws, 2, 'View action requests a redraw without relying on pointer events');
  assert.equal(editor.zoomView(-120), true);
  assert.equal(editor.zoomView(120), true);
  assert.equal(editor.resetView(), true);
  assert.equal(editor.orbitView(Infinity, 0), false);
  assert.equal(editor.orbitView(0, NaN), false);
  assert.equal(editor.zoomView('120'), false);
  assert.deepEqual(calls, [['orbit', 40, -20], ['zoom', -120], ['zoom', 120], ['home']]);
  assert.deepEqual(course, original);
  editor.dispose();
  assert.equal(editor.orbitView(40, 0), false);
  assert.equal(editor.zoomView(120), false);
  assert.equal(editor.resetView(), false);
  assert.equal(calls.at(-1)[0], 'dispose');
});

test('unavailable spatial graphics cannot break later course or appearance form refreshes', async () => {
  const document = new Document(),
    window = new Events(),
    errors = [];
  const editor = mountWorldEditor({
    canvas: document.createElement('canvas'),
    window,
    rendererFactory: () => ({ available: false, dispose() {} }),
    onError: (error) => errors.push(error.message),
  });
  try {
    await assert.rejects(editor.ready, /WebGL is unavailable/);
    assert.doesNotThrow(() =>
      editor.setCourse(WORLD_CATALOGUE.find((entry) => !entry.legacy).course),
    );
    assert.doesNotThrow(() => editor.setRouteGuide(null));
    assert.equal(errors.length, 1);
  } finally {
    editor.dispose();
  }
});
