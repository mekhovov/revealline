import test from 'node:test';
import assert from 'node:assert/strict';
import { missionLibraryHref, readMissionLibraryReturn } from '../mission-library/handoff.mjs';

const token = 'a'.repeat(32);
const build = (overrides = {}) =>
  new URL(
    missionLibraryHref({
      baseURL: 'https://example.test/releases/v0.83.0/site/game/?return=untrusted#old',
      currentMode: 'solo',
      mode: 'team',
      journey: 'team-spatial-originals-1',
      missionId: '["exact","mission"]',
      sourceJourney: 'legacy',
      ...overrides,
    }),
  );

test('source Legacy, new and historical Journey intent is independent of selected destination owner', () => {
  for (const currentMode of ['solo', 'versus']) {
    for (const sourceJourney of ['legacy', 'whole-spatial-v5', 'opening', 'whole-originals-v2']) {
      for (const journey of ['legacy', 'team-spatial-originals-1']) {
        const target = build({
          currentMode,
          sourceJourney,
          journey,
          baseURL: `https://example.test/releases/v0.83.0/site/game/${currentMode === 'versus' ? 'couch/' : ''}`,
        });
        assert.equal(target.pathname, '/releases/v0.83.0/site/game/couch/relay-rescue.html');
        assert.equal(target.searchParams.get('journey'), journey);
        assert.deepEqual(readMissionLibraryReturn(target.searchParams, { mode: 'team' }), {
          mode: currentMode,
          journey: sourceJourney,
        });
      }
    }
  }
  const same = build({ mode: 'solo', journey: 'whole-spatial-v5' });
  assert.equal(same.searchParams.has('return'), false);
  assert.equal(same.searchParams.has('journey-return'), false);
  assert.equal(readMissionLibraryReturn(same.searchParams, { mode: 'solo' }), null);
});

test('only explicitly issued mode-qualified Legacy Solo return tokens are transported', () => {
  for (const mode of ['team', 'versus']) {
    const target = build({ mode, journey: 'legacy', returnToken: token });
    assert.equal(
      target.searchParams.get(mode === 'team' ? 'return-token' : 'return-token-v2'),
      token,
    );
    assert.deepEqual(readMissionLibraryReturn(target.searchParams, { mode }), {
      mode: 'solo',
      journey: 'legacy',
    });
  }
  for (const override of [
    { currentMode: 'versus' },
    { sourceJourney: 'opening' },
    { mode: 'solo', journey: 'legacy' },
    { returnToken: 'not-a-token' },
  ])
    assert.throws(() => build({ returnToken: token, ...override }), /return token/);
  assert.throws(() => build({ sourceJourney: 'https://attacker.test' }), /source Journey/);
});

test('ambiguous or malformed source hints never override fixed receiver navigation', () => {
  for (const alter of [
    (p) => p.append('journey', 'legacy'),
    (p) => p.append('library-mission', 'different'),
    (p) => p.append('return', 'solo'),
    (p) => p.append('journey-return', 'opening'),
    (p) => p.set('return', 'team'),
    (p) => p.set('journey-return', '//attacker.test/'),
    (p) => p.set('journey', 'opening'),
    (p) => p.set('return-token', 'not-a-token'),
    (p) => p.set('return-token-v2', token),
    (p) => p.set('mode-return', token),
    (p) => p.set('practice', '1'),
    (p) => p.delete('library-mission'),
    (p) => p.delete('journey'),
  ]) {
    const { searchParams } = build();
    alter(searchParams);
    assert.equal(
      readMissionLibraryReturn(searchParams, { mode: 'team' }),
      null,
      String(searchParams),
    );
  }
  const target = build({ returnToken: token });
  target.searchParams.append('return-token', token);
  assert.equal(readMissionLibraryReturn(target.searchParams, { mode: 'team' }), null);
  assert.equal(readMissionLibraryReturn({}), null);
});

test('Team sources have finite return routes in both Solo and Versus receivers', () => {
  for (const mode of ['solo', 'versus'])
    for (const sourceJourney of [
      'legacy',
      'team-spatial-originals-1',
      'team-greybox',
      'team-originals',
      'team-pressure-originals-1',
      'team-timed-originals',
      'team-window-spatial-1',
      'team-depot-spatial-1',
    ]) {
      const target = build({
        baseURL: 'file:///game/couch/relay-rescue.html',
        currentMode: 'team',
        mode,
        journey: 'opening',
        sourceJourney,
      });
      assert.equal(target.protocol, 'file:');
      assert.deepEqual(readMissionLibraryReturn(target.searchParams, { mode }), {
        mode: 'team',
        journey: sourceJourney,
      });
    }
});
