import os
import bpy,runpy,json
bpy.context.preferences.filepaths.save_version=0
from pathlib import Path
p=Path(os.environ.get('FPV_ASSET_DIR', str(Path(__file__).resolve().parent.parent)))
rig=bpy.data.objects['worker_rig']
helper=runpy.run_path(str(Path(__file__).parent/'animate-worker.py'));actions=helper['build_worker_actions'](rig)
scene=bpy.context.scene;scene.cycles.samples=32
for kind,frame in [('idle',0),('walk',9),('warning',25),('run',6)]:
 rig.animation_data.action=bpy.data.actions[kind];scene.frame_set(frame)
 scene.render.filepath=str(p/('worker-'+kind+'-review.png'))
 bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'worker-animated.blend'))
print('FPV_ANIMATED',[(a.name,list(a.frame_range)) for a in actions])
