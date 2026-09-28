import test from 'node:test';
import assert from 'node:assert/strict';
import { outcomeMessage } from '../../authoring/playable-benchmark/outcome.mjs';
import { createBenchmarkSession } from '../../authoring/playable-benchmark/session.mjs';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import { failureExplanation } from '../ui/retry-view.mjs';
import { FIXED_DT } from '../core/index.mjs';

const catalog = await loadBenchmarkCatalog();
const manifest = catalog.entries.find((entry) => entry.id === 'first-return').manifest;
const failure = (cause) => ({ type: 'player.failed', cause });
const completed = { type: 'run.completed' };

function play(session, segments) {
  session.start();
  for (const [ticks, direction] of segments)
    for (let tick = 0; tick < ticks; tick++)
      session.advance(direction ? { direction } : {}, FIXED_DT);
}

test('a live loss uses the actual event cause and existing advice, never the retained run cause', () => {
  const run = { status: 'respawning', lives: 2, failureCause: 'boss-lane' };
  const message = outcomeMessage([failure('enemy-trail')], run);
  const { reason, tip } = failureExplanation('enemy-trail');
  assert.equal(
    message,
    `Life lost. ${reason} ${tip} 2 lives remain. Recovery continues in this attempt.`,
  );
  assert.doesNotMatch(message, /enemy-trail|boss-lane|Retry|campaign|collected pictures/);
  assert.match(outcomeMessage([failure('self-contact')], { ...run, lives: 1 }), /1 life remains/);
  assert.doesNotMatch(
    outcomeMessage([failure('self-contact')], { status: 'respawning' }),
    /lives|undefined|NaN/,
  );
});

test('unknown event causes use the fixed fallback without raw codes or coercion', () => {
  const run = { status: 'respawning', lives: 2, failureCause: 'enemy-player' };
  const unknown = outcomeMessage([failure(undefined)], run);
  const { reason, tip } = failureExplanation(undefined);
  assert.ok(unknown.includes(`${reason} ${tip}`));
  for (const cause of [
    'combat-projectile',
    '<img src=x onerror=x>',
    'constructor',
    {
      toString() {
        throw new Error('Cause must not be coerced');
      },
    },
  ])
    assert.equal(outcomeMessage([failure(cause)], run), unknown);
});

test('terminal completion outranks every other event in either order and a won run ignores stale cause', () => {
  const events = [
    failure('enemy-player'),
    { type: 'player.respawned' },
    { type: 'cells.claimed', indices: [1, 2] },
    completed,
  ];
  const won = { status: 'won', failureCause: 'self-contact', lives: 1, coverage: 0.4 };
  const message = outcomeMessage(events, won);
  assert.equal(
    message,
    'Mission complete. Choose Retry to play this same setup again. No progress was saved.',
  );
  assert.equal(outcomeMessage(events.toReversed(), won), message);
  assert.doesNotMatch(message, /lost|crossed|enemy-player|self-contact|Recovered|Captured/);
  const lost = outcomeMessage(events, { ...won, status: 'lost' });
  assert.ok(lost.includes(failureExplanation('enemy-player').reason));
  assert.match(lost, /^Attempt lost\./);
  assert.doesNotMatch(lost, /Recovery continues|Recovered|Captured|self-contact/);
  assert.ok(
    outcomeMessage([completed], { status: 'lost', failureCause: 'cut-timeout' }).includes(
      failureExplanation('cut-timeout').tip,
    ),
  );
  assert.equal(outcomeMessage([failure('enemy-player')], won), null);
  assert.equal(outcomeMessage([], { status: 'lost', failureCause: 'enemy-player' }), null);
});

test('recovery and meaningful capture replace stale reasons while ordinary ticks preserve the current status', () => {
  const run = { status: 'running', failureCause: 'self-contact', lives: 2, coverage: 0.12345 };
  assert.equal(
    outcomeMessage([{ type: 'player.respawned' }], run),
    'Recovered. 2 lives remain. Continue this attempt.',
  );
  assert.equal(
    outcomeMessage([{ type: 'cells.claimed', indices: [1, 2, 3] }], run),
    'Captured 3 cells. 12.3% revealed.',
  );
  assert.equal(
    outcomeMessage(
      [
        { type: 'cells.claimed', indices: [1] },
        { type: 'cells.claimed', indices: [2] },
      ],
      run,
    ),
    'Captured 2 cells. 12.3% revealed.',
  );
  assert.equal(
    outcomeMessage([{ type: 'cells.claimed', indices: [1] }], { status: 'running' }),
    'Captured 1 cell.',
  );
  assert.equal(
    outcomeMessage([{ type: 'cells.claimed' }], { status: 'running', coverage: NaN }),
    'Area captured.',
  );
  for (const events of [[], [{ type: 'cut.started' }], [{ type: 'pressure.warning' }], null])
    assert.equal(outcomeMessage(events, run), null);
});

test('projection is read-only and does not invoke accessors or inherited status/cause fields', () => {
  const run = Object.freeze({ status: 'respawning', lives: 2, failureCause: 'boss-lane' });
  const events = Object.freeze([Object.freeze(failure('self-contact'))]);
  const before = JSON.stringify({ run, events });
  outcomeMessage(events, run);
  assert.equal(JSON.stringify({ run, events }), before);
  const accessor = () => {
    throw new Error('Projection must not invoke an accessor');
  };
  const event = Object.defineProperty({ type: 'player.failed' }, 'cause', { get: accessor });
  assert.equal(outcomeMessage([event], run), outcomeMessage([failure(undefined)], run));
  const inherited = Object.create({ status: 'respawning' });
  assert.equal(outcomeMessage(events, inherited), null);
  const won = Object.defineProperty({ status: 'won' }, 'failureCause', { get: accessor });
  assert.match(outcomeMessage([completed], won), /^Mission complete\./);
});

test('a real failure, recovery and nonterminal capture produce three messages with no tick spam', () => {
  const messages = [];
  const sourceBefore = JSON.stringify(manifest);
  const session = createBenchmarkSession(manifest, {
    onStep: (events, run) => {
      const message = outcomeMessage(events, run);
      if (message !== null) messages.push({ tick: run.tick, message });
    },
  });
  const control = createBenchmarkSession(manifest);
  const route = [
    [60, 'down'],
    [1, 'up'],
    [200, null],
    [60, 'down'],
    [60, 'right'],
    [100, 'up'],
  ];
  play(session, route);
  play(control, route);
  assert.deepEqual(
    messages.map((entry) => entry.tick),
    [61, 138, 435],
  );
  assert.ok(messages[0].message.includes(failureExplanation('self-contact').reason));
  assert.equal(messages[1].message, 'Recovered. 2 lives remain. Continue this attempt.');
  assert.equal(messages[2].message, 'Captured 20 cells. 0.8% revealed.');
  assert.equal(session.run.status, 'running');
  assert.equal(
    session.run.failureCause,
    'self-contact',
    'Core intentionally retains the historical cause.',
  );
  assert.deepEqual(
    session.run,
    control.run,
    'The display projection does not alter simulation state.',
  );
  assert.equal(JSON.stringify(manifest), sourceBefore);
  session.dispose();
  control.dispose();
});

test('a real win after recovery replaces the retained failure cause and the same-tick capture', () => {
  const messages = [];
  const session = createBenchmarkSession(manifest, {
    onStep: (events, run) => {
      const message = outcomeMessage(events, run);
      if (message !== null)
        messages.push({ tick: run.tick, message, events: events.map((event) => event.type) });
    },
  });
  play(session, [
    [60, 'down'],
    [1, 'up'],
    [200, null],
    [600, 'down'],
  ]);
  assert.equal(session.run.status, 'won');
  assert.equal(session.run.failureCause, 'self-contact');
  assert.deepEqual(
    messages.map((entry) => entry.tick),
    [61, 138, 730],
  );
  const terminal = messages.at(-1);
  assert.ok(terminal.events.includes('cells.claimed'));
  assert.ok(terminal.events.includes('run.completed'));
  assert.match(terminal.message, /^Mission complete\./);
  assert.doesNotMatch(terminal.message, /lost|crossed|self-contact|Captured/);
  session.dispose();
});

test('a real exhausted attempt gives terminal advice instead of promising another recovery', () => {
  const messages = [];
  const session = createBenchmarkSession(manifest, {
    onStep: (events, run) => {
      const message = outcomeMessage(events, run);
      if (message !== null) messages.push(message);
    },
  });
  play(session, [
    [60, 'down'],
    [1, 'up'],
    [200, null],
    [60, 'down'],
    [1, 'up'],
    [200, null],
    [60, 'down'],
    [1, 'up'],
  ]);
  assert.equal(session.run.status, 'lost');
  assert.equal(session.run.tick, 583);
  assert.equal(session.run.lives, 0);
  assert.equal(messages.length, 5);
  assert.match(messages.at(-1), /^Attempt lost\./);
  assert.ok(messages.at(-1).includes(failureExplanation('self-contact').tip));
  assert.doesNotMatch(messages.at(-1), /Recovery continues|lives remain|self-contact/);
  session.dispose();
});
