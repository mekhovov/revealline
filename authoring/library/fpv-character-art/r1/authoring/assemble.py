import os
import bpy,bmesh,math,json
bpy.context.preferences.filepaths.save_version=0
import numpy as np
from pathlib import Path
from mathutils import Vector
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)))
scene=bpy.context.scene;rig=bpy.data.objects['worker_rig'];rig.name='worker_live_rig'
main=bpy.data.objects['worker_opaque'];main.name='worker_live_opaque'
hair=bpy.data.objects['worker_masked'];hair.name='worker_live_masked'
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(0);bpy.context.view_layer.update()
regions=['head','torso','left_arm','right_arm','left_leg','right_leg']
pivotbones={'head':'neck_01','torso':'pelvis','left_arm':'upperarm_l','right_arm':'upperarm_r','left_leg':'thigh_l','right_leg':'thigh_r'}
def family(b):
 if b in {'head','neck_01'}:return 'head'
 if any(b.startswith(s) for s in ('clavicle','upperarm','lowerarm','hand','index','middle','ring','pinky','thumb')):return 'left_arm' if b.endswith('_l') else 'right_arm'
 if any(b.startswith(s) for s in ('thigh','calf','foot','ball')):return 'left_leg' if b.endswith('_l') else 'right_leg'
 return 'torso'
# Original deterministic cap texture: muscle fibres, connective ring and small exposed core.
size=512;y,x=np.mgrid[-1:1:complex(size),-1:1:complex(size)];rad=np.sqrt(x*x+(y*1.2)**2);angle=np.arctan2(y,x)
fib=.5+.5*np.sin(68*x+9*np.sin(5*y)+3*np.sin(15*y));fine=.5+.5*np.sin(210*x+29*y)
base=np.stack([.16+.12*fib+.025*fine,.018+.02*fib,.026+.022*fib],axis=-1)
fat=np.exp(-((rad-.77)/.052)**2)*(.45+.55*(.5+.5*np.sin(angle*13)))
base=base*(1-fat[...,None]*.8)+np.array([.63,.39,.30])*fat[...,None]*.8
bone=np.clip(1-(np.sqrt((x/.19)**2+(y/.14)**2)-.8)*7,0,1)
base=base*(1-bone[...,None])+np.array([.65,.57,.43])*bone[...,None]
inner=np.exp(-((x/.075)**2+(y/.055)**2)*2)
base=base*(1-inner[...,None]*.85)+np.array([.10,.015,.022])*inner[...,None]*.85
rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=base
capimg=bpy.data.images.new('worker_cap_tissue',width=size,height=size,alpha=False);capimg.pixels.foreach_set(rgba.ravel());capimg.filepath_raw=str(p/'worker_cap_tissue.png');capimg.file_format='PNG';capimg.save()
capmat=bpy.data.materials.new('worker_cap_material');capmat.use_nodes=True
bs=capmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.48
tex=capmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=capimg;capmat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
part_materials=[main.data.materials[0],hair.data.materials[0],capmat]
parts=[];report=[]
def make_object(name,mesh,parent):
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.parent=parent
 for m in part_materials:obj.data.materials.append(m)
 return obj
for region in regions:
 pivot=rig.matrix_world@rig.pose.bones[pivotbones[region]].head
 root=bpy.data.objects.new('damage_'+region+'_root',None);bpy.context.collection.objects.link(root);root.location=pivot
 bodies=[];caps=[];boundary_count=0
 for source,mi in [(main,0),(hair,1)]:
  if source==hair and region!='head':continue
  weights={}
  for v in source.data.vertices:
   scores={r:0. for r in regions}
   for g in v.groups:
    name=source.vertex_groups[g.group].name
    if name in rig.data.bones:scores[family(name)]+=g.weight
   weights[v.index]=scores
  deps=bpy.context.evaluated_depsgraph_get();ev=source.evaluated_get(deps);em=ev.to_mesh()
  bm=bmesh.new();bm.from_mesh(em);ev.to_mesh_clear();bm.faces.ensure_lookup_table();bm.verts.ensure_lookup_table()
  kill=[]
  for face in bm.faces:
   scores={r:sum(weights[v.index][r] for v in face.verts) for r in regions}
   if max(scores,key=scores.get)!=region:kill.append(face)
  bmesh.ops.delete(bm,geom=kill,context='FACES')
  if not bm.faces:bm.free();continue
  loose=[v for v in bm.verts if not v.link_faces]
  if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
  for v in bm.verts:v.co=source.matrix_world@v.co-pivot
  for f in bm.faces:f.material_index=mi
  capflag=bm.faces.layers.int.new('damage_cap')
  if source==main:
   edge=[e for e in bm.edges if e.is_boundary]
   filled=bmesh.ops.holes_fill(bm,edges=edge,sides=0)['faces'] if edge else []
   # Close any branched/open source boundary with a shared bounded fan.
   remaining=set(e for e in bm.edges if e.is_boundary)
   while remaining:
    edges={remaining.pop()};verts=set(edges.copy().pop().verts);changed=True
    while changed:
     changed=False
     for e in list(remaining):
      if any(v in verts for v in e.verts):edges.add(e);verts.update(e.verts);remaining.remove(e);changed=True
    center=bm.verts.new(sum((v.co for v in verts),Vector())/len(verts))
    for e in edges:
     try:filled.append(bm.faces.new((e.verts[1],e.verts[0],center)))
     except ValueError:pass
   uv=bm.loops.layers.uv.get('BakedUV') or bm.loops.layers.uv.new('BakedUV')
   bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
   for face in filled:
    face[capflag]=1;face.material_index=2;face.smooth=False
    axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[i for i in range(3) if i!=axis]
    mins=[min(v.co[i] for v in face.verts) for i in axes];maxs=[max(v.co[i] for v in face.verts) for i in axes]
    for loop in face.loops:loop[uv].uv=tuple(.05+.9*(loop.vert.co[i]-lo)/max(1e-6,hi-lo) for i,lo,hi in zip(axes,mins,maxs))
   boundary_count+=sum(e.is_boundary for e in bm.edges)
  whole=bpy.data.meshes.new('part_work');bm.to_mesh(whole);bm.free()
  # Reduce the closed surface before separating caps, preserving a shared cut seam.
  temp=make_object('part_reduce',whole,None)
  bpy.ops.object.select_all(action='DESELECT');temp.select_set(True);bpy.context.view_layer.objects.active=temp
  dec=temp.modifiers.new('authored_remains_reduction','DECIMATE');dec.ratio=.20 if region=='torso' else .30
  bpy.ops.object.modifier_apply(modifier=dec.name)
  whole=temp.data.copy();bpy.data.objects.remove(temp,do_unlink=True)
  for cap in [False,True]:
   bm2=bmesh.new();bm2.from_mesh(whole)
   remove=[f for f in bm2.faces if (f.material_index==2)!=cap]
   bmesh.ops.delete(bm2,geom=remove,context='FACES')
   loose=[v for v in bm2.verts if not v.link_faces]
   if loose:bmesh.ops.delete(bm2,geom=loose,context='VERTS')
   if bm2.faces:
    mesh=bpy.data.meshes.new('damage_'+region+('_cap' if cap else '_body')+'_data');bm2.to_mesh(mesh)
    obj=make_object('damage_'+region+('_cap_piece' if cap else '_mesh_piece'),mesh,root)
    (caps if cap else bodies).append(obj)
   bm2.free()
  bpy.data.meshes.remove(whole)
 def merge(objects,name):
  assert objects,(region,name)
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  if len(objects)>1:bpy.ops.object.join()
  obj=bpy.context.object;obj.name=name
  # Strip unused slots while retaining per-face material references.
  used=sorted(set(f.material_index for f in obj.data.polygons));mats=[obj.data.materials[i] for i in used]
  mapping={old:new for new,old in enumerate(used)}
  indices=[mapping[f.material_index] for f in obj.data.polygons]
  obj.data.materials.clear()
  for mat in mats:obj.data.materials.append(mat)
  for f,index in zip(obj.data.polygons,indices):f.material_index=index
  obj.vertex_groups.clear()
  obj.data.calc_loop_triangles()
  return obj
 body=merge(bodies,'damage_'+region+'_mesh');cap=merge(caps,'damage_'+region+'_cap')
 parts.append(root);report.append({'region':region,'pivot':list(pivot),'bodyVertices':len(body.data.vertices),'capVertices':len(cap.data.vertices),'bodyTriangles':len(body.data.loop_triangles),'capTriangles':len(cap.data.loop_triangles),'unsealedOpaqueBoundaryEdges':boundary_count})
# LOD is a full independent rig, sharing materials but owning reduced geometry.
lod=rig.copy();lod.data=rig.data.copy();bpy.context.collection.objects.link(lod);lod.name='worker_lod1_rig';lod.animation_data_clear()
for bone in lod.data.bones:bone.name='lod1_'+bone.name
lodmeshes=[]
for source,ratio in [(main,.45),(hair,.7)]:
 obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj);obj.name=source.name.replace('live','lod1');obj.parent=lod
 for group in obj.vertex_groups:group.name='lod1_'+group.name
 for mod in obj.modifiers:
  if mod.type=='ARMATURE':mod.object=lod
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 dec=obj.modifiers.new('authored_distance_reduction','DECIMATE');dec.ratio=ratio
 # Apply before armature deformation at rest.
 lod.data.pose_position='REST';bpy.ops.object.modifier_apply(modifier=dec.name);lod.data.pose_position='POSE'
 lodmeshes.append(obj)
baseactions=[bpy.data.actions[n] for n in ['idle','walk','run','warning']]
lodactions=[]
for action in baseactions:
 copy=action.copy();copy.name=action.name+'__lod1';copy.use_fake_user=True
 for curve in copy.fcurves:
  if 'pose.bones["' in curve.data_path:curve.data_path=curve.data_path.replace('pose.bones["','pose.bones["lod1_')
 lodactions.append(copy)
for arm,actions in [(rig,baseactions),(lod,lodactions)]:
 arm.animation_data_create();arm.animation_data.action=actions[0]
 for action in actions:
  track=arm.animation_data.nla_tracks.new();track.name=action.name;track.mute=True
  strip=track.strips.new(action.name,int(action.frame_range[0]),action)
# Separate roots contain complete skeletons; all roots remain in one admitted scene.
normalization=1.8/1.6150393560528755
roots=[]
for name,arm in [('worker_live_root',rig),('worker_lod1_root',lod)]:
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);arm.parent=root
 root.scale=(normalization,)*3;root.rotation_euler.z=0;roots.append(root)
parts_container=bpy.data.objects.new('worker_damage_library',None);bpy.context.collection.objects.link(parts_container)
parts_container.scale=(normalization,)*3;parts_container.rotation_euler.z=0
for root in parts:root.parent=parts_container
scene.frame_set(0);bpy.context.view_layer.update()
for o in scene.objects:o.select_set(o.type in {'MESH','ARMATURE','EMPTY'})
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(p/'worker-candidate-raw.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_def_bones=True,export_all_influences=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=False,export_extras=False,export_cameras=False,export_lights=False,export_morph=False)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'worker-candidate.blend'))
(p/'worker-parts-inspection.json').write_text(json.dumps({'parts':report,'lod':[{'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons)} for o in lodmeshes],'normalization':normalization},indent=2)+'\n')
print('FPV_ASSEMBLED',json.dumps(report))
