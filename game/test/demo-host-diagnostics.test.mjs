import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDemoHostFailure } from './helpers/demo-host-fixture.mjs';

function fixture() {
  const long = 'observed-'.repeat(2000);
  const node = {
    hidden: false,
    disabled: true,
    open: true,
    textContent: long,
    dataset: {
      scene: 'loading',
      demoMode: 'solo',
      demoSource: 'first-signal-left',
      demoPhase: 'paused',
      demoTick: '9',
      demoPreparationDetails: long,
      demoFailureDetails: long,
      state: 'loading',
      stage: 'images',
    },
  };
  const page = {
    $: () => node,
    doc: {
      hidden: false,
      hasFocus: () => true,
      documentElement: { isConnected: true },
      body: { dataset: { flightState: 'briefing', pictureState: 'loading' } },
    },
    rendered: { run: { levelId: 'ordinary', tick: 0, status: 'playing' }, paused: true },
    errors: Array.from({ length: 12 }, (_, index) => new Error(`${index}:${long}`)),
    frame() {
      assert.fail('Failure observation must not pump a frame.');
    },
  };
  return { page, node };
}

test('failed demo observation retains bounded public state and the designated ordinary frame', () => {
  const { page } = fixture();
  const ordinary = { run: { levelId: 'retained', tick: 7, status: 'playing' }, paused: true };
  const rows = [];
  reportDemoHostFailure({ diagnostic: (value) => rows.push(value) }, page, {
    phase: 'Fresh preparation',
    timeoutMs: 30000,
    lastOrdinaryRender: () => ordinary,
  });
  assert.equal(rows.length, 1);
  assert.ok(Buffer.byteLength(rows[0], 'utf8') <= 8192);
  const result = JSON.parse(rows[0]);
  assert.equal(result.timeoutMs, 30000);
  assert.equal(result.lastOrdinaryRender.level, 'retained');
  assert.equal(result.lastOrdinaryRender.tick, 7);
  assert.equal(result.lastOrdinaryRender.paused, true);
  assert.equal(result.page.picture, 'loading');
  assert.equal(result.demo.scene, 'loading');
  assert.equal(result.demo.freshDisabled, true);
  assert.equal(result.preparation[0].stage, 'images');
  assert.equal(result.errors.length, 4);
  assert.equal(result.omittedErrors, 8);
  assert.match(result.errors[0], /^8:/);
  assert.ok(result.errors.every((value) => value.length <= 160));
  assert.equal(page.rendered.run.tick, 0, 'Observation does not change the ordinary run.');
});

test('missing or throwing public state and a throwing diagnostic sink cannot escape', () => {
  const broken = new Proxy(
    {},
    {
      get() {
        throw new Error('Unavailable public state');
      },
    },
  );
  const rows = [];
  assert.doesNotThrow(() =>
    reportDemoHostFailure({ diagnostic: (value) => rows.push(value) }, broken, {
      phase: 'Failed boundary',
      timeoutMs: 30000,
    }),
  );
  assert.equal(rows.length, 1);
  const result = JSON.parse(rows[0]);
  assert.equal(result.lastOrdinaryRender.level, null);
  assert.equal(result.demo.open, null);
  assert.deepEqual(result.errors, []);
  assert.doesNotThrow(() =>
    reportDemoHostFailure(
      {
        diagnostic() {
          throw new Error('Unavailable diagnostic sink');
        },
      },
      broken,
      { phase: 'Failed boundary', timeoutMs: 30000 },
    ),
  );
});

test('reporting before rethrow preserves the original failure, message, stack and cause', async () => {
  const { page } = fixture();
  const cause = new Error('original cause');
  const original = new Error('Original wait failure', { cause });
  const stack = original.stack;
  await assert.rejects(
    Promise.reject(original).catch((error) => {
      reportDemoHostFailure(
        {
          diagnostic() {
            throw new Error('Observation must remain secondary');
          },
        },
        page,
        { phase: 'Fresh preparation', timeoutMs: 30000 },
      );
      throw error;
    }),
    (error) => {
      assert.equal(error, original);
      assert.equal(error.message, 'Original wait failure');
      assert.equal(error.stack, stack);
      assert.equal(error.cause, cause);
      return true;
    },
  );
});
