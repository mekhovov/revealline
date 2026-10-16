import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextualReactionDirector } from '../ui/contextual-reactions.mjs';
import { ACTOR_REACTION_LINES } from '../hunt/actor-reactions.mjs';
import { REACTION_LINES, reactionLine } from '../journey/reactions.mjs';

test('enemy recordings are registered in the same Studio/voice-library catalogue as existing reactions', () => {
  for (const entry of ACTOR_REACTION_LINES) {
    assert.equal(
      REACTION_LINES.find((line) => line.id === entry.id),
      entry,
    );
    assert.equal(reactionLine(entry.id, 'uk').text, entry.text.uk);
  }
});

test('enemy captions use existing priority, once-only events, cooldown and per-attempt budget', () => {
  let time = 910000;
  const presented = [];
  const director = new ContextualReactionDirector({
    now: () => time,
    getLocale: () => 'uk',
    present: (line) => presented.push(line),
  });
  director.reset('actor-director-sample');
  const context = { mode: 'team', attemptId: 'actor-director-sample' };
  const caught = {
    type: 'actor.caught',
    id: 'shield-a',
    actorFamily: 'shield',
    tick: 4,
    player: 1,
  };
  const line = director.events([caught], context);
  assert.equal(line.speaker, 'shield-bearer');
  assert.equal(line.family, 'caught');
  assert.equal(line.player, 1);
  assert.equal(director.count, 1);
  assert.equal(director.events([caught], context), null);
  assert.equal(
    director.events(
      [{ type: 'actor.noticed', id: 'pair-a', actorFamily: 'pair', tick: 5 }],
      context,
    ),
    null,
  );
  time += 20000;
  assert.equal(
    director.events(
      [
        { type: 'actor.noticed', id: 'pair-b', actorFamily: 'pair', tick: 7 },
        { type: 'combat.locked', id: 'urgent', tick: 7 },
      ],
      context,
    ),
    null,
  );
  time += 20000;
  assert.equal(
    director.events(
      [{ type: 'actor.noticed', id: 'pair-b', actorFamily: 'pair', tick: 8 }],
      context,
    ).speaker,
    'rendezvous-pair',
  );
  assert.equal(presented.length, 2);
});
