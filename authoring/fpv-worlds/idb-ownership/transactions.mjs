// Explicit authoring opt-in. Observes caller-owned operations; issues no IDB operation.
export const TRANSACTION_LIMITS = Object.freeze({
  history: 128,
  active: 32,
  reads: 4,
});
const databases = new Set([
  "revealline-fpv-worlds-v1",
  "revealline-fpv-regions-v1",
  "revealline.fpv.world-records.v1",
]);
const stores = new Set([
  "projects",
  "revisions",
  "records",
  "session",
  "assets",
  "meta",
]);
const errorNames = new Set([
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
const errorName = (error) =>
  errorNames.has(error?.name) ? error.name : "<unknown error>";
const count = (value) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);

/** Only a complete, unfiltered, successful application read may establish empty. */
export function listingObservation(row) {
  const unknown = {
    scope: "unknown",
    outcome: "unknown",
    activeRows: null,
    retainedRows: null,
  };
  if (row.mode !== "readonly" || row.incomplete) return unknown;
  const only = (...expected) =>
    row.stores.length === expected.length &&
    expected.every((s) => row.stores.includes(s));
  const read = (name) => {
    const found = row.reads.filter((r) => r.store === name);
    return found.length === 1 &&
      found[0].unfiltered &&
      found[0].state === "complete"
      ? found[0]
      : null;
  };
  const world =
    row.name !== "revealline.fpv.world-records.v1" &&
    only("projects", "revisions");
  const records =
    row.name === "revealline.fpv.world-records.v1" && only("records");
  if (!world && !records) return unknown;
  const hasRetained = world && row.reads.some((r) => r.store === "revisions");
  const scope = records
    ? "records"
    : hasRetained
      ? "active-and-retained"
      : "active-only";
  if (row.state === "failed" || row.reads.some((r) => r.state === "failed"))
    return { ...unknown, scope, outcome: "failed" };
  if (row.state !== "complete")
    return {
      ...unknown,
      scope,
      outcome: row.state === "pending" ? "pending" : "unknown",
    };
  const active = read(records ? "records" : "projects");
  const retained = hasRetained ? read("revisions") : null;
  if (active === null || (hasRetained && retained === null))
    return { ...unknown, scope };
  return {
    scope,
    outcome: active.rows + (retained?.rows ?? 0) === 0 ? "empty" : "nonempty",
    activeRows: active.rowsExact ? active.rows : null,
    retainedRows: retained?.rowsExact ? retained.rows : null,
  };
}

/**
 * Instance-method interception only, never ambient prototypes. Every caller operation
 * is delegated once with its original receiver, arguments, return and thrown object.
 * Metadata counts are read only from requests already issued by the application.
 */
export function createTransactionObservation({
  record = () => {},
  caller = () => [],
  diagnosticError = () => {},
} = {}) {
  const history = [],
    active = new Set(),
    retire = new Set();
  let stopped = false,
    next = 0;
  const counts = {
    starts: 0,
    failedStarts: 0,
    droppedHistory: 0,
    droppedActive: 0,
    refused: 0,
    restorationSkipped: 0,
  };
  const safe = (apply) => {
    try {
      return apply();
    } catch {
      diagnosticError();
    }
  };
  const emit = (kind, row, facts = {}) =>
    record(kind, {
      connection: row.connection,
      transaction: row.transaction,
      ...facts,
    });
  const retain = (row) => {
    if (history.length === TRANSACTION_LIMITS.history) {
      history.shift();
      counts.droppedHistory = count(counts.droppedHistory);
    }
    history.push(row);
  };
  function wrap(target, key, make, owned) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key),
      original = target[key];
    if (typeof original !== "function")
      throw new TypeError("Method unavailable");
    const wrapper = make(original);
    Object.defineProperty(target, key, {
      value: wrapper,
      configurable: true,
      writable: true,
    });
    const restore = () => {
      if (Object.getOwnPropertyDescriptor(target, key)?.value === wrapper) {
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else delete target[key];
      } else counts.restorationSkipped = count(counts.restorationSkipped);
      retire.delete(restore);
      owned?.delete(restore);
    };
    retire.add(restore);
    owned?.add(restore);
  }
  function listen(target, type, callback, owned) {
    target.addEventListener(type, callback);
    const remove = () => {
      target.removeEventListener(type, callback);
      retire.delete(remove);
      owned.delete(remove);
    };
    retire.add(remove);
    owned.add(remove);
  }
  function track(tx, connection, owner) {
    counts.starts = count(counts.starts);
    if (active.size === TRANSACTION_LIMITS.active) {
      counts.droppedActive = count(counts.droppedActive);
      record("transaction-not-tracked", {
        connection: connection.connection,
        reason: "active-cap",
      });
      return;
    }
    const row = {
      transaction: ++next,
      connection: connection.connection,
      name: connection.name,
      stores: [...tx.objectStoreNames].map((name) =>
        stores.has(name) ? name : "<other store>",
      ),
      mode: ["readonly", "readwrite", "versionchange"].includes(tx.mode)
        ? tx.mode
        : "<unknown>",
      caller: owner,
      state: "pending",
      reads: [],
      incomplete: false,
      errorEvents: 0,
      precedingExplicitCloseCalls: connection.explicitCloseCalls,
      precedingVersionChangeEvents: connection.versionChangeEvents,
      precedingAbnormalCloseEvents: connection.forcedCloseEvents,
    };
    const owned = new Set(),
      seenStores = new WeakSet();
    const finish = (state, event) =>
      safe(() => {
        row.state = state;
        row.terminalEventTrusted = event.isTrusted === true;
        emit("transaction-" + state, row, {
          trusted: event.isTrusted === true,
          error: state === "failed" ? errorName(tx.error) : null,
        });
        for (const remove of [...owned]) safe(remove);
        active.delete(owned);
      });
    active.add(owned);
    retain(row);
    emit("transaction-start", row, {
      mode: row.mode,
      stores: row.stores,
      caller: owner,
    });
    listen(tx, "complete", (event) => finish("complete", event), owned);
    listen(tx, "abort", (event) => finish("failed", event), owned);
    listen(
      tx,
      "error",
      () =>
        safe(() => {
          row.errorEvents = count(row.errorEvents);
        }),
      owned,
    );
    if (row.mode !== "readonly") return;
    function trackRead(request, store, method, unfiltered) {
      if (row.reads.length === TRANSACTION_LIMITS.reads) {
        row.incomplete = true;
        return;
      }
      const read = {
        store,
        method,
        unfiltered,
        state: "pending",
        rows: null,
        rowsExact: null,
      };
      row.reads.push(read);
      let traversed = 0;
      listen(
        request,
        "success",
        (event) =>
          safe(() => {
            read.successEventsTrusted =
              read.successEventsTrusted !== false && event.isTrusted === true;
            if (method === "getAll") {
              if (!Array.isArray(request.result)) {
                row.incomplete = true;
                return;
              }
              read.rows = request.result.length;
              read.rowsExact = true;
              read.state = "complete";
            } else if (request.result === null) {
              read.rows = traversed;
              // Caller-owned advance(n) / continue(key) may skip rows. We do not
              // intercept progression, so nonzero deliveries are only a lower bound.
              // No delivered row followed by exhaustion still establishes zero.
              read.rowsExact = traversed === 0;
              read.state = "complete";
            } else traversed = count(traversed);
          }),
        owned,
      );
      listen(
        request,
        "error",
        () =>
          safe(() => {
            read.state = "failed";
          }),
        owned,
      );
    }
    try {
      wrap(
        tx,
        "objectStore",
        (original) =>
          function (...args) {
            const store = Reflect.apply(original, this, args);
            if (!stopped && this === tx)
              safe(() => {
                if (
                  seenStores.has(store) ||
                  !["projects", "revisions", "records"].includes(store.name)
                )
                  return;
                seenStores.add(store);
                for (const method of ["getAll", "openCursor"]) {
                  try {
                    wrap(
                      store,
                      method,
                      (read) =>
                        function (...readArgs) {
                          const request = Reflect.apply(read, this, readArgs);
                          if (!stopped && this === store)
                            safe(() =>
                              trackRead(
                                request,
                                store.name,
                                method,
                                readArgs.length === 0,
                              ),
                            );
                          return request;
                        },
                      owned,
                    );
                  } catch {
                    row.incomplete = true;
                    counts.refused = count(counts.refused);
                  }
                }
              });
            return store;
          },
        owned,
      );
    } catch {
      row.incomplete = true;
      counts.refused = count(counts.refused);
    }
  }
  return Object.freeze({
    attach(db, connection) {
      if (stopped || !databases.has(connection.name)) return;
      try {
        wrap(
          db,
          "transaction",
          (original) =>
            function (...args) {
              let tx;
              try {
                tx = Reflect.apply(original, this, args);
              } catch (error) {
                if (!stopped && this === db)
                  safe(() => {
                    counts.failedStarts = count(counts.failedStarts);
                    const row = {
                      transaction: ++next,
                      connection: connection.connection,
                      name: connection.name,
                      stores: [],
                      mode: "<unknown>",
                      caller: caller(),
                      state: "failed",
                      reads: [],
                      incomplete: true,
                      error: errorName(error),
                      precedingExplicitCloseCalls:
                        connection.explicitCloseCalls,
                      precedingVersionChangeEvents:
                        connection.versionChangeEvents,
                      precedingAbnormalCloseEvents:
                        connection.forcedCloseEvents,
                    };
                    retain(row);
                    emit("transaction-start-failed", row, {
                      error: row.error,
                      caller: row.caller,
                    });
                  });
                throw error;
              }
              if (!stopped && this === db)
                safe(() => track(tx, connection, caller()));
              return tx;
            },
        );
        connection.transactionInterception = "instance-method-wrapper";
      } catch {
        connection.transactionInterception = "refused";
        counts.refused = count(counts.refused);
      }
    },
    snapshot() {
      return structuredClone({
        enabled: true,
        stopped,
        limits: TRANSACTION_LIMITS,
        counts: { ...counts },
        activeTransactions: active.size,
        ownedRetireActions: retire.size,
        history: history.map((row) => ({
          ...row,
          listing: listingObservation(row),
        })),
        boundary:
          "Application requests only; no extra read, probe, open, reconnect or storage mutation. Counts do not prove original-context contents or loss. Failed starts have unknown scope because arguments are not coerced twice.",
      });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const row of history)
        if (row.state === "pending") row.state = "stopped-unknown";
      for (const remove of [...retire]) safe(remove);
      active.clear();
    },
  });
}
