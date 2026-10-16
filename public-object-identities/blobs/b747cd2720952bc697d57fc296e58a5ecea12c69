/** Original, bounded authoring surface study. Colour/roughness only; never moves vertices. */
import * as THREE from '../vendor/three.module.js';
import { createUrbanGroundSurface, createRailwayGroundSurface } from './urban-ground-surface.mjs';
import { createHillsideGroundSurface } from './hillside-ground-surface.mjs';

export function validateTerrainSurface(style = 'plain', quality = 'balanced') {
  if (
    ![
      'plain',
      'canyon',
      'urban',
      'railway',
      'tropical',
      'tropical-settlement',
      'desert',
      'hillside-town',
    ].includes(style) ||
    !['performance', 'balanced', 'quality'].includes(quality)
  )
    throw new TypeError('Unknown regional terrain surface profile');
  return Object.freeze({ style, quality });
}

// World-space colour avoids stretched UVs on cliffs and repeats at no cell boundary.
// It is intentionally original procedural artwork: no third-party image or decoder.
const noise = `
float terrainHash(vec3 p) {
  return fract(sin(dot(p, vec3(13.17, 73.91, 117.43))) * 4371.73);
}
float terrainNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(terrainHash(i), terrainHash(i + vec3(1,0,0)), f.x),
                 mix(terrainHash(i + vec3(0,1,0)), terrainHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(terrainHash(i + vec3(0,0,1)), terrainHash(i + vec3(1,0,1)), f.x),
                 mix(terrainHash(i + vec3(0,1,1)), terrainHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export function createTerrainSurface({ style = 'plain', quality = 'balanced', originMm } = {}) {
  validateTerrainSurface(style, quality);
  if (
    !originMm ||
    !['x', 'y', 'z'].every(
      (axis) => Number.isSafeInteger(originMm[axis]) && Math.abs(originMm[axis]) <= 100000000,
    )
  )
    throw new TypeError('Terrain surface needs a bounded integer origin');
  if (style === 'hillside-town') return createHillsideGroundSurface({ quality, originMm });
  if (style === 'urban') return createUrbanGroundSurface({ quality, originMm });
  if (style === 'tropical' || style === 'tropical-settlement')
    return createTropicalGroundSurface({
      quality,
      originMm,
      settlement: style === 'tropical-settlement',
    });
  if (style === 'desert') return createDesertGroundSurface({ quality, originMm });
  if (style === 'railway') return createRailwayGroundSurface({ quality, originMm });
  const material = new THREE.MeshStandardMaterial({
    color: style === 'plain' ? 0x687647 : 0xffffff,
    roughness: 1,
    metalness: 0,
  });
  if (style === 'plain') return material;
  const uniforms = {
    terrainOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    terrainSand: { value: new THREE.Color(0xcab58e) },
    terrainRock: { value: new THREE.Color(0x9b795c) },
    terrainStratum: { value: new THREE.Color(0xb69572) },
  };
  material.name = `Canyon sediment · ${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    validateTerrainSurface(style, next);
    if (next === quality) return;
    quality = next;
    material.name = `Canyon sediment · ${quality}`;
    material.needsUpdate = true;
  };
  material.customProgramCacheKey = () => `fpv-terrain-surface-v2-${quality}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 terrainOrigin;\nvarying vec3 vTerrainPoint;\nvarying vec3 vTerrainNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrainPoint = (modelMatrix * vec4(transformed, 1.0)).xyz + terrainOrigin;\nvTerrainNormal = normalize(mat3(modelMatrix) * normal);',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vTerrainPoint;
varying vec3 vTerrainNormal;
uniform vec3 terrainSand;
uniform vec3 terrainRock;
uniform vec3 terrainStratum;
${quality === 'performance' ? '' : noise}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 terrainFace = normalize(vTerrainNormal);
float terrainCliff = smoothstep(0.18, 0.72, 1.0 - abs(terrainFace.y));
// Irregular, broad sediment deposits replace evenly spaced horizontal stripes.
// Performance keeps the zero-noise-sample path; other tiers reuse their broad sample.
float terrainDeposit = ${
        quality === 'performance'
          ? '0.5 + 0.18 * sin(dot(vTerrainPoint, vec3(0.037, 0.061, 0.023))) + 0.12 * sin(dot(vTerrainPoint, vec3(0.013, -0.027, 0.071)))'
          : 'terrainNoise(vTerrainPoint * vec3(0.032, 0.115, 0.032))'
      };
vec3 terrainSediment = mix(terrainRock, terrainStratum, 0.3 + 0.45 * terrainDeposit);
vec3 terrainTint = mix(terrainSand, terrainSediment, terrainCliff);
${
  quality === 'performance'
    ? ''
    : `
float terrainNear = 1.0 - smoothstep(0.03, 0.5, length(fwidth(vTerrainPoint)));
float terrainGrain = terrainNoise(vTerrainPoint * 2.5) - 0.5;
terrainTint *= 0.94 + 0.12 * terrainDeposit + terrainGrain * terrainNear * 0.12;
${quality === 'quality' ? 'terrainTint *= 1.0 + (terrainNoise(vTerrainPoint * 7.0) - 0.5) * terrainNear * 0.09;' : ''}`
}
diffuseColor.rgb *= terrainTint;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor - terrainCliff * 0.08, 0.88, 1.0);`,
    );
  };
  return material;
}

// Authored for the separate districts-r2 study only. These are surface markings,
// not collision or task hints; the existing tropical profile keeps its original layout.
const settlementFunctions = `
float coastSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p-a, ab) / dot(ab, ab), 0.0, 1.0));
}
float coastCourt(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
`;
const settlementColour = `
vec2 coastP = tp.xz;
float coastStreet = coastSegment(coastP, vec2(382,302), vec2(382,440));
coastStreet = min(coastStreet, coastSegment(coastP, vec2(350,355), vec2(400,355)));
coastStreet = min(coastStreet, coastSegment(coastP, vec2(366,328), vec2(382,328)));
coastStreet = min(coastStreet, coastSegment(coastP, vec2(366,414), vec2(382,414)));
coastStreet = min(coastStreet, coastSegment(coastP, vec2(382,390), vec2(415,390)));
float coastCourtyard = coastCourt(coastP, vec2(350,355), vec2(9,7));
coastCourtyard = min(coastCourtyard, coastCourt(coastP, vec2(415,390), vec2(9,7)));
coastCourtyard = min(coastCourtyard, coastCourt(coastP, vec2(366,328), vec2(9,7)));
coastCourtyard = min(coastCourtyard, coastCourt(coastP, vec2(366,414), vec2(7,9)));
coastCourtyard = min(coastCourtyard, coastCourt(coastP, vec2(400,355), vec2(9,7)));
// Irregular feathered edges avoid a painted road or a false physical edge.
float coastRoughEdge = (patches - 0.5) * 1.4;
float coastPathMask = 1.0 - smoothstep(2.2, 5.2, coastStreet + coastRoughEdge);
float coastCourtMask = 1.0 - smoothstep(-0.3, 2.3, coastCourtyard + coastRoughEdge);
float coastPlateau = 1.0 - smoothstep(0.2, 1.2, abs(tp.y - 14.0));
float coastWear = max(coastPathMask, coastCourtMask) * coastPlateau;
vec3 coastDryGrass = mix(tropicalGrass, tropicalEarth, smoothstep(0.35,0.75,patches)*0.4);
tropicalTint = mix(tropicalTint, coastDryGrass, vegetation * 0.55);
vec3 coastPathTint = mix(tropicalEarth, tropicalSand, 0.22 + patches*0.12);
tropicalTint = mix(tropicalTint, coastPathTint, coastWear);
float coastWetSand = 1.0 - smoothstep(0.05,1.35,tp.y);
tropicalTint *= 1.0 - coastWetSand*0.28;
// Soft metre-scale ripples fade before becoming a distant moire pattern.
float coastPixel = max(length(fwidth(coastP)), 0.001);
float coastRipple = sin(tp.x*2.1 + tp.z*0.8 + patches*3.0);
tropicalTint *= 1.0 + coastRipple * 0.035 * (1.0-vegetation)
                      * (1.0-smoothstep(0.1,0.6,coastPixel));
`;

/** Original beach/dune colour treatment; exact source height and collision never move. */
function createTropicalGroundSurface({ quality, originMm, settlement = false }) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  });
  const label = settlement
    ? 'Coastal settlement paths and shoreline'
    : 'Tropical sand and dune grass';
  const uniforms = {
    tropicalOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    tropicalSand: { value: new THREE.Color(0xd4c69c) },
    tropicalGrass: { value: new THREE.Color(settlement ? 0x66764b : 0x53733b) },
    tropicalEarth: { value: new THREE.Color(0x9b8961) },
  };
  material.name = `${label} · ${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    validateTerrainSurface(settlement ? 'tropical-settlement' : 'tropical', next);
    if (next === quality) return;
    quality = next;
    material.name = `${label} · ${quality}`;
    material.needsUpdate = true;
  };
  material.customProgramCacheKey = () =>
    `fpv-tropical-${settlement ? 'settlement' : 'ground'}-v1-${quality}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 tropicalOrigin;\nvarying vec3 vTropicalPoint;\nvarying vec3 vTropicalNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTropicalPoint = (modelMatrix * vec4(transformed, 1.0)).xyz + tropicalOrigin;\nvTropicalNormal = normalize(mat3(modelMatrix) * normal);',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vTropicalPoint;
varying vec3 vTropicalNormal;
uniform vec3 tropicalSand;
uniform vec3 tropicalGrass;
uniform vec3 tropicalEarth;
${quality === 'performance' ? '' : noise}
${settlement ? settlementFunctions : ''}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 tp = vTropicalPoint;
float patches = ${quality === 'performance' ? '0.5 + 0.22 * sin(tp.x * 0.11) * sin(tp.z * 0.09)' : 'terrainNoise(tp * vec3(0.12, 0.08, 0.12))'};
float vegetation = ${settlement ? 'smoothstep(2.2, 5.5, tp.y + patches * 1.2)' : 'smoothstep(1.7, 3.5, tp.y + patches * 0.65)'};
float exposed = smoothstep(0.12, 0.42, 1.0 - abs(normalize(vTropicalNormal).y));
vec3 tropicalTint = mix(tropicalSand, tropicalGrass, vegetation);
tropicalTint = mix(tropicalTint, tropicalEarth, exposed * 0.7);
tropicalTint *= 0.94 + patches * 0.12;
${settlement ? settlementColour : ''}
${
  quality === 'performance'
    ? ''
    : `float nearGrain = 1.0 - smoothstep(0.03, 0.45, length(fwidth(tp)));
tropicalTint *= 1.0 + (terrainNoise(tp * 3.5) - 0.5) * nearGrain * 0.1;
${quality === 'quality' ? 'tropicalTint *= 1.0 + (terrainNoise(tp * 12.0) - 0.5) * nearGrain * 0.06;' : ''}`
}
diffuseColor.rgb *= tropicalTint;`,
    );
  };
  return material;
}

/**
 * Original Desert Expedition study: global metre coordinates match natural-r1's
 * authored playa, dunes, wash, mesas and pediment. This is an explicit opt-in,
 * never a guess based on terrain height or a default for other regional sources.
 * Colour and roughness only: narrow lines below are grain, never fake obstacles.
 */
function createDesertGroundSurface({ quality, originMm }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const uniforms = {
    desertOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    desertSand: { value: new THREE.Color(0xd6b887) },
    desertAlluvium: { value: new THREE.Color(0xb29a79) },
    desertSalt: { value: new THREE.Color(0xdfdbc9) },
    desertRock: { value: new THREE.Color(0x9b7256) },
    desertPediment: { value: new THREE.Color(0x807363) },
  };
  material.name = `Desert sand, salt and stone · ${quality}`;
  material.customProgramCacheKey = () => `fpv-desert-ground-v1-${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    validateTerrainSurface('desert', next);
    if (quality === next) return;
    quality = next;
    material.name = `Desert sand, salt and stone · ${quality}`;
    material.needsUpdate = true;
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 desertOrigin;\nvarying vec3 vDesertPoint;\nvarying vec3 vDesertNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDesertPoint = (modelMatrix * vec4(transformed, 1.0)).xyz + desertOrigin;\nvDesertNormal = normalize(mat3(modelMatrix) * normal);',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vDesertPoint;
varying vec3 vDesertNormal;
uniform vec3 desertSand;
uniform vec3 desertAlluvium;
uniform vec3 desertSalt;
uniform vec3 desertRock;
uniform vec3 desertPediment;
float desertMask(vec2 p, vec2 c, vec2 r) {
  return 1.0 - smoothstep(0.7, 1.3, length((p - c) / r));
}
${quality === 'performance' ? '' : noise}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 dp = vDesertPoint;
// Smooth outer bounds keep this source-specific treatment out of unrelated coordinates.
float desertBounds = smoothstep(0.0, 32.0, dp.x) * smoothstep(0.0, 32.0, dp.z)
  * (1.0 - smoothstep(16352.0, 16384.0, dp.x)) * (1.0 - smoothstep(16352.0, 16384.0, dp.z));
float desertDunes = desertMask(dp.xz, vec2(3200.0, 3300.0), vec2(2600.0, 2350.0));
float desertPlaya = desertMask(dp.xz, vec2(3400.0, 11500.0), vec2(2550.0, 2200.0));
float desertPlayaLevel = 38.0 + 0.0008 * (dp.x - 3400.0) + 0.0004 * (dp.z - 11500.0);
// Raised island/headland rock must not be painted as a flat salt lake.
desertPlaya *= 1.0 - smoothstep(3.0, 20.0, dp.y - desertPlayaLevel);
float desertWashX = 6500.0 + 650.0 * sin(dp.z / 1700.0) + 220.0 * sin(dp.z / 690.0 + 0.4);
float desertWashWave = sin(dp.z / 1100.0);
float desertWashWidth = 150.0 + 35.0 * desertWashWave * desertWashWave;
float desertWash = 1.0 - smoothstep(0.65, 1.5, abs(dp.x - desertWashX) / desertWashWidth);
float desertScarp = smoothstep(11200.0, 12600.0, dp.x) * (1.0 - smoothstep(4400.0, 6900.0, dp.z));
float desertMesas = max(
  1.0 - smoothstep(0.65, 1.15, length((dp.xz - vec2(10400.0, 9300.0)) / vec2(1050.0, 1600.0))),
  1.0 - smoothstep(0.62, 1.2, length((dp.xz - vec2(13500.0, 10400.0)) / vec2(1300.0, 1250.0))));
float desertPlain = desertMask(dp.xz, vec2(11000.0, 14000.0), vec2(2700.0, 1850.0));
float desertCliff = smoothstep(0.07, 0.36, 1.0 - abs(normalize(vDesertNormal).y));
float desertStone = max(desertCliff, max(desertScarp * 0.6, desertMesas * 0.72));
float desertPatch = ${quality === 'performance' ? '0.5 + 0.18 * sin(dp.x * 0.0037 + dp.z * 0.0021) * sin(dp.z * 0.0043)' : 'terrainNoise(dp * vec3(0.008, 0.014, 0.008))'};
vec3 desertTint = mix(desertAlluvium, desertSand, 0.35 + desertDunes * 0.65);
desertTint = mix(desertTint, desertPediment, desertPlain * (0.45 + desertPatch * 0.25));
desertTint = mix(desertTint, desertRock, desertStone);
desertTint = mix(desertTint, desertAlluvium * 0.9, desertWash * (1.0 - desertPlaya) * 0.65);
desertTint = mix(desertTint, desertSalt, desertPlaya);
desertTint *= 0.97 + desertPatch * 0.06;
${
  quality === 'performance'
    ? ''
    : `
float desertNear = 1.0 - smoothstep(0.08, 0.6, length(fwidth(dp)));
// Low contrast directional sand grain is filtered away at distance, not normal displacement.
float desertGrain = sin((dp.x + 0.38 * dp.z) * 2.6 + terrainNoise(dp * 0.4) * 3.0);
desertTint *= 1.0 + desertGrain * desertNear * desertDunes * 0.025;
${quality === 'quality' ? 'desertTint *= 1.0 + (terrainNoise(dp * 5.0) - 0.5) * desertNear * 0.045;' : ''}`
}
diffuseColor.rgb *= mix(desertAlluvium, desertTint, desertBounds);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
roughnessFactor = clamp(1.0 - desertStone * 0.08, 0.9, 1.0);`,
    );
  };
  return material;
}
