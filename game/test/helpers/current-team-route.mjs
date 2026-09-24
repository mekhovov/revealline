import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../../data-json.mjs';
import { compileContentProject, resolveMission } from '../../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../../coop/core.mjs';
import { replayTeamCommands } from './coop-win.mjs';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/current-team-host-routes.json', import.meta.url)),
);

// The original core routes continue to qualify their historical authored rules.
// Host routes independently resolve the current approved tuning and never alter
// an authored target, actor, position, reserve or terminal state.
export function currentTeamRoute(source, missionId, difficulty = 'standard') {
  const authored = resolveMission(compileContentProject(source), missionId, {
    mode: 'team',
    difficulty,
  }).level;
  const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
  const row = fixture.rows.find(
    (item) =>
      item.missionId === missionId &&
      item.difficulty === difficulty &&
      item.authoredIdentity === dataIdentity(authored) &&
      item.tunedIdentity === dataIdentity(level),
  );
  assert(row, `A reviewed current host route is required for ${missionId}/${difficulty}.`);
  const run = startCoop(createCoop(level, { difficulty, seed: 17 }));
  const commands = [],
    events = [];
  for (const segment of row.segments)
    for (let index = 0; index < segment.ticks; index++) {
      const input = [segment.a, segment.b].map((direction) => ({
        direction,
        boost: false,
        support: false,
      }));
      for (const [seat, command] of input.entries())
        assert(
          command.direction !== null || run.players[seat].direction === null,
          'A host route cannot introduce an artificial neutral brake.',
        );
      stepCoop(run, input);
      commands.push(input);
      events.push(...structuredClone(run.events));
    }
  assert.equal(run.status, 'won');
  assert.equal(run.tick, row.tick);
  assert(!events.some((event) => event.type === 'player.downed'));
  assert.deepEqual(
    [0, 1].map(
      (seat) =>
        events.filter((event) => event.type === 'cut.closed' && event.player === seat).length,
    ),
    row.closed,
  );
  assert(row.closed.every((count) => count > 0));
  assert.deepEqual(
    commands[0].map((command) => command.direction),
    [null, null],
  );
  return { run, commands, events };
}

export function playCurrentTeamRoute(f, source, missionId, difficulty = 'standard', afterTick) {
  const reference = currentTeamRoute(source, missionId, difficulty);
  assert.equal(f.$('coop-level').value, missionId);
  // replayTeamCommands supplies the timestamp frame and one initial idle step.
  const played = replayTeamCommands(f, reference.commands.slice(1), afterTick);
  assert.equal(played + 1, reference.run.tick);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-coverage').textContent, `${(reference.run.coverage * 100).toFixed(1)}%`);
  assert.equal(
    f.$('coop-reserves').textContent,
    `${reference.run.team.reserves} reserve${reference.run.team.reserves === 1 ? '' : 's'}`,
  );
  return reference;
}
