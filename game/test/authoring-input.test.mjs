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
import { mountPageInputHost } from '../ui/page-input-host.mjs';
import { getLocale, localizedText, onLocaleChange, setLocale } from '../i18n/index.mjs';

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
      cancelConfirm() {},
      clear() {},
      sync() {},
      destroy: () => destroyed++,
    }),
  };
  const host = mountAuthoringInputHost(options);
  assert.equal(mountAuthoringInputHost(options), host);
  assert.equal(mountPageInputHost(options), host);
  assert.ok(host.sources, 'The authoring wrapper retains its source-picker capability.');
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
  frame.contentWindow = Object.assign(new Events(), { focus() {} });
  child.parentNode = frame.contentWindow;
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

test('late preview boot preserves newer editor focus, explicit entry owns the child, and cleanup releases the focus guard', () => {
  const { doc, win, node } = fixture(),
    field = node('input', 'edited-source'),
    frame = node('iframe', 'preview'),
    child = new Document(),
    first = child.createElement('button');
  child.body.append(first);
  frame.contentDocument = child;
  frame.contentWindow = Object.assign(new Events(), { focus() {} });
  child.parentNode = frame.contentWindow;
  frame.before = (element) => doc.body.append(element);
  const preview = attachAuthoringPreview(frame, { document: doc, window: win }),
    enter = doc.querySelector('.authoring-preview-enter');
  assert.equal(frame.getAttribute('tabindex'), '-1', 'Enter preview is the native Tab entry point');
  field.focus();
  let childActions = 0;
  first.addEventListener('keydown', () => childActions++);
  const lateBootFocus = () => {
    // Native iframe ownership changes before the child's focusin dispatch.
    doc.activeElement = frame;
    first.focus();
    first.emit('focusin');
  };
  lateBootFocus();
  assert.equal(doc.activeElement, field, 'late asynchronous boot restores the editor control');
  const queuedEnter = first.emit('keydown', { key: 'Enter' });
  assert.equal(queuedEnter.defaultPrevented, true);
  assert.equal(childActions, 0, 'queued child Enter stays unowned after parent focus was restored');
  assert.equal(
    doc.activeElement,
    field,
    'discarding a queued child key preserves the newer parent owner',
  );
  doc.activeElement = frame;
  frame.contentWindow.emit('focus');
  assert.equal(doc.activeElement, field, 'a late child window focus needs no element focusin');
  doc.activeElement = frame;
  const unenteredEnter = first.emit('keydown', { key: 'Enter' });
  assert.equal(unenteredEnter.defaultPrevented, true);
  assert.equal(childActions, 0, 'window capture consumes unentered Enter before game handlers');
  assert.equal(doc.activeElement, field);
  enter.onclick();
  first.emit('focusin');
  assert.equal(doc.activeElement, frame, 'explicit Enter yields ownership to the child');
  first.emit('keydown', { key: 'Enter' });
  assert.equal(childActions, 1, 'explicit entry retains the child input owner');
  child.querySelector('.authoring-preview-return').onclick();
  lateBootFocus();
  assert.equal(doc.activeElement, enter, 'late refocus cannot undo Return');
  first.emit('pointerdown', { button: 0, isPrimary: true });
  lateBootFocus();
  assert.equal(doc.activeElement, frame, 'deliberate pointer entry still owns the child');
  field.focus();
  doc.focused = false;
  lateBootFocus();
  assert.equal(doc.activeElement, frame, 'background boot cannot activate its parent window');
  doc.focused = true;
  preview.destroy();
  assert.equal(
    frame.getAttribute('tabindex'),
    null,
    'destroy restores original frame tab behavior',
  );
  lateBootFocus();
  assert.equal(doc.activeElement, frame, 'destroy removes the child listener');
});

test('section headings can target a real control inside their own region without opening or changing it', () => {
  const { doc, win, node } = fixture(),
    section = node('section', 'configuration'),
    first = doc.createElement('button'),
    heading = doc.createElement('h2'),
    canvas = doc.createElement('canvas'),
    outside = node('button', 'outside');
  node('main', 'authoring-main').append(section);
  canvas.id = 'board';
  canvas.setAttribute('data-controller-editor', 'true');
  heading.textContent = 'Paint the board';
  heading.dataset.authoringTarget = 'board';
  section.append(first, heading, canvas);
  let activations = 0;
  canvas.onclick = () => activations++;
  const host = mountPageInputHost({ document: doc, window: win });
  doc.querySelector('.authoring-input-rail button').click();
  const sections = doc.querySelector('.authoring-sections-dialog'),
    jump = [...sections.querySelectorAll('button')].find(
      (button) => button.textContent === heading.textContent,
    );
  assert.ok(jump);
  jump.click();
  assert.equal(doc.activeElement, canvas);
  assert.equal(activations, 0);
  heading.dataset.authoringTarget = outside.id;
  doc.querySelector('.authoring-input-rail button').click();
  [...sections.querySelectorAll('button')]
    .find((button) => button.textContent === heading.textContent)
    .click();
  assert.equal(doc.activeElement, first, 'a heading cannot redirect to an unrelated region');
  host.destroy();
});

test('open Sections follows EN/UK/EN in its accessible names and destinations without changing focus or activating controls', () => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  const { doc, win, node } = fixture(),
    main = node('main', 'workspace'),
    section = node('section', 'response'),
    heading = node('h2', 'response-heading'),
    input = node('input', 'speed');
  input.type = 'range';
  input.value = '9.5';
  main.append(section);
  section.append(heading, input);
  localizedText(heading, () => (getLocale() === 'uk' ? 'Реакція' : 'Response'));
  let changes = 0;
  input.oninput = input.onchange = () => changes++;
  const host = mountPageInputHost({ document: doc, window: win, readPads: () => [] }),
    rail = doc.querySelector('.authoring-input-rail'),
    open = rail.querySelector('button'),
    dialog = doc.querySelector('.authoring-sections-dialog');
  try {
    input.focus();
    open.click();
    const controls = [...dialog.querySelectorAll('button')],
      [back, , jump] = controls;
    for (const locale of ['en', 'uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.equal(
        rail.getAttribute('aria-label'),
        locale === 'uk' ? 'Навігація редактора' : 'Editor navigation',
      );
      assert.equal(dialog.getAttribute('aria-label'), locale === 'uk' ? 'Розділи' : 'Sections');
      assert.equal(dialog.querySelector('h2').textContent, dialog.getAttribute('aria-label'));
      assert.equal(open.textContent, dialog.getAttribute('aria-label'));
      assert.equal(back.textContent, locale === 'uk' ? 'Назад' : 'Back');
      assert.equal(jump.textContent, heading.textContent);
      assert.deepEqual([...dialog.querySelectorAll('button')], controls);
      assert.equal(doc.activeElement, back);
      assert.equal(dialog.open, true);
      assert.equal(input.value, '9.5');
      assert.equal(changes, 0);
    }
    jump.click();
    assert.equal(doc.activeElement, input);
    assert.equal(dialog.open, false);
    assert.equal(changes, 0);
    input.emit('keydown', { key: 'Escape' });
    assert.equal(dialog.open, true);
    dialog.emit('cancel');
    assert.equal(dialog.open, false);
    assert.equal(doc.activeElement, input);
  } finally {
    host.destroy();
    setLocale(previous, { persist: false });
  }
});

test('open source chooser relabels built-in controls across EN/UK/EN without changing literal files or delivering a source', () => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  const { doc, win, node } = fixture(),
    input = node('input', 'picture');
  input.type = 'file';
  input.accept = 'image/png';
  const picker = createAuthoringSourcePicker({ document: doc, window: win }),
    file = new File(['original'], 'My Зображення.png', { type: 'image/png' });
  let changes = 0,
    fetches = 0;
  win.fetch = () => fetches++;
  deliverAuthoringFile(input, file, win);
  input.onchange = () => changes++;
  picker.open(input);
  const controls = [...picker.dialog.querySelectorAll('button')],
    [close, sample, recent, device] = controls;
  try {
    for (const locale of ['en', 'uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.equal(
        picker.dialog.getAttribute('aria-label'),
        locale === 'uk' ? 'Вибрати джерело' : 'Choose a source',
      );
      assert.equal(
        picker.dialog.querySelector('h2').textContent,
        picker.dialog.getAttribute('aria-label'),
      );
      assert.equal(close.textContent, locale === 'uk' ? 'Закрити' : 'Close');
      assert.equal(
        sample.textContent,
        locale === 'uk' ? 'Зображення «Світанковий сигнал»' : 'Dawn Signal picture',
      );
      assert.equal(recent.textContent, file.name);
      assert.equal(
        device.textContent,
        locale === 'uk' ? 'Вибрати новий файл із пристрою' : 'Choose a new file from this device',
      );
      assert.deepEqual([...picker.dialog.querySelectorAll('button')], controls);
      assert.equal(doc.activeElement, close);
      assert.equal(picker.dialog.open, true);
      assert.equal(input.files[0], file);
      assert.equal(changes, 0);
      assert.equal(fetches, 0);
    }
    close.click();
    assert.equal(picker.dialog.open, false);
    assert.equal(doc.activeElement, input);
    assert.equal(input.files[0], file);
    assert.equal(changes, 0);
  } finally {
    picker.destroy();
    setLocale(previous, { persist: false });
  }
});

test('Sections refreshes after later heading bindings and host locale callbacks, then stops on disposal', () => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  const { doc, win, node } = fixture(),
    main = node('main', 'workspace'),
    section = node('section', 'response'),
    boundHeading = node('h2', 'bound-heading'),
    callbackHeading = node('h3', 'callback-heading'),
    input = node('input', 'speed');
  boundHeading.textContent = 'Response';
  callbackHeading.textContent = 'Comfort';
  input.type = 'range';
  input.value = '9.5';
  main.append(section);
  section.append(boundHeading, callbackHeading, input);
  const host = mountPageInputHost({ document: doc, window: win, readPads: () => [] });
  doc.querySelector('.authoring-input-rail button').click();
  const dialog = doc.querySelector('.authoring-sections-dialog'),
    [back, , boundChoice, callbackChoice] = dialog.querySelectorAll('button');
  // Both producers register after the open menu's choices. Locale listeners
  // run after all ordinary bindings, so an eager derived binding goes stale.
  localizedText(boundHeading, () => (getLocale() === 'uk' ? 'Реакція' : 'Response'));
  const remove = onLocaleChange((locale) => {
    callbackHeading.textContent = locale === 'uk' ? 'Зручність' : 'Comfort';
  });
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(boundChoice.textContent, locale === 'uk' ? 'Реакція' : 'Response');
      assert.equal(callbackChoice.textContent, locale === 'uk' ? 'Зручність' : 'Comfort');
      assert.equal(doc.activeElement, back);
      assert.equal(dialog.open, true);
      assert.equal(input.value, '9.5');
    }
    host.destroy();
    // Retaining/reconnecting a retired dialog must not retain a live callback.
    doc.body.append(dialog);
    setLocale('en', { persist: false });
    assert.equal(boundHeading.textContent, 'Response');
    assert.equal(callbackHeading.textContent, 'Comfort');
    assert.equal(boundChoice.textContent, 'Реакція');
    assert.equal(callbackChoice.textContent, 'Зручність');
  } finally {
    remove();
    host.destroy();
    dialog.remove();
    setLocale(previous, { persist: false });
  }
});
test('authoring menus coordinate native Confirm before frames and retain the captured modal handoff', () => {
  const { doc, win, node, tick } = fixture(),
    open = node('button', 'open-tool'),
    dialog = node('dialog', 'tool-settings');
  const close = doc.createElement('button');
  close.id = 'close-tool';
  dialog.append(close);
  doc.parentNode = win;
  let now = 1000,
    opens = 0,
    closes = 0,
    reads = 0;
  const pad = {
    id: 'Authoring virtual pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: now,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  win.performance = { now: () => now };
  open.onclick = () => {
    opens++;
    dialog.showModal();
    close.focus();
  };
  close.onclick = () => {
    closes++;
    dialog.close();
  };
  const host = mountAuthoringInputHost({
    document: doc,
    window: win,
    readPads: () => {
      reads++;
      return [pad];
    },
  });
  try {
    tick();
    open.focus();
    pad.buttons[0] = { pressed: true, value: 1 };
    const down = open.emit('keydown', { key: 'Enter', isTrusted: true });
    assert.equal(down.defaultPrevented, true);
    assert.equal(opens, 0, 'a native keydown cannot commit the held controller gesture');
    now += 40;
    pad.timestamp = now;
    pad.buttons[0] = { pressed: false, value: 0 };
    const up = open.emit('keyup', { key: 'Enter', isTrusted: true });
    assert.equal(up.defaultPrevented, true);
    assert.equal(opens, 1, 'release commits once even before a render frame');
    assert.equal(dialog.open, true);
    assert.equal(doc.activeElement, close);
    close.emit('click', { isTrusted: true });
    tick();
    assert.equal(closes, 0, 'the compatibility click cannot activate the new dialog target');
    assert.equal(opens, 1);
    assert.equal(dialog.open, true);
    const priorReads = reads;
    doc.activeElement = { tagName: 'IFRAME' };
    tick();
    assert.equal(reads, priorReads, 'the parent yields controller polling to its preview');
  } finally {
    host.destroy();
  }
});

test('authoring page arrows and Escape use menu navigation while text keeps native caret keys', () => {
  const { doc, win, node } = fixture(),
    first = node('button', 'first'),
    second = node('button', 'second'),
    input = node('input', 'title');
  input.type = 'text';
  const host = mountAuthoringInputHost({ document: doc, window: win, readPads: () => [] });
  try {
    first.focus();
    assert.equal(first.emit('keydown', { key: 'ArrowDown' }).defaultPrevented, true);
    assert.equal(doc.activeElement, second);
    assert.equal(second.emit('keydown', { key: 'ArrowUp' }).defaultPrevented, true);
    assert.equal(doc.activeElement, first);
    input.focus();
    assert.equal(input.emit('keydown', { key: 'ArrowLeft' }).defaultPrevented, false);
    assert.equal(doc.activeElement, input);
    first.focus();
    assert.equal(first.emit('keydown', { key: 'Escape' }).defaultPrevented, true);
    const sections = doc.querySelector('.authoring-sections-dialog');
    assert.equal(sections.open, true);
    sections.emit('cancel');
    assert.equal(sections.open, false);
    assert.equal(doc.activeElement, first);
  } finally {
    host.destroy();
  }
});

test('a host with its own preview protocol can opt out of generic iframe controls', () => {
  const { doc, win, node, frames } = fixture();
  node('iframe', 'owned-preview');
  const host = mountAuthoringInputHost({
    document: doc,
    window: win,
    readPads: () => [],
    managePreviews: false,
  });
  try {
    assert.equal(doc.querySelector('.authoring-preview-enter'), null);
    assert.equal(frames.size, 1, 'the menu still owns only its existing poller');
  } finally {
    host.destroy();
  }
});
