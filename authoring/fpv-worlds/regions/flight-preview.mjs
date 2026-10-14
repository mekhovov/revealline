import * as THREE from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { createRegionalFlightPrototype } from "./flight-prototype.mjs";
import { createRegionalInputSession } from "./shared-input-session.mjs";
import { keyboardFlightHelp } from "../../../optional-practice/civilian-fpv/input.mjs";
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
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 900);
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
let manifestController = null, flight = null, busy = false, hudAt = 0, loadingGeneration = 0, closed = false;
function message(value) { $("message").textContent = value; }
const session = createRegionalInputSession({
  window, document, createFlight: createRegionalFlightPrototype,
  onFlight(value) { flight = value; if (value) { value.dronePose.add(quad); scene.add(value.root); } },
  onState(state) {
    if (!state || closed) return;
    if (state.status === "active") { message("Authoring flight active"); canvas.focus(); }
    else message(session.status().busy ? "Preparing verified terrain…" : state.reason === "prepared" ? "Terrain ready. Arm deliberately to fly." : state.reason === "preparing-terrain" ? "Preparing verified terrain…" : `Paused: ${state.reason}`);
  },
  onCamera() { $("view").value = $("view").value === "fpv" ? "chase" : "fpv"; },
  onError(error) { message(`Paused: ${error.message}`); },
});
async function prepare() { if (!busy) await session.prepare(); }
async function reset() { if (!busy && !closed) await session.replace(); }
document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || session.status().busy) return;
  const token = ++loadingGeneration;
  busy = true;
  session.block(true);
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
    await session.replace({ manifest, mode: $("mode").value, source: { baseURL: new URL(".", url).href } });
    document.querySelector("details").open = false;
  } catch (error) {
    message(`Paused: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    busy = false;
    session.block(false);
  }
});
$("prepare").onclick = prepare;
$("reset").onclick = reset;
$("arm").onclick = () => {
  if (busy || closed) return;
  if (!session.arm()) message("Prepare terrain, centre the controls and release controller buttons before arming.");
};
$("pause").onclick = () => session.pause();
$("source").onchange = () => { session.select($("source").value); $("touch-controls").hidden = $("source").value !== "touch"; };
$("mode").onchange = () => session.setMode($("mode").value);
session.bindStick($("left-stick"), "left"); session.bindStick($("right-stick"), "right");
document.querySelector("header").addEventListener("focusin", () => session.pause());
$("keyboard-help").textContent = keyboardFlightHelp("two-stick");
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
  session.advance(performance.now());
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
        `${state.ticks} ticks · throttle ${Math.round(session.status().controls.throttle * 100)}% · ${state.recentres} local frames · ${state.terrain.geometryBytes} geometry bytes`;
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
  void session.dispose();
  geometry.dispose();
  material.dispose();
  renderer.dispose();
});
