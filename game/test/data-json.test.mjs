import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedJSON, exactKeys } from '../data-json.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const bytes = (value) => Buffer.byteLength(JSON.stringify(value));

for (const [name, value] of [
  ['null and booleans', { a: null, b: false, c: true }],
  ['numbers including zero and exponents', [0, -0, 1, -12, 1e100, 1e-7, 1.2345678901234567]],
  ['empty and nested containers', { empty: {}, list: [[], {}, { a: [1, 2, 3] }] }],
  ['Unicode text and keys', { привіт: '字😀', empty: '' }],
  ['escaped text and keys', { 'quote"\\': '\n\r\t\b\f\u0000"\\' }],
  ['lone surrogate text and keys', { '\ud800': '\udfff', pair: '\ud83d\ude00' }],
]) {
  test(`exact JSON byte boundary accepts ${name} and rejects one byte less`, () => {
    const maxBytes = bytes(value);
    assert.deepEqual(boundedJSON(value, { maxBytes }), value);
    assert.throws(() => boundedJSON(value, { maxBytes: maxBytes - 1 }), /byte budget/);
  });
}

test('many short array values use their serialized bytes without charging index keys', () => {
  const value = Array.from({ length: 2048 }, (_, index) => index % 10);
  const maxBytes = bytes(value);
  assert.equal(maxBytes, 4097);
  assert.deepEqual(boundedJSON(value, { maxBytes }), value);
  assert.throws(() => boundedJSON(value, { maxBytes: maxBytes - 1 }), /byte budget/);
});

test('the default 4 MiB ceiling still accepts exactly the limit and rejects one byte over', () => {
  const limit = 4 * 1024 * 1024;
  const value = { payload: 'x'.repeat(limit - bytes({ payload: '' })) };
  const encoded = JSON.stringify(value);
  assert.equal(Buffer.byteLength(encoded), limit);
  assert.deepEqual(boundedJSON(value, { maxString: limit }), value);
  assert.deepEqual(boundedJSON(encoded, { maxString: limit }), value);
  const tooLarge = { payload: value.payload + 'x' };
  assert.throws(() => boundedJSON(tooLarge, { maxString: limit }), /byte budget/);
  assert.throws(() => boundedJSON(JSON.stringify(tooLarge), { maxString: limit }), /byte budget/);
});

test('untrusted getters and toJSON hooks are rejected without invocation', () => {
  let invoked = 0;
  const getter = Object.defineProperty({}, 'payload', {
    enumerable: true,
    get() {
      invoked++;
      return 'not read';
    },
  });
  const hook = {
    toJSON() {
      invoked++;
      return {};
    },
  };
  const inheritedHook = Object.create({
    toJSON() {
      invoked++;
      return {};
    },
  });
  for (const value of [getter, hook, inheritedHook]) assert.throws(() => boundedJSON(value));
  assert.equal(invoked, 0);
});

test('exact byte accounting retains structural and shape protections', () => {
  const cycle = {};
  cycle.self = cycle;
  const sparse = [];
  sparse.length = 2;
  sparse[1] = 1;
  const customArray = [];
  customArray.extra = 1;
  const hidden = Object.defineProperty({}, 'hidden', { value: 1 });
  const symbol = { [Symbol('hidden')]: 1 };
  const forbidden = Object.defineProperty({}, '__proto__', { value: {}, enumerable: true });
  for (const value of [
    cycle,
    sparse,
    customArray,
    hidden,
    symbol,
    forbidden,
    new Date(),
    NaN,
    Infinity,
  ])
    assert.throws(() => boundedJSON(value));
  assert.throws(() => boundedJSON({ text: '123' }, { maxString: 2 }), /string exceeds/);
  assert.throws(() => boundedJSON([1, 2], { maxArray: 1 }), /item budget/);
  assert.throws(() => boundedJSON({ nested: {} }, { maxDepth: 0 }), /structural budget/);
  assert.throws(() => boundedJSON([1, 2], { maxNodes: 2 }), /structural budget/);
});

test('shared JSON boundary reports owned validation errors in the active locale', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('uk', { persist: false });

  assert.throws(() => boundedJSON('{'), /Файл має містити дійсний JSON/);
  assert.throws(() => boundedJSON(NaN), /Числа в JSON мають бути скінченними/);
  assert.throws(() => boundedJSON(new Date()), /лише звичайні дані JSON/);
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => boundedJSON(cycle), /Циклічні посилання/);
  const forbidden = Object.defineProperty({}, '__proto__', { value: {}, enumerable: true });
  assert.throws(() => boundedJSON(forbidden), /Заборонений ключ JSON: __proto__/);
  assert.throws(() => exactKeys(null, [], 'profile'), /profile має бути об’єктом/);
  assert.throws(
    () => exactKeys({ revision: 1 }, [], 'profile'),
    /profile\.revision не підтримується/,
  );

  setLocale('en', { persist: false });
  assert.throws(() => boundedJSON('{'), /The file must contain valid JSON/);
  assert.throws(() => exactKeys(null, [], 'profile'), /profile must be an object/);
});
