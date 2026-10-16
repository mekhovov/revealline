import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { installThemeHost } from '../../../game/presentation/theme-host.mjs';
import { createMarkingLoader, requireMarkingColorTexture } from './loader.mjs';

const $ = (id) => document.getElementById(id);
const host = installThemeHost({ document });
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x252a2c);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 80);
scene.add(new THREE.HemisphereLight(0xffffff, 0x454c50, 2));
const key = new THREE.DirectionalLight(0xffffff, 2.5);
key.position.set(2, 6, 4);
scene.add(key);
const grid = new THREE.GridHelper(12, 24, 0x6b787d, 0x394246);
grid.position.y = -0.015;
scene.add(grid);
let model,
  frame,
  disposed = false;
const replacements = new Map();
const views = {
  whole: [
    [7, 5, 9],
    [0, 1, 0],
  ],
  gate: [
    [-2.6, 1.4, 5],
    [-2.6, 1.4, 0],
  ],
  gateDetail: [
    [-4.505, 2.59, 0.8],
    [-4.505, 2.59, 0],
  ],
  pad: [
    [2, 4, 0.01],
    [2, 0, 0],
  ],
  grazing: [
    [2, 0.25, 3],
    [2, 0, 0],
  ],
  swatch: [
    [-0.5, 0.05, 4],
    [-0.5, 0.05, 1.5],
  ],
};
function view() {
  const [eye, target] = views[$('view').value];
  camera.position.set(...eye);
  camera.lookAt(...target);
}
function presentation() {
  if (!model) return;
  model.traverse((node) => {
    if (!node.isMesh) return;
    if (!replacements.has(node.material)) return;
    const pair = replacements.get(node.material);
    node.material = $('unlit').checked ? pair.unlit : pair.pbr;
    node.material.wireframe = $('wire').checked;
  });
}
$('view').addEventListener('change', view);
$('wire').addEventListener('change', presentation);
$('unlit').addEventListener('change', presentation);
const reference = new THREE.Group();
for (const [index, srgb] of [0, 64, 118, 192, 255].entries()) {
  const color = new THREE.Color().setRGB(srgb / 255, srgb / 255, srgb / 255, THREE.SRGBColorSpace);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.16),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
  mesh.position.set(-1.14 + index * 0.32, -0.15, 1.5);
  reference.add(mesh);
}
scene.add(reference);
const sha = async (bytes) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
async function load() {
  const manifest = await (await fetch('./r1/manifest.json', { cache: 'no-store' })).json();
  const descriptor = manifest.files.find((row) => row.path === 'markings.glb');
  const response = await fetch('./r1/markings.glb', { cache: 'no-store' });
  if (!response.ok) throw Error('GLB unavailable.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== descriptor.bytes || (await sha(bytes)) !== descriptor.sha256)
    throw Error('GLB differs from its source receipt.');
  const gltf = await createMarkingLoader().parseAsync(
    bytes,
    new URL('./r1/', import.meta.url).href,
  );
  if (disposed) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    gltf.scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      for (const paint of [node.material].flat().filter(Boolean)) {
        materials.add(paint);
        if (paint.map) textures.add(paint.map);
      }
    });
    for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
    return;
  }
  model = gltf.scene;
  const materials = new Set();
  model.traverse((node) => {
    if (node.isMesh) materials.add(node.material);
  });
  for (const pbr of materials) {
    requireMarkingColorTexture(pbr);
    pbr.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const unlit = new THREE.MeshBasicMaterial({
      map: pbr.map,
      alphaTest: pbr.alphaTest,
      side: pbr.side,
      toneMapped: false,
    });
    const pair = { pbr, unlit };
    replacements.set(pbr, pair);
    replacements.set(unlit, pair);
  }
  scene.add(model);
  const { aperture, translation } = manifest.geometry.roles.gate;
  const half = aperture.width / 2;
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-half, 0, -0.004),
      new THREE.Vector3(half, 0, -0.004),
      new THREE.Vector3(half, aperture.height, -0.004),
      new THREE.Vector3(-half, aperture.height, -0.004),
    ]),
    new THREE.LineBasicMaterial({ color: 0x758489, toneMapped: false }),
  );
  outline.position.set(...translation);
  scene.add(outline);
  const referencePad = new THREE.Mesh(
    new THREE.CylinderGeometry(
      manifest.geometry.roles['landing-pad'].hostRadius,
      manifest.geometry.roles['landing-pad'].hostRadius,
      0.016,
      64,
    ),
    new THREE.MeshStandardMaterial({ color: 0x596569, roughness: 0.86, metalness: 0 }),
  );
  referencePad.position.set(...manifest.geometry.roles['landing-pad'].translation);
  referencePad.position.y -= 0.008;
  scene.add(referencePad);
  presentation();
  $('status').textContent =
    `Verified ${manifest.id}@${manifest.revision}. Khronos: ${manifest.validation.issues.numErrors} errors, ${manifest.validation.issues.numWarnings} warnings. Runtime GLTFLoader decoded the model and its embedded PNG.`;
  $('facts').textContent = JSON.stringify(
    {
      source: manifest.source,
      files: manifest.files,
      geometry: manifest.geometry,
      color: manifest.color,
      renderer: {
        implementation: 'same pinned Three GLTFLoader as the game',
        imageDecoder: 'Three TextureLoader image element; existing img-src policy',
        threeRevision: THREE.REVISION,
        output: 'sRGB',
        toneMapping: 'ACESFilmic / 1.08',
        review: 'visual review pending',
      },
    },
    null,
    2,
  );
}
function render() {
  if (disposed) return;
  const canvas = $('scene'),
    width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (
    canvas.width !== Math.round(width * renderer.getPixelRatio()) ||
    canvas.height !== Math.round(height * renderer.getPixelRatio())
  ) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  if (!document.hidden) renderer.render(scene, camera);
  frame = requestAnimationFrame(render);
}
view();
render();
load().catch((error) => {
  $('status').textContent = error.message;
});
window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    cancelAnimationFrame(frame);
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      for (const material of [node.material].flat().filter(Boolean)) {
        materials.add(material);
        if (material.map) textures.add(material.map);
      }
    });
    for (const { pbr, unlit } of replacements.values()) {
      materials.add(pbr);
      materials.add(unlit);
      if (pbr.map) textures.add(pbr.map);
    }
    for (const item of [...geometries, ...materials, ...textures]) item.dispose();
    renderer.dispose();
    host.dispose();
  },
  { once: true },
);
