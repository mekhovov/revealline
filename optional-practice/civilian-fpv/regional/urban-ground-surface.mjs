/** Original, metre-scale industrial study surfacing. No textures, displacement or collision changes. */
import * as THREE from '../vendor/three.module.js';

const functions = `
float urbanGroundRect(vec2 p, vec2 centre, vec2 halfSize) {
  vec2 d = abs(p - centre) - halfSize;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float urbanGroundHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float urbanGroundNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(urbanGroundHash(i), urbanGroundHash(i + vec2(1,0)), f.x),
             mix(urbanGroundHash(i + vec2(0,1)), urbanGroundHash(i + vec2(1,1)), f.x), f.y);
}
`;

function railwayColour(quality) {
  return `
vec2 urbanP = vUrbanGroundPoint.xz;
// Only the actual 14 m yard plateau carries industrial surfacing. The cutting stays natural.
float railwayPlateau = 1.0 - smoothstep(0.15, 0.8, abs(vUrbanGroundPoint.y - 14.0));
float railwayYardDistance = min(urbanGroundRect(urbanP, vec2(250,70),vec2(110,42)),
                               urbanGroundRect(urbanP, vec2(250,304),vec2(94,40)));
float railwayYard = (1.0 - smoothstep(-0.5, 3.0, railwayYardDistance)) * railwayPlateau;
float railwayFloorDistance = min(urbanGroundRect(urbanP,vec2(300,70),vec2(20.5,29)),
                                urbanGroundRect(urbanP,vec2(166,66),vec2(14,38)));
float urbanConcrete = (1.0 - smoothstep(-0.15,0.35,railwayFloorDistance)) * railwayPlateau;
float railwayLaneDistance = min(urbanGroundRect(urbanP,vec2(250,70),vec2(8,42)),
                               urbanGroundRect(urbanP,vec2(250,304),vec2(8,40)));
float railwayRoad = (1.0 - smoothstep(-0.25,0.4,railwayLaneDistance)) * railwayPlateau;
float railwayTrackDistance = min(abs(urbanP.x-234.0),abs(urbanP.x-266.0));
float railwayTrackLength = max(1.0-smoothstep(34.0,37.0,abs(urbanP.y-70.0)),
                              1.0-smoothstep(34.0,37.0,abs(urbanP.y-302.0)));
float railwayBallast = (1.0-smoothstep(2.7,4.2,railwayTrackDistance))*railwayTrackLength*railwayPlateau;
float railwayCut = 1.0-smoothstep(-6.8,-3.0,vUrbanGroundPoint.y);
vec3 urbanGroundTint = mix(urbanGroundVerge,urbanGroundGravel*0.85,railwayCut*0.7);
urbanGroundTint = mix(urbanGroundTint,urbanGroundGravel,railwayYard);
urbanGroundTint = mix(urbanGroundTint,urbanGroundAsphalt,railwayRoad);
urbanGroundTint = mix(urbanGroundTint,urbanGroundGravel*0.70,railwayBallast);
urbanGroundTint = mix(urbanGroundTint,urbanGroundConcrete,urbanConcrete);
float urbanPixel = max(max(fwidth(urbanP.x),fwidth(urbanP.y)),0.001);
vec2 railwayJointDistance = abs(mod(urbanP+2.0,4.0)-2.0);
float railwayJoint = (1.0-smoothstep(0.015,0.015+urbanPixel,min(railwayJointDistance.x,railwayJointDistance.y)))
                     *(1.0-smoothstep(0.05,0.35,urbanPixel));
urbanGroundTint *= 1.0-railwayJoint*urbanConcrete*0.25;
// Lane-edge marks frame the clear route; no painted obstacle or misleading completion target.
float railwayEdge = (1.0-smoothstep(0.08,0.08+urbanPixel,abs(abs(urbanP.x-250.0)-7.4)))
                    *(1.0-smoothstep(0.12,0.6,urbanPixel));
urbanGroundTint = mix(urbanGroundTint,urbanGroundPaint,railwayEdge*railwayRoad*0.75);
${
  quality === 'performance'
    ? ''
    : `
float railwayBroad = urbanGroundNoise(urbanP*0.09);
float railwayNear = 1.0-smoothstep(0.05,0.7,urbanPixel);
float railwayGrain = urbanGroundNoise(urbanP*5.0)-0.5;
urbanGroundTint *= 0.87+railwayBroad*0.26+railwayGrain*railwayNear*mix(0.19,0.06,urbanConcrete);
${quality === 'quality' ? 'urbanGroundTint *= 1.0+(urbanGroundNoise(urbanP*17.0)-0.5)*railwayNear*railwayBallast*0.14;' : ''}`
}
diffuseColor.rgb *= urbanGroundTint;`;
}

function createGroundSurface({ quality, originMm, railway = false }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 });
  const uniforms = {
    urbanGroundOrigin: {
      value: new THREE.Vector3(originMm.x / 1000, originMm.y / 1000, originMm.z / 1000),
    },
    urbanGroundConcrete: { value: new THREE.Color(0x9c9b90) },
    urbanGroundGravel: { value: new THREE.Color(0x777267) },
    urbanGroundVerge: { value: new THREE.Color(0x5b6241) },
    urbanGroundAsphalt: { value: new THREE.Color(0x454d50) },
    urbanGroundPaint: { value: new THREE.Color(0xbba24e) },
  };
  material.name = `${railway ? 'Railway yards and cutting' : 'Urban courts and verges'} · ${quality}`;
  material.userData.setRegionalSurfaceQuality = (next) => {
    if (!['performance', 'balanced', 'quality'].includes(next))
      throw new TypeError('Unknown regional ground quality');
    if (next === quality) return;
    quality = next;
    material.name = `${railway ? 'Railway yards and cutting' : 'Urban courts and verges'} · ${quality}`;
    material.needsUpdate = true;
  };
  material.customProgramCacheKey = () =>
    `fpv-${railway ? 'railway' : 'urban'}-ground-v1-${quality}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 urbanGroundOrigin;\nvarying vec3 vUrbanGroundPoint;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvUrbanGroundPoint = (modelMatrix * vec4(transformed, 1.0)).xyz + urbanGroundOrigin;',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vUrbanGroundPoint;
uniform vec3 urbanGroundConcrete;
uniform vec3 urbanGroundGravel;
uniform vec3 urbanGroundVerge;
uniform vec3 urbanGroundAsphalt;
uniform vec3 urbanGroundPaint;
${functions}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      railway
        ? '#include <color_fragment>\n' + railwayColour(quality)
        : `#include <color_fragment>
vec2 urbanP = vUrbanGroundPoint.xz;
// Authored district footprints follow the exact original architecture, in global metres.
float urbanCourtDistance = urbanGroundRect(urbanP, vec2(190,64), vec2(58,62));
urbanCourtDistance = min(urbanCourtDistance, urbanGroundRect(urbanP, vec2(64,64), vec2(46,46)));
urbanCourtDistance = min(urbanCourtDistance, urbanGroundRect(urbanP, vec2(64,260), vec2(59,52)));
urbanCourtDistance = min(urbanCourtDistance, urbanGroundRect(urbanP, vec2(320,64), vec2(54,54)));
urbanCourtDistance = min(urbanCourtDistance, urbanGroundRect(urbanP, vec2(320,290), vec2(58,72)));
float urbanFlat = 1.0 - smoothstep(0.15, 0.65, abs(vUrbanGroundPoint.y));
float urbanConcrete = (1.0 - smoothstep(-0.25, 0.35, urbanCourtDistance)) * urbanFlat;
float urbanShoulder = (1.0 - smoothstep(1.0, 5.5, urbanCourtDistance)) * urbanFlat;
float urbanRoadDistance = min(urbanGroundRect(urbanP, vec2(192,180), vec2(176,9)),
                             urbanGroundRect(urbanP, vec2(250,192), vec2(7,176)));
urbanRoadDistance = min(urbanRoadDistance, urbanGroundRect(urbanP, vec2(190,151), vec2(27,28)));
float urbanRoad = (1.0 - smoothstep(-0.2, 0.5, urbanRoadDistance)) * urbanFlat * (1.0 - urbanConcrete);
urbanShoulder = max(urbanShoulder, (1.0 - smoothstep(1.0, 4.0, urbanRoadDistance)) * urbanFlat);
vec3 urbanGroundTint = mix(urbanGroundVerge, urbanGroundGravel, urbanShoulder);
urbanGroundTint = mix(urbanGroundTint, urbanGroundConcrete, urbanConcrete);
urbanGroundTint = mix(urbanGroundTint, urbanGroundAsphalt, urbanRoad);
// Four-metre slab joints fade below a pixel rather than flickering at distance.
vec2 urbanJointDistance = abs(mod(urbanP + 2.0, 4.0) - 2.0);
float urbanPixel = max(max(fwidth(urbanP.x), fwidth(urbanP.y)), 0.001);
float urbanJoint = (1.0 - smoothstep(0.015, 0.015 + urbanPixel, min(urbanJointDistance.x, urbanJointDistance.y)))
                 * (1.0 - smoothstep(0.05, 0.35, urbanPixel));
urbanGroundTint *= 1.0 - urbanJoint * urbanConcrete * 0.28;
// Restrained apron edge paint frames the real 12 m hall openings, leaving the flight line open.
float urbanApron = max(1.0 - smoothstep(0.0, 0.3, urbanGroundRect(urbanP, vec2(190,16), vec2(6.2,13))),
                      1.0 - smoothstep(0.0, 0.3, urbanGroundRect(urbanP, vec2(190,110), vec2(6.2,11))));
float urbanPaintLine = (1.0 - smoothstep(0.09, 0.09 + urbanPixel, abs(abs(urbanP.x - 190.0) - 6.0)))
                     * (1.0 - smoothstep(0.15, 0.6, urbanPixel));
urbanGroundTint = mix(urbanGroundTint, urbanGroundPaint, urbanApron * urbanPaintLine * urbanConcrete * 0.65);
${
  quality === 'performance'
    ? ''
    : `float urbanBroad = urbanGroundNoise(urbanP * 0.12);
float urbanNear = 1.0 - smoothstep(0.05, 0.7, urbanPixel);
float urbanGrain = urbanGroundNoise(urbanP * 5.0) - 0.5;
urbanGroundTint *= 0.9 + urbanBroad * 0.2 + urbanGrain * urbanNear * mix(0.18, 0.07, urbanConcrete);
${quality === 'quality' ? 'urbanGroundTint *= 1.0 + (urbanGroundNoise(urbanP * 17.0) - 0.5) * urbanNear * (1.0 - urbanConcrete) * 0.09;' : ''}`
}
diffuseColor.rgb *= urbanGroundTint;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = mix(1.0, 0.87, urbanConcrete);',
    );
  };
  return material;
}

export function createUrbanGroundSurface(options) {
  return createGroundSurface(options);
}

export function createRailwayGroundSurface(options) {
  return createGroundSurface({ ...options, railway: true });
}
