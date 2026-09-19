import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun } from '../core/index.mjs';
import { createFlightInformationBridge } from '../ui/flight-information-bridge.mjs';

const pack = JSON.parse(
  readFileSync(new URL('../content/packs/sentinel-relay.json', import.meta.url)),
);
const newRun = () => createRun(pack.campaigns[0].levels[0], { classRecipes: pack.classRecipes });
const event = (type, extra = {}) => ({ type, tick: 12, time: 0.1, ...extra });
const value = (fullText, cue = null) => ({ fullText, cue, expiresAt: 5.1 });
const host = { started: true, paused: false };
function completed(bridge, run, events, text = 'observed') {
  const ticket = bridge.begin(run, events);
  events.forEach((_, index) =>
    bridge.observeEvent(ticket, index, () => bridge.observeWarning(run, value(text))),
  );
  assert.equal(bridge.finish(ticket), true);
  return ticket;
}

test('every accepted adoption resets history and advances generation even for the same runId and object', () => {
  const bridge = createFlightInformationBridge(),
    run = newRun();
  const old = bridge.adopt(run, 'saved-id');
  completed(bridge, run, [event('boss.warning')]);
  const adopted = bridge.adopt(run, 'saved-id');
  assert.equal(adopted.attempt, old.attempt);
  assert.ok(adopted.generation > old.generation);
  assert.equal(bridge.isCurrent(old), false);
  assert.equal(bridge.read(host).lastWarning, null);
  assert.equal(bridge.read(host).lastBatch, null);
  assert.equal(adopted.sequence, 0);
});

test('staged and cancelled replacements retain the accepted run owner and current warning', () => {
  const bridge = createFlightInformationBridge(),
    run = newRun();
  bridge.adopt(run, 'accepted');
  bridge.observeWarning(run, value('preserved result'));
  const expected = bridge.token(),
    staged = newRun();
  assert.equal(bridge.begin(staged, []), null);
  assert.equal(bridge.observeWarning(staged, value('draft')), false);
  assert.equal(bridge.isCurrent(expected), true);
  assert.equal(bridge.read(host).lastWarning.fullText, 'preserved result');
});

test('stale owner, newer warning, consumed token and terminal completion cannot invoke an async writer', () => {
  const bridge = createFlightInformationBridge(),
    run = newRun();
  bridge.adopt(run, 'accepted');
  let writes = 0;
  const write = (fullText, cue) => {
    writes++;
    bridge.observeWarning(run, value(fullText, cue));
  };
  const stale = bridge.token();
  bridge.observeWarning(run, value('newer'));
  assert.equal(bridge.commitWarning(stale, { fullText: 'late', cue: null }, write), false);
  const current = bridge.token();
  assert.equal(bridge.commitWarning(current, { fullText: 'ready', cue: 'ready' }, write), true);
  assert.equal(bridge.commitWarning(current, { fullText: 'duplicate', cue: null }, write), false);
  const terminal = bridge.token();
  run.status = 'won';
  assert.equal(
    bridge.commitWarning(terminal, { fullText: 'late live cue', cue: null }, write),
    false,
  );
  assert.equal(writes, 1);
  bridge.observeWarning(run, value('actual terminal caption'));
  assert.equal(bridge.read(host).lastWarning.fullText, 'actual terminal caption');
  bridge.adopt(newRun(), 'replacement');
  assert.equal(bridge.commitWarning(terminal, { fullText: 'old owner', cue: null }, write), false);
});

test('historical batch completion never rewinds a later direct caption or the current state', () => {
  const run = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'accepted');
  const events = [event('player.failed')],
    ticket = bridge.begin(run, events);
  bridge.observeEvent(ticket, 0, () =>
    bridge.observeWarning(run, value('event failure', 'failure')),
  );
  run.status = 'lost';
  bridge.observeWarning(run, value('terminal presentation'));
  const latestSequence = bridge.token().sequence;
  bridge.finish(ticket);
  assert.equal(bridge.token().sequence, latestSequence);
  const view = bridge.read({ started: true, paused: true });
  assert.equal(view.snapshot.status, 'lost');
  assert.equal(view.lastBatch.lastCaption.fullText, 'event failure');
  assert.equal(view.lastWarning.fullText, 'terminal presentation');
});

test('empty batches preserve the last warning and do not invalidate a pending message token', () => {
  const run = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'accepted');
  bridge.observeWarning(run, value('still visible'));
  const expected = bridge.token();
  assert.equal(bridge.finish(bridge.begin(run, [])), true);
  assert.equal(bridge.isCurrent(expected), true);
  run.time = 100;
  assert.equal(bridge.read(host).lastWarning.fullText, 'still visible');
  assert.equal(bridge.read(host).lastWarning.expiresAt, 5.1);
});

test('older batch cannot publish after a newer batch and stale event work cannot become a new warning', () => {
  const run = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'accepted');
  const old = bridge.begin(run, [event('boss.warning')]);
  completed(bridge, run, [event('cells.claimed')], 'newer capture');
  const expected = bridge.token();
  let worked = 0;
  bridge.observeEvent(old, 0, () => {
    worked++;
    bridge.observeWarning(run, value('obsolete'));
  });
  assert.equal(worked, 1);
  assert.equal(bridge.finish(old), false);
  assert.equal(bridge.read(host).lastWarning.fullText, 'newer capture');
  assert.equal(bridge.isCurrent(expected), true);
});

test('replacement inside a callback discards old publication and event scope is cleared in finally', () => {
  const run = newRun(),
    replacement = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'first');
  const ticket = bridge.begin(run, [event('class.switched')]);
  bridge.observeEvent(ticket, 0, () => {
    bridge.adopt(replacement, 'second');
    bridge.observeWarning(run, value('obsolete old callback'));
    bridge.commitWarning(
      bridge.token(),
      { fullText: 'accepted inside adoption', cue: null },
      (fullText, cue) => bridge.observeWarning(replacement, value(fullText, cue)),
    );
    assert.equal(bridge.read(host).lastWarning.fullText, 'accepted inside adoption');
  });
  assert.equal(bridge.finish(ticket), false);
  bridge.observeWarning(replacement, value('accepted second'));
  assert.equal(bridge.read(host).lastWarning.source, 'host');
  assert.equal(bridge.read(host).lastWarning.owner.attempt, 'second');
});

test('nested newer batch survives cancellation and completion of its older caller', () => {
  const run = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'accepted');
  const outer = bridge.begin(run, [event('class.switched')]);
  bridge.observeEvent(outer, 0, () => {
    completed(bridge, run, [event('shield.absorbed')], 'nested shield');
    bridge.observeWarning(run, value('old outer warning'));
  });
  assert.equal(bridge.cancel(outer), false);
  assert.equal(bridge.finish(outer), false);
  assert.equal(bridge.read(host).lastWarning.fullText, 'nested shield');
  assert.equal(bridge.read(host).lastBatch.events[0].type, 'shield.absorbed');
});

test('BFCache suspension retains history, invalidates pending work, and final disposal stays closed', () => {
  const run = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'accepted');
  bridge.observeWarning(run, value('retained'));
  const expected = bridge.token(),
    ticket = bridge.begin(run, [event('cut.started')]);
  bridge.suspend();
  assert.equal(bridge.isCurrent(expected), false);
  assert.equal(bridge.finish(ticket), false);
  assert.equal(bridge.observeWarning(run, value('background')), false);
  assert.equal(bridge.read(host).lastWarning.fullText, 'retained');
  assert.equal(bridge.resume(), true);
  assert.equal(bridge.isCurrent(expected), false);
  assert.equal(bridge.isCurrent(bridge.token()), true);
  bridge.dispose();
  bridge.dispose();
  assert.equal(bridge.read(host), null);
  assert.equal(bridge.resume(), false);
  assert.equal(bridge.adopt(run, 'again'), null);
});

test('incomplete or malformed batches produce explicit diagnostics without taking over host feedback', () => {
  const run = newRun(),
    bridge = createFlightInformationBridge();
  bridge.adopt(run, 'accepted');
  const incomplete = bridge.begin(run, [event('cut.started')]);
  assert.equal(bridge.finish(incomplete), false);
  assert.equal(bridge.read(host).issue, 'incomplete-event-batch');
  const malformed = bridge.begin(run, [{ type: 'future.no-clock' }]);
  let called = 0;
  bridge.observeEvent(malformed, 0, () => called++);
  assert.equal(called, 1);
  assert.equal(bridge.finish(malformed), false);
  assert.equal(bridge.read(host).issue, 'invalid-event-batch');
});
