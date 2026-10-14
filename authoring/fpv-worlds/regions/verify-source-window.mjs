/** Real local HTTP preparation exercise. No scene decoding or simulated flight. */
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { REGION_FORMAT } from "./region-manifest.mjs";
import { createRegionSourceWindow } from "./source-window.mjs";

const files = new Map(),
  counts = new Map();
const manifest = {
  format: REGION_FORMAT,
  id: "http-fixture",
  revision: "r1",
  title: { en: "HTTP fixture", uk: "Макет HTTP" },
  grid: {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 7,
    depth: 1,
    floorMm: 0,
    ceilingMm: 10000,
  },
  assets: [],
  chunks: [],
  spawns: [{ id: "start", position: { x: 0, y: 1000, z: 0 } }],
};
const add = (id, kind, path, bytes) => {
  files.set(`/${path}`, bytes);
  manifest.assets.push({
    id,
    kind,
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
};
add("collision", "collision", "collision.json", Buffer.from("{}"));
for (let x = 0; x < 7; x++) {
  add(`scene-${x}`, "scene", `scene-${x}.glb`, Buffer.alloc(32, x + 1));
  manifest.chunks.push({
    id: `chunk-${x}`,
    x,
    z: 0,
    assets: [`scene-${x}`, "collision"],
  });
}
let responseMode = "normal",
  active = 0,
  peak = 0;
const server = createServer(async (request, response) => {
  active++;
  peak = Math.max(peak, active);
  counts.set(request.url, (counts.get(request.url) ?? 0) + 1);
  response.on("close", () => active--);
  const bytes = files.get(request.url),
    mode = responseMode;
  if (mode === "slow") await delay(80);
  if (response.destroyed) return;
  if (!bytes) {
    response.writeHead(404);
    response.end();
    return;
  }
  if (mode === "redirect") {
    response.writeHead(302, { location: "/collision.json" });
    response.end();
    return;
  }
  response.writeHead(200, { "content-type": "application/octet-stream" });
  if (mode === "stall") {
    response.write(bytes.subarray(0, 1));
    return;
  }
  if (mode === "corrupt") {
    response.end(Buffer.alloc(bytes.length, 90));
    return;
  }
  if (mode === "short") {
    response.end(bytes.subarray(1));
    return;
  }
  if (mode === "long") {
    response.end(Buffer.concat([bytes, Buffer.from("!")]));
    return;
  }
  response.write(bytes.subarray(0, 1));
  await delay(2);
  if (!response.destroyed) response.end(bytes.subarray(1));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseURL = `http://127.0.0.1:${server.address().port}/`;
const point = (x) => ({ x: x * 128000 + 1000, y: 1000, z: 1000 });
const make = (options = {}) =>
  createRegionSourceWindow(manifest, {
    baseURL,
    subtle: webcrypto.subtle,
    ...options,
  });
let checks = 0;
async function check(label, action) {
  await action();
  checks++;
  console.log(`PASS ${label}`);
}
try {
  await check(
    "local streamed SHA verification, shared dedup and bounded concurrency",
    async () => {
      counts.clear();
      peak = 0;
      const window = make({ concurrency: 2 });
      try {
        const ready = await window.transition(point(0));
        assert.equal(ready.sourceReady, true);
        assert.equal(ready.flightReady, false);
        assert.deepEqual(ready.chunks, ["chunk-0", "chunk-1", "chunk-2"]);
        assert.equal(counts.get("/collision.json"), 1);
        assert(peak <= 2);
        assert.equal(ready.sourceBytes, 98);
        assert.equal(ready.reservedSourceBytes, 98);
        const copy = window.copyAsset("scene-0");
        copy[0] = 99;
        assert.equal(window.copyAsset("scene-0")[0], 1);
        await window.transition(point(0));
        assert.equal(counts.get("/scene-0.glb"), 1);
      } finally {
        await window.dispose();
      }
      assert.equal(window.snapshot().sourceBytes, 0);
      assert.equal(window.snapshot().reservedSourceBytes, 0);
    },
  );
  for (const mode of ["corrupt", "short", "long", "redirect"]) {
    await check(
      `${mode} response preserves previous committed bytes and location`,
      async () => {
        responseMode = "normal";
        const window = make();
        try {
          await window.transition(point(0));
          const before = window.snapshot();
          responseMode = mode;
          await assert.rejects(window.transition(point(6)));
          assert.equal(window.snapshot().sourceReady, false);
          assert.equal(window.snapshot().flightReady, false);
          assert.deepEqual(window.snapshot().position, before.position);
          assert.deepEqual(window.snapshot().assetIds, before.assetIds);
          assert.equal(
            window.snapshot().reservedSourceBytes,
            before.sourceBytes,
          );
          assert.equal(window.copyAsset("scene-0")[0], 1);
        } finally {
          responseMode = "normal";
          await window.dispose();
        }
      },
    );
  }
  await check(
    "cancellation drains old fetch before a successor may commit",
    async () => {
      responseMode = "slow";
      const window = make();
      try {
        const first = window.transition(point(0));
        const rejected = assert.rejects(first, { name: "AbortError" });
        await delay(15);
        const second = window.transition(point(6));
        await rejected;
        assert.equal(window.snapshot().sourceReady, false);
        const ready = await second;
        assert.deepEqual(ready.position, point(6));
        assert(!ready.assetIds.includes("scene-0"));
        assert.equal(ready.flightReady, false);
      } finally {
        responseMode = "normal";
        await window.dispose();
      }
    },
  );
  await check(
    "explicit cancellation retains prior commit and never reports readiness",
    async () => {
      const window = make();
      try {
        await window.transition(point(0));
        responseMode = "slow";
        const loading = window.transition(point(6));
        const rejected = assert.rejects(loading, { name: "AbortError" });
        await delay(15);
        window.cancel();
        await rejected;
        assert.equal(window.snapshot().state, "cancelled");
        assert.equal(window.snapshot().sourceReady, false);
        assert.deepEqual(window.snapshot().position, point(0));
      } finally {
        responseMode = "normal";
        await window.dispose();
      }
    },
  );
  await check(
    "timeout stops stalled response and retains committed window",
    async () => {
      const window = make({ timeoutMs: 50 });
      try {
        await window.transition(point(0));
        responseMode = "stall";
        await assert.rejects(window.transition(point(6)), {
          name: "TimeoutError",
        });
        assert.equal(window.snapshot().sourceReady, false);
        assert.deepEqual(window.snapshot().position, point(0));
      } finally {
        responseMode = "normal";
        await window.dispose();
      }
    },
  );
  await check(
    "combined old plus new source budget blocks unsafe transactional loading",
    async () => {
      const window = make({ maxSourceBytes: 98 });
      try {
        await window.transition(point(0));
        const calls = [...counts.values()].reduce((a, b) => a + b, 0);
        await assert.rejects(
          window.transition(point(6)),
          /transition-source-budget/,
        );
        assert.equal(
          [...counts.values()].reduce((a, b) => a + b, 0),
          calls,
        );
        assert.equal(window.snapshot().sourceBytes, 98);
        assert.deepEqual(window.snapshot().position, point(0));
      } finally {
        await window.dispose();
      }
    },
  );
  await check(
    "successful movement releases old assets while preserving shared collision",
    async () => {
      const window = make();
      counts.clear();
      try {
        await window.transition(point(0));
        await window.transition(point(6));
        assert.throws(
          () => window.copyAsset("scene-0"),
          /not in the committed/,
        );
        assert.equal(counts.get("/collision.json"), 1);
        assert.equal(window.snapshot().sourceBytes, 98);
      } finally {
        await window.dispose();
      }
    },
  );
  await check(
    "dispose cancels work, releases bytes and permanently rejects new operations",
    async () => {
      responseMode = "slow";
      const window = make();
      const loading = window.transition(point(0));
      const rejected = assert.rejects(loading, { name: "AbortError" });
      await delay(15);
      await window.dispose();
      await rejected;
      await window.dispose();
      assert.equal(window.snapshot().state, "disposed");
      assert.equal(window.snapshot().sourceBytes, 0);
      assert.equal(window.snapshot().reservedSourceBytes, 0);
      await assert.rejects(window.transition(point(0)), /disposed/);
      assert.throws(() => window.copyAsset("scene-0"), /disposed/);
      responseMode = "normal";
    },
  );
  await check(
    "unsafe base URLs and invalid input are rejected before fetch",
    async () => {
      assert.throws(() => make({ baseURL: "http://example.com/" }), /HTTPS/);
      assert.throws(() => make({ baseURL: `${baseURL}?x=1` }), /directory URL/);
      const window = make();
      try {
        await assert.rejects(
          window.transition({ x: -1, y: 0, z: 0 }),
          /outside region/,
        );
        assert.equal(window.snapshot().state, "idle");
      } finally {
        await window.dispose();
      }
    },
  );
  console.log(
    JSON.stringify({
      checks,
      result: "pass",
      transport: "local HTTP and native fetch",
      collisionReady: false,
      playerIntegrated: false,
      fpsMeasured: false,
    }),
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
