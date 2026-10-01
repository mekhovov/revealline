import * as THREE from './vendor/three.module.js';
import { buildWorldVisuals, buildDroneVisual, themeForCourse } from './world-visuals.mjs';

const QUALITIES = Object.freeze({
  low: { ratio: 1, shadows: false, shadowSize: 512 },
  balanced: { ratio: 1.5, shadows: true, shadowSize: 1024 },
  high: { ratio: 2, shadows: true, shadowSize: 2048 },
});
const MAP_LIMIT = 16 * 1024 * 1024;
const safePath = (value) =>
  typeof value === 'string' &&
  value.length <= 240 &&
  !/^(?:[a-z]+:|\/|\\)/i.test(value) &&
  !value.split(/[\\/]/).includes('..');

/** Presentation only. All world/actor positions are canonical millimetres.
 * Decorative structures remain outside the course; criteria are holograms. */
export function createFlightRenderer({
  canvas,
  window: win = globalThis.window,
  onContextLost = () => {},
  reducedMotion = false,
  loadGLTF = null,
  loadTransformControls = null,
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(82, 1, 0.035, 300);
  const world = new THREE.Group(),
    goals = new THREE.Group(),
    aircraft = new THREE.Group(),
    actors = new THREE.Group(),
    projectiles = new THREE.Group(),
    imported = new THREE.Group(),
    editHandles = new THREE.Group();
  editHandles.visible = false;
  scene.add(world, goals, aircraft, actors, projectiles, imported, editHandles);
  const hemisphere = new THREE.HemisphereLight(0xe5f3ff, 0x3d504a, 2.1);
  const sunlight = new THREE.DirectionalLight(0xffefd8, 3.1);
  sunlight.position.set(-24, 36, 15);
  sunlight.castShadow = true;
  sunlight.shadow.bias = -0.0002;
  sunlight.shadow.normalBias = 0.04;
  sunlight.shadow.camera.near = 0.1;
  sunlight.shadow.camera.far = 160;
  scene.add(hemisphere, sunlight, sunlight.target);
  let course = null,
    mode = 'self-level',
    view = 'fpv',
    fov = 82,
    tilt = 10,
    quality = 'balanced',
    droneKind = 'racer',
    currentStep = -1,
    disposed = false,
    lastWidth = 0,
    lastHeight = 0,
    pathLine = null,
    droneVisual = null,
    sceneGeneration = 0,
    importGeneration = 0,
    importedMixer = null,
    importedClips = [],
    obstacleMap = null,
    themeProfile = null,
    sceneryFallback = null,
    editor = null,
    editorListener = null,
    editorCallbacks = null,
    editorSelection = null,
    editorDragListener = null;
  const editorCamera = { yaw: 0.65, pitch: 0.72, distance: null };
  const editRows = [],
    raycaster = new THREE.Raycaster();
  const materials = new Set(),
    geometry = new Set(),
    goalRows = [],
    actorRows = new Map(),
    pulseRows = new Map();
  const texturesOf = (paint) => Object.values(paint ?? {}).filter((value) => value?.isTexture);
  const register = (root) =>
    root.traverse((item) => {
      if (item.geometry) geometry.add(item.geometry);
      for (const paint of Array.isArray(item.material) ? item.material : [item.material])
        if (paint) materials.add(paint);
    });
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
  function releaseGroup(group) {
    const shapes = new Set(),
      paints = new Set(),
      textures = new Set(),
      skeletons = new Set();
    const roots = [group, ...(group.userData.auxiliaryRoots ?? [])];
    for (const root of roots)
      root.traverse((item) => {
        if (item.geometry) shapes.add(item.geometry);
        if (item.skeleton) skeletons.add(item.skeleton);
        for (const paint of [
          ...(Array.isArray(item.material) ? item.material : [item.material]),
          ...(item.userData?.ownedMaterials ?? []),
        ])
          if (paint) {
            paints.add(paint);
            for (const texture of texturesOf(paint)) textures.add(texture);
          }
      });
    for (const value of textures) {
      value.source?.data?.close?.();
      value.dispose();
    }
    for (const value of skeletons) value.dispose();
    for (const value of shapes) {
      value.dispose();
      geometry.delete(value);
    }
    for (const value of paints) {
      value.dispose();
      materials.delete(value);
    }
    group.userData.auxiliaryRoots = [];
    group.clear();
  }
  function clearImported() {
    if (sceneryFallback) sceneryFallback.visible = true;
    if (importedMixer) {
      importedMixer.stopAllAction();
      importedMixer.uncacheRoot(importedMixer.getRoot());
      importedMixer = null;
    }
    importedClips = [];
    releaseGroup(imported);
  }
  function releaseShadow() {
    for (const key of ['map', 'mapPass']) {
      const target = sunlight.shadow[key];
      if (!target) continue;
      target.depthTexture?.dispose();
      target.depthTexture = null;
      target.dispose();
      sunlight.shadow[key] = null;
    }
  }
  function label(text, color, parent, size = 0.8) {
    const surface = canvas.ownerDocument.createElement('canvas');
    surface.width = 128;
    surface.height = 128;
    const context = surface.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#132b39';
    context.beginPath();
    context.arc(64, 64, 59, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = color;
    context.stroke();
    context.fillStyle = '#f1f9e8';
    context.font = `700 ${text.length > 2 ? 32 : 66}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 68);
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    const paint = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    materials.add(paint);
    const sprite = new THREE.Sprite(paint);
    sprite.scale.set(size, size, 1);
    parent.add(sprite);
    return sprite;
  }
  function setQuality(value) {
    if (!QUALITIES[value]) throw new TypeError('Unknown flight quality');
    quality = value;
    const selected = QUALITIES[value];
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, selected.ratio));
    renderer.shadowMap.enabled = selected.shadows;
    sunlight.castShadow = selected.shadows;
    if (sunlight.shadow.mapSize.x !== selected.shadowSize) {
      releaseShadow();
      sunlight.shadow.mapSize.set(selected.shadowSize, selected.shadowSize);
    }
    renderer.shadowMap.needsUpdate = true;
    lastWidth = lastHeight = 0;
  }
  function setDrone(value) {
    if (!['racer', 'pixel', 'utility'].includes(value))
      throw new TypeError('Unknown drone appearance');
    droneKind = value;
    releaseGroup(aircraft);
    droneVisual = buildDroneVisual({ parent: aircraft, mesh, material, box, kind: value });
  }
  function lineVolume(step, index) {
    const group = new THREE.Group();
    goals.add(group);
    let size, position;
    if (step.type === 'gate') {
      const span = (step.maxSide - step.minSide) / 1000,
        height = (step.maxY - step.minY) / 1000;
      size = step.axis === 'z' ? [span, height, 0.035] : [0.035, height, span];
      position =
        step.axis === 'z'
          ? [(step.minSide + step.maxSide) / 2000, (step.minY + step.maxY) / 2000, step.at / 1000]
          : [step.at / 1000, (step.minY + step.maxY) / 2000, (step.minSide + step.maxSide) / 2000];
    } else if (step.min && step.max) {
      size = ['x', 'y', 'z'].map((key) => Math.max(0.06, (step.max[key] - step.min[key]) / 1000));
      position = ['x', 'y', 'z'].map((key) => (step.min[key] + step.max[key]) / 2000);
    } else return;
    const shape = new THREE.BoxGeometry(...size),
      edges = new THREE.EdgesGeometry(shape);
    shape.dispose();
    geometry.add(edges);
    const paint = new THREE.LineBasicMaterial({
      color: 0x8beafc,
      transparent: true,
      opacity: 0.3,
      toneMapped: false,
    });
    materials.add(paint);
    group.add(new THREE.LineSegments(edges, paint));
    group.position.set(...position);
    const light = material(0xa8e9dd, {
      emissive: 0x82e1d5,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    if (step.type === 'gate') {
      const horizontal = step.axis === 'z',
        span = horizontal ? size[0] : size[2];
      for (const side of [-1, 1]) {
        const upright = mesh(new THREE.BoxGeometry(0.045, size[1], 0.045), light, group);
        upright.position.set(
          horizontal ? (side * span) / 2 : 0,
          0,
          horizontal ? 0 : (side * span) / 2,
        );
        const lintel = mesh(
          new THREE.BoxGeometry(horizontal ? span : 0.045, 0.045, horizontal ? 0.045 : span),
          light,
          group,
        );
        lintel.position.y = (side * size[1]) / 2;
      }
    }
    const marker = mesh(new THREE.TorusGeometry(0.35, 0.045, 6, 24), light, group);
    marker.rotation.x = Math.PI / 2;
    marker.position.y = -position[1] + (step.type === 'land' ? step.min.y / 1000 : 0) + 0.05;
    const badge = label(String(index + 1).padStart(2, '0'), '#a5e7d4', group, 0.72);
    if (badge) badge.position.set(0, size[1] / 2 + 0.5, 0);
    const row = { group, paint, light, marker, badge, index };
    goalRows.push(row);
    if (step.type === 'gate') {
      const direction = new THREE.Vector3(
        step.axis === 'x' ? step.direction : 0,
        0,
        step.axis === 'z' ? step.direction : 0,
      );
      const arrow = new THREE.ArrowHelper(
        direction,
        new THREE.Vector3(0, -position[1] + 0.1, 0).addScaledVector(direction, -1.1),
        0.8,
        0xe8eab0,
        0.25,
        0.18,
      );
      group.add(arrow);
      register(arrow);
    }
  }
  function renderObstacle(obstacle, index) {
    const theme = themeForCourse(course),
      paint = material(index % 3 ? 0xffffff : 0xffe3b9, {
        map: obstacleMap,
        bumpMap: obstacleMap,
        bumpScale: 0.018,
        roughness: 0.78,
        metalness: course.environment === 'container-yard' ? 0.25 : 0.08,
      });
    let value;
    if (obstacle.type === 'trimesh') {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          obstacle.vertices.map((v) => v / 1000),
          3,
        ),
      );
      shape.setIndex(obstacle.indices);
      shape.computeVertexNormals();
      paint.side = THREE.DoubleSide;
      value = mesh(shape, paint);
    } else if (obstacle.min && obstacle.max) {
      value = mesh(
        new THREE.BoxGeometry(
          ...['x', 'y', 'z'].map((key) => (obstacle.max[key] - obstacle.min[key]) / 1000),
        ),
        paint,
      );
      value.position.set(
        ...['x', 'y', 'z'].map((key) => (obstacle.max[key] + obstacle.min[key]) / 2000),
      );
      if (obstacle.rotation) value.quaternion.fromArray(obstacle.rotation).normalize();
    } else {
      paint.dispose();
      materials.delete(paint);
      return;
    }
    value.name = obstacle.id;
    value.userData.collisionId = obstacle.id;
    value.castShadow = value.receiveShadow = true;
    const edges = new THREE.EdgesGeometry(value.geometry, 30);
    geometry.add(edges);
    const edgePaint = new THREE.LineBasicMaterial({
      color: theme.warm,
      transparent: true,
      opacity: 0.35,
    });
    materials.add(edgePaint);
    value.add(new THREE.LineSegments(edges, edgePaint));
  }
  function setCourse(value, selectedMode = 'self-level') {
    if (disposed) return;
    sceneGeneration++;
    editor?.detach();
    course = value;
    mode = selectedMode;
    currentStep = -1;
    clearImported();
    for (const group of [world, goals, actors, projectiles]) releaseGroup(group);
    goalRows.length = 0;
    actorRows.clear();
    pulseRows.clear();
    const surroundings = buildWorldVisuals({ course, world, mesh, material, box });
    const theme = surroundings.theme;
    themeProfile = surroundings.profile;
    sceneryFallback = surroundings.backdrop;
    obstacleMap = surroundings.obstacleMap;
    scene.background = new THREE.Color(surroundings.indoor ? theme.wall : theme.sky);
    scene.fog = new THREE.Fog(theme.fog, surroundings.indoor ? 55 : 85, 210);
    hemisphere.intensity = surroundings.indoor ? 2.5 : 2.1;
    sunlight.intensity = surroundings.indoor ? 2.0 : 3.1;
    const extent = Math.max(surroundings.width, surroundings.depth) / 2 + 5;
    Object.assign(sunlight.shadow.camera, {
      left: -extent,
      right: extent,
      top: extent,
      bottom: -extent,
    });
    sunlight.shadow.camera.updateProjectionMatrix();
    sunlight.target.position.set(surroundings.center[0], 0, surroundings.center[1]);
    sunlight.position.set(surroundings.center[0] - 24, 36, surroundings.center[1] + 15);
    for (const [letter, x, z] of [
      ['N', surroundings.center[0], course.bounds.min.z / 1000],
      ['S', surroundings.center[0], course.bounds.max.z / 1000],
      ['W', course.bounds.min.x / 1000, surroundings.center[1]],
      ['E', course.bounds.max.x / 1000, surroundings.center[1]],
    ]) {
      const sign = label(letter, '#b8dccc', world, 1.1);
      if (sign) sign.position.set(x, 3.5, z);
    }
    (course.obstacles ?? []).forEach(renderObstacle);
    (course.steps?.[mode] ?? []).forEach(lineVolume);
    if (editorCallbacks) refreshEditorHandles();
  }
  function createActor(actor) {
    const group = new THREE.Group();
    actors.add(group);
    const radius = (actor.radius ?? 300) / 1000,
      height = (actor.height ?? 1800) / 1000;
    const role = actor.type === 'hazard' ? 'hazard' : (actor.role ?? 'hostile');
    const friendly = role === 'rival' || role === 'civilian';
    const armor = material(
      friendly
        ? 0x74bfc0
        : themeProfile?.characters === 'arcade'
          ? 0xa785cb
          : themeProfile?.characters === 'civilian'
            ? 0x839c9d
            : 0x778b86,
      { metalness: 0.4, roughness: 0.5 },
    );
    const threat = material(friendly ? 0x77ebe0 : 0xf1ae75, {
      emissive: friendly ? 0x249eaa : 0xb86231,
      emissiveIntensity: 0.5,
    });
    const dark = material(0x283e47, { roughness: 0.65 });
    group.userData.ownedMaterials = [armor, threat, dark];
    const part = (shape, paint, at) => {
      const value = mesh(shape, paint, group);
      value.position.set(...at);
      value.castShadow = true;
      return value;
    };
    if (actor.type === 'drone') {
      const rig = new THREE.Group();
      group.add(rig);
      rig.position.y = radius;
      rig.scale.setScalar(radius / 0.22);
      const visual = buildDroneVisual({
        parent: rig,
        mesh,
        material,
        box,
        kind: role === 'rival' ? 'racer' : 'utility',
      });
      visual.tint.color.setHex(friendly ? 0x77ebe0 : 0xe6a16b);
    } else if (actor.type === 'vehicle') {
      part(new THREE.BoxGeometry(radius * 1.4, radius * 0.55, radius * 1.3), armor, [
        0,
        radius * 0.55,
        0,
      ]);
      part(new THREE.BoxGeometry(radius * 0.7, radius * 0.5, radius * 0.6), dark, [
        0,
        radius * 1.04,
        0,
      ]);
      for (const x of [-0.63, 0.63])
        for (const z of [-0.48, 0.48]) {
          const wheel = part(
            new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, radius * 0.22, 10),
            dark,
            [x * radius, radius * 0.26, z * radius],
          );
          wheel.rotation.z = Math.PI / 2;
        }
      part(
        new THREE.BoxGeometry(
          radius * (friendly ? 0.8 : 0.18),
          radius * 0.16,
          radius * (friendly ? 0.18 : 0.8),
        ),
        threat,
        [0, radius * 1.2, -radius * 0.48],
      );
    } else if (actor.type === 'hazard') {
      const orb = part(new THREE.IcosahedronGeometry(radius, 1), threat, [0, radius, 0]);
      orb.material.wireframe = true;
      const ring = part(new THREE.TorusGeometry(radius * 0.75, radius * 0.07, 6, 24), dark, [
        0,
        radius,
        0,
      ]);
      ring.rotation.x = Math.PI / 2;
    } else {
      part(new THREE.CapsuleGeometry(radius * 0.66, height * 0.25, 3, 8), armor, [
        0,
        height * 0.58,
        0,
      ]);
      part(
        themeProfile?.characters === 'arcade'
          ? new THREE.BoxGeometry(radius * 1.05, radius * 1.05, radius * 1.05)
          : new THREE.SphereGeometry(radius * 0.6, 10, 8),
        dark,
        [0, height * 0.87, 0],
      );
      part(new THREE.BoxGeometry(radius * 0.92, height * 0.05, radius * 0.16), threat, [
        0,
        height * 0.89,
        -radius * 0.53,
      ]);
      for (const side of [-1, 1]) {
        part(new THREE.BoxGeometry(radius * 0.34, height * 0.4, radius * 0.43), dark, [
          side * radius * 0.38,
          height * 0.24,
          0,
        ]);
        part(new THREE.BoxGeometry(radius * 0.28, height * 0.31, radius * 0.32), armor, [
          side * radius * 0.76,
          height * 0.57,
          0,
        ]);
      }
      if (!friendly)
        part(new THREE.BoxGeometry(radius * 0.35, height * 0.085, radius * 1.2), threat, [
          radius * 0.47,
          height * 0.55,
          -radius * 0.38,
        ]);
    }
    const marker = label(
      friendly
        ? role === 'rival'
          ? 'RACE'
          : 'NPC'
        : actor.type === 'hazard'
          ? '!'
          : actor.type === 'vehicle'
            ? 'V'
            : actor.type === 'drone'
              ? 'D'
              : '•',
      friendly ? '#77ebe0' : '#efb580',
      group,
      friendly ? 0.68 : 0.42,
    );
    if (marker)
      marker.position.y =
        actor.type === 'drone' || actor.type === 'hazard'
          ? radius * 2 + 0.35
          : actor.type === 'vehicle'
            ? radius * 1.6
            : height + 0.3;
    return { group, marker, lastPosition: null, health: actor.health ?? 1 };
  }
  function updateActors(state) {
    const seen = new Set();
    for (const actor of (state.actors ?? []).slice(0, 20)) {
      if (!actor.position || !actor.id) continue;
      seen.add(actor.id);
      let row = actorRows.get(actor.id);
      if (!row) {
        row = createActor(actor);
        actorRows.set(actor.id, row);
      }
      const p = actor.position;
      row.group.position.set(p.x / 1000, p.y / 1000, p.z / 1000);
      if (row.lastPosition) {
        const dx = p.x - row.lastPosition.x,
          dz = p.z - row.lastPosition.z;
        if (Math.abs(dx) + Math.abs(dz) > 1) row.group.rotation.y = Math.atan2(-dx, -dz);
      }
      row.lastPosition = { ...p };
      row.group.visible = actor.status !== 'defeated';
      if (row.marker) row.marker.material.opacity = actor.health < row.health * 0.4 ? 0.6 : 1;
    }
    for (const [id, row] of actorRows)
      if (!seen.has(id)) {
        releaseGroup(row.group);
        actors.remove(row.group);
        actorRows.delete(id);
      }
    const pulseSeen = new Set();
    for (const pulse of (state.projectiles ?? []).slice(0, 64)) {
      if (!pulse.position || pulse.id === undefined) continue;
      pulseSeen.add(pulse.id);
      let item = pulseRows.get(pulse.id);
      if (!item) {
        const color = pulse.owner === 'player' ? 0x8ce4e3 : 0xf7b071;
        item = mesh(
          new THREE.SphereGeometry(0.055, 6, 4),
          material(color, { emissive: color, emissiveIntensity: 1.4, roughness: 0.2 }),
          projectiles,
        );
        pulseRows.set(pulse.id, item);
      }
      item.position.set(pulse.position.x / 1000, pulse.position.y / 1000, pulse.position.z / 1000);
    }
    for (const [id, item] of pulseRows)
      if (!pulseSeen.has(id)) {
        const holder = new THREE.Group();
        holder.add(item);
        releaseGroup(holder);
        pulseRows.delete(id);
      }
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
      state.position.y / 1000 + (course.rules?.droneRadius ?? 220) / 1000,
      state.position.z / 1000,
    );
    const rotation = new THREE.Quaternion(
      ...state.orientation.map((value) => value / 1000000),
    ).normalize();
    aircraft.position.copy(position);
    aircraft.quaternion.copy(rotation);
    aircraft.scale.setScalar((course.rules?.droneRadius ?? 220) / 220);
    aircraft.visible = view !== 'fpv';
    if (!reducedMotion && state.status === 'active')
      for (const rotor of droneVisual.rotors) rotor.rotation.y = state.ticks * 0.72;
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
      camera.position.copy(position).add(new THREE.Vector3(0, 1.35, 3.2).applyQuaternion(rotation));
      camera.up.set(0, 1, 0);
      camera.lookAt(position);
    } else {
      const cx = (course.bounds.max.x + course.bounds.min.x) / 2000,
        cz = (course.bounds.max.z + course.bounds.min.z) / 2000;
      const extent =
        Math.max(
          course.bounds.max.x - course.bounds.min.x,
          course.bounds.max.z - course.bounds.min.z,
        ) / 1000;
      if (view === 'editor') {
        const distance = editorCamera.distance ?? extent * 1.35;
        camera.position.set(
          cx + Math.sin(editorCamera.yaw) * Math.cos(editorCamera.pitch) * distance,
          Math.sin(editorCamera.pitch) * distance,
          cz + Math.cos(editorCamera.yaw) * Math.cos(editorCamera.pitch) * distance,
        );
      } else camera.position.set(cx + extent * 0.55, extent * 0.8, cz + extent * 0.65);
      camera.up.set(0, 1, 0);
      camera.lookAt(cx, 0, cz);
    }
    if (currentStep !== state.step) {
      currentStep = state.step;
      for (const row of goalRows) {
        const active = row.index === state.step,
          complete = row.index < state.step;
        row.paint.color.setHex(complete ? 0x95aa9e : active ? 0xe8f1a7 : 0x7fa9b4);
        row.paint.opacity = active ? 1 : 0.18;
        row.light.color.setHex(active ? 0xe8f1a7 : 0x89c9c5);
        row.light.opacity = active ? 0.9 : 0.17;
        row.marker.visible = active;
        if (row.badge) row.badge.material.opacity = active ? 1 : 0.35;
      }
    }
    updateActors(state);
    if (view === 'editor') {
      aircraft.visible = false;
      for (const row of editRows)
        row.marker.scale.setScalar(
          Math.max(0.2, camera.position.distanceTo(row.handle.position) * 0.011),
        );
      applyEditorPreview();
    }
    // Imported animations are presentation only and follow simulation time.
    // Pausing, replay speed and backgrounding never advance them independently.
    importedMixer?.setTime(state.ticks / 50);
    if (pathLine) pathLine.visible = view !== 'fpv';
    renderer.render(scene, camera);
  }
  function setPath(samples) {
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
      new THREE.LineBasicMaterial({ color: 0x95e9ef, transparent: true, opacity: 0.65 }),
    );
    scene.add(pathLine);
  }
  /** Accept owned bytes and a bounded relative-path resource map, never URLs.
   * Imported geometry remains a visual preview until the authoring compiler has
   * supplied independently validated collision data to setCourse(). */
  async function loadScene(input = {}) {
    const {
      data,
      resources = {},
      signal,
      animation,
    } = input instanceof Blob ||
    input instanceof ArrayBuffer ||
    ArrayBuffer.isView(input) ||
    typeof input === 'string'
      ? { data: input }
      : input;
    if (disposed) throw new Error('Flight renderer is disposed');
    const generation = sceneGeneration,
      request = ++importGeneration;
    signal?.throwIfAborted();
    const bytes =
      data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
            : typeof data === 'string'
              ? new TextEncoder().encode(data)
              : null;
    if (!bytes || bytes.byteLength > MAP_LIMIT)
      throw new Error('World preview needs at most 16 MiB of GLB/glTF bytes');
    const rows = resources instanceof Map ? [...resources] : Object.entries(resources);
    if (rows.length > 64 || rows.some(([path, blob]) => !safePath(path) || !(blob instanceof Blob)))
      throw new Error('World resources need bounded relative paths and owned Blobs');
    if (rows.reduce((sum, [, blob]) => sum + blob.size, bytes.byteLength) > MAP_LIMIT)
      throw new Error('World preview dependencies exceed 16 MiB');
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const binary = bytes.byteLength >= 20 && header.getUint32(0, true) === 0x46546c67;
    if (
      binary &&
      (header.getUint32(4, true) !== 2 ||
        header.getUint32(8, true) !== bytes.byteLength ||
        header.getUint32(16, true) !== 0x4e4f534a ||
        header.getUint32(12, true) > bytes.byteLength - 20)
    )
      throw new Error('Invalid GLB2 header');
    const json = JSON.parse(
      new TextDecoder().decode(
        binary ? bytes.subarray(20, 20 + header.getUint32(12, true)) : bytes,
      ),
    );
    if (
      (json.nodes?.length ?? 0) > 2048 ||
      (json.meshes?.length ?? 0) > 512 ||
      (json.images?.length ?? 0) > 64 ||
      (json.materials?.length ?? 0) > 256 ||
      (json.textures?.length ?? 0) > 128 ||
      (json.animations?.length ?? 0) > 64 ||
      (json.animations ?? []).some((clip) => (clip.channels?.length ?? 0) > 256) ||
      (json.extensions?.KHR_lights_punctual?.lights?.length ?? 0) > 8 ||
      (json.skins ?? []).some((skin) => skin.joints?.length > 64)
    )
      throw new Error('World preview exceeds scene limits');
    if (
      (json.accessors ?? []).some(
        (item) => !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1000000,
      ) ||
      (json.accessors ?? []).reduce((sum, item) => sum + item.count, 0) > 2000000 ||
      (json.buffers ?? []).some(
        (item) =>
          !Number.isSafeInteger(item.byteLength) ||
          item.byteLength < 0 ||
          item.byteLength > MAP_LIMIT,
      )
    )
      throw new Error('World preview exceeds geometry limits');
    const paths = new Set(rows.map(([path]) => path));
    for (const item of [...(json.buffers ?? []), ...(json.images ?? [])])
      if (item.uri && !paths.has(item.uri)) {
        if (
          !/^data:(?:image\/(?:png|jpeg|webp)|application\/octet-stream);base64,[a-z\d+/=]+$/i.test(
            item.uri,
          )
        )
          throw new Error('World preview contains an unprovided external resource');
      }
    if (!loadGLTF) throw new Error('Imported worlds require the World Studio renderer.');
    const { GLTFLoader } = await loadGLTF();
    signal?.throwIfAborted();
    const urls = new Map(rows.map(([path, blob]) => [path, URL.createObjectURL(blob)]));
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (urls.has(url)) return urls.get(url);
      if (url.startsWith('blob:') || url.startsWith('data:')) return url;
      throw new Error('World preview requested an unprovided resource');
    });
    let result;
    try {
      result = await new GLTFLoader(manager).parseAsync(
        binary
          ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : new TextDecoder().decode(bytes),
        '',
      );
      if (
        disposed ||
        generation !== sceneGeneration ||
        request !== importGeneration ||
        signal?.aborted
      ) {
        const rejected = new THREE.Group();
        rejected.add(...result.scenes);
        releaseGroup(rejected);
        signal?.throwIfAborted();
        throw new Error('World preview changed during loading');
      }
      clearImported();
      imported.add(result.scene);
      if (
        json.asset?.extras?.fpvScenery === true &&
        ['woodland', 'courtyard', 'container-yard'].includes(course.environment)
      )
        sceneryFallback.visible = false;
      imported.userData.auxiliaryRoots = result.scenes.filter((item) => item !== result.scene);
      register(result.scene);
      for (const item of imported.userData.auxiliaryRoots) register(item);
      importedClips = result.animations;
      if (importedClips.length) {
        importedMixer = new THREE.AnimationMixer(result.scene);
        const selected =
          importedClips.find((clip) => clip.name === (animation ?? 'idle')) ?? importedClips[0];
        importedMixer.clipAction(selected).play();
      }
      result.scene.traverse((item) => {
        if (item.isMesh) {
          item.castShadow = true;
          item.receiveShadow = true;
          // Exporter collider helpers are replaced by canonical world geometry.
          if (item.userData?.rl?.kind === 'collider' || item.userData?.rl?.type === 'collider')
            item.visible = false;
        }
      });
      const objects = [];
      result.scene.traverse((item) => {
        const id = item.userData?.rl?.id ?? item.userData?.id ?? item.name;
        if (id) objects.push({ id, name: item.name });
      });
      return {
        nodes: json.nodes?.length ?? 0,
        animations: result.animations.map((clip) => clip.name),
        objects,
      };
    } finally {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    }
  }
  function editorValue() {
    const row = editRows.find((item) => item.handle === editor?.object);
    if (!row) return null;
    return {
      ...row.ref,
      position: Object.fromEntries(
        ['x', 'y', 'z'].map((key) => [key, Math.round(row.handle.position[key] * 1000)]),
      ),
    };
  }
  function applyEditorPreview() {
    const value = editorValue();
    if (!value) return;
    const target =
      value.kind === 'criterion'
        ? goalRows.find((row) => row.index === value.index)?.group
        : actorRows.get(value.id)?.group;
    target?.position.copy(editor.object.position);
  }
  function selectEditor(ref, notify = true) {
    editorSelection = ref ? { ...ref } : null;
    const selected = editRows.find(
      (row) =>
        row.ref.kind === ref?.kind &&
        (ref.kind === 'criterion' ? row.ref.index === ref.index : row.ref.id === ref.id),
    );
    for (const row of editRows)
      row.marker.material.color.setHex(
        row === selected ? 0xffd989 : row.ref.kind === 'actor' ? 0xf2ad7a : 0x80e1dc,
      );
    if (selected) editor?.attach(selected.handle);
    else editor?.detach();
    if (notify) editorCallbacks?.onSelect?.(selected ? { ...selected.ref } : null);
    editorCallbacks?.onRedraw?.();
    return !!selected;
  }
  function refreshEditorHandles() {
    editor?.detach();
    releaseGroup(editHandles);
    editRows.length = 0;
    const add = (ref, position) => {
      const handle = new THREE.Group();
      handle.position.set(position.x / 1000, position.y / 1000, position.z / 1000);
      editHandles.add(handle);
      const paint = new THREE.MeshBasicMaterial({
        color: ref.kind === 'actor' ? 0xf2ad7a : 0x80e1dc,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      materials.add(paint);
      const marker = mesh(new THREE.OctahedronGeometry(0.5, 0), paint, handle);
      marker.renderOrder = 20;
      editRows.push({ ref, handle, marker });
    };
    (course?.steps?.[mode] ?? []).forEach((step, index) => {
      if (step.type === 'gate')
        add(
          { kind: 'criterion', index },
          step.axis === 'z'
            ? { x: (step.minSide + step.maxSide) / 2, y: (step.minY + step.maxY) / 2, z: step.at }
            : { x: step.at, y: (step.minY + step.maxY) / 2, z: (step.minSide + step.maxSide) / 2 },
        );
      else if (step.min && step.max)
        add(
          { kind: 'criterion', index },
          Object.fromEntries(
            ['x', 'y', 'z'].map((key) => [key, (step.min[key] + step.max[key]) / 2]),
          ),
        );
    });
    for (const actor of course?.actors ?? []) add({ kind: 'actor', id: actor.id }, actor.position);
    editHandles.visible = true;
    selectEditor(editorSelection, false);
  }
  async function createEditor(callbacks = {}) {
    if (!loadTransformControls)
      throw new Error('World editing requires the World Studio renderer.');
    const { TransformControls } = await loadTransformControls();
    if (disposed) throw new Error('Editor was disposed while loading');
    editorCallbacks = callbacks;
    if (!editor) {
      editor = new TransformControls(camera, canvas);
      scene.add(editor.getHelper());
    }
    if (editorListener) editor.removeEventListener('objectChange', editorListener);
    if (editorDragListener) editor.removeEventListener('dragging-changed', editorDragListener);
    editorListener = () => {
      applyEditorPreview();
      editorCallbacks?.onPreview?.(editorValue());
      editorCallbacks?.onRedraw?.();
    };
    editorDragListener = (event) => {
      if (!event.value) {
        const value = editorValue();
        if (value) editorCallbacks?.onCommit?.(value);
      }
      editorCallbacks?.onRedraw?.();
    };
    editor.addEventListener('objectChange', editorListener);
    editor.addEventListener('dragging-changed', editorDragListener);
    editor.addEventListener('change', () => editorCallbacks?.onRedraw?.());
    editor.setMode('translate');
    editor.setSpace('world');
    editor.setTranslationSnap(0.25);
    editor.setSize(0.85);
    refreshEditorHandles();
    return {
      select: selectEditor,
      pick(clientX, clientY) {
        if (editor.dragging || editor.axis) return true;
        const rect = canvas.getBoundingClientRect();
        raycaster.setFromCamera(
          new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            (-(clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera,
        );
        const hit = raycaster.intersectObjects(
          editRows.map((row) => row.marker),
          false,
        )[0];
        const row = editRows.find((item) => item.marker === hit?.object);
        if (row) selectEditor(row.ref);
        return !!row;
      },
      isDragging: () => !!editor?.dragging,
      setSnap(value) {
        if (![0, 0.1, 0.25, 0.5, 1].includes(value)) throw new TypeError('Invalid editor snap');
        editor.setTranslationSnap(value || null);
      },
      orbit(dx, dy) {
        editorCamera.yaw -= dx * 0.007;
        editorCamera.pitch = Math.max(0.12, Math.min(1.45, editorCamera.pitch + dy * 0.007));
        callbacks.onRedraw?.();
      },
      zoom(delta) {
        const extent =
          Math.max(
            course.bounds.max.x - course.bounds.min.x,
            course.bounds.max.z - course.bounds.min.z,
          ) / 1000;
        editorCamera.distance = Math.max(
          5,
          Math.min(240, (editorCamera.distance ?? extent * 1.35) * Math.exp(delta * 0.001)),
        );
        callbacks.onRedraw?.();
      },
      home() {
        editorCamera.yaw = 0.65;
        editorCamera.pitch = 0.72;
        editorCamera.distance = null;
        callbacks.onRedraw?.();
      },
    };
  }
  async function attachTransform({
    objectId,
    mode: editMode = 'translate',
    onChange = () => {},
  } = {}) {
    if (!['translate', 'rotate', 'scale'].includes(editMode))
      throw new TypeError('Invalid transform mode');
    const generation = sceneGeneration;
    if (!loadTransformControls)
      throw new Error('World editing requires the World Studio renderer.');
    const { TransformControls } = await loadTransformControls();
    if (disposed || generation !== sceneGeneration) throw new Error('World preview changed');
    let object = null;
    imported.traverse((item) => {
      if (
        item.name === objectId ||
        item.userData?.id === objectId ||
        item.userData?.rl?.id === objectId
      )
        object = item;
    });
    if (!object) throw new Error('Select an imported preview object');
    if (!editor) {
      editor = new TransformControls(camera, canvas);
      scene.add(editor.getHelper());
    }
    if (editorListener) editor.removeEventListener('objectChange', editorListener);
    editorListener = () =>
      onChange({
        id: objectId,
        position: object.position.toArray(),
        rotation: object.quaternion.toArray(),
        scale: object.scale.toArray(),
      });
    editor.addEventListener('objectChange', editorListener);
    editor.setMode(editMode);
    editor.setTranslationSnap(0.1);
    editor.setRotationSnap(Math.PI / 36);
    editor.attach(object);
    return { detach: () => editor?.detach() };
  }
  const lost = (event) => {
    event.preventDefault();
    onContextLost();
  };
  canvas.addEventListener('webglcontextlost', lost);
  setQuality(quality);
  setDrone(droneKind);
  return {
    available: true,
    setCourse,
    setQuality,
    setDrone,
    setPath,
    loadScene,
    attachTransform,
    createEditor,
    draw,
    aimScreen() {
      if (disposed || !course) return null;
      const point = new THREE.Vector3(0, 0, -10)
        .applyQuaternion(aircraft.quaternion)
        .add(aircraft.position)
        .project(camera);
      return { x: (point.x + 1) / 2, y: (1 - point.y) / 2, visible: point.z >= -1 && point.z <= 1 };
    },
    detachTransform: () => editor?.detach(),
    setSceneAnimation(name) {
      const clip = importedClips.find((item) => item.name === name);
      if (!clip || !importedMixer) throw new Error('Imported animation is unavailable');
      importedMixer.stopAllAction();
      importedMixer.clipAction(clip).play();
    },
    setCosmetic(recipe) {
      if (/^#[a-fA-F0-9]{6}$/.test(recipe?.color)) droneVisual.tint.color.set(recipe.color);
    },
    resources() {
      return {
        available: true,
        disposed,
        quality,
        drone: droneKind,
        registered: {
          geometries: geometry.size + (pathLine ? 1 : 0),
          materials: materials.size + (pathLine ? 1 : 0),
          textures: new Set([...materials].flatMap(texturesOf)).size,
        },
        renderer: {
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
      sceneGeneration++;
      canvas.removeEventListener('webglcontextlost', lost);
      if (editor) {
        scene.remove(editor.getHelper());
        editor.dispose();
        editor = null;
      }
      setPath([]);
      clearImported();
      for (const group of [world, goals, aircraft, actors, projectiles, editHandles])
        releaseGroup(group);
      releaseShadow();
      for (const value of materials) {
        for (const texture of texturesOf(value)) texture.dispose();
        value.dispose();
      }
      for (const value of geometry) value.dispose();
      materials.clear();
      geometry.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
