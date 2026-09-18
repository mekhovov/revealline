import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { coverageClear, yardOpening } from './helpers/coop-route-search.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { createModeReturn } from '../mode-return.mjs';

// Actual entry/core/input/navigation/artwork with the existing finite DOM and
// inert Canvas boundary. Rehearsed keyboard commands earn the terminal state;
// no run/status writes, profile records, native-browser or human-win claims.
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'ShiftLeft', support: 'KeyQ' },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    boost: 'ShiftRight',
    support: 'Enter',
  },
];
const hud = (f) =>
  [
    'coop-stage',
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent);
const image = (f) => f.drawImages.at(-1);
function tabTo(f, id) {
  for (let n = 0; n < 30 && f.doc.activeElement.id !== id; n++) f.tap('Tab');
  assert.equal(f.doc.activeElement.id, id, `Keyboard traversal reaches ${id}`);
  assert.equal(f.doc.activeElement.closest('[hidden],[inert]'), null);
}
async function win(t, { level = 'first-connection', ...options } = {}) {
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    ...options,
  });
  if (level !== 'relay-yard') await f.choose('coop-level', level);
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-start').focus();
  f.tap('Enter');
  const first = {
    hud: hud(f),
    paint: f.lastPaint,
    image: image(f),
    reads: f.artwork.calls.reads.length,
    urls: [...f.artwork.calls.urls],
  };
  const route = (level === 'relay-yard' ? yardOpening : coverageClear)('standard', {
    boost: true,
    cover: true,
  });
  assert.equal(route.run.status, 'won', 'The unchanged authored core route is legal');
  // Start clears both seats. Let the real host establish its clock and consume
  // that neutral release before sending fresh route commands.
  f.tick(2);
  let hostCommandTicks = 0;
  for (const commands of route.log) {
    hostCommandTicks++;
    commands.forEach((command, seat) => {
      if (command.direction) f.tap(keys[seat][command.direction]);
      if (command.boost) f.press(keys[seat].boost);
      if (command.support) f.press(keys[seat].support);
    });
    f.tick();
    commands.forEach((command, seat) => {
      if (command.boost)
        f.doc.activeElement.emit('keyup', { key: keys[seat].boost, code: keys[seat].boost });
      if (command.support)
        f.doc.activeElement.emit('keyup', { key: keys[seat].support, code: keys[seat].support });
    });
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    'A WORLD YOU REVEALED TOGETHER',
    JSON.stringify({ hud: hud(f), message: f.$('coop-message').textContent, stages: route.stages }),
  );
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  assert.equal(f.$('coop-discard-dialog').open, false);
  const binding =
    COOP_PICTURE_BINDINGS.find((row) => row.levelId === level) ??
    COOP_PICTURE_BINDINGS[level === 'relay-yard' ? 1 : 0];
  assert.equal(image(f).sha256, binding.picture.sha256);
  const terminal = { hud: hud(f), paint: f.lastPaint };
  f.tick(30);
  assert.deepEqual(
    { hud: hud(f), paint: f.lastPaint },
    terminal,
    'Terminal flight remains stopped',
  );
  t.diagnostic(
    JSON.stringify({
      boundary: 'rehearsed keyboard host, finite DOM/inert Canvas; not native or human performance',
      coreReferenceCommands: route.log.length,
      hostCommandTicks,
      terminalHUD: terminal.hud,
    }),
  );
  return { f, first, terminal };
}

for (const [level, name] of [
  ['first-connection', 'First Connection'],
  ['relay-yard', 'Relay Yard'],
])
  test(`${name}: earned Team victory focuses Retry; keyboard Retry preserves exact authored recipe and picture`, async (t) => {
    const { f, first } = await win(t, { level });
    // Hidden setup values are not authority for Retry of the terminal attempt.
    f.$('coop-level').value = level === 'relay-yard' ? 'first-connection' : 'relay-yard';
    f.$('coop-difficulty').value = 'expert';
    f.$('coop-experiment').value = 'independent';
    f.tap('Enter');
    assert.equal(f.$('coop-discard-dialog').open, false);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.deepEqual(hud(f), first.hud);
    assert.equal(
      f.lastPaint,
      first.paint,
      'Retry recreates the authored initial arena, actors and HUD',
    );
    assert.equal(image(f), first.image, 'Exact accepted original is reused');
    assert.equal(f.artwork.calls.reads.length, first.reads);
    assert.deepEqual(f.artwork.calls.urls, first.urls);
    assert.equal(f.artwork.calls.releases.includes(first.image.src), false);
    f.tick(4);
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.deepEqual(f.visits, []);
  });

test('earned Team victory → keyboard Change setup returns to Ready without discard or automatic Start', async (t) => {
  const { f, first } = await win(t);
  tabTo(f, 'coop-lobby');
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
  assert.equal(f.artwork.calls.reads.length, first.reads);
  const before = hud(f);
  f.tick(30);
  assert.deepEqual(hud(f), before);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.deepEqual(f.visits, []);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(image(f), first.image);
});

test('earned Team victory → keyboard Return to Solo retains exact one-use return ownership without another discard', async (t) => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const owner = createModeReturn({
    storage,
    baseURL: 'http://localhost/game/',
    authority: { channel: 'dev', version: 'dev', sourceRevision: null },
  });
  const ticket = owner.prepare({
    campaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-01',
    themeId: 'fpv',
  });
  const recorded = [...entries];
  const { f, terminal } = await win(t, { href: ticket.href, returnStorage: storage });
  tabTo(f, 'coop-solo');
  f.$('coop-solo').setAttribute('href', 'https://other.invalid/not-a-mode');
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.deepEqual(f.visits, [new URL(`../?mode-return=${ticket.token}`, ticket.href).href]);
  assert.deepEqual([...entries], recorded, 'Receiving Solo remains the sole token consumer');
  assert.deepEqual({ hud: hud(f), paint: f.lastPaint }, terminal);
});
