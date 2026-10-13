"""Export the photographic Kait study as a bounded, material-batched web asset."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys
import tempfile

import bpy
from mathutils import Matrix


parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--source', type=Path)
export_args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
export_args.output.mkdir(parents=True, exist_ok=True)
builder = Path(__file__).with_name('build_kait.py')
if export_args.source:
    bpy.ops.wm.open_mainfile(filepath=str(export_args.source.resolve()))
else:
    original_argv = sys.argv[:]
    with tempfile.TemporaryDirectory(prefix='kait-study-') as temporary:
        sys.argv = [str(builder), '--', '--output', temporary, '--skip-renders']
        runpy.run_path(str(builder), run_name='__main__')
    sys.argv = original_argv

root = bpy.data.objects['KAIT | editable vehicle assembly']
source_objects = list(root.children)
micro_details = (
    'Steering rim stitching', 'Climate knob knurl', 'Embossed tire size',
    'Rear window heater trace', 'Seat back stitching', 'Dashboard stitched seam',
    'Speaker grille horizontal slot', 'Tire transverse tread channels',
)
exported = []
removed_count = 0
for obj in source_objects:
    if obj.name.startswith(micro_details):
        removed_count += 1
        continue
    if obj.type not in {'MESH', 'CURVE', 'FONT'}:
        continue
    if obj.type in {'CURVE', 'FONT'}:
        obj.data.resolution_u = 3
        obj.data.bevel_resolution = 1
    for modifier in obj.modifiers:
        if modifier.type == 'BEVEL':
            modifier.segments = 1

    bpy.context.view_layer.update()
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    geometry = bpy.data.meshes.new_from_object(evaluated)
    geometry.transform(obj.matrix_world)
    part = bpy.data.objects.new(obj.name + ' web', geometry)
    bpy.context.scene.collection.objects.link(part)
    # Dense body grids and tire rings keep their silhouette with moderate decimation.
    geometry.calc_loop_triangles()
    if len(geometry.loop_triangles) > 160:
        simplify = part.modifiers.new('Web silhouette simplification', 'DECIMATE')
        simplify.ratio = .18 if len(geometry.loop_triangles) > 3000 else .30
        bpy.context.view_layer.objects.active = part
        bpy.ops.object.modifier_apply(modifier=simplify.name)
    exported.append(part)

# Bake all retained geometry, then batch disconnected surfaces sharing a finish.
bpy.ops.object.select_all(action='DESELECT')
for obj in exported:
    obj.select_set(True)
bpy.context.view_layer.objects.active = exported[0]
bpy.ops.object.join()
merged = bpy.context.object
merged.name = 'Nissan Kait'
merged.matrix_world = Matrix.Identity(4)

for material in merged.data.materials:
    shader = material.node_tree.nodes.get('Principled BSDF')
    if material.name in {'Lightly tinted laminated glass', 'Rear privacy glass'}:
        shader.inputs['Transmission Weight'].default_value = 0
        shader.inputs['Alpha'].default_value = .30 if material.name.startswith('Lightly') else .65
        shader.inputs['Base Color'].default_value = (.08, .13, .17, 1)
        shader.inputs['Roughness'].default_value = .16
        material.surface_render_method = 'DITHERED'
    # Grain is subpixel at the home-page size; keep this GLB texture-free and self-contained.
    for link in list(material.node_tree.links):
        if link.to_socket == shader.inputs['Normal']:
            material.node_tree.links.remove(link)

merged.data.calc_loop_triangles()
triangle_count = len(merged.data.loop_triangles)
if triangle_count > 100000:
    raise ValueError(f'Kait web mesh exceeds the triangle budget: {triangle_count}')
if any(not math.isfinite(value) for vertex in merged.data.vertices for value in vertex.co):
    raise ValueError('Kait web mesh contains non-finite coordinates')

asset = export_args.output / 'kait.glb'
bpy.ops.export_scene.gltf(
    filepath=str(asset.resolve()), export_format='GLB', use_selection=True,
    export_yup=True, export_animations=False, export_cameras=False,
    export_lights=False, export_extras=False, export_texcoords=False,
    export_normals=True, export_materials='EXPORT', export_keep_originals=False,
)
if asset.stat().st_size > 4000000:
    raise ValueError(f'Kait GLB exceeds the byte budget: {asset.stat().st_size}')
report = {
    'asset': 'kait.glb', 'source': 'KAIT01 photographic Blender study',
    'builder_sha256': hashlib.sha256(builder.read_bytes()).hexdigest(),
    'asset_sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
    'triangles': triangle_count, 'material_slots': len(merged.data.materials),
    'removed_micro_details': removed_count, 'bytes': asset.stat().st_size,
    'limits': {'triangles': 100000, 'bytes': 4000000},
    'status': 'Photographic approximation for the home-page preview; not a simulation vehicle',
}
(export_args.output / 'kait-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('KAIT_WEB_EXPORT', json.dumps(report), flush=True)
