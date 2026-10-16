/** Bounded authoring diagnostics only; never changes clock acceptance or scheduling. */
export function createEnduranceLifecycle({
  startedAt,
  now = () => performance.now(),
  document: doc = globalThis.document,
  window: win = globalThis.window,
  PerformanceObserver: Observer = globalThis.PerformanceObserver,
}) {
  if (!Number.isFinite(startedAt) || startedAt < 0) throw new TypeError('Invalid trace start');
  const events = [],
    tasks = [],
    frames = [],
    removers = [];
  const dropped = { events: 0, longTasks: 0, frames: 0 };
  let observer = null,
    stopped = false,
    previousFrame = startedAt,
    count = 0,
    total = 0,
    maximum = 0;
  let capability = 'unsupported';
  const append = (rows, item, key, limit) => {
    if (rows.length === limit) {
      rows.shift();
      dropped[key]++;
    }
    rows.push(item);
  };
  const state = (type, event) => {
    if (stopped) return;
    const at = now();
    if (!Number.isFinite(at) || at < startedAt) return;
    append(
      events,
      {
        elapsedMs: at - startedAt,
        type,
        visible: doc?.visibilityState === 'visible',
        focused: Boolean(doc?.hasFocus?.()),
        ...(typeof event?.persisted === 'boolean' ? { persisted: event.persisted } : {}),
      },
      'events',
      128,
    );
  };
  const receive = (entries) => {
    for (const entry of entries) {
      if (
        !Number.isFinite(entry.startTime) ||
        entry.startTime < startedAt ||
        !Number.isFinite(entry.duration) ||
        entry.duration < 0
      )
        continue;
      count++;
      total += entry.duration;
      maximum = Math.max(maximum, entry.duration);
      // Names/attribution URLs are deliberately excluded: timing, not private page data.
      append(
        tasks,
        { elapsedMs: entry.startTime - startedAt, durationMs: entry.duration },
        'longTasks',
        64,
      );
    }
  };
  for (const [target, types] of [
    [win, ['focus', 'blur', 'pagehide', 'pageshow']],
    [doc, ['visibilitychange', 'freeze', 'resume']],
  ]) {
    for (const type of types) {
      const handler = (event) => state(type, event);
      target?.addEventListener?.(type, handler);
      removers.push(() => target?.removeEventListener?.(type, handler));
    }
  }
  state('start');
  if (Observer?.supportedEntryTypes?.includes('longtask')) {
    try {
      observer = new Observer((list) => {
        if (!stopped) receive(list.getEntries());
      });
      observer.observe({ type: 'longtask', buffered: false });
      capability = 'observed';
    } catch {
      observer?.disconnect();
      observer = null;
      capability = 'unavailable';
    }
  }
  return Object.freeze({
    pageExit(event) {
      state('pagehide', event);
    },
    frame(at) {
      if (stopped || !Number.isFinite(at) || at < previousFrame) return;
      append(frames, { elapsedMs: at - startedAt, intervalMs: at - previousFrame }, 'frames', 64);
      previousFrame = at;
    },
    stop() {
      if (stopped) return;
      if (observer) {
        receive(observer.takeRecords());
        observer.disconnect();
      }
      state('stop');
      stopped = true;
      for (const remove of removers) remove();
    },
    snapshot() {
      return {
        scope:
          'Diagnostic correlation only; focus/lifecycle/long-task timing cannot identify the cause of a rendering gap. Clock, visibility and safety acceptance are unchanged.',
        events: events.map((row) => ({ ...row })),
        lastFrames: frames.map((row) => ({ ...row })),
        longTasks: {
          capability,
          count,
          totalMs: total,
          maxMs: maximum,
          last: tasks.map((row) => ({ ...row })),
        },
        dropped: { ...dropped },
        stopped,
      };
    },
  });
}
