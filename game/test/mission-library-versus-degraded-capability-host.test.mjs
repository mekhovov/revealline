import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const settle = (predicate) => waitFor(predicate, { timeoutMs: 10000 });
const incoming = new URLSearchParams({
  journey: 'whole-spatial-v5',
  'library-mission': JSON.stringify([
    'journey:whole-spatial-v5',
    'whole-spatial-v5',
    JSON.stringify(['candidate', 'journey-opening', 'prologue']),
    'candidate/journey-opening/prologue/choose-your-share',
    '',
  ]),
  return: 'team',
  'journey-return': 'team-spatial-originals-1',
});

async function fixture(t, missing, journey = false) {
  const databases = new Map(),
    values = new Map(),
    requests = [],
    writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  const p = await couchPage(t, {
    initialLevel: null,
    href: `http://localhost/game/couch/?${journey ? incoming : 'journey=legacy'}`,
    storage: missing === 'storage' ? undefined : storage,
    beforeImport:
      missing === 'denied storage getter'
        ? () => {
            Object.defineProperty(globalThis, 'localStorage', {
              configurable: true,
              get() {
                throw new DOMException('Storage denied', 'SecurityError');
              },
            });
          }
        : undefined,
    lockManager:
      missing === 'locks' ? undefined : { request: async (_key, _options, work) => work({}) },
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
    fetchResponse: async (path) => {
      requests.push(String(path));
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (path === '../content/packs/fpv-arcade-r5.json')
        return new Response('Isolated Base fixture', { status: 503 });
    },
  });
  return { ...p, databases, requests, writes };
}
const packWrites = (p) =>
  [...p.databases.values()].flatMap((model) =>
    model.allPuts.filter(
      ([store, key]) => store === 'assets' && /packs|external-chapter/.test(key),
    ),
  );

async function openLibrary(p) {
  const opener = p.$('race-chapters'),
    activate = opener.onclick;
  let operation, timer;
  opener.onclick = function (...args) {
    operation = activate.apply(this, args);
    return operation;
  };
  opener.focus();
  try {
    opener.click();
  } finally {
    opener.onclick = activate;
  }
  assert.equal(typeof operation?.then, 'function', 'The real Missions action owns preparation.');
  assert.match(p.$('race-message').textContent, /Preparing missions/);
  try {
    await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Missions preparation did not settle.')), 120000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  assert.equal(p.$('journey-chooser')?.open, true);
}

for (const missing of ['storage', 'locks', 'denied storage getter']) {
  test(`missing ${missing} keeps the Base library usable and all installed downloads unavailable`, async (t) => {
    const p = await fixture(t, missing);
    const initialWrites = packWrites(p),
      initialRequests = p.requests.length;
    assert.equal(p.$('race-chapters').disabled, false);
    await openLibrary(p);
    assert.match(
      p.$('race-library-inventory-status').textContent,
      missing === 'denied storage getter'
        ? /Installed content could not be checked.*Storage denied.*Existing packs are kept/
        : /Installed content could not be checked.*readable recovery markers and Web Locks.*Existing packs are kept/,
    );
    p.$('journey-collection').value = 'Classic';
    p.$('journey-collection').emit('change');
    const cards = [...p.$('journey-cards').children];
    const target = cards.find((card) => JSON.parse(card.dataset.missionId)[3] === 'signal-12');
    assert.equal(target.disabled, false);
    assert.equal(target.querySelector('.journey-card-action').textContent, 'Play');
    const installed = cards.filter(
      (card) => !/^signal-\d+$/.test(JSON.parse(card.dataset.missionId)[3]),
    );
    assert(installed.length > 0);
    assert(installed.every((card) => card.disabled && /Unavailable/.test(card.textContent)));
    assert(
      !cards.some((card) =>
        /Download|Retry/.test(card.querySelector('.journey-card-action').textContent),
      ),
    );
    assert(!p.requests.slice(initialRequests).some((url) => /packs\/|optional\//.test(url)));
    target.click();
    await settle(() => {
      p.frame(0);
      return p.state() === 'running';
    });
    assert.equal(p.renders[0].level.id, 'signal-12');
    assert.equal(p.renders[1].level.id, 'signal-12');
    assert.deepEqual(packWrites(p), initialWrites);
    assert(!p.writes.some((key) => /revealline\.packs|external-chapter/.test(key)));
  });

  test(`missing ${missing} does not block an exact incoming Journey mission`, async (t) => {
    const p = await fixture(t, missing, true);
    await settle(() => {
      p.frame(0);
      return p.state() === 'running';
    });
    assert.equal(p.renders[0].level.id, 'choose-your-share');
    assert.equal(p.renders[1].level.id, 'choose-your-share');
    assert.equal(p.$('journey-chooser').open, false);
    assert.match(
      p.$('race-library-inventory-status').textContent,
      missing === 'denied storage getter'
        ? /Storage denied/
        : /readable recovery markers and Web Locks/,
    );
    assert.deepEqual(packWrites(p), []);
    assert(!p.requests.some((url) => /optional\//.test(url)));
    assert(!p.writes.some((key) => /revealline\.packs|external-chapter/.test(key)));
  });
}
