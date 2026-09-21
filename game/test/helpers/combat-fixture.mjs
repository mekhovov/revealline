import { stepRun, FIXED_DT } from '../../core/index.mjs';
import { recordInput } from '../../replay.mjs';

export function combatLevel(role = 'sentry') {
  return {
    version: 'xonix-level.v5',
    id: 'combat-runtime-study',
    revision: '1',
    name: 'Optional patrol contract fixture',
    width: 72,
    height: 36,
    foundations: [],
    walls: [],
    spawn: { x: 0.5, y: 18.5 },
    encounter: null,
    goal: { coverage: 0.4 },
    objectives: [],
    supplies: [],
    enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 8.5, vx: 0, vy: 0 }],
    rules: { moveSpeed: 10, lives: 3, stopOnCapture: true },
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      combatPatrols: {
        version: 'combat-patrols.v1',
        enabled: true,
        actors: [
          {
            id: 'patrol',
            role,
            x: role === 'scout' ? 8.5 : 30.5,
            y: role === 'scout' ? 18.5 : 12.5,
            headingX: 1,
            headingY: 0,
            speed: 0.25,
            turnTicks: 1200,
            ...(role === 'sentry'
              ? {
                  senseRadius: 24,
                  scanTicks: 30,
                  openingTicks: 240,
                  warningTicks: 120,
                  recoveryTicks: 120,
                  restTicks: 360,
                  shotSpeed: 8,
                  shotLifeTicks: 360,
                }
              : {}),
          },
        ],
      },
    },
  };
}
export const patrol = (state) => state.classic.combatPatrols.actors[0];
export const combat = (state) => state.classic.combatPatrols;
export function ticks(run, count, direction = null, recorder = null) {
  const events = [];
  for (let i = 0; i < count && !['won', 'lost'].includes(run.status); i++) {
    const command = { direction };
    if (recorder) recordInput(recorder, command);
    stepRun(run, command, FIXED_DT);
    events.push(...run.events);
  }
  return events;
}
