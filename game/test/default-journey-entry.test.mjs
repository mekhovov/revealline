import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_JOURNEY_ROUTES, resolveJourneyRequest } from '../content-design/default-entry.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../content-design/mode-href.mjs';
import { authoredModeDestinations } from '../ui/authored-mode-routes.mjs';

for (const mode of ['solo', 'versus', 'team']) {
  const resolve = (search, options = {}) =>
    resolveJourneyRequest(new URLSearchParams(search), { mode, ...options });
  test(`${mode}: ordinary entry selects the fixed new Journey without consulting saves`, () => {
    assert.equal(resolve(''), DEFAULT_JOURNEY_ROUTES[mode]);
    assert.equal(resolve('return=solo'), DEFAULT_JOURNEY_ROUTES[mode]);
    assert.equal(resolve('journey-return=opening&return=solo'), DEFAULT_JOURNEY_ROUTES[mode]);
    assert.equal(resolve('unrelated=value'), DEFAULT_JOURNEY_ROUTES[mode]);
  });
  test(`${mode}: explicit historical, legacy, empty and unknown route values stay explicit`, () => {
    for (const route of [
      ...AUTHORED_JOURNEY_ROUTE_IDS,
      'legacy',
      '1',
      '',
      'unknown',
      'team-originals',
      'team-spatial-originals-1',
    ])
      assert.equal(resolve(`journey=${encodeURIComponent(route)}`), route);
    assert.equal(resolve('journey=opening&journey=authored'), mode === 'team' ? null : 'opening');
  });
  test(`${mode}: legacy handoff parameters retain existing validation including malformed values`, () => {
    for (const key of [
      'pack',
      'campaign',
      'level',
      'play',
      'practice',
      'course',
      'lesson',
      'workshop',
      'return-token',
      'return-token-v2',
      'mode-return',
      'mode-return-v2',
    ]) {
      assert.equal(resolve(`${key}=`), null, key);
      assert.equal(resolve(`${key}=unknown&${key}=duplicate`), null, key);
    }
    assert.equal(resolve('pack=old&journey=opening'), 'opening');
    assert.equal(resolve('journey=opening', { auxiliary: true }), null);
    assert.equal(resolve('', { auxiliary: true }), null);
  });
}

test('legacy mode links cannot silently enroll the new default', () => {
  assert.deepEqual(authoredModeDestinations('solo', 'legacy'), {
    versus: 'couch/?journey=legacy&return=solo',
    team: 'couch/relay-rescue.html?journey=legacy&return=solo',
  });
  assert.deepEqual(authoredModeDestinations('versus', 'legacy'), {
    solo: '../?journey=legacy',
    team: 'relay-rescue.html?journey=legacy&return=versus',
  });
  assert.equal(authoredModeDestinations('team', 'legacy'), null);
});

test('entry resolver rejects unsupported modes without interpreting arbitrary URL targets', () => {
  assert.throws(() => resolveJourneyRequest(''), TypeError);
  assert.throws(() => resolveJourneyRequest(new URLSearchParams(), { mode: 'online' }), TypeError);
  assert.equal(Object.isFrozen(DEFAULT_JOURNEY_ROUTES), true);
});
