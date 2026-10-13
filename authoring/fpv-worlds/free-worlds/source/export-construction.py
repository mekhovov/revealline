"""Run with Blender 4.5.14 --factory-startup --disable-autoexec scene.blend --python THIS -- OUTPUT.glb.
Keep the downloaded original unchanged; export visible scene meshes, excluding source/template collections.
"""
import bpy, sys, pathlib, json
assert tuple(bpy.app.version) == (4,5,14)
source = pathlib.Path(bpy.data.filepath).parent
for image in bpy.data.images:
    candidate=source/pathlib.Path(image.filepath).name
    if candidate.is_file(): image.filepath=str(candidate)
# Only the author's assembled visible scene, not hidden modeling templates.
bpy.ops.object.select_all(action='DESELECT')
selected=[]
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.visible_get() and not obj.hide_render:
        obj.select_set(True);selected.append(obj.name)
output=pathlib.Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
    export_apply=True,export_yup=True,export_animations=False,export_extras=False,
    export_cameras=False,export_lights=False)
output.with_suffix('.blender.json').write_text(json.dumps({'blender':bpy.app.version_string,'source':'HouseConstructionSite.blend','meshes':selected,'changes':'Export visible evaluated static geometry; embedded palette; hidden modeling templates excluded. Original scene unchanged.'},indent=2)+'\n')
