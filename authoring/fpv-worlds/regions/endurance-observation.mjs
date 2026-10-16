/** Review-only visibility policy; never changes the production player or elapsed clock. */
export function createEnduranceObservation({ policy = 'strict-focus', startedAt }) {
  if (
    !['strict-focus', 'visible-commanded'].includes(policy) ||
    !Number.isFinite(startedAt) ||
    startedAt < 0
  )
    throw new TypeError('Invalid endurance observation policy');
  const events = [];
  let previous = null,
    failure = null;
  return Object.freeze({
    observe({ at, visible, focused, type = 'sample' }) {
      if (failure) return failure;
      if (
        !Number.isFinite(at) ||
        at < startedAt ||
        typeof visible !== 'boolean' ||
        typeof focused !== 'boolean' ||
        !['start', 'sample', 'focus', 'blur', 'visibilitychange'].includes(type)
      )
        return (failure = 'Invalid visibility/focus observation');
      const changed = !previous || previous.visible !== visible || previous.focused !== focused;
      if (changed || type !== 'sample') {
        if (events.length >= 1024) return (failure = 'Focus-event trace exceeded its bound');
        events.push({ elapsedMs: at - startedAt, type, visible, focused });
      }
      previous = { visible, focused };
      if (!visible) failure = 'Tab hidden';
      else if (policy === 'strict-focus' && !focused) failure = 'Window lost focus';
      return failure;
    },
    snapshot() {
      return {
        policy,
        input: 'Commanded test pilot only; no player input',
        scope:
          policy === 'strict-focus'
            ? 'Visible document with continuous window focus required'
            : 'Visible document; window focus optional and recorded, not physical-input qualification',
        events: events.map((event) => ({ ...event })),
        failure,
      };
    },
  });
}
