import test from 'node:test';
import assert from 'node:assert/strict';
import { roomSupportState } from '../online/room-support-summary.mjs';
import { supportSnapshot } from '../local-support-summary.mjs';

test('Rooms projection uses distinct current transport phases and accepted room status only', () => {
  for (const phase of ['idle', 'connecting', 'recovering', 'abandoned'])
    assert.equal(roomSupportState({ phase, status: 'playing' }), phase);
  for (const status of ['waiting', 'playing', 'paused', 'finished'])
    assert.equal(roomSupportState({ phase: 'connected', status }), status);
  for (const value of [{}, { phase: 'connected', status: 'invented' }, { phase: 'private-token' }])
    assert.equal(roomSupportState(value), null);
});

test('Rooms collector admits its state/scalar facts without changing existing host allowlists or leaking room data', () => {
  for (const state of [
    'idle',
    'connecting',
    'recovering',
    'waiting',
    'playing',
    'paused',
    'finished',
    'abandoned',
  ]) {
    const value = supportSnapshot({
      kind: 'private-room',
      state,
      roomId: 'private-room-id',
      credentials: 'private-token',
      seats: ['private-seat'],
      recipe: 'private-recipe',
    });
    assert.equal(value.scope, 'private-room-game-shell');
    assert.equal(value.game.host, 'private-room');
    assert.equal(value.game.state, state);
    assert.equal(value.game.saving.writable, null);
    assert.doesNotMatch(
      JSON.stringify(value),
      /private-token|private-room-id|private-seat|private-recipe/,
    );
  }
  for (const kind of [
    'solo',
    'journey',
    'installed-edition',
    'practice',
    'capture-team',
    'capture-versus',
    'fpv-academy',
  ]) {
    assert.equal(supportSnapshot({ kind, state: 'recovering' }).game.state, 'unavailable');
    assert.equal(supportSnapshot({ kind }).game.host, kind);
  }
});
