import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../../data-json.mjs';
import { compileContentProject, resolveMission } from '../../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../../coop/core.mjs';
import { replayTeamCommands } from './coop-win.mjs';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/current-team-spatial-host-routes.json', import.meta.url)),
);

assert.equal(fixture.format, 'CurrentTeamSpatialHostRoutesV1');
assert.equal(fixture.ruleset, 'gameplay-pressure.v4');
assert.equal(fixture.seed, 17);

// These routes qualify current hosts separately from the retained historical
// authored-rule evidence. Exact edition, rules and public commands are required.
export function teamSpatialRoute(source, missionId, difficulty = 'standard') {
  const authored = resolveMission(compileContentProject(source), missionId, {
    mode: 'team',
    difficulty,
  }).level;
  const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
  const row = fixture.rows.find(
    (item) =>
      item.sourceId === source.id &&
      item.sourceRevision === source.revision &&
      item.missionId === missionId &&
      item.difficulty === difficulty &&
      item.authoredIdentity === dataIdentity(authored) &&
      item.tunedIdentity === dataIdentity(level),
  );
  assert(row, `Exact edition route required: ${source.id}/${missionId}/${difficulty}`);
  const run = startCoop(createCoop(level, { difficulty, seed: 17 }));
  let released = [];
  const commands = [],
    events = [],
    pickups = [];
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
          'Public controls cannot introduce an artificial neutral brake.',
        );
      for (const seat of released)
        assert.equal(
          input[seat].direction,
          null,
          'A real bank requires its release tick before a new steering gesture.',
        );
      const cutting = run.players.map((player) => player.cutting);
      stepCoop(run, input);
      released = run.events
        .filter((event) => event.type === 'cut.closed')
        .map((event) => event.player);
      commands.push(input);
      events.push(...structuredClone(run.events));
      for (const event of run.events)
        if (event.type === 'powerup.collected')
          pickups.push({
            kind: event.kind,
            players: event.players,
            tick: event.tick,
            activationTick: event.activationTick,
            partnerCutting:
              cutting[1 - event.players[0]] && run.players[1 - event.players[0]].cutting,
          });
    }
  assert.equal(run.status, 'won');
  assert.equal(run.tick, row.tick);
  assert(!events.some((event) => event.type === 'player.downed'));
  const closed = [0, 1].map(
    (seat) => events.filter((event) => event.type === 'cut.closed' && event.player === seat).length,
  );
  assert.deepEqual(closed, row.closed);
  assert(closed.every((count) => count > 0));
  assert.deepEqual(pickups, row.pickups);
  assert.deepEqual(
    commands[0].map((command) => command.direction),
    [null, null],
  );
  return {
    run,
    commands,
    events,
    pickups,
    gameplayId: dataIdentity({ ruleset: run.ruleset, level }),
  };
}

export function playTeamSpatialRoute(
  f,
  source,
  missionId,
  difficulty = 'standard',
  afterTick = () => {},
) {
  const reference = teamSpatialRoute(source, missionId, difficulty);
  assert.equal(f.$('coop-level').value, missionId);
  let tick = 1;
  const played = replayTeamCommands(f, reference.commands.slice(1), () =>
    afterTick(++tick, reference),
  );
  assert.equal(played + 1, reference.run.tick);
  assert.equal(
    f.$('coop-overlay').hidden,
    false,
    `${missionId}: host ${f.$('coop-coverage').textContent} after ${played + 1} ticks; expected ${(reference.run.coverage * 100).toFixed(1)}%`,
  );
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-coverage').textContent, `${(reference.run.coverage * 100).toFixed(1)}%`);
  assert.equal(
    f.$('coop-reserves').textContent,
    `${reference.run.team.reserves} reserve${reference.run.team.reserves === 1 ? '' : 's'}`,
  );
  return reference;
}
