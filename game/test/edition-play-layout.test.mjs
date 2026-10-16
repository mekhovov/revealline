import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fitEditionBoard, mountEditionPlayLayout } from '../ui/edition-play-layout.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

test('edition copy, controls and notices retain the shared Standard/Large semantic text contract', async () => {
  const css = await readFile(new URL('../ui/edition-play.css', import.meta.url), 'utf8'),
    tokens = await readFile(new URL('../ui/field-kit-tokens.css', import.meta.url), 'utf8');
  const rules = (text) =>
    [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      ([, selector, declarations]) => ({
        selector: selector.replace(/\s+/g, ' ').trim(),
        declarations,
      }),
    );
  const shared = rules(tokens),
    edition = rules(css),
    standard = shared.find((rule) => rule.selector.endsWith(':root')).declarations,
    large = shared.find((rule) =>
      rule.selector.startsWith('.field-kit[data-text-size='),
    ).declarations;
  for (const [selector, role] of [
    ['body.game-shell[data-edition-id] .home-copy', 'body'],
    ['body.game-shell[data-edition-id] .home-content .eyebrow', 'secondary'],
    [
      'body.game-shell[data-edition-id] .home-actions :is(.button, #shell-play, #shell-featured)',
      'control',
    ],
    [
      'body.game-shell[data-edition-id] :is(.edition-switcher select, .edition-about, .home-play-options, .home-language-picker)',
      'control',
    ],
  ]) {
    const rule = edition.find((entry) => entry.selector === selector);
    assert.ok(rule, selector);
    const token = `--fk-text-${role}`;
    assert.match(
      rule.declarations,
      new RegExp(`font-size:\\s*var\\(${token}(?:,|\\))`),
      `${selector} must respond to the shared preference.`,
    );
    const value = (declarations) =>
      Number(declarations.match(new RegExp(`${token}:\\s*(\\d+)px`))?.[1]);
    assert.ok(value(standard) >= 14);
    assert.ok(value(large) >= value(standard) + 4, `${role} must visibly enlarge.`);
  }
  const notices = edition.find((rule) =>
    rule.selector.includes(':is(#encounter-status, #run-message,'),
  );
  assert.match(notices.declarations, /font-size:\s*var\(--fk-text-secondary(?:,|\))/);
  // This checks source-level preference binding, not browser line breaking or zoom.
});

test('enlarged chrome is remeasured before fitting the board and disposed observers cannot schedule more work', () => {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    observers = [];
  let nextFrame = 0;
  doc.body.dataset.editionId = 'sample-public';
  doc.body.dataset.flightState = 'running';
  doc.body.dataset.screenControls = 'shown';
  doc.body.style.getPropertyValue = (key) => doc.body.style[key] ?? '';
  const chrome = ['shell-bar', 'telemetry', 'play-controls'].map((name, index) => {
    const element = doc.createElement('div');
    element.className = name;
    element._rect = { width: 390, height: index === 2 ? 160 : 48 };
    doc.body.append(element);
    return element;
  });
  class Observer {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  Object.assign(win, {
    MutationObserver: Observer,
    ResizeObserver: Observer,
    requestAnimationFrame: (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '2' }),
  });
  const disconnect = mountEditionPlayLayout({ document: doc, window: win });
  doc.querySelector('.edition-safe-probe')._rect = { width: 390, height: 844 };
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  const board = () =>
    Object.fromEntries(
      ['x', 'y', 'width', 'height'].map((name) => [
        name,
        parseFloat(doc.body.style[`--edition-board-${name}`]),
      ]),
    );
  flush();
  const before = board();
  doc.body.dataset.textSize = 'large';
  chrome[1]._rect.height = 80;
  chrome[2]._rect.height = 190;
  for (const observer of observers) observer.callback([]);
  assert.equal(frames.size, 1, 'Multiple chrome mutations coalesce into one measurement.');
  flush();
  const after = board();
  assert.ok(after.y >= 48 + 80 + 8);
  assert.ok(after.y + after.height <= 844 - 190 - 16);
  assert.equal(after.width / after.height, 2);
  assert.notDeepEqual(after, before);
  disconnect();
  assert.ok(observers.every((observer) => observer.disconnected));
  for (const observer of observers) observer.callback([]);
  win.emit('resize');
  assert.equal(frames.size, 0);
  assert.equal(doc.querySelector('.edition-safe-probe'), null);
});

test('complete board fits remaining phone, tablet and desktop space without changing its aspect', () => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1024, 768],
    [1920, 1080],
    [3440, 1440],
  ]) {
    for (const aspect of [1, 4 / 3, 2, 3]) {
      const inset = {
        top: 104,
        bottom: height > width ? 190 : 70,
        left: width > height ? 156 : 4,
        right: 4,
      };
      const fit = fitEditionBoard({ width, height, aspect, ...inset });
      assert.ok(fit.x >= inset.left && fit.y >= inset.top);
      assert.ok(fit.x + fit.width <= width - inset.right + 1e-8);
      assert.ok(fit.y + fit.height <= height - inset.bottom + 1e-8);
      assert.ok(Math.abs(fit.width / fit.height - aspect) < 1e-8);
      assert.ok(
        Math.abs(fit.width - (width - inset.left - inset.right)) < 1e-8 ||
          Math.abs(fit.height - (height - inset.top - inset.bottom)) < 1e-8,
      );
    }
  }
});

test('invalid and exhausted viewports cannot produce unbounded CSS geometry', () => {
  assert.throws(() => fitEditionBoard({ width: 300, height: 500, aspect: Infinity }));
  assert.deepEqual(fitEditionBoard({ width: 300, height: 100, aspect: 2, top: 100 }), {
    x: 150,
    y: 100,
    width: 0,
    height: 0,
  });
});
