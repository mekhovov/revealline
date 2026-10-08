export const OVERFLIGHT_STEP_SECONDS = 1 / 60;

/** Focus loss can swallow keyup. Require a fresh press after clearing keys. */
export function createOverflightKeyboardState() {
  const held = new Set();
  return {
    press(code, repeat = false) {
      if (!repeat || held.has(code)) held.add(code);
    },
    release: (code) => held.delete(code),
    clear: () => held.clear(),
    has: (code) => held.has(code),
    get size() {
      return held.size;
    },
  };
}

/** Join bounded DOM pages in order to recover the untruncated raw download. */
export function createOverflightJSONPages(snapshot, pageSize = 262144) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1024 || pageSize > 262144)
    throw new RangeError('Invalid raw measurement page size.');
  const json = JSON.stringify(snapshot);
  const count = Math.max(1, Math.ceil(json.length / pageSize));
  return Object.freeze({
    json,
    count,
    page(index) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= count)
        throw new RangeError('Invalid raw measurement page.');
      return json.slice(index * pageSize, (index + 1) * pageSize);
    },
  });
}

/** One clock scales the entire simulation. Overload drops bounded catch-up time;
 * it never pauses play or advances only selected actors. */
export function createOverflightClock({ maxSteps = 15 } = {}) {
  let previous = null,
    accumulator = 0,
    slowStart = null;
  const totals = { steps: 0, droppedSeconds: 0 };
  return {
    reset(now = null) {
      previous = now;
      accumulator = 0;
      slowStart = null;
    },
    clearMeasurements() {
      totals.steps = 0;
      totals.droppedSeconds = 0;
    },
    slowResume(now) {
      slowStart = now;
      previous = now;
      accumulator = 0;
    },
    advance(now, active, step) {
      if (!Number.isFinite(now)) return 0;
      if (previous === null) {
        previous = now;
        return 0;
      }
      const start = previous,
        elapsed = Math.max(0, (now - previous) / 1000);
      previous = now;
      if (!active) {
        accumulator = 0;
        return 0;
      }
      const retained = Math.min(elapsed, maxSteps * OVERFLIGHT_STEP_SECONDS);
      totals.droppedSeconds += elapsed - retained;
      // Integrate the 25% → 100% linear ramp over each wall-time interval.
      // Its exact area is cadence independent, including intervals crossing
      // the 750 ms endpoint. All simulation systems consume this one clock.
      const deficit = (at) => {
        if (slowStart === null) return 0;
        const seconds = Math.max(0, Math.min(0.75, (at - slowStart) / 1000));
        return 0.75 * seconds - 0.5 * seconds * seconds;
      };
      accumulator += retained - (deficit(start + retained * 1000) - deficit(start));
      let count = 0;
      while (accumulator + 1e-10 >= OVERFLIGHT_STEP_SECONDS && count < maxSteps) {
        accumulator = Math.max(0, accumulator - OVERFLIGHT_STEP_SECONDS);
        count++;
        totals.steps++;
        if (step(OVERFLIGHT_STEP_SECONDS) === false) {
          accumulator = 0;
          break;
        }
      }
      return count;
    },
    stats: () => ({ ...totals, accumulator }),
  };
}

/** Modal confirmation, focus recovery and a newly connected controller must
 * reach neutral before gameplay may consume their next physical input. */
export function createOverflightInputGate() {
  let blocked = true;
  return {
    release() {
      blocked = true;
    },
    sample({ x = 0, y = 0, boost = false, neutral = x === 0 && y === 0 && !boost } = {}) {
      if (blocked) {
        if (neutral) blocked = false;
        return { x: 0, y: 0, boost: false };
      }
      const length = Math.hypot(x, y);
      return { x: length > 1 ? x / length : x, y: length > 1 ? y / length : y, boost: !!boost };
    },
    blocked: () => blocked,
  };
}

/** A single page owns a single renderer. Retries exchange simulation state;
 * only a changed frozen appearance retires its renderer and atlas. */
export function createOverflightRendererOwner() {
  let current = null,
    identity = null,
    disposed = false,
    tail = Promise.resolve();
  return {
    acquire(nextIdentity, create) {
      const operation = tail.then(async () => {
        if (disposed) throw new Error('Overflight renderer owner is closed.');
        if (current && identity === nextIdentity) return current;
        const previous = current;
        current = null;
        identity = null;
        await previous?.destroy();
        if (disposed) throw new Error('Overflight renderer owner is closed.');
        const next = await create();
        if (disposed) {
          await next.destroy();
          throw new Error('Overflight renderer owner is closed.');
        }
        current = next;
        identity = nextIdentity;
        return current;
      });
      tail = operation.catch(() => {});
      return operation;
    },
    invalidate() {
      // Defer retirement to acquire/dispose: failures may arrive inside render.
      identity = null;
    },
    async dispose() {
      disposed = true;
      await tail;
      const previous = current;
      current = null;
      identity = null;
      await previous?.destroy();
    },
  };
}

/** Restoration only re-enables an explicit Start/Resume. It never starts play. */
export function createOverflightContextGuard({ pause, release }) {
  let lost = false;
  return {
    lose() {
      lost = true;
      pause();
      release();
    },
    restore() {
      lost = false;
      release();
    },
    blocked: () => lost,
  };
}

/** Only the same-origin embedding Studio may replace an accepted project. */
export function overflightPreviewRequest(event, { window, parent, origin }) {
  if (
    parent === window ||
    event.source !== parent ||
    event.origin !== origin ||
    event.data?.type !== 'overflight:preview' ||
    event.data.version !== 1
  )
    return null;
  const { requestId } = event.data;
  if (requestId !== undefined && (!Number.isSafeInteger(requestId) || requestId < 1)) return null;
  return event.data;
}

/** Review playback supplies ordinary inputs and accepts only earned cards. The
 * native host still owns Start, pause/recovery, fixed steps and card application. */
export function createOverflightReviewPlayback({ build, pilot, selectCard }) {
  let lastTick = null,
    input = { x: 0, y: 0, boost: false },
    pending = null;
  const offerIdentity = (run) =>
    `${run.progression.choices}:${run.progression.rerolls}:${run.offers.map((offer) => offer.id).join('|')}`;
  return {
    reset() {
      lastTick = null;
      input = { x: 0, y: 0, boost: false };
      pending = null;
    },
    input(run, manual) {
      if (!build) return manual;
      if (lastTick === null || run.tick < lastTick || run.tick - lastTick >= 6) {
        input = pilot(run, 'tight');
        lastTick = run.tick;
      }
      return input;
    },
    upgrade(run, now, visible) {
      if (!build || run.phase !== 'upgrade') {
        pending = null;
        return null;
      }
      if (!visible || !Number.isFinite(now)) {
        if (pending) pending.last = null;
        return null;
      }
      if (!pending || pending.identity !== offerIdentity(run)) {
        // selectCard may use one ordinary reroll. The resulting offers are
        // rendered before the visible review delay begins.
        const selected = selectCard(run, build);
        if (!selected) return { blocked: true, selectedId: null, choiceId: null };
        if (!run.offers.some((offer) => offer.id === selected.id)) return null;
        pending = { identity: offerIdentity(run), id: selected.id, elapsed: 0, last: now };
      } else {
        if (pending.last !== null) pending.elapsed += Math.max(0, now - pending.last);
        pending.last = now;
      }
      const result = {
        selectedId: pending.id,
        choiceId: pending.elapsed >= 1500 ? pending.id : null,
      };
      if (result.choiceId) pending = null;
      return result;
    },
  };
}
