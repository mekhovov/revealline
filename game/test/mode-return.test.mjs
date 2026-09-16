import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeReturn, teamReturnHref } from '../mode-return.mjs';

const baseURL = 'https://play.example/revealline/game/';
const key = 'revealline.mode-return.v1:/revealline/game/';
const authority = Object.freeze({
  channel: 'stable',
  version: '0.58.0',
  sourceRevision: 'a'.repeat(40),
});
const selection = Object.freeze({
  campaignKey: 'first-signal/2/88639f3aab7b6cc1',
  levelId: 'signal-02',
  themeId: 'ukraine',
});
const tokenA = '1'.repeat(32);
const tokenB = '2'.repeat(32);
const epoch = Date.parse('2026-09-15T15:00:00.000Z');
function memory() {
  const entries = new Map([
    ['existing-player-profile', 'untouched player profile'],
    ['existing-saved-flight', 'untouched suspended flight'],
  ]);
  const writes = [],
    removals = [];
  return {
    entries,
    writes,
    removals,
    getItem: (name) => entries.get(name) ?? null,
    setItem(name, value) {
      assert.equal(typeof value, 'string');
      writes.push([name, value]);
      entries.set(name, value);
    },
    removeItem(name) {
      removals.push(name);
      entries.delete(name);
    },
  };
}
function create(storage = memory(), options = {}) {
  return createModeReturn({
    storage,
    baseURL,
    authority,
    now: () => epoch,
    nonce: () => tokenA,
    ...options,
  });
}
const search = (token = tokenA) => `?mode-return=${token}`;

test('preparing a bounded ticket uses only the fixed own Team route and no player or flight writes', () => {
  const store = memory();
  const api = create(store);
  assert.deepEqual(store.writes, [], 'Construction must not persist a return.');
  const ticket = api.prepare(selection);
  assert.deepEqual(ticket, {
    token: tokenA,
    href: `${baseURL}couch/relay-rescue.html?return=solo&return-token=${tokenA}`,
  });
  assert.equal(store.writes.length, 1);
  assert.equal(store.writes[0][0], key);
  assert.ok(Buffer.byteLength(store.getItem(key), 'utf8') <= 2048);
  assert.equal(store.getItem('existing-player-profile'), 'untouched player profile');
  assert.equal(store.getItem('existing-saved-flight'), 'untouched suspended flight');
});

test('a new page consumes its exact same-source selection once; ordinary navigation does not consume it', () => {
  const store = memory();
  create(store).prepare(selection);
  const next = create(store);
  assert.equal(next.consume(''), null);
  assert.ok(store.getItem(key));
  assert.deepEqual(next.consume(search()), selection);
  assert.equal(store.getItem(key), null);
  assert.equal(next.consume(search()), null);
  assert.equal(store.writes.length, 1, 'Returning does not write a selection or suspended flight.');
});

test('ticket contents are captured at preparation and cannot change through caller mutation', () => {
  const store = memory();
  const candidate = { ...selection };
  create(store).prepare(candidate);
  candidate.levelId = 'signal-11';
  candidate.themeId = 'retro';
  assert.deepEqual(create(store).consume(search()), selection);
});

test('a return link validates without consuming; actual Solo return performs the one-use consumption', () => {
  const store = memory();
  const ticket = create(store).prepare(selection);
  const before = store.getItem(key);
  assert.equal(
    teamReturnHref({ href: ticket.href, storage: store, now: () => epoch }),
    `../?mode-return=${tokenA}`,
  );
  assert.equal(store.getItem(key), before);
  assert.deepEqual(store.removals, []);
  assert.deepEqual(create(store).consume(search()), selection);
});

test('wrong, malformed and duplicate query tokens cannot consume a newer owned return', () => {
  const store = memory();
  create(store).prepare(selection);
  const newer = create(store, { nonce: () => tokenB });
  newer.prepare({ ...selection, levelId: 'signal-03' });
  const raw = store.getItem(key);
  for (const query of [
    search(tokenA),
    '?mode-return=short',
    `?mode-return=${tokenB}&mode-return=${tokenB}`,
    `?mode-return=${tokenA}&mode-return=${tokenB}`,
    `?mode-return=${'A'.repeat(32)}`,
    '?mode-return=%2F%2Fevil.example',
  ]) {
    assert.equal(newer.consume(query), null, query);
    assert.equal(store.getItem(key), raw, 'Invalid/foreign query must keep the newer ticket.');
  }
  assert.deepEqual(newer.consume(search(tokenB)), { ...selection, levelId: 'signal-03' });
});

test('clearing an old departure does not remove a more recent ticket', () => {
  const store = memory();
  const older = create(store);
  older.prepare(selection);
  create(store, { nonce: () => tokenB }).prepare({ ...selection, levelId: 'signal-03' });
  const raw = store.getItem(key);
  older.clear(tokenA);
  assert.equal(store.getItem(key), raw);
  older.clear(tokenB);
  assert.equal(store.getItem(key), null);
  assert.equal(store.getItem('existing-saved-flight'), 'untouched suspended flight');
});

for (const [label, changed] of [
  ['source', { ...authority, sourceRevision: 'b'.repeat(40) }],
  ['version', { ...authority, version: '0.59.0' }],
  ['channel', { ...authority, channel: 'testing' }],
])
  test(`a matching token from a different ${label} is refused and retired`, () => {
    const store = memory();
    create(store).prepare(selection);
    assert.equal(create(store, { authority: changed }).consume(search()), null);
    assert.equal(store.getItem(key), null);
    assert.equal(create(store).consume(search()), null);
  });

test('a different pathname has an isolated namespace and cannot consume this page ticket', () => {
  const store = memory();
  create(store).prepare(selection);
  const raw = store.getItem(key);
  assert.equal(
    create(store, { baseURL: 'https://play.example/revealline/releases/v058/game/' }).consume(
      search(),
    ),
    null,
  );
  assert.equal(store.getItem(key), raw);
  assert.deepEqual(create(store).consume(search()), selection);
});

test('copied session storage at a different origin cannot adopt the matching-path ticket', () => {
  const store = memory();
  create(store).prepare(selection);
  assert.equal(
    create(store, { baseURL: 'https://other.example/revealline/game/' }).consume(search()),
    null,
  );
});

for (const [label, time] of [
  ['expired', epoch + 30 * 60 * 1000 + 1],
  ['future-issued', epoch - 1],
])
  test(`${label} return cannot restore a selection`, () => {
    const store = memory();
    create(store).prepare(selection);
    assert.equal(create(store, { now: () => time }).consume(search()), null);
    assert.equal(store.getItem(key), null);
  });

test('a ticket just inside the thirty-minute lifetime remains usable', () => {
  const store = memory();
  create(store).prepare(selection);
  assert.deepEqual(
    create(store, { now: () => epoch + 30 * 60 * 1000 - 1 }).consume(search()),
    selection,
  );
});

test('invalid selections are rejected without replacing a previously prepared ticket', () => {
  const store = memory();
  const api = create(store);
  api.prepare(selection);
  const raw = store.getItem(key);
  for (const value of [
    null,
    [],
    { ...selection, extra: true },
    { ...selection, levelId: '../signal-02' },
    { ...selection, themeId: 'fpv'.repeat(1000) },
    { ...selection, campaignKey: 'first-signal/2/not-a-definition-hash' },
    { ...selection, href: 'https://evil.example/' },
  ]) {
    assert.throws(() => api.prepare(value));
    assert.equal(store.getItem(key), raw);
  }
});

test('selection accessors are refused without invocation or replacing the retained ticket', () => {
  const store = memory();
  const api = create(store);
  api.prepare(selection);
  const raw = store.getItem(key);
  let reads = 0;
  const candidate = { ...selection };
  Object.defineProperty(candidate, 'levelId', {
    enumerable: true,
    get() {
      reads++;
      return selection.levelId;
    },
  });
  assert.throws(() => api.prepare(candidate));
  assert.equal(reads, 0);
  assert.equal(store.getItem(key), raw);
});

test('source authority is captured without accepting coerced identities', () => {
  const store = memory();
  let conversions = 0;
  assert.throws(() =>
    create(store, {
      authority: {
        ...authority,
        sourceRevision: {
          toString() {
            conversions++;
            return authority.sourceRevision;
          },
        },
      },
    }),
  );
  assert.equal(conversions, 0);
  const supplied = { ...authority };
  const api = create(store, { authority: supplied });
  supplied.sourceRevision = 'b'.repeat(40);
  api.prepare(selection);
  assert.deepEqual(create(store).consume(search()), selection);
});

test('invalid injected nonce or clock never replaces an existing ticket', () => {
  const store = memory();
  create(store).prepare(selection);
  const raw = store.getItem(key);
  for (const options of [
    { nonce: () => '../unsafe' },
    { nonce: () => 'A'.repeat(32) },
    { nonce: () => '1'.repeat(33) },
    { now: () => NaN },
    { now: () => Infinity },
    { now: () => epoch + 0.5 },
  ]) {
    assert.throws(() => create(store, options).prepare(selection));
    assert.equal(store.getItem(key), raw);
  }
});

test('malformed or oversized stored JSON is not accepted and unrelated storage survives', () => {
  const store = memory();
  for (const raw of ['{', 'null', '[]', ' '.repeat(2049) + '{}']) {
    store.entries.set(key, raw);
    assert.equal(create(store).consume(search()), null);
    assert.equal(store.getItem('existing-player-profile'), 'untouched player profile');
    assert.equal(store.getItem('existing-saved-flight'), 'untouched suspended flight');
  }
});

test('unknown record fields are refused rather than used as return destinations', () => {
  const store = memory();
  create(store).prepare(selection);
  const record = JSON.parse(store.getItem(key));
  store.entries.set(key, JSON.stringify({ ...record, href: 'https://evil.example/' }));
  assert.equal(create(store).consume(search()), null);
});

test('failed persistence yields no departure ticket and preserves the prior record', () => {
  const store = memory();
  create(store).prepare(selection);
  const raw = store.getItem(key);
  store.setItem = () => {
    throw new Error('Quota exceeded');
  };
  assert.throws(() => create(store, { nonce: () => tokenB }).prepare(selection));
  assert.equal(store.getItem(key), raw);
});

test('unavailable storage cannot produce or consume a supposedly retained return', () => {
  const storage = {
    getItem() {
      throw new Error('Storage denied');
    },
    setItem() {
      throw new Error('Storage denied');
    },
    removeItem() {
      throw new Error('Storage denied');
    },
  };
  assert.throws(() => create(storage).prepare(selection));
  assert.equal(create(storage).consume(search()), null);
  assert.doesNotThrow(() => create(storage).clear(tokenA));
});

test('failed one-use removal refuses adoption rather than replaying the same ticket', () => {
  const store = memory();
  create(store).prepare(selection);
  store.removeItem = () => {
    throw new Error('Storage removal denied');
  };
  assert.equal(create(store).consume(search()), null);
});

test('storage that silently retains the ticket cannot report successful consumption', () => {
  const store = memory();
  create(store).prepare(selection);
  const raw = store.getItem(key);
  store.removeItem = () => {};
  assert.equal(create(store).consume(search()), null);
  assert.equal(store.getItem(key), raw);
});

test('ordinary and ambiguous Team links use fixed legacy destinations only', () => {
  const storage = memory();
  const team = `${baseURL}couch/relay-rescue.html`;
  assert.equal(teamReturnHref({ href: `${team}?return=solo`, storage }), '../');
  for (const query of [
    '',
    '?return=versus',
    '?return=unknown',
    '?return=solo&return=solo',
    '?return=solo&return=versus',
    '?return=https%3A%2F%2Fevil.example%2F',
  ])
    assert.equal(teamReturnHref({ href: team + query, storage }), './', query);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(storage.removals, []);
});
