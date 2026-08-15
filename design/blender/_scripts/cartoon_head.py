# -*- coding: utf-8 -*-
"""ABNAHME-RENDERER Cartoon-Kopf/Kapuze.

Die Geometrie selbst liegt in cartoon_parts.py (einzige Quelle, wird auch von
archer_full.py benutzt). Dieses Skript baut nur die Szene und rendert.

Aufruf: blender -b --factory-startup --python cartoon_head.py -- <outdir> [stage] [hood_style]
  stage:      face (Standard, nackter Kopf) | hood (Kopf mit Kapuze)
  hood_style: robinhood (Standard, abgenommen) | kompakt (Portrait/Marketing)
"""
import bpy, math, sys, os
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if len(argv) >= 1 else \
    r"C:\Users\Ufuk\AppData\Local\Temp\claude\C--Users-Ufuk-Claude-Code\45eedaf3-bd13-48ee-bdfa-54326fd0d1f8\scratchpad\ft"
stage = argv[1] if len(argv) >= 2 else "face"
HOOD_STYLE = argv[2] if len(argv) >= 3 else "robinhood"

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

M = cp.make_materials()
head, _ = cp.build_head(M, with_hair=(stage != "hood"))
if stage == "hood":
    cp.build_hood(M, head, style=HOOD_STYLE)

# === KAMERA / LICHT / RENDER (APPEAL-Licht aus unit_sheet_archer.py) ===========
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam_data.ortho_scale = 1.55
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(40)
ko = bpy.data.objects.new("key", key)
ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
bpy.context.collection.objects.link(ko)
fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200))
bpy.context.collection.objects.link(fo)
spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 30; spec.size = 1.4
so_ = bpy.data.objects.new("spec", spec)
so_.location = (0.7, 1.8, 1.9)
so_.rotation_euler = (Vector((0, 0, 0)) - so_.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.collection.objects.link(so_)

world = bpy.data.worlds.new("W"); world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
bpy.context.scene.world = world

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
try:
    cprefs = bpy.context.preferences.addons['cycles'].preferences
    for ctype in ('OPTIX', 'CUDA'):
        try:
            cprefs.compute_device_type = ctype
            break
        except Exception:
            continue
    cprefs.get_devices()
    for d_ in cprefs.devices:
        d_.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU-Setup fehlgeschlagen, CPU-Fallback:', e)
sc.cycles.samples = 96
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 640
sc.view_settings.view_transform = 'Standard'

d = 24.0
if stage == "hood":
    views = (("front", 80, 0), ("side", 84, 90))
    oscale, tgt, tmpl = 1.62, Vector((0, 0, -0.05)), f"hood_{HOOD_STYLE}_{{}}.png"
else:
    views = (("front", 80, 0), ("side", 80, 90))
    oscale, tgt, tmpl = 1.55, Vector((0, 0, -0.02)), "kopf_neu_{}.png"
for vname, elx, azx in views:
    cam_data.ortho_scale = oscale
    el = math.radians(elx); az = math.radians(azx)
    cam.location = tgt + Vector((d * math.sin(el) * math.sin(az),
                                 d * math.sin(el) * math.cos(az),
                                 d * math.cos(el)))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, tmpl.format(vname))
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)
print("DONE")
