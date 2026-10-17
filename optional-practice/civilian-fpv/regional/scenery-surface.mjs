/** Original, optional Urban presentation. No geometry or collision displacement. */
import * as THREE from '../vendor/three.module.js';

export function validateScenerySurface(style = 'plain', quality = 'balanced') {
  if (
    !['plain', 'urban', 'tropical-settlement-water', 'alpine-overlays', 'lunar-survey'].includes(
      style,
    ) ||
    !['performance', 'balanced', 'quality'].includes(quality)
  )
    throw new TypeError('Unknown scenery surface profile');
  return style;
}

/** Only explicitly matched original visual surfaces opt in; licensed props stay untouched. */
export function sceneryMaterialStyle(style, surface) {
  validateScenerySurface(style);
  if (style === 'lunar-survey')
    return !surface.texture && lunarSurfaceKind(surface.color) >= 0 ? style : 'plain';
  if (style === 'alpine-overlays') {
    const texture = surface.texture;
    const overlay =
      surface.collision === 'visual-only' &&
      surface.alphaMode === 'OPAQUE' &&
      surface.doubleSided === true &&
      !surface.colors &&
      texture?.width === 1 &&
      texture.height === 1 &&
      texture.rgbaBase64 === '/////w==' &&
      [
        [0.9, 0.94, 0.96], // Original terrain-following snow.
        [0.48, 0.51, 0.52], // Scree.
        [0.12, 0.42, 0.48], // Meltwater ribbon, not the separate reservoir plane.
        [0.29, 0.29, 0.27], // Road apron.
      ].some((palette) => palette.every((value, i) => surface.color[i] === value));
    return overlay ? style : 'plain';
  }
  if (style !== 'tropical-settlement-water') return surface.texture ? 'plain' : style;
  const texture = surface.texture;
  const sea =
    surface.id === 'sea-surface' &&
    surface.collision === 'visual-only' &&
    surface.alphaMode === 'OPAQUE' &&
    surface.doubleSided === false &&
    !surface.colors &&
    texture?.width === 1 &&
    texture.height === 1 &&
    texture.rgbaBase64 === '/////w==' &&
    surface.positions.length === 12 &&
    surface.indices.length === 6 &&
    surface.positions.every((v, i) => i % 3 !== 1 || v === 0) &&
    surface.normals?.every((v, i) => v === (i % 3 === 1 ? 1 : 0)) &&
    [0.035, 0.35, 0.43].every((v, i) => surface.color[i] === v);
  return sea ? style : 'plain';
}

// Static world-space colour cues, not displaced waves, water depth or a physics surface.
// No clock/uniform animation: reduced-motion and Pixel presentation remain stable.
function coastalWater(material, quality, originMm) {
  const uniforms = {
    coastOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    coastDeep: { value: new THREE.Color().setRGB(0.018, 0.135, 0.18) },
    coastShallow: { value: new THREE.Color().setRGB(0.075, 0.32, 0.32) },
    coastSandWater: { value: new THREE.Color().setRGB(0.22, 0.39, 0.31) },
  };
  material.roughness = 0.78;
  material.name = `Coastal shoreline water · ${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    validateScenerySurface('tropical-settlement-water', next);
    if (next === quality) return;
    quality = next;
    material.name = `Coastal shoreline water · ${quality}`;
    material.needsUpdate = true;
  };
  material.customProgramCacheKey = () => `fpv-coastal-water-study-v1-${quality}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 coastOrigin;\nvarying vec3 vCoastPoint;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvCoastPoint = (modelMatrix * vec4(transformed, 1.0)).xyz + coastOrigin;',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vCoastPoint;
uniform vec3 coastDeep;
uniform vec3 coastShallow;
uniform vec3 coastSandWater;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec2 coast = vCoastPoint.xz;
// Matches the authored coast's broad shoreline; raised terrain still masks this plane.
float shore = 155.0 + 24.0 * sin(coast.x / 80.0) + 9.0 * sin(coast.x / 37.0);
float offshore = max(shore - coast.y, 0.0);
float shallows = 1.0 - smoothstep(3.0, 62.0, offshore);
float sandbar = 1.0 - smoothstep(26.0, 68.0, distance(coast, vec2(446.0, 130.0)));
shallows = max(shallows, sandbar * 0.8);
float broad = sin(coast.x * 0.027 + coast.y * 0.019) * sin(coast.y * 0.041 - coast.x * 0.011);
vec3 waterTint = mix(coastDeep, coastShallow, shallows);
waterTint = mix(waterTint, coastSandWater, (1.0 - smoothstep(0.0, 12.0, offshore)) * 0.34);
waterTint *= 0.97 + broad * 0.035;
${
  quality === 'performance'
    ? ''
    : `
float detailFade = 1.0 - smoothstep(0.07, 0.5, length(fwidth(coast)));
float ripple = sin(coast.x * 1.45 + coast.y * 0.83 + sin(coast.y * 0.15) * 0.65);
float fine = ${quality === 'quality' ? 'sin(coast.x * 3.1 - coast.y * 1.65) * 0.012' : '0.0'};
waterTint *= 1.0 + (ripple * 0.022 + fine) * detailFade;
`
}
// Preserve opaque source alpha and existing lighting; no screen-space reflection pass.
diffuseColor.rgb = waterTint;`,
    );
  };
  return material;
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

export function createScenerySurface({
  style = 'plain',
  quality = 'balanced',
  color,
  originMm,
} = {}) {
  validateScenerySurface(style, quality);
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
  if (style === 'alpine-overlays') {
    // Bounded decal-style depth bias avoids coplanar terrain fighting without lifting
    // authored vertices or disabling ordinary depth occlusion behind real structures.
    material.name = 'Alpine terrain overlay';
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    return material;
  }
  if (style === 'tropical-settlement-water') return coastalWater(material, quality, originMm);
  if (style === 'lunar-survey') return lunarSurveySurface(material, color, quality, originMm);
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

// Only the five original composition-r1 palettes are eligible; licensed palettes are untouched.
export function lunarSurfaceKind(color) {
  if (!Array.isArray(color)) return -1;
  return [
    [0.25, 0.27, 0.29],
    [0.51, 0.5, 0.47],
    [0.7, 0.69, 0.64],
    [0.57, 0.62, 0.64],
    [0.75, 0.52, 0.21],
  ].findIndex((palette) => palette.every((value, index) => value === color[index]));
}

function lunarSurveySurface(material, color, quality, originMm) {
  const kind = lunarSurfaceKind(color);
  if (kind < 0) return material;
  // Cool graphite rock, light dust and galvanized survey structures; original amber markers stay amber.
  material.color.setRGB(
    ...[
      [0.19, 0.205, 0.22],
      [0.34, 0.35, 0.36],
      [0.59, 0.59, 0.56],
      [0.61, 0.65, 0.67],
      [0.75, 0.52, 0.21],
    ][kind],
  );
  material.roughness = kind === 3 ? 0.78 : 0.98;
  const uniforms = {
    lunarSurveyOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
  };
  material.name = `Lunar ${kind === 3 ? 'survey alloy' : kind === 4 ? 'amber marker' : 'rock'} · ${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    validateScenerySurface('lunar-survey', next);
    if (next === quality) return;
    quality = next;
    material.name = `Lunar ${kind === 3 ? 'survey alloy' : kind === 4 ? 'amber marker' : 'rock'} · ${quality}`;
    material.needsUpdate = true;
  };
  material.customProgramCacheKey = () => `fpv-lunar-survey-v1-${kind}-${quality}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 lunarSurveyOrigin;\nvarying vec3 vLunarSurveyPoint;\nvarying vec3 vLunarSurveyNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvLunarSurveyPoint = (modelMatrix * vec4(transformed,1.0)).xyz + lunarSurveyOrigin;\nvLunarSurveyNormal = normalize(mat3(modelMatrix)*normal);',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vLunarSurveyPoint;
varying vec3 vLunarSurveyNormal;
float lunarSurveyHash(vec3 p) { return fract(sin(dot(p,vec3(13.17,73.91,117.43)))*4371.73); }
float lunarSurveyNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(lunarSurveyHash(i),lunarSurveyHash(i+vec3(1,0,0)),f.x),mix(lunarSurveyHash(i+vec3(0,1,0)),lunarSurveyHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(lunarSurveyHash(i+vec3(0,0,1)),lunarSurveyHash(i+vec3(1,0,1)),f.x),mix(lunarSurveyHash(i+vec3(0,1,1)),lunarSurveyHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 sp=vLunarSurveyPoint;
vec3 sn=abs(normalize(vLunarSurveyNormal));
float surveyBroad=${quality === 'performance' ? '0.5 + 0.12*sin(sp.x*0.47+sp.y*0.29)*sin(sp.z*0.37-sp.y*0.21)' : 'lunarSurveyNoise(sp*0.42)'};
${
  kind === 3
    ? `
// Two-metre alloy panels, anti-aliased and faded at distance. No wood-grain stripes.
vec2 panel = sn.y > max(sn.x,sn.z) ? sp.xz : (sn.x > sn.z ? sp.zy : sp.xy);
vec2 edge = abs(fract(panel/2.0+0.5)-0.5)*2.0;
float aa=max(length(fwidth(panel)),0.008);
float joint=(1.0-smoothstep(0.015,0.015+aa,min(edge.x,edge.y)))*(1.0-smoothstep(0.12,0.5,aa));
diffuseColor.rgb *= (0.96 + surveyBroad*0.08)*(1.0-joint*0.28);
`
    : kind === 4
      ? 'diffuseColor.rgb *= 0.98 + surveyBroad*0.04;'
      : `
float dust=smoothstep(0.42,0.95,max(normalize(vLunarSurveyNormal).y,0.0));
diffuseColor.rgb *= 0.86+surveyBroad*0.22+dust*0.09;
${quality === 'performance' ? '' : 'diffuseColor.rgb *= 1.0+(lunarSurveyNoise(sp*2.2)-0.5)*0.12*(1.0-smoothstep(0.05,0.4,length(fwidth(sp))));'}
${quality === 'quality' ? 'diffuseColor.rgb *= 1.0+(lunarSurveyNoise(sp*6.0)-0.5)*0.06*(1.0-smoothstep(0.02,0.15,length(fwidth(sp))));' : ''}
`
}`,
    );
  };
  return material;
}
