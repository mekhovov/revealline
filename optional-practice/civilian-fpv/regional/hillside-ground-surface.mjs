/** Original town-r2 ground study. Static surface colour only; no physical curb or displacement. */
import * as THREE from '../vendor/three.module.js';

// Derived from the exact town-r2 wall/floor source; authoring verification binds all 18 houses.
// Two repeated 128 m cell templates avoid per-object shader traversal or extra textures.
export const HILLSIDE_CONTACT_FOOTPRINTS = Object.freeze([
  Object.freeze([48, 48, 5.25, 5.125]),
  Object.freeze([90, 82, 5.25, 5.125]),
]);

export function createHillsideGroundSurface({ quality, originMm }) {
  const valid = (value) => {
    if (!['performance', 'balanced', 'quality'].includes(value))
      throw new TypeError('Unknown hillside ground quality');
  };
  valid(quality);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const uniforms = {
    hillsideOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    hillsideContactA: { value: new THREE.Vector4(...HILLSIDE_CONTACT_FOOTPRINTS[0]) },
    hillsideContactB: { value: new THREE.Vector4(...HILLSIDE_CONTACT_FOOTPRINTS[1]) },
    hillsideGrass: { value: new THREE.Color(0x647253) },
    hillsideSoil: { value: new THREE.Color(0x8b7962) },
    hillsideStone: { value: new THREE.Color(0xb6ad98) },
  };
  const name = () => `Hillside streets and courtyards · ${quality}`;
  material.name = name();
  material.userData.setRegionalSurfaceQuality = (next) => {
    valid(next);
    if (quality === next) return;
    quality = next;
    material.name = name();
    material.needsUpdate = true;
  };
  material.customProgramCacheKey = () => `fpv-hillside-ground-contact-v2-${quality}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 hillsideOrigin;
varying vec3 vHillsidePoint;
varying vec3 vHillsideNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vHillsidePoint = (modelMatrix * vec4(transformed, 1.0)).xyz + hillsideOrigin;
vHillsideNormal = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vHillsidePoint;
varying vec3 vHillsideNormal;
uniform vec4 hillsideContactA;
uniform vec4 hillsideContactB;
uniform vec3 hillsideGrass;
uniform vec3 hillsideSoil;
uniform vec3 hillsideStone;
float hillRange(float p, float lo, float hi) {
  float aa = max(fwidth(p), 0.08);
  return smoothstep(lo-aa,lo+aa,p)*(1.0-smoothstep(hi-aa,hi+aa,p));
}
float hillBox(vec2 p, vec2 centre, vec2 halfSize) {
  vec2 d = abs(p-centre)-halfSize;
  return length(max(d,0.0))+min(max(d.x,d.y),0.0);
}
float hillJoint(float p, float period) {
  float aa = max(fwidth(p),0.002);
  float d = abs(fract(p/period+0.5)-0.5)*period;
  return (1.0-smoothstep(0.012,0.012+aa,d))*(1.0-smoothstep(period*0.12,period*0.45,aa));
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 hp = vHillsidePoint;
vec2 p = hp.xz;
// Coordinates follow the exact authored 384 m town. Global positions keep cells seamless.
vec2 local = mod(p,128.0);
float crossStreet = abs(local.y-64.0);
float gradedStreet = min(abs(p.x-128.0),abs(p.x-256.0));
float streetDistance = min(crossStreet,gradedStreet);
float streetMargin = 1.0-smoothstep(7.2,10.5,streetDistance);
float court = hillBox(vec2(p.x,local.y),vec2(192.0,100.0),vec2(21.0,17.0));
float courtApron = 1.0-smoothstep(0.0,2.2,court);
// Door approaches end at existing openings; these are flush material changes, not obstacles.
float frontPath = (1.0-smoothstep(1.1,2.0,abs(local.x-43.0)))*hillRange(local.y,48.0,64.0);
float streetPath = (1.0-smoothstep(1.1,2.0,abs(local.x-85.0)))*hillRange(local.y,64.0,82.0);
float houseApron = min(hillBox(local,vec2(48.0,48.0),vec2(7.0)),hillBox(local,vec2(90.0,82.0),vec2(7.0)));
float plot = 1.0-smoothstep(0.0,3.5,houseApron);
float broad = 0.5+0.23*sin(p.x*0.071+p.y*0.017)*sin(p.y*0.043-p.x*0.019);
float terrace = clamp(hp.y/12.0,0.0,2.0);
vec3 tint = mix(hillsideGrass,hillsideSoil,smoothstep(0.43,0.76,broad)*0.38);
tint *= 0.93+broad*0.12+terrace*0.015;
float gravel = max(streetMargin,plot*0.62);
tint = mix(tint,mix(hillsideSoil,hillsideStone,0.20+broad*0.12),gravel);
float paved = max(courtApron,max(frontPath,streetPath));
vec3 paving = hillsideStone*(0.94+broad*0.09);
${
  quality === 'performance'
    ? ''
    : `
float row = floor(p.y/0.7);
float joint = max(hillJoint(p.y,0.7),hillJoint(p.x+mod(row,2.0)*0.55,1.1));
paving *= 1.0-joint*0.18;
float nearDetail = 1.0-smoothstep(0.04,0.35,length(fwidth(hp)));
float grain = sin(p.x*21.0+p.y*13.0)*sin(p.y*27.0-p.x*17.0);
tint *= 1.0+grain*nearDetail*0.025;
${quality === 'quality' ? 'paving *= 1.0+grain*nearDetail*0.035;' : ''}`
}
tint = mix(tint,paving,paved);
float slope = smoothstep(0.12,0.55,1.0-abs(normalize(vHillsideNormal).y));
tint = mix(tint,hillsideSoil*(0.9+broad*0.12),slope*0.35);
// Static local grounding cue on the authored terrace plane, not a projected shadow.
float edgeA = abs(hillBox(local,hillsideContactA.xy,hillsideContactA.zw));
float edgeB = abs(hillBox(local,hillsideContactB.xy,hillsideContactB.zw));
float contactBand = 1.0-smoothstep(0.0,0.8,min(edgeA,edgeB));
float groundPlane = 1.0-smoothstep(0.03,0.35,abs(hp.y-floor(p.y/128.0)*12.0));
float horizontal = smoothstep(0.85,0.98,abs(normalize(vHillsideNormal).y));
tint *= 1.0-0.22*contactBand*groundPlane*horizontal;
diffuseColor.rgb *= tint;`,
    );
  };
  return material;
}
