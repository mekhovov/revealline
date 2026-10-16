import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createIDBOwnershipObserver } from "./observe.mjs";
import { TRANSACTION_LIMITS } from "./transactions.mjs";
import { openWorldStore } from "../../../optional-practice/civilian-fpv/world-store.mjs";
const { IDBFactory, IDBDatabase } = createRequire(
  new URL("../package.json", import.meta.url),
)("fake-indexeddb");
const name = "revealline-fpv-regions-v1";
const tick = () => new Promise((resolve) => setImmediate(resolve));
const done = (tx) =>
  new Promise((resolve) => {
    tx.addEventListener("complete", resolve, { once: true });
    tx.addEventListener("abort", resolve, { once: true });
  });
function opened(factory, dbName = name) {
  const request = factory.open(dbName, 2);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("projects", { keyPath: "id" });
    request.result.createObjectStore("revisions", {
      keyPath: ["id", "sha256"],
    });
  };
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function observer(options = {}) {
  return createIDBOwnershipObserver({
    indexedDB: new IDBFactory(),
    captureTransactions: true,
    ...options,
  });
}
function last(tool) {
  return tool.snapshot().transactions.history.at(-1);
}
function listing(db, query = undefined) {
  const tx = db.transaction(["projects", "revisions"], "readonly");
  const active = tx
    .objectStore("projects")
    .getAll(...(query === undefined ? [] : [query]));
  const cursor = tx.objectStore("revisions").openCursor();
  cursor.onsuccess = () => cursor.result?.continue();
  return { tx, active, cursor, done: done(tx) };
}

test("transaction capture is opt-in; mount/snapshot issue no operation and native methods stay unchanged by default", async () => {
  const factory = new IDBFactory(),
    tool = createIDBOwnershipObserver({ indexedDB: factory });
  assert.equal(tool.snapshot().transactions.enabled, false);
  assert.equal(tool.snapshot().counts.opens, 0);
  const db = await opened(tool.indexedDB);
  assert.equal(db.transaction, IDBDatabase.prototype.transaction);
  assert.equal(Object.hasOwn(db, "transaction"), false);
  tool.stop();
  db.close();
});

test("actual main741 WorldStore listing distinguishes successful empty, active-only and retained metadata without exporting content", async () => {
  const factory = new IDBFactory();
  let transactions = 0;
  const tool = observer({ indexedDB: factory });
  const open = factory.open;
  factory.open = function (...args) {
    const req = Reflect.apply(open, this, args);
    req.addEventListener("success", () => {
      const db = req.result,
        native = db.transaction;
      db.transaction = function (...txArgs) {
        transactions++;
        return Reflect.apply(native, this, txArgs);
      };
    });
    return req;
  };
  const store = await openWorldStore({ indexedDB: tool.indexedDB, name });
  assert.deepEqual(await store.list({ includeRevisions: true }), []);
  assert.deepEqual(last(tool).listing, {
    scope: "active-and-retained",
    outcome: "empty",
    activeRows: 0,
    retainedRows: 0,
  });
  assert.equal(
    last(tool).terminalEventTrusted,
    false,
    "Fake-IDB is explicitly synthetic evidence",
  );
  for (const sha256 of ["a".repeat(64), "b".repeat(64)])
    await store.install({
      project: { id: "private-world", title: "private-title" },
      assets: new Map([["private-asset", new Blob(["private-payload"])]]),
      sha256,
    });
  assert.equal((await store.list({ includeRevisions: true })).length, 2);
  assert.deepEqual(last(tool).listing, {
    scope: "active-and-retained",
    outcome: "nonempty",
    activeRows: 1,
    retainedRows: 2,
  });
  await store.list();
  assert.deepEqual(last(tool).listing, {
    scope: "active-only",
    outcome: "nonempty",
    activeRows: 1,
    retainedRows: null,
  });
  const count = transactions,
    report = tool.snapshot();
  assert.equal(transactions, count, "A snapshot must never probe a connection");
  assert.equal(
    transactions,
    report.transactions.counts.starts,
    "Each caller transaction delegates exactly once",
  );
  assert(!JSON.stringify(report).includes("private"));
  report.transactions.history.at(-1).reads[0].rows = 999;
  assert.equal(
    last(tool).reads[0].rows,
    1,
    "Snapshots cannot alter retained observations",
  );
  tool.stop();
  store.close();
});

test("pending, caller-aborted, filtered and stopped reads never establish empty", async () => {
  const tool = observer(),
    db = await opened(tool.indexedDB);
  const aborted = listing(db);
  assert.equal(last(tool).listing.outcome, "pending");
  aborted.tx.abort();
  await aborted.done;
  assert.equal(last(tool).listing.outcome, "failed");
  const filtered = listing(db, "absent-private-key");
  await filtered.done;
  assert.equal(last(tool).listing.outcome, "unknown");
  const stopped = listing(db);
  tool.stop();
  await stopped.done;
  assert.equal(last(tool).state, "stopped-unknown");
  assert.equal(last(tool).listing.outcome, "unknown");
  assert.equal(tool.snapshot().transactions.ownedRetireActions, 0);
  db.close();
});

test("a real caller close and later failed start share connection identity and sanitized caller evidence", async () => {
  const tool = observer({
    captureExplicitClose: true,
    stack: () =>
      "Error private\n at owner (https://user:secret@example.invalid/path/optional-practice/civilian-fpv/world-store.mjs?private=1#private:425:21)",
  });
  const store = await openWorldStore({ indexedDB: tool.indexedDB, name });
  store.close();
  await assert.rejects(store.list({ includeRevisions: true }), {
    name: "InvalidStateError",
  });
  const report = tool.snapshot(),
    failure = last(tool);
  assert.equal(failure.state, "failed");
  assert.equal(failure.error, "InvalidStateError");
  assert.equal(failure.precedingExplicitCloseCalls, 1);
  assert.equal(failure.connection, report.connections[0].connection);
  assert.deepEqual(
    report.events.find((row) => row.kind === "explicit-close-call").caller,
    [
      {
        path: "optional-practice/civilian-fpv/world-store.mjs",
        line: 425,
        column: 21,
      },
    ],
  );
  assert.equal(
    failure.listing.outcome,
    "unknown",
    "Failed WebIDL arguments are not inspected/coerced again",
  );
  assert(!/private|secret|example.invalid|user:/.test(JSON.stringify(report)));
  tool.stop();
});

test("record listing scope and versionchange-triggered close stay distinct from an unobserved original cause", async () => {
  const factory = new IDBFactory(),
    tool = observer({ indexedDB: factory, captureExplicitClose: true });
  const request = tool.indexedDB.open("revealline.fpv.world-records.v1", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("records");
  const db = await new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
  });
  const tx = db.transaction("records", "readonly");
  tx.objectStore("records").getAll();
  await done(tx);
  assert.deepEqual(last(tool).listing, {
    scope: "records",
    outcome: "empty",
    activeRows: 0,
    retainedRows: null,
  });
  db.onversionchange = () => db.close();
  const upgrade = factory.open("revealline.fpv.world-records.v1", 2);
  const newer = await new Promise((resolve) => {
    upgrade.onsuccess = () => resolve(upgrade.result);
  });
  assert.throws(() => db.transaction("records", "readonly"), {
    name: "InvalidStateError",
  });
  assert.equal(last(tool).precedingVersionChangeEvents, 1);
  assert.equal(last(tool).precedingExplicitCloseCalls, 1);
  assert.equal(last(tool).precedingAbnormalCloseEvents, 0);
  assert.equal(tool.snapshot().coverage.rootCause, "not-established");
  tool.stop();
  newer.close();
});

test("foreign receivers, thrown identity and option coercions retain caller contracts", async () => {
  const factory = new IDBFactory(),
    nativeOpen = factory.open;
  const thrown = new TypeError("private sentinel");
  let calls = 0,
    coercions = 0;
  factory.open = function (...args) {
    const request = Reflect.apply(nativeOpen, this, args);
    request.addEventListener("success", () => {
      const db = request.result,
        native = db.transaction;
      db.transaction = function (...txArgs) {
        calls++;
        if (this !== db || txArgs[0] === "sentinel") throw thrown;
        if (typeof txArgs[0] === "object") txArgs[0] = String(txArgs[0]);
        return Reflect.apply(native, this, txArgs);
      };
    });
    return request;
  };
  const tool = observer({ indexedDB: factory }),
    db = await opened(tool.indexedDB);
  assert.throws(
    () => db.transaction.call({}, "projects"),
    (error) => error === thrown,
  );
  assert.equal(
    tool.snapshot().transactions.counts.failedStarts,
    0,
    "Borrowed receiver is outside capture",
  );
  assert.throws(
    () => db.transaction("sentinel"),
    (error) => error === thrown,
  );
  assert.equal(tool.snapshot().transactions.counts.failedStarts, 1);
  const tx = db.transaction("projects", "readonly"),
    store = tx.objectStore("projects"),
    nativeGetAll = store.getAll;
  const request = store.getAll();
  assert.equal(request.transaction, tx);
  assert.equal(store.getAll, nativeGetAll);
  await done(tx);
  assert.equal(calls, 3);
  const coerced = db.transaction(
    {
      toString() {
        coercions++;
        return "projects";
      },
    },
    "readonly",
  );
  await done(coerced);
  assert.equal(
    coercions,
    1,
    "Observer must not repeat WebIDL-like argument coercion",
  );
  tool.stop();
  db.close();
});

test("a partially visited cursor stays unknown; a mid-read caller abort stays failed", async () => {
  const tool = observer(),
    db = await opened(tool.indexedDB);
  const seed = db.transaction("revisions", "readwrite");
  for (let i = 0; i < 3; i++)
    seed
      .objectStore("revisions")
      .put({ id: "synthetic", sha256: String(i), private: "not-exported" });
  await done(seed);
  const partial = listing(db);
  let deliveries = 0;
  partial.cursor.onsuccess = () => {
    deliveries++;
  }; // Caller deliberately does not continue.
  await partial.done;
  assert.equal(deliveries, 1, "Observer must never advance a caller cursor");
  assert.equal(last(tool).listing.outcome, "unknown");
  const aborted = listing(db);
  aborted.cursor.onsuccess = () => aborted.tx.abort();
  await aborted.done;
  assert.equal(last(tool).listing.outcome, "failed");
  assert(!JSON.stringify(tool.snapshot()).includes("not-exported"));
  tool.stop();
  db.close();
});

test("active capture cap and refused interception remain explicit and do not block application transactions", async () => {
  const tool = observer(),
    db = await opened(tool.indexedDB);
  const pending = Array.from({ length: TRANSACTION_LIMITS.active + 2 }, () =>
    listing(db),
  );
  assert.equal(
    tool.snapshot().transactions.activeTransactions,
    TRANSACTION_LIMITS.active,
  );
  assert.equal(tool.snapshot().transactions.counts.droppedActive, 2);
  await Promise.all(pending.map((row) => row.done));
  assert.equal(tool.snapshot().transactions.activeTransactions, 0);
  tool.stop();
  db.close();
  const factory = new IDBFactory(),
    open = factory.open;
  factory.open = function (...args) {
    const request = Reflect.apply(open, this, args);
    request.addEventListener("success", () =>
      Object.defineProperty(request.result, "transaction", {
        value: IDBDatabase.prototype.transaction,
        configurable: false,
      }),
    );
    return request;
  };
  const refused = observer({ indexedDB: factory }),
    native = await opened(refused.indexedDB);
  assert.equal(
    refused.snapshot().connections[0].transactionInterception,
    "refused",
  );
  assert.equal(refused.snapshot().transactions.counts.refused, 1);
  await listing(native).done;
  assert.equal(refused.snapshot().transactions.history.length, 0);
  refused.stop();
  native.close();
});

test("unknown databases remain outside transaction capture; restoration keeps a later owner", async () => {
  const tool = observer(),
    unknown = await opened(tool.indexedDB, "private-database"),
    db = await opened(tool.indexedDB);
  assert.equal(unknown.transaction, IDBDatabase.prototype.transaction);
  const replacement = function (...args) {
    return Reflect.apply(IDBDatabase.prototype.transaction, this, args);
  };
  db.transaction = replacement;
  tool.stop();
  assert.equal(db.transaction, replacement);
  assert.equal(tool.snapshot().transactions.counts.restorationSkipped, 1);
  const count = tool.snapshot().transactions.counts.starts;
  const tx = db.transaction("projects", "readonly");
  await done(tx);
  assert.equal(tool.snapshot().transactions.counts.starts, count);
  unknown.close();
  db.close();
});

test("bounded history and read cap disclose incomplete coverage instead of empty", async () => {
  const tool = observer(),
    db = await opened(tool.indexedDB);
  const tx = db.transaction(["projects", "revisions"], "readonly"),
    store = tx.objectStore("projects");
  for (let i = 0; i <= TRANSACTION_LIMITS.reads; i++) store.getAll();
  await done(tx);
  assert.equal(last(tool).incomplete, true);
  assert.equal(last(tool).listing.outcome, "unknown");
  for (let i = 0; i < TRANSACTION_LIMITS.history + 3; i++)
    await listing(db).done;
  const report = tool.snapshot().transactions;
  assert.equal(report.history.length, TRANSACTION_LIMITS.history);
  assert.equal(report.counts.droppedHistory, 4);
  assert.equal(report.activeTransactions, 0);
  tool.stop();
  assert.equal(tool.snapshot().transactions.ownedRetireActions, 0);
  assert.equal(Object.hasOwn(db, "transaction"), false);
  db.close();
  await tick();
});
