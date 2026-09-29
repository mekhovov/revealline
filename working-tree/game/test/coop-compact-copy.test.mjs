import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import {
  compactPlayerCopy,
  compactObjectiveCopy,
  compactEventCopy,
  createResponsiveCopy,
} from '../couch/coop-compact-copy.mjs';
import { yardOpening } from './helpers/coop-compact-route.mjs';
const command = (direction = null, support = false) => ({ direction, boost: false, support });
const neutral = () => [command(), command()];
// JS cannot freeze nonempty TypedArrays. Their value-preserving frozen array
// copy makes every nested field read-only, including cells unused by the copy API.
const frozen = (value) =>
  value && typeof value === 'object'
    ? Object.freeze(
        Array.isArray(value) || ArrayBuffer.isView(value)
          ? Array.from(value, frozen)
          : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozen(item)])),
      )
    : value;
function readonly(run, action) {
  const before = JSON.stringify(run),
    copy = frozen(run);
  const result = action(copy);
  assert.equal(JSON.stringify(run), before);
  return result;
}
function create(level = FIRST_CONNECTION, difficulty = 'standard') {
  const run = startCoop(createCoop(level, { difficulty }));
  const events = [];
  const tick = (commands = neutral(), n = 1) => {
    for (let i = 0; i < n; i++) {
      stepCoop(run, commands, FIXED_DT);
      events.push(...structuredClone(run.events));
    }
  };
  tick();
  return { run, events, tick };
}
function down(f, seat = 0) {
  const a = neutral(),
    b = neutral();
  a[seat] = command(seat === 0 ? 'right' : 'left');
  b[seat] = command(seat === 0 ? 'left' : 'right');
  f.tick(a, 45);
  for (let i = 0; i < 30 && f.run.players[seat].status !== 'downed'; i++) f.tick(b);
  assert.equal(f.run.players[seat].status, 'downed');
}
for (const level of [FIRST_CONNECTION, RELAY_YARD])
  test(`${level.id}: actual safe, cutting, downed, reserve recovery and cooldown copy is pure`, () => {
    const f = create(level);
    assert.deepEqual(
      readonly(f.run, (r) => compactPlayerCopy(r, r.players[0])),
      { state: 'Safe ground', charge: 'Support ready', deckCharge: 'Ready' },
    );
    f.tick([command('right'), command()], 30);
    assert.equal(readonly(f.run, (r) => compactPlayerCopy(r, r.players[0])).state, 'Line exposed');
    for (let i = 0; i < 30 && f.run.players[0].status !== 'downed'; i++)
      f.tick([command('left'), command()]);
    const hit = f.events.find((e) => e.type === 'player.downed');
    assert.equal(hit.cause, 'self-trail');
    assert.deepEqual(
      readonly(f.run, (r) => compactPlayerCopy(r, r.players[0])),
      { state: 'Down 12s', charge: 'Crawl to 2', deckCharge: 'Crawl to 2' },
    );
    assert.equal(
      readonly(f.run, (r) => compactEventCopy(r, hit)),
      '1 self-cut.\nAlly: hold\nSupport nearby.',
    );
    const until = f.run.players[0].downedUntil;
    while (f.run.time < until) f.tick();
    assert.equal(
      readonly(f.run, (r) => compactPlayerCopy(r, r.players[0])).state,
      'Shield · safe only',
    );
    assert.equal(
      readonly(f.run, (r) =>
        compactEventCopy(
          r,
          f.events.find((e) => e.type === 'player.revived'),
        ),
      ),
      '1 back. Steer.\n−1 reserve.',
    );
    f.tick([command(null, true), command()]);
    assert.match(
      readonly(f.run, (r) => compactPlayerCopy(r, r.players[0])).charge,
      /^Support [78]\.\ds$/,
    );
    const cooling = readonly(f.run, (r) => compactPlayerCopy(r, r.players[0]));
    assert.equal(cooling.charge, `Support ${cooling.deckCharge}`);
    assert.match(cooling.deckCharge, /^[78]\.\ds$/);
    f.tick(neutral(), 1000);
    assert.deepEqual(
      readonly(f.run, (r) => compactPlayerCopy(r, r.players[0])),
      { state: 'Safe ground', charge: 'Support ready', deckCharge: 'Ready' },
    );
  });
test('actual zero-reserve downed player still points to the correct partner', () => {
  const f = create(FIRST_CONNECTION, 'expert');
  down(f, 1);
  while (f.run.players[1].status === 'downed') f.tick();
  assert.equal(f.run.team.reserves, 0);
  down(f, 1);
  assert.deepEqual(
    readonly(f.run, (r) => compactPlayerCopy(r, r.players[1])),
    { state: 'Down · rescue', charge: 'Crawl to 1', deckCharge: 'Crawl to 1' },
  );
  f.tick(neutral(), 1500);
  assert.equal(f.run.status, 'running');
  assert.equal(f.run.players[1].status, 'downed');
});
test('actual two-player reversal produces explicit shared reserve cost and steering instruction', () => {
  const f = create();
  f.tick([command('right'), command('left')], 45);
  for (let i = 0; i < 30 && !f.events.some((e) => e.type === 'team.recovery'); i++)
    f.tick([command('left'), command('right')]);
  const recovery = f.events.find((e) => e.type === 'team.recovery');
  assert.ok(recovery);
  assert.equal(
    readonly(f.run, (r) => compactEventCopy(r, recovery)),
    'Both back.\n−1 reserve.\nSteer again.',
  );
  assert.deepEqual(
    readonly(f.run, (r) => r.players.map((p) => compactPlayerCopy(r, p).state)),
    ['Shield · safe only', 'Shield · safe only'],
  );
});
test('actual nearby Support rescue exposes progress, cancellation and completed fresh-steering instructions', () => {
  const f = create();
  // Move partner around the safe perimeter through commands only; stop at walls.
  f.tick([command(), command('up')], 270);
  f.tick([command(), command('left')], 1065);
  assert.ok(
    Math.abs(f.run.players[1].x - 0.5) < 0.001 && Math.abs(f.run.players[1].y - 0.5) < 0.001,
  );
  down(f, 0);
  for (let i = 0; i < 300 && !f.run.players[1].rescue; i++)
    f.tick([command(), command('down', true)]);
  assert.ok(f.run.players[1].rescue);
  f.tick([command(), command('down', true)], 30);
  assert.match(readonly(f.run, (r) => compactPlayerCopy(r, r.players[1])).charge, /^Rescue 2\d%$/);
  const rescuing = readonly(f.run, (r) => compactPlayerCopy(r, r.players[1]));
  assert.equal(rescuing.deckCharge, rescuing.charge);
  // Keyup releases Support but keeps the selected down direction latched.
  f.tick([command(), command('down')]);
  const cancelled = f.events.find((e) => e.type === 'rescue.cancelled');
  assert.ok(cancelled?.requiresFreshSteering);
  assert.equal(
    readonly(f.run, (r) => compactEventCopy(r, cancelled)),
    'Rescue stopped.\nSteer, or hold\nSupport nearby.',
  );
  f.tick([command(), command(null, true)], 121);
  const rescued = f.events.find((e) => e.type === 'rescue.completed');
  assert.ok(rescued);
  assert.equal(
    readonly(f.run, (r) => compactEventCopy(r, rescued)),
    '2 rescued ally.\nSteer again.',
  );
  assert.equal(f.run.team.reserves, 3);
  assert.equal(f.run.players[0].status, 'active');
});
test('actual winning Relay Yard replay retains objective order and complete simulation bytes with copy calls', () => {
  const rehearsal = yardOpening('standard', { boost: true, cover: true });
  assert.equal(rehearsal.run.status, 'won');
  const observed = startCoop(createCoop(RELAY_YARD)),
    baseline = startCoop(createCoop(RELAY_YARD));
  const seen = new Set([compactObjectiveCopy(observed)]),
    events = [];
  for (const commands of rehearsal.log) {
    stepCoop(observed, commands);
    stepCoop(baseline, commands);
    readonly(observed, (r) => {
      seen.add(compactObjectiveCopy(r));
      for (const p of r.players) compactPlayerCopy(r, p);
      for (const e of r.events) events.push([e.type, compactEventCopy(r, e)]);
    });
    assert.equal(JSON.stringify(observed), JSON.stringify(baseline));
  }
  assert.equal(observed.status, 'won');
  assert.ok(seen.has('Anchors 0/2\nthen core'));
  assert.ok(seen.has('Core exposed\nCapture new cut'));
  assert.ok(seen.has('All cores secured'));
  assert.ok(
    events.some(
      ([type, text]) => type === 'shield.disabled' && text === 'Relay 1 open.\nUse a new cut.',
    ),
  );
  assert.ok(
    events.some(
      ([type, text]) => type === 'core.defeated' && text === 'Relay 1 clear.\nIts sparks stop.',
    ),
  );
});
test('authored required subset excludes optional relay from compact progress and keeps authored ordinal', () => {
  const level = structuredClone(RELAY_YARD);
  level.strongholds = [
    {
      id: 'optional',
      core: { x: 10.5, y: 5.5 },
      anchors: [
        { x: 8.5, y: 7.5 },
        { x: 12.5, y: 7.5 },
      ],
    },
    ...level.strongholds,
    {
      id: 'other',
      core: { x: 60.5, y: 5.5 },
      anchors: [
        { x: 58.5, y: 7.5 },
        { x: 62.5, y: 7.5 },
      ],
    },
  ];
  level.goal = { cores: ['yard-relay', 'other'] };
  const run = createCoop(level);
  assert.equal(readonly(run, compactObjectiveCopy), 'Cores 0/2\nRelay 2\nAnchors 0/2\nthen core');
  assert.equal(readonly(createCoop(FIRST_CONNECTION), compactObjectiveCopy), 'Reveal 65%');
});
test('modeled event-input contracts distinguish target, cause, locality and affected core without run mutation', () => {
  const run = createCoop(RELAY_YARD);
  const hunter = run.enemies.find((e) => e.type === 'hunter').id,
    drifter = run.enemies.find((e) => e.type === 'drifter').id;
  for (const [cause, enemy, label] of [
    ['line-impact', null, 'spark hit'],
    ['enemy-trail', hunter, 'Hunter hit'],
    ['enemy-player', drifter, 'enemy hit'],
  ]) {
    const event = Object.freeze({ type: 'player.downed', player: 1, cause, enemy });
    assert.equal(
      readonly(run, (r) => compactEventCopy(r, event)),
      `2 ${label}.\nAlly: hold\nSupport nearby.`,
    );
  }
  assert.equal(
    readonly(run, (r) =>
      compactEventCopy(r, {
        type: 'support.pulse',
        player: 0,
        interceptedImpacts: [1],
        slowedEnemies: [1],
      }),
    ),
    '1 blocked spark.',
  );
  assert.equal(
    readonly(run, (r) =>
      compactEventCopy(r, {
        type: 'support.pulse',
        player: 1,
        interceptedImpacts: [],
        slowedEnemies: [1],
      }),
    ),
    '2 slowed threats.',
  );
  assert.equal(
    readonly(run, (r) =>
      compactEventCopy(r, {
        type: 'support.pulse',
        player: 0,
        interceptedImpacts: [],
        slowedEnemies: [],
      }),
    ),
    null,
  );
  assert.equal(
    readonly(run, (r) => compactEventCopy(r, { type: 'future-event', player: 0 })),
    null,
  );
});
test('responsive-copy DOM boundary keeps complete live-region wording and avoids repeated writes', () => {
  class Element {
    constructor() {
      this.children = [];
      this.attributes = {};
      this.value = '';
      this.writes = 0;
      this.className = '';
    }
    set textContent(v) {
      this.value = v;
      this.children = [];
      this.writes++;
    }
    get textContent() {
      return this.value;
    }
    append(...children) {
      this.children.push(...children);
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  }
  const document = { createElement: () => new Element() },
    element = new Element(),
    copy = createResponsiveCopy(document);
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  const full =
    'A Hunter caught an unfinished line. Sunflower needs a rescue. Hold Support nearby or capture 2% new territory.';
  copy(element, full, '1 Hunter hit.\nAlly: hold\nSupport nearby.');
  const [complete, short, deck] = element.children;
  assert.equal(element.children.length, 3);
  assert.deepEqual(
    element.children.map((item) => item.className),
    ['coop-full-copy', 'coop-compact-copy', 'coop-deck-copy'],
  );
  assert.equal(deck.attributes['aria-hidden'], 'true');
  assert.equal(deck.textContent, short.textContent);
  assert.equal(complete.textContent, full);
  assert.equal(short.attributes['aria-hidden'], 'true');
  assert.equal(complete.attributes['aria-hidden'], undefined);
  assert.equal(element.attributes.role, 'status');
  assert.equal(element.attributes['aria-live'], 'polite');
  const writes = [element.writes, complete.writes, short.writes, deck.writes];
  copy(element, full, short.textContent);
  assert.deepEqual([element.writes, complete.writes, short.writes, deck.writes], writes);
  copy(
    element,
    'Both craft are back. One team reserve used. Choose fresh directions together.',
    'Both back.\n−1 reserve.\nSteer again.',
  );
  assert.deepEqual(element.children, [complete, short, deck]);
  assert.equal(complete.writes, writes[1] + 1);
  assert.equal(short.writes, writes[2] + 1);
  assert.equal(deck.writes, writes[3] + 1);
  copy(element, 'Support · 8.0s', 'Support 8.0s', '8.0s');
  assert.equal(complete.textContent, 'Support · 8.0s');
  assert.equal(short.textContent, 'Support 8.0s');
  assert.equal(deck.textContent, '8.0s');
  const distinctWrites = element.children.map((item) => item.writes);
  copy(element, 'Support · 8.0s', 'Support 8.0s', '8.0s');
  assert.deepEqual(
    element.children.map((item) => item.writes),
    distinctWrites,
  );
  assert.equal(complete.attributes['aria-hidden'], undefined);
  assert.equal(short.attributes['aria-hidden'], 'true');
  assert.equal(deck.attributes['aria-hidden'], 'true');
});

test('eight-relay modeled event records retain authored owner after objective advances to the next required relay', () => {
  const level = structuredClone(RELAY_YARD);
  level.strongholds = Array.from({ length: 8 }, (_, index) => {
    const x = 5.5 + index * 8;
    return {
      id: `relay-${index + 1}`,
      core: { x, y: 5.5 },
      anchors: [
        { x: x - 1, y: 7.5 },
        { x: x + 1, y: 7.5 },
      ],
    };
  });
  level.goal = { cores: ['relay-2', 'relay-8'] };
  const original = createCoop(level);
  assert.equal(
    readonly(original, compactObjectiveCopy),
    'Cores 0/2\nRelay 2\nAnchors 0/2\nthen core',
  );
  // These are explicitly modeled pure-input snapshots, not a native gameplay
  // achievement. Actual command-derived completion is covered by the full replay.
  const after = structuredClone(original);
  after.strongholds[1].defeated = true;
  after.strongholds[1].shielded = false;
  after.strongholds[1].anchors.forEach((anchor) => {
    anchor.captured = true;
  });
  const coreTwo = frozen({ type: 'core.defeated', stronghold: 'relay-2' });
  assert.equal(readonly(after, compactObjectiveCopy), 'Cores 1/2\nRelay 8\nAnchors 0/2\nthen core');
  assert.equal(
    readonly(after, (run) => compactEventCopy(run, coreTwo)),
    'Relay 2 clear.\nIts sparks stop.',
  );
  assert.equal(
    readonly(after, (run) =>
      compactEventCopy(run, frozen({ type: 'shield.disabled', stronghold: 'relay-8' })),
    ),
    'Relay 8 open.\nUse a new cut.',
  );
  assert.equal(
    readonly(after, (run) =>
      compactEventCopy(run, frozen({ type: 'core.defeated', stronghold: 'relay-8' })),
    ),
    'Relay 8 clear.\nIts sparks stop.',
  );
  // An optional relay is still identified by its authored position, not its
  // filtered required-list position or the current objective's ordinal.
  assert.equal(
    readonly(after, (run) =>
      compactEventCopy(run, frozen({ type: 'shield.disabled', stronghold: 'relay-7' })),
    ),
    'Relay 7 open.\nUse a new cut.',
  );
  for (const stronghold of [undefined, null, '', 'missing', 'relay-9']) {
    assert.equal(
      readonly(after, (run) =>
        compactEventCopy(run, frozen({ type: 'shield.disabled', stronghold })),
      ),
      'Core open.\nUse a new cut.',
    );
    assert.equal(
      readonly(after, (run) =>
        compactEventCopy(run, frozen({ type: 'core.defeated', stronghold })),
      ),
      'Core clear.\nIts sparks stop.',
    );
  }
  const finished = structuredClone(after);
  finished.strongholds[7].defeated = true;
  assert.equal(readonly(finished, compactObjectiveCopy), 'All cores secured');
  assert.equal(
    readonly(finished, (run) => compactEventCopy(run, coreTwo)),
    'Relay 2 clear.\nIts sparks stop.',
  );
  assert.ok(original.strongholds.every((hold) => !hold.defeated));
});
