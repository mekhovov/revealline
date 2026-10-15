import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  REVIEW_DATABASES,
  fingerprintValue,
  observeStorageContinuity,
  compareContinuitySnapshots,
} from "./observe.mjs";
const { IDBFactory } = createRequire(
  new URL("../package.json", import.meta.url),
)("fake-indexeddb");
const origin = "https://isolated-review.invalid",
  checks = [];
const indexedDB = new IDBFactory();
const observe = () => observeStorageContinuity({ indexedDB, origin });
const opening = (name, version, upgrade) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const write = (db, stores, apply) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error);
    apply(tx);
  });
const empty = await observe();
assert(empty.databases.every((db) => db.missing));
assert.deepEqual(await indexedDB.databases(), []);
const emptyCompare = await compareContinuitySnapshots(empty, await observe());
assert.equal(emptyCompare.exactMatch, true);
assert.equal(emptyCompare.anyExistingDatabase, false);
checks.push(
  "Missing databases remain missing; empty equality cannot claim installed content or qualification.",
);

const db = await opening(REVIEW_DATABASES[0], 2, (database) => {
  database.createObjectStore("projects");
  database.createObjectStore("revisions");
  database.createObjectStore("meta");
});
const assets = new Map([
  [
    "terrain.glb",
    new Blob([new Uint8Array([1, 2, 3])], { type: "model/gltf-binary" }),
  ],
]);
await write(db, ["projects", "revisions", "meta"], (tx) => {
  tx.objectStore("projects").put(
    { id: "review-region", sha256: "a".repeat(64) },
    "review-region",
  );
  tx.objectStore("revisions").put({ assets, revision: "r1" }, [
    "review-region",
    "a".repeat(64),
  ]);
  tx.objectStore("revisions").put({ assets, revision: "r2" }, [
    "review-region",
    "b".repeat(64),
  ]);
  tx.objectStore("meta").put(2, "generation");
});
const placeDB = await opening(REVIEW_DATABASES[1], 1, (database) =>
  database.createObjectStore("state"),
);
await write(placeDB, "state", (tx) =>
  tx
    .objectStore("state")
    .put({ locations: [{ heading: 4500, label: "Review place" }] }, "places"),
);
const before = await observe();
assert.equal(
  (await compareContinuitySnapshots(before, await observe())).exactMatch,
  true,
);
assert.equal(before.qualification.browserRestart, "not-measured");
assert.equal(before.qualification.networkWideOffline, "not-measured");
assert(!JSON.stringify(before).includes("Review place"));
assert(!JSON.stringify(before).includes("terrain.glb"));
checks.push(
  "Two exact revisions, Blob bytes and saved places compare without writes or raw content export.",
);

await write(db, "revisions", (tx) =>
  tx.objectStore("revisions").put(
    {
      assets: new Map([
        [
          "terrain.glb",
          new Blob([new Uint8Array([1, 2, 4])], { type: "model/gltf-binary" }),
        ],
      ]),
      revision: "r1",
    },
    ["review-region", "a".repeat(64)],
  ),
);
const changed = await compareContinuitySnapshots(before, await observe());
assert.equal(changed.exactMatch, false);
assert.equal(changed.differences.length, 1);
assert.equal(changed.differences[0].store, "revisions");
assert.equal(changed.differences[0].changed.length, 1);
assert.equal(changed.differences[0].missing.length, 0);
checks.push(
  "Same-size stored Blob corruption changes the exact revision fingerprint.",
);

await write(db, "revisions", (tx) =>
  tx.objectStore("revisions").delete(["review-region", "b".repeat(64)]),
);
await write(placeDB, "state", (tx) =>
  tx.objectStore("state").put({ locations: [] }, "places"),
);
const removed = await compareContinuitySnapshots(before, await observe());
assert.equal(removed.differences[0].missing.length, 1);
assert.equal(removed.differences[1].store, "state");
assert.equal(removed.differences[1].changed.length, 1);
assert.equal(
  removed.differences.some((row) => row.store === "meta"),
  false,
);
checks.push(
  "Removed retained revisions and changed saved places are distinct from unchanged generation metadata.",
);

const otherOrigin = await observeStorageContinuity({
  indexedDB,
  origin: "https://other-review.invalid",
});
await assert.rejects(
  compareContinuitySnapshots(before, otherOrigin),
  /different origins/,
);
const altered = structuredClone(before);
altered.databases[0].stores[0].rows[0].sha256 = "f".repeat(64);
await assert.rejects(
  compareContinuitySnapshots(altered, before),
  /Invalid or altered/,
);
const noEnumerator = {
  open() {
    throw new Error("Must not open without enumeration");
  },
};
await assert.rejects(
  observeStorageContinuity({ indexedDB: noEnumerator, origin }),
  /enumeration is required/,
);
checks.push(
  "Foreign origins, altered receipts and unsupported database enumeration fail closed.",
);

const race = new IDBFactory();
await assert.rejects(
  observeStorageContinuity({
    origin,
    indexedDB: {
      databases: async () => [{ name: REVIEW_DATABASES[0], version: 2 }],
      open: race.open.bind(race),
    },
  }),
  /No upgrade was allowed/,
);
assert.deepEqual(await race.databases(), []);
checks.push(
  "An enumeration/open race aborts creation rather than writing a replacement empty database.",
);

assert.notDeepEqual(
  await fingerprintValue([undefined]),
  await fingerprintValue(new Array(1)),
);
assert.notDeepEqual(await fingerprintValue(-0), await fingerprintValue(0));
assert.notDeepEqual(
  await fingerprintValue(new Uint8Array([1, 2])),
  await fingerprintValue(new Uint16Array([513])),
);
assert.deepEqual(
  await fingerprintValue(
    new Map([
      ["b", 2],
      ["a", 1],
    ]),
  ),
  await fingerprintValue(
    new Map([
      ["a", 1],
      ["b", 2],
    ]),
  ),
);
assert.notDeepEqual(
  await fingerprintValue(new File(["same"], "first.glb", { lastModified: 1 })),
  await fingerprintValue(new File(["same"], "second.glb", { lastModified: 1 })),
);
const alteredOrigin = structuredClone(before);
alteredOrigin.origin = "https://different-review.invalid";
await assert.rejects(
  compareContinuitySnapshots(alteredOrigin, before),
  /Invalid or altered/,
);
const cycle = {};
cycle.self = cycle;
await assert.rejects(fingerprintValue(cycle), /Cyclic/);
checks.push(
  "Structured-clone fingerprints preserve array holes, number and byte-view types, while stable Map order compares equally.",
);
db.close();
placeDB.close();
console.log(
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Modelled IndexedDB verification only; no native offline, browser restart or flight result.",
    },
    null,
    2,
  ),
);
