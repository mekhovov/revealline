import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_FEEDBACK_EVENT_LIMIT,
  combatSoundCue,
  selectCombatCaption,
} from '../ui/combat-feedback.mjs';

test('combat feedback exposes only the five player-facing event families', () => {
  const expected = {
    'combat.locked': { count: 2, cue: 'combat' },
    'combat.fired': { count: 1, cue: 'combat' },
    'combat.impact': { count: 2, cue: 'failure' },
    'combat.eliminated': { count: 2, cue: 'secured' },
    'combat.cancelled': { count: 2, cue: 'secured' },
  };
  for (const [type, { count, cue }] of Object.entries(expected)) {
    const audio = combatSoundCue({ type }),
      caption = selectCombatCaption([{ type }]);
    assert.equal(audio.steps.length, count);
    assert.equal(caption.type, type);
    assert.equal(caption.cue, cue);
    assert(caption.text.length > 0 && caption.text.length <= 96);
    assert(Object.isFrozen(audio));
    assert(Object.isFrozen(audio.steps));
    assert(Object.isFrozen(caption));
  }
  for (const type of [
    'combat.expired',
    'combat.projectileRemoved',
    'combat.shotSkipped',
    'cells.claimed',
  ]) {
    assert.equal(combatSoundCue({ type }), null);
    assert.equal(selectCombatCaption([{ type }]), null);
  }
});

test('caption selection is bounded, priority ordered and stable without mutating events', () => {
  const events = [
      { type: 'combat.eliminated', id: 'a' },
      { type: 'combat.locked', id: 'b' },
      { type: 'combat.locked', id: 'c' },
      { type: 'combat.impact', id: 'd' },
    ],
    before = structuredClone(events),
    selected = selectCombatCaption(events);
  assert.equal(selected.type, 'combat.impact');
  assert.equal(selected.eventIndex, 3);
  assert.deepEqual(events, before);

  const tied = selectCombatCaption([
    { type: 'combat.locked', id: 'first' },
    { type: 'combat.locked', id: 'second' },
  ]);
  assert.equal(tied.eventIndex, 0);

  const overflow = Array.from({ length: COMBAT_FEEDBACK_EVENT_LIMIT + 1 }, () => ({
    type: 'unknown',
  }));
  overflow[COMBAT_FEEDBACK_EVENT_LIMIT] = { type: 'combat.impact' };
  assert.equal(selectCombatCaption(overflow), null);
  assert.equal(selectCombatCaption(null), null);
  assert.equal(selectCombatCaption({ length: 1, 0: { type: 'combat.locked' } }), null);
});

test('caption copy distinguishes craft-only shots from retaining enemies', () => {
  assert.match(selectCombatCaption([{ type: 'combat.locked' }]).text, /craft-only/i);
  assert.match(selectCombatCaption([{ type: 'combat.impact' }]).text, /not its trail/i);
  assert.match(selectCombatCaption([{ type: 'combat.eliminated' }]).text, /never retain/i);
});
