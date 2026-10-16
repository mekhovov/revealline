import assert from 'node:assert/strict';
import { Document } from '../../../game/test/helpers/couch-dom.mjs';
import { mountRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-library.mjs';
const id = 'repair-fixture',
  title = { en: 'Repair study', uk: 'Тест відновлення' };
const hashes = ['a', 'b', 'c'].map((c) => c.repeat(64));
const pins = hashes
  .slice(0, 2)
  .map((sha256) => ({
    id,
    title,
    pin: { url: 'https://fixture.invalid/delivery.json', sha256, bytes: 100 },
  }));
const records = hashes.map((sha256, index) => ({
  id,
  sha256,
  descriptor: { id, title, revision: `r${index}` },
  bytes: 100,
}));
const doc = new Document(),
  parent = doc.createElement('div');
doc.body.append(parent);
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
let locale = 'en',
  error = null,
  hostError = null,
  pending = null,
  mode = 'success';
const repairs = [],
  flights = [],
  timers = new Map();
let timerID = 0;
const ui = mountRegionalLibrary({
  parent,
  pins,
  txt: (en, uk) => (locale === 'uk' ? uk : en),
  el(tag, text, className) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  },
  window: {
    location: { href: 'https://fixture.invalid/' },
    setTimeout(callback, delay) {
      const id = ++timerID;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  },
  openLibrary: async () => ({
    list: async () => records,
    inspect: async () => ({ descriptor: { id } }),
    load: async () => {
      if (error) throw error;
      return {};
    },
    repair: async (pin, options) => {
      repairs.push({ pin, id: options.id });
      if (mode === 'stall')
        await new Promise((resolve, reject) => {
          pending = resolve;
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true,
          });
        });
      if (mode === 'late-commit')
        await new Promise((resolve) => {
          pending = resolve;
        });
      options.onProgress({ phase: 'commit', loadedBytes: 100, totalBytes: 100 });
      error = null;
    },
    close() {},
  }),
  fly: async (_configuration, record) => {
    if (hostError) throw hostError;
    flights.push(record.sha256);
  },
});
const card = (hash) =>
  [...doc.querySelectorAll('[data-region-key]')].find((n) => n.dataset.regionKey === hash);
const button = (hash, action) => card(hash).querySelector(`[data-region-action="${action}"]`);
const status = () => doc.querySelector('[role="status"]').textContent;
const invalid = () =>
  Object.assign(new TypeError('Fixture integrity failure'), { code: 'regional-cache-invalid' });
const checks = [];
try {
  ui.open();
  await settle();
  for (const failure of [
    new TypeError('Network failure'),
    new DOMException('Cancelled', 'AbortError'),
    new DOMException('Storage failed', 'UnknownError'),
  ]) {
    error = failure;
    await button(hashes[0], 'fly').onclick();
    assert.equal(button(hashes[0], 'repair'), null);
  }
  error = null;
  hostError = invalid();
  await button(hashes[0], 'fly').onclick();
  assert.equal(button(hashes[0], 'repair'), null);
  hostError = null;
  checks.push('Network, abort, storage and downstream runtime failures do not offer repair');
  for (const language of ['en', 'uk']) {
    locale = language;
    ui.refresh();
    error = invalid();
    await button(hashes[0], 'fly').onclick();
    const repair = button(hashes[0], 'repair');
    assert(repair);
    assert.equal(doc.activeElement, repair);
    assert(repair.getAttribute('aria-label').includes(title[language]));
    assert(
      status().includes(
        language === 'en' ? 'Other versions and saved places' : 'Інші версії та збережені місця',
      ),
    );
    ui.refresh();
    assert.equal(doc.activeElement, button(hashes[0], 'repair'));
    await button(hashes[0], 'repair').onclick();
    assert.equal(button(hashes[0], 'repair'), null);
    assert.equal(doc.activeElement, button(hashes[0], 'fly'));
    assert.equal(flights.length, 0);
    assert.equal(repairs.at(-1).pin.sha256, hashes[0]);
    assert.equal(repairs.at(-1).id, id);
    assert.equal(records.length, 3);
  }
  checks.push(
    'EN/UK verified failure offers exact repair, retains keyboard focus and other versions, never launches automatically',
  );
  error = invalid();
  await button(hashes[2], 'fly').onclick();
  assert.equal(button(hashes[2], 'repair'), null);
  assert(status().includes('недоступна для відновлення'));
  checks.push('Unoffered retained version has no download fallback or guessed source');
  locale = 'en';
  ui.refresh();
  error = invalid();
  await button(hashes[0], 'fly').onclick();
  mode = 'stall';
  const cancellation = button(hashes[0], 'repair').onclick();
  await settle();
  [...doc.querySelectorAll('button')].find((n) => n.textContent === 'Cancel').onclick();
  await cancellation;
  assert(status().startsWith('Cancelled'));
  assert(button(hashes[0], 'repair'));
  assert.equal(flights.length, 0);
  const timed = button(hashes[0], 'repair').onclick();
  await settle();
  assert([...timers.values()].some((t) => t.delay === 600000));
  [...timers.values()].find((t) => t.delay === 120000).callback();
  await timed;
  assert(status().includes('took too long'));
  assert(button(hashes[0], 'repair'));
  checks.push(
    'Repair uses progress-aware install deadline and cancellable preparation; failed attempt remains retryable',
  );
  mode = 'late-commit';
  const late = button(hashes[0], 'repair').onclick();
  await settle();
  ui.deactivate();
  pending();
  await late;
  ui.open();
  await settle();
  assert.equal(flights.length, 0);
  assert.equal(button(hashes[0], 'repair'), null);
  assert.equal(records.length, 3);
  checks.push(
    'Late atomic completion after navigation refreshes saved metadata without launch or stale focus',
  );
} finally {
  ui.dispose();
}
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Production Library handlers with isolated memory store and controlled timers, EN/UK and focus. No actual browser, storage or quota claim.',
    },
    null,
    2,
  ),
);
