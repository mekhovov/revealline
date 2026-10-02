import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { loadThemePreview } from '../../game/presentation/theme-preview.mjs';
import {
  resolvePresentation,
  applyResolvedPresentation,
  BUILTIN_THEME_FAMILIES,
} from '../../game/presentation/theme-system.mjs';
import { createFlightRenderer } from '../../optional-practice/civilian-fpv/renderer.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  WORLD_COURSES,
  ADVENTURE_COURSES,
  FLIGHT_WORLDS,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { buildDroneVisual } from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  createWorkshopCalibration,
  disposeSimVisualGroup,
  createWorkshopBevelNormalTexture,
} from '../../optional-practice/civilian-fpv/world-visuals.mjs';

const $ = (id) => document.getElementById(id),
  courses = [...FLIGHT_COURSES, ...WORLD_COURSES, ...ADVENTURE_COURSES],
  environments = FLIGHT_WORLDS.filter((world) =>
    courses.some((course) => course.environment === world.id),
  ),
  flight = createFlightRenderer({ canvas: $('flight') }),
  materialRenderer = new THREE.WebGLRenderer({ canvas: $('materials'), antialias: true });
for (const id of ['collection', 'specimen']) {
  $(id).replaceChildren();
  for (const family of BUILTIN_THEME_FAMILIES.filter((item) => item.id !== 'legacy')) {
    const option = document.createElement('option');
    option.value = family.sim.id;
    option.textContent = family.name;
    $(id).append(option);
  }
  if (id === 'collection') {
    const authored = document.createElement('option');
    authored.value = 'authored';
    authored.textContent = 'Authored appearance';
    $(id).append(authored);
  }
}
let candidate = null,
  candidatePresentation = null,
  restoreInterface = () => {};
const candidateId = new URL(location.href).searchParams.get('themePreview');
if (candidateId) {
  $('candidate-status').hidden = false;
  try {
    candidate = loadThemePreview(sessionStorage, candidateId);
    candidatePresentation = resolvePresentation({
      themeFamily: candidate.family,
      interfaceTheme: candidate.interfaceTheme,
      density: 'studio',
    });
    restoreInterface = applyResolvedPresentation(document.documentElement, candidatePresentation);
    const binding = candidate.simDependency?.collection;
    $('collection').value = binding?.id ?? 'authored';
    if (binding) $('specimen').value = binding.id;
    $('candidate-status').textContent =
      `Studio candidate ${candidate.source.id}@${candidate.source.revision}: workspace interface tokens applied. ` +
      (binding
        ? `SIM uses the pinned ${binding.id}@${binding.revision} engine collection, including its original material and effect roles.`
        : 'This candidate has no SIM binding; the flight uses its authored appearance.') +
      ' The collection controls below allow isolated comparison.';
  } catch (error) {
    candidate = null;
    candidatePresentation = null;
    $('candidate-status').textContent =
      `Studio candidate unavailable: ${error.message} Open a new SIM preview from Asset Studio. Showing the calibration default.`;
  }
}
materialRenderer.outputColorSpace = THREE.SRGBColorSpace;
materialRenderer.toneMapping = THREE.ACESFilmicToneMapping;
materialRenderer.toneMappingExposure = 1.08;
let selectedCourse,
  scene,
  camera,
  drone,
  frame = 0,
  step = 0,
  comparing = false,
  disposed = false;
for (const world of environments) {
  const option = document.createElement('option');
  option.value = world.id;
  option.textContent = world.title.en;
  $('environment').append(option);
}
function listCourses() {
  const environment =
    environments.find((world) => world.id === $('environment').value) ?? environments[0];
  if (!environment) throw new Error('No calibration environment has a course.');
  $('environment').value = environment.id;
  const previous = $('course').value,
    available = courses.filter((item) => item.environment === environment.id);
  $('course').replaceChildren();
  for (const course of available) {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = course.locales.en.title;
    $('course').append(option);
  }
  $('course').value = available.find((course) => course.id === previous)?.id ?? available[0].id;
}
function installScene(collectionId = $('collection').value) {
  const selected = () =>
    courses.find(
      (course) => course.id === $('course').value && course.environment === $('environment').value,
    );
  selectedCourse = selected();
  if (!selectedCourse) {
    listCourses();
    selectedCourse = selected();
  }
  const binding = candidate?.simDependency?.collection;
  flight.setPresentation({
    collectionId,
    revision: binding?.id === collectionId ? binding.revision : 'r1',
  });
  flight.setCourse(selectedCourse);
  flight.setDrone('utility');
  flight.setQuality($('quality').value);
  step = 0;
}
function specimen() {
  if (scene) disposeSimVisualGroup(scene);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x252c2e);
  scene.add(new THREE.HemisphereLight(0xe5f3ff, 0x3d504a, 2.1));
  const sun = new THREE.DirectionalLight(0xffefd8, 3.1);
  sun.position.set(-4, 6, 3);
  scene.add(sun);
  const collectionId = $('specimen').value,
    quality = $('quality').value,
    maxAnisotropy = materialRenderer.capabilities.getMaxAnisotropy();
  const swatches = createWorkshopCalibration({ collectionId, quality, maxAnisotropy });
  const bevelPaint = swatches.children[0].material.clone();
  bevelPaint.normalMap = createWorkshopBevelNormalTexture({ quality, maxAnisotropy });
  bevelPaint.normalScale.set(0.5, 0.5);
  const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), bevelPaint);
  bevel.name = 'beveled-steel-normal-calibration';
  bevel.position.set(7 * 1.1, 0.4, 0);
  swatches.add(bevel);
  swatches.position.x = -3.85;
  scene.add(swatches);
  drone = new THREE.Group();
  drone.scale.setScalar(4);
  drone.position.set(0, 1.3, 0.2);
  scene.add(drone);
  buildDroneVisual({
    parent: drone,
    kind: 'utility',
    collectionId,
    quality,
    maxAnisotropy,
    material: (color, props) => new THREE.MeshStandardMaterial({ color, ...props }),
    mesh: (geometry, material, parent) => {
      const item = new THREE.Mesh(geometry, material);
      parent.add(item);
      return item;
    },
  });
  camera = new THREE.OrthographicCamera(-4.8, 4.8, 2.2, -1, 0.01, 30);
  camera.position.set(0, 4.5, 12);
  camera.lookAt(0, 0.6, 0);
}
function renderFlight(tick) {
  const moving = $('camera').value === 'fpv',
    state = {
      position: {
        ...selectedCourse.spawn,
        x: selectedCourse.spawn.x + (moving ? Math.sin(tick / 70) * 1800 : 0),
        y: selectedCourse.spawn.y + (moving ? 2000 : 1000),
        z: selectedCourse.spawn.z - (moving ? (tick % 180) * 25 : 0),
      },
      orientation: [0, 0, 0, 1000000],
      status: 'active',
      ticks: tick,
      step: 0,
      actors: selectedCourse.actors?.map((actor) => ({ ...actor, health: actor.health ?? 100 })),
      projectiles: [],
    };
  const before = performance.now();
  flight.draw(state, { cameraMode: $('camera').value });
  return performance.now() - before;
}
function draw() {
  if (disposed) return;
  frame = requestAnimationFrame(draw);
  if (!comparing) renderFlight(step++);
  const width = $('materials').clientWidth,
    height = $('materials').clientHeight;
  materialRenderer.setSize(width, height, false);
  const vertical = Math.max(2.1, (9.6 * height) / width);
  camera.top = 0.6 + vertical / 2;
  camera.bottom = 0.6 - vertical / 2;
  camera.updateProjectionMatrix();
  drone.rotation.y = Math.sin(step / 180) * 0.4;
  materialRenderer.render(scene, camera);
  if (step < 2 || step % 30 === 0) {
    const stats = flight.resources();
    $('scene-stats').textContent =
      `${stats.presentation.profileId} · ${stats.renderer.calls} draw calls · ${stats.renderer.triangles} triangles · ${stats.renderer.textures} textures`;
  }
}
async function compare() {
  if (comparing) return;
  comparing = true;
  $('compare').disabled = true;
  for (const id of ['collection', 'environment', 'course', 'camera', 'quality'])
    $(id).disabled = true;
  $('comparison').textContent = 'Rendering the same 120-frame view for each collection…';
  const results = [];
  try {
    for (const collectionId of [
      'authored',
      $('collection').value === 'authored' ? 'industrial-workshop' : $('collection').value,
    ]) {
      installScene(collectionId);
      for (let warm = 0; warm < 30; warm++) {
        renderFlight(warm);
        await new Promise(requestAnimationFrame);
      }
      const timings = [];
      let calls = 0,
        triangles = 0;
      for (let tick = 0; tick < 120; tick++) {
        timings.push(renderFlight(tick));
        const stats = flight.resources().renderer;
        calls += stats.calls;
        triangles += stats.triangles;
        await new Promise(requestAnimationFrame);
      }
      timings.sort((a, b) => a - b);
      results.push({
        collectionId,
        frames: 120,
        meanDrawCalls: Math.round(calls / 120),
        meanTriangles: Math.round(triangles / 120),
        medianCpuRenderMs: Number(timings[60].toFixed(2)),
        p95CpuRenderMs: Number(timings[114].toFixed(2)),
        textures: flight.resources().renderer.textures,
      });
    }
    $('comparison').textContent = JSON.stringify(
      {
        environment: selectedCourse.environment,
        course: selectedCourse.id,
        camera: $('camera').value,
        quality: $('quality').value,
        note: 'Browser CPU render timings only; this does not measure GPU time or gameplay performance.',
        results,
      },
      null,
      2,
    );
  } finally {
    comparing = false;
    $('compare').disabled = false;
    for (const id of ['collection', 'environment', 'course', 'camera', 'quality'])
      $(id).disabled = false;
    installScene();
  }
}

/** Authoring diagnostics do not expose the renderer or mutate player state. */
export function calibrationResources() {
  return {
    candidate: candidate
      ? {
          source: { ...candidate.source },
          familyId: candidate.family.id,
          interfaceId: candidate.interfaceTheme.id,
          identity: candidatePresentation.identity,
          sim: candidate.simDependency
            ? {
                collectionId: candidate.simDependency.collection.id,
                revision: candidate.simDependency.collection.revision,
              }
            : null,
        }
      : null,
    flight: flight.resources(),
    specimen: {
      geometries: materialRenderer.info.memory.geometries,
      textures: materialRenderer.info.memory.textures,
      programs: materialRenderer.info.programs?.length ?? 0,
    },
  };
}

export async function measureCalibrationFrames({ warmup = 60, samples = 240 } = {}) {
  if (comparing) throw new Error('A calibration measurement is already running.');
  if (
    !Number.isInteger(warmup) ||
    warmup < 1 ||
    warmup > 600 ||
    !Number.isInteger(samples) ||
    samples < 60 ||
    samples > 1200
  )
    throw new TypeError('Calibration frame count is outside the bounded diagnostic range.');
  comparing = true;
  const controls = [
    'compare',
    'collection',
    'environment',
    'course',
    'camera',
    'quality',
    'specimen',
  ];
  for (const id of controls) $(id).disabled = true;
  const nextFrame = () => new Promise(requestAnimationFrame),
    intervals = [];
  try {
    for (let tick = 0; tick < warmup; tick++) {
      renderFlight(tick);
      await nextFrame();
    }
    let previous = await nextFrame();
    for (let tick = 0; tick < samples; tick++) {
      renderFlight(tick);
      const timestamp = await nextFrame();
      intervals.push(timestamp - previous);
      previous = timestamp;
    }
    const ordered = [...intervals].sort((a, b) => a - b),
      rounded = (value) => Number(value.toFixed(3));
    return {
      environment: selectedCourse.environment,
      course: selectedCourse.id,
      camera: $('camera').value,
      quality: $('quality').value,
      collectionId: flight.resources().presentation.collectionId,
      warmup,
      samples,
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      medianFrameMs: rounded(ordered[Math.floor(samples * 0.5)]),
      p95FrameMs: rounded(ordered[Math.floor(samples * 0.95)]),
      p99FrameMs: rounded(ordered[Math.floor(samples * 0.99)]),
      maxFrameMs: rounded(ordered.at(-1)),
      framesOver25Ms: intervals.filter((value) => value > 25).length,
      resources: calibrationResources(),
      note: 'Complete requestAnimationFrame intervals include the flight scene and specimen preview; not GPU timestamps or physical-device certification.',
    };
  } finally {
    comparing = false;
    for (const id of controls) $(id).disabled = false;
  }
}
for (const id of ['collection', 'environment', 'course', 'camera', 'quality'])
  $(id).addEventListener('change', () => {
    if (!comparing) {
      if (id === 'environment') listCourses();
      installScene();
    }
  });
$('quality').addEventListener('change', specimen);
$('specimen').addEventListener('change', specimen);
$('compare').addEventListener('click', compare);
if (!flight.available) throw new Error('This calibration requires WebGL 2.');
listCourses();
installScene();
specimen();
draw();
window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    restoreInterface();
    cancelAnimationFrame(frame);
    flight.dispose();
    disposeSimVisualGroup(scene);
    materialRenderer.dispose();
    materialRenderer.forceContextLoss();
  },
  { once: true },
);
