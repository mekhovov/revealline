import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import path from 'node:path';
const repo=process.env.FPV_REPO;
if(!repo) throw Error('FPV_REPO must point to the application checkout.');
const {prepareCombatAppearancePack}=await import(pathToFileURL(path.join(repo,'optional-practice/civilian-fpv/combat-appearance.mjs')));
const base=(process.env.FPV_ASSET_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')).replace(/\/$/,'')+'/';
const raw=await fs.readFile(base+'worker-wardrobe-raw.glb');
const jsonLength=raw.readUInt32LE(12), doc=JSON.parse(raw.subarray(20,20+jsonLength));
const binary=raw.subarray(20+jsonLength);
const clips=[];
for(const name of ['idle','walk','run','warning']){
 const a=doc.animations.find(x=>x.name===name),b=doc.animations.find(x=>x.name===name+'__lod1');
 if(!a||!b)throw Error('Missing paired clip '+name);
 clips.push({name,samplers:[...a.samplers,...b.samplers],channels:[...a.channels,...b.channels.map(c=>({...c,sampler:c.sampler+a.samplers.length}))]});
}
doc.animations=clips;
const json=Buffer.from(JSON.stringify(doc)), padding=(4-json.length%4)%4;
const encoded=Buffer.concat([json,Buffer.alloc(padding,32)]),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+encoded.length+binary.length,8);header.writeUInt32LE(encoded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bytes=Buffer.concat([header,encoded,binary]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
await fs.writeFile(base+'characters.glb',bytes);
const partNames={head:'head',torso:'torso',leftArm:'left_arm',rightArm:'right_arm',leftLeg:'left_leg',rightLeg:'right_leg'};
const manifest={format:'FPVCombatAppearance.v1',id:'fpv-character-art',revision:'r1',title:'Realistic proportions — shared character wardrobe',license:{creator:'MakeHuman Community; Data Collection AB; Joel Palmius; Jonas Hauquier; project modifications by Codex',name:'CC0 1.0 Universal',sourceURL:'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html',licenseURL:'https://static.makehumancommunity.org/about/license.html',modifications:'CC0 MakeHuman base and core workwear, shoes, hair, eyes and skin assembled with MPFB. Original body shape, PBR atlases, in-place idle/walk/run/warning actions, distance LOD, six bounded rigid anatomical regions and authored textured caps. Source system archive SHA-256 b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107. Realistic proportions; not photorealistic. Full 36-entry family/cast wardrobe.'},files:[{path:'characters.glb',bytes:bytes.length,sha256:sha(bytes)}],characters:[{family:'patroller',cast:'rivals',file:'characters.glb',root:'worker_live_root',height:1.8,radius:.35,forward:'+z',clips:{idle:'idle',move:'walk',run:'run',attack:'warning'},lods:['worker_lod1_root'],parts:Object.fromEntries(Object.entries(partNames).map(([key,n])=>[key,{mesh:'damage_'+n+'_mesh',cap:'damage_'+n+'_cap'}]))}]};
const gear=JSON.parse(await fs.readFile(base+'wardrobe-items.json','utf8'));
const families=['lookout','patroller','runner','sprinter','courier','guard','refuge-seeker','switchback','rendezvous-pair','shield-bearer','brace-trooper','relay-warden'];
const casts=['tactical','rivals','arcade'];
const bases={tactical:['field_helmet','field_vest'],rivals:['worn_cap','worn_vest'],arcade:['winter_beanie','winter_coat','winter_upperarm_l','winter_lowerarm_l','winter_upperarm_r','winter_lowerarm_r']};
const familyGear={lookout:['binoculars'],patroller:['patrol_pack'],runner:['light_pack'],sprinter:['headset'],courier:['satchel','satchel_strap'],guard:['guard_plate'],'refuge-seeker':[],'switchback':['scarf'],'rendezvous-pair':['radio_pack','paired_badge'],'shield-bearer':['shield'],'brace-trooper':['brace_left','brace_right'],'relay-warden':['command_radio']};
const colors={tactical:[.48,.57,.37],rivals:[.67,.46,.29],arcade:[.68,.76,.83]};
const prototype=manifest.characters[0];manifest.characters=[];
for(const cast of casts) for(const family of families){
 const ids=[...bases[cast],...familyGear[family]];
 if(family==='refuge-seeker')ids[0]='hood';
 const equipment=ids.map(id=>({...gear[id],color:[...colors[cast]]}));
 for(const item of equipment){
  if(item.role==='brace')item.openOffset=item.root.endsWith('left')?[.1,0,0]:[-.1,0,0];
  if(['gear_binoculars','gear_headset','gear_shield','gear_command_radio','gear_radio_pack'].includes(item.root))item.color=cast==='arcade'?[.40,.47,.53]:[.30,.34,.27];
 }
 manifest.characters.push({...structuredClone(prototype),family,cast,equipment});
}
manifest.license.modifications+=' Shared original modeled field, worn and winter equipment with one PBR atlas, bone attachments and role-specific silhouettes for 12 families in 3 casts. No extra gameplay capabilities.';
const m=Buffer.from(JSON.stringify(manifest)+'\n');await fs.writeFile(base+'manifest.json',m);
const result=await prepareCombatAppearancePack({manifestBytes:m,sha256:sha(m),assets:new Map([['characters.glb',bytes]])});
const report={accepted:true,manifestSHA256:sha(m),file:manifest.files[0],metrics:result.metrics,skins:doc.skins.map(s=>s.joints.length),clips:clips.map(a=>({name:a.name,channels:a.channels.length,samplers:a.samplers.length})),materials:doc.materials.map(m=>({name:m.name,alphaMode:m.alphaMode??'OPAQUE'}))};
await fs.writeFile(base+'appearance-admission.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
