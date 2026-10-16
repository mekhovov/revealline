import {
  createClassicUniquenessPilots,
  createHorizonVersusUniquenessPilot,
  createUniquenessPilotControls,
} from './uniqueness-pilot.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { compileContentProject, resolveMission } from './project.mjs';
import { createRun, stepRun, FIXED_DT, getSummary } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { createCoop, startCoop, stepCoop, getCoopSummary } from '../coop/core.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { boundedJSON, canonicalJSON } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';

export function resolveNeutralPilotRuntime(entry, difficulty) {
  const tuning = resolveGameplayTuning(difficulty);
  const sourceLevel = entry.resolveLevel
    ? entry.resolveLevel(difficulty)
    : difficulty === 'gentle'
      ? createDifficultyContext(
          {
            version: 'xonix-campaign.v1',
            id: 'neutral-pilot',
            revision: 'greybox-1',
            title: 'Neutral pilot',
            levels: [entry.level],
          },
          'gentle',
        ).campaign.levels[0]
      : entry.level;
  return { sourceLevel, tuning, level: applyGameplayTuning(sourceLevel, tuning) };
}

export function neutralPilotEntries() {
  const controls = createUniquenessPilotControls(),
    project = createHorizonVersusUniquenessPilot();
  const controlPresets = new Map([['standard', controls]]);
  const controlsFor = (difficulty) => {
    if (!controlPresets.has(difficulty))
      controlPresets.set(difficulty, createUniquenessPilotControls(difficulty));
    return controlPresets.get(difficulty);
  };
  const versusProject = compileContentProject(project);
  const versus = resolveMission(compileContentProject(project), project.missions[0].id, {
    mode: 'versus',
  });
  const pressure = CURRENT_ART_SOURCES.find(
    (row) => row.owner.levelId === 'orchard-crossing' && row.source.packId === 'fpv-arcade-r5',
  );
  return [
    ...createClassicUniquenessPilots().map((row) => ({
      id: row.id,
      mode: 'solo',
      level: row.level,
      label: row.brief.name,
      decision: row.brief.decision,
    })),
    {
      id: versus.missionId,
      mode: 'versus',
      level: versus.level,
      resolveLevel: (difficulty) =>
        resolveMission(versusProject, versus.missionId, { mode: 'versus', difficulty }).level,
      label: 'Horizon: two-bank race',
      decision: versus.design.routeDecision,
    },
    {
      id: 'control-solo',
      mode: 'solo',
      level: controls.solo.level,
      resolveLevel: (difficulty) => controlsFor(difficulty).solo.level,
      label: 'Control: Solo First return',
      decision: controls.solo.design.routeDecision,
    },
    {
      id: 'control-team',
      mode: 'team',
      level: controls.team.level,
      resolveLevel: (difficulty) => controlsFor(difficulty).team.level,
      label: 'Control: Team Twin landings',
      decision: controls.team.design.routeDecision,
    },
    {
      id: 'control-pressure',
      mode: 'solo',
      level: pressure.level,
      label: 'Control: Pressure Lines Orchard Crossing',
      decision: pressure.level.metadata.description,
    },
  ];
}

export const PILOT_OBSERVATIONS_FORMAT = 'revealline-neutral-pilot-observations.v2';
export const MAX_PILOT_TICKS = 72000;
export const MAX_PILOT_OBSERVATION_BYTES = 16 * 1024 * 1024;
const DIRECTIONS = [null, 'up', 'down', 'left', 'right'];
const requireValue = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
// Portable observations deliberately exclude exact floating-point checkpoints.
// Six decimal places preserve timing/positions for design review across hosts.
function portable(value) {
  return JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === 'number' ? Math.round(item * 1e6) / 1e6 : item,
    ),
  );
}
export function createNeutralPilotSession({ mission, difficulty = 'standard', seed = 17 }) {
  requireValue(
    ['gentle', 'standard', 'expert'].includes(difficulty),
    t('errors:neutralPilot.invalidDifficulty'),
  );
  requireValue(
    Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff,
    t('errors:neutralPilot.invalidSeed'),
  );
  const entry = neutralPilotEntries().find((row) => row.id === mission);
  requireValue(entry, t('errors:neutralPilot.unknownMission'));
  const runtime = resolveNeutralPilotRuntime(entry, difficulty);
  const { level } = runtime;
  const simulation =
    entry.mode === 'team'
      ? startCoop(createCoop(level, { seed, difficulty }))
      : entry.mode === 'versus'
        ? createDuel(
            level,
            { seed, classId: 'scout' },
            { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
          )
        : createRun(level, { seed, classId: 'scout' });
  if (entry.mode === 'versus') resumeDuel(simulation);
  const session = {
    entry,
    runtime,
    simulation,
    difficulty,
    seed,
    ticks: 0,
    segments: [],
    events: [],
  };
  session.configuration = configuration(session);
  return session;
}
export const pilotRuns = (session) =>
  session.entry.mode === 'versus' ? session.simulation.runs : [session.simulation];
export const pilotSessionEnded = (session) =>
  session.entry.mode === 'versus'
    ? session.simulation.status === 'finished'
    : ['won', 'lost'].includes(session.simulation.status);

/** The player and verifier use this same public-input boundary. No state edits,
 * progress writes or borrowed Solo results stand in for a two-seat simulation. */
export function advanceNeutralPilotSession(session, directions) {
  requireValue(!pilotSessionEnded(session), t('errors:neutralPilot.sessionEnded'));
  requireValue(session.ticks < MAX_PILOT_TICKS, t('errors:neutralPilot.tickLimitReached'));
  const mode = session.entry.mode;
  requireValue(
    Array.isArray(directions) &&
      directions.length === (mode === 'solo' ? 1 : 2) &&
      directions.every((value) => DIRECTIONS.includes(value)),
    t('errors:neutralPilot.invalidDirections'),
  );
  // Versus explicitly rejects Team's support field, including support:false.
  const commands = directions.map((direction) =>
    mode === 'team' ? { direction, boost: false, support: false } : { direction, boost: false },
  );
  const before = pilotRuns(session).map((run) => run.tick);
  if (mode === 'team') stepCoop(session.simulation, commands);
  else if (mode === 'versus') stepDuel(session.simulation, commands);
  else stepRun(session.simulation, commands[0], FIXED_DT);
  session.ticks++;
  const previous = session.segments.at(-1);
  if (previous && directions.every((value, seat) => previous.directions[seat] === value))
    previous.ticks++;
  else session.segments.push({ ticks: 1, directions: [...directions] });
  for (const [seat, run] of pilotRuns(session).entries()) {
    if (run.tick === before[seat]) continue;
    for (const event of run.events)
      if (['cut.closed', 'player.failed', 'player.downed', 'player.revived'].includes(event.type))
        session.events.push({
          seat: mode === 'team' ? event.player : seat,
          tick: run.tick,
          type: event.type,
          cause: event.cause ?? null,
          reason: event.reason ?? null,
          coverage: portable(run.coverage),
        });
  }
  return session;
}
function configuration(session) {
  return jsonCopy({
    sourceLevel: session.runtime.sourceLevel,
    runtimeLevels: pilotRuns(session).map((run) => run.level),
    tuning: session.runtime.tuning,
    rulesets: pilotRuns(session).map((run) => run.ruleset),
    protocol: session.entry.mode === 'versus' ? session.simulation.protocol : null,
  });
}
function outcome(session) {
  return portable({
    terminal: pilotSessionEnded(session),
    status: session.simulation.status,
    winner: session.entry.mode === 'versus' ? session.simulation.winner : null,
    reason: session.entry.mode === 'versus' ? session.simulation.reason : null,
    states: pilotRuns(session).map((run) => ({
      summary: session.entry.mode === 'team' ? getCoopSummary(run) : getSummary(run),
      cells: Array.from(run.cells),
      players: (run.players ?? [run.player]).map((player) => ({
        x: player.x,
        y: player.y,
        trail: [...(player.trail ?? run.trail ?? [])],
      })),
      objectives: run.objectives ?? [],
    })),
  });
}
export function exportPilotObservations(session, notes = '') {
  requireValue(
    typeof notes === 'string' && notes.length <= 8000,
    t('errors:neutralPilot.notesExceedLimit'),
  );
  return jsonCopy({
    format: PILOT_OBSERVATIONS_FORMAT,
    mission: session.entry.id,
    mode: session.entry.mode,
    difficulty: session.difficulty,
    seed: session.seed,
    configuration: session.configuration,
    ticks: session.ticks,
    segments: session.segments,
    events: session.events,
    outcome: outcome(session),
    notes,
    approval: 'Unapproved playtest observations; not saved game progress.',
  });
}

/** Rebuild from the current canonical pilot, never a supplied level or outcome.
 * Success establishes bounded outcome reproduction, not human play or approval. */
export function verifyPilotObservations(source) {
  const record = boundedJSON(source, {
    maxBytes: MAX_PILOT_OBSERVATION_BYTES,
    maxNodes: 1500000,
    maxDepth: 32,
    maxArray: MAX_PILOT_TICKS,
    maxString: 10000,
  });
  requireValue(
    record?.format === PILOT_OBSERVATIONS_FORMAT,
    t('errors:neutralPilot.unsupportedObservations'),
  );
  requireValue(
    typeof record.mission === 'string' &&
      ['solo', 'versus', 'team'].includes(record.mode) &&
      ['gentle', 'standard', 'expert'].includes(record.difficulty) &&
      Number.isInteger(record.seed) &&
      record.seed >= 0 &&
      record.seed <= 0xffffffff,
    t('errors:neutralPilot.invalidIdentity'),
  );
  requireValue(
    Number.isInteger(record.ticks) && record.ticks >= 0 && record.ticks <= MAX_PILOT_TICKS,
    t('errors:neutralPilot.invalidTickCount'),
  );
  requireValue(
    Array.isArray(record.segments) && record.segments.length <= record.ticks,
    t('errors:neutralPilot.invalidSegments'),
  );
  requireValue(
    typeof record.notes === 'string' && record.notes.length <= 8000,
    t('errors:neutralPilot.invalidNotes'),
  );
  // Validate the complete command stream before spending time replaying it.
  let ticks = 0;
  for (const segment of record.segments) {
    requireValue(
      segment &&
        Object.keys(segment).length === 2 &&
        Number.isInteger(segment.ticks) &&
        segment.ticks > 0 &&
        Array.isArray(segment.directions) &&
        segment.directions.length === (record.mode === 'solo' ? 1 : 2) &&
        segment.directions.every((value) => DIRECTIONS.includes(value)),
      t('errors:neutralPilot.invalidSegment'),
    );
    ticks += segment.ticks;
    requireValue(ticks <= MAX_PILOT_TICKS, t('errors:neutralPilot.tickLimitExceeded'));
  }
  requireValue(ticks === record.ticks, t('errors:neutralPilot.segmentDurationDiffers'));
  const session = createNeutralPilotSession(record);
  requireValue(record.mode === session.entry.mode, t('errors:neutralPilot.modeDiffers'));
  requireValue(
    canonicalJSON(record.configuration) === canonicalJSON(session.configuration),
    t('errors:neutralPilot.configurationDiffers'),
  );
  for (const segment of record.segments)
    for (let tick = 0; tick < segment.ticks; tick++)
      advanceNeutralPilotSession(session, segment.directions);
  requireValue(
    canonicalJSON(record.events) === canonicalJSON(session.events),
    t('errors:neutralPilot.eventsDiffer'),
  );
  requireValue(
    canonicalJSON(record.outcome) === canonicalJSON(outcome(session)),
    t('errors:neutralPilot.outcomeDiffers'),
  );
  return {
    verified: true,
    mission: record.mission,
    mode: record.mode,
    difficulty: record.difficulty,
    ticks,
    seconds: portable(ticks * FIXED_DT),
    terminal: pilotSessionEnded(session),
    status: session.simulation.status,
    clears: pilotRuns(session).map((run) => run.status === 'won'),
    scope:
      'Reproduced public-input observations; human review and complete pilot gate remain pending.',
  };
}
