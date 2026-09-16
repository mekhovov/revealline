import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeReturnV2, readVersusSoloReturnToken } from '../mode-return-v2.mjs';
import { createModeReturn } from '../mode-return.mjs';

const baseURL = 'https://play.example/releases/v0.58.0/game/';
const key = 'revealline.mode-return.v2:/releases/v0.58.0/game/';
const authority = { channel: 'stable', version: '0.58.0', sourceRevision: 'a'.repeat(40) };
const selection = {
  campaignKey: 'first-signal/2/88639f3aab7b6cc1',
  levelId: 'signal-02',
  themeId: 'retro',
};
const value = { origin: 'solo-missions', destination: 'versus', selection };
const token = '1'.repeat(32),
  newerToken = '2'.repeat(32),
  epoch = Date.parse('2026-09-15T15:00:00Z');
const query = (id = token) => `?mode-return-v2=${id}`;
function storage() {
  const rows = new Map([
    ['player-profile', 'original'],
    ['suspended-flight', 'original'],
  ]);
  const removed = [],
    written = [];
  return {
    rows,
    removed,
    written,
    getItem: (key) => rows.get(key) ?? null,
    setItem(key, raw) {
      written.push(key);
      rows.set(key, raw);
    },
    removeItem(key) {
      removed.push(key);
      rows.delete(key);
    },
  };
}
const create = (store, options = {}) =>
  createModeReturnV2({
    storage: store,
    baseURL,
    authority,
    now: () => epoch,
    nonce: () => token,
    ...options,
  });
const read = (store, href, options = {}) =>
  readVersusSoloReturnToken({ href, storage: store, now: () => epoch, ...options });
const context = { origin: 'solo-missions', view: 'missions', focus: 'versus', selection };

test('exact selection is retained once in the separate bounded namespace and uses a fixed token-only route', () => {
  const store = storage(),
    api = create(store);
  assert.deepEqual(store.written, []);
  const ticket = api.prepare(structuredClone(value));
  assert.deepEqual(ticket, {
    token,
    href: `${baseURL}couch/?return=solo&return-token-v2=${token}`,
  });
  assert.deepEqual(store.written, [key]);
  assert.ok(Buffer.byteLength(store.getItem(key)) <= 2048);
  const raw = store.getItem(key);
  assert.equal(read(store, ticket.href), token);
  assert.equal(read(store, ticket.href.replace('couch/?', 'couch/index.html?')), token);
  assert.equal(store.getItem(key), raw);
  assert.deepEqual(store.removed, []);
  assert.equal(api.consume(''), null);
  assert.deepEqual(api.consume(query()), context);
  assert.equal(api.consume(query()), null);
  assert.equal(store.getItem('player-profile'), 'original');
  assert.equal(store.getItem('suspended-flight'), 'original');
});

test('caller authority and selection mutations cannot change captured return authority', () => {
  const store = storage(),
    source = { ...authority },
    input = structuredClone(value);
  const api = create(store, { authority: source });
  source.version = 'changed';
  api.prepare(input);
  input.selection.levelId = 'changed';
  assert.deepEqual(api.consume(query()), context);
});

for (const patch of [
  { destination: 'team' },
  { origin: 'versus' },
  { href: 'https://evil.invalid/' },
  { selection: { ...selection, target: '../' } },
  { selection: { ...selection, themeId: '../' } },
])
  test(`invalid request refuses before writing: ${JSON.stringify(patch)}`, () => {
    const store = storage();
    assert.throws(() => create(store).prepare({ ...value, ...patch }));
    assert.deepEqual(store.written, []);
  });

test('accessor-bearing or symbolic inputs are rejected without invoking getters', () => {
  const store = storage();
  let reads = 0;
  const input = { ...value };
  Object.defineProperty(input, 'origin', {
    enumerable: true,
    get() {
      reads++;
      return 'solo-missions';
    },
  });
  assert.throws(() => create(store).prepare(input));
  assert.throws(() => create(store).prepare({ ...value, [Symbol('hidden')]: true }));
  assert.throws(() => create(store, { authority: { ...authority, extra: true } }));
  assert.equal(reads, 0);
  assert.deepEqual(store.written, []);
});

for (const options of [
  { nonce: () => 'A'.repeat(32) },
  { nonce: () => 'short' },
  { now: () => Infinity },
  { authority: { ...authority, sourceRevision: 'wrong' } },
  { authority: { ...authority, version: 'x'.repeat(81) } },
  { baseURL: 'file:///game/' },
  { baseURL: 'https://user:pass@play.example/game/' },
])
  test(`invalid producer clock, token or authority refuses: ${JSON.stringify(options)}`, () => {
    const store = storage();
    assert.throws(() => create(store, options).prepare(value));
    assert.deepEqual(store.written, []);
  });

for (const change of [
  { format: 'revealline.mode-return.v1' },
  { baseURL: 'https://other.example/game/' },
  { origin: 'solo-title' },
  { destination: 'team' },
  { focus: 'team' },
  { view: 'flight' },
  { createdAt: epoch + 1 },
  { createdAt: epoch - 1800001 },
  { createdAt: 'yesterday' },
  { authority: { ...authority, sourceRevision: 'b'.repeat(40) } },
  { authority: { ...authority, channel: 'dev' } },
  { authority: { ...authority, version: '0.58.1' } },
  { selection: { ...selection, levelId: '../invalid' } },
  { unexpected: true },
])
  test(`matching incompatible own ticket is consumed without restoration: ${JSON.stringify(change)}`, () => {
    const store = storage(),
      api = create(store);
    const { href } = api.prepare(value);
    store.setItem(key, JSON.stringify({ ...JSON.parse(store.getItem(key)), ...change }));
    // Destination inspection cannot authenticate the running Solo source; receiving
    // Solo performs that exact authority check before returning a selection.
    if (!change.authority || change.authority.sourceRevision === authority.sourceRevision)
      if (!change.authority) assert.equal(read(store, href), null);
    assert.equal(api.consume(query()), null);
    assert.equal(store.getItem(key), null);
  });

test('inclusive TTL is accepted and another release namespace is not consumed', () => {
  const store = storage();
  create(store).prepare(value);
  assert.equal(create(store, { baseURL: 'https://play.example/game/' }).consume(query()), null);
  assert.ok(store.getItem(key));
  assert.deepEqual(create(store, { now: () => epoch + 1800000 }).consume(query()), context);
});

for (const suffix of [
  `?mode-return=${token}&mode-return-v2=${token}`,
  `?mode-return-v2=${token}&mode-return-v2=${token}`,
  `?mode-return-v2=${newerToken}`,
  '?mode-return-v2=short',
  `?mode-return-v2=${'A'.repeat(32)}`,
])
  test(`foreign or ambiguous query preserves own ticket: ${suffix}`, () => {
    const store = storage(),
      api = create(store);
    api.prepare(value);
    const raw = store.getItem(key);
    assert.equal(api.consume(suffix), null);
    assert.equal(store.getItem(key), raw);
    assert.deepEqual(store.removed, []);
  });

test('v1 and v2 records remain independent, and mixed receiving queries consume neither', () => {
  const store = storage();
  const v1 = createModeReturn({
    storage: store,
    baseURL,
    authority,
    now: () => epoch,
    nonce: () => newerToken,
  });
  v1.prepare(selection);
  create(store).prepare(value);
  const before = [...store.rows];
  assert.equal(create(store).consume(`?mode-return=${newerToken}&mode-return-v2=${token}`), null);
  assert.deepEqual([...store.rows], before);
  assert.deepEqual(create(store).consume(query()), context);
  assert.deepEqual(v1.consume(`?mode-return=${newerToken}`), selection);
});

for (const raw of ['{', JSON.stringify({ token, padding: 'é'.repeat(1100) })])
  test(`malformed or UTF8-oversize storage is not parsed/consumed (${Buffer.byteLength(raw)} bytes)`, () => {
    const store = storage();
    store.setItem(key, raw);
    assert.equal(create(store).consume(query()), null);
    assert.equal(store.getItem(key), raw);
    assert.deepEqual(store.removed, []);
  });

test('clear and consume never remove a newer raw value observed between their reads', () => {
  for (const action of ['clear', 'consume']) {
    const store = storage(),
      api = create(store);
    api.prepare(value);
    const old = store.getItem(key);
    create(store, { nonce: () => newerToken }).prepare(value);
    const next = store.getItem(key);
    store.setItem(key, old);
    let reads = 0;
    store.getItem = (name) => {
      if (name !== key) return store.rows.get(name) ?? null;
      if (++reads === 2) store.rows.set(key, next);
      return store.rows.get(key) ?? null;
    };
    if (action === 'clear') api.clear(token);
    else assert.equal(api.consume(query()), null);
    assert.equal(store.rows.get(key), next);
    assert.deepEqual(store.removed, []);
  }
});

test('clear only removes its own token, and a blocked removal cannot produce a repeatable accepted return', () => {
  const store = storage(),
    api = create(store);
  api.prepare(value);
  api.clear(newerToken);
  assert.ok(store.getItem(key));
  store.removeItem = () => {};
  assert.equal(api.consume(query()), null);
  assert.ok(store.getItem(key));
});

test('unavailable writes and false readbacks fail explicitly; reads always keep fixed fallback available', () => {
  for (const store of [
    undefined,
    {
      getItem() {
        throw Error('denied');
      },
    },
    {
      setItem() {
        throw Error('quota');
      },
      getItem: () => null,
    },
    { setItem() {}, getItem: () => null },
  ]) {
    assert.throws(() => create(store).prepare(value));
    assert.equal(create(store).consume(query()), null);
    assert.equal(read(store, `${baseURL}couch/?return=solo&return-token-v2=${token}`), null);
  }
});

for (const transform of [
  (url) => url.replace('couch/', 'couch/relay-rescue.html'),
  (url) => url.replace('play.example', 'other.example'),
  (url) => url.replace('https://', 'https://user:pass@'),
  (url) => `${url}&return=solo`,
  (url) => `${url}&return-token=${token}`,
  (url) => `${url}&return-token-v2=${token}`,
  (url) => url.replace('return=solo', 'return=versus'),
])
  test(`Couch reader rejects wrong route or ambiguous parameters: ${transform}`, () => {
    const store = storage(),
      ticket = create(store).prepare(value),
      raw = store.getItem(key);
    assert.equal(read(store, transform(ticket.href)), null);
    assert.equal(store.getItem(key), raw);
    assert.deepEqual(store.removed, []);
  });
