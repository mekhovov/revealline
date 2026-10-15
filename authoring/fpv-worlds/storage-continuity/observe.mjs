/** Authoring-only observation. Never creates, upgrades or writes a player database. */
export const STORAGE_CONTINUITY_FORMAT = "FPVStorageContinuity.v1";
export const REVIEW_DATABASES = Object.freeze([
  "revealline-fpv-regions-v1",
  "revealline-fpv-regional-locations-v1",
  "revealline-fpv-worlds-v1",
  "revealline.fpv.world-records.v1",
]);
const encoder = new TextEncoder();
const hash = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
const digest = async (value) => hash(encoder.encode(JSON.stringify(value)));
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Preserve structured-clone types; Blob contents, not just sizes, are fingerprinted. */
export async function fingerprintValue(value, ancestors = new Set()) {
  if (value === null) return ["null"];
  const type = typeof value;
  if (type === "undefined" || type === "boolean" || type === "string")
    return [type, value];
  if (type === "number")
    return [
      type,
      Number.isNaN(value) ? "NaN" : Object.is(value, -0) ? "-0" : String(value),
    ];
  if (type === "bigint") return [type, String(value)];
  if (type !== "object") throw new Error(`Unsupported stored value: ${type}`);
  if (ancestors.has(value))
    throw new Error("Cyclic stored value cannot be compared by this observer.");
  const nested = new Set(ancestors).add(value);
  if (value instanceof Blob)
    return [
      "Blob",
      value.type,
      value.size,
      await hash(await value.arrayBuffer()),
    ];
  if (value instanceof Date) return ["Date", value.toISOString()];
  if (value instanceof ArrayBuffer)
    return ["ArrayBuffer", value.byteLength, await hash(value)];
  if (ArrayBuffer.isView(value))
    return [
      value.constructor.name,
      value.byteLength,
      await hash(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      ),
    ];
  if (Array.isArray(value)) {
    const entries = [];
    for (let index = 0; index < value.length; index++)
      entries.push(
        Object.hasOwn(value, index)
          ? await fingerprintValue(value[index], nested)
          : ["array-hole"],
      );
    return ["Array", entries];
  }
  if (value instanceof Map) {
    const entries = [];
    for (const [key, child] of value)
      entries.push([
        await fingerprintValue(key, nested),
        await fingerprintValue(child, nested),
      ]);
    entries.sort((a, b) => compare(JSON.stringify(a[0]), JSON.stringify(b[0])));
    return ["Map", entries];
  }
  if (value instanceof Set) {
    const entries = [];
    for (const child of value)
      entries.push(await fingerprintValue(child, nested));
    entries.sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
    return ["Set", entries];
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new Error(
      `Unsupported stored object: ${value.constructor?.name ?? "unknown"}`,
    );
  const entries = [];
  for (const key of Object.keys(value).sort())
    entries.push([key, await fingerprintValue(value[key], nested)]);
  return ["Object", entries];
}

async function openExisting(indexedDB, info) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(info.name, info.version);
    let rejected = false;
    const fail = (error) => {
      rejected = true;
      reject(error);
    };
    request.onupgradeneeded = () => {
      request.transaction.abort();
      fail(
        new Error(
          `Database disappeared or changed: ${info.name}. No upgrade was allowed.`,
        ),
      );
    };
    request.onerror = () =>
      fail(request.error ?? new Error("Storage observation failed."));
    request.onblocked = () =>
      fail(
        new Error(`Close other storage editors before observing ${info.name}.`),
      );
    request.onsuccess = () => {
      if (rejected) request.result.close();
      else resolve(request.result);
    };
  });
}

async function readDatabase(indexedDB, info) {
  const db = await openExisting(indexedDB, info);
  db.onversionchange = () => db.close();
  try {
    const stores = [...db.objectStoreNames].sort();
    if (!stores.length)
      return { name: info.name, version: db.version, stores: [] };
    // All rows are captured in one native readonly transaction per database.
    // Hashing follows transaction completion, so asynchronous hashing cannot expire it.
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, "readonly"),
        result = [];
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error ?? new Error("Read-only snapshot aborted."));
      for (const name of stores) {
        const entries = [],
          request = tx.objectStore(name).openCursor();
        result.push({ name, entries });
        request.onsuccess = () => {
          if (!request.result) return;
          entries.push({
            key: request.result.key,
            value: request.result.value,
          });
          request.result.continue();
        };
      }
    });
    const result = [];
    for (const { name, entries } of rows) {
      const fingerprints = [];
      for (const { key, value } of entries)
        fingerprints.push({
          key: await digest(await fingerprintValue(key)),
          sha256: await digest(await fingerprintValue(value)),
        });
      fingerprints.sort((a, b) => compare(a.key, b.key));
      result.push({
        name,
        count: fingerprints.length,
        rows: fingerprints,
        sha256: await digest(fingerprints),
      });
    }
    return { name: info.name, version: db.version, stores: result };
  } finally {
    db.close();
  }
}

export async function observeStorageContinuity({
  indexedDB = globalThis.indexedDB,
  origin = globalThis.location?.origin,
  now = () => new Date().toISOString(),
} = {}) {
  if (!indexedDB?.databases)
    throw new Error(
      "Database enumeration is required; no fallback opens or creates databases.",
    );
  if (typeof origin !== "string" || !/^https?:\/\//.test(origin))
    throw new Error("An explicit HTTP(S) review origin is required.");
  const startedAt = now(),
    inventory = await indexedDB.databases(),
    databases = [];
  for (const name of REVIEW_DATABASES) {
    const info = inventory.find((entry) => entry.name === name);
    if (!info) databases.push({ name, missing: true });
    else databases.push(await readDatabase(indexedDB, info));
  }
  return {
    format: STORAGE_CONTINUITY_FORMAT,
    origin,
    startedAt,
    completedAt: now(),
    scope:
      "Read-only fingerprints of four existing FPV stores; no raw saved content exported.",
    atomicity:
      "One readonly snapshot per database, not a cross-database write lock. Pause flight and close other writers.",
    qualification: {
      networkWideOffline: "not-measured",
      browserRestart: "not-measured",
      flight: "not-measured",
    },
    databases,
    sha256: await digest(databases),
  };
}

export async function validateContinuitySnapshot(value) {
  const fail = () => {
    throw new Error("Invalid or altered continuity snapshot.");
  };
  if (
    value?.format !== STORAGE_CONTINUITY_FORMAT ||
    typeof value.origin !== "string" ||
    !Array.isArray(value.databases) ||
    value.databases.length !== REVIEW_DATABASES.length
  )
    fail();
  for (let index = 0; index < REVIEW_DATABASES.length; index++) {
    const db = value.databases[index];
    if (db.name !== REVIEW_DATABASES[index]) fail();
    if (db.missing === true) continue;
    if (
      !Number.isSafeInteger(db.version) ||
      db.version < 1 ||
      !Array.isArray(db.stores)
    )
      fail();
    const names = new Set();
    for (const store of db.stores) {
      if (
        typeof store.name !== "string" ||
        names.has(store.name) ||
        !Array.isArray(store.rows) ||
        store.count !== store.rows.length
      )
        fail();
      names.add(store.name);
      const keys = new Set();
      for (const row of store.rows) {
        if (
          !/^[a-f0-9]{64}$/.test(row.key) ||
          !/^[a-f0-9]{64}$/.test(row.sha256) ||
          keys.has(row.key)
        )
          fail();
        keys.add(row.key);
      }
      if (store.sha256 !== (await digest(store.rows))) fail();
    }
  }
  if (value.sha256 !== (await digest(value.databases))) fail();
  return value;
}

export async function compareContinuitySnapshots(before, after) {
  await validateContinuitySnapshot(before);
  await validateContinuitySnapshot(after);
  if (before.origin !== after.origin)
    throw new Error("Snapshots belong to different origins.");
  const differences = [];
  for (const previous of before.databases) {
    const current = after.databases.find((row) => row.name === previous.name);
    if (previous.missing === true && current.missing === true) continue;
    if (
      previous.missing === true ||
      current.missing === true ||
      previous.version !== current.version
    ) {
      differences.push({
        database: previous.name,
        kind: "database-presence-or-version",
      });
      continue;
    }
    const names = new Set(
      [...previous.stores, ...current.stores].map((store) => store.name),
    );
    for (const name of names) {
      const a = previous.stores.find((store) => store.name === name),
        b = current.stores.find((store) => store.name === name);
      if (!a || !b) {
        differences.push({
          database: previous.name,
          store: name,
          kind: "store-presence",
        });
        continue;
      }
      const old = new Map(a.rows.map((row) => [row.key, row.sha256])),
        next = new Map(b.rows.map((row) => [row.key, row.sha256]));
      const missing = [...old.keys()].filter((key) => !next.has(key)),
        changed = [...old.keys()].filter(
          (key) => next.has(key) && next.get(key) !== old.get(key),
        ),
        added = [...next.keys()].filter((key) => !old.has(key));
      if (missing.length || changed.length || added.length)
        differences.push({
          database: previous.name,
          store: name,
          missing,
          changed,
          added,
        });
    }
  }
  return {
    format: "FPVStorageContinuityComparison.v1",
    origin: before.origin,
    before: before.sha256,
    after: after.sha256,
    exactMatch: before.sha256 === after.sha256,
    anyExistingDatabase: before.databases.some((db) => !db.missing),
    differences,
    scope:
      "Stored-byte comparison only. Changes may be legitimate new flight/session data; inspect each difference. No offline, restart or flight acceptance is inferred.",
  };
}
