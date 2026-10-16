/** Actual immutable HTTPS download and production session checks; no browser claim. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareRegionalDownload } from "../../../../optional-practice/civilian-fpv/regional-delivery.mjs";
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  regionalPresentationOptions,
} from "../../../../optional-practice/civilian-fpv/regional-library.mjs";
import {
  createRegionalSession,
  regionalLibraryEntry,
  regionalStartingPoint,
  regionalLocationIdentity,
} from "../../../../optional-practice/civilian-fpv/regional-session.mjs";

const sha256 =
  "4800da2f8a06134333fad8def9615a96c94b2fb76f7fb3ef41bfa69b4a9872b5";
const row = REGIONAL_LIBRARY_PINS.find(
  (entry) => entry.id === "coaster-gardens-study",
);
assert(row);
assert.equal(row.pin.sha256, sha256);
assert.equal(row.pin.bytes, 29654);
assert.equal(row.bytes, 33908597);
assert.match(row.pin.url, /\/3b6edef381a917e7ce0b6a37054fcfc3ee7188cd\//);
assert.match(row.title.en, /study/i);
assert(row.title.uk && row.description.uk);
const requests = [],
  progress = [],
  started = performance.now();
const checked = await prepareRegionalDownload(row.pin, {
  pageURL: "https://coaster-library.invalid/sim",
  signal: AbortSignal.timeout(180000),
  fetchImpl: async (url, options) => {
    requests.push(String(url));
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return fetch(url, options);
  },
  onProgress: (value) => progress.push(value),
});
const downloadMs = performance.now() - started;
assert.equal(requests.length, 183);
assert.equal(new Set(requests).size, 183);
assert.equal(checked.descriptor.id, row.id);
assert.equal(checked.descriptor.revision, "review-r1");
assert.equal(checked.descriptor.format, "FPVRegionalDelivery.v2");
assert.equal(checked.descriptor.totalBytes + row.pin.bytes, row.bytes);
assert.equal(progress.at(-1).loadedBytes, 33878943);
assert(
  progress.every(
    (value, i) => !i || value.loadedBytes >= progress[i - 1].loadedBytes,
  ),
);
const files = new Map();
for (const ref of checked.descriptor.files) {
  const bytes = new Uint8Array(
    await checked.assets.get(ref.path).arrayBuffer(),
  );
  assert.equal(bytes.length, ref.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), ref.sha256);
  files.set("/" + ref.path, bytes);
}
const decode = (name) =>
  JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(files.get(name)));
const manifest = decode("/terrain/region.json"),
  scenery = decode("/scenery/region.json");
assert.equal(manifest.grid.width * manifest.grid.cellSizeMm, 2048000);
assert.equal(manifest.grid.depth * manifest.grid.cellSizeMm, 2048000);
assert.equal(manifest.spawns.length, 6);
assert.equal(scenery.chunks.filter((cell) => !cell.assets.length).length, 38);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://coaster-cache.invalid");
  assert(
    files.has(parsed.pathname),
    "No unverified request or network fallback",
  );
  return new Response(files.get(parsed.pathname));
};
const configuration = {
  manifest,
  source: { baseURL: "https://coaster-cache.invalid/terrain/", fetchImpl },
  scenery: {
    manifest: scenery,
    source: { baseURL: "https://coaster-cache.invalid/scenery/", fetchImpl },
  },
  geometryProfile: "terrain-scenery-v1",
};
const identity = { id: row.id, sha256 },
  geometry = new Map(),
  cases = [];
const entry = regionalLibraryEntry(configuration, identity);
assert.equal(entry.regionalReview, false);
assert.equal(entry.freeFlight, true);
assert.deepEqual(entry.course.steps, { acro: [], "self-level": [] });
assert.equal(regionalLocationIdentity(entry).sha256, sha256);
assert.throws(
  () => regionalStartingPoint(entry, "unknown-start"),
  /Unknown regional starting point/,
);
for (const quality of ["low", "balanced", "high"]) {
  const styled = regionalPresentationOptions(
    applyRegionalAppearance(configuration, identity),
    quality,
  );
  assert.equal(styled.source.surfaceStyle, "plain");
  for (const mode of ["self-level", "acro"])
    for (const spawn of manifest.spawns) {
      const session = createRegionalSession({
        ...styled,
        mode,
        spawnId: spawn.id,
      });
      try {
        assert.equal(session.arm(), false);
        await session.prepare();
        const state = session.snapshot();
        assert.equal(state.status, "paused");
        assert.deepEqual(state.position, spawn.position);
        assert.equal(state.ticks, 0);
        const hash = createHash("sha256");
        session.root.traverse((object) => {
          if (!object.isMesh) return;
          for (const attribute of [
            object.geometry.attributes.position,
            object.geometry.attributes.normal,
            object.geometry.index,
          ])
            if (attribute)
              hash.update(
                new Uint8Array(
                  attribute.array.buffer,
                  attribute.array.byteOffset,
                  attribute.array.byteLength,
                ),
              );
        });
        const digest = hash.digest("hex");
        if (!geometry.has(spawn.id)) geometry.set(spawn.id, digest);
        assert.equal(
          digest,
          geometry.get(spawn.id),
          "Tiers/modes preserve canonical geometry",
        );
        assert(session.arm());
        let moving;
        for (let tick = 0; tick < 100; tick++) {
          moving = session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.52 });
          assert.equal(moving.status, "active", moving.reason);
          assert.equal(moving.contacts, 0);
          await new Promise((done) => setImmediate(done));
        }
        session.pause();
        const held = session.snapshot();
        assert.deepEqual(
          session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }),
          held,
        );
        cases.push({
          quality,
          mode,
          spawnId: spawn.id,
          ticks: moving.ticks,
          geometrySHA256: digest,
        });
      } finally {
        await session.dispose();
        assert.equal(session.root.children.length, 0);
        for (const key of [
          "geometryBytes",
          "textureBytes",
          "reservedGeometryBytes",
          "reservedSourceBytes",
        ])
          assert.equal(session.snapshot().terrain[key], 0);
      }
    }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      pin: row.pin,
      bytes: row.bytes,
      actualHTTPSResponses: requests.length,
      downloadMs,
      cases,
      disposalZero: true,
      limitsChanged: false,
      limitations: [
        "No native renderer, device, IndexedDB installation or offline admission claim",
        "Three material tiers preserve geometry; no GPU performance claim",
        "Source study remains draft until native art review",
      ],
    },
    null,
    2,
  ),
);
