import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { renderTextSizeControl } from '../ui/text-size-control.mjs';
import { renderResultReactionCaption } from '../ui/reaction-caption.mjs';
import { drawEventFeedback, drawRecoveryCue } from '../ui/event-feedback.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { setLocale, getLocale } from '../i18n/index.mjs';

const desired = { textSize: 'extra-large', textFace: 'plain', reducedEffects: false };

test('a qualified primary and an unqualified host share desired intent without sharing layout capability', () => {
  let raw = JSON.stringify(desired);
  const writes = [],
    host = new EventTarget(),
    storage = {
      getItem: () => raw,
      setItem: (key, value) => {
        assert.equal(key, DISPLAY_PREFERENCES_KEY);
        writes.push(value);
        raw = value;
      },
    },
    options = { window: host, getStorage: () => storage },
    primary = createDisplayPreferences({ ...options, extraLarge: true }),
    other = createDisplayPreferences(options);
  assert.equal(primary.snapshot().effectiveTextSize, 'extra-large');
  assert.equal(other.snapshot().effectiveTextSize, 'large');
  assert.deepEqual(writes, []);
  other.set({ reducedEffects: true });
  host.dispatchEvent(
    Object.assign(new Event('storage'), {
      key: DISPLAY_PREFERENCES_KEY,
      storageArea: storage,
      newValue: raw,
    }),
  );
  assert.equal(primary.snapshot().effectiveTextSize, 'extra-large');
  assert.equal(primary.snapshot().reducedEffects, true);
  assert.deepEqual(JSON.parse(raw), { ...desired, reducedEffects: true });
  primary.set({ textSize: 'standard' });
  host.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  assert.equal(other.snapshot().effectiveTextSize, 'standard');
  primary.dispose();
  other.dispose();
});

test('qualified control offers Extra large without events or focus changes, and fallback can resume', async (t) => {
  const original = getLocale();
  t.after(() => setLocale(original));
  await setLocale('en');
  const doc = new Document(),
    label = doc.createElement('label'),
    control = doc.createElement('select');
  control.id = 'text-size';
  control.setAttribute('aria-describedby', 'existing-help');
  for (const value of ['standard', 'large']) {
    const option = doc.createElement('option');
    option.value = value;
    control.append(option);
  }
  label.append(control);
  doc.body.append(label);
  control.focus();
  let changed = 0;
  control.addEventListener('change', () => changed++);
  renderTextSizeControl(control, 'standard', { extraLarge: true });
  const option = control.querySelector('[data-text-size-retained]');
  assert.equal(option.disabled, false);
  assert.equal(option.textContent, 'Extra large');
  assert.equal(control.value, 'standard');
  assert.equal(doc.activeElement, control);
  assert.equal(changed, 0);
  renderTextSizeControl(control, 'extra-large');
  assert.equal(option.disabled, true);
  const notice = label.querySelector('[data-text-size-fallback]');
  assert.equal(notice.hidden, false);
  renderTextSizeControl(control, 'extra-large', { extraLarge: true, locale: 'uk' });
  assert.equal(option.disabled, false);
  assert.equal(option.textContent, 'Дуже великий');
  assert.equal(notice.hidden, true);
  assert.equal(control.getAttribute('aria-describedby'), 'existing-help');
  assert.equal(control.value, 'extra-large');
  assert.equal(changed, 0);
  assert.equal(doc.activeElement, control);
});

test('result captions retain their independent size and visibility while participating in primary scaling', () => {
  const doc = new Document(),
    node = doc.createElement('p'),
    options = { subtitles: true, scale: 1.35, background: true };
  renderResultReactionCaption(
    node,
    { name: 'Guide', text: 'Return to the border.' },
    options,
    true,
  );
  assert.equal(node.style.fontSize, 'calc(1.35rem * var(--primary-text-scale, 1))');
  assert.equal(node.style.getPropertyValue('--reaction-caption-size'), '1.35rem');
  assert.equal(node.hidden, false);
  assert.match(node.textContent, /Return to the border/);
  renderResultReactionCaption(
    node,
    { text: 'Still hidden' },
    { ...options, subtitles: false },
    true,
  );
  assert.equal(node.hidden, true);
  assert.equal(node.style.display, 'none');
  assert.equal(options.scale, 1.35);
});

test('the primary CSS closure has no overlooked absolute font declaration', async () => {
  const root = path.resolve(import.meta.dirname, '../..'),
    html = await readFile(path.join(root, 'game/index.html'), 'utf8'),
    pending = [...html.matchAll(/(?:href|data-boot-href)="([^"?]+\.css)"/g)].map((match) =>
      path.join(root, 'game', match[1]),
    ),
    visited = new Set(),
    omitted = [];
  for (const name of [
    'terminal-recording-export.css',
    'controller-field-editor.css',
    'soundtrack-panel.css',
    'install-offline-panel.css',
    'global-settings-tools.css',
    'authoring-input.css',
  ])
    pending.push(path.join(root, 'game/ui', name));
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/@import\s+url\(['"]([^'"]+)/g))
      pending.push(path.resolve(path.dirname(file), match[1]));
    for (const match of css.matchAll(/(?<![\w-])(font-size|font|line-height)\s*:\s*([^;{}]+);/g)) {
      const [, property, value] = match;
      const absolute =
        /(?:\d(?:px|rem|vw|vh)|var\(--(?:fk-text|iw-text|native-action|handheld-|reaction-caption))/.test(
          value,
        );
      if (absolute && !value.includes('--primary-text-scale'))
        omitted.push(`${path.relative(root, file)} ${property}: ${value.trim()}`);
    }
  }
  assert.deepEqual(omitted, []);
  assert.ok(visited.size >= 40, 'Include the primary entry and its recursive CSS imports.');
});

function canvasSurface() {
  const calls = [],
    stack = [],
    state = {};
  const ctx = new Proxy(
    {},
    {
      get(_target, key) {
        if (key in state) return state[key];
        if (key === 'measureText')
          return (text) => ({
            width: [...text].length * Number(state.font.match(/([\d.]+)px/)[1]) * 0.6,
          });
        return (...args) => {
          calls.push({ kind: key, args, ...state });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') Object.assign(state, stack.pop());
        };
      },
      set(_target, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

for (const locale of ['en', 'uk'])
  for (const displayedWidth of [240, 390, 1152]) {
    test(`${locale}/${displayedWidth}: essential canvas feedback doubles text and wraps without squeezing or changing the run`, async (t) => {
      const previous = getLocale();
      t.after(() => setLocale(previous));
      await setLocale(locale);
      const palette = { accent: '#fff', danger: '#f00', safe: '#0f0' };
      const run = { status: 'respawning', time: 1.2, respawnAt: 4.2 };
      const event = { type: 'player.failed', x: 70, y: 33, age: 0.2 };
      for (const draw of [
        (ctx, options) => drawRecoveryCue(ctx, run, palette, options),
        (ctx, options) => drawEventFeedback(ctx, event, palette, options),
      ]) {
        const before = JSON.stringify({ run, event }),
          standard = canvasSurface(),
          extra = canvasSurface();
        const options = { screenScale: displayedWidth / 1152, width: 1152, height: 576 };
        draw(standard.ctx, options);
        draw(extra.ctx, { ...options, textScale: 2 });
        const oldText = standard.calls.filter((call) => call.kind === 'fillText');
        const newText = extra.calls.filter((call) => call.kind === 'fillText');
        const plate = extra.calls
          .filter((call) => call.kind === 'fillRect' && call.fillStyle === '#0c1423')
          .at(-1);
        const oldSize = Number(oldText[0].font.match(/([\d.]+)px/)[1]);
        assert.ok(newText.length > 0);
        for (const text of newText) {
          const size = Number(text.font.match(/([\d.]+)px/)[1]);
          assert.equal(size, oldSize * 2);
          assert.equal(text.args.length, 3, 'Never use Canvas maxWidth to squeeze the letters.');
          assert.ok(text.args[1] >= plate.args[0]);
          assert.ok(
            text.args[1] + [...text.args[0]].length * size * 0.6 <= plate.args[0] + plate.args[2],
          );
          assert.ok(text.args[2] >= plate.args[1]);
          assert.ok(text.args[2] + size <= plate.args[1] + plate.args[3]);
        }
        assert.ok(plate.args[0] >= 0 && plate.args[0] + plate.args[2] <= 1152);
        assert.ok(plate.args[1] >= 0 && plate.args[1] + plate.args[3] <= 576);
        assert.equal(
          newText
            .map((call) => call.args[0])
            .join(' ')
            .replaceAll(' ', ''),
          oldText[0].args[0].replaceAll(' ', ''),
        );
        assert.equal(JSON.stringify({ run, event }), before);
      }
    });
  }
