import assert from 'node:assert/strict';
import { Document } from '../../../game/test/helpers/couch-dom.mjs';
import { mountRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-library.mjs';

// Real Library presentation/operation handlers, isolated memory store; no player DB.
const id = 'alpine-fixture',
  name = { en: 'Alpine Valley', uk: 'Альпійська долина' },
  hashes = ['1', '2', '3', '4'].map((digit) => 'a'.repeat(12) + digit.repeat(52)),
  editions = [
    { en: 'Snow and scree contours', uk: 'Контури снігу й осипів' },
    { en: 'Original mountain terrain', uk: 'Початковий гірський рельєф' },
  ];
const pins = hashes.slice(0, 2).map((sha256, index) => ({
  id,
  title: name,
  edition: editions[index],
  pin: { url: `https://example.invalid/${index}.json`, sha256, bytes: 100 },
}));
const saved = (sha256, revision) => ({
  id,
  sha256,
  descriptor: { id, title: name, revision },
  bytes: 100,
  generation: 1,
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const doc = new Document(),
  parent = doc.createElement('div');
doc.body.append(parent);
let locale = 'en',
  records = [],
  stalled = null;
const installs = [],
  loads = [],
  flights = [],
  removals = [];
const store = {
  list: async () => [...records],
  inspect: async (pin) => ({
    descriptor: {
      id,
      title: name,
      revision: pin.sha256 === hashes[0] ? 'contours-r2' : 'terrain-r1',
    },
  }),
  install: async (pin) => {
    installs.push(pin.sha256);
    records.push(saved(pin.sha256, pin.sha256 === hashes[0] ? 'contours-r2' : 'terrain-r1'));
  },
  load: async (_id, options) => {
    loads.push([_id, options.sha256]);
    if (stalled) await stalled;
    return { source: { manifest: { id } }, fixture: options.sha256 };
  },
  removalSnapshot: async (_id, options) => {
    removals.push([_id, options.sha256]);
    return { ...records.find((row) => row.sha256 === options.sha256), revision: 'contours-r2' };
  },
  close() {},
};
const ui = mountRegionalLibrary({
  parent,
  pins,
  openLibrary: async () => store,
  txt: (en, uk) => (locale === 'uk' ? uk : en),
  window: { location: { href: 'https://example.invalid/sim' }, setTimeout, clearTimeout },
  el(tag, text, className) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  },
  fly: async (_configuration, record) => flights.push(record.sha256),
});
const card = (hash) =>
  [...doc.querySelectorAll('[data-region-key]')].find((node) => node.dataset.regionKey === hash);
const button = (hash, action) => card(hash).querySelector(`[data-region-action="${action}"]`);
const checks = [];
try {
  ui.open();
  await settle();
  for (const language of ['en', 'uk']) {
    locale = language;
    ui.refresh();
    const labels = hashes.slice(0, 2).map((hash, index) => {
      assert.equal(card(hash).querySelector('strong').textContent, name[language]);
      assert.equal(
        card(hash).querySelector('[data-region-edition]').textContent,
        editions[index][language],
      );
      const label = button(hash, 'install').getAttribute('aria-label');
      assert(label.includes(editions[index][language]));
      assert(!label.includes(hashes[index]));
      return label;
    });
    assert.equal(new Set(labels).size, 2);
  }
  // Unlabelled offers remain distinguishable without guessing a revision from a URL.
  for (const row of pins) delete row.edition;
  ui.refresh();
  assert.notEqual(
    button(hashes[0], 'install').getAttribute('aria-label'),
    button(hashes[1], 'install').getAttribute('aria-label'),
  );
  assert(
    card(hashes[0])
      .querySelector('[data-region-edition]')
      .textContent.includes(hashes[0].slice(0, 13)),
  );
  pins.forEach((row, index) => {
    row.edition = editions[index];
  });
  ui.refresh();
  assert.deepEqual(installs, []);
  assert.deepEqual(loads, []);
  checks.push(
    'Same-title offers have concise distinct EN/UK labels without inspecting or loading content',
  );
  locale = 'en';
  ui.refresh();
  for (const hash of hashes.slice(0, 2)) {
    button(hash, 'install').click();
    await settle();
  }
  assert.deepEqual(installs, hashes.slice(0, 2));
  for (const language of ['en', 'uk']) {
    locale = language;
    ui.refresh();
    for (const [index, hash] of hashes.slice(0, 2).entries()) {
      assert.equal(
        card(hash).querySelector('[data-region-edition]').textContent,
        editions[index][language],
      );
      assert(
        button(hash, 'fly').getAttribute('aria-label').includes(records[index].descriptor.revision),
      );
      assert(button(hash, 'remove').getAttribute('aria-label').includes(editions[index][language]));
      button(hash, 'fly').click();
      await settle();
      assert.equal(flights.at(-1), hash);
      assert.deepEqual(loads.at(-1), [id, hash]);
    }
  }
  checks.push(
    'Download preserves edition; EN/UK Fly dispatches each exact installed hash and removal identifies the same version',
  );
  const focused = button(hashes[1], 'fly');
  focused.focus();
  locale = 'en';
  ui.refresh();
  assert.equal(doc.activeElement.dataset.regionAction, 'fly');
  assert.equal(doc.activeElement.closest('[data-region-key]').dataset.regionKey, hashes[1]);
  checks.push('Language repaint preserves keyboard focus by full hash and action');
  records.push(saved(hashes[2], 'retained-r1'), saved(hashes[3], 'retained-r1'));
  ui.open();
  await settle();
  for (const language of ['en', 'uk']) {
    locale = language;
    ui.refresh();
    const labels = hashes.slice(2).map((hash) => {
      const label = card(hash).querySelector('[data-region-edition]').textContent;
      assert(label.includes('retained-r1'));
      assert(label.includes(hash.slice(0, 13)));
      return button(hash, 'fly').getAttribute('aria-label');
    });
    assert.equal(new Set(labels).size, 2);
  }
  checks.push(
    'Unlisted saved versions with equal revision strings get collision-safe short identities, not invented upgrade ordering',
  );
  let release;
  stalled = new Promise((resolve) => {
    release = resolve;
  });
  const before = flights.length;
  button(hashes[0], 'fly').click();
  await settle();
  ui.deactivate();
  release();
  await settle();
  assert.equal(flights.length, before);
  assert.equal(records.length, 4);
  assert.deepEqual(removals, []);
  checks.push(
    'Leaving during exact-version load still rejects stale launch and retains every saved version',
  );
} finally {
  ui.dispose();
}
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope: 'Production UI with isolated memory records; no native device or player-storage claim',
    },
    null,
    2,
  ),
);
