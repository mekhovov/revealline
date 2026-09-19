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
  if (level !== 'first-connection') await f.choose('coop-level', level);
  assert.equal(f.$('coop-level').value, level);
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
  assert.equal(
    f.doc.activeElement.id,
    level === 'first-connection' ? 'coop-next' : 'coop-lobby',
    'Victory recommends the next arena, or choosing an arena at the end of the pack',
  );
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
  test(`${name}: earned Team victory focuses its continuation action; keyboard Retry preserves exact authored recipe and picture`, async (t) => {
    const { f, first } = await win(t, { level });
    // Hidden setup values are not authority for Retry of the terminal attempt.
    f.$('coop-level').value = level === 'relay-yard' ? 'first-connection' : 'relay-yard';
    f.$('coop-difficulty').value = 'expert';
    f.$('coop-experiment').value = 'independent';
    tabTo(f, 'coop-retry');
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
  f.doc.documentElement.clientWidth = 844;
  f.doc.documentElement.clientHeight = 390;
  f.$('coop-start')._rect = { x: 118, y: 1080, width: 300, height: 47 };
  const reveals = [];
  t.mock.method(f.$('coop-start'), 'scrollIntoView', (options) => {
    reveals.push({ options, active: f.doc.activeElement.id });
  });
  f.tap('Enter');
  assert.deepEqual(reveals, [
    {
      options: { block: 'nearest', inline: 'nearest', behavior: 'instant' },
      active: 'coop-start',
    },
  ]);
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

for (const level of ['first-connection', 'relay-yard'])
  test(`${level}: keyboard View picture and Back preserve the earned original and frozen result`, async (t) => {
    const { f, terminal } = await win(t, { level });
    const earned = image(f),
      copy = f.$('coop-overlay-copy').textContent,
      resources = {
        reads: [...f.artwork.calls.reads],
        urls: [...f.artwork.calls.urls],
        releases: [...f.artwork.calls.releases],
      };
    tabTo(f, 'coop-view-picture');
    for (let attempt = 0; attempt < 3; attempt++) {
      f.tap('Enter');
      assert.equal(f.$('coop-earned-picture').open, true);
      assert.equal(f.doc.activeElement.id, 'coop-picture-return');
      assert.deepEqual(f.earnedDrawImages.at(-1), [earned, 0, 0, 1152, 576]);
      assert.equal(f.$('coop-earned-picture-canvas').width, 1152);
      assert.equal(f.$('coop-earned-picture-canvas').height, 576);
      assert.equal(f.$('coop-earned-picture').contains(f.$('coop-overlay')), false);
      f.tick(30);
      assert.deepEqual({ hud: hud(f), paint: f.lastPaint }, terminal);
      assert.equal(f.$('coop-overlay-copy').textContent, copy);
      f.tap(attempt === 1 ? 'Escape' : 'Enter');
      assert.equal(f.$('coop-earned-picture').open, false);
      assert.equal(f.doc.activeElement.id, 'coop-view-picture');
      assert.equal(f.$('coop-earned-picture-canvas').width, 0);
      assert.deepEqual(
        {
          reads: f.artwork.calls.reads,
          urls: f.artwork.calls.urls,
          releases: f.artwork.calls.releases,
        },
        resources,
        'Viewing never acquires or retires the accepted original',
      );
    }
    tabTo(f, 'coop-retry');
    f.tap('Enter');
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.$('coop-earned-picture').open, false);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
    assert.equal(image(f), earned);
  });

test('Team earned picture: controller Back and Confirm require fresh edges and never restart the win', async (t) => {
  const { f, terminal } = await win(t);
  const pad = {
    index: 0,
    id: 'Standard test controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  f.tick(2);
  const edge = (button, pressed) => {
    pad.buttons[button] = { pressed, value: Number(pressed) };
    f.tick(2);
  };
  edge(0, true);
  edge(0, false);
  assert.equal(
    f.doc.activeElement.id,
    'coop-next',
    'First deliberate edge joins without activating the recommended next arena',
  );
  edge(15, true);
  edge(15, false);
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  edge(0, true);
  assert.equal(f.$('coop-earned-picture').open, true);
  f.tick(40);
  assert.equal(f.$('coop-earned-picture').open, true, 'Held Confirm cannot close the new dialog');
  edge(0, false);
  edge(1, true);
  assert.equal(f.$('coop-earned-picture').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  f.tick(40);
  assert.equal(f.$('coop-menu').hidden, true, 'Held Back cannot leave the finished attempt');
  edge(1, false);
  edge(0, true);
  assert.equal(f.$('coop-earned-picture').open, true);
  edge(0, false);
  assert.deepEqual({ hud: hud(f), paint: f.lastPaint }, terminal);
});

test('Team earned picture: touch actions return to results, then Change setup retains its existing route', async (t) => {
  const { f, terminal } = await win(t, { touch: true });
  const earned = image(f);
  f.$('coop-view-picture').emit('pointerdown', { pointerType: 'touch' });
  f.$('coop-view-picture').click();
  assert.equal(f.$('coop-earned-picture').open, true);
  assert.equal(f.$('coop-controls').hidden, true);
  f.$('coop-lobby').click();
  f.$('coop-retry').click();
  assert.deepEqual(
    { hud: hud(f), paint: f.lastPaint },
    terminal,
    'Background actions remain inert',
  );
  assert.equal(f.$('coop-menu').hidden, true);
  f.$('coop-picture-return').emit('pointerdown', { pointerType: 'touch' });
  f.$('coop-picture-return').click();
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-earned-picture').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  f.$('coop-start').click();
  assert.equal(image(f), earned);
});

test('Team picture draw failure keeps results, Retry and the accepted image available', async (t) => {
  const { f, terminal } = await win(t);
  tabTo(f, 'coop-view-picture');
  f.failNextEarnedPaint();
  f.tap('Enter');
  assert.equal(f.$('coop-earned-picture').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  assert.match(f.$('coop-message').textContent, /earned result is unchanged/);
  assert.deepEqual({ hud: hud(f), paint: f.lastPaint }, terminal);
  f.tap('Enter');
  assert.equal(f.$('coop-earned-picture').open, true);
  assert.equal(f.earnedDrawImages.length, 1);
});

test('Team picture view never exposes an unearned paused arena', async (t) => {
  const f = await page(t, { nativeFocus: true });
  f.$('coop-start').click();
  f.$('coop-pause').click();
  assert.equal(f.$('coop-view-picture').hidden, true);
  f.$('coop-view-picture').click();
  assert.equal(f.$('coop-earned-picture').open, false);
  assert.equal(f.earnedDrawImages.length, 0);
});

test('Team earned picture survives foreground return without focus theft and retires on departure', async (t) => {
  const { f, terminal } = await win(t);
  tabTo(f, 'coop-view-picture');
  f.tap('Enter');
  f.win.emit('blur');
  f.tick(4);
  f.win.emit('focus');
  f.tick(4);
  assert.equal(f.$('coop-earned-picture').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-picture-return');
  assert.deepEqual({ hud: hud(f), paint: f.lastPaint }, terminal);
  f.tap('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  f.tap('Enter');
  f.win.emit('pagehide', { persisted: false });
  assert.equal(f.$('coop-earned-picture').open, false);
  assert.equal(f.$('coop-earned-picture-canvas').width, 0);
  assert.notEqual(
    f.doc.activeElement.id,
    'coop-view-picture',
    'Terminal cleanup never returns focus',
  );
  f.$('coop-picture-return').click();
  assert.equal(f.$('coop-earned-picture').open, false);
});
