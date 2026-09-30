import { writeFile } from 'node:fs/promises';
import { encodeWorldGLB } from '../../../optional-practice/civilian-fpv/world-content.mjs';
const binary=new Uint8Array(new Float32Array([-2,0,-2, 2,0,-2, 0,0,2]).buffer);
const document={asset:{version:'2.0',generator:'RevealLine original FPV fixture'},scene:0,scenes:[{nodes:[0,1,2,3]}],
  buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:binary.length}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-2,0,-2],max:[2,0,2]}],
  materials:[{name:'Amber',pbrMetallicRoughness:{baseColorFactor:[0.85,0.35,0.06,1],metallicFactor:0,roughnessFactor:0.8},doubleSided:true}],
  meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
  nodes:[{name:'Original triangle',mesh:0},{name:'Spawn',extras:{rl:{id:'spawn',kind:'spawn'}}},
    {name:'Gate',translation:[0,2,6],extras:{rl:{id:'gate-01',kind:'gate',order:0,width:3,height:3}}},
    {name:'Collision',translation:[4,1,0],extras:{rl:{id:'wall-01',kind:'collider',size:[1,2,4]}}}]};
await writeFile(new URL('starter.glb',import.meta.url),encodeWorldGLB(document,binary));
document.buffers[0].uri='triangle.bin';
await writeFile(new URL('starter.gltf',import.meta.url),JSON.stringify(document,null,2)+'\n');
await writeFile(new URL('triangle.bin',import.meta.url),binary);
