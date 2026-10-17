import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { attachFlightInformation, readFlightInformation } from '../ui/flight-information-host.mjs';
import { createRun } from '../core/index.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { nativeCaptureSession } from '../capture-presentation-session.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const campaign = (cause = 'self-contact', goal = 1, lives = 3) => ({
  version: 'xonix-campaign.v1',
  id: 'flight-information-host',
  revision: '1',
  title: 'Flight information ownership',
  classRecipes: classes,
  levels: [{ ...retryFixture(cause).level, goal: { coverage: goal }, rules: { lives } }],
});
const information = (page) => readFlightInformation(page.$('run-message'));
const ticks = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
async function start(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
}
function tap(page, code) {
  page.key(code);
  page.key(code, false);
}

test('retaining completed feedback never projects live state; explicit readers remain fresh', () => {
  const element = {},
    run = createRun(campaign().levels[0]),
    state = { started: true, paused: false };
  let reads = 0;
  const host = attachFlightInformation({
    element,
    getState: () => {
      reads++;
      return state;
    },
    writeWarning: (fullText, cue) => ({ fullText, cue, expiresAt: run.time + 5 }),
  });
  host.adopt(run, 'retained-feedback');
  host.warning('Ready', null, 'host.ready');
  const events = [{ type: 'cut.started', tick: run.tick, time: run.time }],
    ticket = host.begin(run, events);
  host.observeEvent(ticket, 0, () => host.warning('Cutting', 'cut-start'));
  assert.equal(host.finish(ticket), true);
  for (let i = 0; i < 240; i++) assert.equal(host.finish(host.begin(run, [])), true);
  assert.equal(reads, 0, 'Feedback retention does not request a live snapshot.');

  const first = readFlightInformation(element);
  assert.equal(reads, 1);
  assert.equal(first.snapshot.paused, false);
  assert.equal(first.lastBatch.sequence, 241);
  assert.deepEqual(first.lastBatch.events, []);
  assert.equal(first.recentBatches.length, 1);
  assert.deepEqual(first.recentBatches[0].events[0].event, events[0]);
  assert.deepEqual(
    first.recentNotices.map((notice) => notice.fullText),
    ['Ready', 'Cutting'],
  );
  assert.equal(first.lastWarning, first.recentNotices[1]);
  assert.equal(Object.isFrozen(first.recentBatches[0].events[0].event), true);
  state.paused = true;
  assert.equal(host.read().snapshot.paused, true);
  assert.equal(reads, 2);
  assert.equal(first.snapshot.paused, false);
  host.adopt(run, 'replacement');
  assert.deepEqual(host.read().recentNotices, []);
  assert.deepEqual(host.read().recentBatches, []);
  host.dispose();
  assert.equal(readFlightInformation(element), null);
});

test('actual host adopts fresh attempts and reads live state without changing the checkpoint', async (t) => {
  const p = await soloPage(t, { campaign: campaign() });
  const before = authoritativeCheckpoint(p.rendered.run);
  const ready = information(p);
  assert.equal(ready.lastWarning.role, 'host.ready');
  assert.equal(ready.lastWarning.fullText, p.$('run-message').textContent);
  assert.equal(ready.snapshot.paused, true);
  assert.equal(ready.snapshot.started, false);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  await start(p);
  tap(p, 'ArrowDown');
  ticks(p, 20);
  assert.equal(information(p).snapshot.tick, p.rendered.run.tick);
  assert.equal(information(p).snapshot.player.cutting, true);
  p.$('pause-button').click();
  const paused = authoritativeCheckpoint(p.rendered.run);
  assert.equal(information(p).snapshot.paused, true);
  ticks(p, 10);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), paused);
  assert.deepEqual(information(p).owner, ready.owner);
  assert.deepEqual(p.errors, []);
});

test('verified restore of the same saved attempt gets new presentation ownership without rewriting its replay', async (t) => {
  const p = await soloPage(t, { campaign: campaign() });
  await start(p);
  tap(p, 'ArrowDown');
  ticks(p, 20);
  p.$('pause-button').click();
  const before = information(p).owner;
  const slot = 'revealline.suspended.dev.v1';
  const saved = nativeCaptureSession(JSON.parse(p.storage.getItem(slot)));
  p.$('continue-saved').click();
  await settle(() => !p.$('continue-saved').disabled);
  p.frame(0);
  const restored = information(p);
  assert.equal(restored.owner.attempt, before.attempt);
  assert.ok(restored.owner.generation > before.generation);
  assert.equal(restored.lastWarning.role, 'host.restored');
  assert.equal(restored.lastWarning.cue, 'restored');
  assert.equal(restored.lastWarning.fullText, p.$('run-message').textContent);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), saved.replay.checkpoint);
  assert.equal(verifyReplay(saved.replay).match, true);
  assert.equal(restored.snapshot.paused, true);
  assert.deepEqual(p.errors, []);
});

for (const outcome of ['won', 'lost'])
  test(`actual ${outcome} event batch retains captions and lets the terminal host caption win`, async (t) => {
    const p = await soloPage(t, {
      campaign: campaign('self-contact', outcome === 'won' ? 0.1 : 1, 1),
    });
    const soundBatches = [],
      effectBatches = [],
      originalEvents = Soundscape.prototype.events;
    // The feedback director may enrich/coalesce audible cues. Observe the
    // accepted engine batch at its entry while preserving that real processing.
    t.mock.method(Soundscape.prototype, 'events', function (events, ...args) {
      soundBatches.push(structuredClone(events));
      return originalEvents.call(this, events, ...args);
    });
    t.mock.method(BoardPainter.prototype, 'effectsFor', (events, run) =>
      effectBatches.push({ events: structuredClone(events), run }),
    );
    await start(p);
    tap(p, 'ArrowDown');
    if (outcome === 'lost') {
      ticks(p, 30);
      tap(p, 'ArrowUp');
    }
    for (let i = 0; i < 900 && p.rendered.run.status === 'running'; i++) p.frame();
    assert.equal(p.rendered.run.status, outcome);
    const result = information(p),
      batch = result.lastBatch;
    assert.equal(result.lastWarning.role, `host.${outcome}`);
    assert.equal(result.lastWarning.fullText, p.$('run-message').textContent);
    assert.equal(result.lastWarning.expiresAt, p.rendered.run.time + 5);
    assert.deepEqual(
      batch.events.map((entry) => entry.event),
      effectBatches.at(-1).events,
    );
    assert.deepEqual(soundBatches.at(-1), effectBatches.at(-1).events);
    assert.equal(effectBatches.at(-1).run, p.rendered.run);
    assert.ok(
      batch.events.some(
        (entry) => entry.type === (outcome === 'won' ? 'run.completed' : 'player.failed'),
      ),
    );
    assert.ok(batch.messages.length > 0);
    for (const caption of batch.messages) assert.equal(caption.expiresAt, p.rendered.run.time + 5);
    const checkpoint = authoritativeCheckpoint(p.rendered.run);
    ticks(p, 15);
    assert.equal(information(p).lastWarning.fullText, p.$('run-message').textContent);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.deepEqual(p.errors, []);
  });

for (const replacement of ['new-run', 'new-warning', 'pagehide'])
  test(`real music-preview rejection cannot overwrite ${replacement} feedback`, async (t) => {
    const p = await soloPage(t, { campaign: campaign() });
    const gate = deferred();
    t.mock.method(Soundscape.prototype, 'preview', () => gate.promise);
    const pending = p.$('music-preview').onclick();
    const oldOwner = information(p).owner;
    if (replacement === 'new-run') {
      p.$('retry-button').onclick();
      await settle(() => information(p).owner.generation > oldOwner.generation);
    } else if (replacement === 'new-warning') {
      await start(p);
      tap(p, 'ArrowDown');
      ticks(p, 30);
      tap(p, 'ArrowUp');
      p.frame();
      assert.equal(information(p).lastWarning.role, 'player.failed');
    } else p.win.emit('pagehide', { persisted: true });
    const message = p.$('run-message').textContent,
      model = information(p);
    gate.reject(new Error('Late preview failure must stay in its old operation.'));
    await pending;
    assert.equal(p.$('run-message').textContent, message);
    assert.deepEqual(information(p).lastWarning, model.lastWarning);
    assert.deepEqual(p.errors, []);
  });

test('a current music-preview rejection still reaches the caption with complete typed metadata', async (t) => {
  const p = await soloPage(t, { campaign: campaign() });
  t.mock.method(Soundscape.prototype, 'preview', async () => {
    throw new Error('Preview denied. Try again.');
  });
  await p.$('music-preview').onclick();
  assert.equal(p.$('run-message').textContent, 'Preview denied. Try again.');
  assert.equal(information(p).lastWarning.role, 'host.music');
  assert.equal(information(p).lastWarning.cue, null);
  assert.deepEqual(p.errors, []);
});

test('reentrant run replacement during real event feedback cannot publish the old event caption', async (t) => {
  const p = await soloPage(t, { campaign: campaign() });
  await start(p);
  const old = information(p).owner;
  let replaced = false;
  t.mock.method(Soundscape.prototype, 'event', (event) => {
    if (event.type === 'player.failed' && !replaced) {
      replaced = true;
      // Invoke the real defensive handler at this host callback boundary.
      p.$('retry-button').onclick();
    }
  });
  tap(p, 'ArrowDown');
  ticks(p, 30);
  tap(p, 'ArrowUp');
  p.frame();
  assert.equal(replaced, true);
  const current = information(p);
  assert.ok(current.owner.generation > old.generation);
  assert.equal(current.lastBatch, null, 'An old batch is never relabelled as the replacement run.');
  assert.equal(current.lastWarning.role, 'host.ready');
  assert.equal(current.lastWarning.fullText, p.$('run-message').textContent);
  assert.doesNotMatch(p.$('run-message').textContent, /crossed itself|caught/);
  assert.deepEqual(p.errors, []);
});

test('BFCache preserves ownership, invalidates pending messages and never resumes the flight', async (t) => {
  const p = await soloPage(t, { campaign: campaign() });
  await start(p);
  tap(p, 'ArrowDown');
  ticks(p, 20);
  const owner = information(p).owner;
  p.win.emit('pagehide', { persisted: true });
  const checkpoint = authoritativeCheckpoint(p.rendered.run);
  p.win.emit('pageshow', { persisted: true });
  ticks(p, 15);
  assert.deepEqual(information(p).owner, owner);
  assert.equal(information(p).snapshot.paused, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  p.win.emit('pagehide', { persisted: false });
  assert.equal(information(p), null);
  assert.deepEqual(p.errors, []);
});
