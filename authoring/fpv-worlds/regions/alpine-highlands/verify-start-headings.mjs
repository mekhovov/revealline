/** Exact curated start directions; this is a Node geometry/lifecycle check, not native art acceptance. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  regionalPresentationOptions,
} from "../../../../optional-practice/civilian-fpv/regional-library.mjs";
import { prepareRegionalDownload } from "../../../../optional-practice/civilian-fpv/regional-delivery.mjs";
import { createRegionalSession } from "../../../../optional-practice/civilian-fpv/regional-session.mjs";
import { createVerifiedFlightGeometry } from "../../../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs";
const root = resolve(process.argv[2] ?? "");
assert(process.argv[2], "Provide the exact review-r2 delivery folder");
const sha256 =
  "a442a07717d09c703231279db41dd23c9447e0cc7f5f53aa3964eef4f74573ec";
const row = REGIONAL_LIBRARY_PINS.find((item) => item.pin.sha256 === sha256);
const old = REGIONAL_LIBRARY_PINS.find(
  (item) =>
    item.pin.sha256 ===
    "8b49b885b05976b4a114a17d88d9af1b352418cbac16866a5249ae32b43c191a",
);
assert(row && old);
assert.deepEqual(row.edition, {
  en: "Refined contours",
  uk: "Уточнені контури",
});
assert.deepEqual(old.edition, {
  en: "Original study",
  uk: "Початковий варіант",
});
assert.equal(
  old.startHeadings,
  undefined,
  "Original revision heading policy stays unchanged",
);
const target = {
  "glacial-valley": {
    heading: 9000,
    dx: 40000,
    dz: 0,
    route: "Open glacial slalom",
  },
  "switchback-pass": {
    heading: 9000,
    dx: 40000,
    dz: 0,
    route: "Open terrace approach",
  },
  "snow-saddle": { heading: 18000, dx: 0, dz: 40000, route: "Pinnacle gap" },
  "summit-station": {
    heading: 9000,
    dx: 40000,
    dz: 0,
    route: "Open station concourse",
  },
  "viaduct-gorge": {
    heading: 18000,
    dx: 0,
    dz: 40000,
    route: "Viaduct centre bay",
  },
  "reservoir-dam": { heading: 18000, dx: 0, dz: 40000, route: "Dam spillway" },
};
assert.deepEqual(
  row.startHeadings,
  Object.fromEntries(
    Object.entries(target).map(([id, value]) => [id, value.heading]),
  ),
);
const local = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const name = new URL(url).pathname.split("/delivery-review-r2/")[1];
  assert(name && !name.includes(".."));
  const path = resolve(root, name);
  assert(path.startsWith(root + sep));
  return new Response(await readFile(path));
};
const checked = await prepareRegionalDownload(row.pin, {
  pageURL: "https://heading.invalid/sim",
  fetchImpl: local,
});
const files = new Map();
for (const ref of checked.descriptor.files)
  files.set(
    "/" + ref.path,
    new Uint8Array(await checked.assets.get(ref.path).arrayBuffer()),
  );
const manifest = JSON.parse(
  new TextDecoder().decode(files.get("/terrain/region.json")),
);
const scenery = JSON.parse(
  new TextDecoder().decode(files.get("/scenery/region.json")),
);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const path = new URL(url).pathname;
  assert(files.has(path), "Only verified cached source is used");
  return new Response(files.get(path));
};
const configuration = {
  manifest,
  source: { baseURL: "https://heading.invalid/terrain/", fetchImpl },
  scenery: {
    manifest: scenery,
    source: { baseURL: "https://heading.invalid/scenery/", fetchImpl },
  },
  geometryProfile: "terrain-scenery-v1",
};
const identity = { id: row.id, sha256 };
const approved = applyRegionalAppearance(configuration, identity);
assert.equal(configuration.authoredStartHeadings, undefined);
for (const other of [
  { id: row.id, sha256: old.pin.sha256 },
  { id: row.id, sha256: "0".repeat(64) },
]) {
  const reset = applyRegionalAppearance(approved, other);
  assert.deepEqual(reset.authoredStartHeadings, {});
  assert.equal(
    regionalPresentationOptions(reset, "balanced").initialHeading,
    "region-centre",
  );
}
const geometryHash = (root) => {
  const hash = createHash("sha256");
  root.traverse((object) => {
    if (!object.isMesh) return;
    for (const attribute of [
      object.geometry.attributes.position,
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
  return hash.digest("hex");
};
const rows = [];
for (const spawn of manifest.spawns) {
  const direction = target[spawn.id];
  const owner = createVerifiedFlightGeometry(manifest, {
    profile: "terrain-scenery-v1",
    source: configuration.source,
    scenery: configuration.scenery,
  });
  try {
    await owner.transition(spawn.position);
    const to = {
      x: spawn.position.x + direction.dx,
      y: spawn.position.y,
      z: spawn.position.z + direction.dz,
    };
    assert.equal(
      owner.sweep(spawn.position, to, 2000).status,
      "terrain-clear",
      spawn.id + ": initial 40m / 4m-wide forward corridor",
    );
  } finally {
    await owner.dispose();
    assert.equal(owner.snapshot().geometryBytes, 0);
  }
  const baseline = createRegionalSession({
    ...configuration,
    spawnId: spawn.id,
    initialHeading: "region-centre",
  });
  let baselineGeometry;
  try {
    await baseline.prepare();
    baselineGeometry = geometryHash(baseline.root);
  } finally {
    await baseline.dispose();
  }
  for (const mode of ["self-level", "acro"]) {
    const options = regionalPresentationOptions(
      { ...approved, spawnId: spawn.id, mode },
      "balanced",
    );
    assert.equal(options.initialHeading, direction.heading);
    const session = createRegionalSession(options);
    try {
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, "paused");
      assert.equal(state.ticks, 0);
      assert.deepEqual(state.position, spawn.position);
      assert.equal((state.attitude.yaw + 36000) % 36000, direction.heading);
      assert.equal(
        geometryHash(session.root),
        baselineGeometry,
        "Heading changes no scenery geometry",
      );
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.lastInput, {
        roll: 0,
        pitch: 0,
        yaw: 0,
        throttle: 0,
      });
      assert(session.arm());
      for (let tick = 0; tick < 100; tick++) {
        const next = session.step({
          roll: 0,
          pitch: 0,
          yaw: 0,
          throttle: 0.52,
        });
        assert.equal(next.status, "active", next.reason);
        assert.equal(next.contacts, 0);
        await new Promise((done) => setImmediate(done));
      }
      session.pause();
      assert.equal(session.snapshot().status, "paused");
      rows.push({
        spawnId: spawn.id,
        mode,
        heading: direction.heading,
        route: direction.route,
        forwardClearanceM: 40,
        corridorWidthM: 4,
        geometrySHA256: baselineGeometry,
      });
    } finally {
      await session.dispose();
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
    }
  }
  const savedStart = { position: { ...spawn.position }, heading: 27122 };
  const saved = createRegionalSession(
    regionalPresentationOptions(
      { ...approved, spawnId: spawn.id, savedStart },
      "balanced",
    ),
  );
  try {
    await saved.prepare();
    assert.equal(saved.snapshot().status, "paused");
    assert.deepEqual(saved.snapshot().position, savedStart.position);
    assert(
      Math.abs(
        ((saved.snapshot().attitude.yaw + 36000) % 36000) - savedStart.heading,
      ) <= 2,
      "Saved heading remains authoritative",
    );
  } finally {
    await saved.dispose();
    assert.equal(saved.snapshot().terrain.geometryBytes, 0);
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptorSHA256: sha256,
      manifestSHA256: createHash("sha256")
        .update(files.get("/terrain/region.json"))
        .digest("hex"),
      cases: rows,
      savedHeadingsPreserved: 6,
      sourceBytesChanged: false,
      noAutomaticArming: true,
      disposalZero: true,
      limitations: [
        "Node verified collision and orientation; native composition/camera review remains required",
        "No authored spawn, terrain, collision, physics or saved-location mutation",
      ],
    },
    null,
    2,
  ),
);
