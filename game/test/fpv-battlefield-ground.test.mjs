import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  SIM_BATTLEFIELD_PROFILES,
  simBattlefieldWorld,
  applySimBattlefieldGround,
} from '../../optional-practice/civilian-fpv/battlefield-ground.mjs';
import {
  THEME_PROFILES,
  validateThemeProfile,
  resolveSimThemeProfile,
  snapshotSimThemeProfile,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';
import {
  buildWorldVisuals,
  disposeSimVisualGroup,
} from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('SIM Creator explicitly exposes exact world profiles while existing and customized profiles remain unchanged', () => {
  assert.equal(THEME_PROFILES[0].id, 'academy');
  assert.equal(SIM_BATTLEFIELD_PROFILES.length, 6);
  const html = readFileSync(
    new URL('../../optional-practice/fpv-worlds/index.html', import.meta.url),
    'utf8',
  );
  for (const profile of SIM_BATTLEFIELD_PROFILES) {
    assert.deepEqual(validateThemeProfile(profile), profile);
    assert.match(html, new RegExp(`value="${profile.id}"`));
    assert.equal(simBattlefieldWorld(structuredClone(profile)), profile.id.slice(4));
    const customized = structuredClone(profile);
    customized.palette.ground++;
    assert.equal(simBattlefieldWorld(customized), null);
    assert.equal(simBattlefieldWorld({ ...profile, format: 'ThemeProfile.v3' }), null);
  }
  assert.equal(simBattlefieldWorld(THEME_PROFILES[0]), null);
});

for (const profile of SIM_BATTLEFIELD_PROFILES)
  test(`native 3D world consumes ${profile.id} pixels only for opted-in floors, with unchanged geometry and bounded owned texture`, () => {
    const document = new Document(),
      course = structuredClone(FLIGHT_COURSES[0]);
    const create = document.createElement.bind(document);
    document.createElement = (tag) => {
      const node = create(tag);
      if (tag === 'canvas') node.close = undefined; // HTMLCanvasElement has no dialog close().
      return node;
    };
    course.world = { ...course.world, theme: profile.id };
    const world = new THREE.Group(),
      material = (color, props = {}) => new THREE.MeshStandardMaterial({ color, ...props });
    const mesh = (geometry, paint, parent = world) => {
      const item = new THREE.Mesh(geometry, paint);
      parent.add(item);
      return item;
    };
    const box = (size, at, color, parent = world) => {
      const item = mesh(new THREE.BoxGeometry(...size), material(color), parent);
      item.position.set(...at);
      return item;
    };
    const before = JSON.stringify(course),
      result = buildWorldVisuals({ course, world, mesh, material, box });
    assert.equal(result.profile.id, profile.id);
    const geometry = [];
    world.traverse((item) => {
      if (item.geometry)
        geometry.push([item, item.geometry, item.position.toArray(), item.rotation.toArray()]);
    });
    const floor = geometry.find(([item]) => item.userData.proceduralGround)[0],
      old = floor.material.map;
    let retired = 0;
    old.addEventListener('dispose', () => retired++);
    assert.equal(
      applySimBattlefieldGround({
        world,
        profile: result.profile,
        environment: {},
        THREE,
        document,
      }),
      false,
    );
    assert.equal(floor.material.map, old, 'accepted environment pins remain authoritative');
    assert.equal(
      applySimBattlefieldGround({ world, profile: result.profile, THREE, document }),
      true,
    );
    const map = floor.material.map;
    assert.equal(retired, 1);
    const revision = ['fpv-field-crossing', 'fpv-freight-depot', 'fpv-relay-ruins'].includes(
      profile.id,
    )
      ? 1
      : 2;
    assert.equal(map.name, `${profile.id}-native-ground-r${revision}`);
    assert.equal(map.image.width * map.image.height * 4, 1572864);
    assert.equal(map.generateMipmaps, false);
    assert.equal(map.minFilter, THREE.NearestFilter);
    for (const [item, source, position, rotation] of geometry) {
      assert.equal(item.geometry, source);
      assert.deepEqual(item.position.toArray(), position);
      assert.deepEqual(item.rotation.toArray(), rotation);
    }
    assert.equal(JSON.stringify(course), before);
    let released = 0;
    map.addEventListener('dispose', () => released++);
    disposeSimVisualGroup(world);
    assert.equal(released, 1);
  });

test('saved authored profile round-trips independently from collection defaults', () => {
  for (const profile of SIM_BATTLEFIELD_PROFILES) {
    const course = { world: { theme: profile.id, themeProfile: validateThemeProfile(profile) } };
    const retained = JSON.parse(JSON.stringify(course));
    assert.deepEqual(
      resolveSimThemeProfile(retained, { collectionId: 'authored', revision: 'r1' }),
      profile,
    );
    assert.equal(
      resolveSimThemeProfile(retained, { collectionId: 'industrial-workshop', revision: 'r1' }).id,
      'industrial-workshop',
    );
    assert.deepEqual(retained, course);
  }
});

test('native appearance preparation preserves selected drone without dropping authored battlefield ground', () => {
  for (const source of SIM_BATTLEFIELD_PROFILES) {
    const course = { world: { theme: source.id, themeProfile: structuredClone(source) } };
    for (const drone of ['racer', 'pixel', 'utility']) {
      const accepted = snapshotSimThemeProfile(course, {
        collectionId: 'authored',
        revision: 'r1',
      });
      accepted.drone = drone;
      const retained = JSON.parse(JSON.stringify(accepted));
      assert.equal(simBattlefieldWorld(retained), source.id.slice(4));
      assert.equal(retained.drone, drone);
      retained.palette.ground++;
      assert.equal(simBattlefieldWorld(retained), null, 'custom terrain remains authoritative');
    }
  }
});
