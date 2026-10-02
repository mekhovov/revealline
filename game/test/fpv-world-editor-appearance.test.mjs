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
