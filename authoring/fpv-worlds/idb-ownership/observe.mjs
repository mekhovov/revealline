// Authoring diagnostics only. No database is opened, enumerated or transacted by this tool.
export const OWNERSHIP_LIMITS = Object.freeze({
  events: 128,
  connections: 32,
  pendingRequests: 64,
  callerFrames: 4,
});
const names = new Set([
  "revealline-fpv-worlds-v1",
  "revealline-fpv-regions-v1",
  "revealline.fpv.world-records.v1",
  "revealline-fpv-regional-locations-v1",
  "revealline-journey-v1",
]);
const errors = new Set([
  "AbortError",
  "ConstraintError",
  "DataError",
  "InvalidAccessError",
  "InvalidStateError",
  "NotFoundError",
  "QuotaExceededError",
  "ReadOnlyError",
  "SecurityError",
  "TransactionInactiveError",
  "TypeError",
  "UnknownError",
  "VersionError",
]);
const version = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;
const increment = (value) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);

/** Retain only owned source paths/line locations, never raw stacks or origin/query data. */
export function ownedCallers(stack) {
  if (typeof stack !== "string") return [];
  const result = [];
  for (const line of stack.slice(0, 8192).split("\n").slice(0, 24)) {
    const match = line.match(/((?:https?|file):\/\/[^\s()]+):(\d+):(\d+)\)?$/);
    if (!match) continue;
    try {
      const path = new URL(match[1]).pathname,
        owned = path.match(
          /\/(optional-practice\/[^?#]+|game\/[^?#]+|authoring\/fpv-worlds\/[^?#]+)$/,
        )?.[1];
      if (
        !owned ||
        owned.length > 180 ||
        !/^[a-zA-Z0-9_./-]+\.m?js$/.test(owned) ||
        owned.split("/").includes("..")
      )
        continue;
      // The observer's wrapper is not the application owner.
      if (owned.startsWith("authoring/fpv-worlds/idb-ownership/")) continue;
      const row = {
        path: owned,
        line: version(+match[2]),
        column: version(+match[3]),
      };
      if (row.line === null || row.column === null) continue;
      result.push(row);
      if (result.length === OWNERSHIP_LIMITS.callerFrames) break;
    } catch {
      /* A malformed location is unknown, never raw fallback text. */
    }
  }
  return result;
}

/**
 * The facade changes factory/method identity, but delegates caller operations once,
 * with the original native receiver/arguments/result/error. Native requests/databases
 * are not proxies. Explicit close interception is separate and OFF by default.
 */
export function createIDBOwnershipObserver({
  indexedDB,
  captureExplicitClose = false,
  now = () => globalThis.performance.now(),
  stack = () => new Error().stack,
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== "function")
    throw new TypeError("IndexedDB factory required");
  const events = [],
    connections = [],
    pending = new Set(),
    retire = new Set(),
    methods = new Map();
  let stopped = false,
    sequence = 0,
    facade;
  const counts = {
    opens: 0,
    droppedEvents: 0,
    droppedConnections: 0,
    droppedRequests: 0,
    diagnosticErrors: 0,
    closeInterceptions: 0,
    closeInterceptionRefused: 0,
    restorationSkipped: 0,
  };
  const safe = (apply) => {
    try {
      return apply();
    } catch {
      counts.diagnosticErrors = increment(counts.diagnosticErrors);
    }
  };
  const caller = () => safe(() => ownedCallers(stack())) ?? [];
  function record(kind, facts = {}) {
    if (stopped) return;
    const time = safe(() => now());
    if (events.length === OWNERSHIP_LIMITS.events) {
      events.shift();
      counts.droppedEvents = increment(counts.droppedEvents);
    }
    events.push({
      sequence: ++sequence,
      atMs: Number.isFinite(time) && time >= 0 ? time : null,
      kind,
      ...facts,
    });
  }
  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    const remove = () => {
      target.removeEventListener(type, callback);
      retire.delete(remove);
    };
    retire.add(remove);
    return remove;
  }
  function trackDatabase(db, openCaller, trusted) {
    if (connections.length === OWNERSHIP_LIMITS.connections) {
      counts.droppedConnections = increment(counts.droppedConnections);
      record("connection-not-tracked", { reason: "connection-cap" });
      return;
    }
    const row = {
      connection: connections.length + 1,
      name: names.has(db.name) ? db.name : "<other database>",
      version: version(db.version),
      openCaller,
      openEventTrusted: trusted,
      forcedCloseEvents: 0,
      versionChangeEvents: 0,
      explicitCloseCalls: captureExplicitClose ? 0 : null,
      closeInterception: "disabled",
    };
    connections.push(row);
    record("open-success", {
      connection: row.connection,
      name: row.name,
      version: row.version,
      trusted,
    });
    listen(db, "close", (event) =>
      safe(() => {
        row.forcedCloseEvents = increment(row.forcedCloseEvents);
        record("abnormal-close-event", {
          connection: row.connection,
          trusted: event.isTrusted === true,
        });
      }),
    );
    listen(db, "versionchange", (event) =>
      safe(() => {
        row.versionChangeEvents = increment(row.versionChangeEvents);
        record("versionchange-event", {
          connection: row.connection,
          oldVersion: version(event.oldVersion),
          newVersion: version(event.newVersion),
          trusted: event.isTrusted === true,
        });
      }),
    );
    if (!captureExplicitClose) return;
    const own = Object.getOwnPropertyDescriptor(db, "close"),
      original = db.close;
    const wrapped = function (...args) {
      // Preserve a borrowed method's receiver, return value and thrown object.
      const result = Reflect.apply(original, this, args);
      if (!stopped && this === db)
        safe(() => {
          row.explicitCloseCalls = increment(row.explicitCloseCalls);
          record("explicit-close-call", {
            connection: row.connection,
            caller: caller(),
          });
        });
      return result;
    };
    try {
      if (typeof original !== "function")
        throw new TypeError("Close method unavailable");
      Object.defineProperty(db, "close", {
        value: wrapped,
        writable: true,
        configurable: true,
      });
      row.closeInterception = "instance-method-wrapper";
      counts.closeInterceptions = increment(counts.closeInterceptions);
      const restore = () => {
        // Never overwrite a later application's own replacement.
        if (Object.getOwnPropertyDescriptor(db, "close")?.value === wrapped) {
          if (own) Object.defineProperty(db, "close", own);
          else delete db.close;
          row.closeInterception = "restored";
        } else {
          counts.restorationSkipped = increment(counts.restorationSkipped);
          row.closeInterception = "later-owner-kept";
        }
        retire.delete(restore);
      };
      retire.add(restore);
    } catch {
      row.closeInterception = "refused";
      row.explicitCloseCalls = null;
      counts.closeInterceptionRefused = increment(
        counts.closeInterceptionRefused,
      );
    }
  }
  function trackRequest(request, openCaller) {
    if (pending.size === OWNERSHIP_LIMITS.pendingRequests) {
      counts.droppedRequests = increment(counts.droppedRequests);
      record("request-not-tracked", { reason: "pending-cap" });
      return;
    }
    const cleanups = [];
    const finish = () => {
      cleanups.forEach((remove) => remove());
      pending.delete(finish);
    };
    pending.add(finish);
    cleanups.push(
      listen(request, "success", (event) => {
        finish();
        if (!stopped)
          safe(() =>
            trackDatabase(request.result, openCaller, event.isTrusted === true),
          );
      }),
    );
    cleanups.push(
      listen(request, "error", () => {
        finish();
        safe(() =>
          record("open-error", {
            error: errors.has(request.error?.name)
              ? request.error.name
              : "<unknown error>",
            caller: openCaller,
          }),
        );
      }),
    );
    cleanups.push(
      listen(request, "blocked", (event) =>
        safe(() =>
          record("open-blocked", {
            oldVersion: version(event.oldVersion),
            newVersion: version(event.newVersion),
            trusted: event.isTrusted === true,
            caller: openCaller,
          }),
        ),
      ),
    );
    // No upgradeneeded listener: only the application's normal owner manages schema.
  }
  facade = new Proxy(indexedDB, {
    get(target, key) {
      const original = Reflect.get(target, key, target);
      if (
        !["open", "deleteDatabase", "cmp", "databases"].includes(key) ||
        typeof original !== "function"
      )
        return original;
      if (methods.get(key)?.original === original)
        return methods.get(key).wrapper;
      const wrapper = function (...args) {
        const receiver = this === facade ? target : this;
        // No coercion/inspection of names, versions or option objects before native open.
        const result = Reflect.apply(original, receiver, args);
        if (key === "open" && !stopped)
          safe(() => {
            counts.opens = increment(counts.opens);
            trackRequest(result, caller());
          });
        return result;
      };
      methods.set(key, { original, wrapper });
      return wrapper;
    },
  });
  return Object.freeze({
    indexedDB: facade,
    snapshot() {
      return structuredClone({
        format: "FPVIDBConnectionObservation.v1",
        stopped,
        limits: OWNERSHIP_LIMITS,
        counts,
        pendingRequests: pending.size,
        ownedRetireActions: retire.size,
        connections,
        events,
        coverage: {
          factoryFacade: true,
          ambientFactoryOrPrototypePatched: false,
          explicitCloseInterceptionRequested: captureExplicitClose,
          nativeRequestAndDatabaseIdentityPreserved: true,
          connectionsOutsideFacade: "not-observed",
          borrowedCloseReceivers: "not-observed",
          synchronousOpenExceptions: "delegated; not-observed",
          connectionState: "events-only; no liveness probe",
          rootCause: "not-established",
          nativeOfflineRestartEviction: "not-measured",
        },
      });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const remove of [...retire]) safe(remove);
      pending.clear();
      // Close listeners are retired, not the connections. Delegation remains usable.
    },
  });
}

/** Only an authoring host injects this facade; globals and native prototypes stay intact. */
export function windowWithObservedIDB(window, indexedDB) {
  const functions = new WeakMap();
  let facade;
  facade = new Proxy(window, {
    get(target, key) {
      if (key === "indexedDB") return indexedDB;
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      if (functions.has(value)) return functions.get(value);
      const wrapper = new Proxy(value, {
        apply(fn, receiver, args) {
          return Reflect.apply(
            fn,
            receiver === facade ? target : receiver,
            args,
          );
        },
      });
      functions.set(value, wrapper);
      return wrapper;
    },
  });
  return facade;
}
