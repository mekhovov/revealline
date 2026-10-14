import * as THREE from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { createRegionalFlightPrototype } from "./flight-prototype.mjs";
import { validateRegionManifest } from "./region-manifest.mjs";
const $ = (id) => document.getElementById(id),
  canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d4e3);
scene.add(new THREE.HemisphereLight(0xd8efff, 0x6d5941, 2));
const light = new THREE.DirectionalLight(0xffefcf, 2.5);
light.position.set(50, 100, 40);
scene.add(light);
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 900),
  clock = new THREE.Clock();
const geometry = new THREE.BoxGeometry(0.7, 0.07, 0.08),
  material = new THREE.MeshStandardMaterial({
    color: 0xe7d7a4,
    roughness: 0.7,
  }),
  quad = new THREE.Group();
for (const sign of [-1, 1]) {
  const arm = new THREE.Mesh(geometry, material);
  arm.rotation.y = (sign * Math.PI) / 4;
  quad.add(arm);
}
let manifestController = null;
let flight = null,
  config = null,
  busy = false,
  throttle = 0,
  accumulator = 0,
  hudAt = 0,
  loadingGeneration = 0,
  closed = false;
const held = new Set(),
  input = () => ({
    roll: Number(held.has("KeyD")) - Number(held.has("KeyA")),
    pitch: Number(held.has("KeyW")) - Number(held.has("KeyS")),
    yaw: Number(held.has("KeyE")) - Number(held.has("KeyQ")),
    throttle,
  });
function message(value) {
  $("message").textContent = value;
}
async function prepare() {
  if (!flight || busy) return;
  busy = true;
  throttle = 0;
  held.clear();
  message("Preparing verified terrain…");
  try {
    await flight.prepare();
    message("Terrain ready. Arm deliberately to fly.");
  } catch (error) {
    message(`Paused: ${error.message}`);
  } finally {
    busy = false;
  }
}
async function reset() {
  if (!config || busy || closed) return;
  busy = true;
  try {
    const previous = flight;
    flight = null;
    await previous?.dispose();
    if (closed) return;
    throttle = 0;
    held.clear();
    accumulator = 0;
    flight = createRegionalFlightPrototype(config);
    flight.dronePose.add(quad);
    scene.add(flight.root);
    message("Preparing verified terrain…");
    await flight.prepare();
    if (!closed) message("Terrain ready. Arm deliberately to fly.");
  } catch (error) {
    if (!closed) message(`Paused: ${error.message}`);
  } finally {
    busy = false;
  }
}
document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const token = ++loadingGeneration;
  busy = true;
  flight?.pause();
  message("Loading bounded region manifest…");
  let timeout;
  try {
    manifestController?.abort();
    manifestController = new AbortController();
    timeout = setTimeout(() => manifestController.abort(), 30000);
    const url = new URL($("manifest").value, location.href),
      response = await fetch(url, {
        signal: manifestController.signal,
        credentials: "omit",
        redirect: "error",
      });
    if (!response.ok || !response.body)
      throw new Error("Manifest download failed");
    const reader = response.body.getReader(),
      parts = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8 * 1024 * 1024) throw new Error("Manifest is too large");
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    const manifest = validateRegionManifest(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (token !== loadingGeneration || closed) return;
    clearTimeout(timeout);
    config = { manifest, source: { baseURL: new URL(".", url).href } };
    busy = false;
    await reset();
    document.querySelector("details").open = false;
  } catch (error) {
    message(`Paused: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    busy = false;
  }
});
$("prepare").onclick = prepare;
$("reset").onclick = reset;
$("arm").onclick = () => {
  if (busy || closed) return;
  if (flight?.arm(input())) {
    message("Authoring flight active");
    canvas.focus();
  } else
    message(
      "Set throttle down, centre rotation controls and prepare terrain before arming.",
    );
};
$("pause").onclick = () => {
  if (closed) return;
  flight?.pause();
  held.clear();
  message("Paused. Arm to continue.");
};
addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLButtonElement
  )
    return;
  if (
    [
      "KeyW",
      "KeyS",
      "KeyA",
      "KeyD",
      "KeyQ",
      "KeyE",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "KeyP",
    ].includes(event.code)
  )
    event.preventDefault();
  if (event.code === "Space" && !event.repeat) $("arm").click();
  else if (event.code === "KeyP") $("pause").click();
  else held.add(event.code);
});
addEventListener("keyup", (event) => held.delete(event.code));
addEventListener("blur", () => {
  held.clear();
  flight?.pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    held.clear();
    flight?.pause();
    accumulator = 0;
  }
});
function resize() {
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
const requested = new URL(location.href).searchParams.get("manifest");
if (requested) $("manifest").value = requested;
const look = new THREE.Vector3(),
  offset = new THREE.Vector3();
function render() {
  if (closed) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  accumulator += delta;
  while (accumulator >= 0.02) {
    accumulator -= 0.02;
    if (flight && !busy) {
      throttle = Math.max(
        0,
        Math.min(
          1,
          throttle +
            0.008 *
              (Number(held.has("ArrowUp")) - Number(held.has("ArrowDown"))),
        ),
      );
    }
    if (flight?.snapshot().status === "active") {
      const state = flight.step(input());
      if (state.status !== "active")
        message(
          state.reason === "terrain-required"
            ? "Paused at region transition. Prepare terrain, then arm."
            : `Paused: ${state.reason}`,
        );
    }
  }
  if (flight) {
    const pose = flight.cameraAnchor,
      fpv = $("view").value === "fpv";
    quad.visible = !fpv;
    offset
      .set(0, fpv ? 0.04 : 3, fpv ? -0.12 : 8)
      .applyQuaternion(pose.quaternion);
    camera.position.copy(pose.position).add(offset);
    look.set(0, 0, -15).applyQuaternion(pose.quaternion).add(pose.position);
    camera.up.set(0, 1, 0);
    if (fpv) camera.up.applyQuaternion(pose.quaternion);
    camera.lookAt(look);
    if (performance.now() - hudAt > 125) {
      hudAt = performance.now();
      const state = flight.snapshot();
      $("telemetry").textContent =
        `${state.ticks} ticks · throttle ${Math.round(throttle * 100)}% · ${state.recentres} local frames · ${state.terrain.geometryBytes} geometry bytes`;
    }
  } else {
    camera.position.set(0, 12, 25);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
addEventListener("pagehide", () => {
  closed = true;
  manifestController?.abort();
  loadingGeneration++;
  const previous = flight;
  flight = null;
  previous?.dispose();
  geometry.dispose();
  material.dispose();
  renderer.dispose();
});
