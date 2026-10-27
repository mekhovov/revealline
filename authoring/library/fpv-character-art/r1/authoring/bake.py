import os
import bpy,json,math
bpy.context.preferences.filepaths.save_version=0
from pathlib import Path
import numpy as np
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4
scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
scene.render.bake.margin=16;scene.render.bake.use_clear=True;scene.render.bake.use_selected_to_active=False
for image in bpy.data.images:
 if image.source=='FILE' and Path(bpy.path.abspath(image.filepath)).exists():image.reload()
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 if obj.data.shape_keys:bpy.ops.object.shape_key_remove(all=True,apply_mix=True)
 obj.data.uv_layers[0].name='SourceUV'
 for mat in obj.data.materials:
  if not mat or not mat.use_nodes:continue
  n=mat.node_tree.nodes;l=mat.node_tree.links
  for tex in list(n):
   if tex.type=='TEX_IMAGE' and not tex.inputs['Vector'].is_linked:
    uv=n.new('ShaderNodeUVMap');uv.uv_map='SourceUV';l.new(uv.outputs['UV'],tex.inputs['Vector'])
def join_group(name,objects,size,alpha=False):
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
 obj=bpy.context.object;obj.name=name
 uv=obj.data.uv_layers.new(name='BakedUV');obj.data.uv_layers.active=uv;uv.active_render=True
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.009,area_weight=.1,correct_aspect=True,scale_to_bounds=True)
 bpy.ops.object.mode_set(mode='OBJECT')
 oldmats=list(obj.data.materials)
 def bake_image(label,bake_type,noncolor=False):
  im=bpy.data.images.new(name+'_'+label,width=size,height=size,alpha=True)
  im.colorspace_settings.name='Non-Color' if noncolor else 'sRGB'
  for mat in oldmats:
   node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;mat.node_tree.nodes.active=node
  bpy.ops.object.bake(type=bake_type)
  return im
 color=bake_image('basecolor','DIFFUSE')
 normal=None;orm=None
 if alpha:
  original=[]
  for mat in oldmats:
   nodes=mat.node_tree.nodes;links=mat.node_tree.links
   bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
   out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
   em=nodes.new('ShaderNodeEmission')
   if bs and bs.inputs['Alpha'].is_linked:links.new(bs.inputs['Alpha'].links[0].from_socket,em.inputs['Color'])
   else:em.inputs['Color'].default_value=(1,1,1,1)
   if out.inputs['Surface'].is_linked:original.append((mat,out.inputs['Surface'].links[0].from_socket,out))
   links.new(em.outputs['Emission'],out.inputs['Surface'])
  mask=bake_image('mask','EMIT',True)
  cp=np.empty(size*size*4,dtype=np.float32);mp=np.empty_like(cp)
  color.pixels.foreach_get(cp);mask.pixels.foreach_get(mp);cp[3::4]=mp[0::4];color.pixels.foreach_set(cp)
  for mat,socket,out in original:mat.node_tree.links.new(socket,out.inputs['Surface'])
 else:
  normal=bake_image('normal','NORMAL',True)
  rough=bake_image('roughness','ROUGHNESS',True)
  rp=np.empty(size*size*4,dtype=np.float32);rough.pixels.foreach_get(rp)
  op=np.ones_like(rp);op[1::4]=np.clip(rp[0::4],.45,.95);op[2::4]=0
  orm=bpy.data.images.new(name+'_orm',width=size,height=size,alpha=False);orm.colorspace_settings.name='Non-Color';orm.pixels.foreach_set(op)
 for image in [color,normal,orm]:
  if image:
   image.filepath_raw=str(p/(image.name+'.png'));image.file_format='PNG';image.save()
 mat=bpy.data.materials.new(name+'_material');mat.use_nodes=True;mat.use_backface_culling=not alpha
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
 bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.78
 tex=nodes.new('ShaderNodeTexImage');tex.image=color;links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 if alpha:
  cut=nodes.new('ShaderNodeMath');cut.operation='GREATER_THAN';cut.inputs[1].default_value=.5
  links.new(tex.outputs['Alpha'],cut.inputs[0]);links.new(cut.outputs[0],bs.inputs['Alpha'])
 if normal:
  tex=nodes.new('ShaderNodeTexImage');tex.image=normal;nm=nodes.new('ShaderNodeNormalMap');nm.uv_map='BakedUV'
  links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
 if orm:
  tex=nodes.new('ShaderNodeTexImage');tex.image=orm;sep=nodes.new('ShaderNodeSeparateColor')
  links.new(tex.outputs['Color'],sep.inputs[0]);links.new(sep.outputs['Green'],bs.inputs['Roughness']);links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
 obj.data.materials.clear();obj.data.materials.append(mat)
 for face in obj.data.polygons:face.material_index=0
 for layer in list(obj.data.uv_layers):
  if layer.name!='BakedUV':obj.data.uv_layers.remove(layer)
 return obj
all_mesh=[o for o in bpy.data.objects if o.type=='MESH']
masked=[o for o in all_mesh if '.short04' in o.name or '.eyebrow' in o.name]
opaque=[o for o in all_mesh if o not in masked]
main=join_group('worker_opaque',opaque,2048)
hair=join_group('worker_masked',masked,1024,True)
# Keep no redundant hidden source materials/images in the saved review.
for mat in list(bpy.data.materials):
 if mat.users==0:bpy.data.materials.remove(mat)
for image in list(bpy.data.images):
 if image.users==0:bpy.data.images.remove(image)
scene.cycles.samples=48;scene.render.filepath=str(p/'worker-atlas-review.png')
bpy.ops.wm.save_as_mainfile(filepath=str(p/'worker-atlas.blend'))
bpy.ops.render.render(write_still=True)
print('FPV_ATLAS_COMPLETE',[(o.name,len(o.data.vertices),len(o.data.materials)) for o in (main,hair)])
