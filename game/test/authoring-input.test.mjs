import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import {
  createGridEditorAdapter,
  registerAuthoringEditor,
  resolveAuthoringEditor,
} from '../ui/authoring-editors.mjs';
import {
  acceptsAuthoringFile,
  createAuthoringSourcePicker,
  deliverAuthoringFile,
} from '../ui/authoring-sources.mjs';
import { attachAuthoringPreview, mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';

function fixture() {
  const doc = new Document();
  const win = new Events(),
    frames = new Map();
  let serial = 0;
  Object.assign(win, {
    location: new URL('http://localhost/game/creator/'),
    File,
    Event,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    DataTransfer: class {
      files = [];
      items = { add: (file) => this.files.push(file) };
    },
    focus() {
      doc.focused = true;
    },
  });
  doc.defaultView = { ...doc.defaultView, ...win };
  doc.body.prepend = (...nodes) => doc.body.append(...nodes);
  const node = (tag, id) => {
    const value = new Element(doc, tag);
    value.id = id;
    doc.body.append(value);
    return value;
  };
  const tick = () => {
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, callback]) => callback(serial * 16));
  };
  return { doc, win, node, tick, frames };
}

test('grid editing bounds its cursor, commits only on confirm, and cancels an unfinished anchor before leaving', () => {
  const { node } = fixture(),
    element = node('canvas', 'map');
  let cursor = [1, 1],
    edits = 0,
    anchored = true;
  const adapter = createGridEditorAdapter({
    element,
    dimensions: () => [3, 2],
    position: () => cursor,
    move: (next) => {
      cursor = next;
    },
    apply: () => edits++,
    cancel: () => {
      const previous = anchored;
      anchored = false;
      return previous;
    },
  });
  assert.equal(adapter.enter(), true);
  adapter.handle({ direction: 'down' });
  adapter.handle({ direction: 'right' });
  adapter.handle({ direction: 'right' });
  assert.deepEqual(cursor, [2, 1]);
  assert.equal(edits, 0);
  adapter.handle({ confirm: true });
  assert.equal(edits, 1);
  assert.equal(adapter.handle({ back: true }), undefined);
  assert.equal(adapter.handle({ back: true }), 'cancel');
  adapter.exit({ commit: false });
  assert.equal(adapter.isCurrent(), false);
});

test('keyboard and controller registration share domain commands without synthetic key dispatch', () => {
  const { node } = fixture(),
    element = node('canvas', 'grid');
  let cursor = [0, 0],
    edited = null;
  const adapter = createGridEditorAdapter({
    element,
    dimensions: () => [4, 3],
    position: () => cursor,
    move: (next) => {
      cursor = next;
    },
    apply: () => {
      edited = [...cursor];
    },
  });
  const remove = registerAuthoringEditor(element, adapter, { keyboard: true });
  element.emit('keydown', { key: 'ArrowRight' });
  element.emit('keydown', { key: 'ArrowDown' });
  element.emit('keydown', { key: ' ' });
  assert.deepEqual(edited, [1, 1]);
  assert.equal(resolveAuthoringEditor(element), adapter);
  remove();
  assert.equal(resolveAuthoringEditor(element), null);
  assert.equal(element.getAttribute('data-controller-editor'), null);
});

test('source chooser respects accept types and passes the exact File through the existing change handler', () => {
  const { doc, win, node } = fixture(),
    input = node('input', 'picture');
  input.type = 'file';
  input.accept = 'image/png,.webp';
  const picture = new File(['original bytes'], 'picture.png', { type: 'image/png' });
  let received = null;
  input.onchange = () => {
    received = input.files[0];
  };
  assert.equal(acceptsAuthoringFile(input.accept, picture), true);
  assert.equal(acceptsAuthoringFile(input.accept, { name: 'clip.mp4', type: 'video/mp4' }), false);
  assert.equal(deliverAuthoringFile(input, picture, win), true);
  assert.equal(received, picture);
  input.disabled = true;
  assert.equal(deliverAuthoringFile(input, picture, win), false);
  assert.equal(doc.activeElement, doc.body);
});

test('a cancelled source download cannot deliver after the chooser closes', async () => {
  const { doc, win, node } = fixture(),
    input = node('input', 'picture');
  input.type = 'file';
  input.accept = 'image/png';
  let finish,
    changes = 0;
  win.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  input.onchange = () => changes++;
  const picker = createAuthoringSourcePicker({ document: doc, window: win });
  picker.open(input);
  const example = [...picker.dialog.querySelectorAll('button')].find(
    (button) => button.textContent === 'Dawn Signal picture',
  );
  const pending = example.onclick();
  picker.close();
  finish({
    ok: true,
    headers: { get: () => '4' },
    blob: async () => new Blob(['test'], { type: 'image/png' }),
  });
  await pending;
  assert.equal(changes, 0);
  assert.equal(doc.activeElement, input);
  picker.destroy();
});

test('one authoring host owns one poller, suspends for preview focus, and releases all input on disposal', () => {
  const { doc, win, tick, frames, node } = fixture();
  node('button', 'first');
  let samples = 0,
    handled = 0,
    clears = 0,
    destroyed = 0;
  const options = {
    document: doc,
    window: win,
    createRouter: () => ({
      sample: () => {
        samples++;
        return { ui: { direction: 'right' } };
      },
      clear: () => clears++,
      destroy: () => destroyed++,
    }),
    createNavigation: () => ({
      handle: () => handled++,
      clear() {},
      sync() {},
      destroy: () => destroyed++,
    }),
  };
  const host = mountAuthoringInputHost(options);
  assert.equal(mountAuthoringInputHost(options), host);
  assert.equal(frames.size, 1);
  tick();
  assert.equal(samples, 1);
  assert.equal(handled, 1);
  doc.activeElement = { tagName: 'IFRAME' };
  tick();
  assert.equal(samples, 1);
  assert(clears > 0);
  doc.activeElement = doc.body;
  doc.hidden = true;
  tick();
  assert.equal(samples, 1);
  host.destroy();
  assert.equal(frames.size, 0);
  assert.equal(destroyed, 2);
});

test('preview boot cannot steal input before explicit entry, and Return restores the editor', () => {
  const { doc, win, node } = fixture();
  const frame = node('iframe', 'preview');
  const child = new Document();
  const first = child.createElement('button');
  first.textContent = 'Game menu';
  child.body.append(first);
  frame.contentDocument = child;
  frame.contentWindow = { focus() {} };
  frame.before = (element) => doc.body.append(element);
  doc.activeElement = frame;
  const preview = attachAuthoringPreview(frame, { document: doc, window: win });
  const enter = doc.querySelector('.authoring-preview-enter');
  const back = child.querySelector('.authoring-preview-return');
  assert.equal(doc.activeElement, enter);
  enter.onclick();
  assert.equal(doc.activeElement, frame);
  assert.equal(child.activeElement, first);
  back.onclick();
  assert.equal(doc.activeElement, enter);
  preview.destroy();
  assert.equal(back.isConnected, false);
});
