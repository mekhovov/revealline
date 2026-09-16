export const COUCH_RACE_FORMATS = Object.freeze(['one-race', 'first-to-two', 'campaign-tour']);

const required = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const validRound = (value) => Number.isSafeInteger(value) && value > 0;

/** Session navigation and display totals only. The host alone supplies an
 * accepted terminal duel; this owner never steps a game or persists an award.
 */
export function createCouchProgression({
  format = 'one-race',
  campaignKey,
  campaignName,
  missions,
  initialKey = missions?.[0]?.key,
  roundId,
}) {
  required(COUCH_RACE_FORMATS.includes(format), 'Unknown race format.');
  required(text(campaignKey) && text(campaignName), 'An exact named campaign is required.');
  required(Array.isArray(missions) && missions.length > 0, 'A campaign needs missions.');
  required(validRound(roundId), 'A positive safe round identity is required.');
  const keys = new Set(),
    levels = new Set(),
    order = Object.freeze(
      Array.from(missions, (mission, index) => {
        required(
          mission && text(mission.key) && text(mission.levelId) && text(mission.name),
          'Every mission needs an exact key, level and name.',
        );
        required(
          !keys.has(mission.key) && !levels.has(mission.levelId),
          'Mission identities must be unique within the campaign.',
        );
        keys.add(mission.key);
        levels.add(mission.levelId);
        return Object.freeze({
          key: mission.key,
          levelId: mission.levelId,
          name: mission.name,
          index,
        });
      }),
    );
  let index = order.findIndex((mission) => mission.key === initialKey);
  required(index >= 0, 'The initial mission must belong to this campaign.');
  required(format !== 'campaign-tour' || index === 0, 'A new tour starts at its first mission.');
  let activeRound = roundId,
    terminal = false,
    winner = null,
    wins = [0, 0],
    pending = null,
    disposed = false;
  const results = new Map(),
    campaign = Object.freeze({ key: campaignKey, name: campaignName });

  function nextIndex() {
    if (!terminal || disposed) return null;
    if (format === 'first-to-two' && !wins.some((count) => count >= 2)) return index;
    if (format === 'campaign-tour' && index + 1 < order.length) return index + 1;
    return null;
  }
  function canRematch() {
    return terminal && !disposed && (format !== 'first-to-two' || wins.some((count) => count >= 2));
  }
  function snapshot() {
    const records = Object.freeze(order.flatMap((mission) => results.get(mission.key) ?? [])),
      points = format === 'campaign-tour' ? [0, 0] : [...wins],
      next = nextIndex();
    if (format === 'campaign-tour')
      for (const result of records) if (result.winner !== null) points[result.winner]++;
    return Object.freeze({
      format,
      campaign,
      mission: order[index],
      missionCount: order.length,
      roundId: activeRound,
      terminal,
      winner,
      seriesWins: Object.freeze([...wins]),
      points: Object.freeze(points),
      records,
      completed: records.length,
      seriesComplete: format === 'first-to-two' && wins.some((count) => count >= 2),
      tourComplete: format === 'campaign-tour' && terminal && records.length === order.length,
      next: next === null ? null : order[next],
      rematch: canRematch() ? order[index] : null,
      disposed,
    });
  }
  function settle({ roundId, winner: result }) {
    required(validRound(roundId), 'A positive safe round identity is required.');
    required(result === null || result === 0 || result === 1, 'A winner is player 0, 1 or a draw.');
    if (disposed || terminal || roundId !== activeRound) return false;
    terminal = true;
    winner = result;
    if (format === 'campaign-tour')
      results.set(
        order[index].key,
        Object.freeze({ missionKey: order[index].key, roundId, winner: result }),
      );
    else if (result !== null) wins[result]++;
    return true;
  }
  function plan(action) {
    required(action === 'next' || action === 'rematch', 'Unknown progression action.');
    if (disposed || !terminal) return null;
    if (pending) return pending.action === action ? pending : null;
    const target = action === 'next' ? nextIndex() : canRematch() ? index : null;
    if (target === null) return null;
    pending = Object.freeze({
      action,
      campaignKey,
      fromRoundId: activeRound,
      target: order[target],
      resetWins: action === 'rematch' && format !== 'campaign-tour',
    });
    return pending;
  }
  const current = (plan) => !disposed && terminal && pending !== null && plan === pending;
  function commit(plan, newRoundId) {
    required(validRound(newRoundId), 'A positive safe round identity is required.');
    if (!current(plan) || newRoundId <= activeRound) return false;
    // Plain owned publication only: no external code runs between these writes.
    index = plan.target.index;
    activeRound = newRoundId;
    if (plan.resetWins) wins = [0, 0];
    terminal = false;
    winner = null;
    pending = null;
    return true;
  }
  function cancel(plan) {
    if (!current(plan)) return false;
    pending = null;
    return true;
  }
  function dispose() {
    disposed = true;
    pending = null;
  }
  return Object.freeze({ snapshot, settle, plan, current, commit, cancel, dispose });
}
