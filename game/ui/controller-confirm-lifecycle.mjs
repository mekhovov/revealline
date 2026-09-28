const withoutPressEdge = (ui = {}) => ({
  ...ui,
  confirm: false,
  confirmStart: false,
  confirmCommit: false,
  confirmCancel: false,
});

/**
 * Turn the router's press edge into a release-committed transaction. The
 * transaction owns every sampled Confirm alias until all of them are neutral.
 */
export function createControllerConfirmLifecycle({
  aliasEchoWindowMs = 1250,
  onTrace = null,
} = {}) {
  if (!Number.isFinite(aliasEchoWindowMs) || aliasEchoWindowMs < 0 || aliasEchoWindowMs > 5000)
    throw new RangeError('Controller Confirm alias echo timing is out of bounds.');
  if (onTrace !== null && typeof onTrace !== 'function')
    throw new TypeError('Controller Confirm trace must be a function.');

  let transaction = null,
    ignoredAlias = false,
    lastCommit = null,
    lastTime = 0;

  const trace = (event, frame, time, extra = {}) =>
    onTrace?.({
      event,
      time,
      gamepadTimestamp: frame?.gamepadTimestamp ?? 0,
      buttons: [...(frame?.confirmButtons || [])],
      phase: transaction ? 'active' : ignoredAlias ? 'alias-echo' : 'idle',
      ...extra,
    });
  const output = (frame, phase = null) => {
    if (!frame) return frame;
    const ui = withoutPressEdge(frame.ui);
    if (phase) ui[phase] = true;
    return { ...frame, ui, confirmTransaction: transaction ? { ...transaction } : null };
  };
  const normalizedContext = (value) =>
    typeof value === 'object' && value !== null ? value : { timeMs: value, scope: null };

  function reset(reason = 'reset', { emitTrace = true } = {}) {
    if (emitTrace && (transaction || ignoredAlias))
      onTrace?.({
        event: 'cancel',
        time: lastTime,
        gamepadTimestamp: 0,
        buttons: [],
        phase: 'idle',
        reason,
      });
    transaction = null;
    ignoredAlias = false;
  }

  function filter(frame, context = {}) {
    const { timeMs, scope = null } = normalizedContext(context),
      clock = Number.isFinite(timeMs) ? timeMs : lastTime,
      time = Math.max(lastTime, clock),
      buttons = [...(frame?.confirmButtons || [])],
      held = frame?.confirmHeld === true || buttons.length > 0,
      edge = frame?.ui?.confirm === true;
    lastTime = time;

    if (!frame || frame.disconnected || !frame.assigned) {
      const canceled = !!transaction;
      if (canceled) trace('cancel', frame, time, { reason: 'disconnect' });
      transaction = null;
      ignoredAlias = false;
      return canceled ? output(frame, 'confirmCancel') : output(frame);
    }

    if (transaction && transaction.scope !== scope) {
      trace('cancel', frame, time, { reason: 'scope-change' });
      transaction = null;
      ignoredAlias = held;
      return output(frame, 'confirmCancel');
    }

    if (transaction) {
      if (held) {
        transaction.buttons = [...new Set([...transaction.buttons, ...buttons])].sort(
          (a, b) => a - b,
        );
        trace('hold', frame, time);
        return output(frame);
      }
      const committed = transaction;
      lastCommit = { time, originalButton: committed.originalButton };
      trace('release', frame, time, { winner: 'pending' });
      transaction = null;
      return {
        ...output(frame, 'confirmCommit'),
        confirmTransaction: { ...committed, releasedAt: time },
      };
    }

    if (ignoredAlias) {
      if (!held) {
        ignoredAlias = false;
        trace('alias-echo-release', frame, time);
      }
      return output(frame);
    }

    if (!edge || !held) return output(frame);
    const originalButton = buttons[0];
    const differentRecentAlias =
      lastCommit &&
      time - lastCommit.time <= aliasEchoWindowMs &&
      !buttons.includes(lastCommit.originalButton);
    if (differentRecentAlias) {
      ignoredAlias = true;
      trace('alias-echo-suppressed', frame, time, {
        originalButton: lastCommit.originalButton,
      });
      return output(frame);
    }
    transaction = {
      startedAt: time,
      scope,
      originalButton,
      buttons: [...buttons],
      gamepadTimestamp: frame.gamepadTimestamp ?? 0,
    };
    trace('start', frame, time);
    return output(frame, 'confirmStart');
  }

  return {
    filter,
    owned: () => transaction !== null || ignoredAlias,
    phase: () => (transaction ? 'active' : ignoredAlias ? 'alias-echo' : 'idle'),
    reset,
  };
}
