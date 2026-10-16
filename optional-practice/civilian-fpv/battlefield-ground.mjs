import {
  OVERFLIGHT_WORLDS,
  createOverflightGroundPresentation,
} from '../../game/overflight/worlds.mjs';
import { paintOverflightWorld } from '../../game/presentation/overflight-world-art.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';

/** Explicit authored Creator choices. Retained world profiles never migrate. */
export const SIM_BATTLEFIELD_PROFILES = Object.freeze(
  OVERFLIGHT_WORLDS.map((world) =>
    Object.freeze({
      format: 'ThemeProfile.v1',
      id: `fpv-${world.id}`,
      revision: 'r1',
      title: { en: `FPV · ${world.title.en}`, uk: `FPV · ${world.title.uk}` },
      palette: {
        sky: 0x96a9aa,
        fog: 0x7c9190,
        ground: parseInt(world.palette[0].slice(1), 16),
        wall: parseInt(world.palette[2].slice(1), 16),
        accent: 0xbed7a4,
        warm: 0xe8c471,
      },
      textureFilter: 'nearest',
      drone: 'utility',
      characters: 'training-patrol',
      assets: {
        gate: 'builtin:utility-gate',
        marker: 'builtin:signal-beacon',
        enemy: 'builtin:sentry',
        vehicle: 'builtin:patrol-rover',
      },
      audio: { ambience: 'industrial', motor: 'utility', gate: 'radio' },
      ui: { accent: '#bed7a4', font: 'system-ui', borderRadius: 4 },
    }),
  ),
);

export function simBattlefieldWorld(profile) {
  if (profile?.format !== 'ThemeProfile.v1') return null;
  const exact = SIM_BATTLEFIELD_PROFILES.find((entry) => entry.id === profile.id);
  // Native appearance preparation pins the player's independent drone choice.
  // That does not customize the authored ground or replace its resource identity.
  if (!exact || !['racer', 'pixel', 'utility'].includes(profile.drone)) return null;
  return canonicalJSON(exact) === canonicalJSON({ ...profile, drone: exact.drone })
    ? profile.id.slice(4)
    : null;
}

/** Replace only a freshly generated procedural floor for an exact opted-in
 * profile. Existing imported meshes and accepted environment pins are untouched.
 * Texture lifetime belongs to the renderer's existing material disposal pass. */
export function applySimBattlefieldGround({
  world,
  profile,
  environment = null,
  THREE,
  document = globalThis.document,
}) {
  const id = !environment && simBattlefieldWorld(profile);
  if (!id || !document?.createElement) return false;
  const floors = [];
  world.traverse((item) => {
    if (item.userData?.proceduralGround && item.material && !Array.isArray(item.material))
      floors.push(item);
  });
  if (floors.length !== 1) return false;
  const canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d');
  if (!ctx) return false;
  canvas.width = 1024;
  canvas.height = 384;
  const arena = { width: 2880, height: 1080 },
    presentation = createOverflightGroundPresentation(id, arena);
  ctx.save();
  ctx.scale(canvas.width / arena.width, canvas.height / arena.height);
  paintOverflightWorld(ctx, presentation, arena);
  ctx.restore();
  const map = new THREE.CanvasTexture(canvas);
  map.name = `${profile.id}-native-ground-r${presentation.revision}`;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.colorSpace = THREE.SRGBColorSpace;
  const floor = floors[0],
    material = floor.material;
  // These maps belong only to buildWorldVisuals' unique procedural floor.
  const retired = new Set();
  for (const slot of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
    const texture = material[slot];
    if (texture?.isTexture) retired.add(texture);
    material[slot] = null;
  }
  for (const texture of retired) texture.dispose();
  material.map = map;
  material.needsUpdate = true;
  // Hangar floors use world-unit UVs; this selected finite artwork covers once.
  const position = floor.geometry?.attributes?.position,
    uv = floor.geometry?.attributes?.uv;
  if (position && uv) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let index = 0; index < position.count; index++) {
      minX = Math.min(minX, position.getX(index));
      maxX = Math.max(maxX, position.getX(index));
      minY = Math.min(minY, position.getY(index));
      maxY = Math.max(maxY, position.getY(index));
    }
    if (maxX > minX && maxY > minY)
      for (let index = 0; index < position.count; index++)
        uv.setXY(
          index,
          (position.getX(index) - minX) / (maxX - minX),
          (position.getY(index) - minY) / (maxY - minY),
        );
    uv.needsUpdate = true;
  }
  floor.userData.battlefieldWorld = id;
  return true;
}
