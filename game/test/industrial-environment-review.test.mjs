import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndustrialEnvironmentBatch } from '../../scripts/produce-industrial-environments.mjs';
import {
  mountEnvironmentReview,
  validateEnvironmentReviewInventory,
} from '../../authoring/industrial-art-review/environments.mjs';
const { inventory } = await createIndustrialEnvironmentBatch();
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.textContent = '';
    this.attributes = {};
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = [...nodes];
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  getContext() {
    return null;
  }
  addEventListener(name, fn) {
    const handlers = this.listeners.get(name) ?? new Set();
    handlers.add(fn);
    this.listeners.set(name, handlers);
  }
  removeEventListener(name, fn) {
    this.listeners.get(name)?.delete(fn);
  }
  emit(name, event = {}) {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn(event);
  }
}
const descendants = (node, tag) =>
  node.children.flatMap((child) => [
    ...(child.tagName === tag ? [child] : []),
    ...descendants(child, tag),
  ]);
const text = (node) => [node.textContent, ...node.children.map(text)].join(' ');
async function fixture(value, run) {
  const previous = {
      document: globalThis.document,
      window: globalThis.window,
      fetch: globalThis.fetch,
    },
    root = new Element('section'),
    language = new Element('select'),
    window = new Element('window');
  let signal;
  language.value = 'en';
  globalThis.document = { createElement: (tag) => new Element(tag) };
  globalThis.window = window;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: async () => value };
  };
  let review;
  try {
    review = mountEnvironmentReview(root, language);
    await review.ready;
    await run({ root, language, window, review, signal });
  } finally {
    review?.dispose();
    for (const [key, item] of Object.entries(previous)) {
      if (item === undefined) delete globalThis[key];
      else globalThis[key] = item;
    }
  }
}
test('real generated inventory renders fourteen cards with named native mission links', async () => {
  await fixture(inventory, ({ root }) => {
    const cards = descendants(root, 'article');
    assert.equal(cards.length, 14);
    const links = descendants(root, 'a');
    assert.equal(links.filter((link) => link.download === '').length, 14);
    const snake = links.filter((link) => link.href.includes('/game/snake/play.html'));
    assert.equal(snake.length, 36);
    assert.equal(new Set(snake.map((link) => link.href)).size, 36);
    for (const link of snake) {
      const parsed = new URL(link.href);
      assert.match(link.textContent, /^(Solo|Versus|Team) · .+/);
      assert.match(parsed.searchParams.get('level'), /^classic-living-/);
      assert.ok(['solo', 'versus', 'team'].includes(parsed.searchParams.get('mode')));
    }
    const flights = links.filter((link) => link.href.includes('/optional-practice/fpv-worlds/'));
    assert.equal(flights.length, 18);
    assert.equal(new Set(flights.map((link) => link.href)).size, 18);
    assert.ok(flights.some((link) => link.textContent === 'Open Low Pass Depot'));
    for (const link of flights) {
      assert.ok(link.textContent.length > 'Open course'.length);
      assert.ok(new URL(link.href).searchParams.has('snake-course'));
      assert.ok(!new URL(link.href).searchParams.has('mode'));
    }
    const captures = links.filter((link) =>
      /\/game\/(?:couch\/(?:relay-rescue.html)?)?\?/.test(link.href),
    );
    assert.equal(captures.length, 14);
    assert.ok(captures.every((link) => link.textContent.endsWith('open collection')));
  });
});
test('EN/UK switches keep route identity and display native translated mission names', async () => {
  await fixture(inventory, ({ root, language }) => {
    language.value = 'uk';
    language.emit('change');
    assert.match(text(root), /Матеріали розділів/);
    assert.match(text(root), /Подвійні перехоплення/);
    assert.match(text(root), /Відкрити Депо низьких прольотів/);
    const links = descendants(root, 'a').filter(
      (link) => !link.href.endsWith('.rltheme') && !link.href.endsWith('inventory.json'),
    );
    assert.ok(links.every((link) => new URL(link.href).searchParams.get('lang') === 'uk'));
  });
});
test('malformed inventory and unsafe routes reject before rendering or navigation', async () => {
  const corruptions = [
    (v) => delete v.chapters[0].title,
    (v) => (v.chapters[0].arcade['terrain.wall'].variant = 9),
    (v) => (v.chapters[0].links[0].href = 'https://foreign.invalid/'),
    (v) => (v.chapters[0].links[0].href = 'https://review.invalid/game/'),
    (v) => (v.chapters[0].package.href = 'authoring/../secret.rltheme'),
    (v) => (v.chapters[10].missions[0].launch.href = 'game/snake/play.html?level=wrong&mode=solo'),
    (v) => v.chapters[0].sourceIds.push('excess'),
    (v) => (v.chapters[0].links[0].href = 'game/%2e%2e/admin'),
    (v) => (v.chapters[12].modes[0] = 'solo'),
    (v) => (v.chapters[0].missions[0].launch.href = 'game/?journey=unrelated'),
  ];
  for (const corrupt of corruptions) {
    const changed = structuredClone(inventory);
    corrupt(changed);
    assert.throws(() => validateEnvironmentReviewInventory(changed));
    await fixture(changed, ({ root, language }) => {
      assert.equal(descendants(root, 'article').length, 0);
      assert.equal(descendants(root, 'a').length, 0);
      assert.match(text(root), /inventory is unavailable/);
      language.value = 'uk';
      assert.doesNotThrow(() => language.emit('change'));
      assert.match(text(root), /Перелік розділів недоступний/);
    });
  }
});
test('explicit disposal and a nonpersisted page exit retire fetch and all listeners', async () => {
  await fixture(inventory, ({ root, language, window, review, signal }) => {
    window.emit('pagehide', { persisted: true });
    assert.equal(signal.aborted, false);
    window.emit('pagehide', { persisted: false });
    assert.equal(signal.aborted, true);
    assert.equal(window.listeners.get('pagehide').size, 0);
    assert.equal(language.listeners.get('change').size, 0);
    const previous = text(root);
    language.value = 'uk';
    language.emit('change');
    assert.equal(text(root), previous);
    review.dispose();
  });
});
