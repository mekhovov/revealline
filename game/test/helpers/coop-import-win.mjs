import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { page } from './coop-host.mjs';
import { trial } from './coop-route-search.mjs';
import { replayTeamCommands } from './coop-win.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';

export const importedRoute = JSON.parse(
  await readFile(new URL('../fixtures/coop-import-route.json', import.meta.url)),
);
export const importedCoverageRoute = JSON.parse(
  await readFile(new URL('../fixtures/coop-import-coverage-route.json', import.meta.url)),
);

// Keep the recorded authored packs and their historical input evidence intact.
// Current host routes use v4 Gentle tuning and only exposed direction/Support
// commands; Shift/Boost from the historical recordings is not a Team control.
function currentImportedRoute(fixture) {
  const coverage = fixture === importedCoverageRoute;
  const authored = importedRoute.authoredPack.levels[coverage ? 1 : 0];
  const route = trial(applyGameplayTuning(authored, resolveGameplayTuning('gentle')), 'gentle', {
    boost: false,
    cover: true,
  });
  const { run, stage, to, at } = route;
  const move = (axis, targets) =>
    stage(
      `safe waypoint ${axis}: ${targets.join(', ')}`,
      () => to(axis, targets),
      () => at(axis, targets),
    );
  const join = () =>
    stage(
      'join live cuts',
      ['right', 'left'],
      () =>
        run.status === 'won' ||
        (run.players.every((player) => !player.cutting) &&
          Math.abs(run.players[0].x - run.players[1].x) < 0.4),
    );
  if (!coverage) {
    if (!move('y', [13.5, 13.5]) || !join() || !move('x', [23.5, 48.5])) return route;
    const north = run.strongholds.find((stronghold) => stronghold.id === 'yard-relay');
    const south = run.strongholds.find((stronghold) => stronghold.id === 'second');
    if (
      !stage('bank northern anchors', ['up', 'up'], () =>
        north.anchors.every((anchor) => anchor.captured),
      )
    )
      return route;
    if (!move('y', [6.5, 6.5])) return route;
    if (!stage('secure northern core', ['right', 'left'], () => north.defeated)) return route;
    // Approach the southern anchors from the safe perimeter, away from the
    // hunters guarding the gap below the first captured line.
    if (
      !move('y', [0.5, 0.5]) ||
      !move('x', [0.5, 71.5]) ||
      !move('y', [35.5, 35.5]) ||
      !move('x', [23.5, 48.5])
    )
      return route;
    if (
      !stage('bank southern anchors', ['up', 'up'], () =>
        south.anchors.every((anchor) => anchor.captured),
      )
    )
      return route;
    if (!move('y', [29.5, 29.5])) return route;
    stage('secure southern core in a new cut', ['right', 'left'], () => run.status === 'won');
    return route;
  }
  if (!move('y', [14.5, 14.5]) || !join() || !move('x', [20.5, 51.5])) return route;
  if (
    !stage('bank lower strips', ['down', 'down'], () =>
      run.players.every((player) => player.y >= 34.99),
    )
  )
    return route;
  if (!move('y', [18.5, 18.5]) || !join() || !move('x', [35.5, 36.5])) return route;
  if (
    !stage('cut to upper perimeter', ['up', 'up'], () =>
      run.players.every((player) => player.y <= 1),
    )
  )
    return route;
  if (!move('x', [20.5, 51.5])) return route;
  if (
    !stage('bank upper strips', ['down', 'down'], () =>
      run.players.every((player) => player.y >= 14.5),
    )
  )
    return route;
  if (!move('y', [24.5, 24.5])) return route;
  stage('cut outer flanks', ['left', 'right'], () => run.status === 'won');
  return route;
}

// Rehearsed public commands earn both authored objectives through the actual
// host. No hidden simulation state is assigned. DOM/Canvas remain modeled.
export function playImportedRoute(f, fixture = importedRoute) {
  const route = currentImportedRoute(fixture);
  assert.equal(route.run.status, 'won', 'The unchanged imported level has a legal host route.');
  const objectives = [f.$('coop-objective').textContent];
  const replayed = replayTeamCommands(f, route.log, () => {
    const objective = f.$('coop-objective').textContent;
    if (objective !== objectives.at(-1)) objectives.push(objective);
  });
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    'A WORLD YOU REVEALED TOGETHER',
    JSON.stringify({ replayed, objectives, message: f.$('coop-message').textContent }),
  );
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  return { replayed, objectives };
}

export async function winImported(t, { pack = importedRoute.authoredPack, ...options } = {}) {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true, ...options });
  f.$('coop-pack-file').focus();
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-difficulty', 'gentle');
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  const route = playImportedRoute(f);
  assert.ok(route.objectives.some((text) => /1 \/ 2 secured · Relay 3/.test(text)));
  assert.equal(f.$('coop-objective').textContent, 'Strongholds secured together');
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  return f;
}

export const importedResult = (f) =>
  ['coop-stage', 'coop-objective', 'coop-coverage', 'coop-clock', 'coop-message'].map(
    (id) => f.$(id).textContent,
  );
