import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIDBOwnershipObserver,
  OWNERSHIP_LIMITS,
  ownedCallers,
  windowWithObservedIDB,
} from "./observe.mjs";
import { prepareDiagnosticHost } from "./prepare.mjs";
const { IDBFactory, IDBDatabase, IDBVersionChangeEvent, forceCloseDatabase } =
  createRequire(new URL("../package.json", import.meta.url))("fake-indexeddb");
const known = "revealline-fpv-worlds-v1";
const tick = () => new Promise((resolve) => setImmediate(resolve));
function opened(factory, name = known, version = 1, upgrade) {
  const request = factory.open(name, version);
  request.onupgradeneeded = () => upgrade?.(request.result);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test("normal owner keeps request/database identity, one argument coercion and schema/data ownership", async () => {
  const factory = new IDBFactory(),
    nativeOpen = factory.open;
  let nativeCalls = 0,
    coercions = 0,
    nativeRequest;
  // Fake IDB does not implement WebIDL coercion; model it once at this delegated boundary.
  factory.open = function (...args) {
    nativeCalls++;
    nativeRequest = Reflect.apply(nativeOpen, this, [
      String(args[0]),
      ...args.slice(1),
    ]);
    return nativeRequest;
  };
  for (const method of ["databases", "deleteDatabase", "cmp"])
    factory[method] = () => {
      throw new Error("Observer must not probe any other factory method");
    };
  const observer = createIDBOwnershipObserver({ indexedDB: factory });
  observer.snapshot();
  assert.equal(
    nativeCalls,
    0,
    "Mounting and reading are not database discovery",
  );
  const request = observer.indexedDB.open(
    {
      toString() {
        coercions++;
        return known;
      },
    },
    1,
  );
  assert.equal(request, nativeRequest);
  request.onupgradeneeded = () =>
    request.result
      .createObjectStore("owner-only")
      .put("private player value", "private key");
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal(nativeCalls, 1);
  assert.equal(coercions, 1);
  assert.equal(db, nativeRequest.result);
  assert.equal(
    db.close,
    IDBDatabase.prototype.close,
    "Default observation cannot replace close",
  );
  const tx = db.transaction("owner-only", "readonly"),
    value = tx.objectStore("owner-only").get("private key");
  await new Promise((resolve) => {
    tx.oncomplete = resolve;
  });
  assert.equal(value.result, "private player value");
  assert(!JSON.stringify(observer.snapshot()).includes("private"));
  observer.stop();
  assert.equal(observer.snapshot().ownedRetireActions, 0);
  db.close();
});

test("passive versionchange/blocked/forced-close events do not replace application handlers or solve cause", async () => {
  const factory = new IDBFactory(),
    observer = createIDBOwnershipObserver({ indexedDB: factory });
  const db = await opened(observer.indexedDB);
  let versionHandler = 0,
    blockedHandler = 0;
  db.onversionchange = () => {
    versionHandler++;
  };
  const request = observer.indexedDB.open(known, 2);
  request.onblocked = () => {
    blockedHandler++;
    db.close();
  };
  const newer = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  forceCloseDatabase(newer); // Isolated fake-IDB platform simulation; never native evidence.
  await tick();
  const report = observer.snapshot();
  assert.equal(versionHandler, 1);
  assert.equal(blockedHandler, 1);
  assert(report.events.some((row) => row.kind === "open-blocked"));
  assert.equal(report.connections[0].versionChangeEvents, 1);
  assert.equal(
    report.connections[0].forcedCloseEvents,
    0,
    "Explicit close emits no forced-close event",
  );
  assert.equal(report.connections[0].explicitCloseCalls, null);
  assert.equal(report.connections[1].forcedCloseEvents, 1);
  assert.equal(report.coverage.rootCause, "not-established");
  observer.stop();
});

test("explicit opt-in preserves native close receiver/return/exception and restores its owned instance descriptor", async () => {
  const factory = new IDBFactory(),
    originalPrototypeClose = IDBDatabase.prototype.close,
    observer = createIDBOwnershipObserver({
      indexedDB: factory,
      captureExplicitClose: true,
      stack: () =>
        "Error: private\n at owner (https://alice:password@review.invalid/private/game/owner.mjs?token=private#secret:24:6)",
    });
  const db = await opened(observer.indexedDB);
  assert.notEqual(db.close, originalPrototypeClose);
  assert.equal(IDBDatabase.prototype.close, originalPrototypeClose);
  assert.throws(() => db.close.call({}), { name: "TypeError" });
  assert.equal(observer.snapshot().connections[0].explicitCloseCalls, 0);
  assert.equal(db.close("ignored by native close"), undefined);
  let report = observer.snapshot();
  assert.equal(report.connections[0].explicitCloseCalls, 1);
  assert.deepEqual(
    report.events.find((row) => row.kind === "explicit-close-call").caller,
    [{ path: "game/owner.mjs", line: 24, column: 6 }],
  );
  assert(!/alice|password|private|secret|token/.test(JSON.stringify(report)));
  observer.stop();
  assert.equal(Object.hasOwn(db, "close"), false);
  assert.equal(db.close, originalPrototypeClose);
  report = observer.snapshot();
  db.close();
  assert.deepEqual(
    observer.snapshot(),
    report,
    "Stopped capture cannot keep logging",
  );
});

test("connection and event overflow stay bounded and detached snapshots cannot edit retained facts", async () => {
  const factory = new IDBFactory(),
    observer = createIDBOwnershipObserver({ indexedDB: factory }),
    databases = [];
  for (let i = 0; i < OWNERSHIP_LIMITS.connections + 5; i++) {
    const db = await opened(observer.indexedDB);
    databases.push(db);
    for (let j = 0; j < 6; j++)
      db.dispatchEvent(
        new IDBVersionChangeEvent("versionchange", {
          oldVersion: 1,
          newVersion: 2,
        }),
      );
  }
  const report = observer.snapshot();
  assert.equal(report.connections.length, OWNERSHIP_LIMITS.connections);
  assert.equal(report.counts.droppedConnections, 5);
  assert.equal(report.events.length, OWNERSHIP_LIMITS.events);
  assert(report.counts.droppedEvents > 0);
  assert(
    report.events.some((row) => row.trusted === false),
    "Synthetic event evidence is marked",
  );
  report.connections[0].name = "forged name";
  assert.equal(observer.snapshot().connections[0].name, known);
  observer.stop();
  databases.forEach((db) => db.close());
});

test("pending cap and stop leave caller requests/upgrade intact and never close their resulting connections", async () => {
  const factory = new IDBFactory(),
    blocker = await opened(factory),
    observer = createIDBOwnershipObserver({
      indexedDB: factory,
      captureExplicitClose: true,
    });
  const requests = Array.from(
    { length: OWNERSHIP_LIMITS.pendingRequests + 6 },
    () => observer.indexedDB.open(known, 2),
  );
  assert.equal(
    observer.snapshot().pendingRequests,
    OWNERSHIP_LIMITS.pendingRequests,
  );
  assert.equal(observer.snapshot().counts.droppedRequests, 6);
  const completions = requests.map(
    (request) =>
      new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
  requests[0].onupgradeneeded = () =>
    requests[0].result.createObjectStore("caller-upgrade");
  observer.stop();
  blocker.close();
  const databases = await Promise.all(completions);
  assert.equal(
    observer.snapshot().connections.length,
    0,
    "Late completions cannot reattach observers",
  );
  assert.equal(observer.snapshot().pendingRequests, 0);
  assert.equal(observer.snapshot().ownedRetireActions, 0);
  assert(
    databases.every(
      (db) =>
        db.close === IDBDatabase.prototype.close &&
        db.objectStoreNames.contains("caller-upgrade"),
    ),
  );
  databases.forEach((db) => db.close());
});

test("names, errors, caller paths and interception failures cannot export raw player strings", async () => {
  const factory = new IDBFactory(),
    observer = createIDBOwnershipObserver({
      indexedDB: factory,
      stack: () =>
        "Error secret\n at unknown (file:///Users/private/secrets.mjs:12:3)\n at owner (https://user:password@host.invalid/prefix/optional-practice/civilian-fpv/world-store.mjs?secret=1:25:9)",
    });
  const db = await opened(observer.indexedDB, "private database secret", 3);
  await assert.rejects(
    opened(observer.indexedDB, "private database secret", 2),
    { name: "VersionError" },
  );
  const report = observer.snapshot();
  assert.equal(report.connections[0].name, "<other database>");
  assert.equal(
    report.events.find((row) => row.kind === "open-error").error,
    "VersionError",
  );
  assert(
    !/private|secret|user:|password|host.invalid|Users/.test(
      JSON.stringify(report),
    ),
  );
  assert.deepEqual(
    ownedCallers("malformed secret\n at https://host.invalid/other.mjs:1:1"),
    [],
  );
  observer.stop();
  db.close();
});

test("stop respects a later close owner, and explicit interception refusal does not break ordinary opens", async () => {
  const factory = new IDBFactory(),
    observer = createIDBOwnershipObserver({
      indexedDB: factory,
      captureExplicitClose: true,
    });
  const db = await opened(observer.indexedDB),
    nativeClose = IDBDatabase.prototype.close;
  const later = function () {
    return Reflect.apply(nativeClose, this, []);
  };
  db.close = later;
  observer.stop();
  assert.equal(db.close, later);
  assert.equal(observer.snapshot().counts.restorationSkipped, 1);
  db.close();
  const refusingFactory = new IDBFactory(),
    open = refusingFactory.open;
  refusingFactory.open = function (...args) {
    const request = Reflect.apply(open, this, args);
    request.addEventListener("success", () =>
      Object.defineProperty(request.result, "close", {
        value: nativeClose,
        configurable: false,
      }),
    );
    return request;
  };
  const refused = createIDBOwnershipObserver({
      indexedDB: refusingFactory,
      captureExplicitClose: true,
    }),
    other = await opened(refused.indexedDB);
  assert.equal(refused.snapshot().connections[0].closeInterception, "refused");
  assert.equal(refused.snapshot().connections[0].explicitCloseCalls, null);
  refused.stop();
  other.close();
});

test("factory/window facades preserve native receiver checks, constructors and ordinary non-open calls", async () => {
  const factory = new IDBFactory(),
    rawOpen = factory.open,
    receiverError = new TypeError("receiver sentinel");
  // Fake IDB defers its invalid-receiver failure; enforce the native synchronous contract here.
  factory.open = function (...args) {
    if (this !== factory) throw receiverError;
    return Reflect.apply(rawOpen, this, args);
  };
  const observer = createIDBOwnershipObserver({ indexedDB: factory });
  assert.equal(observer.indexedDB.cmp(1, 2), factory.cmp(1, 2));
  const open = observer.indexedDB.open;
  assert.throws(
    () => open(known, 1),
    (error) => error === receiverError,
  );
  assert.equal(observer.snapshot().counts.opens, 0);
  const actual = {
    indexedDB: factory,
    Event: class Event {},
    method() {
      assert.equal(this, actual);
      return 42;
    },
  };
  Object.defineProperty(actual, "value", {
    get() {
      assert.equal(this, actual);
      return 7;
    },
  });
  const win = windowWithObservedIDB(actual, observer.indexedDB);
  assert.equal(win.indexedDB, observer.indexedDB);
  assert.equal(win.method(), 42);
  assert.equal(win.value, 7);
  assert(new win.Event() instanceof actual.Event);
  observer.stop();
  const db = await opened(observer.indexedDB);
  assert.equal(observer.snapshot().connections.length, 0);
  db.close();
});

test("separate host preparation preserves original bytes and refuses overwrite, alternate entry and path escapes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "fpv-idb-owner-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const player = join(dir, "original.html"),
    output = join(dir, "diagnostic.html"),
    original =
      '<html data-fpv-worlds="true"><head></head><body><script src="../civilian-fpv/world-app.mjs" type="application/x-revealline-locked" data-access-type="module"></script></body></html>',
    base = "/frozen/site/optional-practice/fpv-worlds/";
  await writeFile(player, original);
  const result = await prepareDiagnosticHost({ player, output, base });
  const html = await readFile(output, "utf8"),
    identity = JSON.parse(await readFile(result.identity, "utf8"));
  assert.equal(await readFile(player, "utf8"), original);
  assert(html.includes(`<base href="${base}"`));
  assert(html.includes('src="/authoring/fpv-worlds/idb-ownership/host.mjs"'));
  assert(html.includes('data-access-type="module"'));
  assert.equal(Object.keys(identity.modules).length, 3);
  await assert.rejects(
    prepareDiagnosticHost({ player, output, base }),
    /not be overwritten/,
  );
  await assert.rejects(
    prepareDiagnosticHost({
      player,
      output: join(dir, "other.html"),
      base: "/../other/optional-practice/fpv-worlds/",
    }),
    /same-origin/,
  );
  await assert.rejects(
    prepareDiagnosticHost({
      player,
      output: join(dir, "remote.html"),
      base: "//remote.invalid/optional-practice/fpv-worlds/",
    }),
    /same-origin/,
  );
  await writeFile(join(dir, "wrong.html"), "<head></head>");
  await assert.rejects(
    prepareDiagnosticHost({
      player: join(dir, "wrong.html"),
      output: join(dir, "unused.html"),
      base,
    }),
    /untouched World/,
  );
});
