import assert from 'node:assert/strict';
import { page } from './coop-host.mjs';
import { coverageClear, yardOpening } from './coop-route-search.mjs';
import { COOP_PICTURE_BINDINGS } from '../../couch/coop-picture-bindings.mjs';

// Extracted from the sealed coop-won-terminal-host test. This replays legal
// keyboard commands through the actual host; it never assigns core status,
// progress or player coordinates. Canvas/DOM remain finite modeled boundaries.
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
export const teamHud = (f) =>
  [
    'coop-stage',
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent);
export const teamImage = (f) => f.drawImages.at(-1);

export function teamTabTo(f, id) {
  for (let n = 0; n < 30 && f.doc.activeElement.id !== id; n++) f.tap('Tab');
  assert.equal(f.doc.activeElement.id, id, `Keyboard traversal reaches ${id}.`);
  assert.equal(f.doc.activeElement.closest('[hidden],[inert]'), null);
}

export async function winTeam(t, { level = 'first-connection', ...options } = {}) {
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    ...options,
  });
  if (level !== 'first-connection') await f.choose('coop-level', level);
  assert.equal(f.$('coop-level').value, level);
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  const first = {
    hud: teamHud(f),
    paint: f.lastPaint,
    image: teamImage(f),
    reads: f.artwork.calls.reads.length,
    urls: [...f.artwork.calls.urls],
  };
  const terminal = earnTeamVictory(t, f, level);
  return { f, first, terminal };
}

export function earnTeamVictory(t, f, level = 'first-connection') {
  const route = (level === 'relay-yard' ? yardOpening : coverageClear)('standard', {
    boost: true,
    cover: true,
  });
  assert.equal(route.run.status, 'won', 'The unchanged authored core reference route is legal.');
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
    JSON.stringify({
      hud: teamHud(f),
      message: f.$('coop-message').textContent,
      stages: route.stages,
    }),
  );
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.$('coop-discard-dialog').open, false);
  const binding = COOP_PICTURE_BINDINGS.find((row) => row.levelId === level);
  assert.ok(binding);
  assert.equal(teamImage(f).sha256, binding.picture.sha256);
  const terminal = { hud: teamHud(f), paint: f.lastPaint };
  f.tick(30);
  assert.deepEqual(
    { hud: teamHud(f), paint: f.lastPaint },
    terminal,
    'An earned terminal flight stays stopped while Results is visible.',
  );
  t.diagnostic(
    JSON.stringify({
      boundary: 'rehearsed keyboard host; finite DOM/inert Canvas, no native or human-win claim',
      level,
      coreReferenceCommands: route.log.length,
      hostCommandTicks,
    }),
  );
  return terminal;
}
