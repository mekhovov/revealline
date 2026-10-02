import * as THREE from './vendor/three.module.js';
import {
  buildWorldVisuals,
  buildDroneVisual,
  themeForCourse,
  setSurfaceQuality,
  createEnvironmentLight,
} from './world-visuals.mjs';

const QUALITIES = Object.freeze({
  low: {
    ratio: 1,
    shadows: false,
    shadowSize: 512,
    shadowType: THREE.BasicShadowMap,
    exposure: 1.02,
    ambient: 0.9,
    key: 0.86,
    fill: 0,
  },
  balanced: {
    ratio: 1.5,
    shadows: true,
    shadowSize: 1024,
    shadowType: THREE.PCFShadowMap,
    exposure: 1.08,
    ambient: 1,
    key: 1,
    fill: 0.24,
  },
  high: {
    ratio: 2,
    shadows: true,
    shadowSize: 2048,
    shadowType: THREE.PCFShadowMap,
    exposure: 1.13,
    ambient: 1.12,
    key: 1.08,
    fill: 0.58,
  },
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
  renderer.toneMappingExposure = QUALITIES.balanced.exposure;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(82, 1, 0.035, 300);
  const world = new THREE.Group(),
    goals = new THREE.Group(),
    aircraft = new THREE.Group(),
    ghostAircraft = new THREE.Group(),
    actors = new THREE.Group(),
    projectiles = new THREE.Group(),
    imported = new THREE.Group(),
    editHandles = new THREE.Group();
  editHandles.visible = false;
  scene.add(world, goals, aircraft, ghostAircraft, actors, projectiles, imported, editHandles);
  const hemisphere = new THREE.HemisphereLight(0xe5f3ff, 0x3d504a, 2.1);
  const sunlight = new THREE.DirectionalLight(0xffefd8, 3.1);
  const fillLight = new THREE.DirectionalLight(0x9cc7e8, 0.24);
  const rimLight = new THREE.DirectionalLight(0xffbf87, 0);
  sunlight.position.set(-24, 36, 15);
  sunlight.castShadow = true;
  sunlight.shadow.bias = -0.0002;
  sunlight.shadow.normalBias = 0.04;
  sunlight.shadow.camera.near = 0.1;
  sunlight.shadow.camera.far = 160;
  fillLight.position.set(26, 18, -20);
  rimLight.position.set(-10, 10, -28);
  scene.add(
    hemisphere,
    sunlight,
    sunlight.target,
    fillLight,
    fillLight.target,
    rimLight,
    rimLight.target,
  );
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
    ghostVisual = null,
    ghostSamples = [],
    ghostPose = null,
    sceneGeneration = 0,
    presentationGeneration = 0,
    rotorTick = null,
    rotorPhase = 0,
    importGeneration = 0,
    importedMixer = null,
    importedClips = [],
    obstacleMaps = null,
    obstacleSurface = null,
    lastActorState = null,
    importedAnimationTick = null,
    environmentLight = null,
    cosmeticColor = null,
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
    shadowMaterials = new WeakMap(),
    goalRows = [],
    actorRows = new Map(),
    actorDefinitions = new Map(),
    seenActors = new Set(),
    pulseRows = new Map(),
    qualityDetails = [];
  const framePosition = new THREE.Vector3(),
    frameRotation = new THREE.Quaternion(),
    cameraOffset = new THREE.Vector3(),
    cameraTiltRotation = new THREE.Quaternion(),
    cameraTiltAxis = new THREE.Vector3(1, 0, 0),
    pulseTransform = new THREE.Matrix4();
  const texturesOf = (paint) => Object.values(paint ?? {}).filter((value) => value?.isTexture);
  function ownShadowMaterial(item) {
    if (!item.isMesh || item.customDepthMaterial || Array.isArray(item.material)) return;
    // The pinned renderer's shared depth material can retain an old map uniform
    // after changing to an untextured caster, re-uploading an already disposed
    // world texture. Keep shadow uniforms within their source material's lifetime.
    let depth = shadowMaterials.get(item.material);
    if (!depth) {
      depth = new THREE.MeshDepthMaterial();
      shadowMaterials.set(item.material, depth);
      materials.add(depth);
    }
    item.customDepthMaterial = depth;
  }
  const register = (root) =>
    root.traverse((item) => {
      ownShadowMaterial(item);
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
    ownShadowMaterial(value);
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
      skeletons = new Set(),
      instances = new Set();
    const roots = [group, ...(group.userData.auxiliaryRoots ?? [])];
    for (const root of roots)
      root.traverse((item) => {
        if (item.geometry) shapes.add(item.geometry);
        if (item.skeleton) skeletons.add(item.skeleton);
        if (item.isInstancedMesh) instances.add(item);
        for (const paint of [
          ...(Array.isArray(item.material) ? item.material : [item.material]),
          ...(item.userData?.ownedMaterials ?? []),
          item.customDepthMaterial,
          item.customDistanceMaterial,
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
    // Instance attributes are released by the mesh's own dispose event, not by
    // disposing its shared BufferGeometry or material.
    for (const value of instances) value.dispose();
    for (const value of shapes) {
      value.dispose();
      geometry.delete(value);
    }
    for (const value of paints) {
      value.dispose();
      materials.delete(value);
    }
    group.userData.auxiliaryRoots = [];
    delete group.userData.ownedMaterials;
    delete group.userData.visuals;
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
    importedAnimationTick = null;
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
    const changed = value !== quality;
    if (changed) presentationGeneration++;
    quality = value;
    const selected = QUALITIES[value];
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, selected.ratio));
    renderer.shadowMap.enabled = selected.shadows;
    renderer.shadowMap.type = selected.shadowType;
    renderer.toneMappingExposure = selected.exposure;
    sunlight.castShadow = selected.shadows;
    if (sunlight.shadow.mapSize.x !== selected.shadowSize) {
      releaseShadow();
      sunlight.shadow.mapSize.set(selected.shadowSize, selected.shadowSize);
    }
    renderer.shadowMap.needsUpdate = true;
    const visuals = world.userData.visuals;
    if (visuals) {
      const baseAmbient = visuals.indoor ? 2.0 : 1.55;
      const baseSun = visuals.indoor ? 2.0 : 3.1;
      hemisphere.intensity = baseAmbient * selected.ambient;
      sunlight.intensity = baseSun * selected.key;
      fillLight.intensity = selected.fill * (visuals.indoor ? 1.4 : 1);
      rimLight.intensity = value === 'high' ? (visuals.indoor ? 0.34 : 0.52) : 0;
      fillLight.target.position.set(visuals.center[0], 0, visuals.center[1]);
      rimLight.target.position.set(visuals.center[0], 1.2, visuals.center[1]);
      visuals.setQuality?.(value);
    }
    scene.environment = value === 'low' ? null : (environmentLight?.texture ?? null);
    scene.environmentIntensity = value === 'high' ? 0.55 : 0.32;
    if (changed && droneVisual) setDrone(droneKind);
    for (const item of qualityDetails)
      item.visible =
        value === 'high' || (item.userData.minimumQuality === 'balanced' && value !== 'low');
    if (changed && actorRows.size) {
      releaseGroup(actors);
      actorRows.clear();
      for (const descriptor of (course?.actors ?? []).slice(0, 20))
        actorRows.set(descriptor.id, createActor(descriptor));
      if (lastActorState) updateActors(lastActorState);
    }
    setSurfaceQuality(materials, value, renderer.capabilities.getMaxAnisotropy());
    if (changed) for (const paint of materials) paint.needsUpdate = true;
    lastWidth = lastHeight = 0;
  }
  function setDrone(value) {
    if (!['racer', 'pixel', 'utility'].includes(value))
      throw new TypeError('Unknown drone appearance');
    presentationGeneration++;
    droneKind = value;
    releaseGroup(aircraft);
    droneVisual = buildDroneVisual({ parent: aircraft, mesh, material, box, kind: value, quality });
    if (cosmeticColor) droneVisual.tint.color.set(cosmeticColor);
    for (const [index, rotor] of droneVisual.rotors.entries())
      rotor.rotation.y = rotorPhase * (index === 0 || index === 3 ? -1 : 1);
    setSurfaceQuality(materials, quality, renderer.capabilities.getMaxAnisotropy());
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
      const gateStyle = themeProfile?.assets?.gate ?? 'builtin:gate';
      group.userData.themeAsset = gateStyle;
      // These remain translucent criterion guides; their aperture is unchanged.
      light.roughness = gateStyle.includes('timber')
        ? 0.95
        : gateStyle.includes('utility')
          ? 0.65
          : 0.35;
      light.metalness = gateStyle.includes('utility') ? 0.5 : 0;
      light.emissiveIntensity = gateStyle.includes('neon')
        ? 1.5
        : gateStyle.includes('timber')
          ? 0.2
          : 0.65;
      light.emissive.setHex(
        gateStyle.includes('timber') ? 0xc8aa72 : (themeProfile?.palette?.accent ?? 0x82e1d5),
      );
      const horizontal = step.axis === 'z',
        span = horizontal ? size[0] : size[2];
      for (const side of [-1, 1]) {
        // A short bracket at each outer corner identifies the theme without
        // filling the gate opening or changing its exact crossing boundary.
        if (gateStyle.includes('utility') || gateStyle.includes('neon')) {
          const bracket = mesh(
            new THREE.BoxGeometry(horizontal ? 0.32 : 0.045, 0.045, horizontal ? 0.045 : 0.32),
            light,
            group,
          );
          bracket.position.set(
            horizontal ? side * (span / 2 + 0.14) : 0,
            size[1] / 2,
            horizontal ? 0 : side * (span / 2 + 0.14),
          );
        }
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
    // These are holographic instructions, never collision geometry. Their group
    // shares the criterion's zone centre, so editor translations move all parts.
    const point = (world) =>
      new THREE.Vector3(...['x', 'y', 'z'].map((axis, i) => world[axis] / 1000 - position[i]));
    const line = (points, parent = group) => {
      const shape = new THREE.BufferGeometry().setFromPoints(points);
      geometry.add(shape);
      parent.add(new THREE.Line(shape, paint));
    };
    const cueArrow = (direction, start, length, parent = group) => {
      const arrow = new THREE.ArrowHelper(
        direction.clone().normalize(),
        start,
        length,
        0x8beafc,
        Math.min(0.35, length * 0.3),
        Math.min(0.22, length * 0.2),
      );
      // Share registered goal materials so inactive/complete cues dim uniformly.
      arrow.line.material.dispose();
      arrow.cone.material.dispose();
      arrow.line.material = paint;
      arrow.cone.material = light;
      parent.add(arrow);
      register(arrow);
    };
    if (step.type === 'path-v1') {
      const [a, b] = step.plane,
        radius = (step.radiusMin + step.radiusMax) / 2000;
      const at = (angle, r) =>
        point({
          ...step.center,
          [a]: step.center[a] + Math.cos(angle) * r * 1000,
          [b]: step.center[b] + Math.sin(angle) * r * 1000,
        });
      const bearing = ((step.entryBearing ?? 0) * Math.PI) / 18000,
        sweep = (Math.min(36000, step.sweep) * Math.PI) / 18000;
      for (const r of [step.radiusMin / 1000, step.radiusMax / 1000])
        line(
          Array.from({ length: 65 }, (_, i) => at(bearing + (step.direction * i * sweep) / 64, r)),
        );
      for (const fraction of [0.2, 0.7]) {
        const angle = bearing + step.direction * sweep * fraction,
          tangent = new THREE.Vector3();
        tangent[a] = -Math.sin(angle) * step.direction;
        tangent[b] = Math.cos(angle) * step.direction;
        cueArrow(tangent, at(angle, radius), Math.min(1.8, radius * 0.3));
      }
      if (step.entryBearing !== null)
        line([at(bearing, step.radiusMin / 1000), at(bearing, step.radiusMax / 1000)]);
      // The annulus is shown on the authored reference plane. Actual axial
      // displacement is entry-relative and remains bounded by the visible zone.
      row.skillShape = 'path-band';
    } else if (step.type === 'crossing-v1') {
      const [a, b] = ['x', 'y', 'z'].filter((axis) => axis !== step.axis),
        world = {
          [step.axis]: step.at,
          [a]: (step.minA + step.maxA) / 2,
          [b]: (step.minB + step.maxB) / 2,
        },
        corners = [
          [step.minA, step.minB],
          [step.maxA, step.minB],
          [step.maxA, step.maxB],
          [step.minA, step.maxB],
          [step.minA, step.minB],
        ].map(([av, bv]) => point({ [step.axis]: step.at, [a]: av, [b]: bv })),
        direction = new THREE.Vector3();
      line(corners);
      direction[step.axis] = step.direction;
      cueArrow(direction, point(world).addScaledVector(direction, -0.9), 1.8);
      row.skillShape = 'crossing-plane';
    } else if (step.type === 'rotation-v1') {
      const cue = new THREE.Group(),
        radius = Math.max(0.6, Math.min(1.8, ...size.map((v) => v * 0.25))),
        // Positive commands integrate a negative right-hand body-axis angle.
        plane = { pitch: 'yz', yaw: 'xz', roll: 'xy' }[step.axis],
        [a, b] = plane,
        sign = step.direction * (step.axis === 'yaw' ? 1 : -1),
        at = (angle) => {
          const v = new THREE.Vector3();
          v[a] = Math.cos(angle) * radius;
          v[b] = Math.sin(angle) * radius;
          return v;
        },
        points = Array.from({ length: 41 }, (_, i) => at((sign * i * Math.PI * 1.7) / 40)),
        end = sign * Math.PI * 1.7,
        tangent = new THREE.Vector3();
      group.add(cue);
      line(points, cue);
      tangent[a] = -Math.sin(end) * sign;
      tangent[b] = Math.cos(end) * sign;
      cueArrow(tangent, points.at(-1), radius * 0.4, cue);
      row.skillCue = cue;
      row.skillShape = 'body-rotation';
    } else if (step.type === 'attitude-v1') {
      cueArrow(
        new THREE.Vector3(0, step.up === 'inverted' ? -1 : 1, 0),
        new THREE.Vector3(),
        Math.max(0.6, Math.min(1.8, size[1] * 0.25)),
      );
      row.skillShape = 'body-up';
    }
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
  function obstacleSurfaceKind(obstacle) {
    const id = obstacle.id ?? '';
    if (/tree|timber|crate/.test(id) || course.environment === 'woodland') return 'wood';
    if (/house/.test(id) && course.environment === 'courtyard') return 'plaster';
    if (/wall|well/.test(id) && course.environment === 'courtyard') return 'brick';
    if (['garage', 'gym'].includes(course.environment) || /ramp|deck|column|stand/.test(id))
      return 'concrete';
    return 'metal';
  }
  function worldScaleUV(shape) {
    const positions = shape.getAttribute('position'),
      normals = shape.getAttribute('normal');
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
      const nx = Math.abs(normals.getX(i)),
        ny = Math.abs(normals.getY(i)),
        nz = Math.abs(normals.getZ(i));
      // Local metres survive rotation and avoid a different texture scale on
      // every authored box. Shape vertices remain completely unchanged.
      uv[i * 2] = (nx > ny && nx > nz ? positions.getZ(i) : positions.getX(i)) / 4;
      uv[i * 2 + 1] = (ny >= nx && ny >= nz ? positions.getZ(i) : positions.getY(i)) / 4;
    }
    shape.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  function addFlushPanels(parent, panels, color, minimumQuality = 'balanced') {
    if (!panels.length) return;
    const positions = [],
      normals = [];
    for (const panel of panels) {
      const [side, along, elevation, width, height, half] = panel;
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (const [u, v] of corners) {
        const a = along + (u * width) / 2,
          y = elevation + (v * height) / 2;
        if (side === 0) {
          positions.push(a, y, half);
          normals.push(0, 0, 1);
        } else if (side === 1) {
          positions.push(-a, y, -half);
          normals.push(0, 0, -1);
        } else if (side === 2) {
          positions.push(half, y, -a);
          normals.push(1, 0, 0);
        } else {
          positions.push(-half, y, a);
          normals.push(-1, 0, 0);
        }
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    shape.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    const paint = material(color, {
      roughness: 0.62,
      metalness: 0.15,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const panelsMesh = mesh(shape, paint, parent);
    panelsMesh.name = 'flush-surface-markings';
    panelsMesh.userData.minimumQuality = minimumQuality;
    panelsMesh.visible = quality === 'high' || (minimumQuality === 'balanced' && quality !== 'low');
    qualityDetails.push(panelsMesh);
  }
  function renderObstacle(obstacle, index) {
    const theme = themeForCourse(course),
      kind = obstacleSurfaceKind(obstacle);
    const maps = obstacleSurface?.(kind) ?? obstacleMaps;
    const paint = material(
      kind === 'metal' && course.environment === 'container-yard'
        ? [0x91aca7, 0xcbb47e, 0x9dacae][index % 3]
        : kind === 'plaster'
          ? 0xfff5dd
          : 0xffffff,
      {
        ...maps,
        normalScale: new THREE.Vector2(
          kind === 'plaster' ? 0.13 : 0.3,
          kind === 'plaster' ? 0.13 : 0.3,
        ),
        roughness: kind === 'metal' ? 0.66 : 0.9,
        metalness: kind === 'metal' ? 0.28 : 0,
      },
    );
    let value, size;
    if (obstacle.type === 'trimesh') {
      let shape = new THREE.BufferGeometry();
      shape.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          obstacle.vertices.map((v) => v / 1000),
          3,
        ),
      );
      shape.setIndex(obstacle.indices);
      // Split only the visual vertices for stable planar texture projection;
      // the canonical collision triangles and their identity are untouched.
      const flat = shape.toNonIndexed();
      shape.dispose();
      shape = flat;
      shape.computeVertexNormals();
      if (obstacleSurface) worldScaleUV(shape);
      paint.side = THREE.DoubleSide;
      value = mesh(shape, paint);
    } else if (obstacle.min && obstacle.max) {
      size = ['x', 'y', 'z'].map((key) => (obstacle.max[key] - obstacle.min[key]) / 1000);
      const shape = new THREE.BoxGeometry(...size);
      if (obstacleSurface) worldScaleUV(shape);
      value = mesh(shape, paint);
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
    value.userData.surfaceKind = kind;
    value.castShadow = value.receiveShadow = true;
    if (size && size[1] > 0.5) {
      const panels = [],
        accents = [],
        [width, height, depth] = size;
      for (let side = 0; side < 4; side++) {
        const span = side < 2 ? width : depth,
          half = (side < 2 ? depth : width) / 2;
        if (kind === 'plaster' && span > 2 && height > 2) {
          const count = Math.max(1, Math.min(5, Math.floor(span / 2.4)));
          for (let i = 0; i < count; i++)
            for (let floor = 0; floor < Math.min(3, Math.floor(height / 2.2)); floor++)
              panels.push([
                side,
                -span / 2 + ((i + 0.5) * span) / count,
                -height / 2 + 1.4 + floor * 2.2,
                Math.min(1.1, (span / count) * 0.55),
                1.05,
                half,
              ]);
          accents.push([side, 0, -height / 2 + 0.25, span, 0.24, half]);
        } else if (kind === 'metal' && span > 1) {
          accents.push([side, 0, -height * 0.34, span * 0.96, Math.min(0.12, height * 0.08), half]);
          if (/container|rack/.test(obstacle.id))
            panels.push([
              side,
              span * 0.26,
              height * 0.12,
              Math.min(0.5, span * 0.16),
              Math.min(0.3, height * 0.18),
              half,
            ]);
        } else if (/column/.test(obstacle.id) && span > 0.2) {
          accents.push([
            side,
            0,
            -height / 2 + Math.min(1, height * 0.4),
            span,
            Math.min(0.3, height * 0.12),
            half,
          ]);
        }
      }
      addFlushPanels(value, panels, kind === 'plaster' ? 0x456475 : 0xe7e7cf);
      addFlushPanels(value, accents, kind === 'plaster' ? 0x8c7863 : theme.warm, 'high');
    }
    const edges = new THREE.EdgesGeometry(value.geometry, 30);
    geometry.add(edges);
    const edgePaint = new THREE.LineBasicMaterial({
      color: theme.warm,
      transparent: true,
      opacity: 0.22,
    });
    materials.add(edgePaint);
    value.add(new THREE.LineSegments(edges, edgePaint));
  }
  function setCourse(value, selectedMode = 'self-level') {
    if (disposed) return;
    sceneGeneration++;
    presentationGeneration++;
    rotorTick = null;
    rotorPhase = 0;
    setGhost([]);
    editor?.detach();
    course = value;
    mode = selectedMode;
    currentStep = -1;
    clearImported();
    scene.environment = null;
    environmentLight?.dispose();
    environmentLight = null;
    for (const group of [world, goals, actors, projectiles]) releaseGroup(group);
    goalRows.length = 0;
    actorRows.clear();
    actorDefinitions.clear();
    qualityDetails.length = 0;
    lastActorState = null;
    pulseRows.clear();
    const surroundings = buildWorldVisuals({ course, world, mesh, material, box });
    register(world);
    const theme = surroundings.theme;
    themeProfile = surroundings.profile;
    sceneryFallback = surroundings.backdrop;
    obstacleMaps = surroundings.obstacleMaps;
    obstacleSurface = surroundings.obstacleSurface ?? null;
    scene.background = new THREE.Color(surroundings.indoor ? theme.wall : theme.sky);
    // Visibility is a course property, identical across graphics presets.
    scene.fog = new THREE.Fog(theme.fog, surroundings.indoor ? 55 : 85, 210);
    hemisphere.groundColor
      .copy(surroundings.groundColor ?? new THREE.Color(theme.ground))
      .multiplyScalar(0.4);
    environmentLight = createEnvironmentLight(renderer, {
      sky: surroundings.indoor ? theme.wall : theme.sky,
      ground: surroundings.groundColor ?? theme.ground,
      indoor: surroundings.indoor,
    });
    world.userData.visuals = {
      indoor: surroundings.indoor,
      center: surroundings.center,
      setQuality: surroundings.setQuality,
      updatePresentation: surroundings.updatePresentation,
    };
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
    fillLight.position.set(surroundings.center[0] + 26, 18, surroundings.center[1] - 20);
    rimLight.position.set(surroundings.center[0] - 10, 10, surroundings.center[1] - 28);
    setQuality(quality);
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
    for (const actor of (course.actors ?? []).slice(0, 20)) {
      actorDefinitions.set(actor.id, actor);
      const row = createActor(actor);
      if (actor.position)
        row.group.position.set(
          actor.position.x / 1000,
          actor.position.y / 1000,
          actor.position.z / 1000,
        );
      actorRows.set(actor.id, row);
    }
    setSurfaceQuality(materials, quality, renderer.capabilities.getMaxAnisotropy());
    if (editorCallbacks) refreshEditorHandles();
  }
  function createActor(actor) {
    const group = new THREE.Group();
    const animated = { rotors: [], wheels: [], limbs: [], body: null };
    actors.add(group);
    const radius = (actor.radius ?? 300) / 1000,
      height = (actor.height ?? 1800) / 1000,
      role = actor.type === 'hazard' ? 'hazard' : (actor.role ?? 'hostile'),
      friendly = role === 'rival' || role === 'civilian',
      slot = actor.type === 'vehicle' ? themeProfile?.assets?.vehicle : themeProfile?.assets?.enemy,
      pixel = themeProfile?.characters === 'arcade' || /pixel|arcade/.test(slot ?? ''),
      detailed = quality === 'high',
      civilian = themeProfile?.characters === 'civilian' || role === 'civilian';
    group.name = `actor-${actor.id}`;
    group.userData.themeAsset = slot ?? 'builtin:sentry';
    if (actor.position)
      group.position.set(actor.position.x / 1000, actor.position.y / 1000, actor.position.z / 1000);
    const armor = material(
      friendly ? 0x74bfc0 : pixel ? 0xa785cb : civilian ? 0x839c9d : 0x778b86,
      { metalness: civilian ? 0.08 : 0.35, roughness: civilian ? 0.84 : 0.55 },
    );
    const threat = material(friendly ? 0x77ebe0 : 0xf1ae75, {
      emissive: friendly ? 0x249eaa : 0xb86231,
      emissiveIntensity: 0.5,
    });
    const dark = material(0x283e47, { roughness: 0.78 });
    const metal =
      quality === 'low' ? dark : material(0xa9b7b8, { metalness: 0.72, roughness: 0.34 });
    const glass =
      quality === 'low' ? dark : material(0x456975, { metalness: 0.25, roughness: 0.17 });
    group.userData.ownedMaterials = [armor, threat, dark, metal, glass];
    const part = (shape, paint, at, parent = group) => {
      const value = mesh(shape, paint, parent);
      value.position.set(...at);
      value.castShadow = true;
      return value;
    };
    if (actor.type === 'drone') {
      const rig = new THREE.Group();
      group.add(rig);
      animated.body = rig;
      rig.position.y = radius;
      rig.scale.setScalar(radius / 0.22);
      const kind = pixel
        ? 'pixel'
        : /practice-drone/.test(slot ?? '') || role === 'rival'
          ? 'racer'
          : 'utility';
      const visual = buildDroneVisual({
        parent: rig,
        mesh,
        material,
        box,
        kind,
        quality: quality === 'high' ? 'balanced' : 'low',
      });
      visual.tint.color.setHex(friendly ? 0x77ebe0 : 0xe6a16b);
      animated.rotors = visual.rotors;
    } else if (actor.type === 'vehicle') {
      const van = /van/.test(slot ?? ''),
        truck = /truck/.test(slot ?? '');
      part(new THREE.BoxGeometry(radius * 1.4, radius * 0.55, radius * 1.3), armor, [
        0,
        radius * 0.55,
        0,
      ]);
      part(
        new THREE.BoxGeometry(
          radius * (van ? 1.18 : 0.85),
          radius * (van ? 0.62 : 0.45),
          radius * (truck ? 0.53 : van ? 1.03 : 0.75),
        ),
        armor,
        [0, radius * (van ? 1.0 : 0.96), truck ? -radius * 0.26 : 0],
      );
      if (quality !== 'low') {
        part(new THREE.BoxGeometry(radius * 0.7, radius * 0.25, radius * 0.012), glass, [
          0,
          radius * 1.02,
          -radius * (van ? 0.522 : truck ? 0.53 : 0.383),
        ]);
        for (const side of [-1, 1]) {
          part(
            new THREE.BoxGeometry(radius * 0.012, radius * 0.24, radius * (van ? 0.56 : 0.27)),
            glass,
            [side * radius * (van ? 0.596 : 0.432), radius * 1.02, truck ? -radius * 0.26 : 0],
          );
          part(new THREE.BoxGeometry(radius * 0.13, radius * 0.09, radius * 0.03), threat, [
            side * radius * 0.44,
            radius * 0.58,
            -radius * 0.662,
          ]);
        }
        for (const end of [-1, 1])
          part(new THREE.BoxGeometry(radius * 1.2, radius * 0.11, radius * 0.065), dark, [
            0,
            radius * 0.39,
            end * radius * 0.65,
          ]);
      }
      for (const x of [-0.63, 0.63])
        for (const z of [-0.48, 0.48]) {
          const axle = new THREE.Group();
          axle.position.set(x * radius, radius * 0.26, z * radius);
          group.add(axle);
          const wheel = part(
            new THREE.CylinderGeometry(
              radius * 0.25,
              radius * 0.25,
              radius * 0.22,
              pixel ? 6 : quality === 'low' ? 8 : 16,
            ),
            dark,
            [0, 0, 0],
            axle,
          );
          wheel.rotation.z = Math.PI / 2;
          animated.wheels.push(axle);
          if (detailed) {
            const hub = part(
              new THREE.CylinderGeometry(radius * 0.13, radius * 0.13, radius * 0.225, 8),
              metal,
              [0, 0, 0],
              axle,
            );
            hub.rotation.z = Math.PI / 2;
            part(
              new THREE.BoxGeometry(radius * 0.23, radius * 0.045, radius * 0.22),
              metal,
              [0, 0, 0],
              axle,
            );
          }
        }
      part(
        new THREE.BoxGeometry(
          radius * (friendly ? 0.8 : 0.18),
          radius * 0.16,
          radius * (friendly ? 0.18 : 0.8),
        ),
        threat,
        [0, radius * (van ? 1.37 : 1.2), -radius * 0.18],
      );
      if (detailed && !friendly)
        part(new THREE.CylinderGeometry(radius * 0.012, radius * 0.016, radius * 0.36, 6), dark, [
          radius * 0.28,
          radius * 1.35,
          radius * 0.24,
        ]);
    } else if (actor.type === 'hazard') {
      const orb = part(new THREE.IcosahedronGeometry(radius, quality === 'low' ? 0 : 1), threat, [
        0,
        radius,
        0,
      ]);
      orb.material.wireframe = true;
      const ring = part(
        new THREE.TorusGeometry(radius * 0.75, radius * 0.07, 6, pixel ? 12 : 24),
        dark,
        [0, radius, 0],
      );
      ring.rotation.x = Math.PI / 2;
    } else {
      part(
        pixel
          ? new THREE.BoxGeometry(radius * 1.25, height * 0.3, radius * 0.8)
          : new THREE.CapsuleGeometry(radius * 0.66, height * 0.25, 3, quality === 'low' ? 6 : 10),
        armor,
        [0, height * 0.58, 0],
      );
      part(
        pixel
          ? new THREE.BoxGeometry(radius * 1.05, radius * 1.05, radius * 1.05)
          : new THREE.SphereGeometry(radius * 0.6, quality === 'low' ? 8 : 12, 8),
        civilian ? armor : dark,
        [0, height * 0.87, 0],
      );
      part(new THREE.BoxGeometry(radius * 0.92, height * 0.05, radius * 0.16), threat, [
        0,
        height * 0.89,
        -radius * 0.53,
      ]);
      if (quality !== 'low') {
        part(
          new THREE.BoxGeometry(radius * 0.91, height * 0.19, radius * 0.16),
          civilian ? threat : dark,
          [0, height * 0.58, -radius * 0.59],
        );
        part(new THREE.BoxGeometry(radius * 0.78, height * 0.19, radius * 0.3), dark, [
          0,
          height * 0.58,
          radius * 0.54,
        ]);
      }
      for (const side of [-1, 1]) {
        const leg = new THREE.Group(),
          arm = new THREE.Group();
        leg.position.set(side * radius * 0.38, height * 0.43, 0);
        arm.position.set(side * radius * 0.76, height * 0.71, 0);
        group.add(leg, arm);
        part(
          new THREE.BoxGeometry(radius * 0.34, height * 0.38, radius * 0.43),
          dark,
          [0, -height * 0.19, 0],
          leg,
        );
        part(
          new THREE.BoxGeometry(radius * 0.28, height * 0.31, radius * 0.32),
          armor,
          [0, -height * 0.155, 0],
          arm,
        );
        if (detailed) {
          part(
            new THREE.BoxGeometry(radius * 0.38, height * 0.065, radius * 0.62),
            dark,
            [0, -height * 0.365, -radius * 0.06],
            leg,
          );
          part(
            new THREE.SphereGeometry(radius * 0.17, 6, 4),
            civilian ? armor : dark,
            [0, -height * 0.31, 0],
            arm,
          );
        }
        animated.limbs.push(
          { part: leg, side, amount: 0.32 },
          { part: arm, side: -side, amount: 0.24 },
        );
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
            ? radius * 1.7
            : height + 0.3;
    return {
      group,
      marker,
      animated,
      lastPosition: new THREE.Vector3(),
      lastTick: null,
      moving: false,
      radius,
      quality,
      health: actor.maxHealth ?? actor.health ?? 1,
    };
  }
  function projectileBatch(owner) {
    const key = owner === 'player' ? 'player' : 'other';
    let batch = pulseRows.get(key);
    if (!batch) {
      const color = key === 'player' ? 0x8ce4e3 : 0xf7b071;
      batch = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.055, 6, 4),
        material(color, { emissive: color, emissiveIntensity: 1.4, roughness: 0.2 }),
        64,
      );
      batch.name = `projectile-pool-${key}`;
      batch.count = 0;
      batch.frustumCulled = false;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      projectiles.add(batch);
      register(batch);
      pulseRows.set(key, batch);
    }
    return batch;
  }
  function updateActors(state) {
    lastActorState = state;
    seenActors.clear();
    for (let i = 0; i < Math.min(20, state.actors?.length ?? 0); i++) {
      const actor = state.actors[i];
      if (!actor.position || !actor.id) continue;
      seenActors.add(actor.id);
      let row = actorRows.get(actor.id);
      if (!row) {
        row = createActor(actor);
        actorRows.set(actor.id, row);
      }
      const p = actor.position,
        definition = actorDefinitions.get(actor.id),
        target = definition?.path?.[actor.pathIndex ?? 0];
      row.group.position.set(p.x / 1000, p.y / 1000, p.z / 1000);
      if (row.lastTick !== state.ticks) {
        let moving = false;
        if (target && definition.speed > 0) {
          let dx = target.x - p.x,
            dz = target.z - p.z;
          const approaching = Math.hypot(dx, dz) > 30;
          moving = approaching && !actor.blocked && actor.status !== 'defeated';
          // A stopped/arrived snapshot must face the same authored direction
          // even when reached through a replay seek rather than a prior draw.
          if (!approaching) {
            const previous =
              definition.path[
                ((actor.pathIndex ?? 0) + definition.path.length - 1) % definition.path.length
              ] ?? definition.position;
            dx = target.x - previous.x;
            dz = target.z - previous.z;
          }
          row.group.rotation.y = Math.hypot(dx, dz) > 0 ? Math.atan2(-dx, -dz) : 0;
        } else if (definition) row.group.rotation.y = 0;
        else if (row.lastTick !== null && state.ticks > row.lastTick) {
          const dx = p.x - row.lastPosition.x,
            dz = p.z - row.lastPosition.z;
          moving = Math.hypot(dx, dz) > 1;
          if (moving) row.group.rotation.y = Math.atan2(-dx, -dz);
        }
        row.moving = moving;
        const seconds = state.ticks / 50,
          speed = Math.max(0.35, (definition?.speed ?? 1000) / 1000),
          phase = seconds * speed * 7;
        // Pose is a pure function of simulation time/current route direction.
        // Repeated draws, pause, view changes and replay seeks cannot add motion.
        for (const [index, rotor] of row.animated.rotors.entries())
          rotor.rotation.y = reducedMotion
            ? 0
            : ((state.ticks * 0.64) % (Math.PI * 2)) * (index === 0 || index === 3 ? -1 : 1);
        for (const wheel of row.animated.wheels)
          wheel.rotation.x =
            !reducedMotion && moving ? -(seconds * speed) / Math.max(0.02, row.radius * 0.25) : 0;
        for (const limb of row.animated.limbs)
          limb.part.rotation.x =
            !reducedMotion && moving ? Math.sin(phase) * limb.amount * limb.side : 0;
        if (row.animated.body) {
          row.animated.body.rotation.x = !reducedMotion && moving ? -0.07 : 0;
          row.animated.body.rotation.z =
            !reducedMotion && moving ? Math.sin(seconds * 2.3) * 0.018 : 0;
        }
        row.lastTick = state.ticks;
      }
      row.lastPosition.set(p.x, p.y, p.z);
      row.group.visible = actor.status !== 'defeated';
      if (row.marker) row.marker.material.opacity = actor.health < row.health * 0.4 ? 0.6 : 1;
    }
    for (const [id, row] of actorRows)
      if (!seenActors.has(id)) {
        releaseGroup(row.group);
        actors.remove(row.group);
        actorRows.delete(id);
      }
    for (const batch of pulseRows.values()) batch.count = 0;
    for (let i = 0; i < Math.min(64, state.projectiles?.length ?? 0); i++) {
      const pulse = state.projectiles[i];
      if (!pulse.position || pulse.id === undefined) continue;
      const batch = projectileBatch(pulse.owner);
      pulseTransform.makeTranslation(
        pulse.position.x / 1000,
        pulse.position.y / 1000,
        pulse.position.z / 1000,
      );
      batch.setMatrixAt(batch.count++, pulseTransform);
    }
    for (const batch of pulseRows.values()) {
      batch.visible = batch.count > 0;
      batch.instanceMatrix.needsUpdate = true;
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
      camera.updateProjectionMatrix();
      lastWidth = width;
      lastHeight = height;
    }
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const position = framePosition.set(
      state.position.x / 1000,
      state.position.y / 1000 + (course.rules?.droneRadius ?? 220) / 1000,
      state.position.z / 1000,
    );
    const rotation = frameRotation
      .set(
        state.orientation[0] / 1000000,
        state.orientation[1] / 1000000,
        state.orientation[2] / 1000000,
        state.orientation[3] / 1000000,
      )
      .normalize();
    aircraft.position.copy(position);
    aircraft.quaternion.copy(rotation);
    aircraft.scale.setScalar((course.rules?.droneRadius ?? 220) / 220);
    aircraft.visible = view !== 'fpv';
    // Integrate only elapsed simulation ticks. Changing throttle changes angular
    // speed without reinterpreting the entire flight's already elapsed phase.
    if (rotorTick === null || state.ticks < rotorTick) rotorPhase = 0;
    else if (!reducedMotion && state.ticks > rotorTick) {
      const rate = 0.12 + Math.max(0, Math.min(1, (state.lastInput?.throttle ?? 0) / 1000)) * 0.74;
      rotorPhase = (rotorPhase + (state.ticks - rotorTick) * rate) % (Math.PI * 2);
    }
    rotorTick = state.ticks;
    for (const [index, rotor] of droneVisual.rotors.entries())
      rotor.rotation.y = rotorPhase * (index === 0 || index === 3 ? -1 : 1);
    if (view === 'fpv') {
      camera.position.copy(position);
      camera.quaternion
        .copy(rotation)
        .multiply(cameraTiltRotation.setFromAxisAngle(cameraTiltAxis, (tilt * Math.PI) / 180));
    } else if (view === 'chase') {
      camera.position.copy(position).add(cameraOffset.set(0, 1.35, 3.2).applyQuaternion(rotation));
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
    // A body-axis rotation cue uses the actual captured entry frame, not an
    // assumed world heading. Before entry it is only a neutral schematic cue.
    for (const row of goalRows)
      if (row.skillCue) {
        const entry = state.skill?.index === row.index ? state.skill.entry : null;
        if (entry)
          row.skillCue.quaternion.fromArray(entry.map((value) => value / 1000000)).normalize();
        else row.skillCue.quaternion.identity();
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
    const animationTick = reducedMotion ? 0 : state.ticks;
    if (importedMixer && importedAnimationTick !== animationTick) {
      importedMixer.setTime(animationTick / 50);
      importedAnimationTick = animationTick;
    }
    world.userData.visuals?.updatePresentation?.(state, { reducedMotion });
    updateGhost(state.ticks);
    if (pathLine) pathLine.visible = view !== 'fpv' && view !== 'editor';
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
  /** Bounded, replay-verified presentation samples; never a physics body. */
  function setGhost(samples) {
    if (
      !Array.isArray(samples) ||
      samples.length > 7202 ||
      samples.some(
        (sample, index) =>
          !Number.isSafeInteger(sample.tick) ||
          sample.tick < 0 ||
          sample.tick > 36000 ||
          (index === 0 ? sample.tick !== 0 : sample.tick <= samples[index - 1].tick) ||
          !['x', 'y', 'z'].every((key) => Number.isFinite(sample.position?.[key])) ||
          !Array.isArray(sample.orientation) ||
          sample.orientation.length !== 4 ||
          !sample.orientation.every(Number.isFinite) ||
          Math.hypot(...sample.orientation) === 0,
      )
    )
      throw new Error('Invalid personal-best presentation samples');
    releaseGroup(ghostAircraft);
    ghostSamples = samples.map(({ tick, position, orientation }) => ({
      tick,
      position: { ...position },
      orientation: [...orientation],
    }));
    ghostVisual = null;
    ghostPose = null;
    ghostAircraft.visible = false;
    setPath(ghostSamples);
    if (!ghostSamples.length) return;
    ghostVisual = buildDroneVisual({
      parent: ghostAircraft,
      mesh,
      box,
      material: () =>
        material(0x95e9ef, {
          emissive: 0x247880,
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
    });
    const badge = label('PB', '#95e9ef', ghostAircraft, 0.48);
    if (badge) badge.position.y = 0.4;
    ghostAircraft.traverse((item) => {
      item.castShadow = false;
      item.receiveShadow = false;
    });
  }
  const ghostRotation = new THREE.Quaternion(),
    ghostNextRotation = new THREE.Quaternion();
  function updateGhost(tick) {
    if (!ghostSamples.length) return;
    const finalTick = ghostSamples.at(-1).tick,
      at = Math.max(0, Math.min(tick, finalTick));
    let low = 0,
      high = ghostSamples.length - 1;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (ghostSamples[middle].tick <= at) low = middle;
      else high = middle;
    }
    const from = ghostSamples[low],
      to = ghostSamples[high],
      alpha = to.tick === from.tick ? 0 : (at - from.tick) / (to.tick - from.tick),
      position = Object.fromEntries(
        ['x', 'y', 'z'].map((key) => [
          key,
          from.position[key] + (to.position[key] - from.position[key]) * alpha,
        ]),
      );
    ghostRotation.fromArray(from.orientation).normalize();
    ghostNextRotation.fromArray(to.orientation).normalize();
    ghostRotation.slerp(ghostNextRotation, alpha);
    ghostAircraft.position.set(
      position.x / 1000,
      (position.y + (course.rules?.droneRadius ?? 220)) / 1000,
      position.z / 1000,
    );
    ghostAircraft.quaternion.copy(ghostRotation);
    ghostAircraft.scale.setScalar((course.rules?.droneRadius ?? 220) / 220);
    // Hide overlap in FPV instead of filling the player's camera with a translucent body.
    ghostAircraft.visible =
      view !== 'editor' &&
      (view !== 'fpv' || ghostAircraft.position.distanceTo(camera.position) >= 0.65);
    if (!reducedMotion) for (const rotor of ghostVisual.rotors) rotor.rotation.y = at * 0.72;
    ghostPose = {
      tick: at,
      finished: tick >= finalTick,
      position,
      orientation: ghostRotation.toArray().map((value) => value * 1000000),
    };
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
      presentationGeneration++;
      for (const item of imported.userData.auxiliaryRoots) register(item);
      importedClips = result.animations;
      importedAnimationTick = null;
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
      else if (
        ['hold', 'land', 'rotation-v1', 'attitude-v1', 'path-v1', 'crossing-v1'].includes(
          step.type,
        ) &&
        step.min &&
        step.max
      )
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
    setGhost,
    ghostSnapshot: () => ({
      samples: ghostSamples.length,
      visible: ghostAircraft.visible,
      trail: Boolean(pathLine),
      pose: ghostPose ? structuredClone(ghostPose) : null,
    }),
    loadScene,
    async prepare({ signal } = {}) {
      const generation = sceneGeneration,
        presentation = presentationGeneration;
      signal?.throwIfAborted();
      if (disposed || !course || renderer.getContext().isContextLost()) return false;
      await renderer.compileAsync(scene, camera);
      signal?.throwIfAborted();
      if (
        disposed ||
        generation !== sceneGeneration ||
        presentation !== presentationGeneration ||
        renderer.getContext().isContextLost()
      )
        return false;
      // compileAsync waits for completion; it does not reject failed shader links.
      const gl = renderer.getContext();
      if (
        renderer.info.programs.some(
          (program) => gl.getProgramParameter(program.program, gl.LINK_STATUS) === false,
        )
      )
        throw new Error(
          'The graphics driver could not compile this scene. Try Performance graphics.',
        );
      return true;
    },
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
      importedAnimationTick = null;
    },
    setCosmetic(recipe) {
      if (/^#[a-fA-F0-9]{6}$/.test(recipe?.color)) {
        cosmeticColor = recipe.color;
        droneVisual.tint.color.set(cosmeticColor);
      }
    },
    resources() {
      return {
        available: true,
        disposed,
        quality,
        drone: droneKind,
        presentation: {
          actors: [...actorRows].map(([id, row]) => ({
            id,
            quality: row.quality,
            themeAsset: row.group.userData.themeAsset,
            heading: row.group.rotation.y,
            moving: row.moving,
          })),
          projectileBatches: pulseRows.size,
          activeProjectiles: [...pulseRows.values()].reduce(
            (total, batch) => total + batch.count,
            0,
          ),
          surfaceDetailGroups: qualityDetails.length,
        },
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
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
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
      scene.environment = null;
      environmentLight?.dispose();
      environmentLight = null;
      setGhost([]);
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
      goalRows.length = 0;
      actorRows.clear();
      actorDefinitions.clear();
      seenActors.clear();
      qualityDetails.length = 0;
      lastActorState = null;
      pulseRows.clear();
      droneVisual = null;
      obstacleMaps = null;
      obstacleSurface = null;
      sceneryFallback = null;
      themeProfile = null;
      course = null;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
