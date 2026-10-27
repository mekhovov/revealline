import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { renderTextSizeControl, renderTextSizeFallback } from '../ui/text-size-control.mjs';
import { effectiveTextSize } from '../text-size.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { createSimDisplayPreferences } from '../../optional-practice/civilian-fpv/flight-fullscreen.mjs';
import { coopCueScale } from '../couch/coop-actor-layout.mjs';
import { setLocale, getLocale } from '../i18n/index.mjs';

const desired = { textFace: 'plain', textSize: 'extra-large', reducedEffects: false };

for (const create of [createDisplayPreferences, createSimDisplayPreferences]) {
  test(`${create.name}: desired size survives reload, unrelated edits, external updates and failed persistence`, () => {
    const host = new EventTarget(),
      writes = [];
    let raw = JSON.stringify(desired),
      failed = false;
    const storage = {
      getItem: () => raw,
      setItem(key, value) {
        assert.equal(key, DISPLAY_PREFERENCES_KEY);
        if (failed) throw new Error('Storage denied');
        raw = value;
        writes.push(value);
      },
    };
    const options = { window: host, getStorage: () => storage };
    const owner = create(options);
    assert.equal(owner.snapshot().textSize, 'extra-large');
    assert.equal(owner.snapshot().effectiveTextSize, 'large');
    assert.deepEqual(writes, []);
    owner.set({ reducedEffects: true });
    assert.deepEqual(JSON.parse(raw), { ...desired, reducedEffects: true });
    const reloaded = create(options);
    assert.equal(reloaded.snapshot().textSize, 'extra-large');
    assert.equal(reloaded.snapshot().effectiveTextSize, 'large');
    reloaded.dispose();
    raw = JSON.stringify({ ...desired, textFace: 'pixel' });
    host.dispatchEvent(
      Object.assign(new Event('storage'), {
        key: DISPLAY_PREFERENCES_KEY,
        storageArea: storage,
        newValue: raw,
      }),
    );
    assert.equal(owner.snapshot().textFace, 'pixel');
    assert.equal(owner.snapshot().textSize, 'extra-large');
    assert.equal(owner.snapshot().effectiveTextSize, 'large');
    failed = true;
    const original = raw;
    owner.set({ textFace: 'plain' });
    host.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    assert.equal(raw, original);
    assert.equal(owner.snapshot().textFace, 'plain');
    assert.equal(owner.snapshot().textSize, 'extra-large');
    assert.equal(owner.snapshot().effectiveTextSize, 'large');
    owner.set({ textSize: 'standard' });
    assert.equal(owner.snapshot().effectiveTextSize, 'standard');
    owner.dispose();
  });
}

function fixture() {
  const doc = new Document(),
    label = doc.createElement('label'),
    select = doc.createElement('select');
  select.id = 'size';
  select.setAttribute('aria-describedby', 'existing-help');
  for (const value of ['standard', 'large']) {
    const option = doc.createElement('option');
    option.value = value;
    select.append(option);
  }
  label.append(select);
  doc.body.append(label);
  select.focus();
  return { doc, label, select };
}

test('unqualified controls retain incoming size visibly without exposing a selectable extra size or moving focus', () => {
  const { doc, label, select } = fixture();
  let changes = 0;
  select.addEventListener('change', () => changes++);
  renderTextSizeControl(select, 'standard');
  assert.equal(select.options.length, 2);
  renderTextSizeControl(select, 'extra-large', { locale: 'en' });
  const option = select.querySelector('[data-text-size-retained]');
  assert.equal(select.value, 'extra-large');
  assert.equal(select.selectedIndex, 2);
  assert.equal(option.disabled, true);
  assert.match(option.textContent, /using Large here/);
  const notice = label.querySelector('[data-text-size-fallback]');
  assert.equal(notice.hidden, false);
  assert.match(notice.textContent, /kept as your preferred size/);
  assert.equal(select.getAttribute('aria-describedby'), `existing-help ${notice.id}`);
  renderTextSizeControl(select, 'extra-large', { locale: 'uk' });
  assert.match(option.textContent, /Дуже великий/);
  assert.match(notice.textContent, /збережено як бажаний/);
  assert.equal(select.querySelectorAll('[data-text-size-retained]').length, 1);
  assert.equal(doc.activeElement, select);
  assert.equal(changes, 0);
  renderTextSizeControl(select, 'large');
  assert.equal(select.value, 'large');
  assert.equal(select.querySelector('[data-text-size-retained]'), null);
  assert.equal(notice.hidden, true);
  assert.equal(select.getAttribute('aria-describedby'), 'existing-help');
  assert.equal(changes, 0);
});

test('read-only fallback responds to live locale and preference changes without adding a control', (t) => {
  const original = getLocale();
  t.after(() => setLocale(original, { persist: false }));
  const doc = new Document();
  setLocale('en', { persist: false });
  renderTextSizeFallback(doc.body, 'extra-large');
  const notice = doc.body.querySelector('[data-text-size-fallback]');
  assert.match(notice.textContent, /This screen currently uses Large/);
  setLocale('uk', { persist: false });
  assert.match(notice.textContent, /Цей екран наразі/);
  renderTextSizeFallback(doc.body, 'standard');
  assert.equal(notice.hidden, true);
  assert.equal(doc.body.querySelector('select'), null);
});

test('effective fallback preserves established Large canvas geometry without widening accepted values', () => {
  for (const width of [320, 390, 1280]) {
    const large = coopCueScale(width, 72, 'large'),
      extra = coopCueScale(width, 72, 'extra-large');
    assert.equal(extra.font(1), large.font(1));
    assert.equal(extra.px(12), large.px(12));
  }
  assert.equal(effectiveTextSize('standard'), 'standard');
  assert.equal(effectiveTextSize('large'), 'large');
  assert.equal(effectiveTextSize('extra-large'), 'large');
  assert.throws(() => effectiveTextSize('huge'), /Unsupported text size/);
});

// Execute the exact subscription callbacks in hosts whose heavy native player
// entry is not needed to verify this presentation-only adapter boundary.
for (const family of ['company', 'overflight'])
  test(`${family}: actual reading callback preserves fallback intent and never changes the paused attempt`, async () => {
    const { readFile } = await import('node:fs/promises');
    const { parse } = await import('acorn');
    const { runInNewContext } = await import('node:vm');
    const file = family === 'company' ? '../company-player.mjs' : '../overflight/app.mjs';
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    let callback;
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'CallExpression' && node.callee?.property?.name === 'subscribe') {
        const argument = node.arguments[0];
        if (
          argument?.type === 'ArrowFunctionExpression' &&
          source.slice(argument.start, argument.end).includes('dataset.textSize')
        )
          callback = argument;
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    }
    visit(tree);
    assert.ok(callback);
    const doc = new Document(),
      nodes = new Map();
    for (const id of [
      'text-face',
      'text-size',
      'reduced-effects',
      'reduced-motion',
      'settings-dialog',
    ]) {
      const element = doc.createElement(id === 'text-size' ? 'select' : 'div');
      element.id = id;
      doc.body.append(element);
      nodes.set(id, element);
    }
    const attempt = Object.freeze({ phase: 'paused', tick: 7 });
    const projectionCalls = [],
      captionLayoutCalls = [];
    const invoke = runInNewContext(`(${source.slice(callback.start, callback.end)})`, {
      document: doc,
      doc,
      $: (id) => nodes.get(id),
      preferences: {},
      appearance: null,
      textScalingView: { refresh: (enabled) => projectionCalls.push(enabled) },
      commentator: { refreshCaptionLayout: () => captionLayoutCalls.push('refresh') },
      run: attempt,
      renderTextSizeControl,
      renderTextSizeFallback,
      syncUpgrade: () => assert.fail('Reading fallback must not open an upgrade'),
    });
    invoke({ ...desired, effectiveTextSize: 'large', effectiveReducedEffects: false });
    assert.equal((family === 'company' ? doc.documentElement : doc.body).dataset.textSize, 'large');
    assert.ok(doc.querySelector('[data-text-size-fallback]'));
    assert.deepEqual(projectionCalls, family === 'overflight' ? [false] : []);
    assert.deepEqual(captionLayoutCalls, family === 'overflight' ? ['refresh'] : []);
    assert.deepEqual(attempt, { phase: 'paused', tick: 7 });
  });
