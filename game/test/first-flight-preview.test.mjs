import test from 'node:test';
import assert from 'node:assert/strict';
import { firstFlightPreviewURL } from '../ui/first-flight-preview.mjs';
import { FIRST_FLIGHT_LESSONS, resolveCourseRequest } from '../first-flight.mjs';

test('finite course links retain both steering choices without an authored scenario handoff', () => {
  for (const lesson of FIRST_FLIGHT_LESSONS)
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const url = new URL(
        firstFlightPreviewURL({ lessonId: lesson.id, turnPolicy }),
        'https://example.test/game/playground/',
      );
      assert.equal(url.pathname, '/game/');
      assert.equal(url.origin, 'https://example.test');
      assert.equal(url.searchParams.has('practice'), false);
      assert.equal(url.searchParams.has('controller-preview'), false);
      assert.deepEqual(resolveCourseRequest(url.searchParams), {
        course: 'first-flight',
        lessonId: lesson.id,
        turnPolicy,
      });
    }
});

test('controller course destinations bind the existing exact per-load token', () => {
  const token = '0123456789abcdef0123456789abcdef';
  const url = new URL(
    firstFlightPreviewURL({
      lessonId: 'empty-side',
      turnPolicy: 'grid-center',
      controllerSession: token,
    }),
    'https://example.test/game/controller-lab/',
  );
  assert.equal(url.searchParams.get('controller-preview'), '1');
  assert.equal(url.searchParams.get('controller-session'), token);
  assert.equal(url.searchParams.has('practice'), false);
  assert.equal(resolveCourseRequest(url.searchParams).lessonId, 'empty-side');
});

test('unregistered lessons, policies and malformed tokens cannot become navigation destinations', () => {
  for (const lessonId of ['__proto__', '../', 'https://other.test', 'close-line&practice=1', null])
    assert.throws(() => firstFlightPreviewURL({ lessonId }));
  for (const turnPolicy of ['diagonal', '', null])
    assert.throws(() => firstFlightPreviewURL({ turnPolicy }));
  for (const controllerSession of [
    '',
    'A'.repeat(32),
    'a'.repeat(31),
    12,
    {},
    'a'.repeat(32) + '&practice=1',
  ])
    assert.throws(() => firstFlightPreviewURL({ controllerSession }));
});
