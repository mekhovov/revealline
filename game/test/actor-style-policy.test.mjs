import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTOR_STYLES,
  DEFAULT_ACTOR_STYLE,
  resolveActorStyle,
  resolveActorStyleForBoundary,
} from '../presentation/actor-style-policy.mjs';

test('FPV is the default and campaign is an explicit closed choice', () => {
  assert.deepEqual(ACTOR_STYLES, ['fpv', 'campaign']);
  assert.equal(Object.isFrozen(ACTOR_STYLES), true);
  assert.equal(DEFAULT_ACTOR_STYLE, 'fpv');
  assert.equal(resolveActorStyle(), 'fpv');
  assert.equal(resolveActorStyle('campaign'), 'campaign');
  for (const value of [null, '', 'FPV', 'retro', 'latest', {}, 1])
    assert.throws(() => resolveActorStyle(value), TypeError);
});

test('launch and Next select current intent without inheriting the previous attempt', () => {
  for (const boundary of ['launch', 'next'])
    for (const requested of ACTOR_STYLES) {
      const input = Object.freeze({ requested, boundary, retainedStyle: 'campaign' });
      const result = resolveActorStyleForBoundary(input);
      assert.deepEqual(result, {
        requested,
        actorStyle: requested,
        source: 'preference',
        deferred: false,
      });
      assert.equal(Object.isFrozen(result), true);
      assert.equal(input.retainedStyle, 'campaign');
    }
});

test('Retry, Continue and replay preserve accepted choices rather than today’s default', () => {
  for (const boundary of ['retry', 'continue', 'replay'])
    for (const retainedStyle of ACTOR_STYLES)
      for (const requested of ACTOR_STYLES)
        assert.deepEqual(resolveActorStyleForBoundary({ requested, boundary, retainedStyle }), {
          requested,
          actorStyle: retainedStyle,
          source: 'retained',
          deferred: requested !== retainedStyle,
        });
});

test('historical absence is an explicit preserve decision, not guessed FPV or campaign', () => {
  for (const boundary of ['retry', 'continue', 'replay'])
    assert.deepEqual(resolveActorStyleForBoundary({ boundary }), {
      requested: 'fpv',
      actorStyle: null,
      source: 'retained',
      deferred: true,
    });
});

test('authoring preview never adopts a player preference or previous attempt', () => {
  for (const requested of ACTOR_STYLES)
    assert.deepEqual(
      resolveActorStyleForBoundary({
        requested,
        boundary: 'authored-preview',
        retainedStyle: 'fpv',
      }),
      { requested, actorStyle: null, source: 'authored', deferred: true },
    );
});

test('missing boundaries and invalid retained values fail before any decision', () => {
  assert.throws(() => resolveActorStyleForBoundary(), /explicit/);
  for (const input of [
    { boundary: 'resume' },
    { boundary: 'launch', requested: 'unknown' },
    { boundary: 'continue', retainedStyle: 'unknown' },
  ])
    assert.throws(() => resolveActorStyleForBoundary(input), TypeError);
});
