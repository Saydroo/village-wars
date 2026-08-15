# -*- coding: utf-8 -*-
"""SCHRITT 1 (Grundsatzentscheidung 2026-07-11): Der KOERPER wird als einfache
Cartoon-Grundform neu gebaut (nicht mehr aus MakeHuman). Dieser nackte Koerper
(Rumpf + Arme + Beine, ohne Kopf/Haende/Kleidung) ist Schritt 1 zur Abnahme.

ASSERT: im Seitenprofil liegen Knoechel, Huefte, Brustmitte und Kopfansatz auf
einer Senkrechten (Tiefen-y nah beieinander) — keine Vorbeuge ab Werk.

Aufruf: blender -b --factory-startup --python cartoon_body.py -- <outdir>
"""
import bpy, math, sys, os
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if len(argv) >= 1 else \
    r"C:\Users\Ufuk\AppData\Local\Temp\claude\C--Users-Ufuk-Claude-Code\45eedaf3-bd13-48ee-bdfa-54326fd0d1f8\scratchpad\ft"
stage = argv[1] if len(argv) >= 2 else "check"   # check | diag (nur Arme + Lot-Stab)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

M = cp.make_materials()
objs, anchors = cp.build_body(M)

# === ASSERTS (echte Messachsen: y = Vorne-Hinten, Welt) =======================
dg = bpy.context.evaluated_depsgraph_get()


def world_verts(prefixes):
    pts = []
    for o in objs:
        if o.name.startswith(prefixes):
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            for v in me.vertices:
                pts.append(o.matrix_world @ v.co)
            ev.to_mesh_clear()
    return pts


# --- 1) SENKRECHT (Mittelachse): Knoechel/Huefte/Brust/Kopfansatz gleiche Tiefe
axis_pts = world_verts(("rumpf", "bein", "hals"))


def mean_y_at(z, dz=0.06):
    ys = [p.y for p in axis_pts if abs(p.z - z) < dz]
    return sum(ys) / len(ys) if ys else 0.0


checks = {"knoechel": cp.BODY_ANKLE_Z, "huefte": cp.BODY_HIP_Z,
          "brustmitte": 1.20, "kopfansatz": cp.BODY_NECK_Z}
ys = {k: mean_y_at(z) for k, z in checks.items()}
spread = max(ys.values()) - min(ys.values())
print("SENKRECHT-ASSERT y-Tiefe:", {k: round(v, 3) for k, v in ys.items()},
      "| Streuung", round(spread, 3))
assert spread < 0.12, f"Koerper nicht senkrecht (y-Streuung {spread:.3f}): {ys}"

# --- 2) ARM-ASSERT: misst die SILHOUETTEN-KANTEN (das, was das Auge als Achse
# liest), nicht nur die Mittelachse: Vorder- und Hinterkante muessen oben wie
# unten auf gleicher Tiefe liegen (parallel senkrecht), und Ansatz/Ende zentriert.
for side in ("R", "L"):
    ap = world_verts((f"arm_{side}",))
    top = [p.y for p in ap if p.z > 1.25]              # Ansatz (Schulterband)
    bot = [p.y for p in ap if 0.58 < p.z < 0.70]       # Ende (Handgelenkband, ohne Kuppe)
    c_top = (max(top) + min(top)) / 2
    c_bot = (max(bot) + min(bot)) / 2
    d_front = max(bot) - max(top)                      # Vorderkante unten vs oben
    d_back = min(bot) - min(top)                       # Hinterkante unten vs oben
    print(f"ARM-{side}: Ansatz {c_top:+.3f} Ende {c_bot:+.3f} Achs-Neigung {c_bot - c_top:+.3f} "
          f"| Vorderkante {d_front:+.3f} Hinterkante {d_back:+.3f}")
    assert abs(c_top) < 0.06, f"Arm-{side}-Ansatz nicht an Rumpfmitte (y={c_top:+.3f})"
    assert abs(c_bot) < 0.06, f"Arm-{side}-Ende nicht an Rumpfmitte (y={c_bot:+.3f})"
    assert abs(c_bot - c_top) < 0.03, f"Arm-{side}-Achse geneigt ({c_bot - c_top:+.3f})"
    assert abs(d_front) < 0.025, f"Arm-{side}-VORDERkante schraeg ({d_front:+.3f})"
    assert abs(d_back) < 0.025, f"Arm-{side}-HINTERkante schraeg ({d_back:+.3f})"

# --- 3) RUMPF-ASSERT: vorderste Tiefe UNTEN darf nicht vor der von OBEN liegen
tp = world_verts(("rumpf",))
front_lower = max(p.y for p in tp if p.z < 1.00)
front_upper = max(p.y for p in tp if p.z >= 1.00)
print(f"RUMPF: vorderste Tiefe unten {front_lower:+.3f} vs oben {front_upper:+.3f}")
assert front_lower <= front_upper + 0.005, \
    f"Unterer Rumpf steht vor ({front_lower:+.3f} > {front_upper:+.3f})"

# Masse ausgeben (Gesamthoehe, Schulterbreite, Standbreite)
allp = axis_pts + world_verts(("arm", "schulter", "fuss"))
zmin = min(p.z for p in allp)
sh = anchors["shoulder"]; an = anchors["ankle"]
print(f"MASSE: Hoehe(Fuss->Hals) {cp.BODY_NECK_Z - zmin:.3f} "
      f"Schulterbreite {abs(sh['R'].x - sh['L'].x) + 0.32:.3f} "
      f"Standbreite(Knoechel) {abs(an['R'].x - an['L'].x):.3f}")

# === KAMERA / LICHT / RENDER (APPEAL-Licht) ===================================
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(40)
ko = bpy.data.objects.new("key", key)
ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
bpy.context.collection.objects.link(ko)
fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200))
bpy.context.collection.objects.link(fo)
spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 34; spec.size = 1.6
so_ = bpy.data.objects.new("spec", spec); so_.location = (0.9, 2.2, 2.4)
so_.rotation_euler = (Vector((0, 0, 0.9)) - so_.location).to_track_quat('-Z', 'Y').to_euler()
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
sc.render.resolution_x = sc.render.resolution_y = 720
sc.view_settings.view_transform = 'Standard'

d = 24.0
target = Vector((0, 0, 0.86))
cam_data.ortho_scale = 2.05

if stage == "diag":
    # DIAGNOSE: nur Arme + Schultern sichtbar, dazu ein senkrechter Lot-Stab bei
    # y=0 (projiziert in der Seitenansicht exakt auf die Rumpfmitte-Spalte).
    # Haengt der Arm parallel zum Stab, ist die Geometrie senkrecht.
    for o in objs:
        if not o.name.startswith(("arm", "schulter")):
            o.hide_render = True
    DARK = cp.mat("lot", (0.02, 0.02, 0.02), rough=0.9)
    cp.rod((1.2, 0, 0.30), (1.2, 0, 1.60), 0.006, DARK, "lot_stab", verts=8)
    el = math.radians(90); az = math.radians(90)
    cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                    d * math.sin(el) * math.cos(az),
                                    d * math.cos(el)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, "koerper_diag_arm_side.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)
else:
    # Front leicht von oben (88°), SEITE exakt horizontal (90°) — das Profil
    # wird ohne Top-Down-Verzerrung beurteilt.
    for vname, el_deg, az_deg in (("front", 88, 0), ("side", 90, 90)):
        el = math.radians(el_deg); az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"koerper_neu_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
print("DONE")
