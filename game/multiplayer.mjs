import { createRun, stepRun, releaseInputs, FIXED_DT, RULESET } from './core/index.mjs';

export const DUEL_PROTOCOL = 'xonix-duel.v1';
export const neutralCommand = () => ({
  direction: null,
  boost: false,
  action: false,
  pickup: false,
});
const terminal = (run) => ['won', 'lost'].includes(run.status);

export function createDuel(level, options = {}, { seconds = 90 } = {}) {
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 600)
    throw new TypeError('Round duration must be 10–600 seconds.');
  return {
    protocol: DUEL_PROTOCOL,
    ruleset: RULESET,
    runs: [createRun(level, options), createRun(level, options)],
    tick: 0,
    limitTicks: seconds * 120,
    status: 'ready',
    winner: null,
    reason: '',
  };
}

export function releaseDuel(match) {
  match.runs.forEach(releaseInputs);
}
export function pauseDuel(match) {
  if (match.status === 'running') match.status = 'paused';
  releaseDuel(match);
}
export function resumeDuel(match) {
  if (['ready', 'paused'].includes(match.status)) match.status = 'running';
  releaseDuel(match);
}
function rankedWinner(runs) {
  const a = runs[0],
    b = runs[1];
  for (const key of ['coverage', 'lives', 'score']) {
    if (Math.abs(a[key] - b[key]) > 1e-8) return a[key] > b[key] ? 0 : 1;
  }
  return null;
}
function duelCommand(input) {
  if (
    !input ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Object.keys(input).some((key) => !['direction', 'boost', 'action', 'pickup'].includes(key))
  )
    throw new TypeError('Invalid race command.');
  const command = { ...neutralCommand(), ...input };
  if (
    ![null, 'up', 'down', 'left', 'right'].includes(command.direction) ||
    ['boost', 'action', 'pickup'].some((key) => typeof command[key] !== 'boolean')
  )
    throw new TypeError('Invalid race command.');
  return command;
}
export function stepDuel(match, commands) {
  if (match.status !== 'running') return match;
  if (!Array.isArray(commands) || commands.length !== 2)
    throw new TypeError('Two player commands are required.');
  const validated = commands.map(duelCommand);
  // Both boards receive this tick before judging: simultaneous finishes can draw.
  for (let i = 0; i < 2; i++)
    if (!terminal(match.runs[i])) stepRun(match.runs[i], validated[i], FIXED_DT);
  match.tick++;
  const winners = match.runs.map((r, i) => (r.status === 'won' ? i : -1)).filter((i) => i >= 0);
  if (winners.length || match.runs.every(terminal) || match.tick >= match.limitTicks) {
    match.status = 'finished';
    match.winner =
      winners.length === 1 ? winners[0] : winners.length === 2 ? null : rankedWinner(match.runs);
    match.reason = winners.length
      ? 'First clear'
      : match.tick >= match.limitTicks
        ? 'Time — coverage, then lives, then score'
        : 'Both flights ended';
    releaseDuel(match);
  }
  return match;
}

/** Transport-independent future input envelope. It never accepts state or rewards. */
export function validateDuelPacket(packet, { nextTick, player, matchId }) {
  if (
    !packet ||
    Object.getPrototypeOf(packet) !== Object.prototype ||
    Object.keys(packet).some(
      (k) => !['protocol', 'ruleset', 'matchId', 'tick', 'player', 'input'].includes(k),
    ) ||
    packet.protocol !== DUEL_PROTOCOL ||
    packet.ruleset !== RULESET ||
    packet.matchId !== matchId ||
    packet.tick !== nextTick ||
    packet.player !== player ||
    ![0, 1].includes(player)
  )
    return false;
  const input = packet.input;
  return (
    !!input &&
    Object.getPrototypeOf(input) === Object.prototype &&
    Object.keys(input).every((k) => ['direction', 'boost', 'action', 'pickup'].includes(k)) &&
    [null, 'up', 'down', 'left', 'right'].includes(input.direction) &&
    ['boost', 'action', 'pickup'].every((k) => typeof input[k] === 'boolean')
  );
}
