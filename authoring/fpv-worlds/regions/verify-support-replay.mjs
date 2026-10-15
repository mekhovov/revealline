/** Manual before/after proof comparison; never rewrites golden expectations. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { WORLD_DEMONSTRATIONS } from "../../../optional-practice/civilian-fpv/world-demonstrations.mjs";
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from "../../../optional-practice/civilian-fpv/world-catalogue.mjs";
import {
  replayWorldFlight,
  initWorldRuntime,
  WORLD_FLIGHT_HZ,
} from "../../../optional-practice/civilian-fpv/world-model.mjs";
import { FLIGHT_HZ } from "../../../optional-practice/civilian-fpv/model.mjs";
const baseline = "84544a1e";
const moduleURL = new URL(
  "../../../optional-practice/civilian-fpv/world-model.mjs",
  import.meta.url,
);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const original = execFileSync(
  "git",
  ["show", baseline + ":optional-practice/civilian-fpv/world-model.mjs"],
  { cwd: root, maxBuffer: 1024 * 1024 },
).toString();
assert(
  !original.includes("import.meta"),
  "Baseline module needs explicit resource relocation",
);
const collisionURL = new URL("./world-collision.mjs", moduleURL);
const collisionSource = execFileSync(
  "git",
  ["show", baseline + ":optional-practice/civilian-fpv/world-collision.mjs"],
  { cwd: root },
).toString();
const collisionRelocated = collisionSource.replace(
  /from (['"])(\.[^'"]+)\1/g,
  (_, quote, path) =>
    "from " + quote + new URL(path, collisionURL).href + quote,
);
const historicalCollisionURL =
  "data:text/javascript;base64," +
  Buffer.from(collisionRelocated).toString("base64");
const relocated = original.replace(
  /from (['"])(\.[^'"]+)\1/g,
  (_, quote, path) =>
    "from " +
    quote +
    (path === "./world-collision.mjs"
      ? historicalCollisionURL
      : new URL(path, moduleURL).href) +
    quote,
);
const historical = await import(
  "data:text/javascript;base64," + Buffer.from(relocated).toString("base64")
);
// Both pinned WASM initialization authorities settle before any replay world exists.
await historical.initWorldRuntime();
await initWorldRuntime();
assert.equal(WORLD_FLIGHT_HZ, FLIGHT_HZ);
assert.equal(FLIGHT_HZ, 50);
const courses = new Map(
  [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => [
    entry.id,
    entry.course,
  ]),
);
let ticks = 0;
const receipts = [];
for (const { proof } of WORLD_DEMONSTRATIONS) {
  const course = courses.get(proof.course);
  assert(course, "Missing authored course " + proof.course);
  const before = await historical.replayWorldFlight(course, proof, {
    sampleEvery: 17,
  });
  const after = await replayWorldFlight(course, proof, { sampleEvery: 17 });
  assert.deepEqual(after, before, proof.course + "/" + proof.mode);
  ticks += proof.frames.length;
  receipts.push({
    course: proof.course,
    mode: proof.mode,
    hash: proof.finalStateIdentity,
  });
}
console.log(
  JSON.stringify({
    baseline,
    demonstrations: receipts.length,
    ticks,
    allReplayStatesAndPathsEqual: true,
    proofIdentitiesSHA256: createHash("sha256")
      .update(JSON.stringify(receipts))
      .digest("hex"),
    runtime: process.version,
  }),
);
