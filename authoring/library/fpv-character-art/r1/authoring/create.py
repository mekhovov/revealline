import os
import bpy,addon_utils,json,math,hashlib
bpy.context.preferences.filepaths.save_version=0
from pathlib import Path
from mathutils import Vector
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)));p.mkdir(exist_ok=True)
assets=Path(os.environ['FPV_MAKEHUMAN_ASSETS'])
addon_utils.enable('bl_ext.user_default.mpfb',default_set=True,persistent=False)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.exportservice import ExportService
from bl_ext.user_default.mpfb.services.objectservice import ObjectService
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
macro=TargetService.get_default_macro_info_dict();macro.update(gender=1.0,age=.38,muscle=.5,weight=.45,height=.5)
base=HumanService.create_human(macro_detail_dict=macro)
base.name='worker_body'
source_files=[]
def asset(relative):
 f=assets/relative;assert f.exists(),f
 source_files.append(f)
 return str(f)
HumanService.set_character_skin(asset('skins/young_caucasian_male/young_caucasian_male.mhmat'),base,skin_type='GAMEENGINE',material_instances=False)
HumanService.add_builtin_rig(base,'game_engine')
for rel,kind in [
 ('eyes/low-poly/low-poly.mhclo','Eyes'),
 ('eyebrows/eyebrow001/eyebrow001.mhclo','Eyebrows'),
 ('hair/short04/short04.mhclo','Hair'),
 ('clothes/male_worksuit01/male_worksuit01.mhclo','Clothes'),
 ('clothes/shoes03/shoes03.mhclo','Clothes')]:
 HumanService.add_mhclo_asset(asset(rel),base,asset_type=kind,subdiv_levels=0,material_type='GAMEENGINE',import_subrig=False)
ExportService.bake_modifiers_remove_helpers(base,bake_masks=True,bake_subdiv=False,remove_helpers=True,also_proxy=True)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.name='worker_rig'
# Relax the source A-pose with explicit authored local bone rotations after inspection.
for o in bpy.data.objects:
 if o.type=='MESH':
  for poly in o.data.polygons:poly.use_smooth=True
scene=bpy.context.scene;bpy.context.view_layer.update()
pts=[o.matrix_world@Vector(v) for o in bpy.data.objects if o.type=='MESH' for v in o.bound_box]
lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)));mid=(lo+hi)*.5;h=hi.z-lo.z
scene.world=bpy.data.worlds.new('candidate-world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.12,.16,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
bpy.ops.object.camera_add(location=mid+Vector((h*.45,-h*2.7,h*.13)))
cam=bpy.context.object;cam.name='review-camera';cam.rotation_euler=(mid-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=h*1.18;scene.camera=cam
for name,off,energy,size in [('key',(-1.3,-1.7,1.8),900,2.0),('fill',(1.8,-.4,1.0),350,2.5),('rim',(1.0,1.2,1.4),650,1.7)]:
 bpy.ops.object.light_add(type='AREA',location=mid+Vector(off)*h)
 light=bpy.context.object;light.name=name;light.data.energy=energy*h*h/4;light.data.shape='DISK';light.data.size=size*h
 light.rotation_euler=(mid-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.view_settings.view_transform='AgX'
scene.render.filepath=str(p/'worker-source-review.png')
r={'source':'MakeHuman core asset pack CC0 with MPFB2.0.18','status':'source authoring intermediate; not a runtime asset','height':h,'min':list(lo),'max':list(hi),'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local)} for b in rig.data.bones],'meshes':[],'images':[],'sourceFiles':[{'path':str(f.relative_to(assets)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in source_files]}
for o in bpy.data.objects:
 if o.type=='MESH':
  o.data.calc_loop_triangles();r['meshes'].append({'name':o.name,'vertices':len(o.data.vertices),'triangles':len(o.data.loop_triangles),'materials':[m.name if m else None for m in o.data.materials]})
for i in bpy.data.images:
 if i.source=='FILE':r['images'].append({'name':i.name,'path':i.filepath,'size':list(i.size)})
(p/'worker-source-inspection.json').write_text(json.dumps(r,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(p/'worker-source.blend'))
bpy.ops.render.render(write_still=True)
print('FPV_WORKER_REVIEW',json.dumps({'bones':len(r['bones']),'height':h,'meshes':r['meshes'],'images':r['images']}))
