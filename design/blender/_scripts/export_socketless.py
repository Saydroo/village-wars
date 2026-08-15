# -*- coding: utf-8 -*-
"""SOCKELLOSER Export eines Gebaeudes (CoC-Style: nur das Bauwerk, kein
Grassockel/Dreckhof). Die Gebaeude-GEOMETRIE bleibt unangetastet — es werden nur
die Deko-Boden-Objekte VOR dem Render entfernt.

Ablauf (wie footproj_buildings.py): das jeweilige <gebaeude>_tiered.py wird per
runpy ausgefuehrt (baut die Szene + Kamera + Licht exakt wie immer), aber
`lib_iso.render_png` wird abgefangen. Statt sofort zu rendern:
  1. alle BODEN-Objekte loeschen (Materialien grass/grass_d/dirt/dirt_l/moss und
     tiefliegend, z-Mitte < 0.6) — das ist der Grassockel + Dreckhof + Grasbueschel.
  2. Fusspunkt = (0, 0, zmin_Bauwerk) exakt per Kamera projizieren (jetzt auf das
     BAUWERK bezogen, nicht mehr auf den Sockelboden).
  3. sockellos rendern (transparenter Hintergrund) + JSON-Sidecar mit
     footpx/ortho/res/bbox fuer die anschliessende Master-Normalisierung.

Aufruf:
  blender -b --factory-startup --python export_socketless.py -- <script.py> <arg> <out.png>
"""
import os, sys, runpy, json
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib_iso as L
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
script = argv[0]
build_arg = argv[1]
out_path = argv[2]

GROUND_MATS = {"grass", "grass_d", "dirt", "dirt_l", "moss"}
GROUND_Z_MAX = 0.6  # Sockel/Hof/Bueschel liegen alle unter z=0.45


def _obj_world_bbox(obj):
    xs, ys, zs = [], [], []
    for corner in obj.bound_box:
        w = obj.matrix_world @ Vector(corner)
        xs.append(w.x); ys.append(w.y); zs.append(w.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def _export(out_path_ignored, res=800):
    sc = bpy.context.scene

    # --- 1. Boden-Deko entfernen (Grassockel + Dreckhof + Grasbueschel) ---
    removed = []
    for obj in list(sc.objects):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        mat_names = {m.name for m in obj.data.materials if m}
        if mat_names & GROUND_MATS:
            _, _, _, _, zmin, zmax = _obj_world_bbox(obj)
            if (zmin + zmax) / 2 < GROUND_Z_MAX:
                removed.append(obj.name)
                bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()

    # --- 2. Bauwerk-Bounding-Box bestimmen ---
    mesh_objs = [o for o in sc.objects if o.type == "MESH"]
    xs0, xs1, ys0, ys1, zs0, zs1 = [], [], [], [], [], []
    for obj in mesh_objs:
        a, b, c, d, e, f = _obj_world_bbox(obj)
        xs0.append(a); xs1.append(b); ys0.append(c); ys1.append(d); zs0.append(e); zs1.append(f)
    bxmin, bxmax = min(xs0), max(xs1)
    bymin, bymax = min(ys0), max(ys1)
    bzmin, bzmax = min(zs0), max(zs1)

    # Bauwerk auf die GRUNDEBENE absenken (Fundament auf z=0). Das Mesh selbst
    # bleibt unveraendert — nur die POSITION rutscht um zmin nach unten, damit der
    # Boden-Anker (0,0,0) = Kachelmitte auf Bodenhoehe exakt am Fundament sitzt
    # (kein schwebender Sockel, wie in der alten Pipeline).
    for obj in mesh_objs:
        obj.location.z -= bzmin
    bpy.context.view_layer.update()
    bzmax -= bzmin
    bzmin = 0.0

    cam = sc.camera
    foot = Vector((0.0, 0.0, 0.0))
    uv = world_to_camera_view(sc, cam, foot)
    footx, footy = uv.x * res, (1 - uv.y) * res

    # --- 3. sockellos rendern (Settings wie lib_iso.render_png) ---
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    ev = sc.eevee
    for attr, val in (("use_raytracing", True), ("taa_render_samples", 96), ("use_shadows", True)):
        try:
            setattr(ev, attr, val)
        except Exception:
            pass
    try:
        ev.use_fast_gi = True
        ev.fast_gi_method = "AMBIENT_OCCLUSION_ONLY"
        ev.fast_gi_distance = 0.6
    except Exception:
        pass
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.filepath = out_path
    bpy.ops.render.render(write_still=True)

    meta = {
        "script": os.path.basename(script),
        "out": out_path,
        "res": res,
        "ortho_scale": round(cam.data.ortho_scale, 5),
        "footx": round(footx, 2),
        "footy": round(footy, 2),
        "bbox_world": [round(v, 4) for v in (bxmin, bxmax, bymin, bymax, bzmin, bzmax)],
        "width_world": round(bxmax - bxmin, 4),
        "depth_world": round(bymax - bymin, 4),
        "removed_ground_objects": removed,
    }
    with open(os.path.splitext(out_path)[0] + ".json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
    print("SOCKETLESS_EXPORT " + json.dumps(meta))
    sys.exit(0)


L.render_png = _export
sys.argv = ["blender", "--"] + [build_arg, out_path]
runpy.run_path(os.path.join(HERE, script), run_name="__main__")
