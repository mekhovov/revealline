import { Group } from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { createFlightRenderer } from "../../../optional-practice/civilian-fpv/renderer.mjs";
import { createVerifiedMixedWindow } from "./verified-mixed-window.mjs";
const $ = (id) => document.getElementById(id);
const parameters = new URLSearchParams(location.search);
for (const id of ["terrain", "scenery", "surface"])
  if (parameters.has(id)) $(id).value = parameters.get(id);
const renderer = createFlightRenderer({
  canvas: document.querySelector("canvas"),
  onContextLost: () => {
    controller?.abort();
    owner?.cancel();
    finishMeasurement("Graphics context lost");
    $("status").textContent = "Graphics context lost; reload to recover.";
  },
});
const root = new Group();
let owner = null,
  controller = null,
  position = null,
  origin = { x: 0, y: 0, z: 0 },
  closed = false,
  busy = false,
  frames = 0,
  frameId = 0,
  next = true,
  receipt = null,
  changeDuringPreparation = false,
  sourceReceipt = null,
  grid = null,
  measurement = null,
  lastStatusTime = 0;
function surfaceNames() {
  const names = new Set();
  root.traverse((object) => {
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      if (material?.userData?.setRegionalSurfaceQuality)
        names.add(material.name);
  });
  return [...names];
}
function changeQuality() {
  finishMeasurement("Surface quality changed");
  renderer.setQuality($("quality").value);
  $("receipt").textContent = JSON.stringify(
    {
      ...receipt,
      quality: $("quality").value,
      surfaceNames: surfaceNames(),
      resources: renderer.resources(),
    },
    null,
    2,
  );
}
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
    ] ?? null
  );
};
function finishMeasurement(reason = null) {
  if (!measurement) return;
  const sample = measurement;
  measurement = null;
  const summarize = (values) => ({
    count: values.length,
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: values.length ? Math.max(...values) : null,
  });
  $("measurement").textContent = JSON.stringify(
    {
      status: reason ? "INVALID" : "OBSERVED",
      reason,
      scope:
        "Fixed pose, production renderer and owner snapshot; no physics or input. CPU submission is not GPU time.",
      userAgent: navigator.userAgent,
      viewport: sample.viewport,
      canvas: { width: canvas.width, height: canvas.height },
      devicePixelRatio,
      quality: sample.quality,
      surface: sample.surface,
      view: sample.view,
      source: sourceReceipt,
      elapsedMs: sample.last - sample.start,
      frameIntervalsMs: summarize(sample.intervals),
      drawCpuMs: summarize(sample.cpu),
      resourcesBefore: sample.resources,
      resourcesAfter: renderer.resources(),
      ownedBefore: sample.owned,
      ownedAfter: owner?.snapshot(),
    },
    null,
    2,
  );
  buttons();
}
const canvas = document.querySelector("canvas");
function startMeasurement() {
  if (!owner || busy || closed || !owner.snapshot().provenance) return;
  if (document.visibilityState !== "visible") {
    $("measurement").textContent = "Keep this tab visible before measuring.";
    return;
  }
  measurement = {
    warmUntil: performance.now() + 2000,
    start: null,
    last: null,
    intervals: [],
    cpu: [],
    quality: $("quality").value,
    surface: $("surface").value,
    view: $("view").value,
    viewport: { width: innerWidth, height: innerHeight },
    resources: renderer.resources(),
    owned: owner.snapshot(),
  };
  $("measurement").textContent = "Warming up, then measuring 30 seconds…";
  buttons();
}
function buttons() {
  $("load").disabled = busy || Boolean(owner) || closed;
  $("stage").disabled = busy || !owner || closed;
  $("stage-quality").disabled =
    busy || !owner || closed || Boolean(measurement);
  $("cancel").disabled = !busy;
  $("release").disabled = !owner || closed;
  $("measure").disabled = busy || !owner || closed || Boolean(measurement);
  $("quality").disabled = closed || Boolean(measurement);
  $("surface").disabled = Boolean(owner) || busy || closed;
  $("view").disabled = Boolean(measurement);
  $("stage").disabled ||= Boolean(measurement);
}
async function manifest(input, signal) {
  const url = new URL(input, location.href);
  if (url.origin !== location.origin)
    throw new Error("Use a same-origin verified study source");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Manifest unavailable");
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return {
    manifest: JSON.parse(new TextDecoder().decode(bytes)),
    source: { baseURL: new URL(".", url).href },
    receipt: { url: url.href, sha256, bytes: bytes.byteLength },
  };
}
async function prepare(load) {
  if (closed || busy) return;
  finishMeasurement("Area preparation changed the workload");
  busy = true;
  controller = new AbortController();
  buttons();
  $("status").textContent =
    "Preparing detached verified geometry; current area remains visible.";
  const startFrames = frames,
    operationStarted = performance.now(),
    previousPreparation = renderer.regionalPreparation()?.sequence;
  try {
    if (load) {
      const [terrain, scenery] = await Promise.all([
        manifest($("terrain").value, controller.signal),
        manifest($("scenery").value, controller.signal),
      ]);
      controller.signal.throwIfAborted();
      owner = createVerifiedMixedWindow(terrain.manifest, {
        source: { ...terrain.source, surfaceStyle: $("surface").value },
        scenery,
        retainCommitted: true,
      });
      sourceReceipt = { terrain: terrain.receipt, scenery: scenery.receipt };
      grid = terrain.manifest.grid;
      renderer.setQuality($("quality").value);
      position = { ...terrain.manifest.spawns[0].position };
      renderer.setRegional({ root }, terrain.manifest);
    }
    const previousOrigin = origin;
    let attached = null;
    const target =
      load || !next
        ? position
        : {
            ...position,
            x: Math.min(
              (grid.minX + grid.width) * grid.cellSizeMm - 1000,
              position.x + grid.cellSizeMm,
            ),
          };
    await owner.transition(target, null, {
      async prepare({ group }) {
        const preparation = renderer.prepareRegionalFrame(group, {
          signal: controller.signal,
        });
        if (changeDuringPreparation) {
          changeDuringPreparation = false;
          $("quality").value = $("quality").value === "low" ? "high" : "low";
          changeQuality();
        }
        await preparation;
      },
      readPose: () => ({ positionMm: position, radiusMm: 220 }),
      commit({ group, provenance }) {
        attached = group;
        root.add(group);
        origin = { ...provenance.originMm };
      },
      rollback() {
        attached?.removeFromParent();
        origin = previousOrigin;
      },
    });
    if (!load) next = !next;
    $("status").textContent =
      "Prepared and adopted. Current verified area remains usable.";
  } catch (error) {
    $("status").textContent =
      error.name === "AbortError"
        ? "Preparation cancelled; previous verified area retained if present."
        : `Preparation failed: ${error.message}`;
  } finally {
    const preparation = renderer.regionalPreparation();
    receipt = {
      preparation:
        preparation?.sequence !== previousPreparation ? preparation : null,
      rendererStageStarted: preparation?.sequence !== previousPreparation,
      visibleFramesDuringPreparation: frames - startFrames,
      frameCounterScope:
        "Whole source, geometry and renderer preparation operation",
      operationElapsedMs: performance.now() - operationStarted,
      geometryBytes: owner?.snapshot().geometryBytes ?? 0,
      reservedGeometryBytes: owner?.snapshot().reservedGeometryBytes ?? 0,
      resources: renderer.resources(),
      quality: $("quality").value,
      surfaceNames: surfaceNames(),
    };
    $("receipt").textContent = JSON.stringify(receipt, null, 2);
    busy = false;
    changeDuringPreparation = false;
    controller = null;
    buttons();
  }
}
function render(now = performance.now()) {
  if (closed) return;
  const started = performance.now();
  let drawn = false;
  if (owner && position) {
    const terrain = owner.snapshot();
    if (
      terrain.provenance &&
      renderer.draw(
        {
          position,
          orientation: [0, 0, 0, 1000000],
          ticks: 0,
          lastInput: { throttle: 0, roll: 0, pitch: 0, yaw: 0 },
          originMm: origin,
          terrain,
        },
        { cameraMode: $("view").value, cameraFov: 82, cameraTilt: 0 },
      )
    ) {
      frames++;
      drawn = true;
    }
  }
  const elapsed = performance.now() - started;
  if (measurement && drawn && now >= measurement.warmUntil) {
    if (measurement.start === null) {
      measurement.start = measurement.last = now;
    } else {
      measurement.intervals.push(now - measurement.last);
      measurement.cpu.push(elapsed);
      measurement.last = now;
      if (now - measurement.start >= 30000) finishMeasurement();
      else if (measurement.intervals.length >= 20000)
        finishMeasurement("Sample capacity reached");
    }
  }
  if (now - lastStatusTime >= 250) {
    $("frames").textContent = `Visible frames: ${frames}`;
    lastStatusTime = now;
  }
  frameId = requestAnimationFrame(render);
}
async function release() {
  if (closed) return;
  finishMeasurement("Resources released before measurement completed");
  closed = true;
  controller?.abort();
  owner?.cancel();
  cancelAnimationFrame(frameId);
  await owner?.dispose();
  renderer.dispose();
  buttons();
  $("status").textContent = "Resources released. Reload to start again.";
  $("receipt").textContent = JSON.stringify(
    {
      lastPreparation: receipt,
      geometryBytes: owner?.snapshot().geometryBytes ?? 0,
      reservedGeometryBytes: owner?.snapshot().reservedGeometryBytes ?? 0,
    },
    null,
    2,
  );
}
$("measure").addEventListener("click", startMeasurement);
addEventListener("resize", () => finishMeasurement("Viewport changed"));
addEventListener("blur", () => finishMeasurement("Window lost focus"));
addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible")
    finishMeasurement("Tab became hidden");
});
$("view").addEventListener("change", () => finishMeasurement("Camera changed"));
$("load").addEventListener("click", () => prepare(true));
$("stage").addEventListener("click", () => prepare(false));
$("stage-quality").addEventListener("click", () => {
  changeDuringPreparation = true;
  prepare(false);
});
$("quality").addEventListener("change", changeQuality);
$("cancel").addEventListener("click", () => {
  controller?.abort();
  owner?.cancel();
});
$("release").addEventListener("click", release);
addEventListener("pagehide", release, { once: true });
if (!renderer.available) {
  closed = true;
  $("status").textContent = "WebGL unavailable";
}
buttons();
render();
