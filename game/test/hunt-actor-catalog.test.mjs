import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTOR_FAMILIES,
  ACTOR_CASTS,
  ACTOR_VISUALS,
  actorDefinition,
  actorVisual,
  actorFieldGuide,
  actorCapability,
  resolveActorFamily,
} from '../hunt/actor-catalog.mjs';
import {
  ACTOR_REACTION_LINES,
  actorReactionLine,
  actorEventReaction,
} from '../hunt/actor-reactions.mjs';
import { drawHuntActor } from '../hunt/actor-art.mjs';
import { drawClassicTarget } from '../snake/classic-target-art.mjs';
import { huntActorPresentation } from '../hunt/presentation-catalog.mjs';
import { createHuntDestruction, drawHumanoidPixelBody } from '../hunt/destruction.mjs';

function context() {
  const commands = [],
    stack = [];
  return {
    commands,
    fillStyle: '#000000',
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    save() {
      stack.push([this.fillStyle, this.imageSmoothingEnabled, this.globalAlpha]);
      commands.push(['save']);
    },
    restore() {
      [this.fillStyle, this.imageSmoothingEnabled, this.globalAlpha] = stack.pop();
      commands.push(['restore']);
    },
    translate(...args) {
      commands.push(['translate', ...args]);
    },
    scale(...args) {
      commands.push(['scale', ...args]);
    },
    rotate(...args) {
      commands.push(['rotate', ...args]);
    },
    fillRect(...args) {
      commands.push(['rect', this.fillStyle, ...args]);
    },
  };
}

test('shared catalogue owns twelve deeply immutable bilingual families and thirty-six distinct visual identities', () => {
  assert.equal(ACTOR_FAMILIES.length, 12);
  assert.equal(ACTOR_CASTS.length, 3);
  assert.equal(ACTOR_VISUALS.length, 36);
  assert.equal(new Set(ACTOR_VISUALS.map((entry) => entry.id)).size, 36);
  for (const family of ACTOR_FAMILIES) {
    assert.ok(Object.isFrozen(family.capabilities));
    for (const locale of ['en', 'uk']) {
      const guide = actorFieldGuide(family.id, locale);
      for (const key of ['name', 'goal', 'tell', 'counter']) assert.ok(guide[key].length > 3);
    }
    for (const cast of ACTOR_CASTS) {
      const visual = actorVisual(family.id, cast.id);
      assert.ok(Object.isFrozen(visual.palette));
      assert.equal(visual.decodedBytes, 0);
      assert.equal(huntActorPresentation(family.id, cast.id).palette.coat, visual.palette.coat);
    }
  }
});

test('catalogue capabilities cannot accidentally admit armed guards or wardens to Snake and flight', () => {
  assert.equal(actorCapability('guard', 'snake'), null);
  assert.equal(actorCapability('guard', 'flight'), null);
  assert.equal(actorCapability('relay-warden', 'snake'), null);
  assert.equal(actorCapability('relay-warden', 'flight'), null);
  for (const specialist of ['shield', 'brace']) {
    assert.equal(actorDefinition(specialist).contact, 'conditional');
    for (const engine of ['capture', 'snake', 'flight'])
      assert.ok(actorCapability(specialist, engine).requires.includes('specialist-opt-in'));
  }
  assert.equal(resolveActorFamily('pair'), 'rendezvous-pair');
  assert.equal(resolveActorFamily('still'), 'lookout');
  for (const unknown of [null, {}, '__proto__', 'constructor', 'unregistered']) {
    assert.equal(actorDefinition(unknown), null);
    assert.equal(actorVisual(unknown), null);
    assert.equal(actorFieldGuide(unknown), null);
    assert.equal(actorCapability(unknown, 'snake'), null);
  }
});

test('every family has exactly two stable optional reaction IDs and both locales', () => {
  assert.equal(ACTOR_REACTION_LINES.length, 24);
  assert.equal(new Set(ACTOR_REACTION_LINES.map((line) => line.id)).size, 24);
  for (const family of ACTOR_FAMILIES) {
    for (const [index, event] of ['notice', 'caught'].entries()) {
      for (const locale of ['en', 'uk']) {
        const line = actorEventReaction(family.id, event, locale);
        assert.equal(line.id, family.reactionIds[index]);
        assert.equal(line.priority, 'incidental');
        assert.equal(line.speaker, family.id);
        assert.ok(line.text.length > 3);
        assert.equal(actorReactionLine(line.id, locale).text, line.text);
      }
    }
  }
  assert.equal(actorEventReaction('runner', 'arbitrary'), null);
  assert.equal(actorReactionLine('unregistered'), null);
});

test('all visual variants have bounded distinct procedural drawings in compact and detailed views', () => {
  for (const detail of ['compact', 'detailed']) {
    const drawings = new Set();
    for (const visual of ACTOR_VISUALS) {
      const ctx = context();
      drawHuntActor(ctx, 0, 0, 28, 1, {
        visualId: visual.id,
        detail,
        heading: 'up',
        phase: 'rest',
      });
      assert.equal(ctx.imageSmoothingEnabled, true);
      assert.equal(ctx.fillStyle, '#000000');
      assert.ok(ctx.commands.length < 180);
      for (const [method, , x, y, width, height] of ctx.commands) {
        if (method !== 'rect') continue;
        assert.ok([x, y, width, height].every(Number.isFinite));
        assert.ok(width > 0 && height > 0);
      }
      drawings.add(JSON.stringify(ctx.commands));
    }
    assert.equal(drawings.size, 36);
  }
});

test('Classic keeps its public painter API and freezes gait without changing visible specialist phase', () => {
  const options = Object.freeze({
    kind: 'shield',
    heading: 'left',
    phase: 'turning',
    nextHeading: 'up',
    frozen: true,
    cast: 'tactical',
  });
  const before = JSON.stringify(options);
  const classic = context(),
    shared = context();
  drawClassicTarget(classic, 4, 5, 28, 2, options);
  drawHuntActor(shared, 4, 5, 28, 2, options);
  assert.deepEqual(classic.commands, shared.commands);
  assert.equal(JSON.stringify(options), before);
  const later = context();
  drawHuntActor(later, 4, 5, 28, 0, { ...options, timeMs: 99999 });
  assert.deepEqual(shared.commands, later.commands);
  const closed = context(),
    open = context();
  drawHuntActor(closed, 0, 0, 28, 0, { kind: 'brace', phase: 'warning', frozen: true });
  drawHuntActor(open, 0, 0, 28, 0, { kind: 'brace', phase: 'rest', frozen: true });
  assert.notDeepEqual(closed.commands, open.commands);
});

test('invalid placement draws nothing and unrecognized appearance falls back to readable ordinary art', () => {
  const ctx = context();
  for (const size of [0, -1, Infinity, NaN]) drawHuntActor(ctx, 0, 0, size);
  assert.equal(ctx.commands.length, 0);
  const reference = context();
  drawHuntActor(ctx, 0, 0, 16, 0, { kind: 'unregistered', cast: 'unregistered' });
  drawHuntActor(reference, 0, 0, 16, 0, { kind: 'runner' });
  assert.deepEqual(ctx.commands, reference.commands);
});

test('Capture uses the shared compact identity and accepted pursuit behavior without mutating the actor', () => {
  const actor = Object.freeze({
    kind: 'runner',
    pose: 1,
    cast: 'rivals',
    pursuit: Object.freeze({ behavior: 'refuge', phase: 'recovering' }),
  });
  const ctx = context(),
    reference = context();
  drawHumanoidPixelBody(ctx, actor);
  drawHuntActor(reference, 0, 0, 16, 1, {
    ...actor,
    kind: 'refuge',
    phase: 'rest',
    state: undefined,
    palette: {},
    token: false,
    detail: 'compact',
  });
  assert.deepEqual(ctx.commands, reference.commands);
});

test('clean catches use bounded non-bloody feedback; Reduced effects clears animations and restore replays none', () => {
  let released = 0;
  const budget = {
    claim() {
      return {
        active: true,
        particles: 64,
        envelopes: 2,
        release() {
          this.active = false;
          released++;
        },
      };
    },
  };
  const painter = createHuntDestruction({ budget, now: () => 0 });
  const first = { valid: true, eliminations: [] };
  const caught = {
    valid: true,
    eliminations: [
      { id: 'parcel', kind: 'courier', cast: 'rivals', x: 2, y: 2, tick: 3, cause: 'contact' },
    ],
  };
  painter.advance(first, 0, { key: 'attempt', brutal: false });
  painter.advance(caught, 0.016, { key: 'attempt', brutal: false });
  assert.equal(painter.snapshot().bursts, 1);
  const ctx = context();
  painter.draw(ctx);
  assert.ok(painter.snapshot().particles <= 4);
  assert.ok(painter.snapshot().envelopes <= 1);
  assert.ok(ctx.commands.some(([method, color]) => method === 'rect' && color === '#c99455'));
  assert.ok(
    !ctx.commands.some(
      ([method, color]) => method === 'rect' && ['#8c1934', '#d75a6b'].includes(color),
    ),
  );
  painter.advance(caught, 0.016, { key: 'attempt', brutal: false, reduced: true });
  assert.equal(painter.snapshot().bursts, 0);
  assert.ok(released > 0);
  painter.advance(caught, 0, { key: 'restored', brutal: true });
  assert.equal(painter.snapshot().bursts, 0);
  painter.reset();
});
