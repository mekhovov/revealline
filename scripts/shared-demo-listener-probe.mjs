let sequence = 0;
const signature = (listener) => ({
  type: listener.type,
  useCapture: listener.useCapture,
  passive: listener.passive,
  once: listener.once,
  scriptId: listener.scriptId,
  lineNumber: listener.lineNumber,
  columnNumber: listener.columnNumber,
});
const key = (value) => JSON.stringify(value);

/** Inspect actual direct listeners, releasing every CDP handle created by the probe. */
export async function captureCDPListeners(protocol, targets) {
  const objectGroup = `shared-demo-listeners-${++sequence}`;
  const handlers = new Set();
  const rows = [];
  let primaryFailure;
  try {
    for (const target of targets) {
      const { result, exceptionDetails } = await protocol.send('Runtime.evaluate', {
        expression: target.expression,
        objectGroup,
        returnByValue: false,
        silent: true,
      });
      if (exceptionDetails || !result.objectId || result.subtype === 'null')
        throw new Error(`Listener target unavailable: ${target.label}`);
      let backendNodeId;
      if (target.node) {
        const { node } = await protocol.send('DOM.describeNode', {
          objectId: result.objectId,
          depth: 0,
        });
        backendNodeId = node.backendNodeId;
      }
      const { listeners } = await protocol.send('DOMDebugger.getEventListeners', {
        objectId: result.objectId,
        depth: 1,
        pierce: false,
      });
      for (const listener of listeners)
        for (const handler of [listener.handler, listener.originalHandler])
          if (handler?.objectId) handlers.add(handler.objectId);
      // CDP may include descendant nodes at the requested depth. Compare only
      // the requested DOM owner, never aggregate its subtree as direct listeners.
      if (target.node && listeners.some((listener) => !Number.isInteger(listener.backendNodeId)))
        throw new Error(`CDP omitted direct listener ownership for ${target.label}.`);
      const direct = listeners
        .filter((listener) => !target.node || listener.backendNodeId === backendNodeId)
        .map(signature)
        .sort((a, b) => key(a).localeCompare(key(b)));
      const types = {};
      for (const listener of direct) types[listener.type] = (types[listener.type] ?? 0) + 1;
      rows.push({ target: target.label, count: direct.length, types, listeners: direct });
    }
    return rows;
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    // Handler handles returned by DOMDebugger need their own release; they are
    // not assumed to inherit Runtime.evaluate's object group.
    const cleanup = await Promise.allSettled([
      ...[...handlers].map((objectId) => protocol.send('Runtime.releaseObject', { objectId })),
      protocol.send('Runtime.releaseObjectGroup', { objectGroup }),
    ]);
    const failures = cleanup.filter((item) => item.status === 'rejected');
    if (failures.length && !primaryFailure)
      throw new AggregateError(
        failures.map((item) => item.reason),
        'Listener probe could not release every diagnostic handle.',
      );
  }
}

/** Multiset comparison detects duplicate handlers and option/owner changes. */
export function diffCDPListeners(before, after) {
  const changes = [];
  const collect = (rows) => {
    const result = new Map();
    for (const row of rows)
      for (const listener of row.listeners) {
        const item = { target: row.target, ...listener };
        const id = key(item);
        const count = result.get(id)?.count ?? 0;
        result.set(id, { ...item, count: count + 1 });
      }
    return result;
  };
  const first = collect(before),
    last = collect(after);
  for (const id of new Set([...first.keys(), ...last.keys()])) {
    const a = first.get(id),
      b = last.get(id);
    const delta = (b?.count ?? 0) - (a?.count ?? 0);
    if (delta)
      changes.push({ ...(b ?? a), beforeCount: a?.count ?? 0, afterCount: b?.count ?? 0, delta });
  }
  return changes.sort((a, b) => key(a).localeCompare(key(b)));
}

/** Serialized into the ephemeral browser context; no listeners or clock hooks. */
export function installPausedOriginProbe(environment = globalThis) {
  let phaser, origin, checkpoint;
  const seen = new WeakSet();
  const identities = new WeakMap();
  let nextIdentity = 1;
  Object.defineProperty(environment, 'Phaser', {
    configurable: true,
    get: () => phaser,
    set(value) {
      phaser = value;
      if (!value || seen.has(value)) return;
      seen.add(value);
      const Game = value.Game;
      value.Game = class extends Game {
        constructor(...args) {
          super(...args);
          // Later native demo renderers must not replace the ordinary origin.
          origin ??= new WeakRef(this);
        }
      };
    },
  });
  environment.sharedDemoPausedOriginProbe = {
    install(checkpointFunction) {
      if (checkpoint || typeof checkpointFunction !== 'function')
        throw new Error('Install exactly one authoritative checkpoint reader.');
      checkpoint = checkpointFunction;
    },
    read() {
      const game = origin?.deref();
      const run = game?.scene?.scenes?.find((scene) => scene.lastPaint?.run)?.lastPaint.run;
      if (!run || !checkpoint) throw new Error('The paused originating native run is unavailable.');
      if (!identities.has(run)) identities.set(run, nextIdentity++);
      return {
        phase: environment.document.body.dataset.flightState,
        id: identities.get(run),
        tick: run.tick,
        status: run.status,
        classId: run.classId,
        levelId: run.level.id,
        checkpoint: checkpoint(run),
      };
    },
  };
}
