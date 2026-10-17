// Serialized verbatim into the game document; no imported dependencies.
export function installDemoRafObserver(environment = globalThis, capacity = 32768, poolSize = 512) {
  const nativeRequest = environment.requestAnimationFrame;
  const nativeCancel = environment.cancelAnimationFrame;
  const now = () => environment.performance.now();
  const callbacks = new Array(poolSize).fill(null), handles = new Float64Array(poolSize);
  const wrappers = new Array(poolSize), free = new Int32Array(poolSize);
  const timestamps = new Float64Array(capacity), durations = new Float64Array(capacity), owners = new Uint8Array(capacity);
  let freeCount = poolSize, count = 0, active = false, inside = false, mask = 0;
  let overflow = false, callbackErrors = 0, startedAtMs = 0, firstCallbackAtMs = null, foreground = true, stable = true;
  let demoRun = null, initialRun = null, ownerChanged = false, demoPaints = 0, outsideRafDemoPaints = 0;
  let checkpoint = null, installed = false, requestOverflow = 0, stopped = null;
  const expected = { width: 1280, height: 800, dpr: 1 };
  const isForeground = () => !environment.document.hidden && environment.document.hasFocus();
  const environmentMatches = () => environment.innerWidth === expected.width && environment.innerHeight === expected.height && environment.devicePixelRatio === expected.dpr;
  const observeEnvironment = () => { if (active) { foreground &&= isForeground(); stable &&= environmentMatches(); } };
  environment.addEventListener('blur', () => { if (active) foreground = false; });
  environment.addEventListener('resize', observeEnvironment);
  environment.document.addEventListener('visibilitychange', observeEnvironment);
  for (let i = 0; i < poolSize; i++) {
    free[i] = i;
    wrappers[i] = function (timestamp) {
      const callback = callbacks[i]; callbacks[i] = null; free[freeCount++] = i;
      if (!active) return callback.call(this, timestamp);
      const before = now(); if (firstCallbackAtMs === null) firstCallbackAtMs = before; inside = true; mask = 0;
      try { return callback.call(this, timestamp); }
      catch (error) { callbackErrors++; throw error; }
      finally {
        const elapsed = now() - before;
        if (count < capacity) { timestamps[count] = timestamp; durations[count] = elapsed; owners[count++] = mask; }
        else overflow = true;
        inside = false;
      }
    };
  }
  environment.requestAnimationFrame = function (callback) {
    if (typeof callback !== 'function') return nativeRequest.call(this, callback);
    if (!freeCount) { requestOverflow++; return nativeRequest.call(this, callback); }
    const slot = free[--freeCount]; callbacks[slot] = callback;
    try { handles[slot] = nativeRequest.call(this, wrappers[slot]); return handles[slot]; }
    catch (error) { callbacks[slot] = null; free[freeCount++] = slot; throw error; }
  };
  environment.cancelAnimationFrame = function (handle) {
    for (let i = 0; i < poolSize; i++) if (callbacks[i] && handles[i] === handle) { callbacks[i] = null; free[freeCount++] = i; break; }
    return nativeCancel.call(this, handle);
  };
  const snapshot = () => ({
    atMs: now(), visibility: environment.document.visibilityState, focused: environment.document.hasFocus(),
    viewport: { width: environment.innerWidth, height: environment.innerHeight, dpr: environment.devicePixelRatio },
    scene: environment.document.getElementById('demo-dialog')?.dataset.scene,
    open: environment.document.getElementById('demo-dialog')?.open,
    mutePressed: environment.document.getElementById('demo-audio-mute')?.getAttribute('aria-pressed'),
    watchPause: environment.document.getElementById('demo-watch-pause')?.getAttribute('aria-pressed'),
    reducedEffects: environment.document.getElementById('settings-reduced-effects')?.checked,
    sourceLabel: environment.document.getElementById('demo-source')?.textContent,
    levelLabel: environment.document.getElementById('demo-level')?.textContent,
    sameObservedOwner: initialRun === null || initialRun === demoRun,
    run: demoRun ? { tick: demoRun.tick, status: demoRun.status, classId: demoRun.classId,
      level: structuredClone(demoRun.level), checkpoint: checkpoint?.(demoRun) ?? null } : null,
  });
  environment.demoRafObservation = {
    install(Painter, checkpointFunction) {
      if (installed) throw Error('Observer installed twice'); installed = true; checkpoint = checkpointFunction;
      const canvas = environment.document.getElementById('demo-canvas');
      const context = canvas.getContext('2d'), original = Painter.prototype.draw;
      Painter.prototype.draw = function (ctx, run, dt, options) {
        if (ctx === context) {
          demoRun = run;
          if (active) { demoPaints++; if (inside) mask |= 2; else outsideRafDemoPaints++; if (run !== initialRun) ownerChanged = true; }
        }
        return original.call(this, ctx, run, dt, options);
      };
    },
    markPhaser() { if (active && inside) mask |= 1; },
    hasRun() { return Boolean(demoRun); },
    snapshot,
    begin() {
      if (active || count) throw Error('Exactly one observation window is allowed');
      if (!demoRun || !installed) throw Error('Prepared Demo run required');
      initialRun = demoRun; foreground = isForeground(); stable = environmentMatches(); startedAtMs = now(); active = true;
      return { startedAtMs, requestOverflowBefore: requestOverflow };
    },
    stop() {
      if (!active) throw Error('No active window');
      observeEnvironment(); active = false;
      stopped = { startedAtMs, endedAtMs: now(), tickAtStop: demoRun?.tick ?? null, statusAtStop: demoRun?.status ?? null, sameOwnerAtStop: initialRun === demoRun };
      return stopped;
    },
    export() {
      if (!stopped || active) throw Error('Stop the observation before export');
      return { ...stopped, firstCallbackAtMs, registrationToFirstCallbackMs: firstCallbackAtMs === null ? null : firstCallbackAtMs - startedAtMs, count, timestamps: Array.from(timestamps.subarray(0, count)),
        durations: Array.from(durations.subarray(0, count)), owners: Array.from(owners.subarray(0, count)),
        overflow, requestOverflow, callbackErrors, foregroundThroughout: foreground, environmentStableThroughout: stable,
        ownerChanged, demoPaints, outsideRafDemoPaints, snapshotAfterPause: snapshot() };
    },
  };
  // Pre-step is only a numeric owner marker. The complete native callback is timed above.
  let phaser;
  const seen = new WeakSet();
  Object.defineProperty(environment, 'Phaser', { configurable: true, get: () => phaser, set(value) {
    phaser = value;
    if (!value || seen.has(value)) return; seen.add(value);
    const Game = value.Game;
    value.Game = class extends Game { constructor(...args) {
      super(...args); this.events.on(value.Core.Events.PRE_STEP, environment.demoRafObservation.markPhaser);
    } };
  } });
}

export function aggregateRafWindow(raw, B) {
  const frames = [], intervals = [];
  if (raw.count !== raw.timestamps.length || raw.count !== raw.durations.length || raw.count !== raw.owners.length) throw Error('Truncated callback evidence');
  for (let i = 0; i < raw.count; i++) {
    const timestamp = raw.timestamps[i], duration = raw.durations[i], owner = raw.owners[i];
    if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration < 0) throw Error('Invalid timing');
    const last = frames.at(-1);
    if (last && timestamp < last.timestampMs) throw Error('Non-monotonic rAF timestamps');
    if (last?.timestampMs === timestamp) { last.workMs += duration; last.callbacks++; last.owners |= owner; }
    else { if (last) intervals.push(timestamp - last.timestampMs); frames.push({ timestampMs: timestamp, workMs: duration, callbacks: 1, owners: owner }); }
  }
  let missedOpportunities = 0, maxMissedStreak = 0;
  if (Number.isFinite(B) && B > 0) for (const ms of intervals) { const missed = Math.max(0, Math.round(ms / B) - 1); missedOpportunities += missed; maxMissedStreak = Math.max(maxMissedStreak, missed); }
  return { frames, intervals, missedOpportunities, maxMissedStreak,
    valid: !raw.overflow && !raw.requestOverflow && !raw.callbackErrors && raw.foregroundThroughout && raw.environmentStableThroughout && !raw.ownerChanged,
    phaserFrames: frames.filter((row) => row.owners & 1).length, demoFrames: frames.filter((row) => row.owners & 2).length };
}

export function requiredTaskMetrics(metrics) {
  const values = Object.fromEntries(metrics.map((row) => [row.name, row.value]));
  for (const key of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'Timestamp'])
    if (!Number.isFinite(values[key]) || values[key] < 0) throw Error(`Missing/invalid CDP metric ${key}`);
  return values;
}

export function taskMetricDeltas(before, after) {
  const deltas = {};
  for (const key of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'Timestamp']) {
    const value = after[key] - before[key];
    if (!Number.isFinite(value) || value < 0) throw Error(`Invalid CDP delta ${key}`);
    deltas[key] = value;
  }
  return deltas;
}
