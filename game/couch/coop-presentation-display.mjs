import { required } from '../data-json.mjs';

const abort = () => new DOMException('Team presentation display was superseded.', 'AbortError');
const once = (cleanup) => {
  let live = true;
  return () => {
    if (!live) return;
    live = false;
    cleanup?.();
  };
};

/** Owns only an accepted selection's display layer, not its theme/picture lease,
 * game state, page presentation or menu preferences. All callbacks are synchronous.
 */
export function createCoopPresentationDisplay({
  getSelection,
  getDefaultSnapshot,
  painter,
  element,
  setMenuPresentation,
  initialMenuSnapshot = null,
  isDisposed = () => false,
  paintOptions = () => ({}),
}) {
  required(
    [
      getSelection,
      getDefaultSnapshot,
      setMenuPresentation,
      isDisposed,
      paintOptions,
      painter?.setPresentation,
      painter?.paint,
    ].every((fn) => typeof fn === 'function'),
    'Team display needs selection, presentation, menu and painter readers.',
  );
  let closed = false,
    visit = 0,
    initialized = false,
    dirty = true;
  let selection = null,
    snapshot = null,
    release = once();
  const alive = () => !closed && !isDisposed();
  const owns = (ticket) => alive() && visit === ticket;
  const desired = () => {
    const selected = getSelection();
    return {
      selection: selected,
      snapshot: selected?.binding?.snapshot ?? getDefaultSnapshot() ?? null,
    };
  };
  const current = (ticket, target) => {
    if (!owns(ticket)) return false;
    const next = desired();
    return owns(ticket) && next.selection === target.selection && next.snapshot === target.snapshot;
  };
  return Object.freeze({
    sync() {
      if (!alive()) return false;
      const target = desired();
      if (!alive()) return false;
      if (
        !dirty &&
        initialized &&
        selection === target.selection &&
        snapshot === target.snapshot &&
        painter.presentation === target.snapshot
      )
        return true;
      const ticket = ++visit;
      const beforePainter = painter.presentation ?? null;
      const beforeMenu = initialized ? snapshot : initialMenuSnapshot;
      let candidateRelease = once(),
        committed = false,
        rolledBack = false;
      dirty = true;
      // Rollback must restore the menu's internal Auto-theme reference as well
      // as its visible attributes, even if the setter already wrote then threw.
      const rollback = () => {
        if (rolledBack) return [];
        rolledBack = true;
        const failures = [];
        try {
          candidateRelease();
        } catch (error) {
          failures.push(error);
        }
        if (owns(ticket)) {
          try {
            setMenuPresentation(beforeMenu);
          } catch (error) {
            failures.push(error);
          }
        }
        if (owns(ticket) && painter.presentation !== beforePainter) {
          try {
            painter.setPresentation(beforePainter);
          } catch (error) {
            failures.push(error);
          }
        }
        // Keep dirty after a rejected transaction. A subsequent sync must repair
        // all surfaces even when its target equals the last committed trackers.
        return failures;
      };
      try {
        if (target.selection) {
          const cleanup = target.selection.lease.apply(element);
          required(typeof cleanup === 'function', 'Team display application needs owned cleanup.');
          candidateRelease = once(cleanup);
        }
        if (!current(ticket, target)) {
          const failures = rollback();
          if (failures.length) throw new AggregateError(failures, 'Team display rollback failed.');
          return false;
        }
        if (painter.presentation !== target.snapshot) painter.setPresentation(target.snapshot);
        if (!current(ticket, target)) {
          const failures = rollback();
          if (failures.length) throw new AggregateError(failures, 'Team display rollback failed.');
          return false;
        }
        // Null is a real declared menu fallback and must also be forwarded.
        setMenuPresentation(target.snapshot);
        if (!current(ticket, target)) {
          const failures = rollback();
          if (failures.length) throw new AggregateError(failures, 'Team display rollback failed.');
          return false;
        }
        const previousRelease = release;
        selection = target.selection;
        snapshot = target.snapshot;
        release = candidateRelease;
        initialized = true;
        dirty = false;
        committed = true;
        previousRelease();
        return current(ticket, target);
      } catch (error) {
        if (!committed) {
          const failures = rollback();
          if (failures.length)
            throw new AggregateError([error, ...failures], 'Team display and rollback failed.');
        } else if (owns(ticket)) {
          // The new owner was already published. Never retire it because old
          // cleanup threw; force repair on the next sync instead.
          dirty = true;
        }
        throw error;
      }
    },
    paintPrepared(candidate, binding) {
      if (!alive()) throw abort();
      const ticket = visit,
        before = painter.presentation ?? null;
      try {
        const options = paintOptions();
        if (!owns(ticket)) throw abort();
        if (painter.presentation !== binding.snapshot) painter.setPresentation(binding.snapshot);
        if (!owns(ticket)) throw abort();
        painter.paint(candidate, { ...options, picture: binding });
        if (!owns(ticket)) throw abort();
      } finally {
        // Nested preflights restore in stack order. A newer actual display sync
        // invalidates every older preflight, including equal-snapshot owners.
        if (
          owns(ticket) &&
          painter.presentation === binding.snapshot &&
          painter.presentation !== before
        )
          painter.setPresentation(before);
      }
    },
    dispose() {
      if (closed) return;
      closed = true;
      visit++;
      const cleanup = release;
      release = once();
      selection = null;
      snapshot = null;
      cleanup();
    },
  });
}
