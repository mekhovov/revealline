import assert from 'node:assert/strict';
import { page } from './coop-host.mjs';
import { trial } from './coop-route-search.mjs';
import { FIRST_CONNECTION } from '../../coop/first-connection.mjs';
import { RELAY_YARD } from '../../coop/relay-yard.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';
import { COOP_PICTURE_BINDINGS } from '../../couch/coop-picture-bindings.mjs';

// Extracted from the sealed coop-won-terminal-host test. This replays legal
// keyboard commands through the actual host; it never assigns core status,
// progress or player coordinates. Canvas/DOM remain finite modeled boundaries.
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', support: 'KeyQ' },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
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
// Actor sprites are painted after the background. Select the decoded original,
// whose bytes were verified by the presentation fixture, rather than draw order.
export const teamImage = (f) =>
  f.drawImages.findLast((image) => f.artwork.calls.decodes.includes(image));

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

// Rehearse the same tuned Standard level as the host, using only Team's public
// direction/Support controls. Historical untuned core routes intentionally stay
// in coop-route-search; their Boost commands are not a Team input capability.
function hostVictoryRoute(level) {
  const authored = level === 'relay-yard' ? RELAY_YARD : FIRST_CONNECTION;
  const route = trial(
    applyGameplayTuning(authored, resolveGameplayTuning('standard')),
    'standard',
    {
      boost: false,
      cover: true,
    },
  );
  const { run, stage, to, at } = route;
  const move = (axis, targets) =>
    stage(
      `safe waypoint ${axis}: ${targets.join(', ')}`,
      () => to(axis, targets),
      () => at(axis, targets),
    );
  const join = () =>
    stage(
      'join the two live cuts',
      ['right', 'left'],
      () =>
        run.status === 'won' ||
        (run.players.every((player) => !player.cutting) &&
          Math.abs(run.players[0].x - run.players[1].x) < 0.4),
    );
  if (level === 'relay-yard') {
    if (!move('y', [13.5, 13.5]) || !join() || !move('x', [23.5, 48.5])) return route;
    if (
      !stage('bank both anchors', ['up', 'up'], () =>
        run.strongholds[0].anchors.every((anchor) => anchor.captured),
      )
    )
      return route;
    if (!move('y', [6.5, 6.5])) return route;
    stage('join through the exposed core', ['right', 'left'], () => run.status === 'won');
    return route;
  }
  if (!move('y', [14.5, 14.5]) || !join() || !move('x', [20.5, 51.5])) return route;
  if (
    !stage('bank lower outer strips', ['down', 'down'], () =>
      run.players.every((player) => player.y >= 34.99),
    )
  )
    return route;
  if (!move('y', [20.5, 20.5]) || !join() || !move('x', [35.5, 36.5])) return route;
  if (
    !stage('cut to the top perimeter', ['up', 'up'], () =>
      run.players.every((player) => player.y <= 1),
    )
  )
    return route;
  if (!move('x', [20.5, 51.5])) return route;
  stage(
    'bank upper outer strips',
    ['down', 'down'],
    () => run.status === 'won' || run.players.every((player) => player.y >= 14.5),
  );
  return route;
}

export function replayTeamCommands(f, log, afterTick = () => {}) {
  f.tick(2);
  let hostCommandTicks = 0;
  for (const commands of log) {
    hostCommandTicks++;
    commands.forEach((command, seat) => {
      if (command.direction) f.tap(keys[seat][command.direction]);
      if (command.support) f.press(keys[seat].support);
    });
    f.tick();
    commands.forEach((command, seat) => {
      if (command.support)
        f.doc.activeElement.emit('keyup', { key: keys[seat].support, code: keys[seat].support });
    });
    afterTick();
    if (!f.$('coop-overlay').hidden) break;
  }
  return hostCommandTicks;
}

export function earnTeamVictory(t, f, level = 'first-connection') {
  const route = hostVictoryRoute(level);
  assert.equal(route.run.status, 'won', 'The unchanged authored core reference route is legal.');
  const hostCommandTicks = replayTeamCommands(f, route.log);
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
