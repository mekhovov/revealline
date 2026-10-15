export const OVERFLIGHT_STEP_SECONDS = 1 / 60;

/** Regenerate built-in V2 encounters with the run seed. Authored content and
 * legacy definitions retain their exact layouts, even with a runtime seed override. */
export function overflightSortieProject(mode, project, { seed, difficulty, authored = false }) {
  if (
    authored ||
    (project.survivorFormat ?? project.format).endsWith('V1') ||
    (project.seed === seed && project.difficulty === difficulty)
  )
    return project;
  if (project.battlefield)
    return mode.createProject({
      layout: project.battlefield.id,
      world: project.battlefield.world,
      seed,
      difficulty,
    });
  const encounterSet = mode.encounterSets.find(
    (set) => mode.createProject({ encounterSet: set }).id === project.id,
  );
  return encounterSet ? mode.createProject({ encounterSet, seed, difficulty }) : project;
}

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

/** Modal actions must be released; steering stays responsive during that release. */
export function createOverflightInputGate() {
  let blocked = true;
  return {
    release() {
      blocked = true;
    },
    sample({
      x = 0,
      y = 0,
      boost = false,
      focus = false,
      neutral = !boost && !focus,
      actionsNeutral = neutral,
    } = {}) {
      const length = Math.hypot(x, y);
      const movement = {
        x: length > 1 ? x / length : x,
        y: length > 1 ? y / length : y,
      };
      if (blocked) {
        if (actionsNeutral) blocked = false;
        return { ...movement, boost: false };
      }
      return { ...movement, boost: !!boost, ...(focus ? { focus: true } : {}) };
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

/** Keep decoded world sources alive until their async atlas preparation finishes.
 * Every request is queued, including A→B→A while B is still loading. */
export function createOverflightWorldSourceQueue({ ready, initialSlots, load, current }) {
  const keyOf = (slots) => JSON.stringify([...new Set(slots)].sort());
  let acceptedKey = null,
    closed = false;
  let tail = Promise.resolve(ready).then(
    () => {
      acceptedKey = keyOf(initialSlots);
    },
    () => {},
  );
  return {
    use(slots, consume) {
      const requestedSlots = [...slots];
      const requestedKey = keyOf(requestedSlots);
      const operation = tail.then(async () => {
        if (closed) throw new Error('Overflight world source queue is closed.');
        if (requestedKey !== acceptedKey) {
          await load(requestedSlots);
          // Loading changes the presentation host even if its app request became
          // obsolete. Record the actual accepted sources before serving another.
          acceptedKey = requestedKey;
        }
        if (closed) throw new Error('Overflight world source queue is closed.');
        return consume(current());
      });
      tail = operation.catch(() => {});
      return operation;
    },
    async settled() {
      await tail;
      if (closed) throw new Error('Overflight world source queue is closed.');
      return current();
    },
    async dispose() {
      closed = true;
      await tail;
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
export function overflightPreviewRequest(event, { window, parent, origin, modeId = 'overflight' }) {
  if (
    parent === window ||
    event.source !== parent ||
    event.origin !== origin ||
    event.data?.type !== `${modeId}:preview` ||
    event.data.version !== 1
  )
    return null;
  const { requestId } = event.data;
  if (requestId !== undefined && (!Number.isSafeInteger(requestId) || requestId < 1)) return null;
  return event.data;
}

/** Review playback supplies ordinary inputs and accepts only earned cards. The
 * native host still owns Start, pause/recovery, fixed steps and card application. */
export function overflightReviewStopAt(value, { build, diagnostics = false } = {}) {
  const seconds = Number(value);
  return build && diagnostics && Number.isFinite(seconds) && seconds >= 120 && seconds <= 240
    ? seconds
    : null;
}

/** Keep the native tight-route default and allow explicit matched controls.
 * Raid's pilot argument selects its hunting build instead of a flight route. */
export function overflightReviewControls({ mode, build, route } = {}) {
  if (!build) return { route: null, pilotArgument: null };
  if (mode === 'overflight-hunt')
    return { route: build === 'objectives' ? 'objectives' : 'packs', pilotArgument: build };
  const selected = ['tight', 'figure-eight', 'lure-and-return'].includes(route) ? route : 'tight';
  return { route: selected, pilotArgument: selected };
}

// Compact diagnostic fingerprint, not a gameplay identity or a replay checksum.
// Quantization suppresses insignificant cross-engine float noise; exact player
// coordinates and returned inputs are also retained for the first-divergence check.
function reviewTraceSample(run, input) {
  const player = run.player;
  let enemyDigest = 2166136261;
  for (const enemy of run.enemies) {
    if (!enemy.active) continue;
    for (const value of [
      enemy.id,
      enemy.x,
      enemy.y,
      enemy.hp,
      enemy.armor,
      enemy.attackWarning,
      enemy._motionVX,
      enemy._motionVY,
    ])
      enemyDigest = Math.imul(enemyDigest ^ Math.round((value ?? 0) * 100000), 16777619) >>> 0;
  }
  return {
    tick: run.tick,
    input: { x: input.x, y: input.y, boost: input.boost === true, focus: input.focus === true },
    player: {
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      heading: player.heading,
      hull: player.hull,
      shield: player.shield,
      boostRemaining: player.boostRemaining,
      boostCooldown: player.boostCooldown,
    },
    kills: run.stats.kills,
    damageTaken: run.stats.damageTaken,
    xp: run.progression.xp,
    choices: run.progression.choices,
    airframes: run.airframesRemaining,
    random: run._randomState,
    draftRandom: run._draftRandomState,
    enemyDigest,
    focus: run.riy
      ? { phase: run.riy.phase, targetId: run.riy.targetId, cooldown: run.riy.cooldown }
      : null,
    escorts:
      run.riy?.escorts.map((escort) => ({
        role: escort.role,
        x: escort.x,
        y: escort.y,
        shots: escort.shots,
        cooldown: escort.cooldown,
      })) ?? [],
  };
}

export function createOverflightReviewPlayback({
  build,
  pilot,
  selectCard,
  route = 'tight',
  stopAt = null,
  enabled = true,
  trace = false,
}) {
  const traceSamples = [],
    traceCapacity = 7200;
  let traceDropped = 0;
  const stopSeconds = overflightReviewStopAt(stopAt, { build, diagnostics: true });
  let automatic = !!build && enabled;
  let stopped = false;
  let lastTick = null,
    input = { x: 0, y: 0, boost: false },
    pending = null;
  const offerIdentity = (run) =>
    `${run.progression.choices}:${run.progression.rerolls}:${run.offers.map((offer) => offer.id).join('|')}`;
  return {
    traceSnapshot: () =>
      trace
        ? {
            format: 'OverflightReviewTraceV1',
            capacity: traceCapacity,
            dropped: traceDropped,
            samples: structuredClone(traceSamples),
          }
        : null,
    active: () => automatic,
    setEnabled(value) {
      automatic = !!build && value === true;
      pending = null;
      lastTick = null;
      input = { x: 0, y: 0, boost: false };
    },
    reset() {
      traceSamples.length = 0;
      traceDropped = 0;
      lastTick = null;
      input = { x: 0, y: 0, boost: false };
      pending = null;
      stopped = false;
    },
    input(run, manual) {
      if (!automatic) return manual;
      run.review = true;
      if (stopSeconds !== null && run.time >= stopSeconds) stopped = true;
      if (stopped) return { x: 0, y: 0, boost: false, focus: false };
      if (lastTick === null || run.tick < lastTick || run.tick - lastTick >= 6) {
        input = pilot(run, route);
        lastTick = run.tick;
        if (trace) {
          if (traceSamples.length < traceCapacity) traceSamples.push(reviewTraceSample(run, input));
          else traceDropped++;
        }
      }
      return input;
    },
    upgrade(run, now, visible) {
      if (!automatic || run.phase !== 'upgrade') {
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
        pending = {
          identity: offerIdentity(run),
          id: selected.id,
          elapsed: 0,
          last: now,
        };
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
