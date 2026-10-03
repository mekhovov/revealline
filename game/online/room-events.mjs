export const ROOM_EVENT_JOURNAL = 'revealline-room-events.v1';
export const ROOM_EVENT_LIMIT = 512;

/** A bounded cosmetic projection of accepted native events. Large capture-cell
 * arrays are excluded; authoritative topology remains in the full snapshot. */
export function projectRoomEvent(value, depth = 0) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 160);
  if (depth > 2 || !value || typeof value !== 'object') return undefined;
  if (Array.isArray(value))
    return value.slice(0, 16).map((item) => projectRoomEvent(item, depth + 1) ?? null);
  const result = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['indices', 'cells', 'path', 'route'].includes(key))
      .slice(0, 32)
      .map(([key, item]) => [key, projectRoomEvent(item, depth + 1)])
      .filter(([, item]) => item !== undefined),
  );
  if (value.type === 'cells.claimed' && Array.isArray(value.indices))
    result.presentationCount = value.indices.length;
  return result;
}

/** A new owner, seek or lost journal window is primed silently. Retrying a poll
 * never replays accepted effects; the next intact window remains audible. */
export function createRoomEventCursor() {
  let owner = null,
    serial = null;
  return {
    reset() {
      owner = null;
      serial = null;
    },
    accept(snapshot, { silent = false } = {}) {
      const journal = snapshot.presentation;
      if (!journal || journal.format !== ROOM_EVENT_JOURNAL) return { events: [], gap: false };
      const identity = `${snapshot.roomId}:${snapshot.generation}`;
      const changed = owner !== identity;
      const gap = !changed && serial !== null && serial < journal.first - 1;
      const events =
        changed || gap || silent || serial === null
          ? []
          : journal.events.filter((event) => event.serial > serial);
      owner = identity;
      serial = Math.max(changed ? 0 : (serial ?? 0), journal.last);
      return { events, gap, primed: changed || silent || gap };
    },
  };
}

/** The shared Team painter reads run.status as its pause clock. Room pause is
 * transport-owned, so project it without overwriting the authoritative run.
 * A new/recovered view primes its event tick silently; settled state is kept. */
export function createRoomBoardPresentation() {
  let owner = null,
    view = null,
    silentThrough = -1;
  return Object.freeze({
    reset() {
      owner = view = null;
      silentThrough = -1;
    },
    project(run, { paused = false } = {}) {
      if (owner !== run || !view || run.tick < view.tick) {
        owner = run;
        view = {};
        silentThrough = run.tick;
      }
      if (paused) silentThrough = run.tick;
      Object.assign(view, run);
      if (run.tick <= silentThrough) view.events = [];
      if (paused && run.status === 'running') view.status = 'paused';
      return view;
    },
  });
}
