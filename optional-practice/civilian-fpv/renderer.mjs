import * as THREE from './vendor/three.module.js';
import { actorVisual } from '../../game/hunt/actor-catalog.mjs';
import { sharedActorAppearance, runtimeActorArtRevision } from '../../game/hunt/preferences.mjs';
import {
  INDUSTRIAL_VEHICLE_REVISION,
  buildIndustrialVehicle,
  resolveIndustrialVehicleModel,
} from './industrial-vehicles.mjs';
import {
  INDUSTRIAL_SOLDIER_REVISION,
  industrialSoldierPaintKeys,
  resolveIndustrialSoldierFamily,
  buildIndustrialSoldier,
  applyIndustrialSoldierPose,
} from './industrial-soldiers.mjs';
import {
  buildWorldVisuals,
  buildDroneVisual,
  buildContainerVisualGeometry,
  buildGarageSurfaceGeometry,
  buildStadiumStructureGeometry,
} from './world-visuals.mjs';
import {
  normalizeSimPresentation,
  resolveSimThemeProfile,
  resolveSimEffects,
} from './world-themes.mjs';
import {
  configureSimTextureSampling,
  createWorkshopMaterials,
  bindSimModelRole,
  instanceSimDetails,
  applySimMaterialBindings,
  ownedSimMaterials,
  simCollectionIdForProfile,
  setSurfaceQuality,
  createEnvironmentLight,
  simObjectiveLabelStyle,
  simObjectiveLabelLayout,
  createSimGateCueFactory,
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

/** Embedded/local world images use the existing img-src permission. The default
 * ImageBitmapLoader fetches blob URLs and instead requires connect-src blob:.
 * Keep the pinned GLTF parser, sampler/color-space rules and resource manager. */
export function configureWorldGLTFLoader(loader, { onImageError = () => {} } = {}) {
  return loader.register((parser) => ({
    name: 'REVEALLINE_WORLD_IMAGE_ELEMENT',
    beforeRoot() {
      const images = new THREE.TextureLoader(parser.options.manager)
        .setCrossOrigin(parser.options.crossOrigin)
        .setRequestHeader(parser.options.requestHeader);
      const load = images.load.bind(images);
      images.load = (url, onLoad, onProgress, onError) =>
        load(url, onLoad, onProgress, (error) => {
          // GLTFLoader revokes embedded blob URLs on success, but not on error.
          // Provided sidecar URLs belong to loadScene's existing finally block.
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          onImageError(error);
          onError?.(error);
        });
      parser.textureLoader = images;
    },
  }));
}

/** Presentation only. All world/actor positions are canonical millimetres.
 * Decorative structures remain outside the course; criteria are holograms. */
export function createFlightRenderer({
  canvas,
  window: win = globalThis.window,
  onContextLost = () => {},
  reducedMotion = false,
  loadGLTF = null,
  loadTransformControls = null,
  presentation: initialPresentation = {},
  createHuntPresentation = null,
}) {
  let machineryRevision = runtimeActorArtRevision(win?.location);
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
  let huntPresentation = createHuntPresentation?.({ THREE, scene }) ?? null;
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
    cosmeticColor = null,
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
    contextGeneration = 0,
    presentationGeneration = 0,
    rotorTick = null,
    rotorPhase = 0,
    importGeneration = 0,
    importedMixer = null,
    importedClips = [],
    importedMaterialBindings = { applied: 0, diagnostics: [] },
    obstacleMaps = null,
    obstacleSurface = null,
    obstacleFittingsMaterial = null,
    garageDetailMaterial = null,
    environmentSurfaceKind = null,
    lastActorState = null,
    importedAnimationTick = null,
    environmentLight = null,
    environmentLightInputs = null,
    themeProfile = null,
    effectPalette = resolveSimEffects(null),
    goalMaterialKit = null,
    stadiumMaterial = null,
    gateCueFactory = null,
    pendingPresentation = normalizeSimPresentation(initialPresentation),
    activePresentation = pendingPresentation,
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
    huntTargets = new Map(),
    seenActors = new Set(),
    pulseRows = new Map(),
    garageDetailMaterials = new Map(),
    stadiumDetailMaterials = new Map(),
    qualityDetails = [];
  const framePosition = new THREE.Vector3(),
    frameRotation = new THREE.Quaternion(),
    cameraOffset = new THREE.Vector3(),
    cameraTiltRotation = new THREE.Quaternion(),
    cameraTiltAxis = new THREE.Vector3(1, 0, 0),
    pulseTransform = new THREE.Matrix4();
  const labelPosition = new THREE.Vector3();
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
      for (const paint of [
        ...(Array.isArray(item.material) ? item.material : [item.material]),
        ...ownedSimMaterials(item),
      ])
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
        if (item.isInstancedMesh) instances.add(item);
        if (item.skeleton) skeletons.add(item.skeleton);
        for (const paint of [
          ...(Array.isArray(item.material) ? item.material : [item.material]),
          ...ownedSimMaterials(item),
          item.customDepthMaterial,
          item.customDistanceMaterial,
        ])
          if (paint) {
            paints.add(paint);
            for (const texture of texturesOf(paint)) textures.add(texture);
          }
        if (item.userData?.ownedMaterials) item.userData.ownedMaterials = [];
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
    importedMaterialBindings = { applied: 0, diagnostics: [] };
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
  function label(text, color, parent, size = 0.8, objective = false) {
    const surface = canvas.ownerDocument.createElement('canvas');
    surface.width = 128;
    surface.height = 128;
    const context = surface.getContext('2d');
    if (!context) return null;
    const legibility = objective ? simObjectiveLabelStyle(themeProfile) : null;
    context.fillStyle =
      legibility?.background ??
      (themeProfile ? `#${themeProfile.palette.wall.toString(16).padStart(6, '0')}` : '#132b39');
    context.beginPath();
    context.arc(64, 64, 59, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = color;
    context.stroke();
    context.fillStyle = legibility?.foreground ?? '#f1f9e8';
    context.font = legibility
      ? `800 ${text.length > 2 ? 38 : 76}px sans-serif`
      : `700 ${text.length > 2 ? 32 : 66}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 68);
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    const paint = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    materials.add(paint);
    const sprite = new THREE.Sprite(paint);
    sprite.scale.set(size, size, 1);
    if (legibility) sprite.userData.objectiveLabelBaseSize = size;
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
    for (const texture of new Set([...materials].flatMap(texturesOf)))
      if (texture.userData?.simSurface)
        configureSimTextureSampling(texture, quality, renderer.capabilities.getMaxAnisotropy());
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
    droneVisual = buildDroneVisual({
      parent: aircraft,
      mesh,
      material,
      box,
      kind: value,
      profile: themeProfile ?? resolveSimThemeProfile({}, activePresentation),
      quality,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      reviewRevision: machineryRevision,
    });
    if (cosmeticColor) droneVisual.tint.color.set(cosmeticColor);
    if ((themeProfile?.id ?? activePresentation?.collectionId) === 'military-field') {
      for (const [index, color] of [0x4eb8ee, 0xffd74d].entries()) {
        const stripe = mesh(new THREE.BoxGeometry(0.045, 0.002, 0.018), material(color), aircraft);
        stripe.position.set(0, value === 'pixel' ? 0.064 : 0.06, 0.009 + index * 0.018);
      }
    }
    for (const [index, rotor] of droneVisual.rotors.entries())
      rotor.rotation.y = rotorPhase * (index === 0 || index === 3 ? -1 : 1);
    setSurfaceQuality(materials, quality, renderer.capabilities.getMaxAnisotropy());
  }
  function setPresentation(value) {
    // A prepared choice takes effect only when the owner installs a fresh course.
    pendingPresentation = normalizeSimPresentation(value);
    return pendingPresentation;
  }
  function lineVolume(step, index) {
    const group = new THREE.Group();
    group.userData.modelRole = step.type === 'gate' ? 'gate' : 'marker';
    group.userData.assetRole = themeProfile?.assets?.[step.type === 'gate' ? 'gate' : 'marker'];
    if (goalMaterialKit)
      bindSimModelRole(group, group.userData.modelRole, goalMaterialKit.collectionId);
    goals.add(group);
    let size, position;
    if (step.type === 'actor-track-v1') {
      // Small observer-only subject bracket. Range and visibility are evaluated
      // by the fixed-step runtime, independent of camera and quality settings.
      const shape = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.65, 0.3, 0),
        new THREE.Vector3(-0.65, 0.65, 0),
        new THREE.Vector3(-0.65, 0.65, 0),
        new THREE.Vector3(-0.3, 0.65, 0),
        new THREE.Vector3(0.65, 0.3, 0),
        new THREE.Vector3(0.65, 0.65, 0),
        new THREE.Vector3(0.65, 0.65, 0),
        new THREE.Vector3(0.3, 0.65, 0),
      ]);
      geometry.add(shape);
      const paint = new THREE.LineBasicMaterial({
        color: 0xffca76,
        transparent: true,
        opacity: 1,
        toneMapped: false,
      });
      materials.add(paint);
      const marker = new THREE.LineSegments(shape, paint);
      group.add(marker);
      const light = material(0xffca76, { transparent: true, opacity: 1 });
      group.userData.ownedMaterials = [light];
      const badge = label(String(index + 1).padStart(2, '0'), '#ffca76', group, 0.48, true);
      if (badge) badge.position.y = 0.92;
      group.visible = false;
      goalRows.push({ group, paint, light, marker, badge, index, actorId: step.actorId });
      return;
    }
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
      color: effectPalette.goalOutline,
      transparent: true,
      opacity: 0.3,
      toneMapped: false,
    });
    materials.add(paint);
    group.add(new THREE.LineSegments(edges, paint));
    group.position.set(...position);
    const light = material(effectPalette.goalGlow, {
      emissive: effectPalette.goalEmissive,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    let gateCue = null;
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
      if (goalMaterialKit) {
        // Fastener plates occupy the existing 45 mm frame, never its clear opening.
        const matrices = [];
        for (const side of [-1, 1])
          for (const top of [-1, 1])
            matrices.push(
              new THREE.Matrix4().makeTranslation(
                horizontal ? (side * span) / 2 : 0,
                (top * size[1]) / 2,
                horizontal ? 0 : (side * span) / 2,
              ),
            );
        instanceSimDetails({
          shape: new THREE.BoxGeometry(0.034, 0.034, 0.034),
          paint: goalMaterialKit.paint('steel'),
          parent: group,
          matrices,
          mesh,
        });
      }
      gateCue = gateCueFactory?.({ axis: step.axis, span, height: size[1] }) ?? null;
      if (gateCue) {
        register(gateCue);
        group.add(gateCue);
      }
    }
    const marker = mesh(
      new THREE.TorusGeometry(0.35, 0.045, 6, goalMaterialKit ? 8 : 24),
      light,
      group,
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.y = -position[1] + (step.type === 'land' ? step.min.y / 1000 : 0) + 0.05;
    const badge = label(
      String(index + 1).padStart(2, '0'),
      `#${effectPalette.goalBadge.toString(16).padStart(6, '0')}`,
      group,
      0.72,
      true,
    );
    if (badge) badge.position.set(0, size[1] / 2 + 0.5, 0);
    const row = { group, paint, light, marker, badge, gateCue, index };
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
        effectPalette.directionArrow,
        0.25,
        0.18,
      );
      group.add(arrow);
      register(arrow);
    }
  }
  function obstacleSurfaceKind(obstacle) {
    const authored = environmentSurfaceKind?.(obstacle);
    if (authored) return authored;
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
  function solarPanelUV(shape, size) {
    const p = shape.getAttribute('position'),
      n = shape.getAttribute('normal'),
      uv = shape.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      // Only the local upper face is photovoltaic. Keep the closed back and
      // thickness in the atlas's quiet strip; the authored tilt stays intact.
      const top = n.getY(i) > 0.5,
        across = Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) / size[2] : p.getX(i) / size[0],
        along = Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) / size[2] : p.getY(i) / size[1];
      uv.setXY(
        i,
        0.015 + (across + 0.5) * 0.97,
        (top ? 0.17 : 0.02) + (along + 0.5) * (top ? 0.81 : 0.1),
      );
    }
  }
  function garageStructureUV(shape, obstacle) {
    const positions = shape.getAttribute('position'),
      normals = shape.getAttribute('normal'),
      offset = ['x', 'y', 'z'].map((axis) =>
        obstacle.type === 'trimesh' ? 0 : (obstacle.max[axis] + obstacle.min[axis]) / 2000,
      ),
      uv = new Float32Array(positions.count * 2);
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index) + offset[0],
        y = positions.getY(index) + offset[1],
        z = positions.getZ(index) + offset[2],
        nx = Math.abs(normals.getX(index)),
        ny = Math.abs(normals.getY(index)),
        nz = Math.abs(normals.getZ(index));
      // World-aligned six-metre pours cross the ramp/deck crest continuously.
      // Positions, winding, and all physical triangles remain untouched.
      uv[index * 2] = (nx > ny && nx > nz ? z : x) / 6;
      uv[index * 2 + 1] = (ny >= nx && ny >= nz ? z : y) / 6;
    }
    shape.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  function addGarageSurfaceDetails(parent, obstacle) {
    for (const { role, layer, geometry: shape } of buildGarageSurfaceGeometry(obstacle)) {
      const key = `${role}:${layer}`;
      if (!garageDetailMaterials.has(key)) {
        const paint = garageDetailMaterial(role).clone();
        paint.side = THREE.DoubleSide;
        paint.polygonOffset = true;
        paint.polygonOffsetFactor = -layer;
        paint.polygonOffsetUnits = -layer;
        materials.add(paint);
        garageDetailMaterials.set(key, paint);
      }
      const detail = mesh(shape, garageDetailMaterials.get(key), parent);
      detail.name = `garage-surface-${role}`;
      detail.userData.role = 'garage-surface-detail';
      detail.userData.obstacleId = obstacle.id;
      detail.userData.materialRole = role;
      detail.userData.cosmeticDetail = true;
      detail.castShadow = false;
      detail.receiveShadow = true;
    }
  }
  function woodlandTrunkUV(shape, size) {
    const positions = shape.getAttribute('position'),
      normals = shape.getAttribute('normal'),
      uv = shape.getAttribute('uv'),
      [width, height, depth] = size;
    for (let i = 0; i < positions.count; i++) {
      const nx = normals.getX(i),
        ny = normals.getY(i),
        nz = normals.getZ(i),
        cross = Math.abs(nx) > 0.5 ? positions.getZ(i) / depth : positions.getX(i) / width,
        phase = nx > 0.5 ? 0.17 : nx < -0.5 ? 0.42 : nz < -0.5 ? 0.71 : 0;
      // One root-anchored atlas per trunk, not a repeating moss band. Caps use
      // the existing atlas's end strips; no extra geometry, material or texture.
      uv.setXY(
        i,
        cross + 0.5 + phase,
        Math.abs(ny) > 0.5
          ? (ny > 0 ? 0.92 : 0.02) + (positions.getZ(i) / depth + 0.5) * 0.05
          : 0.005 + ((positions.getY(i) + height / 2) / height) * 0.99,
      );
    }
  }
  function storageModuleUV(shape, size, plainSteel = false) {
    const positions = shape.getAttribute('position'),
      normals = shape.getAttribute('normal'),
      uv = shape.getAttribute('uv'),
      [width, height, depth] = size;
    for (let i = 0; i < positions.count; i++) {
      const across =
        Math.abs(normals.getX(i)) > 0.5 ? positions.getZ(i) / depth : positions.getX(i) / width;
      // School beams/dividers are plain painted steel, not scaled-down doors.
      if (plainSteel) {
        uv.setXY(
          i,
          0.07 + (across + 0.5) * 0.1,
          0.14 +
            (Math.abs(normals.getY(i)) > 0.5
              ? positions.getZ(i) / depth + 0.5
              : positions.getY(i) / height + 0.5) *
              0.12,
        );
        continue;
      }
      // Keep the body inside the atlas's left half, away from label gutters.
      // The cap uses a plain end strip, so no bay numerals appear on the roof.
      uv.setXY(
        i,
        0.008 + (across + 0.5) * 0.484,
        Math.abs(normals.getY(i)) > 0.5
          ? 0.012 + (positions.getZ(i) / depth + 0.5) * 0.025
          : 0.06 + (positions.getY(i) / height + 0.5) * 0.88,
      );
    }
  }
  function stadiumStructureUV(shape, kind) {
    const positions = shape.getAttribute('position'),
      normals = shape.getAttribute('normal'),
      uv = shape.getAttribute('uv');
    for (let i = 0; i < positions.count; i++) {
      const side = Math.abs(normals.getX(i)) > 0.5,
        cap = Math.abs(normals.getY(i)) > 0.5;
      uv.setXY(
        i,
        (side ? positions.getZ(i) : positions.getX(i)) / 6,
        (cap ? positions.getZ(i) : positions.getY(i)) / (kind === 'stadium-concrete' ? 2 : 3),
      );
    }
  }
  function stadiumStructureDetail(parent, size) {
    for (const { role, layer, geometry: shape } of buildStadiumStructureGeometry(
      parent.name,
      size,
    )) {
      const key = `${role}:${layer}`;
      if (!stadiumDetailMaterials.has(key)) {
        const source = stadiumMaterial?.(role),
          palette = themeProfile.palette,
          color =
            role === 'rubber'
              ? new THREE.Color(palette.wall).multiplyScalar(0.18)
              : role === 'enamel'
                ? new THREE.Color(palette.accent).lerp(new THREE.Color(0xe0e1d8), 0.55)
                : new THREE.Color(palette.wall).lerp(new THREE.Color(palette.warm), 0.12),
          paint = source
            ? source.clone()
            : material(color, { roughness: role === 'rubber' ? 0.96 : 0.7 });
        materials.add(paint);
        paint.name = `stadium-${role}`;
        paint.polygonOffset = true;
        paint.polygonOffsetFactor = -layer;
        paint.polygonOffsetUnits = -layer;
        paint.userData = { ...paint.userData, materialRole: role };
        stadiumDetailMaterials.set(key, paint);
      }
      const detail = mesh(shape, stadiumDetailMaterials.get(key), parent);
      detail.name = 'stadium-structure-detail';
      detail.userData = {
        role: 'stadium-structure-detail',
        obstacleId: parent.name,
        materialRole: role,
        cosmeticDetail: true,
      };
      detail.castShadow = false;
      detail.receiveShadow = true;
    }
  }
  function addFlushPanels(parent, panels, color, minimumQuality = 'balanced', bayLabel = null) {
    if (!panels.length) return;
    const positions = [],
      normals = [],
      uvs = [];
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
        if (bayLabel)
          uvs.push(
            0.5 + ((bayLabel.index % 2) + 0.04 + (u + 1) * 0.46) / 4,
            (Math.floor(bayLabel.index / 2) + 0.04 + (v + 1) * 0.46) / 3,
          );
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
    if (bayLabel) shape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const paint = material(color, {
      ...(bayLabel ? { map: bayLabel.map } : {}),
      roughness: 0.62,
      metalness: 0.15,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const panelsMesh = mesh(shape, paint, parent);
    panelsMesh.name = 'flush-surface-markings';
    if (bayLabel) panelsMesh.userData.materialRole = 'enamel';
    panelsMesh.userData.minimumQuality = minimumQuality;
    panelsMesh.visible = quality === 'high' || (minimumQuality === 'balanced' && quality !== 'low');
    qualityDetails.push(panelsMesh);
  }
  function renderObstacle(obstacle, index) {
    const theme = themeProfile.palette,
      kind = obstacleSurfaceKind(obstacle),
      yardContainer =
        course.environment === 'container-yard' &&
        /^container-[01]-[0-2]$/.test(obstacle.id ?? '') &&
        themeProfile.textureFilter !== 'nearest' &&
        ['x', 'y', 'z'].every((axis) => obstacle.max?.[axis] - obstacle.min?.[axis] >= 1000);
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
          yardContainer ? 0.08 : kind === 'plaster' ? 0.13 : 0.3,
          yardContainer ? 0.08 : kind === 'plaster' ? 0.13 : 0.3,
        ),
        roughness: yardContainer
          ? 0.82
          : kind === 'solar-array'
            ? 0.8
            : kind === 'solar'
              ? 0.3
              : kind === 'metal' || kind === 'stadium-steel'
                ? 0.66
                : kind === 'storage-steel'
                  ? 0.74
                  : 0.9,
        metalness: yardContainer
          ? 0.12
          : kind === 'solar' || kind === 'solar-array'
            ? 0.35
            : kind === 'metal' || kind === 'stadium-steel'
              ? 0.28
              : kind === 'storage-steel'
                ? 0.18
                : 0,
      },
    );
    let value, size, containerHardware;
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
      if (kind === 'garage-concrete') garageStructureUV(shape, obstacle);
      else if (obstacleSurface) worldScaleUV(shape);
      paint.side = THREE.DoubleSide;
      value = mesh(shape, paint);
    } else if (obstacle.min && obstacle.max) {
      size = ['x', 'y', 'z'].map((key) => (obstacle.max[key] - obstacle.min[key]) / 1000);
      const container = yardContainer ? buildContainerVisualGeometry(size) : null,
        shape = container?.shell ?? new THREE.BoxGeometry(...size);
      containerHardware = container?.hardware;
      if (kind === 'solar-array') solarPanelUV(shape, size);
      else if (kind === 'storage-steel')
        storageModuleUV(shape, size, !/^rack-[01]-[0-2]$/.test(obstacle.id));
      else if (kind === 'stadium-concrete' || kind === 'stadium-steel')
        stadiumStructureUV(shape, kind);
      else if (kind === 'bark') woodlandTrunkUV(shape, size);
      else if (kind === 'garage-concrete') garageStructureUV(shape, obstacle);
      // Reuse the same world-metre projection so mineral beds share height
      // across the six canonical Quarry masses; only their UVs are replaced.
      else if (kind === 'quarry-stone') garageStructureUV(shape, obstacle);
      else if (obstacleSurface) worldScaleUV(shape);
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
    if (goalMaterialKit) bindSimModelRole(value, 'obstacle', goalMaterialKit.collectionId);
    value.userData.materialRole = ['field', 'woodland'].includes(course.environment)
      ? 'timber'
      : 'steel';
    value.userData.surfaceKind = kind;
    if (kind === 'storage-steel') value.userData.materialRole = 'steel';
    if (kind === 'bark') value.userData.materialRole = 'timber';
    if (kind === 'garage-concrete') value.userData.materialRole = 'concrete';
    if (kind === 'stadium-concrete') value.userData.materialRole = 'concrete';
    if (kind === 'quarry-stone') value.userData.materialRole = 'concrete';
    value.castShadow = value.receiveShadow = true;
    if (kind === 'garage-concrete' && garageDetailMaterial)
      addGarageSurfaceDetails(value, obstacle);
    if (size && (kind === 'stadium-concrete' || kind === 'stadium-steel'))
      stadiumStructureDetail(value, size);
    if (containerHardware) {
      worldScaleUV(containerHardware);
      // Brushed fittings must read against painted doors without emissive
      // highlights or another texture. Both finishes remain world-owned.
      const fittings = mesh(containerHardware, obstacleFittingsMaterial?.() ?? paint, value);
      fittings.name = 'container-door-hardware';
      fittings.userData.materialRole = 'steel';
      fittings.userData.minimumQuality = 'balanced';
      fittings.castShadow = fittings.receiveShadow = true;
      fittings.visible = quality !== 'low';
      qualityDetails.push(fittings);
    }
    if (size && size[1] > 0.5) {
      const panels = [],
        accents = [],
        [width, height, depth] = size,
        railWagon =
          course.environment === 'rail-depot' &&
          kind === 'metal' &&
          /^rail-car-[01]-[0-3]$/.test(obstacle.id ?? '') &&
          themeProfile.id === 'operations' &&
          themeProfile.textureFilter === 'linear' &&
          !goalMaterialKit &&
          obstacle.type === undefined &&
          obstacle.rotation === undefined &&
          ['x', 'y', 'z'].every(
            (axis, i) =>
              Number.isFinite(obstacle.min?.[axis]) &&
              Number.isFinite(obstacle.max?.[axis]) &&
              obstacle.max[axis] - obstacle.min[axis] === [5000, 4000, 13000][i],
          ),
        campusSize = {
          'building-west-low': [18000, 9000, 20000],
          'building-east-mid': [18000, 14000, 20000],
          'building-west-high': [18000, 19000, 22000],
          'building-east-high': [18000, 23000, 22000],
        }[obstacle.id],
        campusStories =
          course.environment === 'rooftops' &&
          kind === 'plaster' &&
          themeProfile.id === 'pixel' &&
          themeProfile.textureFilter === 'nearest' &&
          !goalMaterialKit &&
          obstacle.type === undefined &&
          obstacle.rotation === undefined &&
          campusSize &&
          ['x', 'y', 'z'].every(
            (axis, i) =>
              Number.isFinite(obstacle.min[axis]) &&
              Number.isFinite(obstacle.max[axis]) &&
              obstacle.max[axis] - obstacle.min[axis] === campusSize[i],
          )
            ? Math.floor(height / 3)
            : 0,
        campusBridge = campusStories
          ? course.obstacles.find(
              (item) =>
                item.id === 'roof-deck-skybridge' &&
                item.type === undefined &&
                item.rotation === undefined &&
                ['x', 'y', 'z'].every(
                  (axis, i) =>
                    Number.isFinite(item.min?.[axis]) &&
                    Number.isFinite(item.max?.[axis]) &&
                    item.max[axis] - item.min[axis] === [50000, 1200, 6000][i],
                ),
            )
          : null;
      for (let side = 0; side < 4; side++) {
        const span = side < 2 ? width : depth,
          half = (side < 2 ? depth : width) / 2;
        if (kind === 'plaster' && span > 2 && height > 2) {
          const count = Math.max(1, Math.min(5, Math.floor(span / 2.4))),
            floors = campusStories || Math.min(3, Math.floor(height / 2.2)),
            storeyHeight = campusStories ? height / floors : 2.2;
          for (let i = 0; i < count; i++)
            for (let floor = 0; floor < floors; floor++) {
              const along = -span / 2 + ((i + 0.5) * span) / count,
                elevation =
                  -height / 2 + (campusStories ? storeyHeight / 2 : 1.4) + floor * storeyHeight,
                paneWidth = Math.min(campusStories ? 2 : 1.1, (span / count) * 0.55),
                paneHeight = campusStories ? Math.min(1.5, storeyHeight * 0.5) : 1.05;
              if (campusBridge) {
                const faceAxis = side < 2 ? 'z' : 'x',
                  alongAxis = side < 2 ? 'x' : 'z',
                  face = (side === 0 || side === 2 ? obstacle.max : obstacle.min)[faceAxis],
                  u =
                    (obstacle.min[alongAxis] + obstacle.max[alongAxis]) / 2 +
                    (side === 1 || side === 2 ? -along : along) * 1000,
                  y = (obstacle.min.y + obstacle.max.y) / 2 + elevation * 1000;
                // Keep solid bridge attachments as closed painted bays rather
                // than clipping a pane through the existing collision volume.
                if (
                  face >= campusBridge.min[faceAxis] &&
                  face <= campusBridge.max[faceAxis] &&
                  u + paneWidth * 500 > campusBridge.min[alongAxis] &&
                  u - paneWidth * 500 < campusBridge.max[alongAxis] &&
                  y + paneHeight * 500 > campusBridge.min.y &&
                  y - paneHeight * 500 < campusBridge.max.y
                )
                  continue;
              }
              panels.push([side, along, elevation, paneWidth, paneHeight, half]);
            }
          accents.push([side, 0, -height / 2 + 0.25, span, 0.24, half]);
          if (campusStories) {
            // Painted storeys and corner piers share the existing two flush
            // batches. Every opaque pane stays on the original closed wall.
            for (let floor = 1; floor < floors; floor++)
              accents.push([side, 0, -height / 2 + floor * storeyHeight, span - 0.48, 0.18, half]);
            for (const edge of [-1, 1])
              accents.push([side, edge * (span / 2 - 0.12), 0.05, 0.24, height - 0.7, half]);
            accents.push([side, 0, height / 2 - 0.15, span, 0.3, half]);
          }
        } else if ((kind === 'metal' || kind === 'storage-steel') && span > 1) {
          if (!yardContainer)
            accents.push([
              side,
              0,
              -height * 0.34,
              span * 0.96,
              Math.min(0.12, height * 0.08),
              half,
            ]);
          if (/container|rack/.test(obstacle.id))
            panels.push([
              side,
              span * 0.26,
              height * 0.12,
              Math.min(0.5, span * 0.16),
              Math.min(0.3, height * 0.18),
              half,
            ]);
          if (railWagon) {
            // Framing stays on the existing closed corrugated wall. Strips
            // meet edge-to-edge and share the wagon's existing accent batch.
            const jamb = side < 2 ? 2.15 : 1.6;
            for (const direction of [-1, 1]) {
              accents.push([side, direction * jamb, 0.2, 0.12, 2.6, half]);
              accents.push([side, 0, 0.2 + direction * 1.24, jamb * 2 - 0.12, 0.12, half]);
              if (side >= 2) accents.push([side, direction * 5.2, 0.2, 0.12, 2.9, half]);
            }
          }
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
      const bay = kind === 'storage-steel' ? obstacle.id.match(/^rack-([01])-([0-2])$/) : null;
      addFlushPanels(
        value,
        panels,
        kind === 'plaster' ? 0x456475 : 0xe7e7cf,
        'balanced',
        bay ? { map: maps.map, index: Number(bay[1]) * 3 + Number(bay[2]) } : null,
      );
      addFlushPanels(
        value,
        accents,
        railWagon ? 0x34464b : kind === 'plaster' ? 0x8c7863 : theme.warm,
        railWagon ? 'balanced' : 'high',
      );
    }
    // Only the outer shipping-frame edges are outlined, not every corrugation.
    const outline = yardContainer ? new THREE.BoxGeometry(...size) : value.geometry,
      edges = new THREE.EdgesGeometry(outline, 30);
    if (yardContainer) outline.dispose();
    geometry.add(edges);
    const edgePaint = new THREE.LineBasicMaterial({
      color: yardContainer ? paint.color : kind === 'bark' ? 0x625747 : theme.warm,
      transparent: true,
      opacity: yardContainer ? 0.1 : kind === 'bark' ? 0.12 : 0.22,
    });
    materials.add(edgePaint);
    value.add(new THREE.LineSegments(edges, edgePaint));
  }
  function releaseEnvironmentLight() {
    scene.environment = null;
    const previous = environmentLight;
    environmentLight = null;
    environmentLightInputs = null;
    previous?.dispose();
  }
  function setEnvironmentLight({ sky, ground, indoor }) {
    if (renderer.getContext().isContextLost()) {
      releaseEnvironmentLight();
      return;
    }
    const inputs = {
      sky: new THREE.Color(sky),
      ground: new THREE.Color(ground),
      indoor: Boolean(indoor),
    };
    // One renderer owns one probe. Compare linear channels without hex rounding:
    // the resolved floor color can contain a full-precision theme blend.
    if (
      environmentLight &&
      environmentLightInputs?.sky.equals(inputs.sky) &&
      environmentLightInputs.ground.equals(inputs.ground) &&
      environmentLightInputs.indoor === inputs.indoor
    )
      return;
    releaseEnvironmentLight();
    environmentLight = createEnvironmentLight(renderer, inputs);
    environmentLightInputs = inputs;
  }
  function setCourse(value, selectedMode = 'self-level', options = {}) {
    if (disposed || renderer.getContext().isContextLost()) return;
    huntPresentation ??= createHuntPresentation?.({ THREE, scene }) ?? null;
    machineryRevision = Object.hasOwn(options, 'artRevision')
      ? options.artRevision
      : runtimeActorArtRevision(win?.location);
    if (options.presentation) setPresentation(options.presentation);
    activePresentation = pendingPresentation;
    sceneGeneration++;
    presentationGeneration++;
    rotorTick = null;
    rotorPhase = 0;
    setGhost([]);
    editor?.detach();
    course = value;
    mode = selectedMode;
    huntPresentation?.reset();
    huntTargets.clear();
    for (const step of course.steps[mode])
      if (step.type === 'hunt-contact-v1')
        step.targets.forEach((id, index) => huntTargets.set(id, index + 1));
    for (const policy of course.pursuit?.actors ?? [])
      if (policy.family === 'courier') huntTargets.set(policy.id, 0);
    currentStep = -1;
    clearImported();
    scene.environment = null;
    for (const group of [world, goals, actors, projectiles]) releaseGroup(group);
    garageDetailMaterials.clear();
    stadiumDetailMaterials.clear();
    goalRows.length = 0;
    actorRows.clear();
    actorDefinitions.clear();
    qualityDetails.length = 0;
    lastActorState = null;
    pulseRows.clear();
    const surroundings = buildWorldVisuals({
      course,
      world,
      mesh,
      material,
      box,
      presentation: activePresentation,
      quality,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      reviewRevision: machineryRevision,
    });
    register(world);
    const theme = surroundings.theme;
    themeProfile = surroundings.profile;
    effectPalette = resolveSimEffects(themeProfile);
    gateCueFactory = createSimGateCueFactory(themeProfile);
    goalMaterialKit = simCollectionIdForProfile(themeProfile)
      ? createWorkshopMaterials({
          collectionId: simCollectionIdForProfile(themeProfile),
          material,
          quality,
          maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
          reviewRevision: machineryRevision,
        })
      : null;
    setDrone(droneKind);
    sceneryFallback = surroundings.backdrop;
    obstacleMaps = surroundings.obstacleMaps;
    obstacleSurface = surroundings.obstacleSurface ?? null;
    obstacleFittingsMaterial = surroundings.obstacleFittingsMaterial ?? null;
    garageDetailMaterial = surroundings.garageDetailMaterial ?? null;
    stadiumMaterial = surroundings.stadiumDetailMaterial ?? null;
    environmentSurfaceKind = surroundings.obstacleSurfaceKind ?? null;
    scene.background = new THREE.Color(surroundings.indoor ? theme.wall : theme.sky);
    // Visibility is a course property, identical across graphics presets.
    scene.fog = new THREE.Fog(
      theme.fog,
      ...(surroundings.fogRange ?? [surroundings.indoor ? 55 : 85, 210]),
    );
    hemisphere.groundColor
      .copy(surroundings.groundColor ?? new THREE.Color(theme.ground))
      .multiplyScalar(0.4);
    setEnvironmentLight({
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
    const animated = {
      rotors: [],
      wheels: [],
      limbs: [],
      body: null,
      armorTell: null,
      intent: null,
    };
    actors.add(group);
    const radius = (actor.radius ?? 300) / 1000,
      height = (actor.height ?? 1800) / 1000,
      role = actor.type === 'hazard' ? 'hazard' : (actor.role ?? 'hostile'),
      huntTarget = huntTargets.has(actor.id),
      military = themeProfile?.id === 'military-field',
      friendly = huntTarget || role === 'rival' || role === 'civilian',
      slot = actor.type === 'vehicle' ? themeProfile?.assets?.vehicle : themeProfile?.assets?.enemy,
      pixel = themeProfile?.characters === 'arcade' || /pixel|arcade/.test(slot ?? ''),
      detailed = quality === 'high',
      civilian = !huntTarget && (themeProfile?.characters === 'civilian' || role === 'civilian');
    const preferredCast = sharedActorAppearance().snapshot().cast;
    const huntFamily =
      actor.pursuit?.family ??
      course.pursuit?.actors.find((policy) => policy.id === actor.id)?.family ??
      ((actorDefinitions.get(actor.id)?.speed ?? actor.speed ?? 0) > 0 ? 'patroller' : 'lookout');
    const nativeSoldierFamily = resolveIndustrialSoldierFamily({
      revision: machineryRevision,
      actor: actorDefinitions.get(actor.id) ?? actor,
      family: huntFamily,
      huntTarget,
      collectionId: simCollectionIdForProfile(themeProfile),
      collectionRevision: themeProfile?.revision,
      assetRole: slot,
    });
    const huntAppearance = huntTarget
      ? actorVisual(huntFamily, preferredCast === 'authored' ? 'rivals' : preferredCast)
      : null;
    group.name = `actor-${actor.id}`;
    group.userData.themeAsset = slot ?? 'builtin:sentry';
    if (actor.position)
      group.position.set(actor.position.x / 1000, actor.position.y / 1000, actor.position.z / 1000);
    const kit = simCollectionIdForProfile(themeProfile)
      ? createWorkshopMaterials({
          collectionId: simCollectionIdForProfile(themeProfile),
          material,
          quality,
          maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
          reviewRevision: machineryRevision,
        })
      : null;
    group.userData.modelRole = actor.type === 'vehicle' ? 'vehicle' : 'enemy';
    group.userData.assetRole = themeProfile?.assets?.[group.userData.modelRole];
    if (kit) bindSimModelRole(group, group.userData.modelRole, kit.collectionId);
    const armor = huntTarget
      ? material(huntAppearance.palette.coat, { roughness: 0.8 })
      : kit
        ? kit.paint('steel')
        : material(friendly ? 0x74bfc0 : pixel ? 0xa785cb : civilian ? 0x839c9d : 0x778b86, {
            metalness: civilian ? 0.08 : 0.35,
            roughness: civilian ? 0.84 : 0.55,
          });
    const threat = material(friendly ? 0x77ebe0 : 0xf1ae75, {
      emissive: friendly ? 0x249eaa : 0xb86231,
      emissiveIntensity: 0.5,
    });
    const dark = kit ? kit.paint('rubber') : material(0x283e47, { roughness: 0.78 });
    const trousers = huntTarget ? material(huntAppearance.palette.pants, { roughness: 0.9 }) : dark;
    const metal = kit
      ? kit.paint('copper')
      : quality === 'low'
        ? dark
        : material(0xa9b7b8, { metalness: 0.72, roughness: 0.34 });
    const glass =
      quality === 'low' ? dark : material(0x456975, { metalness: 0.25, roughness: 0.17 });
    group.userData.ownedMaterials = [armor, threat, dark, trousers, metal, glass];
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
        profile: themeProfile,
        maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
        reviewRevision: machineryRevision,
      });
      visual.tint.color.setHex(friendly ? 0x77ebe0 : 0xe6a16b);
      animated.rotors = visual.rotors;
    } else if (
      machineryRevision === INDUSTRIAL_VEHICLE_REVISION &&
      resolveIndustrialVehicleModel({
        actor: actorDefinitions.get(actor.id) ?? actor,
        courseFormat: course.format,
        collectionId: simCollectionIdForProfile(themeProfile),
        collectionRevision: themeProfile?.revision,
        assetRole: slot,
      })
    ) {
      const model = resolveIndustrialVehicleModel({
        actor: actorDefinitions.get(actor.id) ?? actor,
        courseFormat: course.format,
        collectionId: simCollectionIdForProfile(themeProfile),
        collectionRevision: themeProfile?.revision,
        assetRole: slot,
      });
      const visual = buildIndustrialVehicle({
        THREE,
        parent: group,
        part,
        model,
        radius,
        quality,
        paints: { armor, dark, metal, glass, threat },
      });
      animated.wheels = visual.wheels;
      animated.radar = visual.radar;
      group.userData.nativeVehicleModel = model;
      group.userData.machineryRevision = machineryRevision;
    } else if (actor.type === 'vehicle' && actorDefinitions.get(actor.id)?.vehicleModel) {
      const model = actorDefinitions.get(actor.id).vehicleModel;
      const tracked = model === 'field-tank';
      const carrier = model === 'armored-carrier';
      const cargo = model === 'cargo-truck' || model === 'relay-truck';
      // Original compact field machines share the native vehicle proxy and route.
      // Distinct silhouettes add no new weapons, armor or damage rules.
      part(new THREE.BoxGeometry(radius * 1.25, radius * 0.35, radius * 1.55), armor, [
        0,
        radius * 0.47,
        0,
      ]);
      if (tracked) {
        for (const side of [-1, 1]) {
          part(new THREE.BoxGeometry(radius * 0.3, radius * 0.38, radius * 1.68), dark, [
            side * radius * 0.61,
            radius * 0.27,
            0,
          ]);
          if (quality !== 'low')
            for (let t = -3; t <= 3; t++)
              part(new THREE.BoxGeometry(radius * 0.32, radius * 0.055, radius * 0.06), metal, [
                side * radius * 0.61,
                radius * 0.47,
                t * radius * 0.23,
              ]);
        }
        part(new THREE.CylinderGeometry(radius * 0.43, radius * 0.48, radius * 0.3, 8), armor, [
          0,
          radius * 0.81,
          0,
        ]);
        part(new THREE.BoxGeometry(radius * 0.12, radius * 0.13, radius * 0.83), dark, [
          0,
          radius * 0.85,
          -radius * 0.45,
        ]);
      } else {
        part(
          new THREE.BoxGeometry(
            radius * (carrier ? 1.12 : 0.98),
            radius * (carrier ? 0.36 : 0.43),
            radius * (carrier ? 1.16 : 0.55),
          ),
          armor,
          [0, radius * 0.85, cargo ? -radius * 0.4 : 0],
        );
        if (cargo)
          part(new THREE.BoxGeometry(radius * 1.1, radius * 0.6, radius * 0.8), armor, [
            0,
            radius * 0.94,
            radius * 0.31,
          ]);
        for (const side of [-1, 1])
          for (const at of carrier || cargo ? [-0.6, 0, 0.6] : [-0.53, 0.53]) {
            const axle = new THREE.Group();
            axle.position.set(side * radius * 0.62, radius * 0.25, radius * at);
            group.add(axle);
            const wheel = part(
              new THREE.CylinderGeometry(
                radius * 0.23,
                radius * 0.23,
                radius * 0.22,
                quality === 'low' ? 6 : 10,
              ),
              dark,
              [0, 0, 0],
              axle,
            );
            wheel.rotation.z = Math.PI / 2;
            animated.wheels.push(axle);
          }
        part(new THREE.BoxGeometry(radius * 0.78, radius * 0.2, radius * 0.03), glass, [
          0,
          radius * 0.9,
          -radius * (cargo ? 0.69 : carrier ? 0.6 : 0.3),
        ]);
      }
      if (model === 'relay-truck') {
        part(new THREE.CylinderGeometry(radius * 0.025, radius * 0.035, radius * 0.42, 6), dark, [
          0,
          radius * 1.41,
          radius * 0.25,
        ]);
        const dish = part(
          new THREE.CylinderGeometry(radius * 0.4, radius * 0.3, radius * 0.07, 10),
          metal,
          [0, radius * 1.58, radius * 0.25],
        );
        dish.rotation.x = 0.5;
        animated.radar = dish;
      }
      if (model === 'field-utility') {
        part(new THREE.BoxGeometry(radius * 0.72, radius * 0.08, radius * 0.48), dark, [
          0,
          radius * 1.11,
          0,
        ]);
        const spare = part(
          new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, radius * 0.16, 10),
          dark,
          [0, radius * 0.7, radius * 0.83],
        );
        spare.rotation.x = Math.PI / 2;
      }
      for (const side of [-1, 1])
        part(new THREE.BoxGeometry(radius * 0.14, radius * 0.11, radius * 0.04), threat, [
          side * radius * 0.44,
          radius * 0.55,
          -radius * 0.79,
        ]);
      group.userData.nativeVehicleModel = model;
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
      if (military) {
        // Cosmetic field utility car: its existing path, shots and cylinder
        // collider remain authoritative. This does not introduce tank combat.
        part(new THREE.BoxGeometry(radius * 0.7, radius * 0.08, radius * 0.5), dark, [
          0,
          radius * 1.21,
          radius * 0.05,
        ]);
        part(new THREE.BoxGeometry(radius * 0.6, radius * 0.035, radius * 0.4), armor, [
          0,
          radius * 1.27,
          radius * 0.05,
        ]);
        const spare = part(
          new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, radius * 0.14, 10),
          dark,
          [0, radius * 0.75, radius * 0.73],
        );
        spare.rotation.x = Math.PI / 2;
        if (quality !== 'low') {
          for (const side of [-1, 1]) {
            part(new THREE.BoxGeometry(radius * 0.13, radius * 0.13, radius * 0.09), metal, [
              side * radius * 0.67,
              radius * 1.02,
              -radius * 0.26,
            ]);
            for (const [index, color] of [0xe6e5d6, 0x486588, 0xb96758].entries())
              part(
                new THREE.BoxGeometry(radius * 0.008, radius * 0.045, radius * 0.21),
                material(color),
                [side * radius * 0.431, radius * (0.9 - index * 0.045), radius * 0.22],
              );
          }
        }
      }
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
    } else if (nativeSoldierFamily) {
      const paints = Object.fromEntries(
        industrialSoldierPaintKeys(nativeSoldierFamily).map((key) => [
          key,
          key === 'coat'
            ? armor
            : key === 'pants'
              ? trousers
              : material(huntAppearance.palette[key] ?? key, { roughness: 0.87 }),
        ]),
      );
      group.userData.ownedMaterials.push(...Object.values(paints));
      animated.soldier = buildIndustrialSoldier({
        THREE,
        parent: group,
        part,
        family: nativeSoldierFamily,
        cast: huntAppearance.cast,
        radius,
        height,
        quality,
        paints,
      });
      group.userData.soldierRevision = INDUSTRIAL_SOLDIER_REVISION;
      group.userData.soldierFamily = nativeSoldierFamily;
      group.userData.soldierKit = animated.soldier.kitId;
      if (['shield-bearer', 'brace-trooper'].includes(nativeSoldierFamily)) {
        animated.armorTell = part(
          new THREE.RingGeometry(
            radius * 1.04,
            radius * 1.13,
            20,
            1,
            0,
            nativeSoldierFamily === 'shield-bearer' ? Math.PI : Math.PI * 2,
          ),
          threat,
          [0, 0.04, 0],
        );
        animated.armorTell.rotation.x = -Math.PI / 2;
      }
      if (course.pursuit?.actors.some((policy) => policy.id === actor.id)) {
        animated.intent = part(
          new THREE.ConeGeometry(radius * 0.23, radius * 0.65, 3),
          paints.trim,
          [0, 0.07, -radius * 1.25],
        );
        animated.intent.rotation.x = -Math.PI / 2;
      }
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
        huntTarget
          ? material(huntAppearance.palette.skinLight, { roughness: 0.9 })
          : civilian
            ? armor
            : dark,
        [0, height * 0.87, 0],
      );
      if (huntTarget) {
        const trim = material(huntAppearance.palette.light, { roughness: 0.85 });
        const skin = material(huntAppearance.palette.skin, { roughness: 0.9 });
        // Original common family accessories and palettes, adapted to native
        // 3D meshes. They never alter the existing capsule collision proxy.
        part(new THREE.BoxGeometry(radius * 1.1, radius * 0.18, radius * 1.12), armor, [
          0,
          height * 0.98,
          0,
        ]);
        part(new THREE.BoxGeometry(radius * 1.2, radius * 0.08, radius * 0.55), trim, [
          0,
          height * 0.945,
          -radius * 0.52,
        ]);
        for (const side of [-1, 1])
          part(new THREE.BoxGeometry(radius * 0.12, radius * 0.12, radius * 0.05), dark, [
            side * radius * 0.22,
            height * 0.89,
            -radius * 0.55,
          ]);
        part(new THREE.BoxGeometry(radius * 0.2, radius * 0.1, radius * 0.1), skin, [
          0,
          height * 0.845,
          -radius * 0.55,
        ]);
        part(new THREE.BoxGeometry(radius * 1.1, height * 0.035, radius * 0.86), trim, [
          0,
          height * 0.56,
          0,
        ]);
        if (['courier', 'refuge-seeker', 'rendezvous-pair', 'switchback'].includes(huntFamily)) {
          const parcel = part(
            new THREE.BoxGeometry(radius * 0.68, height * 0.22, radius * 0.5),
            trim,
            [radius * 0.8, height * 0.53, radius * 0.15],
          );
          if (huntFamily === 'refuge-seeker') parcel.position.set(0, height * 0.7, radius * 0.67);
          if (huntFamily === 'rendezvous-pair') parcel.scale.set(0.4, 0.25, 0.4);
        }
        if (['shield-bearer', 'brace-trooper'].includes(huntFamily)) {
          const plate = part(
            new THREE.BoxGeometry(radius * 1.85, height * 0.48, radius * 0.22),
            armor,
            [0, height * 0.55, -radius * 0.84],
          );
          animated.armorTell = part(
            new THREE.RingGeometry(
              radius * 1.04,
              radius * 1.13,
              20,
              1,
              0,
              huntFamily === 'shield-bearer' ? Math.PI : Math.PI * 2,
            ),
            threat,
            [0, 0.04, 0],
          );
          animated.armorTell.rotation.x = -Math.PI / 2;
          // The semicircle's endpoints expose the exact side/rear boundary.
          if (huntFamily === 'brace-trooper') animated.shield = plate;
        }
        if (course.pursuit?.actors.some((policy) => policy.id === actor.id)) {
          animated.intent = part(new THREE.ConeGeometry(radius * 0.23, radius * 0.65, 3), trim, [
            0,
            0.07,
            -radius * 1.25,
          ]);
          animated.intent.rotation.x = -Math.PI / 2;
        }
        if (huntFamily === 'lookout') {
          for (const side of [-1, 1])
            part(new THREE.BoxGeometry(radius * 0.22, radius * 0.26, radius * 0.28), dark, [
              side * radius * 0.19,
              height * 0.66,
              -radius * 0.52,
            ]);
        }
        if (huntAppearance.cast !== 'arcade') {
          part(new THREE.BoxGeometry(radius * 0.9, height * 0.22, radius * 0.6), dark, [
            0,
            height * 0.61,
            radius * 0.53,
          ]);
          for (const side of [-1, 1])
            part(new THREE.BoxGeometry(radius * 0.13, height * 0.25, radius * 0.04), trim, [
              side * radius * 0.3,
              height * 0.59,
              -radius * 0.43,
            ]);
        } else if (huntAppearance.cast === 'arcade') {
          for (const side of [-1, 1])
            part(new THREE.BoxGeometry(radius * 0.46, height * 0.075, radius * 0.75), trim, [
              side * radius * 0.38,
              height * 0.05,
              -radius * 0.1,
            ]);
        }
        // Shared cast palette, native articulated meshes. Webbing, cuffs and
        // covered helmets preserve each field / worn / winter identity at all
        // camera angles without touching the accepted capsule or route.
        for (const side of [-1, 1]) {
          part(new THREE.BoxGeometry(radius * 0.32, height * 0.085, radius * 0.18), armor, [
            side * radius * 0.32,
            height * 0.54,
            -radius * 0.63,
          ]);
          part(new THREE.BoxGeometry(radius * 0.14, height * 0.17, radius * 0.08), dark, [
            side * radius * 0.29,
            height * 0.65,
            -radius * 0.44,
          ]);
        }
        if (huntFamily === 'patroller') {
          part(new THREE.BoxGeometry(radius * 1.19, radius * 0.42, radius * 1.14), armor, [
            0,
            height * 0.94,
            0.03 * radius,
          ]);
          part(new THREE.BoxGeometry(radius * 0.68, height * 0.17, radius * 0.33), trim, [
            0,
            height * 0.63,
            radius * 0.69,
          ]);
        }
        if (quality !== 'low')
          for (const [index, color] of [0xe6e5d6, 0x486588, 0xb96758].entries())
            part(
              new THREE.BoxGeometry(radius * 0.013, height * 0.016, radius * 0.21),
              material(color),
              [radius * 0.7, height * (0.68 - index * 0.016), 0],
            );
      } else {
        part(new THREE.BoxGeometry(radius * 0.92, height * 0.05, radius * 0.16), threat, [
          0,
          height * 0.89,
          -radius * 0.53,
        ]);
      }
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
          trousers,
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
      if (kit) {
        const plate = part(
          new THREE.BoxGeometry(radius * 0.65, height * 0.14, radius * 0.025),
          kit.paint('enamel'),
          [0, height * 0.59, -radius * 0.6],
        );
        plate.userData.cosmeticDetail = true;
        plate.castShadow = false;
        const vent = part(
          new THREE.BoxGeometry(radius * 0.42, height * 0.025, radius * 0.03),
          kit.paint('rubber'),
          [0, height * 0.61, -radius * 0.62],
        );
        vent.userData.cosmeticDetail = true;
        vent.castShadow = false;
      }
      if (!friendly)
        part(new THREE.BoxGeometry(radius * 0.35, height * 0.085, radius * 1.2), threat, [
          radius * 0.47,
          height * 0.55,
          -radius * 0.38,
        ]);
    }
    const marker = label(
      huntTarget
        ? huntFamily === 'courier'
          ? '+'
          : String(huntTargets.get(actor.id)).padStart(2, '0')
        : friendly
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
      cast: preferredCast,
      family: huntFamily,
    };
  }
  function projectileBatch(owner) {
    const key = owner === 'player' ? 'player' : 'other';
    let batch = pulseRows.get(key);
    if (!batch) {
      const color = key === 'player' ? effectPalette.playerPulse : effectPalette.hostilePulse;
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
      if (
        row &&
        huntTargets.has(actor.id) &&
        (row.cast !== sharedActorAppearance().snapshot().cast ||
          (actor.pursuit && row.family !== actor.pursuit.family))
      ) {
        releaseGroup(row.group);
        actors.remove(row.group);
        actorRows.delete(actor.id);
        row = null;
      }
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
        if (actor.pursuit) {
          const intent = actor.pursuit;
          row.group.rotation.y = Math.atan2(-intent.heading.x, -intent.heading.z);
          moving =
            Boolean(intent.next) &&
            !actor.blocked &&
            actor.status === 'active' &&
            ['committed', 'flee', 'burst'].includes(intent.phase);
          if (row.animated.armorTell)
            row.animated.armorTell.visible =
              intent.family === 'shield-bearer' || ['warning', 'burst'].includes(intent.phase);
          if (row.animated.shield)
            row.animated.shield.rotation.x = intent.phase === 'recovering' ? Math.PI / 3 : 0;
          if (row.animated.intent) {
            const next = intent.nextHeading ?? intent.heading;
            const turn = Math.atan2(-next.x, -next.z) - row.group.rotation.y;
            row.animated.intent.rotation.set(-Math.PI / 2, turn, 0, 'YXZ');
            row.animated.intent.position.set(
              -Math.sin(turn) * row.radius * 1.25,
              0.07,
              -Math.cos(turn) * row.radius * 1.25,
            );
            row.animated.intent.visible = [
              'warning',
              'turning',
              'committed',
              'flee',
              'burst',
            ].includes(intent.phase);
          }
        } else if (target && definition.speed > 0) {
          let dx = target.x - p.x,
            dz = target.z - p.z;
          const approaching = Math.hypot(dx, dz) > 30;
          moving = approaching && !actor.blocked && actor.status === 'active';
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
          speed = actor.pursuit
            ? actor.pursuit.phase === 'burst'
              ? 3
              : 1.5
            : Math.max(0.35, (definition?.speed ?? 1000) / 1000),
          phase = seconds * speed * 7;
        // Pose is a pure function of simulation time/current route direction.
        // Repeated draws, pause, view changes and replay seeks cannot add motion.
        for (const [index, rotor] of row.animated.rotors.entries())
          rotor.rotation.y = reducedMotion
            ? 0
            : ((state.ticks * 0.64) % (Math.PI * 2)) * (index === 0 || index === 3 ? -1 : 1);
        if (row.animated.radar) row.animated.radar.rotation.y = reducedMotion ? 0 : seconds * 0.7;
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
        if (row.animated.soldier)
          applyIndustrialSoldierPose(row.animated.soldier, {
            ticks: state.ticks,
            phase: actor.pursuit?.phase ?? 'idle',
            moving,
            blocked: actor.blocked,
            active: actor.status === 'active',
            reducedMotion,
          });
        row.lastTick = state.ticks;
      }
      row.lastPosition.set(p.x, p.y, p.z);
      row.group.visible = !['defeated', 'caught'].includes(actor.status);
      if (row.marker) {
        const criterion = course.steps[mode].find((step) => step.type === 'hunt-contact-v1');
        const next = criterion?.ordered ? criterion.targets[state.hunt?.caught.length ?? 0] : null;
        row.marker.material.opacity = huntTargets.has(actor.id)
          ? !next || actor.id === next
            ? 1
            : 0.3
          : actor.health < row.health * 0.4
            ? 0.6
            : 1;
      }
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
  function machineryPresentationOptions() {
    return {
      actorDefinitions: course?.actors ?? [],
      machineryRevision,
      soldierRevision:
        machineryRevision === INDUSTRIAL_SOLDIER_REVISION ? INDUSTRIAL_SOLDIER_REVISION : null,
      soldierActorIds: [...actorRows]
        .filter(([, row]) => row.group.userData.soldierRevision === INDUSTRIAL_SOLDIER_REVISION)
        .map(([id]) => id),
      machineryActorIds: [...actorRows]
        .filter(([, row]) => row.group.userData.machineryRevision === INDUSTRIAL_VEHICLE_REVISION)
        .map(([id]) => id),
    };
  }
  function observePresentation(state) {
    if (!disposed && course) huntPresentation?.observe?.(state, machineryPresentationOptions());
  }
  function draw(state, { cameraMode = view, cameraFov = fov, cameraTilt = tilt } = {}) {
    if (disposed || !course || renderer.getContext().isContextLost()) return false;
    const hunt = course.steps[mode].find((step) => step.type === 'hunt-contact-v1');
    huntPresentation?.update(state, {
      reducedMotion,
      tailRadius: hunt?.tail.radius ?? 350,
      ...machineryPresentationOptions(),
    });
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
    // A map view frames the arena instead of inheriting a wide FPV lens.
    // Preserve the player's lens and fit narrow portrait views horizontally.
    const mapView = view === 'overview' || view === 'editor';
    const displayFov = mapView
      ? Math.min(
          120,
          (2 * Math.atan(Math.tan((58 * Math.PI) / 360) / Math.min(1, camera.aspect)) * 180) /
            Math.PI,
        )
      : fov;
    if (camera.fov !== displayFov) {
      camera.fov = displayFov;
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
        row.paint.color.setHex(
          complete
            ? effectPalette.goalComplete
            : active
              ? effectPalette.goalActive
              : effectPalette.goalInactive,
        );
        row.paint.opacity = active ? 1 : 0.18;
        row.light.color.setHex(active ? effectPalette.goalActive : effectPalette.goalGlowInactive);
        row.light.opacity = active ? 0.9 : 0.17;
        row.marker.visible = active;
        if (row.gateCue) row.gateCue.visible = active;
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
    for (const row of goalRows) {
      if (!row.actorId) continue;
      const subject = state.actors?.find((actor) => actor.id === row.actorId);
      row.group.visible = row.index === state.step && Boolean(subject && subject.health > 0);
      if (!row.group.visible) continue;
      const definition = actorDefinitions.get(row.actorId);
      row.group.position.set(
        subject.position.x / 1000,
        (subject.position.y + (definition?.height ?? 1000)) / 1000 + 0.25,
        subject.position.z / 1000,
      );
      row.group.quaternion.copy(camera.quaternion);
    }
    // Use the current lens and CSS viewport, independently of graphics pixel ratio.
    // The authored/legacy path keeps its original texture, size and visibility.
    camera.updateMatrixWorld();
    for (const row of goalRows) {
      const baseSize = row.badge?.userData.objectiveLabelBaseSize;
      if (!baseSize) continue;
      row.badge.getWorldPosition(labelPosition).applyMatrix4(camera.matrixWorldInverse);
      const layout = simObjectiveLabelLayout({
        baseSize,
        active: row.index === state.step,
        viewDepth: -labelPosition.z,
        projectionY: camera.projectionMatrix.elements[5],
        viewportHeight: rect.height,
      });
      row.badge.scale.set(layout.size, layout.size, 1);
      row.badge.center.set(0.5, layout.centerY);
    }
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
    return !renderer.getContext().isContextLost();
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
      new THREE.LineBasicMaterial({ color: effectPalette.trail, transparent: true, opacity: 0.65 }),
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
        material(effectPalette.ghost, {
          emissive: effectPalette.ghostEmissive,
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
    });
    const badge = label(
      'PB',
      `#${effectPalette.ghost.toString(16).padStart(6, '0')}`,
      ghostAircraft,
      0.48,
    );
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
    if (renderer.getContext().isContextLost())
      throw new Error('World preview is unavailable while graphics are lost.');
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
    let result,
      imageFailed = false;
    try {
      result = await configureWorldGLTFLoader(new GLTFLoader(manager), {
        onImageError: () => {
          imageFailed = true;
        },
      }).parseAsync(
        binary
          ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : new TextDecoder().decode(bytes),
        '',
      );
      if (
        imageFailed ||
        disposed ||
        renderer.getContext().isContextLost() ||
        generation !== sceneGeneration ||
        request !== importGeneration ||
        signal?.aborted
      ) {
        const rejected = new THREE.Group();
        rejected.add(...result.scenes);
        releaseGroup(rejected);
        signal?.throwIfAborted();
        if (imageFailed)
          throw new Error('World image could not be decoded. The previous scene is unchanged.');
        throw new Error('World preview changed during loading');
      }
      clearImported();
      importedMaterialBindings = applySimMaterialBindings(result.scene, {
        collectionId: simCollectionIdForProfile(themeProfile) ?? 'authored',
        quality,
        maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
        reviewRevision: machineryRevision,
        associations: result.parser?.associations,
        material,
      });
      imported.add(result.scene);
      if (
        json.asset?.extras?.fpvScenery === true &&
        ['woodland', 'courtyard', 'container-yard'].includes(course?.environment)
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
        materialBindings: structuredClone(importedMaterialBindings),
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
    const generation = contextGeneration;
    if (renderer.getContext().isContextLost())
      throw new Error('World editor is unavailable while graphics are lost.');
    if (!loadTransformControls)
      throw new Error('World editing requires the World Studio renderer.');
    const { TransformControls } = await loadTransformControls();
    if (disposed) throw new Error('Editor was disposed while loading');
    if (generation !== contextGeneration || renderer.getContext().isContextLost())
      throw new Error('World preview changed while the editor was loading');
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
        if (!editor) return false;
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
        editor?.setTranslationSnap(value || null);
      },
      orbit(dx, dy) {
        editorCamera.yaw -= dx * 0.007;
        editorCamera.pitch = Math.max(0.12, Math.min(1.45, editorCamera.pitch + dy * 0.007));
        callbacks.onRedraw?.();
      },
      zoom(delta) {
        if (!course) return;
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
  function clearSceneResources() {
    huntPresentation?.dispose();
    huntPresentation = null;
    if (editor) {
      scene.remove(editor.getHelper());
      editor.dispose();
      editor = null;
    }
    setPath([]);
    releaseEnvironmentLight();
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
    garageDetailMaterials.clear();
    geometry.clear();
    goalRows.length = 0;
    actorRows.clear();
    actorDefinitions.clear();
    seenActors.clear();
    qualityDetails.length = 0;
    lastActorState = null;
    pulseRows.clear();
    stadiumDetailMaterials.clear();
    droneVisual = null;
    obstacleMaps = null;
    obstacleSurface = null;
    obstacleFittingsMaterial = null;
    garageDetailMaterial = null;
    environmentSurfaceKind = null;
    stadiumMaterial = null;
    sceneryFallback = null;
    themeProfile = null;
    course = null;
    editRows.length = 0;
  }
  const lost = (event) => {
    event.preventDefault();
    // Retry rebuilds the scene on this renderer. Release old GPU ownership while
    // the context is lost, before Three restores its resource caches.
    sceneGeneration++;
    contextGeneration++;
    presentationGeneration++;
    importGeneration++;
    clearSceneResources();
    onContextLost();
  };
  canvas.addEventListener('webglcontextlost', lost);
  setQuality(quality);
  setDrone(droneKind);
  return {
    available: true,
    observePresentation,
    setCourse,
    setPresentation,
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
        droneVisual?.tint.color.set(cosmeticColor);
      }
    },
    resources() {
      return {
        available: true,
        disposed,
        quality,
        drone: droneKind,
        presentation: {
          ...activePresentation,
          profileId: themeProfile?.id ?? null,
          actors: [...actorRows].map(([id, row]) => ({
            id,
            quality: row.quality,
            themeAsset: row.group.userData.themeAsset,
            heading: row.group.rotation.y,
            moving: row.moving,
            position: row.group.position.toArray(),
            rotors: row.animated.rotors.map((rotor) => rotor.rotation.y),
            wheels: row.animated.wheels.map((wheel) => wheel.rotation.x),
            limbs: row.animated.limbs.map((limb) => limb.part.rotation.x),
          })),
          actorGoals: goalRows
            .filter((row) => row.actorId)
            .map((row) => ({
              index: row.index,
              actorId: row.actorId,
              visible: row.group.visible,
              position: row.group.position.toArray(),
              markerScale: row.marker.scale.toArray(),
              facingCamera: Math.abs(row.group.quaternion.dot(camera.quaternion)) > 0.99999,
            })),
          projectileBatches: pulseRows.size,
          activeProjectiles: [...pulseRows.values()].reduce(
            (total, batch) => total + batch.count,
            0,
          ),
          surfaceDetailGroups: qualityDetails.length,
        },
        effects: { ...effectPalette },
        hunt: huntPresentation?.resources() ?? null,
        importedMaterialBindings: structuredClone(importedMaterialBindings),
        registered: {
          geometries: geometry.size + (pathLine ? 1 : 0),
          materials: materials.size + (pathLine ? 1 : 0),
          textures: new Set([...materials].flatMap(texturesOf)).size,
        },
        renderer: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
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
      clearSceneResources();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
