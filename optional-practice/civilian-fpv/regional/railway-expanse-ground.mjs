/** Original 4 km Railway district surfacing. Colour only; never displaces terrain. */
import * as THREE from '../vendor/three.module.js';

// Coordinates follow districts-r1. The older 384 m Railway uses its own material.
const yards = [
  [640, 640, 145, 145],
  [3456, 640, 145, 145],
  [640, 3200, 145, 145],
  [2048, 3200, 145, 145],
  [3456, 3200, 145, 145],
];
const slabs = [
  [588, 640, 14, 48],
  [692, 640, 18, 64],
  [640, 3200, 15, 60],
  [2110, 3200, 23, 76],
];
const rectangles = (rows) =>
  rows
    .map(([x, z, w, d]) => `railExpRect(p,vec2(${x}.0,${z}.0),vec2(${w}.0,${d}.0))`)
    .reduce((a, b) => `min(${a},${b})`);
const functions = `
float railExpRect(vec2 p,vec2 c,vec2 h) {
  vec2 d=abs(p-c)-h;
  return length(max(d,0.0))+min(max(d.x,d.y),0.0);
}
float railExpHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float railExpNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(railExpHash(i),railExpHash(i+vec2(1,0)),f.x),
             mix(railExpHash(i+vec2(0,1)),railExpHash(i+vec2(1,1)),f.x),f.y);
}
`;

export function createRailwayExpanseGround({ quality, originMm }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const uniforms = {
    railExpOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    railExpGrass: { value: new THREE.Color(0x727453) },
    railExpRock: { value: new THREE.Color(0x8b8270) },
    railExpGravel: { value: new THREE.Color(0x746e63) },
    railExpConcrete: { value: new THREE.Color(0xaaa69a) },
    railExpEarth: { value: new THREE.Color(0x716047) },
  };
  material.name = `Railway valley districts · ${quality}`;
  material.customProgramCacheKey = () => `fpv-railway-expanse-ground-v1-${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    if (!['performance', 'balanced', 'quality'].includes(next))
      throw new TypeError('Unknown regional ground quality');
    if (next === quality) return;
    quality = next;
    material.name = `Railway valley districts · ${quality}`;
    material.needsUpdate = true;
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 railExpOrigin; varying vec3 vRailExpPoint; varying vec3 vRailExpNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vRailExpPoint=(modelMatrix*vec4(transformed,1.0)).xyz+railExpOrigin;
vRailExpNormal=normalize(mat3(modelMatrix)*normal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRailExpPoint; varying vec3 vRailExpNormal;
uniform vec3 railExpGrass; uniform vec3 railExpRock; uniform vec3 railExpGravel;
uniform vec3 railExpConcrete; uniform vec3 railExpEarth;
${functions}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 p=vRailExpPoint.xz;
float plateau=1.0-smoothstep(0.15,0.8,abs(vRailExpPoint.y-64.0));
float yard=(1.0-smoothstep(-1.0,8.0,${rectangles(yards)}))*plateau;
float slab=(1.0-smoothstep(-0.12,0.2,${rectangles(slabs)}))*plateau;
// Rail shoulders follow the three real alignments; no ground track beneath the raised bridge.
float trackDistance=min(min(railExpRect(p,vec2(2048,640),vec2(1792,5)),
  railExpRect(p,vec2(2048,3200),vec2(1792,5))),railExpRect(p,vec2(2048,2048),vec2(5,1664)));
float ballast=(1.0-smoothstep(0.0,5.0,trackDistance))*plateau;
float cliff=smoothstep(0.12,0.6,1.0-abs(normalize(vRailExpNormal).y));
float riverbed=1.0-smoothstep(13.0,22.0,vRailExpPoint.y);
float broad=${quality === 'performance' ? '0.5+0.18*sin(p.x*0.021)*sin(p.y*0.017)' : 'railExpNoise(p*0.023)'};
vec3 tint=mix(railExpGrass,railExpRock,cliff);
tint=mix(tint,railExpGravel*0.72,riverbed*0.78);
tint=mix(tint,railExpGravel,yard);
// Distinct quarry aggregate and timber earth distinguish districts from the flight path.
float quarry=(1.0-smoothstep(-1.0,8.0,railExpRect(p,vec2(3456,640),vec2(145,145))))*plateau;
float timber=(1.0-smoothstep(-1.0,8.0,railExpRect(p,vec2(3456,3200),vec2(145,145))))*plateau;
tint=mix(tint,railExpRock,quarry*0.8);
tint=mix(tint,railExpEarth,timber*0.8);
tint=mix(tint,railExpGravel*0.74,ballast);
tint=mix(tint,railExpConcrete,slab);
tint*=0.94+0.12*broad;
float pixel=max(max(fwidth(p.x),fwidth(p.y)),0.001);
vec2 joints=abs(mod(p+2.0,4.0)-2.0);
float joint=(1.0-smoothstep(0.018,0.018+pixel,min(joints.x,joints.y)))
  *(1.0-smoothstep(0.05,0.3,pixel));
tint*=1.0-joint*slab*0.2;
${
  quality === 'performance'
    ? ''
    : `float nearDetail=1.0-smoothstep(0.04,0.5,pixel);
tint*=1.0+(railExpNoise(p*4.0)-0.5)*nearDetail*mix(0.14,0.04,slab);
${quality === 'quality' ? 'tint*=1.0+(railExpNoise(p*13.0)-0.5)*nearDetail*(1.0-slab)*0.07;' : ''}`
}
diffuseColor.rgb*=tint;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor=mix(1.0,0.9,slab);`,
      );
  };
  return material;
}
