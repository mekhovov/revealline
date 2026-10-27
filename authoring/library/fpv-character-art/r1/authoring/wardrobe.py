import bpy,bmesh,math,json,os
import numpy as np
from pathlib import Path
from mathutils import Vector
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)));scene=bpy.context.scene
bpy.context.preferences.filepaths.save_version=0
rig=bpy.data.objects['worker_live_rig'];norm=1.8/1.6150393560528755
# One shared original gear PBR atlas: canvas, molded polymer, brushed metal, quilted cloth.
n=1024;y,x=np.mgrid[0:n,0:n];u=(x%512)/512;v=(y%512)/512
rng=np.random.default_rng(9127);noise=rng.random((n,n));tile=(x//512)+2*(y//512)
weave=.5+.5*np.sin(x*1.7)*np.sin(y*1.7);grain=.5+.5*np.sin(x*.12+np.sin(y*.07)*3)
quilt=(np.minimum(u% .25,.25-u% .25)+np.minimum(v% .25,.25-v% .25))
base=np.where(tile==0,.59+.06*weave+.03*noise,np.where(tile==1,.45+.035*noise,np.where(tile==2,.55+.08*grain,.60+.035*noise-.28*np.exp(-quilt*100))))
stitch=((u>.04)&(u<.06)|(u>.94)&(u<.96))&((np.floor(v*80)%2)==0)
base=np.where(stitch,.8,base)
height=np.where(tile==0,.009*weave,np.where(tile==2,.003*grain,np.where(tile==3,.08*np.minimum(quilt,.1)+.002*np.sin(u*25+v*6),.002*noise)))
dy,dx=np.gradient(height);normal=np.stack([-dx*40,-dy*40,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
rough=np.where(tile==2,.38,np.where(tile==1,.55,.88));metal=np.where(tile==2,.65,0)
def image(name,channels,space='sRGB'):
 rgba=np.ones((n,n,4),np.float32);rgba[:,:,:3]=channels
 im=bpy.data.images.new(name,width=n,height=n,alpha=False);im.colorspace_settings.name=space;im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(p/(name+'.png'));im.file_format='PNG';im.save();return im
baseim=image('worker_gear_basecolor',np.stack([base,base,base],-1));normalim=image('worker_gear_normal',normal*.5+.5,'Non-Color');ormim=image('worker_gear_orm',np.stack([np.ones_like(base),rough,metal],-1),'Non-Color')
mat=bpy.data.materials.new('worker_gear_material');mat.use_nodes=True;nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
def tex(im):
 t=nt.nodes.new('ShaderNodeTexImage');t.image=im;return t
nt.links.new(tex(baseim).outputs['Color'],bs.inputs['Base Color']);nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex(normalim).outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(tex(ormim).outputs['Color'],sep.inputs['Color']);nt.links.new(sep.outputs['Green'],bs.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
library=bpy.data.objects.new('worker_equipment_library',None);bpy.context.collection.objects.link(library);library.scale=(norm,)*3
items={};pieces=[]
def prepare(o,tile=0):
 bpy.ops.object.select_all(action='DESELECT')
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.clear();o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=True
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
 uv=o.data.uv_layers.active
 for loop in uv.data:loop.uv=(loop.uv.x*.47+.015+(tile%2)*.5,loop.uv.y*.47+.015+(tile//2)*.5)
 pieces.append(o);return o

def box(loc,size,tile=0,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  m=o.modifiers.new('soft_edge','BEVEL');m.width=bevel;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
 return prepare(o,tile)
def beam(a,b,width,depth,tile=0):
 a,b=Vector(a),Vector(b);o=box((a+b)*.5,(width,depth,(b-a).length),tile, min(.004,width*.2));o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def cylinder(loc,radius,depth,tile=1,direction=(0,0,1),vertices=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler();return prepare(o,tile)
def rings(center,radii,zs,tile=0,segments=20,cap=False):
 verts=[];faces=[]
 for (rx,ry),z in zip(radii,zs):
  verts.extend((center[0]+rx*math.cos(i*math.tau/segments),center[1]+ry*math.sin(i*math.tau/segments),z) for i in range(segments))
 for k in range(len(zs)-1):
  for i in range(segments):j=(i+1)%segments;faces.append((k*segments+i,k*segments+j,(k+1)*segments+j,(k+1)*segments+i))
 if cap:faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(zs)-1)*segments+i for i in range(segments))])
 mesh=bpy.data.meshes.new('gear_surface');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('gear_piece',mesh);bpy.context.collection.objects.link(o);return prepare(o,tile)
def dome(center,rx,ry,rz,tile=1):
 radii=[];zs=[]
 for k in range(9):
  a=k/8*math.pi*.5;radii.append((rx*max(.015,math.cos(a)),ry*max(.015,math.cos(a))));zs.append(center[2]+rz*math.sin(a))
 return rings(center,radii,zs,tile,24,True)
def finish(name,bone,region,role=None):
 global pieces
 bpy.ops.object.select_all(action='DESELECT')
 for o in pieces:o.select_set(True)
 bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();o=bpy.context.object;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.name='gear_'+name;o.data.name=o.name+'_geometry';o.parent=library
 # Joining identical materials should remain exactly one primitive.
 for f in o.data.polygons:f.material_index=0
 o.data.materials.clear();o.data.materials.append(mat)
 item={'root':o.name,'bone':bone,'lodBones':['lod1_'+bone],'region':region}
 if role:item['role']=role
 items[name]=item;pieces=[];return o
# Fitted cloth follows the actual CC0 source surface, with small normal offset.
with bpy.data.libraries.load(str(p/'worker-source.blend'),link=False) as (src,dst):
 dst.objects=['worker_body','worker_body.male_worksuit01']
cloth_sources=dst.objects
for source in cloth_sources:
 bpy.context.collection.objects.link(source);bpy.context.view_layer.objects.active=source
 if source.data.shape_keys:bpy.ops.object.shape_key_remove(all=True,apply_mix=True)
 bpy.context.collection.objects.unlink(source)

def segment(name):
 if name.startswith('clavicle'):return 'torso'
 if name.startswith('upperarm'):return 'upperarm_'+name[-1]
 if name.startswith('lowerarm'):return 'lowerarm_'+name[-1]
 if name.startswith(('hand','index','middle','ring','pinky','thumb')):return 'hand_'+name[-1]
 if name.startswith(('thigh','calf','foot','ball')):return 'leg'
 if name in {'head','neck_01'}:return 'head'
 return 'torso'
def fitted_cloth(which,offset=.014,vest=False):
 for source in cloth_sources:
  if which=='torso' and source.name=='worker_body':continue
  if which.startswith('lowerarm') and source.name!='worker_body':continue
  weights={}
  for v in source.data.vertices:
   weights[v.index]={}
   for g in v.groups:
    name=source.vertex_groups[g.group].name
    if name not in rig.data.bones:continue
    key=segment(name);weights[v.index][key]=weights[v.index].get(key,0)+g.weight
  bm=bmesh.new();bm.from_mesh(source.data);bm.faces.ensure_lookup_table();bm.verts.ensure_lookup_table()
  remove=[]
  for face in bm.faces:
   score={}
   for v in face.verts:
    for key,value in weights[v.index].items():score[key]=score.get(key,0)+value
   center=face.calc_center_median()
   if not score or max(score,key=score.get)!=which or (which=='torso' and center.z<.84) or (vest and (center.z<1.00 or center.z>1.29 or (abs(center.x)<.028 and center.y<0))):remove.append(face)
  bmesh.ops.delete(bm,geom=remove,context='FACES')
  loose=[v for v in bm.verts if not v.link_faces]
  if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
  if not bm.faces:bm.free();continue
  # Remove disconnected button/strap remnants at the regional cut.
  remaining=set(bm.faces);islands=[]
  while remaining:
   seed=remaining.pop();component={seed};queue=[seed]
   while queue:
    f=queue.pop()
    for e in f.edges:
     for neighbour in e.link_faces:
      if neighbour in remaining:remaining.remove(neighbour);component.add(neighbour);queue.append(neighbour)
   islands.append(component)
  small=[f for island in islands if len(island)<20 for f in island]
  if small:bmesh.ops.delete(bm,geom=small,context='FACES')
  loose=[v for v in bm.verts if not v.link_faces]
  if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
  boundary=[v for v in bm.verts if v.is_boundary]
  for _ in range(3):bmesh.ops.smooth_vert(bm,verts=boundary,factor=.65,use_axis_x=True,use_axis_y=True,use_axis_z=True)
  bm.normal_update()
  for v in bm.verts:v.co+=v.normal*(.010 if which.startswith('upperarm') and source.name!='worker_body' else offset)
  if which.startswith(('upperarm','lowerarm')):
   bone=rig.data.bones[which];axis=(bone.tail_local-bone.head_local).normalized()
   values=[(v.co-bone.head_local).dot(axis) for v in bm.verts];lo=min(values);hi=max(values)
   for v in bm.verts:
    along=(v.co-bone.head_local).dot(axis)
    if which.startswith('lowerarm') and along<lo+.04:v.co-=axis*.035*(1-(along-lo)/.04)
    if which.startswith('upperarm') and along>hi-.04:v.co+=axis*.030*(1-(hi-along)/.04)
  mesh=bpy.data.meshes.new('fitted_'+which);bm.to_mesh(mesh);bm.free()
  o=bpy.data.objects.new('fitted_'+which,mesh);bpy.context.collection.objects.link(o)
  if which=='torso':
   bpy.context.view_layer.objects.active=o;dec=o.modifiers.new('cloth_surface_budget','DECIMATE');dec.ratio=.40;bpy.ops.object.modifier_apply(modifier=dec.name)
  prepare(o,3 if not vest else 0)
  solid=o.modifiers.new('cloth_hem','SOLIDIFY');solid.thickness=.006;solid.offset=0;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
def fitted_sleeve(which):
 # Fit continuous rounded cross-sections to the already baked CC0 arm/workwear
 # surface. Overlapping shoulder/elbow hems avoid gaps between rigid attachments.
 bone=rig.data.bones[which];axis=(bone.tail_local-bone.head_local).normalized();length=bone.length
 front=Vector((0,-1,0));front=(front-axis*front.dot(axis)).normalized();side=axis.cross(front).normalized()
 samples=[]
 for source in cloth_sources:
  for vertex in source.data.vertices:
   weight=sum(g.weight for g in vertex.groups if segment(source.vertex_groups[g.group].name)==which)
   if weight>.15:
    delta=vertex.co-bone.head_local;samples.append((delta.dot(axis),delta.dot(front),delta.dot(side)))
 upper=which.startswith('upperarm');stations=([-.085,-.060,-.030,0] if upper else [-.045,0])+[length*.18,length*.42,length*.70,length,length+.035]
 verts=[];faces=[];count=20
 for k,distance in enumerate(stations):
  near=[v for v in samples if abs(v[0]-max(0,min(length,distance)))<.045]
  if near:
   fmin,fmax=min(v[1] for v in near),max(v[1] for v in near);smin,smax=min(v[2] for v in near),max(v[2] for v in near)
   fc=(fmin+fmax)*.5;sc=(smin+smax)*.5;rf=(fmax-fmin)*.5;rs=(smax-smin)*.5
  else:fc=sc=0;rf=rs=.052 if upper else .039
  # Bounded padding retains the source taper without turning sleeves into armor.
  progress=max(0,min(1,distance/length));minimum=(.059-.011*progress) if upper else (.050-.014*progress)
  maximum=(.083-.016*progress) if upper else (.066-.020*progress)
  rf=max(minimum,min(maximum,rf+.010));rs=max(minimum,min(maximum,rs+.010))
  if upper and k<3:
   round_factor=[.02,.56,.88][k];rf*=round_factor;rs*=round_factor
  center=bone.head_local+axis*distance+front*fc+side*sc
  for j in range(count):
   angle=j*math.tau/count;fold=1+.035*math.cos(angle*3+progress*9)*math.sin(progress*math.pi)
   verts.append(center+front*(math.cos(angle)*rf*fold)+side*(math.sin(angle)*rs*fold))
 for k in range(len(stations)-1):
  for j in range(count):n=(j+1)%count;faces.append((k*count+j,k*count+n,(k+1)*count+n,(k+1)*count+j))
 if upper:faces.append(tuple(range(count-1,-1,-1)))
 mesh=bpy.data.meshes.new('source_fitted_'+which);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('source_fitted_'+which,mesh);bpy.context.collection.objects.link(o);prepare(o,3)
 solid=o.modifiers.new('sewn_sleeve_hem','SOLIDIFY');solid.thickness=.006;solid.offset=0;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)

# Cast silhouettes fit the baked CC0 anatomy (head is centered at Y=-.055).
# Rounded crown and a closed, forward brim cover hair at the brow.
def curved_bill(center_y,z,width=.105,reach=.075,tile=0):
 verts=[];faces=[]
 for row in range(3):
  for j in range(17):
   t=-1+2*j/16;x=t*width
   y=center_y-(1-t*t)**.5*(.085+reach*row/2)
   verts.append((x,y,z-.014*row/2+.012*t*t))
 for row in range(2):
  for j in range(16):i=row*17+j;faces.append((i,i+1,i+18,i+17))
 mesh=bpy.data.meshes.new('curved_forward_bill');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('forward_bill',mesh);bpy.context.collection.objects.link(o);prepare(o,tile)
 mod=o.modifiers.new('stitched_bill_edge','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
dome((0,-.055,1.515),.108,.125,.105,1)
rings((0,-.055),[(.109,.126),(.110,.127)],[1.505,1.524],1,28,False)
curved_bill(-.055,1.515,.103,.035,1)
finish('field_helmet','head','head')
fitted_cloth('torso',.022,True)
for sign in [-1,1]:
 beam((sign*.105,-.125,1.26),(sign*.105,.065,1.31),.038,.016)
 box((sign*.077,-.177,1.105),(.068,.038,.095),0,.012)
 box((sign*.077,-.199,1.13),(.071,.009,.027),0,.004)
 box((sign*.077,-.207,1.115),(.017,.009,.018),2,.002)
finish('field_vest','spine_03','torso')
dome((0,-.055,1.515),.102,.119,.093,0)
rings((0,-.055),[(.103,.120),(.104,.121)],[1.505,1.525],0,28,False)
curved_bill(-.055,1.515,.106,.089,0)
finish('worn_cap','head','head')
fitted_cloth('torso',.017,True)
for sign in [-1,1]:
 box((sign*.086,-.169,1.065),(.071,.025,.085),0,.010)
 box((sign*.086,-.184,1.09),(.074,.006,.022),0,.003)
 beam((sign*.10,-.125,1.25),(sign*.10,.06,1.31),.029,.013)
finish('worn_vest','spine_03','torso')
dome((0,-.055,1.515),.104,.120,.103,3)
rings((0,-.055),[(.108,.124),(.108,.124)],[1.500,1.537],3,28,False)
finish('winter_beanie','head','head')
fitted_cloth('torso',.021)
beam((0,-.168,.87),(0,-.136,1.29),.009,.007,2)
for sign in [-1,1]:
 box((sign*.10,-.153,.97),(.078,.022,.085),3,.015)
 box((sign*.10,-.166,.992),(.081,.006,.021),3,.003)
 beam((sign*.052,-.087,1.27),(sign*.044,-.052,1.31),.038,.022,3)
finish('winter_coat','spine_03','torso')
for side in ['l','r']:
 for seg in ['upperarm','lowerarm']:
  fitted_sleeve(seg+'_'+side)
  finish('winter_'+seg+'_'+side,seg+'_'+side,'leftArm' if side=='l' else 'rightArm')
# Family equipment: recognizable silhouette, original modeling, no collision markers.
for sign in [-1,1]:cylinder((sign*.044,-.15,1.19),.033,.085,1,(0,1,0));cylinder((sign*.044,-.197,1.19),.028,.01,2,(0,1,0));beam((sign*.10,-.08,1.30),(sign*.044,-.14,1.23),.012,.01)
box((0,-.15,1.19),(.07,.035,.028),1);finish('binoculars','spine_03','torso')
box((0,.155,1.10),(.25,.15,.31),0,.035);box((0,.245,1.06),(.18,.045,.15),0,.018)
for sign in [-1,1]:box((sign*.13,.15,1.08),(.05,.11,.14),0,.012);beam((sign*.10,-.09,1.25),(sign*.10,.14,1.25),.035,.015)
finish('patrol_pack','spine_03','torso')
box((0,.11,.86),(.22,.095,.10),0,.025);beam((-.17,0,.88),(.17,0,.88),.02,.035);finish('light_pack','pelvis','torso')
for sign in [-1,1]:box((sign*.098,.0,1.47),(.035,.075,.085),1,.014)
rings((0,0),[(.105,.025),(.108,.025),(.045,.025)],[1.47,1.59,1.65],1,12,False);beam((.11,-.03,1.47),(.07,-.14,1.43),.008,.008,2);finish('headset','head','head')
box((.20,.0,.83),(.16,.12,.20),0,.02);box((.20,-.068,.88),(.16,.018,.08),0,.008);box((.20,-.082,.86),(.03,.012,.035),2,.002);finish('satchel','pelvis','torso')
beam((-.12,-.09,1.28),(.19,-.11,.90),.035,.015,0);finish('satchel_strap','spine_03','torso')
box((0,-.225,1.14),(.285,.035,.30),1,.016)
for sign in [-1,1]:beam((sign*.105,-.225,1.28),(sign*.105,.05,1.30),.028,.014,1)
finish('guard_plate','spine_03','torso')
# Hood wraps behind/sides and leaves a front facial opening.
verts=[];faces=[]
for k in range(9):
 a=k/8*math.pi*.85
 for i in range(19):
  ang=(-.05+i/18*math.pi*1.1);verts.append((math.cos(ang)*(.12*math.sin(a)+.018),.018+math.sin(ang)*(.13*math.sin(a)+.018),1.64-.30*(1-math.cos(a))*.5))
for k in range(8):
 for i in range(18):faces.append((k*19+i,k*19+i+1,(k+1)*19+i+1,(k+1)*19+i))
mesh=bpy.data.meshes.new('hood_shell');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('hood_shell',mesh);bpy.context.collection.objects.link(o);prepare(o,3)
rings((0,.0),[(.095,.10),(.10,.105)],[1.34,1.40],3,20,True);finish('hood','head','head')
rings((0,-.01),[(.075,.075),(.092,.095),(.085,.09)],[1.32,1.35,1.39],3,20,True);box((.052,-.105,1.20),(.065,.025,.27),3,.015);finish('scarf','head','head')
box((0,.14,1.13),(.21,.13,.27),1,.018);beam((.07,.17,1.23),(.07,.17,1.68),.008,.008,2);box((-.04,.217,1.16),(.08,.025,.11),2,.006);finish('radio_pack','spine_03','torso')
box((-.08,-.132,1.23),(.055,.015,.055),2,.008);finish('paired_badge','spine_03','torso')
shield=box((0,-.255,1.02),(.42,.065,.65),1,.045)
for sign in [-1,1]:beam((sign*.16,-.295,.75),(sign*.16,-.295,1.27),.025,.012,2)
box((0,-.294,1.23),(.23,.015,.055),2,.006);finish('shield','spine_03','torso','shield')
for side,sign in [('left',1),('right',-1)]:
 box((sign*.115,-.16,1.10),(.22,.075,.40),1,.025);box((sign*.115,-.204,1.10),(.14,.02,.27),2,.015)
 finish('brace_'+side,'spine_03','torso','brace')
box((0,.15,1.14),(.27,.14,.34),1,.02)
for sign in [-1,1]:beam((sign*.085,.16,1.28),(sign*.085,.16,1.79),.009,.009,2);box((sign*.08,-.125,1.20),(.065,.035,.115),1,.006)
finish('command_radio','spine_03','torso')
# Source roots remain hidden only in preview, not export. All are admitted static library data.
(p/'wardrobe-items.json').write_text(json.dumps(items,indent=2)+'\n')
for o in scene.objects:o.select_set(o.type in {'MESH','ARMATURE','EMPTY'})
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(p/'worker-wardrobe-raw.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_def_bones=True,export_all_influences=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=False,export_extras=False,export_cameras=False,export_lights=False,export_morph=False)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'worker-wardrobe.blend'))
print('FPV_WARDROBE',json.dumps({'items':len(items),'vertices':sum(len(bpy.data.objects[x['root']].data.vertices) for x in items.values())}))
