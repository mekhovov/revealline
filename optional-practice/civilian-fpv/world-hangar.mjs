import * as THREE from './vendor/three.module.js';
import { buildDroneVisual, createEnvironmentLight, setSurfaceQuality } from './world-visuals.mjs';

/** A close inspection view. Appearance selections never modify flight physics. */
export function mountDroneHangar({
  button,
  dialog,
  canvas,
  selector,
  onOpen = () => {},
  window: win = globalThis.window,
} = {}) {
  let renderer = null,
    scene = null,
    camera = null,
    drone = null,
    environment = null,
    frame = 0,
    disposed = false,
    drag = null,
    angle = 2.6,
    elevation = 0.35,
    distance = 0.7;
  const listeners = [];
  const on = (node, type, fn) => {
    node.addEventListener(type, fn);
    listeners.push(() => node.removeEventListener(type, fn));
  };
  const disposeScene = () => {
    if (!scene) return;
    const geometry = new Set(),
      materials = new Set(),
      textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometry.add(object.geometry);
      for (const item of Array.isArray(object.material) ? object.material : [object.material])
        if (item) materials.add(item);
    });
    for (const g of geometry) g.dispose();
    for (const m of materials) {
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      m.dispose();
    }
    for (const texture of textures) texture.dispose();
    scene.environment = null;
    environment?.dispose();
    environment = null;
    scene.clear();
    drone = null;
    camera = null;
    scene = null;
  };
  function build() {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, win.devicePixelRatio ?? 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    }
    disposeScene();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14292f);
    environment = createEnvironmentLight(renderer, {
      sky: 0x9baebb,
      ground: 0x253a3d,
      indoor: true,
    });
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.75;
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
    scene.add(new THREE.HemisphereLight(0xe1faff, 0x394346, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 4);
    key.position.set(-1, 2, -2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8be1c4, 3);
    rim.position.set(1, 0, 1);
    scene.add(rim);
    drone = new THREE.Group();
    scene.add(drone);
    const material = (color, props = {}) => new THREE.MeshStandardMaterial({ color, ...props });
    const mesh = (geometry, paint, parent = drone) => {
      const object = new THREE.Mesh(geometry, paint);
      parent.add(object);
      return object;
    };
    buildDroneVisual({ parent: drone, mesh, material, kind: selector.value, quality: 'high' });
    const paints = new Set();
    drone.traverse((item) => {
      if (item.material) paints.add(item.material);
    });
    setSurfaceQuality(paints, 'high', renderer.capabilities.getMaxAnisotropy());
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.025, 64),
      material(0x2c4349, { metalness: 0.4, roughness: 0.4 }),
    );
    pad.position.y = -0.065;
    scene.add(pad);
  }
  function draw() {
    if (disposed || !dialog.open) return;
    frame = win.requestAnimationFrame(draw);
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(
      Math.sin(angle) * distance,
      Math.sin(elevation) * distance,
      Math.cos(angle) * distance,
    );
    camera.lookAt(0, 0.03, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function open() {
    if (disposed || dialog.open) return;
    onOpen();
    angle = 2.6;
    elevation = 0.35;
    distance = 0.7;
    build();
    dialog.showModal();
    draw();
  }
  function close() {
    dialog.close();
    win.cancelAnimationFrame(frame);
    disposeScene();
    // Reuse this canvas's context between inspections. A forcibly lost WebGL
    // context cannot be replaced by constructing another renderer on it.
    renderer?.renderLists.dispose();
    scene = null;
  }
  on(button, 'click', open);
  on(dialog.querySelector('[data-close-hangar]'), 'click', close);
  on(dialog, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  on(canvas, 'pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  on(canvas, 'pointermove', (event) => {
    if (!drag) return;
    angle -= (event.clientX - drag.x) * 0.009;
    elevation = Math.max(0.02, Math.min(1.25, elevation + (event.clientY - drag.y) * 0.007));
    drag = { x: event.clientX, y: event.clientY };
  });
  on(canvas, 'pointerup', () => {
    drag = null;
  });
  on(canvas, 'pointercancel', () => {
    drag = null;
  });
  on(canvas, 'wheel', (event) => {
    event.preventDefault();
    distance = Math.max(0.36, Math.min(1.3, distance + event.deltaY * 0.0006));
  });
  return {
    open,
    close,
    dispose() {
      disposed = true;
      win.cancelAnimationFrame(frame);
      for (const remove of listeners) remove();
      disposeScene();
      renderer?.dispose();
      renderer?.forceContextLoss();
    },
  };
}
