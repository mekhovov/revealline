/** Original, bounded authoring surface study. Colour/roughness only; never moves vertices. */
import * as THREE from '../vendor/three.module.js';
import { createUrbanGroundSurface } from './urban-ground-surface.mjs';

export function validateTerrainSurface(style = 'plain', quality = 'balanced') {
  if (
    !['plain', 'canyon', 'urban'].includes(style) ||
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
  if (style === 'urban') return createUrbanGroundSurface({ quality, originMm });
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
