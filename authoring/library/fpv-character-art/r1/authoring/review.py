import os
import bpy,math
from pathlib import Path
from mathutils import Vector
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)));s=bpy.context.scene;s.cycles.samples=24
live=bpy.data.objects['worker_live_root'];lod=bpy.data.objects['worker_lod1_root'];parts=bpy.data.objects['worker_damage_library']
def visible(root,value):
 for o in [root,*root.children_recursive]:o.hide_render=not value
s.camera.location=(.7,-4.8,1.05);s.camera.rotation_euler=(Vector((0,0,.91))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=2.15
visible(parts,False);visible(live,True);visible(lod,False)
s.render.filepath=str(p/'worker-final-live-review.png');bpy.ops.render.render(write_still=True)
visible(live,False);visible(lod,True)
lodrig=bpy.data.objects['worker_lod1_rig'];liverig=bpy.data.objects['worker_live_rig']
lodrig.animation_data.action=bpy.data.actions['idle__lod1'];lodrig.data.pose_position='POSE'
print('LOD_RENDER_STATE',lodrig.data.pose_position,lodrig.animation_data.action.name)
s.frame_set(1);s.frame_set(0);bpy.context.view_layer.update()
s.render.filepath=str(p/'worker-final-lod-review.png');bpy.ops.render.render(write_still=True)
visible(lod,False);visible(parts,True)
for name,delta in {'head':(0,0,.3),'torso':(0,0,0),'left_arm':(.35,0,.1),'right_arm':(-.35,0,.1),'left_leg':(.2,0,-.15),'right_leg':(-.2,0,-.15)}.items():bpy.data.objects['damage_'+name+'_root'].location+=Vector(delta)
s.camera.data.ortho_scale=2.7;s.camera.location=(1.5,-4.8,1.5);s.camera.rotation_euler=(Vector((0,0,1))-s.camera.location).to_track_quat('-Z','Y').to_euler()
s.render.filepath=str(p/'worker-final-parts-review.png');bpy.ops.render.render(write_still=True)
