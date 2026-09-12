import test from 'node:test';
import assert from 'node:assert/strict';
import { retryExplanation } from '../ui/retry-view.mjs';

test('a retained failure cause never explains a running, recovering or won attempt', () => {
  for (const status of ['running', 'respawning', 'won', 'ready', undefined, null, 0]) {
    const run = Object.freeze({ status, failureCause: 'enemy-trail', lives: 0 });
    assert.equal(retryExplanation(run), null);
  }
  assert.equal(retryExplanation(null), null);
  assert.equal(retryExplanation('lost'), null);
  assert.equal(retryExplanation(Object.create({ status: 'lost' })), null);
});

test('projection reads no accessor or unrelated simulation state', () => {
  let calls = 0;
  const getter = () => {
    calls++;
    throw new Error('Accessor must not run');
  };
  const run = { status: 'lost', failureCause: 'enemy-player' };
  Object.defineProperty(run, 'cells', { get: getter });
  Object.defineProperty(run, 'enemies', { get: getter });
  assert.equal(retryExplanation(run).cause, 'enemy-player');

  const hiddenStatus = { failureCause: 'enemy-player' };
  Object.defineProperty(hiddenStatus, 'status', { get: getter });
  assert.equal(retryExplanation(hiddenStatus), null);
  const hiddenCause = { status: 'lost' };
  Object.defineProperty(hiddenCause, 'failureCause', { get: getter });
  assert.equal(retryExplanation(hiddenCause).cause, null);
  assert.equal(calls, 0);
});

test('lost runs with untrusted causes receive the same fixed fallback without coercion', () => {
  let coerced = false;
  const objectCause = {
    toString() {
      coerced = true;
      return 'enemy-player';
    },
  };
  const generic = retryExplanation({ status: 'lost' });
  for (const failureCause of [null, {}, objectCause, 42, 'constructor', '<img src=x onerror=x>'])
    assert.deepEqual(retryExplanation({ status: 'lost', failureCause }), generic);
  const inherited = Object.create({ failureCause: 'enemy-player' });
  inherited.status = 'lost';
  assert.deepEqual(retryExplanation(inherited), generic);
  assert.equal(coerced, false);
  assert.equal(generic.cause, null);
  assert.doesNotMatch(Object.values(generic).join(' '), /<|>|constructor/);
});

test('output is an owned bounded text projection with no source mutation or shared result', () => {
  const run = Object.freeze({ status: 'lost', failureCause: 'boss-lane', lives: 0 });
  const before = JSON.stringify(run);
  const first = retryExplanation(run);
  const second = retryExplanation(run);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ['cause', 'footnote', 'reason', 'tip']);
  assert.equal(first.cause, 'boss-lane');
  assert.ok(first.reason.length > 0 && first.reason.length <= 120);
  assert.ok(first.tip.length > 0 && first.tip.length <= 160);
  for (const value of Object.values(first)) assert.equal(typeof value, 'string');
  first.reason = 'caller edit';
  first.cause = null;
  assert.deepEqual(retryExplanation(run), second);
  assert.equal(JSON.stringify(run), before);
});

test('practice context changes only the consequence note and never claims a campaign reward', () => {
  const run = Object.freeze({ status: 'lost', failureCause: 'cut-timeout' });
  const options = Object.freeze({ practice: true });
  const ordinary = retryExplanation(run);
  const practice = retryExplanation(run, options);
  assert.deepEqual(
    { ...practice, footnote: ordinary.footnote },
    ordinary,
    'Practice cannot change the authoritative cause or its advice',
  );
  assert.match(practice.footnote, /practice grants no campaign rewards/);
  assert.match(ordinary.footnote, /collected pictures and best results remain/);
  assert.match(ordinary.footnote, /This reveal resets/);
  assert.match(practice.footnote, /This reveal resets/);
  assert.deepEqual(retryExplanation(run, { practice: false }), ordinary);
  assert.deepEqual(retryExplanation(run, Object.create(null)), ordinary);
});

test('an explicit practice choice must be an owned boolean without running options getters', () => {
  const run = { status: 'lost', failureCause: 'enemy-trail' };
  let calls = 0;
  const options = Object.defineProperty({}, 'practice', {
    get() {
      calls++;
      throw new Error('Options accessor must not run');
    },
  });
  assert.throws(() => retryExplanation(run, options), /own data boolean/);
  assert.equal(calls, 0);
  for (const practice of [undefined, null, 0, 1, 'false', 'true', {}, []])
    assert.throws(() => retryExplanation(run, { practice }), /own data boolean/);
  for (const malformed of [null, false, 'practice', [], Object.create({ practice: true })])
    assert.throws(() => retryExplanation(run, malformed), /plain object/);
  const ownNullPrototype = Object.assign(Object.create(null), { practice: true });
  assert.deepEqual(
    retryExplanation(run, ownNullPrototype),
    retryExplanation(run, { practice: true }),
  );
});
