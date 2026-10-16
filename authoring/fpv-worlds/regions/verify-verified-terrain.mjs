/** Manual exact-source integration with local HTTP and the shipped Three/Rapier. */
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { createServer } from "node:http";
import { compileTerrainCell, TERRAIN_FORMAT } from "./terrain-cell.mjs";
import { createVerifiedTerrainWindow } from "./verified-terrain-window.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const point = (x) => ({ x: x * 128000 + 64000, y: 10000, z: 64000 });
const assetsFor = (modify) => {
  const assets = [],
    chunks = [],
    bodies = new Map();
  for (let x = 0; x < 6; x++) {
    const cell = {
      format: TERRAIN_FORMAT,
      chunkId: `tile-${x}`,
      x,
      z: 0,
      cellSizeMm: 128000,
      samples: 33,
      heightsMm: Array.from(
        { length: 1089 },
        (_, i) => x * 1000 + ((i % 33) * 4000) / 128,
      ),
    };
    // This profile rises 4m per cell, with integer 125mm increments per 4m.
    cell.heightsMm = Array.from(
      { length: 1089 },
      (_, i) => x * 4000 + (i % 33) * 125,
    );
    const files = {
      collision: encode(cell),
      scene: compileTerrainCell(cell).glb,
    };
    modify?.(x, cell, files);
    const ids = [];
    for (const kind of ["scene", "collision"]) {
      const id = `tile-${x}-${kind}`,
        path = `${id}.${kind === "scene" ? "glb" : "json"}`,
        bytes = files[kind];
      assets.push({ id, kind, path, bytes: bytes.length, sha256: hash(bytes) });
      bodies.set(`/region/${path}`, bytes);
      ids.push(id);
    }
    chunks.push({ id: cell.chunkId, x, z: 0, assets: ids });
  }
  return {
    bodies,
    manifest: {
      format: "FPVRegionManifest.v1",
      id: "verified-terrain",
      revision: "r1",
      title: { en: "Verified terrain", uk: "Перевірений рельєф" },
      grid: {
        cellSizeMm: 128000,
        minX: 0,
        minZ: 0,
        width: 6,
        depth: 1,
        floorMm: -10000,
        ceilingMm: 100000,
      },
      assets,
      chunks,
      spawns: [{ id: "start", position: point(0) }],
    },
  };
};
let checks = 0;
const check = async (label, run) => {
  await run();
  checks++;
  console.log(`PASS ${label}`);
};
async function withServer(fixture, run, intercept) {
  let requests = 0;
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    requests++;
    try {
      await intercept?.(request.url);
      const bytes = fixture.bodies.get(request.url);
      response.writeHead(bytes ? 200 : 404);
      response.end(bytes);
    } catch {
      response.destroy();
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}/region/`;
  try {
    await run({ baseURL, requests: () => requests });
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}
await check(
  "exact source bytes produce detached queried terrain and copied provenance",
  async () => {
    const fixture = assetsFor();
    await withServer(fixture, async ({ baseURL, requests }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, { baseURL });
      try {
        assert.equal(requests(), 0);
        assert.equal(window.support(point(0)).status, "not-ready");
        const ready = await window.transition(point(0));
        assert.equal(ready.terrainReady, true);
        assert.equal(ready.flightReady, false);
        assert.equal(ready.provenance.chunks.length, 2);
        assert.equal(window.group.parent, null);
        assert.equal(window.group.children.length, 2);
        assert.equal(window.support(point(0)).status, "terrain-hit");
        assert(Math.abs(window.support(point(0)).heightMm - 2000) < 0.1);
        const receipt = ready.provenance.chunks[0];
        assert.equal(
          receipt.scene.sha256,
          fixture.manifest.assets.find((a) => a.id === receipt.scene.id).sha256,
        );
        assert(receipt.scene.url.startsWith(baseURL));
        ready.provenance.chunks[0].scene.sha256 = "mutated";
        assert.notEqual(
          window.snapshot().provenance.chunks[0].scene.sha256,
          "mutated",
        );
        assert.equal(ready.reservedGeometryBytes, ready.geometryBytes);
        assert.equal(window.copyAsset, undefined);
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "malformed JSON, UTF-8, identities and canonical GLB mismatches fail closed",
  async () => {
    const mutations = [
      (x, cell, files) => {
        if (x === 0) files.collision = encode({ ...cell, extra: true });
      },
      (x, cell, files) => {
        if (x === 0) files.collision = new Uint8Array([0xff]);
      },
      (x, cell, files) => {
        if (x === 0) files.collision = encode({ ...cell, chunkId: "other" });
      },
      (x, cell, files) => {
        if (x === 0) {
          files.scene = files.scene.slice();
          files.scene[files.scene.length - 1] ^= 1;
        }
      },
    ];
    for (const modify of mutations) {
      const fixture = assetsFor(modify);
      await withServer(fixture, async ({ baseURL }) => {
        const window = createVerifiedTerrainWindow(fixture.manifest, {
          baseURL,
        });
        try {
          await assert.rejects(window.transition(point(0)));
          assert.equal(window.group, null);
          assert.equal(window.snapshot().terrainReady, false);
          assert.equal(window.snapshot().geometryBytes, 0);
        } finally {
          await window.dispose();
        }
      });
    }
  },
);
await check(
  "transport corruption cannot replace declared collision bytes",
  async () => {
    const fixture = assetsFor();
    const bytes = fixture.bodies.get("/region/tile-0-collision.json").slice();
    bytes[bytes.length - 2] ^= 1;
    fixture.bodies.set("/region/tile-0-collision.json", bytes);
    await withServer(fixture, async ({ baseURL }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, { baseURL });
      try {
        await assert.rejects(window.transition(point(0)), /hash mismatch/);
        assert.equal(window.group, null);
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "individually valid verified cells still require matching seams",
  async () => {
    const fixture = assetsFor((x, cell, files) => {
      if (x === 1) {
        cell.heightsMm[0]++;
        files.collision = encode(cell);
        files.scene = compileTerrainCell(cell).glb;
      }
    });
    await withServer(fixture, async ({ baseURL }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, { baseURL });
      try {
        await assert.rejects(window.transition(point(0)), /seam/);
        assert.equal(window.group, null);
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "failed successor retains prior preview/provenance but disables readiness and queries",
  async () => {
    const fixture = assetsFor((x, cell, files) => {
      if (x === 5) files.collision = encode({ ...cell, chunkId: "incorrect" });
    });
    await withServer(fixture, async ({ baseURL }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, { baseURL });
      try {
        await window.transition(point(0));
        const group = window.group,
          prior = window.snapshot().provenance;
        await assert.rejects(window.transition(point(5)), /identity/);
        assert.equal(window.group, group);
        assert.deepEqual(window.snapshot().provenance, prior);
        assert.equal(window.snapshot().state, "error");
        assert.equal(window.snapshot().terrainReady, false);
        assert.equal(window.support(point(0)).status, "not-ready");
        await window.transition(point(0));
        assert.equal(window.snapshot().terrainReady, true);
        assert.equal(group.children.length, 0);
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "latest transition wins and cancelled downloads never commit stale terrain",
  async () => {
    const fixture = assetsFor();
    let release, entered;
    const gate = new Promise((resolve) => (release = resolve)),
      seen = new Promise((resolve) => (entered = resolve));
    await withServer(
      fixture,
      async ({ baseURL }) => {
        const window = createVerifiedTerrainWindow(fixture.manifest, {
          baseURL,
        });
        try {
          await window.transition(point(0));
          const old = window.transition(point(5));
          const rejected = assert.rejects(old, { name: "AbortError" });
          await seen;
          const latest = window.transition(point(0));
          release();
          await rejected;
          const ready = await latest;
          assert.deepEqual(ready.provenance.positionMm, point(0));
          assert.equal(window.snapshot().state, "ready");
        } finally {
          release();
          await window.dispose();
        }
      },
      async (url) => {
        if (url.includes("tile-5-")) {
          entered();
          await gate;
        }
      },
    );
  },
);
await check(
  "cancel during cached-source preparation leaves old resources intact without readiness",
  async () => {
    const fixture = assetsFor();
    await withServer(fixture, async ({ baseURL }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, { baseURL });
      try {
        await window.transition(point(0));
        const group = window.group;
        const pending = window.transition(point(0));
        const rejected = assert.rejects(pending, { name: "AbortError" });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        window.cancel();
        await rejected;
        assert.equal(window.group, group);
        assert.equal(window.snapshot().state, "cancelled");
        assert.equal(window.snapshot().terrainReady, false);
        await window.transition(point(0));
        assert.equal(window.snapshot().terrainReady, true);
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "combined geometry allowance fails before fetching a successor",
  async () => {
    const fixture = assetsFor();
    await withServer(fixture, async ({ baseURL, requests }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, {
        baseURL,
        maxGeometryBytes: 150000,
      });
      try {
        await window.transition(point(0));
        const before = requests(),
          group = window.group;
        await assert.rejects(
          window.transition(point(5)),
          /transition-terrain-geometry-budget/,
        );
        assert.equal(requests(), before);
        assert.equal(window.group, group);
        assert(window.snapshot().reservedGeometryBytes <= 150000);
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "terrain profile rejects large files and extra asset roles before network activity",
  () => {
    const fixture = assetsFor();
    const large = structuredClone(fixture.manifest);
    large.assets.find((a) => a.kind === "collision").bytes = 16385;
    assert.throws(
      () =>
        createVerifiedTerrainWindow(large, {
          baseURL: "https://example.com/region/",
        }),
      /decode profile/,
    );
    const extra = structuredClone(fixture.manifest);
    extra.assets.push({
      id: "texture",
      path: "a.png",
      kind: "texture",
      bytes: 1,
      sha256: "a".repeat(64),
    });
    extra.chunks[0].assets.push("texture");
    assert.throws(
      () =>
        createVerifiedTerrainWindow(extra, {
          baseURL: "https://example.com/region/",
        }),
      /exactly one/,
    );
  },
);
await check(
  "dispose cancels pending source work, frees committed terrain and rejects future operations",
  async () => {
    const fixture = assetsFor();
    let release, entered;
    const gate = new Promise((resolve) => (release = resolve)),
      seen = new Promise((resolve) => (entered = resolve));
    await withServer(
      fixture,
      async ({ baseURL }) => {
        const window = createVerifiedTerrainWindow(fixture.manifest, {
          baseURL,
        });
        await window.transition(point(0));
        const group = window.group;
        const pending = window.transition(point(5));
        const rejected = assert.rejects(pending, { name: "AbortError" });
        await seen;
        const disposing = window.dispose();
        release();
        await rejected;
        await disposing;
        await window.dispose();
        const state = window.snapshot();
        assert.equal(state.state, "disposed");
        assert.equal(state.sourceBytes, 0);
        assert.equal(state.reservedSourceBytes, 0);
        assert.equal(state.geometryBytes, 0);
        assert.equal(state.reservedGeometryBytes, 0);
        assert.equal(window.group, null);
        assert.equal(group.children.length, 0);
        await assert.rejects(window.transition(point(0)), /disposed/);
        assert.throws(() => window.support(point(0)), /disposed/);
      },
      async (url) => {
        if (url.includes("tile-5-")) {
          entered();
          await gate;
        }
      },
    );
  },
);
await check(
  "repeated source/geometry transitions retain only current required terrain",
  async () => {
    const fixture = assetsFor();
    await withServer(fixture, async ({ baseURL }) => {
      const window = createVerifiedTerrainWindow(fixture.manifest, {
        baseURL,
        subtle: webcrypto.subtle,
      });
      try {
        for (let i = 0; i < 20; i++) {
          const previous = window.group,
            result = await window.transition(point(i % 2 ? 5 : 0));
          assert.equal(result.geometryBytes, 101424);
          assert.equal(result.provenance.chunks.length, 2);
          assert.equal(result.reservedGeometryBytes, result.geometryBytes);
          if (previous) assert.equal(previous.children.length, 0);
        }
      } finally {
        await window.dispose();
      }
    });
  },
);
await check(
  "staged support rejection retains the old visual frame and copied pose admission",
  async () => {
    await withServer(assetsFor(), async ({ baseURL }) => {
      const window = createVerifiedTerrainWindow(assetsFor().manifest, {
        baseURL,
      });
      try {
        const ready = await window.transition(point(0));
        const previous = window.group,
          count = previous.children.length;
        await assert.rejects(
          window.transition(point(5), {
            positionMm: point(5),
            radiusMm: 220,
          }),
          /cannot support/,
        );
        assert.equal(window.group, previous);
        assert.equal(previous.children.length, count);
        assert.deepEqual(window.snapshot().provenance, ready.provenance);
        assert.equal(window.snapshot().terrainReady, false);
        assert.equal(
          window.snapshot().reservedGeometryBytes,
          ready.geometryBytes,
        );
        await assert.rejects(
          window.transition(point(5), {
            positionMm: point(5),
            radiusMm: 2001,
          }),
          /Invalid support pose/,
        );
        assert.equal(window.group, previous);
        const supportPose = {
          positionMm: { ...point(5), y: 40000 },
          radiusMm: 220,
        };
        const pending = window.transition(point(5), supportPose);
        supportPose.positionMm.y = -9000;
        const admitted = await pending;
        assert.equal(admitted.terrainReady, true);
        assert.equal(previous.children.length, 0);
      } finally {
        await window.dispose();
      }
    });
  },
);
console.log(
  JSON.stringify({
    checks,
    passed: true,
    runtime: process.version,
    sourceTransport: "local HTTP and native fetch",
    flightReady: false,
    limitations:
      "Detached authoring terrain only; no player streaming, license acceptance, GPU/FPS or flight qualification.",
  }),
);
