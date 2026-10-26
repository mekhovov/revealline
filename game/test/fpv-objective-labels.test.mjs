import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import * as visuals from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import * as themes from '../../optional-practice/civilian-fpv/world-themes.mjs';
import * as soldiers from '../../optional-practice/civilian-fpv/industrial-soldiers.mjs';
import * as vehicles from '../../optional-practice/civilian-fpv/industrial-vehicles.mjs';
import * as aircraftVisuals from '../../optional-practice/civilian-fpv/aircraft-appearance.mjs';
import {
  normalizeCombatDefeat,
  combatFragmentRecipe,
} from '../../optional-practice/civilian-fpv/combat-presentation.mjs';
import {
  createObjectiveGuideVisual,
  objectiveGuideLabelLayout,
  createRouteGuideVisual,
  applyImportedActorOwnership,
} from '../../optional-practice/civilian-fpv/renderer.mjs';
import { contrastRatio } from '../presentation/theme-system.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { resolveIndustrialEnvironment } from '../presentation/industrial-environments.mjs';
import { prepareNativeIndustrialAttempt } from '../../optional-practice/civilian-fpv/industrial-environment.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { actorVisual } from '../hunt/actor-catalog.mjs';
import { sharedActorAppearance, runtimeActorArtRevision } from '../hunt/preferences.mjs';
import {
  ACCEPTANCE_CASES,
  acceptanceRoute,
  acceptanceFrame,
} from '../../authoring/fpv-worlds/acceptance-protocol.mjs';

const course = ACCEPTANCE_CASES.find((entry) => entry.id === 'gym').course;
const projection = (sprite, camera, height) => {
  camera.updateMatrixWorld();
  const centre = sprite
    .getWorldPosition(new THREE.Vector3())
    .applyMatrix4(camera.matrixWorldInverse);
  const bottom = centre
    .clone()
    .add(new THREE.Vector3(0, -sprite.center.y * sprite.scale.y, 0))
    .applyMatrix4(camera.projectionMatrix);
  const top = centre
    .clone()
    .add(new THREE.Vector3(0, (1 - sprite.center.y) * sprite.scale.y, 0))
    .applyMatrix4(camera.projectionMatrix);
  return { height: ((top.y - bottom.y) * height) / 2, bottom: bottom.y };
};

test('objective plates pair readable text with every collection panel while authored profiles retain the old path', () => {
  const before = JSON.stringify(course);
  for (const id of Object.keys(visuals.SIM_VISUAL_COLLECTIONS)) {
    const profile = themes.resolveSimThemeProfile(course, { collectionId: id, revision: 'r1' });
    const style = visuals.simObjectiveLabelStyle(profile);
    assert.ok(style, id);
    assert.equal(style.background, `#${profile.palette.wall.toString(16).padStart(6, '0')}`);
    assert.ok(contrastRatio(style.foreground, style.background) >= 4.5, id);
  }
  const dnipro = visuals.simObjectiveLabelStyle(
    themes.resolveSimThemeProfile(course, { collectionId: 'dnipro-porcelain', revision: 'r1' }),
  );
  assert.equal(dnipro.foreground, '#101820');
  assert.equal(visuals.simObjectiveLabelStyle(themes.resolveSimThemeProfile(course)), null);
  assert.equal(
    visuals.simObjectiveLabelStyle({ id: 'industrial-workshop', revision: 'missing' }),
    null,
  );
  assert.equal(JSON.stringify(course), before);
});

test('active label projection uses the current lens and CSS height, caps world size, and fixes the original lower edge', () => {
  const camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.position.set(0, 0, -24);
  const baseSize = 0.72;
  for (const [fov, height, depth] of [
    [82, 600, 6],
    [82, 600, 24],
    [60, 900, 24],
    [100, 844, 24],
    [82, 600, 100],
  ]) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    sprite.position.z = -depth;
    sprite.scale.set(baseSize, baseSize, 1);
    sprite.center.set(0.5, 0.5);
    const original = projection(sprite, camera, height);
    const layout = visuals.simObjectiveLabelLayout({
      baseSize,
      active: true,
      viewDepth: depth,
      projectionY: camera.projectionMatrix.elements[5],
      viewportHeight: height,
    });
    sprite.scale.set(layout.size, layout.size, 1);
    sprite.center.set(0.5, layout.centerY);
    const after = projection(sprite, camera, height);
    assert.ok(Math.abs(original.bottom - after.bottom) < 1e-12);
    assert.ok(layout.size >= baseSize && layout.size <= baseSize * 2);
    assert.ok(
      Math.abs(after.height - Math.max(original.height, Math.min(18, original.height * 2))) < 1e-9,
    );
  }
  sprite.material.dispose();
});

test('inactive, behind-camera and invalid viewport labels retain original bounds', () => {
  const valid = {
    baseSize: 0.72,
    active: true,
    viewDepth: 24,
    projectionY: 1,
    viewportHeight: 600,
  };
  for (const patch of [
    { active: false },
    { viewDepth: -10 },
    { viewDepth: Infinity },
    { projectionY: NaN },
    { viewportHeight: 0 },
    { viewportHeight: Infinity },
  ])
    assert.deepEqual(visuals.simObjectiveLabelLayout({ ...valid, ...patch }), {
      size: 0.72,
      centerY: 0.5,
    });
});

async function rendererFixture({ cast = null } = {}) {
  let source = await fs.readFile(
    new URL('../../optional-practice/civilian-fpv/renderer.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const item of ast.body.filter((item) => item.type === 'ImportDeclaration').reverse())
    source = source.slice(0, item.start) + source.slice(item.end);
  source = source.replaceAll('export function ', 'function ');
  const sprites = [];
  let drawnCamera, drawnScene;
  const canvas = {
    width: 1166,
    height: 600,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ width: 1166, height: 600 }),
    ownerDocument: {
      createElement: () => {
        const surface = {};
        const context = {
          beginPath() {},
          arc() {},
          fill() {},
          stroke() {},
          fillText(text) {
            surface.label = { text, foreground: this.fillStyle, font: this.font };
          },
        };
        context.fill = () => {
          surface.background = context.fillStyle;
        };
        surface.getContext = () => context;
        return surface;
      },
    },
  };
  class Renderer {
    constructor() {
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 8 };
      this.info = {
        reset() {},
        programs: [],
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
      };
    }
    getRenderTarget() {
      return null;
    }
    setRenderTarget() {}
    clearDepth() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
    getContext() {
      return { isContextLost: () => false };
    }
    render(scene, camera) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      drawnCamera = camera;
      drawnScene = scene;
    }
  }
  const create = vm.runInNewContext(`${source}; createFlightRenderer`, {
    applySimBattlefieldGround,
    ...themes,
    ...visuals,
    ...soldiers,
    ...vehicles,
    ...aircraftVisuals,
    actorVisual,
    sharedActorAppearance: cast ? () => ({ snapshot: () => ({ cast }) }) : sharedActorAppearance,
    runtimeActorArtRevision,
    canonicalJSON,
    resolveIndustrialEnvironment,
    structuredClone,
    THREE: {
      ...THREE,
      WebGLRenderer: Renderer,
      Sprite: class extends THREE.Sprite {
        constructor(...args) {
          super(...args);
          sprites.push(this);
        }
      },
    },
    buildWorldVisuals({ world, course, presentation }) {
      const profile = themes.resolveSimThemeProfile(course, presentation);
      return {
        theme: profile.palette,
        profile,
        indoor: true,
        center: [0, 0],
        width: 40,
        depth: 60,
        backdrop: world,
      };
    },
    createEnvironmentLight: () => ({ texture: null, dispose() {} }),
    buildDroneVisual: ({ material }) => ({ tint: material(0xffffff), rotors: [] }),
  });
  const renderer = create({ canvas, window: { devicePixelRatio: 2 } });
  return { renderer, sprites, camera: () => drawnCamera, scene: () => drawnScene };
}

test('native defeat presentation retains visible actor identity without changing accepted facts or combat appearances', async () => {
  const native = structuredClone(course);
  native.actors = [
    { id: 'patrol', type: 'patrol', speed: 1000, radius: 350, height: 1800 },
    { id: 'drone', type: 'drone', speed: 2000, radius: 400, height: 500 },
    { id: 'tank', type: 'vehicle', vehicleModel: 'field-tank', radius: 900, height: 1200 },
  ].map((actor, index) => ({
    ...actor,
    position: { x: index * 3000, y: 0, z: 5000 },
    path: [],
    role: 'hostile',
  }));
  for (const cast of ['authored', 'tactical', 'arcade']) {
    const { renderer } = await rendererFixture({ cast });
    renderer.setCourse(native);
    let presented = null,
      active = false;
    renderer.configureCombatPresentation({
      createActors: () => ({
        active: () => active,
        reset() {},
        dispose() {},
      }),
      createPresentation: () => ({
        observe(facts) {
          presented = facts;
        },
        configure() {},
        dispose() {},
      }),
    });
    const facts = native.actors.map((actor, index) => ({
      type: 'defeat',
      eventId: `native-${index}`,
      sourceId: actor.id,
      tick: 25,
      position: actor.position,
      radius: actor.radius,
      height: actor.height,
      material: index === 0 ? 'organic' : 'electronic',
      appearance: { family: 'lookout', type: actor.type },
      cause: 'impact',
      seed: 123,
    }));
    const before = structuredClone(facts);
    renderer.observeCombat(facts, { tick: 25 });
    assert.notEqual(presented, facts);
    assert.equal(presented[0].appearance.family, 'patroller');
    for (const [index, actor] of native.actors.entries()) {
      assert.equal(presented[index].appearance.cast, cast === 'authored' ? 'rivals' : cast);
      assert.equal(presented[index].appearance.type, actor.type);
    }
    assert.equal(presented[2].appearance.model, 'field-tank');
    assert.deepEqual(facts, before, 'cosmetic enrichment never enters accepted proof facts');
    const recipes = presented.map((fact) =>
      combatFragmentRecipe(normalizeCombatDefeat(fact), { brutal: true, blood: true }),
    );
    assert.ok(recipes[0].some((part) => part.region === 'head'));
    assert.ok(recipes[0].some((part) => part.region === 'chest'));
    assert.ok(
      recipes[1].some((part) => part.shape === 'cloth' && part.attachment >= 0),
      'drone recipe retains rotor fragments attached to arms',
    );
    assert.ok(
      recipes[2].some((part) => part.shape === 'rubber'),
      'vehicle wheels remain recognizable',
    );
    assert.ok(
      recipes[2].some((part) => part.size[2] > 0.9),
      'the tank recipe retains its long barrel',
    );
    active = true;
    renderer.observeCombat(facts, { tick: 25 });
    assert.equal(presented, facts, 'active combat actors retain their configured appearances');
    renderer.dispose();
  }
});

test('real renderer keeps current and next objective labels readable on every collection and camera', async () => {
  for (const collectionId of ['authored', 'industrial-workshop', 'dnipro-porcelain']) {
    const fixture = await rendererFixture(),
      { renderer } = fixture,
      before = JSON.stringify(course),
      route = acceptanceRoute(course),
      sample = acceptanceFrame(course, route, 0, 'far');
    renderer.setPresentation({ collectionId, revision: 'r1' });
    renderer.setCourse(course);
    renderer.draw(sample.state, sample.options);
    const labels = fixture.sprites.filter((item) => item.userData.objectiveLabelBaseSize),
      current = labels[sample.state.step],
      next = labels[sample.state.step + 1];
    assert.ok(current.parent.visible);
    assert.equal(current.material.depthTest, true);
    assert.equal(current.material.depthWrite, false);
    assert.equal(current.material.opacity, 1);
    assert.ok(projection(current, fixture.camera(), 600).height >= 24 - 1e-6);
    assert.ok(projection(current, fixture.camera(), 600).height <= 42 + 1e-6);
    assert.ok(next.parent.visible);
    assert.equal(next.material.opacity, 0.62);
    assert.equal(labels.filter((item) => item.parent.visible).length, 2);
    const image = current.material.map.image;
    assert.ok(contrastRatio(image.label.foreground, image.background) >= 4.5);
    renderer.draw(sample.state, { ...sample.options, guidanceVisible: false });
    assert.equal(current.parent.parent.visible, false);
    assert.equal(renderer.objectiveScreen(sample.state), null);
    renderer.draw(sample.state, { ...sample.options, cameraMode: 'editor' });
    assert.ok(labels.every((item) => item.parent.visible));
    renderer.draw(sample.state, { ...sample.options, cameraMode: 'chase', guidanceAccent: 'cyan' });
    assert.equal(labels.filter((item) => item.parent.visible).length, 2);
    const cue = renderer.objectiveScreen(sample.state);
    assert.equal(cue.guidanceAccent, 'cyan');
    assert.ok(cue.preview);
    assert.equal(cue.preview.index, cue.index + 1);
    assert.equal(JSON.stringify(course), before);
    renderer.dispose();
  }
});

test('active gate bracket geometry stays outside the original frame on both axes with bounded paired contrast', () => {
  for (const collectionId of Object.keys(visuals.SIM_VISUAL_COLLECTIONS)) {
    const create = visuals.createSimGateCueFactory(
      themes.resolveSimThemeProfile(course, { collectionId, revision: 'r1' }),
    );
    const root = new THREE.Group();
    for (const axis of ['x', 'z'])
      for (const [span, height] of [
        [0.2, 0.2],
        [3, 2],
        [18, 6],
      ]) {
        const cue = create({ axis, span, height });
        root.add(cue);
        assert.equal(cue.visible, false);
        assert.equal(cue.children.length, 2);
        assert.equal(cue.children[0].geometry, cue.children[1].geometry);
        const colors = cue.children.map((item) => `#${item.material.color.getHexString()}`);
        assert.ok(contrastRatio(...colors) >= 15, collectionId);
        for (const batch of cue.children) {
          assert.equal(batch.count, 8);
          assert.equal(batch.castShadow, false);
          assert.equal(batch.receiveShadow, false);
          assert.equal(batch.material.isMeshBasicMaterial, true);
          assert.equal(batch.material.depthTest, true);
          assert.equal(batch.material.depthWrite, false);
          assert.equal(batch.material.toneMapped, false);
          assert.equal(batch.material.fog, true);
          for (let i = 0; i < batch.count; i++) {
            const transform = new THREE.Matrix4();
            batch.getMatrixAt(i, transform);
            const bounds = new THREE.Box3(
              new THREE.Vector3(-0.5, -0.5, -0.5),
              new THREE.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(transform);
            const across = axis === 'z' ? 'x' : 'z',
              depth = axis === 'z' ? 'z' : 'x',
              x = span / 2 + 0.0225,
              y = height / 2 + 0.0225,
              epsilon = 1e-6;
            assert.ok(
              bounds.min[across] >= x - epsilon ||
                bounds.max[across] <= -x + epsilon ||
                bounds.min.y >= y - epsilon ||
                bounds.max.y <= -y + epsilon,
              'every bracket lies outside the existing frame, not just outside its centre',
            );
            assert.ok(bounds.min[across] >= -x - 0.12 - epsilon);
            assert.ok(bounds.max[across] <= x + 0.12 + epsilon);
            assert.ok(bounds.min.y >= -y - 0.12 - epsilon);
            assert.ok(bounds.max.y <= y + 0.12 + epsilon);
            assert.ok(bounds.min[depth] >= -0.0225 - epsilon);
            assert.ok(bounds.max[depth] <= 0.0225 + epsilon);
          }
        }
      }
    assert.equal(
      new Set(root.children.flatMap((cue) => cue.children.map((item) => item.geometry))).size,
      1,
    );
    assert.equal(
      new Set(root.children.flatMap((cue) => cue.children.map((item) => item.material))).size,
      2,
    );
    visuals.disposeSimVisualGroup(root);
    assert.equal(create({ axis: 'y', span: 3, height: 2 }), null);
    assert.equal(create({ axis: 'z', span: Infinity, height: 2 }), null);
  }
  assert.equal(visuals.createSimGateCueFactory(themes.resolveSimThemeProfile(course)), null);
  assert.equal(
    visuals.createSimGateCueFactory({ id: 'dnipro-porcelain', revision: 'missing' }),
    null,
  );
});

test('renderer exposes current and next semantic guides at every quality and releases each resource once', async () => {
  const course = ACCEPTANCE_CASES.find((entry) => entry.id === 'warehouse').course,
    before = JSON.stringify(course),
    route = acceptanceRoute(course),
    far = acceptanceFrame(course, route, 0, 'far');
  for (const collectionId of ['authored', 'industrial-workshop', 'dnipro-porcelain'])
    for (const quality of ['low', 'balanced', 'high']) {
      const fixture = await rendererFixture(),
        { renderer } = fixture;
      renderer.setQuality(quality);
      renderer.setPresentation({ collectionId, revision: 'r1' });
      renderer.setCourse(course);
      renderer.draw(far.state, far.options);
      const cues = [];
      fixture.scene().traverse((item) => {
        if (item.userData.criteriaOnly) cues.push(item);
      });
      assert.ok(cues.length > 1);
      assert.equal(cues.filter((item) => item.parent.visible && item.visible).length, 2);
      const resources = new Set();
      for (const cue of cues)
        cue.traverse((part) => {
          if (part.geometry) resources.add(part.geometry);
          if (part.material) resources.add(part.material);
          if (part.isInstancedMesh) resources.add(part);
        });
      const disposals = new Map();
      for (const resource of resources)
        resource.addEventListener('dispose', () =>
          disposals.set(resource, (disposals.get(resource) ?? 0) + 1),
        );
      renderer.setCourse(course);
      for (const resource of resources) assert.equal(disposals.get(resource), 1);
      renderer.dispose();
      for (const resource of resources) assert.equal(disposals.get(resource), 1);
    }
  assert.equal(JSON.stringify(course), before);
});

test('renderer requires a branded native environment before replacing its accepted scene', async () => {
  const { renderer } = await rendererFixture();
  const entry = WORLD_CATALOGUE.find((e) => e.id === 'native-pursuit-runner-court');
  const accepted = await prepareNativeIndustrialAttempt({
    entry,
    mode: 'self-level',
    presentation: { collectionId: 'military-field', revision: 'r1' },
    artRevision: 'industrial-roster-v3',
  });
  try {
    renderer.setPresentation({ collectionId: 'military-field', revision: 'r1' });
    assert.throws(() => renderer.setCourse(accepted.course), /authenticated source/);
    assert.throws(
      () =>
        renderer.setCourse(accepted.course, 'self-level', {
          industrialEnvironment: accepted.course.world.themeProfile.industrialEnvironment,
          artRevision: accepted.artRevision,
        }),
      /accepted or restored/,
    );
    assert.throws(
      () =>
        renderer.setCourse(accepted.course, 'self-level', {
          industrialEnvironment: accepted.pin,
          artRevision: null,
        }),
      /matching actor art/,
    );
    assert.doesNotThrow(() =>
      renderer.setCourse(accepted.course, 'self-level', {
        industrialEnvironment: accepted.pin,
        artRevision: accepted.artRevision,
      }),
    );
    assert.throws(
      () =>
        renderer.setCourse(entry.course, 'self-level', {
          industrialEnvironment: accepted.pin,
          artRevision: accepted.artRevision,
        }),
      /accepted native appearance/,
    );
  } finally {
    renderer.dispose();
  }
});

function disposeGuide(root) {
  const geometry = new Set(),
    materials = new Set();
  root?.traverse((part) => {
    if (part.geometry) geometry.add(part.geometry);
    if (part.material) materials.add(part.material);
    if (part.isInstancedMesh) part.dispose();
  });
  geometry.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
}

test('new guidance rails border the exact accepted aperture on every crossing axis', () => {
  for (const axis of ['x', 'y', 'z'])
    for (const direction of [-1, 1])
      for (const span of [200, 3000, 18000]) {
        const step = {
            type: 'crossing-v1',
            axis,
            direction,
            at: 5000,
            minA: -span / 2,
            maxA: span / 2,
            minB: 1000,
            maxB: 3200,
          },
          before = structuredClone(step),
          guide = createObjectiveGuideVisual(step),
          { a, b, height } = guide.userData.aperture;
        assert.equal(guide.userData.guidanceSemantic, 'manoeuvre');
        assert.equal(guide.position[axis], 5);
        for (const batch of guide.children.filter((item) => item.isInstancedMesh))
          for (let index = 0; index < batch.count; index++) {
            const matrix = new THREE.Matrix4();
            batch.getMatrixAt(index, matrix);
            const bounds = new THREE.Box3(
              new THREE.Vector3(-0.5, -0.5, -0.5),
              new THREE.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(matrix);
            assert.ok(
              bounds.min[a] >= span / 2000 - 1e-6 ||
                bounds.max[a] <= -span / 2000 + 1e-6 ||
                bounds.min[b] >= height / 2 - 1e-6 ||
                bounds.max[b] <= -height / 2 + 1e-6,
              'no visual rail narrows or shifts the accepted opening',
            );
            assert.equal(batch.material.depthTest, true);
            assert.equal(batch.material.depthWrite, false);
          }
        const arrow = guide.getObjectByName('objective-entry-direction'),
          actual = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
        assert.ok(actual[axis] * direction > 0.9999);
        assert.deepEqual(step, before);
        disposeGuide(guide);
      }
});

test('hold, landing and manoeuvre regions have distinct honest cues; unsupported landing pads stay hidden', () => {
  for (const type of ['hold', 'land', 'rotation-v1', 'attitude-v1', 'path-v1']) {
    const step = { type, min: { x: -1000, y: 1000, z: -1000 }, max: { x: 1000, y: 3000, z: 1000 } },
      guide = createObjectiveGuideVisual(step);
    assert.equal(
      guide.userData.guidanceSemantic,
      ['hold', 'land'].includes(type) ? type : 'manoeuvre',
    );
    assert.equal(guide.getObjectByName('objective-entry-direction'), undefined);
    assert.equal(guide.userData.aperture, undefined);
    if (type === 'land')
      assert.equal(guide.getObjectByName('objective-supported-landing-pad').visible, false);
    disposeGuide(guide);
  }
  assert.equal(createObjectiveGuideVisual({ type: 'survive', ticks: 500 }), null);
  assert.equal(createObjectiveGuideVisual({ type: 'actor-track-v1', actorId: 'a' }), null);
});

test('guidance labels cap near and distant CSS pixels without changing the opening or label lower edge', () => {
  for (const preview of [false, true])
    for (const depth of [0.5, 6, 24, 100, 250])
      for (const height of [360, 1080, 2160]) {
        const lens = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300),
          projectionY = lens.projectionMatrix.elements[5],
          result = objectiveGuideLabelLayout({
            baseSize: 0.72,
            viewDepth: depth,
            viewportHeight: height,
            projectionY,
            preview,
          }),
          pixels = (result.size * projectionY * height) / (2 * depth);
        assert.ok(pixels >= (preview ? 18 : 24) - 1e-6);
        assert.ok(pixels <= (preview ? 32 : 42) + 1e-6);
        assert.ok(Math.abs(result.centerY * result.size - 0.36) < 1e-6);
      }
});

test('current objective cue reports wrong-side entry, occlusion and one next preview without revealing a hidden gate', async () => {
  const fixture = await rendererFixture(),
    { renderer } = fixture,
    value = structuredClone(ACCEPTANCE_CASES.find((entry) => entry.id === 'warehouse').course),
    route = acceptanceRoute(value),
    sample = acceptanceFrame(value, route, 0, 'far');
  try {
    renderer.setCourse(value);
    renderer.draw(sample.state, sample.options);
    const step = value.steps['self-level'][sample.state.step],
      wrong = structuredClone(sample.state);
    wrong.position[step.axis] = step.at + step.direction * 2000;
    renderer.draw(wrong, sample.options);
    const cue = renderer.objectiveScreen(wrong);
    assert.equal(cue.wrongSide, true);
    assert.equal(cue.approach, true);
    assert.equal(cue.semantic, 'gate');
    assert.equal(cue.preview.index, cue.index + 1);
    // Add an opaque obstruction around the viewer to the canonical world group.
    const scene = fixture.scene(),
      world = scene.children.find(
        (item) => item.isGroup && item !== fixture.sprites[0].parent.parent,
      ),
      wall = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      );
    wall.position.copy(fixture.camera().position);
    world.add(wall);
    scene.updateMatrixWorld(true);
    const advanced = { ...wrong, ticks: wrong.ticks + 5 };
    const blocked = renderer.objectiveScreen(advanced);
    assert.equal(blocked.occluded, true);
    assert.equal(blocked.directionOnly, true);
    world.remove(wall);
    wall.geometry.dispose();
    wall.material.dispose();
    renderer.draw(wrong, { ...sample.options, cameraMode: 'overview' });
    assert.equal(renderer.objectiveScreen(wrong), null);
  } finally {
    renderer.dispose();
  }
});

test('validated route visuals follow only authored consecutive segments, can be hidden independently and are released on omission', async () => {
  const path = {
      id: 'bend',
      waypoints: [
        { id: 'a', position: { x: 0, y: 2000, z: 0 } },
        { id: 'b', position: { x: 5000, y: 2000, z: 0 } },
        { id: 'c', position: { x: 5000, y: 2000, z: 5000 } },
      ],
    },
    before = structuredClone(path),
    guide = createRouteGuideVisual(path, 'cyan');
  assert.equal(guide.children.length, 2);
  assert.equal(guide.children[0].count, 2);
  const centers = [];
  for (let i = 0; i < 2; i++) {
    const matrix = new THREE.Matrix4();
    guide.children[0].getMatrixAt(i, matrix);
    centers.push(new THREE.Vector3().setFromMatrixPosition(matrix).toArray());
  }
  assert.deepEqual(centers, [
    [2.5, 2, 0],
    [5, 2, 2.5],
  ]);
  assert.deepEqual(path, before);
  disposeGuide(guide);
  assert.equal(createRouteGuideVisual(null), null);
  assert.equal(
    createRouteGuideVisual({
      waypoints: [{ position: { x: NaN, y: 0, z: 0 } }, path.waypoints[0]],
    }),
    null,
  );
  const fixture = await rendererFixture(),
    { renderer } = fixture;
  try {
    renderer.setCourse(course);
    const sample = acceptanceFrame(course, acceptanceRoute(course), 0, 'far');
    renderer.draw(sample.state, {
      ...sample.options,
      guidanceVisible: false,
      routeGuide: path,
      routeGuideVisible: true,
    });
    const route = fixture.scene().getObjectByName('validated-route-guide');
    assert.equal(route.parent.visible, true);
    assert.equal(renderer.objectiveScreen(sample.state), null);
    let disposed = 0;
    route.children[0].geometry.addEventListener('dispose', () => disposed++);
    renderer.draw(sample.state, sample.options);
    assert.equal(fixture.scene().getObjectByName('validated-route-guide'), undefined);
    assert.equal(disposed, 1);
  } finally {
    renderer.dispose();
  }
});

test('explicit imported actor ownership hides whole matching subtrees and restores visibility without name heuristics', () => {
  const root = new THREE.Group(),
    actor = new THREE.Group(),
    unrelated = new THREE.Group(),
    named = new THREE.Group();
  actor.userData.rl = { kind: 'actor', id: 'soldier-a' };
  unrelated.userData.rl = { type: 'actor', id: 'soldier-b' };
  named.name = 'soldier-a';
  actor.add(new THREE.Group());
  root.add(actor, unrelated, named);
  const before = structuredClone(actor.userData),
    owned = applyImportedActorOwnership(root, new Set(['soldier-a']));
  assert.equal(actor.visible, false);
  assert.equal(unrelated.visible, true);
  assert.equal(named.visible, true);
  assert.equal(actor.children[0].parent.visible, false);
  applyImportedActorOwnership(root, new Set(['soldier-b']), owned);
  assert.equal(actor.visible, true);
  assert.equal(unrelated.visible, false);
  applyImportedActorOwnership(root, new Set(), owned);
  assert.equal(unrelated.visible, true);
  assert.equal(owned.size, 0);
  assert.deepEqual(actor.userData, before);
});
import { applySimBattlefieldGround } from '../../optional-practice/civilian-fpv/battlefield-ground.mjs';
