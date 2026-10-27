import bpy,json,math,os
from pathlib import Path
from mathutils import Vector
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)));s=bpy.context.scene;s.cycles.samples=16
m=json.loads((p/'manifest.json').read_text());source=bpy.data.objects['worker_live_root'];rig=bpy.data.objects['worker_live_rig']
rig.animation_data.action=bpy.data.actions['idle'];s.frame_set(0);bpy.context.view_layer.update()
all_sources=[source,*source.children_recursive]
for o in s.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'}:o.hide_render=True
cache={}
def material(color):
 key=tuple(color)
 if key not in cache:
  mat=bpy.data.materials['worker_gear_material'].copy();bs=mat.node_tree.nodes.get('Principled BSDF');link=bs.inputs['Base Color'].links[0];tex=link.from_socket;mat.node_tree.links.remove(link)
  mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);mat.node_tree.links.new(tex,mix.inputs[1]);mat.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color']);cache[key]=mat
 return cache[key]
created=[]
for batch in ([int(os.environ['FPV_REVIEW_BATCH'])] if os.environ.get('FPV_REVIEW_BATCH') else [0] if os.environ.get('FPV_FOCUSED_REVIEW') else [0,1]):
 for o in created:bpy.data.objects.remove(o,do_unlink=True)
 created=[]
 for castIndex in range(3):
  for col in range(2 if os.environ.get('FPV_FOCUSED_REVIEW') else 6):
   c=m['characters'][castIndex*12+batch*6+col];copies={}
   for old in all_sources:
    obj=old.copy()
    if old.type=='ARMATURE':obj.data=old.data.copy()
    bpy.context.collection.objects.link(obj);obj.hide_render=False;copies[old]=obj;created.append(obj)
   for old,obj in copies.items():
    obj.parent=copies.get(old.parent)
    for mod in obj.modifiers:
     if mod.type=='ARMATURE':mod.object=copies[rig]
   root=copies[source];arm=copies[rig];root.location=Vector(((col-(.5 if os.environ.get('FPV_FOCUSED_REVIEW') else 2.5))*1.0,0,(2-castIndex)*2.1));arm.animation_data.action=bpy.data.actions['idle']
   s.frame_set(1);s.frame_set(0);bpy.context.view_layer.update()
   for item in c['equipment']:
    gear=bpy.data.objects[item['root']];bone=rig.data.bones[item['bone']]
    bind=(rig.matrix_world@bone.matrix_local).inverted()@gear.matrix_world
    copy=gear.copy();copy.parent=None;copy.data=gear.data.copy();copy.data.materials.clear();copy.data.materials.append(material(item['color']));bpy.context.collection.objects.link(copy);copy.hide_render=False
    copy.matrix_world=arm.matrix_world@arm.pose.bones[item['bone']].matrix@bind;created.append(copy)
   bpy.ops.object.text_add(location=((col-(.5 if os.environ.get('FPV_FOCUSED_REVIEW') else 2.5))*1.0-.42,-.23,(2-castIndex)*2.1-.15),rotation=(math.pi/2,0,0))
   t=bpy.context.object;t.data.body=c['family'];t.data.size=.065;t.data.align_x='LEFT';t.data.extrude=0;t.data.space_character=1;created.append(t)
 s.camera.location=(.5,-12,3.05);s.camera.rotation_euler=(Vector((0,0,3.0))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=6.4
 s.render.resolution_x=900 if os.environ.get('FPV_FOCUSED_REVIEW') else 1800;s.render.resolution_y=1500 if os.environ.get('FPV_FOCUSED_REVIEW') else 1800;s.render.resolution_percentage=100
 # Broad frontal light for all rows; same material workflow as source review.
 for o in s.objects:
  if o.type=='LIGHT':o.data.energy=0
 bpy.ops.object.light_add(type='AREA',location=(0,-5,6));light=bpy.context.object;light.data.energy=2200;light.data.shape='DISK';light.data.size=8;light.rotation_euler=(Vector((0,0,3))-light.location).to_track_quat('-Z','Y').to_euler();created.append(light)
 s.render.filepath=str(p/('wardrobe-focused.png' if os.environ.get('FPV_FOCUSED_REVIEW') else 'wardrobe-sheet-'+str(batch+1)+'.png'));bpy.ops.render.render(write_still=True)
print('WARDROBE_PREVIEW_DONE')
