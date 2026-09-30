"""Blender 4.5.14 LTS: blender --background scene.blend --python export_world.py -- --output world.glb

Pass --starter to author an original simple FPV scene in an empty Blender process.
The built-in glTF exporter owns geometry/material serialization; extras.rl carries semantics.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy


def marker(name, kind, location, **properties):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.empty_display_type = 'ARROWS'
    obj.empty_display_size = 0.5
    obj['rl'] = {'id': name, 'kind': kind, **properties}
    return obj


def starter():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    material = bpy.data.materials.new('Training amber')
    material.diffuse_color = (0.9, 0.42, 0.08, 1)
    for name, location, scale in [('left-post', (-2, 8, 2), (0.2, 0.2, 2)),
                                   ('right-post', (2, 8, 2), (0.2, 0.2, 2)),
                                   ('crossbar', (0, 8, 4), (2.2, 0.2, 0.2))]:
        bpy.ops.mesh.primitive_cube_add(size=2, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.scale = scale
        obj.data.materials.append(material)
        # Collider dimensions below are in glTF Y-up axes; the marker transforms
        # are exported by Blender, so no hand-coded axis conversion is applied.
        marker(name + '-collision', 'collider', location,
               size=[scale[0] * 2, scale[2] * 2, scale[1] * 2])
    marker('spawn', 'spawn', (0, 0, 0))
    marker('gate-01', 'gate', (0, 8, 2), width=3.6, height=3.6, order=0)
    marker('landing', 'landing', (0, 12, 0), radius=1.5)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--starter', action='store_true')
    parser.add_argument('--save-source', help='Save the editable .blend with asset-marked collections')
    options = parser.parse_args(args)
    if tuple(bpy.app.version) != (4, 5, 14):
        raise RuntimeError('The pinned exporter requires Blender 4.5.14 LTS; use the documented toolchain.')
    if options.starter:
        starter()
        collection = bpy.data.collections.new('FPV reusable gate')
        bpy.context.scene.collection.children.link(collection)
        for obj in list(bpy.context.scene.objects):
            if obj.name.startswith(('left-post', 'right-post', 'crossbar')):
                for owner in list(obj.users_collection):
                    owner.objects.unlink(obj)
                collection.objects.link(obj)
        collection.asset_mark()
        for material in bpy.data.materials:
            material.asset_mark()
    ids = set()
    for obj in bpy.context.scene.objects:
        if 'rl' in obj:
            value = obj['rl'].to_dict()
            if not value.get('id') or value['id'] in ids:
                raise ValueError('Every rl marker requires a unique stable id')
            ids.add(value['id'])
    if options.save_source:
        source = Path(options.save_source).resolve()
        source.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
    output = Path(options.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
                              export_extras=True, export_yup=True,
                              export_animations=True, export_apply=False)
    output.with_suffix('.authoring.json').write_text(json.dumps({
        'format': 'FPVAuthoringReceipt.v1', 'blender': bpy.app.version_string,
        'exporter': 'built-in glTF', 'semanticIds': sorted(ids),
        'source': bpy.data.filepath, 'units': 'metres', 'outputUp': 'Y'
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
