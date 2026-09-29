import * as THREE from './vendor/three.module.js';

/** Presentation only: metres for rendering, exact millimetres/quaternion from the
 * fixed-step model. Light gates are criteria, never invented physical obstacles. */
export function createFlightRenderer({
  canvas,
  window: win = globalThis.window,
  onContextLost = () => {},
  reducedMotion = false,
}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return { available: false, resources: () => ({ available: false }), dispose() {} };
  }
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(82, 1, 0.05, 250),
    world = new THREE.Group(),
    goals = new THREE.Group(),
    aircraft = new THREE.Group();
  scene.add(world, goals, aircraft);
  const hemisphere = new THREE.HemisphereLight(0xd9f5ff, 0x304750, 2.1),
    sunlight = new THREE.DirectionalLight(0xfff5db, 2.3);
  sunlight.position.set(-12, 30, 8);
  scene.add(hemisphere, sunlight);
  let course = null,
    mode = 'self-level',
    view = 'fpv',
    fov = 82,
    tilt = 10,
    currentStep = -1,
    disposed = false,
    lastWidth = 0,
    lastHeight = 0;
  let pathLine = null;
  const materials = new Set(),
    geometry = new Set(),
    goalRows = [],
    rotors = [];
  const material = (color, extras = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
    materials.add(value);
    return value;
  };
  const mesh = (shape, paint, parent = world) => {
    geometry.add(shape);
    const value = new THREE.Mesh(shape, paint);
    parent.add(value);
    return value;
  };
  const box = (size, at, color, parent = world) => {
    const value = mesh(new THREE.BoxGeometry(...size), material(color), parent);
    value.position.set(...at);
    return value;
  };
  const releaseGroup = (group) => {
    while (group.children.length) {
      const child = group.children[0];
      child.traverse((item) => {
        if (item.geometry) {
          item.geometry.dispose();
          geometry.delete(item.geometry);
        }
        const list = Array.isArray(item.material) ? item.material : [item.material];
        for (const entry of list)
          if (entry) {
            entry.map?.dispose();
            entry.dispose();
            materials.delete(entry);
          }
      });
      group.remove(child);
    }
  };
  const wallSign = (letter, at, rotation, color) => {
    const surface = canvas.ownerDocument.createElement('canvas');
    surface.width = 128;
    surface.height = 128;
    const context = surface.getContext('2d');
    if (!context) return;
    context.fillStyle = color;
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = '#112934';
    context.font = 'bold 92px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, 64, 70);
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    const panel = mesh(new THREE.PlaneGeometry(2, 2), material(0xffffff, { map: texture }));
    panel.position.set(...at);
    panel.rotation.y = rotation;
  };
  // Fictional training marker, not a parts or construction drawing.
  box([0.28, 0.08, 0.18], [0, 0, 0], 0x18384b, aircraft);
  for (const x of [-0.22, 0.22])
    for (const z of [-0.2, 0.2]) {
      const arm = box([0.025, 0.025, 0.32], [x / 2, 0, z / 2], 0x536f7a, aircraft);
      arm.rotation.y = Math.atan2(x, z);
      const rotor = mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.014, 16),
        material(0xdff978, { transparent: true, opacity: 0.75 }),
        aircraft,
      );
      rotor.position.set(x, 0.035, z);
      rotors.push(rotor);
    }
  box([0.06, 0.045, 0.04], [0, 0.01, -0.11], 0x7de2fd, aircraft);
  function lineVolume(step, index) {
    const group = new THREE.Group();
    goals.add(group);
    let size, position;
    if (step.type === 'gate') {
      const span = (step.maxSide - step.minSide) / 1000,
        height = (step.maxY - step.minY) / 1000;
      size = step.axis === 'z' ? [span, height, 0.08] : [0.08, height, span];
      position =
        step.axis === 'z'
          ? [(step.minSide + step.maxSide) / 2000, (step.minY + step.maxY) / 2000, step.at / 1000]
          : [step.at / 1000, (step.minY + step.maxY) / 2000, (step.minSide + step.maxSide) / 2000];
    } else {
      size = ['x', 'y', 'z'].map((key) => Math.max(0.06, (step.max[key] - step.min[key]) / 1000));
      position = ['x', 'y', 'z'].map((key) => (step.min[key] + step.max[key]) / 2000);
    }
    const shape = new THREE.BoxGeometry(...size),
      edges = new THREE.EdgesGeometry(shape);
    shape.dispose();
    geometry.add(edges);
    const paint = new THREE.LineBasicMaterial({ color: 0x8beafc, transparent: true, opacity: 0.3 });
    materials.add(paint);
    const outline = new THREE.LineSegments(edges, paint);
    group.add(outline);
    group.position.set(...position);
    const marker = mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.025, 20),
      material(0xdff978),
      group,
    );
    marker.position.y = -position[1] + 0.04;
    goalRows.push({ group, paint, marker, index });
    if (step.type === 'gate') {
      const direction = new THREE.Vector3(
        step.axis === 'x' ? step.direction : 0,
        0,
        step.axis === 'z' ? step.direction : 0,
      );
      const arrow = new THREE.ArrowHelper(
        direction,
        new THREE.Vector3(0, -position[1] + 0.08, 0).addScaledVector(direction, -1.4),
        1.1,
        0xdff978,
        0.35,
        0.22,
      );
      group.add(arrow);
      arrow.traverse((child) => {
        if (child.geometry) geometry.add(child.geometry);
        if (child.material) materials.add(child.material);
      });
    }
  }
  function setCourse(value, selectedMode) {
    course = value;
    mode = selectedMode;
    currentStep = -1;
    releaseGroup(world);
    releaseGroup(goals);
    goalRows.length = 0;
    const field = course.environment === 'field';
    scene.background = new THREE.Color(field ? 0xb6d9de : 0x142c3e);
    scene.fog = new THREE.Fog(scene.background, field ? 65 : 48, 180);
    const width = (course.bounds.max.x - course.bounds.min.x) / 1000,
      depth = (course.bounds.max.z - course.bounds.min.z) / 1000;
    const cx = (course.bounds.max.x + course.bounds.min.x) / 2000,
      cz = (course.bounds.max.z + course.bounds.min.z) / 2000;
    box(
      [field ? 200 : width + 2, 0.2, field ? 200 : depth + 2],
      [cx, -0.12, cz],
      field ? 0x527c68 : 0x304956,
    );
    const grid = new THREE.GridHelper(
      Math.max(width, depth),
      Math.ceil(Math.max(width, depth)),
      0x88a9a1,
      field ? 0x698e7b : 0x3e5d66,
    );
    grid.position.set(cx, 0.003, cz);
    world.add(grid);
    geometry.add(grid.geometry);
    materials.add(grid.material);
    const pad = mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.025, 48), material(0xe2edb5));
    pad.position.set(course.spawn.x / 1000, 0.02, course.spawn.z / 1000);
    const ring = mesh(new THREE.TorusGeometry(1.15, 0.07, 8, 48), material(0x254b50));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pad.position);
    ring.position.y += 0.025;
    if (!field) {
      const height = course.bounds.max.y / 1000;
      for (const x of [course.bounds.min.x / 1000 - 0.15, course.bounds.max.x / 1000 + 0.15])
        box([0.3, height, depth + 0.6], [x, height / 2, cz], 0x1e394c);
      for (const z of [course.bounds.min.z / 1000 - 0.15, course.bounds.max.z / 1000 + 0.15])
        box([width, height, 0.3], [cx, height / 2, z], 0x25465a);
      for (let x = -18; x <= 18; x += 6) box([0.24, 0.18, depth], [x, height - 0.15, cz], 0x557b87);
      for (let z = -18; z <= 18; z += 9)
        box([width - 2, 0.04, 0.12], [cx, height - 0.5, z], 0xd1f9ed);
      // Flat wall graphics provide orientation; they add no flight obstacles.
      const north = course.bounds.min.z / 1000 + 0.012,
        south = course.bounds.max.z / 1000 - 0.012,
        west = course.bounds.min.x / 1000 + 0.012,
        east = course.bounds.max.x / 1000 - 0.012;
      for (const [z, color] of [
        [north, 0x85d9d2],
        [south, 0xe6ad73],
      ]) {
        box([width, 0.45, 0.012], [cx, 1.6, z], color);
        box([width, 0.12, 0.012], [cx, 2.02, z], 0xf0ead2);
        for (const fraction of [-0.32, 0.32]) {
          box([width * 0.18, 2.4, 0.014], [cx + width * fraction, height * 0.62, z], 0xa7dadd);
          box([0.08, 2.4, 0.02], [cx + width * fraction, height * 0.62, z], 0x294c5c);
        }
      }
      for (const [x, color] of [
        [west, 0xc7b6ec],
        [east, 0xcddd83],
      ])
        box([0.012, 0.45, depth], [x, 1.6, cz], color);
      wallSign('N', [cx, 3.8, north + 0.012], 0, '#85d9d2');
      wallSign('S', [cx, 3.8, south - 0.012], Math.PI, '#e6ad73');
      wallSign('W', [west + 0.012, 3.8, cz], Math.PI / 2, '#c7b6ec');
      wallSign('E', [east - 0.012, 3.8, cz], -Math.PI / 2, '#cddd83');
    } else {
      // Scenery sits outside the playable bounds; it is not a hidden collision.
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2,
          radius = 48 + (i % 3) * 6,
          height = 6 + (i % 4);
        const tree = mesh(
          new THREE.ConeGeometry(2.4, height, 7),
          material(i % 2 ? 0x31584f : 0x3a6554),
        );
        tree.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      }
      for (const z of [course.bounds.min.z / 1000, course.bounds.max.z / 1000])
        box([width, 0.05, 0.07], [cx, 0.05, z], 0xd5e5b9);
      for (const x of [course.bounds.min.x / 1000, course.bounds.max.x / 1000])
        box([0.07, 0.05, depth], [x, 0.05, cz], 0xd5e5b9);
    }
    for (const obstacle of course.obstacles)
      box(
        ['x', 'y', 'z'].map((key) => (obstacle.max[key] - obstacle.min[key]) / 1000),
        ['x', 'y', 'z'].map((key) => (obstacle.max[key] + obstacle.min[key]) / 2000),
        0xe2a263,
      );
    course.steps[mode].forEach(lineVolume);
  }
  function draw(state, { cameraMode = view, cameraFov = fov, cameraTilt = tilt } = {}) {
    if (disposed || !course) return;
    view = cameraMode;
    fov = cameraFov;
    tilt = cameraTilt;
    const rect = canvas.getBoundingClientRect(),
      width = Math.max(1, Math.round(rect.width)),
      height = Math.max(1, Math.round(rect.height));
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      lastWidth = width;
      lastHeight = height;
    }
    camera.fov = fov;
    camera.updateProjectionMatrix();
    const position = new THREE.Vector3(
        state.position.x / 1000,
        state.position.y / 1000 + 0.22,
        state.position.z / 1000,
      ),
      rotation = new THREE.Quaternion(
        ...state.orientation.map((value) => value / 1000000),
      ).normalize();
    aircraft.position.copy(position);
    aircraft.quaternion.copy(rotation);
    aircraft.visible = view !== 'fpv';
    if (!reducedMotion && state.status === 'active')
      for (const rotor of rotors) rotor.rotation.y = state.ticks * 0.5;
    if (view === 'fpv') {
      camera.position.copy(position);
      camera.quaternion
        .copy(rotation)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            (tilt * Math.PI) / 180,
          ),
        );
    } else if (view === 'chase') {
      camera.position.copy(position).add(new THREE.Vector3(0, 1.8, 4).applyQuaternion(rotation));
      camera.up.set(0, 1, 0);
      camera.lookAt(position);
    } else {
      camera.position.set(21, 33, 25);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, -2);
    }
    if (currentStep !== state.step) {
      currentStep = state.step;
      for (const row of goalRows) {
        row.paint.color.setHex(
          row.index < state.step ? 0x95aa9e : row.index === state.step ? 0xe4ff8a : 0x7fa9b4,
        );
        row.paint.opacity = row.index === state.step ? 1 : 0.25;
        row.marker.visible = row.index === state.step;
      }
    }
    if (pathLine) pathLine.visible = view !== 'fpv';
    renderer.render(scene, camera);
  }
  const lost = (event) => {
    event.preventDefault();
    onContextLost();
  };
  canvas.addEventListener('webglcontextlost', lost);
  return {
    available: true,
    setCourse,
    setCosmetic(recipe) {
      // Only the registered local recipe reaches here; colour remains cosmetic.
      if (!/^#[a-fA-F0-9]{6}$/.test(recipe?.color)) return;
      for (const rotor of rotors) rotor.material.color.set(recipe.color);
    },
    setPath(samples) {
      if (pathLine) {
        scene.remove(pathLine);
        pathLine.geometry.dispose();
        pathLine.material.dispose();
        pathLine = null;
      }
      if (samples.length < 2) return;
      const points = samples.map(
        (sample) =>
          new THREE.Vector3(
            sample.position.x / 1000,
            sample.position.y / 1000 + 0.22,
            sample.position.z / 1000,
          ),
      );
      pathLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x95e9ef, transparent: true, opacity: 0.5 }),
      );
      scene.add(pathLine);
    },
    draw,
    resources() {
      return {
        available: true,
        disposed,
        registered: {
          geometries: geometry.size + (pathLine ? 1 : 0),
          materials: materials.size + (pathLine ? 1 : 0),
          textures: new Set([...materials].map((item) => item.map).filter(Boolean)).size,
        },
        renderer: {
          // Three's module-owned DFG LUT may remain in its bookkeeping after
          // disposal. These counters are observations, not live GPU-byte proof.
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          contextLost: renderer.getContext().isContextLost(),
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('webglcontextlost', lost);
      if (pathLine) {
        pathLine.geometry.dispose();
        pathLine.material.dispose();
        pathLine = null;
      }
      for (const value of geometry) value.dispose();
      for (const value of materials) {
        value.map?.dispose();
        value.dispose();
      }
      geometry.clear();
      materials.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
