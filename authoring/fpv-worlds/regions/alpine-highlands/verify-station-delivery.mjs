/** Exact material-revision download and production-session check; no player admission. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { prepareRegionalDownload } from "../../../../optional-practice/civilian-fpv/regional-delivery.mjs";
import { createRegionalSession } from "../../../../optional-practice/civilian-fpv/regional-session.mjs";

const root = resolve(process.argv[2] ?? "");
assert(
  process.argv[2],
  "Provide the immutable Alpine Highlands delivery directory",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bytes = await readFile(resolve(root, "delivery.json"));
const descriptor = JSON.parse(bytes);
assert.equal(bytes.length, 115316);
assert.equal(
  hash(bytes),
  "c60fd92ed1dc00136fb8df55bf02bcc211b932c4bbe018917a1f37b549ac3c8d",
);
assert.equal(descriptor.format, "FPVRegionalDelivery.v2");
assert.equal(descriptor.id, "alpine-highlands-study");
assert.equal(descriptor.revision, "station-r3");
assert.equal(descriptor.totalBytes, 22578814);
assert.equal(descriptor.files.length, 722);
assert.equal(
  descriptor.terrain.sha256,
  "e38bede909419c5502d6e68939a8ca7b3e197f03b9d5e5a4db8c4c5a08fcf90c",
);
assert.equal(
  descriptor.scenery.sha256,
  "b3630a0f78ebaf7ef47e63f709d46abbfafd72ef817807bb1acf35aa659bbee8",
);
assert(bytes.length + descriptor.totalBytes < 64 * 1024 * 1024);
const pin = {
  url: "https://alpine-delivery.invalid/delivery.json",
  bytes: bytes.length,
  sha256: hash(bytes),
};
const cache = new Map(),
  requests = [];
const fetchImpl = async (url, { signal, credentials, redirect } = {}) => {
  signal?.throwIfAborted();
  assert.equal(credentials, "omit");
  assert.equal(redirect, "error");
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://alpine-delivery.invalid");
  const file = resolve(root, "." + parsed.pathname);
  assert(file.startsWith(root + sep));
  requests.push(parsed.pathname);
  if (!cache.has(file)) cache.set(file, await readFile(file));
  signal?.throwIfAborted();
  return new Response(cache.get(file));
};
const progress = [];
const checked = await prepareRegionalDownload(pin, {
  pageURL: "https://alpine-delivery.invalid/sim",
  fetchImpl,
  onProgress: (value) => progress.push(value),
});
assert.equal(requests.length, 723);
assert.equal(new Set(requests).size, 723);
assert.equal(progress.at(-1).phase, "verify");
assert.equal(progress.at(-1).loadedBytes, descriptor.totalBytes);
assert(
  progress.every(
    (value, i) => !i || value.loadedBytes >= progress[i - 1].loadedBytes,
  ),
);
const verified = new Map();
for (const file of descriptor.files) {
  const body = new Uint8Array(
    await checked.assets.get(file.path).arrayBuffer(),
  );
  assert.equal(body.length, file.bytes);
  assert.equal(hash(body), file.sha256);
  verified.set("/" + file.path, body);
}
const decode = (path) =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(verified.get(path)),
  );
const terrain = decode("/terrain/region.json");
const scenery = decode("/scenery/region.json");
assert.equal(terrain.revision, "relief-r3-station-materials");
assert.equal(scenery.revision, terrain.revision);
assert.equal(terrain.grid.cellSizeMm, 256000);
assert.equal(terrain.grid.width * terrain.grid.cellSizeMm, 4096000);
assert.equal(terrain.grid.depth * terrain.grid.cellSizeMm, 4096000);
assert.equal(
  scenery.chunks.filter((cell) => cell.assets.length === 0).length,
  152,
);
assert.equal(terrain.spawns.length, 6);
const cachedFetch = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://alpine-cache.invalid");
  assert(
    verified.has(parsed.pathname),
    "No network fallback for undeclared source",
  );
  return new Response(verified.get(parsed.pathname));
};
const configuration = {
  manifest: terrain,
  source: {
    baseURL: "https://alpine-cache.invalid/terrain/",
    fetchImpl: cachedFetch,
  },
  scenery: {
    manifest: scenery,
    source: {
      baseURL: "https://alpine-cache.invalid/scenery/",
      fetchImpl: cachedFetch,
    },
  },
  geometryProfile: "terrain-scenery-v1",
};
const records = [];
for (const quality of ["performance", "balanced", "quality"])
  for (const mode of ["self-level", "acro"])
    for (const spawn of terrain.spawns) {
      const session = createRegionalSession({
        ...configuration,
        source: { ...configuration.source, surfaceQuality: quality },
        scenery: {
          ...configuration.scenery,
          source: {
            ...configuration.scenery.source,
            surfaceStyle: "alpine-overlays",
            surfaceQuality: quality,
          },
        },
        mode,
        spawnId: spawn.id,
      });
      try {
        assert.equal(session.arm(), false);
        await session.prepare();
        const prepared = session.snapshot();
        assert.equal(prepared.status, "paused");
        assert.equal(prepared.ticks, 0);
        assert.deepEqual(prepared.position, spawn.position);
        assert(session.arm());
        let state = prepared;
        for (let tick = 0; tick < 100; tick++) {
          state = session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.52 });
          assert.equal(
            state.status,
            "active",
            `${mode}/${spawn.id}: ${state.reason}`,
          );
          assert.equal(state.contacts, 0);
          await new Promise((done) => setImmediate(done));
        }
        session.pause();
        const held = session.snapshot();
        assert.deepEqual(
          session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }),
          held,
        );
        records.push({
          quality,
          mode,
          spawnId: spawn.id,
          ticks: state.ticks,
          contacts: state.contacts,
          geometryBytes: state.terrain.geometryBytes,
          textureBytes: state.terrain.textureBytes,
        });
        await session.dispose();
        assert.equal(session.root.children.length, 0);
        for (const field of [
          "geometryBytes",
          "textureBytes",
          "sourceBytes",
          "reservedSourceBytes",
          "reservedGeometryBytes",
        ])
          assert.equal(session.snapshot().terrain[field], 0, field);
      } finally {
        await session.dispose();
      }
    }
console.log(
  JSON.stringify(
    {
      passed: true,
      sourceRecipe: "939df428257597e6af41fa62c24af5987ffb991c",
      pin,
      payloadFiles: descriptor.files.length,
      payloadBytes: descriptor.totalBytes,
      totalWithDescriptorBytes: descriptor.totalBytes + bytes.length,
      verifiedResponses: requests.length,
      productionSessionCases: records,
      disposalZero: true,
      playerAdmission: false,
      limitations: [
        "Filesystem-backed HTTP response fixture, not internet throughput",
        "No native rendering, IndexedDB installation, Library selection or public admission",
        "Short actual shared-flight commands, not whole-region endurance",
      ],
    },
    null,
    2,
  ),
);
