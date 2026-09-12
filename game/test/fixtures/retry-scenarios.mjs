// New finite integration fixtures, derived through legal fixed-tick input.
// They are not replacements for any archived compatibility expectation.
export const RETRY_CAUSES = Object.freeze([
  'self-contact',
  'enemy-trail',
  'enemy-player',
  'boss-lane',
  'cut-timeout',
  'cable-limit',
  'mission-timeout',
]);

export function retryFixture(cause) {
  const level = {
    version: 'xonix-level.v1',
    id: `retry-${cause}`,
    revision: '1',
    name: 'Retry integration',
    width: 48,
    height: 36,
    spawn: { x: 6.5, y: 0.5 },
    goal: { coverage: 1 },
    enemies: [{ id: 'remote', type: 'bouncer', x: 38.5, y: 28.5, vx: 0, vy: 0 }],
    rules: { lives: 1 },
  };
  const segment = (ticks, direction = null) => ({ ticks, input: { direction } });
  let segments, terminalTick;
  switch (cause) {
    case 'self-contact':
      segments = [segment(30, 'down'), segment(1, 'up')];
      terminalTick = 31;
      break;
    case 'enemy-trail':
      level.spawn = { x: 24.5, y: 0.5 };
      level.enemies = [{ id: 'cutter', type: 'bouncer', x: 26.5, y: 2.5, vx: -6, vy: 0 }];
      segments = [segment(25, 'down')];
      terminalTick = 25;
      break;
    case 'enemy-player':
      level.enemies.push({ id: 'rail', type: 'border-patrol', x: 10.5, y: 0.5, speed: 0 });
      segments = [segment(54, 'right')];
      terminalTick = 54;
      break;
    case 'boss-lane':
      level.version = 'xonix-level.v2';
      level.spawn = { x: 0.5, y: 18.5 };
      level.enemies = [{ id: 'sentinel', type: 'relay-sentinel', x: 34.5, y: 18.5, radius: 0.25 }];
      level.objectives = [
        { id: 'shield', x: 8.5, y: 8.5, required: true, hidden: false },
        { id: 'core', x: 34.5, y: 18.5, required: true, hidden: false },
      ];
      level.encounter = {
        version: 'xonix-encounter.v1',
        kind: 'relay-sentinel',
        enemyId: 'sentinel',
        shieldObjectiveId: 'shield',
        coreObjectiveId: 'core',
        minReleaseCutCells: 8,
        initialDelayTicks: 12,
        transitionTicks: 12,
        shielded: { warningTicks: 24, activeTicks: 12, restTicks: 24 },
        exposed: { warningTicks: 24, activeTicks: 12, openTicks: 48 },
        laneWidth: 1.2,
      };
      segments = [segment(30, 'right'), segment(7)];
      terminalTick = 37;
      break;
    case 'cut-timeout':
      level.rules.cutTimeLimitSeconds = 0.25;
      segments = [segment(38, 'down')];
      terminalTick = 38;
      break;
    case 'cable-limit':
      level.rules.maxTrailCells = 3;
      segments = [segment(53, 'down')];
      terminalTick = 53;
      break;
    case 'mission-timeout':
      level.rules.timeLimitSeconds = 0.1;
      segments = [segment(12)];
      terminalTick = 12;
      break;
    default:
      throw new TypeError('Choose a known retry fixture cause.');
  }
  return { cause, level, segments, terminalTick };
}
