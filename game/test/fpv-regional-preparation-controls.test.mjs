import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parse } from "acorn";

// Exercise the production authoring controls, not a copied control policy.
// Renderer/DOM stubs here do not qualify graphics, physics or native performance.
const base = new URL("../../authoring/fpv-worlds/regions/", import.meta.url);
const source = await readFile(
  new URL("renderer-preparation.mjs", base),
  "utf8",
);
const html = await readFile(new URL("renderer-preparation.html", base), "utf8");
const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
function callback(name) {
  const node = ast.body.find(
    (item) => item.type === "FunctionDeclaration" && item.id.name === name,
  );
  assert(node, `Production ${name} must exist`);
  return new Function(
    "state",
    "...args",
    `with (state) { return (${source.slice(node.start, node.end)})(...args); }`,
  );
}
const buttons = callback("buttons");
const changeQuality = callback("changeQuality");
const startMeasurement = callback("startMeasurement");
const finishMeasurement = callback("finishMeasurement");
function fixture(overrides = {}) {
  const controls = new Map();
  const state = {
    busy: false,
    owner: { snapshot: () => ({ provenance: { verified: true } }) },
    closed: false,
    measurement: null,
    $: (id) => {
      if (!controls.has(id))
        controls.set(id, { value: id === "surface" ? "canyon" : "balanced" });
      return controls.get(id);
    },
    ...overrides,
  };
  return { controls, state };
}

test("live quality stays available after loading and during detached preparation", () => {
  for (const busy of [false, true]) {
    const { controls, state } = fixture({ busy });
    buttons(state);
    assert.equal(controls.get("quality").disabled, false);
    assert.equal(controls.get("surface").disabled, true);
  }
});

test("measurement freezes quality, camera and both staging actions without blocking release", () => {
  const { controls, state } = fixture({ measurement: {} });
  buttons(state);
  for (const id of ["quality", "view", "stage", "stage-quality", "measure"])
    assert.equal(controls.get(id).disabled, true, id);
  assert.equal(controls.get("release").disabled, false);
});

test("quality changes invalidate a measurement before changing renderer state", () => {
  const events = [];
  const { controls, state } = fixture({
    finishMeasurement: (reason) => events.push(["invalidate", reason]),
    renderer: {
      setQuality: (value) => events.push(["quality", value]),
      resources: () => ({ geometry: 41 }),
    },
    receipt: { retained: true },
    surfaceNames: () => ["Canyon sediment"],
  });
  changeQuality(state);
  assert.deepEqual(events, [
    ["invalidate", "Surface quality changed"],
    ["quality", "balanced"],
  ]);
  assert.deepEqual(JSON.parse(controls.get("receipt").textContent), {
    retained: true,
    quality: "balanced",
    surfaceNames: ["Canyon sediment"],
    resources: { geometry: 41 },
  });
});

test("measurement captures surface and releases control locks when invalidated", () => {
  const { controls, state } = fixture({
    document: { visibilityState: "visible" },
    performance: { now: () => 100 },
    renderer: { resources: () => ({ geometry: 41 }) },
    innerWidth: 1280,
    innerHeight: 720,
    navigator: { userAgent: "unit-test" },
    canvas: { width: 1280, height: 720 },
    devicePixelRatio: 1,
    sourceReceipt: { sha256: "exact-source" },
    percentile: (values) => values[0] ?? null,
  });
  state.buttons = () => buttons(state);
  startMeasurement(state);
  assert.equal(state.measurement.surface, "canyon");
  assert.equal(controls.get("quality").disabled, true);
  state.measurement = { ...state.measurement, start: 100, last: 110 };
  finishMeasurement(state, "Quality changed");
  assert.equal(state.measurement, null);
  assert.equal(controls.get("quality").disabled, false);
  const receipt = JSON.parse(controls.get("measurement").textContent);
  assert.equal(receipt.status, "INVALID");
  assert.equal(receipt.surface, "canyon");
});

test("merged authoring page retains every control exactly once", () => {
  for (const id of [
    "surface",
    "quality",
    "view",
    "measure",
    "measurement",
    "stage-quality",
  ])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
});
