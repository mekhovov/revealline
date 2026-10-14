/** Original, optional Urban presentation. No geometry or collision displacement. */
import * as THREE from '../vendor/three.module.js';

export function validateScenerySurface(style = 'plain') {
  if (!['plain', 'urban'].includes(style)) throw new TypeError('Unknown scenery surface profile');
  return style;
}

// Only the four original architectural colours opt into material treatments.
// Licensed prop palettes remain intact rather than being guessed from brightness.
export function urbanSurfaceKind(color) {
  const palettes = [
    [0.57, 0.56, 0.51], // concrete
    [0.43, 0.23, 0.15], // brick
    [0.18, 0.26, 0.29], // painted steel
    [0.25, 0.29, 0.31], // roof sheet
  ];
  return palettes.findIndex((p) => p.every((v, i) => Math.abs(v - color[i]) < 0.0001)) + 1;
}

export function createScenerySurface({ style = 'plain', color, originMm } = {}) {
  validateScenerySurface(style);
  if (
    !Array.isArray(color) ||
    color.length !== 3 ||
    color.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
  )
    throw new TypeError('Scenery surface needs a valid colour');
  if (
    !originMm ||
    !['x', 'y', 'z'].every(
      (axis) => Number.isSafeInteger(originMm[axis]) && Math.abs(originMm[axis]) <= 100000000,
    )
  )
    throw new TypeError('Scenery surface needs a bounded integer origin');
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(...color),
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const kind = urbanSurfaceKind(color);
  if (style === 'plain' || !kind) return material;
  material.name = `Urban architectural surface ${kind}`;
  material.customProgramCacheKey = () => `fpv-urban-surface-v1-${kind}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.urbanOrigin = {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 urbanOrigin;\nvarying vec3 vUrbanPoint;\nvarying vec3 vUrbanNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvUrbanPoint = (modelMatrix * vec4(transformed, 1.0)).xyz + urbanOrigin;\nvUrbanNormal = normalize(mat3(modelMatrix) * normal);',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vUrbanPoint;
varying vec3 vUrbanNormal;
float urbanLine(float coordinate, float period, float width) {
  float distanceToLine = abs(fract(coordinate / period + 0.5) - 0.5) * period;
  float aa = max(fwidth(coordinate), 0.002);
  return (1.0 - smoothstep(width, width + aa, distanceToLine)) * (1.0 - smoothstep(period * 0.2, period * 0.6, aa));
}
float urbanRange(float value, float low, float high) {
  float aa = max(fwidth(value), 0.01);
  return smoothstep(low - aa, low + aa, value) * (1.0 - smoothstep(high - aa, high + aa, value));
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 p = vUrbanPoint;
vec3 n = abs(normalize(vUrbanNormal));
float horizontalFace = step(0.8, n.y);
float u = n.x > n.z ? p.z : p.x;
vec2 plane = horizontalFace > 0.5 ? p.xz : vec2(u, p.y);
float broadWear = sin(p.x * 0.13 + p.y * 0.37) * sin(p.z * 0.17 - p.y * 0.21);
float detailFade = 1.0 - smoothstep(0.04, 0.3, length(fwidth(p)));
float grain = sin(p.x * 31.0 + p.z * 19.0) * sin(p.y * 27.0 + p.z * 23.0) * detailFade;
diffuseColor.rgb *= 0.96 + broadWear * 0.055 + grain * 0.025;
${
  kind === 1
    ? `
float joint = max(urbanLine(plane.x, 6.0, 0.025), urbanLine(plane.y, horizontalFace > 0.5 ? 6.0 : 3.0, 0.025));
diffuseColor.rgb *= 1.0 - joint * 0.18;
`
    : kind === 2
      ? `
float course = floor(p.y / 0.25);
float mortar = max(urbanLine(p.y, 0.25, 0.012), urbanLine(u + mod(course, 2.0) * 0.3, 0.6, 0.012));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.32, 0.27), mortar * 0.65);
`
      : `
float rib = urbanLine(plane.x, ${kind === 4 ? '0.33' : '1.8'}, ${kind === 4 ? '0.04' : '0.025'});
diffuseColor.rgb *= 1.0 - rib * 0.16;
`
}
// Painted entrance borders and exposed deck lips are on real surfaces, never floating gates.
float frontPlane = max(urbanRange(p.z, 29.45, 30.55), urbanRange(p.z, 97.45, 98.55));
float jamb = max(urbanRange(p.x, 183.5, 184.05), urbanRange(p.x, 195.95, 196.5)) * urbanRange(p.y, 0.0, 9.0);
float lintel = urbanRange(p.x, 184.0, 196.0) * urbanRange(p.y, 9.0, 9.5);
float entrancePaint = frontPlane * max(jamb, lintel);
float mill = urbanRange(p.x, 32.0, 96.0) * urbanRange(p.z, 32.0, 96.0);
float millLip = max(urbanRange(p.x, 49.6, 50.0), urbanRange(p.x, 78.0, 78.4)) * urbanRange(p.z, 52.0, 76.0);
float parking = urbanRange(p.x, 22.0, 106.0) * urbanRange(p.z, 218.0, 302.0);
float parkingLip = max(urbanRange(p.x, 55.6, 56.0), urbanRange(p.x, 72.0, 72.4)) * urbanRange(p.z, 252.0, 268.0);
float paint = max(entrancePaint, horizontalFace * max(mill * millLip, parking * parkingLip));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.43, 0.09), paint * 0.82);
`,
    );
  };
  return material;
}
