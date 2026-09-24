import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, saveLibrary, updatePreferences } from '../library.mjs';
import { createApexSpatialCandidates } from '../content-design/apex-spatial-candidates.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'details-host',
  revision: '1',
  title: 'Field details',
  classRecipes: classes,
  levels: [
    {
      ...retryFixture('self-contact').level,
      goal: { coverage: 1 },
      rules: { lives: 3, respawnSeconds: 0.1 },
    },
  ],
};
const info = (p) => readFlightInformation(p.$('run-message'));
const ticks = (p, n) => {
  for (let i = 0; i < n; i++) p.frame();
};
const tap = (p, code) => {
  p.key(code);
  p.key(code, false);
};
async function start(p) {
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
}
function keyboard(p, code, key = code, extra = {}) {
  const el = p.doc.activeElement;
  const down = el.emit('keydown', { code, key, repeat: false, ...extra });
  // Native button activation belongs to the modeled browser boundary.
  if (!down.defaultPrevented && ['Enter', 'Space'].includes(code)) el.click();
  if (!down.defaultPrevented && code === 'Escape') {
    const dialog = el.closest('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  el.emit('keyup', { code, key, repeat: false, ...extra });
  return down;
}
function open(p) {
  p.$('overlay-field-details').focus();
  p.$('overlay-field-details').click();
  assert.equal(p.$('flight-details-dialog').open, true);
}
for (const turnPolicy of ['immediate', 'grid-center'])
  test(`mounted ${turnPolicy}: Details reading and Back preserve flight; only Resume moves`, async (t) => {
    const storage = memoryStorage();
    saveLibrary(
      storage,
      'revealline.library.dev.v1',
      updatePreferences(emptyLibrary(), { turnPolicy }),
    );
    const p = await soloPage(t, { campaign, storage });
    await start(p);
    tap(p, 'ArrowDown');
    ticks(p, 13);
    tap(p, 'ArrowRight');
    ticks(p, 1);
    p.$('pause-button').click();
    const before = authoritativeCheckpoint(p.rendered.run),
      owner = info(p).owner;
    p.$('pause-mission-info-toggle').focus();
    keyboard(p, 'Enter');
    assert.equal(p.$('pause-mission-info').open, true);
    p.$('overlay-field-details').focus();
    keyboard(p, 'Enter');
    assert.equal(p.$('flight-details-dialog').open, true);
    assert.equal(p.doc.activeElement, p.$('flight-details-read'));
    const text = p.$('flight-details-content').textContent;
    assert.match(text, /unfinished line remains exposed/);
    assert.doesNotMatch(text, /0 \/ 0 required objectives/);
    assert.equal(info(p).snapshot.objectives.total, 0);
    assert.match(text, /Controls after Resume/);
    keyboard(p, 'Enter');
    assert.equal(p.doc.activeElement, p.$('flight-details-reading'));
    assert.equal(p.$('flight-details-reading-done').disabled, false);
    assert.equal(keyboard(p, 'Tab').defaultPrevented, true);
    assert.equal(p.doc.activeElement, p.$('flight-details-reading-done'));
    assert.equal(p.$('flight-details-read').getAttribute('aria-pressed'), 'true');
    assert.equal(p.$('flight-details-reading-done').disabled, false);
    p.doc.activeElement.emit('keydown', { code: 'ShiftLeft', key: 'Shift', shiftKey: true });
    assert.equal(keyboard(p, 'Tab', 'Tab', { shiftKey: true }).defaultPrevented, true);
    p.doc.activeElement.emit('keyup', { code: 'ShiftLeft', key: 'Shift', shiftKey: false });
    assert.equal(p.doc.activeElement, p.$('flight-details-reading'));
    assert.equal(p.$('flight-details-read').getAttribute('aria-pressed'), 'true');
    keyboard(p, 'Tab');
    keyboard(p, 'Enter');
    assert.equal(p.doc.activeElement, p.$('flight-details-read'));
    assert.equal(p.$('flight-details-reading-done').disabled, true);
    assert.equal(p.$('flight-details-dialog').open, true);
    keyboard(p, 'Enter');
    keyboard(p, 'Escape');
    assert.equal(
      p.$('flight-details-dialog').open,
      true,
      'Leaving the reader does not close its owning dialog',
    );
    keyboard(p, 'Escape');
    await Promise.resolve();
    assert.equal(p.$('flight-details-dialog').open, false);
    assert.equal(p.doc.activeElement, p.$('overlay-field-details'));
    ticks(p, 20);
    assert.equal(info(p).snapshot.paused, true);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
    assert.deepEqual(info(p).owner, owner);
    const saved = JSON.parse(storage.getItem('revealline.suspended.dev.v1'));
    assert.equal(verifyReplay(saved.replay).match, true);
    await start(p);
    ticks(p, 8);
    assert.ok(p.rendered.run.tick > saved.replay.ticks);
    assert.deepEqual(p.errors, []);
  });
test('actual notices survive later empty fixed-step batches and same-ID restore resets the history', async (t) => {
  const p = await soloPage(t, { campaign });
  await start(p);
  tap(p, 'ArrowDown');
  ticks(p, 30);
  tap(p, 'ArrowUp');
  p.frame(100);
  const retained = info(p);
  assert.ok(retained.recentNotices.some((n) => n.role === 'player.failed'));
  assert.ok(retained.recentBatches.some((b) => b.events.some((e) => e.type === 'player.failed')));
  ticks(p, 30);
  assert.ok(info(p).recentNotices.some((n) => n.role === 'player.failed'));
  assert.deepEqual(info(p).lastBatch.events, []);
  p.$('pause-button').click();
  open(p);
  assert.match(p.$('flight-details-content').textContent, /Recent messages/);
  p.$('flight-details-back').click();
  await Promise.resolve();
  const owner = info(p).owner;
  p.$('continue-saved').click();
  await settle(() => !p.$('continue-saved').disabled);
  assert.equal(info(p).owner.attempt, owner.attempt);
  assert.ok(info(p).owner.generation > owner.generation);
  assert.deepEqual(
    info(p).recentNotices.map((n) => n.role),
    ['host.restored'],
  );
  assert.deepEqual(info(p).recentBatches, []);
  assert.deepEqual(p.errors, []);
});
test('actual current and stale async notices keep full copy without opening or refreshing a reading dialog', async (t) => {
  const p = await soloPage(t, { campaign });
  await start(p);
  p.$('pause-button').click();
  open(p);
  const full = 'A complete current music failure, including recovery guidance. '.repeat(20);
  t.mock.method(Soundscape.prototype, 'preview', async () => {
    throw new Error(full);
  });
  const focus = p.doc.activeElement,
    copy = p.$('flight-details-content').textContent;
  await p.$('music-preview').onclick();
  assert.equal(info(p).lastWarning.fullText, full);
  assert.equal(p.doc.activeElement, focus);
  assert.equal(
    p.$('flight-details-content').textContent,
    copy,
    'Reading stays stable; re-open to refresh',
  );
  p.$('flight-details-back').click();
  await Promise.resolve();
  open(p);
  assert.ok(p.$('flight-details-content').textContent.includes(full));
  p.$('flight-details-back').click();
  await Promise.resolve();
  const gate = deferred();
  t.mock.method(Soundscape.prototype, 'preview', () => gate.promise);
  const pending = p.$('music-preview').onclick();
  const previousOwner = info(p).owner;
  p.$('retry-button').onclick();
  await settle(() => info(p).owner.generation > previousOwner.generation);
  const before = info(p).recentNotices;
  gate.reject(new Error('Stale'));
  await pending;
  assert.deepEqual(info(p).recentNotices, before);
  assert.equal(p.$('flight-details-dialog').open, false);
  assert.deepEqual(p.errors, []);
});
test('accepted notice history is bounded with explicit omission while current full text is never truncated', async (t) => {
  const p = await soloPage(t, { campaign });
  await start(p);
  p.$('pause-button').click();
  let i = 0;
  t.mock.method(Soundscape.prototype, 'preview', async () => {
    throw new Error(`Message ${++i}`);
  });
  for (let n = 0; n < 20; n++) await p.$('music-preview').onclick();
  assert.equal(info(p).recentNotices.length, 16);
  assert.ok(info(p).omittedNotices >= 4);
  const full = 'A'.repeat(40000);
  t.mock.method(Soundscape.prototype, 'preview', async () => {
    throw new Error(full);
  });
  await p.$('music-preview').onclick();
  assert.equal(info(p).lastWarning.fullText, full);
  open(p);
  assert.ok(p.$('flight-details-content').textContent.includes(full));
  assert.match(p.$('flight-details-content').textContent, /Earlier messages are no longer shown/);
  assert.deepEqual(p.errors, []);
});
test('Details does not reopen or steal focus after run replacement, nested dialog, BFCache or teardown', async (t) => {
  const p = await soloPage(t, { campaign });
  await start(p);
  p.$('pause-button').click();
  open(p);
  const previousOwner = info(p).owner;
  p.$('retry-button').onclick();
  await settle(() => info(p).owner.generation > previousOwner.generation);
  p.frame(0);
  assert.equal(p.$('flight-details-dialog').open, false);
  await start(p);
  p.$('pause-button').click();
  open(p);
  p.$('flight-details-back').click();
  p.$('settings-dialog').showModal();
  const destination = p.$('music-preview');
  destination.focus();
  await Promise.resolve();
  assert.equal(p.doc.activeElement, destination);
  p.$('settings-dialog').close();
  open(p);
  p.win.emit('pagehide', { persisted: true });
  p.win.emit('pageshow', { persisted: true });
  await Promise.resolve();
  assert.equal(p.$('flight-details-dialog').open, false);
  assert.equal(info(p).snapshot.paused, true);
  open(p);
  p.win.emit('pagehide', { persisted: false });
  p.$('flight-details-dialog').emit('close');
  await Promise.resolve();
  assert.equal(p.$('flight-details-dialog').open, false);
  assert.equal(info(p), null);
  assert.deepEqual(p.errors, []);
});

const scenarioTemplate = JSON.parse(
  readFileSync(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
);
const practice = (level, format = 'xonix-playground.v5') => ({
  campaign,
  search: '?practice=1',
  previewStorage: memoryStorage({
    'revealline.playground.current': JSON.stringify({ ...scenarioTemplate, format, level }),
  }),
});
const classicLevel = () => ({
  version: 'xonix-level.v4',
  id: 'details-classic',
  revision: '1',
  name: 'Typed field details',
  width: 72,
  height: 36,
  encounter: null,
  classic: {
    version: 'classic.v1',
    terrain: [],
    powerups: [{ id: 'freeze', kind: 'enemy-freeze', x: 18.5, y: 10.5 }],
    arcadeActions: { version: 'arcade-actions.v1' },
  },
  spawn: { x: 40.5, y: 0.5 },
  goal: { coverage: 0.9 },
  enemies: [
    {
      id: 'lane',
      type: 'lane-boss',
      x: 25.5,
      y: 15.5,
      axis: 'horizontal',
      warningSeconds: 1,
      activeSeconds: 0.5,
      period: 4,
    },
  ],
  objectives: [
    { id: 'required', x: 45.5, y: 15.5, required: true },
    { id: 'optional', x: 44.5, y: 14.5, required: false },
  ],
});
test('mounted Classic Details retains typed lane warnings, required objectives and automatic-only actions', async (t) => {
  const p = await soloPage(t, practice(classicLevel()));
  await start(p);
  ticks(p, 241);
  p.$('pause-button').click();
  const source = info(p);
  assert.equal(source.snapshot.laneBosses[0].phase, 'warning');
  open(p);
  const text = p.$('flight-details-content').textContent;
  assert.match(text, /0 \/ 1 required objectives/);
  assert.match(text, /Leave the highlighted horizontal lane/);
  assert.doesNotMatch(text, /actor clock|simulation clock|column \d|row \d|tick|event batch/);
  assert.match(text, /Contact pickups/);
  assert.match(text, /Enemies frozen/);
  assert.match(text, /No manual equipment actions/);
  assert.doesNotMatch(text, /undefined|NaN/);
  assert.equal(p.$('encounter-status').hidden, false);
  assert.equal(
    p.$('classic-summary').textContent,
    source.snapshot.classic.summary,
    'Existing live field summary remains intact',
  );
  assert.deepEqual(p.errors, []);
});
test('mounted encounter Details uses actual full instruction and typed lane', async (t) => {
  const p = await soloPage(
    t,
    practice({ ...retryFixture('boss-lane').level, rules: { lives: 3 } }, 'xonix-playground.v3'),
  );
  await start(p);
  ticks(p, 13);
  assert.equal(p.$('run-message').dataset.cue, 'encounter');
  assert.equal(p.$('encounter-status').hidden, false);
  assert.ok(p.$('run-message').textContent.includes(p.$('encounter-instruction').textContent));
  p.$('pause-button').click();
  open(p);
  const source = info(p);
  assert.equal(source.snapshot.encounter.phase, 'warning');
  assert.ok(
    p.$('flight-details-content').textContent.includes(source.snapshot.encounter.instruction),
  );
  assert.match(p.$('flight-details-content').textContent, /highlighted horizontal lane/);
  assert.doesNotMatch(p.$('flight-details-content').textContent, /simulation-ticks|actor-ticks/);
  assert.match(p.$('flight-details-content').textContent, /Current cut: 0 \/ 8/);
  assert.doesNotMatch(p.$('flight-details-content').textContent, /undefined|NaN/);
  assert.deepEqual(p.errors, []);
});

test('mounted authored three-relay preview shares guide names and exact paused encounter instructions', async (t) => {
  const theme = JSON.parse(readFileSync(new URL('../content-design/themes.json', import.meta.url)))
    .themes[0];
  const { scenario } = prepareContentPreview(createApexSpatialCandidates(), 'home-signal', {
    theme,
  });
  const p = await soloPage(t, {
    campaign,
    search: '?practice=1',
    previewStorage: memoryStorage({
      'revealline.playground.current': JSON.stringify(scenario),
    }),
  });
  await start(p);
  p.$('pause-button').click();
  const before = authoritativeCheckpoint(p.rendered.run);
  const source = info(p);
  assert.deepEqual(source.snapshot.issues, []);
  assert.equal(source.snapshot.encounter.shields.total, 3);
  open(p);
  const text = p.$('flight-details-content').textContent;
  assert.match(text, /Relay sentinel: Shield relays 0 \/ 3/);
  assert.match(text, /Capture all remaining shield relays/);
  assert.match(text, /Contour crawler:.*changing frontier/);
  assert.doesNotMatch(text, /Boundary patrol|Signal sentinel|capture its relay/);
  assert.match(p.$('classic-summary').textContent, /1 relay sentinel/);
  assert.match(p.$('classic-summary').textContent, /1 contour crawler/);
  ticks(p, 10);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  p.$('flight-details-back').click();
  await Promise.resolve();
  assert.equal(info(p).snapshot.paused, true);
  assert.equal(p.doc.activeElement, p.$('overlay-field-details'));
  assert.deepEqual(p.errors, []);
});
test('mounted controller navigates Pause to Details and reading; held Back cannot resume after closing Details', async (t) => {
  const pad = {
    index: 0,
    id: 'Details controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const p = await soloPage(t, { campaign, readPads: () => [pad] });
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const frame = () => {
    now += 30;
    p.frame(30);
  };
  const set = (n, v) => (pad.buttons[n] = { pressed: v, value: v ? 1 : 0 });
  const pulse = (n) => {
    set(n, true);
    frame();
    set(n, false);
    frame();
  };
  frame();
  await start(p);
  tap(p, 'ArrowDown');
  ticks(p, 13);
  pulse(9);
  assert.equal(info(p).snapshot.paused, true);
  for (let n = 0; n < 20 && p.doc.activeElement !== p.$('pause-mission-info-toggle'); n++) pulse(5);
  assert.equal(p.doc.activeElement, p.$('pause-mission-info-toggle'));
  pulse(0);
  assert.equal(p.$('pause-mission-info').open, true);
  pulse(5);
  assert.equal(p.doc.activeElement, p.$('overlay-field-details'));
  pulse(0);
  assert.equal(p.$('flight-details-dialog').open, true);
  pulse(0);
  assert.equal(p.doc.activeElement, p.$('flight-details-reading'));
  pulse(1);
  assert.equal(p.$('flight-details-dialog').open, true);
  set(1, true);
  frame();
  await Promise.resolve();
  assert.equal(p.$('flight-details-dialog').open, false);
  const before = authoritativeCheckpoint(p.rendered.run);
  for (let n = 0; n < 8; n++) frame();
  assert.equal(info(p).snapshot.paused, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.deepEqual(p.errors, []);
});

test('queued Details entry does not open or steal focus in a hidden or unfocused document', async (t) => {
  const p = await soloPage(t, { campaign });
  await start(p);
  p.$('pause-button').click();
  const before = authoritativeCheckpoint(p.rendered.run);
  for (const hidden of [true, false]) {
    p.doc.hidden = hidden;
    p.doc.focused = hidden;
    p.$('start-button').focus();
    const focus = p.doc.activeElement;
    p.$('overlay-field-details').click();
    assert.equal(p.$('flight-details-dialog').open, false);
    assert.equal(p.doc.activeElement, focus);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  }
  p.doc.hidden = false;
  p.doc.focused = true;
  open(p);
  p.$('flight-details-back').click();
  open(p);
  const focus = p.doc.activeElement;
  await Promise.resolve();
  assert.equal(p.$('flight-details-dialog').open, true);
  assert.equal(p.doc.activeElement, focus);
  assert.deepEqual(p.errors, []);
});

test('actual reader Tab leaves Done for Back once; reopening resets only the new dialog scroll', async (t) => {
  const p = await soloPage(t, { campaign });
  await start(p);
  tap(p, 'ArrowDown');
  ticks(p, 13);
  assert.notEqual(
    p.$('run-message').dataset.cue,
    'encounter',
    'Ordinary notices remain independent',
  );
  p.$('pause-button').click();
  const checkpoint = authoritativeCheckpoint(p.rendered.run);
  open(p);
  keyboard(p, 'Enter');
  keyboard(p, 'Tab');
  assert.equal(p.doc.activeElement, p.$('flight-details-reading-done'));
  keyboard(p, 'Tab');
  assert.equal(p.doc.activeElement, p.$('flight-details-back'));
  assert.equal(p.$('flight-details-reading-done').disabled, true);
  assert.equal(p.$('flight-details-read').getAttribute('aria-pressed'), 'false');
  p.$('flight-details-dialog').scrollTop = 250;
  keyboard(p, 'Enter');
  await Promise.resolve();
  assert.equal(p.$('flight-details-dialog').open, false);
  assert.equal(info(p).snapshot.paused, true);
  open(p);
  assert.equal(p.$('flight-details-dialog').scrollTop, 0);
  assert.equal(p.doc.activeElement, p.$('flight-details-read'));
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.deepEqual(p.errors, []);
});
