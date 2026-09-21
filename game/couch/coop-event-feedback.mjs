/** Presentation receipts only. Call ingest immediately after every completed
 * simulation step, before another step clears run.events. Never persist this
 * latch in a run/checkpoint or infer an event from counters or grace windows. */
export const COOP_EVENT_FEEDBACK_SECONDS = 1.25;
export const COOP_EVENT_FEEDBACK_LIMIT = 8;

const EMPTY = Object.freeze([]);
function clock(run) {
  if (
    !run ||
    typeof run !== 'object' ||
    !Number.isSafeInteger(run.tick) ||
    run.tick < 0 ||
    !Number.isFinite(run.time) ||
    run.time < 0
  )
    throw new TypeError('Team feedback needs a run with a valid simulation clock.');
  return { tick: run.tick, time: run.time };
}

function receipt(event, index, now) {
  // Only this completed tick may supply events. Retained historical events or
  // future timestamps cannot replay a celebration in a different step.
  if (
    !event ||
    !Number.isSafeInteger(event.tick) ||
    event.tick < 0 ||
    event.tick !== now.tick - 1 ||
    !Number.isFinite(event.time) ||
    event.time < 0 ||
    event.time > now.time ||
    event.time + COOP_EVENT_FEEDBACK_SECONDS <= now.time
  )
    return null;
  const common = {
    id: `${event.tick}:${index}:${event.type}`,
    tick: event.tick,
    time: event.time,
    until: event.time + COOP_EVENT_FEEDBACK_SECONDS,
  };
  if (event.type === 'cut.joint') {
    if (
      !Array.isArray(event.players) ||
      event.players.length !== 2 ||
      !event.players.every((player) => player === 0 || player === 1) ||
      event.players[0] === event.players[1] ||
      !Number.isSafeInteger(event.cells) ||
      event.cells < 0 ||
      typeof event.meaningful !== 'boolean'
    )
      return null;
    return Object.freeze({
      ...common,
      kind: 'joint-capture',
      players: Object.freeze([...event.players]),
      cells: event.cells,
      meaningful: event.meaningful,
    });
  }
  if (event.type === 'team.recovery') {
    if (!Number.isSafeInteger(event.reserves) || event.reserves < 0) return null;
    return Object.freeze({ ...common, kind: 'team-recovery', reserves: event.reserves });
  }
  return null;
}

export function createCoopEventFeedback() {
  let owner = null,
    entries = EMPTY,
    observed = null,
    ingestedTick = null;

  function adopt(run, now) {
    owner = run;
    observed = now;
    entries = EMPTY;
    ingestedTick = null;
  }
  function reset() {
    owner = null;
    entries = EMPTY;
    observed = null;
    ingestedTick = null;
  }
  function begin(run) {
    const now = clock(run);
    if (owner !== run || now.tick < observed.tick || now.time < observed.time) adopt(run, now);
  }
  function snapshot(run) {
    const now = clock(run);
    if (owner !== run || now.tick < observed.tick || now.time < observed.time) return EMPTY;
    const visible = entries.filter((entry) => entry.until > now.time);
    return visible.length ? Object.freeze(visible) : EMPTY;
  }
  function ingest(run) {
    const now = clock(run);
    if (owner !== run || now.tick < observed.tick || now.time < observed.time) adopt(run, now);
    observed = now;
    entries = entries.filter((entry) => entry.until > now.time);
    if (ingestedTick === now.tick) return EMPTY;
    ingestedTick = now.tick;
    const added = [];
    if (Array.isArray(run.events))
      for (const [index, event] of run.events.entries()) {
        const item = receipt(event, index, now);
        if (!item) continue;
        entries.push(item);
        added.push(item);
        // Capacity is enforced during ingestion, not after collecting a batch.
        if (entries.length > COOP_EVENT_FEEDBACK_LIMIT) entries.shift();
        if (added.length > COOP_EVENT_FEEDBACK_LIMIT) added.shift();
      }
    return added.length ? Object.freeze(added) : EMPTY;
  }
  return Object.freeze({ begin, ingest, snapshot, reset });
}
