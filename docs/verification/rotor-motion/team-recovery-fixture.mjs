import { createCoop, startCoop, stepCoop } from '../../../game/coop/core.mjs';
import { FIRST_CONNECTION } from '../../../game/coop/first-connection.mjs';
import { RELAY_YARD } from '../../../game/coop/relay-yard.mjs';

export const TEAM_RECOVERY_STAGES = Object.freeze([
  { tick: 24, label: 'Before recovery' },
  { tick: 25, label: 'Recovery relocation' },
  { tick: 45, label: 'Holding position' },
  { tick: 85, label: 'Moving up again' },
]);

/** Unmodified starter arenas, public input and core only. Both inward trails
 * are retraced, causing real knockdowns and reserve recovery within tick 25.
 * Visit every tick so the actual painter observes the same sequence as play. */
export function visitTeamRecovery({ arena = 'first-connection', visit = () => {} } = {}) {
  const level = arena === 'relay-yard' ? RELAY_YARD : FIRST_CONNECTION,
    run = startCoop(createCoop(level, { seed: 17, difficulty: 'standard' })),
    command = (direction = null, boost = false) => ({ direction, boost, support: false });
  visit(run, -1);
  while (run.tick < 85) {
    const commands =
      run.tick < 20
        ? [command('right', true), command('left', true)]
        : run.tick < 25
          ? [command('left', true), command('right', true)]
          : run.tick < 45
            ? [command(), command()]
            : [command('up', true), command('up', true)];
    stepCoop(run, commands);
    if (run.status !== 'running') throw new Error('The recovery route left live gameplay.');
    if (run.tick === 25 && !run.events.some((event) => event.type === 'team.recovery'))
      throw new Error('The recovery route did not earn its reserve recovery.');
    visit(
      run,
      TEAM_RECOVERY_STAGES.findIndex((stage) => stage.tick === run.tick),
    );
  }
  return run;
}
