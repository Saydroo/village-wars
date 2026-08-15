# -*- coding: utf-8 -*-
"""ABNAHME-RENDERER Cartoon-Haende (glatte Roehren-Bauweise, echte Finger).

Die Geometrie selbst liegt in cartoon_parts.py (einzige Quelle, wird auch von
archer_full.py benutzt). Dieses Skript baut nur die Szene und rendert.

Design-Referenz: design/referenzen/haende/ (Clash-of-Clans-Haende) — nur fuer die
HANDFORM, nicht fuer den Stil; der Soft-Chibi-Look bleibt.

Aufruf: blender -b --factory-startup --python cartoon_hands.py -- <outdir> <stage>
  stage: open | fist | arm
"""
import bpy, math, sys, os
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if len(argv) >= 1 else \
    r"C:\Users\Ufuk\AppData\Local\Temp\claude\C--Users-Ufuk-Claude-Code\45eedaf3-bd13-48ee-bdfa-54326fd0d1f8\scratchpad\ft"
stage = argv[1] if len(argv) >= 2 else "open"

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

M = cp.make_materials()
if stage == "open":
    cp.build_open_hand(M)
    TARGET = Vector((0, 0, 0.20))
elif stage == "fist":
    cp.build_fist(M, staff=(0.037, -0.45, 0.92))
    TARGET = Vector((0, 0, 0.30))
else:
    cp.build_forearm(M)
    cp.build_fist(M, staff=(0.037, -0.45, 0.92))
    TARGET = Vector((0, 0, 0.05))
OSCALE = 0.95 if stage != "arm" else 1.7      # open+fist im GLEICHEN Massstab

# === KAMERA / LICHT / RENDER ===================================================
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam_data.ortho_scale = OSCALE
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(40)
ko = bpy.data.objects.new("key", key)
ko.rotation_euler = (math.radians(42), math.radians(8), math.radians(25))
bpy.context.collection.objects.link(ko)
fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200))
bpy.context.collection.objects.link(fo)
spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 26; spec.size = 1.4
so_ = bpy.data.objects.new("spec", spec)
so_.location = (0.8, 1.8, 1.9)
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
sc.cycles.samples = 110
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 700
sc.view_settings.view_transform = 'Standard'

d = 24.0
# offene Hand: 3/4 bewusst auf die Daumenseite, damit die Fingerbiegung sichtbar wird
_v34_az = 52 if stage == "open" else 320
for vname, el_deg, az_deg in (("34", 66, _v34_az), ("front", 82, 0), ("oben", 15, 0)):
    el = math.radians(el_deg); az = math.radians(az_deg)
    cam.location = TARGET + Vector((d * math.sin(el) * math.sin(az),
                                    d * math.sin(el) * math.cos(az),
                                    d * math.cos(el)))
    cam.rotation_euler = (TARGET - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, f"hand_{stage}_{vname}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)
print("DONE")
