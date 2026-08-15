# -*- coding: utf-8 -*-
"""ZUSAMMENFUEHRUNG (2026-07-10): kompletter Archer aus
  * abgenommenem MakeHuman-KOERPER (Beine, Rumpf, Arme, Proportion) — unit_base_male.blend
  * neuem Cartoon-KOPF + KAPUZE (robinhood)   — cartoon_parts.build_head / build_hood
  * neuen HAENDEN (greifende Faust, beide)    — cartoon_parts.build_fist

Der MakeHuman-Kopf und die -Haende werden per Maske entfernt und durch die
Cartoon-Teile ersetzt. Uebergaenge: Hals vom Kapuzenkragen verdeckt, Handgelenke
von der Faust/Manschette verdeckt.

Aufruf:
  blender -b unit_base_male.blend --python archer_full.py -- <stage> <outdir>
  stage: check (Front+Seite schnell) | sheet (4 Ansichten + Gesicht)
         | verify (Front + 3/4 + Von-oben, versionierte Pruefbilder)
"""
import bpy, bmesh, os, sys, math
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
stage = argv[0] if len(argv) >= 1 else "check"
outdir = argv[1] if len(argv) >= 2 else r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"

# === TUNING-KONSTANTEN (Zusammenfuehrung) =====================================
HEAD_SCALE = 0.61          # Kopf-BREITE ~ Schulterbreite (Verhaeltnis ~1.08); die
#                            uniforme Verkleinerung schiebt die Kopfhoehen auf ~2.8
HEAD_DY = 0.02             # Kopf-Tiefe (y) Feinjustage
HEAD_DZ = -0.02            # Kopf-Hoehe Feinjustage (Kinn ueberlappt Hals)
HAND_SCALE = 0.80          # Cartoon-Faust relativ zum verjuengten Unterarm
SPIN_R = 0                 # Faust-Drehung um die Bogenachse (rechts)
SPIN_L = 180               # Faust-Drehung um die Bogenachse (links)

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = bpy.data.objects["Human"]

# === Farben (aus unit_sheet_archer.py) ========================================
COL_BLUE = (0.023, 0.102, 0.351)
COL_BLUE_D = (0.012, 0.056, 0.184)
COL_LEATHER = (0.19, 0.082, 0.028)
COL_LEATHER_D = (0.12, 0.055, 0.020)
COL_GOLD = (0.68, 0.40, 0.075)
COL_WOOD = (0.16, 0.075, 0.03)
COL_SKIN = (0.80, 0.52, 0.35)


def aim_bone(name, target_dir, twist_deg=0):
    bpy.context.view_layer.update()
    pb = arm.pose.bones[name]
    R = (arm.matrix_world @ pb.matrix).to_3x3(); R.normalize()
    local_target = R.inverted() @ Vector(target_dir).normalized()
    q = Vector((0, 1, 0)).rotation_difference(local_target)
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = pb.rotation_quaternion @ q
    if twist_deg:
        from mathutils import Quaternion
        pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion((0, 1, 0), math.radians(twist_deg))


def bone_point(name, t=1.0):
    bpy.context.view_layer.update()
    pb = arm.pose.bones[name]
    return arm.matrix_world @ (pb.head.lerp(pb.tail, t))


# === CHIBI-PROPORTIONEN (abgenommener Koerper — unveraendert) =================
for bn in ("head",):
    arm.data.bones[bn].inherit_scale = 'NONE'
CHIBI = {
    "head": (3.45, 3.17, 3.08),
    "neck01": (1.6, 0.15, 1.6), "neck02": (1.6, 0.15, 1.6), "neck03": (1.6, 0.15, 1.6),
    # Schultern/Brust verbreitert (Kopf sass auf zu schmalem Oberkoerper):
    "spine03": (1.16, 0.84, 1.04), "spine02": (1.08, 0.84, 1.00),
    "clavicle.L": (1.02, 1.40, 1.03), "clavicle.R": (1.02, 1.40, 1.03),
    "upperarm01.L": (1.72, 0.52, 1.72), "upperarm01.R": (1.72, 0.52, 1.72),
    "upperarm02.L": (1.56, 0.52, 1.56), "upperarm02.R": (1.56, 0.52, 1.56),
    "lowerarm01.L": (1.34, 0.52, 1.34), "lowerarm01.R": (1.34, 0.52, 1.34),
    "lowerarm02.L": (1.15, 0.52, 1.15), "lowerarm02.R": (1.15, 0.52, 1.15),
    "wrist.L": (1.42, 1.4, 1.42), "wrist.R": (1.42, 1.4, 1.42),
    # Huefte verbreitern -> Beine parallel mit Abstand (statt Auswaerts-Kippen)
    "pelvis.L": (1.0, 1.7, 1.0), "pelvis.R": (1.0, 1.7, 1.0),
    # Beine laenger (y 0.68) + schlanker (x/z 1.22): schlankes Bein, kein Auswoelben
    "upperleg01.L": (1.22, 0.68, 1.22), "upperleg01.R": (1.22, 0.68, 1.22),
    "upperleg02.L": (1.22, 0.68, 1.22), "upperleg02.R": (1.22, 0.68, 1.22),
    "lowerleg01.L": (1.18, 0.68, 1.18), "lowerleg01.R": (1.18, 0.68, 1.18),
    "lowerleg02.L": (1.18, 0.68, 1.18), "lowerleg02.R": (1.18, 0.68, 1.18),
    "foot.L": (1.35, 1.2, 1.2), "foot.R": (1.35, 1.2, 1.2),
}
for bn, s in CHIBI.items():
    arm.pose.bones[bn].scale = s

# === POSE: Beine A-Pose, Arme bringen die Faeuste vor die Brust ================
# AUFRECHTE GRUNDPOSE: ganze Wirbelsaeule senkrecht (kein Vorbeugen). Vorher war
# nur spine02 gerade gestellt -> die uebrigen Wirbel (01/03/04/05) behielten die
# Rest-Kruemmung und der Oberkoerper hing nach vorne.
for _sb in ("spine01", "spine02", "spine03", "spine04", "spine05"):
    aim_bone(_sb, (0, -0.05, 1.0))   # senkrecht (Hauch Ruecklage gegen Rest-Vorbeuge)
for _nb in ("neck01", "neck02", "neck03"):
    if _nb in arm.pose.bones:
        aim_bone(_nb, (0, 0.0, 1.0))
aim_bone("head", (0, 0.0, 1.0))
# Arme gestaffelt vor den Koerper: rechte Faust hoeher (kreuzt zur Mitte-links),
# linke tiefer -> beide Handgelenke bei ~gleichem x = senkrechter Bogen mittig.
# SCHUETZEN-HALTUNG: linker Arm streckt den Bogen nach links-VORNE (weit vom
# Koerper weg), rechter Arm gebeugt zieht die Sehne zur Koerpermitte.
aim_bone("upperarm01.L", (-0.62, 0.64, -0.30))
aim_bone("lowerarm01.L", (-0.52, 0.78, -0.06))
aim_bone("upperarm01.R", (0.30, 0.32, -0.76))
aim_bone("lowerarm01.R", (-0.50, 0.66, 0.10))
# SENKRECHTE, PARALLELE Beine (kein Auswaerts-Kippen -> keine O-Beine). Der
# Abstand kommt aus der breiteren Huefte (pelvis-Skalierung), nicht aus Kippen.
for _s in ("R", "L"):
    aim_bone(f"upperleg01.{_s}", (0, 0.0, -1.0))
    aim_bone(f"upperleg02.{_s}", (0, 0.0, -1.0))
    aim_bone(f"lowerleg01.{_s}", (0, 0.0, -1.0))
    aim_bone(f"lowerleg02.{_s}", (0, 0.0, -1.0))
    aim_bone(f"foot.{_s}", (0, 0.95, -0.22))
# MH-Finger einklappen (falls doch etwas durchblitzt, bevor die Maske greift)
for side in ("R", "L"):
    for f in range(1, 6):
        for seg in range(1, 4):
            n = f"finger{f}-{seg}.{side}"
            if n in arm.pose.bones:
                arm.pose.bones[n].scale = (0.6, 0.18, 0.6)

# === FUESSE AUF DEN BODEN + Koerperhoehe ======================================
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
eval_body = body.evaluated_get(dg)
ws = [(body.matrix_world @ v.co) for v in eval_body.data.vertices]
minz = min(v.z for v in ws)
arm.location.z -= minz
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ws = [(body.matrix_world @ v.co) for v in body.evaluated_get(dg).data.vertices]
minz, maxz = min(v.z for v in ws), max(v.z for v in ws)
T = maxz - minz
chin_z = bone_point("jaw", 1.0).z
eye_z = bone_point("eye.L", 0.0).z
hb0 = bone_point("head", 0.0)          # Kopf-Knochen-Basis = Hals-Oberkante
# MH-Kopfsilhouette (Scheitel..Kinn), um den Cartoon-Kopf gleich gross zu setzen
_hz = [w.z for w in ws if w.z >= chin_z - 0.01]
mh_head_h = (max(_hz) - chin_z) if _hz else 0.75
print(f"MASS: T {T:.3f} chin_z {chin_z:.3f} eye_z {eye_z:.3f} "
      f"hb0 {tuple(round(v,3) for v in hb0)} mh_head_h {mh_head_h:.3f}")
# Aufrecht-Check (Hueft-y vs Brust-y ~gleich = senkrecht) + Standbreite (Fuss-x)
_hipp = bone_point("root", 0.0); _chest = bone_point("spine05", 1.0)
_fR = bone_point("foot.R", 0.0); _fL = bone_point("foot.L", 0.0)
print(f"AUFRECHT: hip_y {_hipp.y:.3f} chest_y {_chest.y:.3f} (Vorbeuge {_chest.y-_hipp.y:+.3f}) "
      f"| STAND foot_x R {_fR.x:.3f} L {_fL.x:.3f} (Abstand {abs(_fR.x-_fL.x):.3f})")


def body_radius_at(z, dz=0.02, xlim=None):
    dg2 = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg2)
    best = 0.0
    for v in ev.data.vertices:
        w = body.matrix_world @ v.co
        if abs(w.z - z) < dz and (xlim is None or abs(w.x) < xlim):
            best = max(best, math.hypot(w.x, w.y))
    return best


# === MATERIALIEN ==============================================================
def mat(name, rgb, rough=0.85, metal=0.0, spec=0.20):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = spec
    return m


BLUE = mat("blue", COL_BLUE)
BLUE_D = mat("blue_d", COL_BLUE_D)
LEATH = mat("leath", COL_LEATHER)
LEATH_D = mat("leath_d", COL_LEATHER_D)
GOLD = mat("gold", COL_GOLD, rough=0.4, metal=0.6)
WOOD = mat("wood", COL_WOOD)
SKIN = mat("skin_flat", COL_SKIN, rough=0.95)

# MPFB-Realismus-Assets ausblenden, Haut flach einfaerben
for o in bpy.data.objects:
    n = o.name.lower()
    if any(k in n for k in ("high-poly", "eyebrow", "short02", "hair", "teeth")):
        o.hide_render = True
for i in range(len(body.data.materials)):
    body.data.materials[i] = SKIN
# Bracer_L (MH-Klon) fliegt mit raus — die Armschiene wird unten NEU und
# explizit gebaut (der Klon war unter dem Tunika-Aermel verschwunden).
for _n in ("Paint", "Bracer_R", "Bracer_L", "Boot_R", "Boot_L", "Kilt", "Beard"):
    _o = bpy.data.objects.get(_n)
    if _o:
        bpy.data.objects.remove(_o, do_unlink=True)

# === KOPF + HAENDE des MH-Mesh MASKIEREN ======================================
# Posierte Weltkoordinaten der Haut-Verts holen (nur Armature-Modifier aktiv).
me = body.data
gidx = {g.name: g.index for g in body.vertex_groups}


def weights_of(name):
    idx = gidx.get(name); w = {}
    if idx is None:
        return w
    for v in me.vertices:
        for g in v.groups:
            if g.group == idx and g.weight > 0.001:
                w[v.index] = g.weight
    return w


body_w = weights_of("body")
_vis = [(m_, m_.show_viewport) for m_ in body.modifiers]
for m_, _ in _vis:
    m_.show_viewport = (m_.type == 'ARMATURE')
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
_pv = body.evaluated_get(_dg).data.vertices
pw = {vi: (body.matrix_world @ _pv[vi].co).copy() for vi in range(len(_pv))}
for m_, st_ in _vis:
    m_.show_viewport = st_

# --- SCHULTERBREITE (Spann der clavicle-gewichteten Verts) --------------------
_clav = [pw[vi] for gn in ("clavicle.L", "clavicle.R")
         for vi, w in weights_of(gn).items() if w > 0.2 and vi in pw]
shoulder_w = (max(p.x for p in _clav) - min(p.x for p in _clav)) if _clav else 0.0
print(f"SCHULTERBREITE {shoulder_w:.3f}  (Kopfbreite ~{1.05*HEAD_SCALE:.3f}, "
      f"Verhaeltnis Kopf/Schulter {1.05*HEAD_SCALE/max(shoulder_w,1e-6):.2f})")

# Haende (Finger + Handflaeche) ueber KNOCHENGEWICHTE; Kopf ueber eine BOUNDING-
# KUGEL: das MakeHuman-Gesicht haengt an Muskel-Knochen (Nase, Lippen ...), nicht
# nur an "head"/"jaw" — ein reiner Gewichtsfilter liess es stehen. Die Kugel um
# den Kopf-Schwerpunkt erfasst ALLE Gesichts-Verts nach Position.
_all_groups = [g.name for g in body.vertex_groups]
# Haende UND Fuesse entfernen (Cartoon-Faust bzw. Stiefel ersetzen sie); sonst
# lugten MH-Zehen vorne aus den Stiefeln.
limb_groups = [gn for gn in _all_groups if "finger" in gn or "toe" in gn
               or gn in ("wrist.L", "wrist.R", "foot.L", "foot.R")]
seen = set()
for gn in limb_groups:
    for vi, w in weights_of(gn).items():
        if w > 0.5:
            seen.add(vi)
# Kopf-Schwerpunkt + Radius aus den head/jaw-gewichteten Verts (Schaedel+Kiefer)
head_seed = [pw[vi] for gn in ("head", "jaw") for vi, w in weights_of(gn).items() if w > 0.2]
Cx = sum((p.x for p in head_seed), 0.0) / len(head_seed)
Cy = sum((p.y for p in head_seed), 0.0) / len(head_seed)
Cz = sum((p.z for p in head_seed), 0.0) / len(head_seed)
Chead = Vector((Cx, Cy, Cz))
_dists = sorted((p - Chead).length for p in head_seed)
head_rad = _dists[-1] * 1.08     # voller Radius (Scheitel/Kinn) + Marge, damit
#                                  keine Schaedeldecke unter der Kapuze hervorlugt
n_head = 0
for vi in range(len(_pv)):
    if (pw[vi] - Chead).length <= head_rad:
        if vi not in seen:
            n_head += 1
        seen.add(vi)
print(f"MASKE: Haende+Fuesse {len(seen)-n_head} + Kopf-Kugel C {tuple(round(v,3) for v in Chead)} "
      f"r {head_rad:.3f} -> Kopf {n_head}, gesamt {len(seen)}")
rm = body.vertex_groups.new(name="z_remove")
for vi in seen:
    rm.add([vi], 1.0, 'REPLACE')
mkr = body.modifiers.new("remove", 'MASK')
mkr.vertex_group = "z_remove"; mkr.invert_vertex_group = True

# === TUNIKA (Torso-Klon, aus unit_sheet_archer.py) ============================
tun = {}
tgroups = [g.name for g in body.vertex_groups
           if g.name.startswith(("spine", "neck", "clavicle", "pelvis", "shoulder"))]
tgroups += ["upperarm01.L", "upperarm01.R", "upperarm02.L", "upperarm02.R", "root"]
for gn in tgroups:
    for vi, w in weights_of(gn).items():
        tun[vi] = max(tun.get(vi, 0), w)
_vis2 = [(m_, m_.show_viewport) for m_ in body.modifiers]
for m_, _ in _vis2:
    m_.show_viewport = False
_dg2 = bpy.context.evaluated_depsgraph_get()
evco = [v.co.copy() for v in body.evaluated_get(_dg2).data.vertices]
for m_, st_ in _vis2:
    m_.show_viewport = st_
for v in me.vertices:
    co = evco[v.index]
    if v.index in body_w and 0.88 < co.z < 1.44 and abs(co.x) < 0.42:
        tun[v.index] = 1.0
vg = body.vertex_groups.new(name="z_tunic")
for vi, w in tun.items():
    if vi in body_w and w > 0.02:
        vg.add([vi], 1.0, 'REPLACE')
body.data.materials.append(BLUE)
green_idx = len(body.data.materials) - 1
for poly in body.data.polygons:
    za = sum(evco[v_].z for v_ in poly.vertices) / len(poly.vertices)
    xa = sum(abs(evco[v_].x) for v_ in poly.vertices) / len(poly.vertices)
    if 0.86 < za < 1.44 and xa < 0.45:
        poly.material_index = green_idx

tun_o = body.copy(); tun_o.data = body.data.copy(); tun_o.name = "Tunic"
bpy.context.collection.objects.link(tun_o)
tun_o.data.materials.clear(); tun_o.data.materials.append(BLUE)
for mod in list(tun_o.modifiers):
    if mod.type != 'ARMATURE':
        tun_o.modifiers.remove(mod)
mk = tun_o.modifiers.new("mask", 'MASK'); mk.vertex_group = "z_tunic"; mk.threshold = 0.3
dp = tun_o.modifiers.new("off", 'DISPLACE'); dp.strength = 0.019; dp.mid_level = 0
so = tun_o.modifiers.new("solid", 'SOLIDIFY'); so.thickness = 0.024; so.offset = 1
ss = tun_o.modifiers.new("ss", 'SUBSURF'); ss.levels = 1; ss.render_levels = 1
tun_o.parent = arm


# === GUERTEL + ROCK + STIEFEL + KOECHER (aus unit_sheet_archer.py) ============
def rod(p1, p2, r, material, name="rod", verts=16):
    a = Vector(p1); b = Vector(p2); mid = (a + b) / 2; d = b - a
    if d.length < 1e-6:
        return None
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object; o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    bpy.ops.object.shade_smooth(); o.data.materials.append(material)
    return o


def sphere(name, center, r, material, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=r, location=(0, 0, 0))
    o = bpy.context.active_object; o.name = name
    if scale:
        o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    o.location = Vector(center)
    bpy.ops.object.shade_smooth(); o.data.materials.append(material)
    return o


def obox(name, center, size, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    o = bpy.context.active_object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = rot; o.location = center
    o.data.materials.append(material)
    return o


def cone_at(pos, ddir, r, h, material, name="c"):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=0.002, depth=h,
                                    location=Vector(pos) + Vector(ddir) * (h / 2))
    o = bpy.context.active_object; o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector(ddir)).to_euler()
    o.data.materials.append(material)
    return o


hip = bone_point("root", 0.0)
belt_r = body_radius_at(hip.z + 0.02, xlim=0.28) + 0.035
bpy.ops.mesh.primitive_torus_add(major_radius=belt_r, minor_radius=0.030,
                                 location=(0, 0, hip.z + 0.045))
belt = bpy.context.active_object; belt.name = "guertel"
bpy.ops.object.shade_smooth(); belt.data.materials.append(LEATH)
obox("schnalle", (0, belt_r + 0.012, hip.z + 0.045), (0.07, 0.03, 0.09), GOLD)
skirt_top = hip.z + 0.05; skirt_len = 0.24   # etwas kuerzer -> mehr sichtbares Bein
bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=belt_r + 0.04, radius2=belt_r + 0.01,
                                depth=skirt_len, location=(0, 0, skirt_top - skirt_len / 2))
skirt = bpy.context.active_object; skirt.name = "rock"
bpy.ops.object.shade_smooth(); skirt.data.materials.append(BLUE_D)

# Stiefel: Schaft und Fuss ~gleich breit (kein glockenfoermiges Aufgehen), flache
# nur leicht ueberstehende Sohle, keine Wulstferse. Schaft kurz -> mehr Bein.
RB = 0.098                                   # Schaft-/Fussbreite (einheitlich)
for side in ("R", "L"):
    ankle = bone_point(f"foot.{side}", 0.0); toe = bone_point(f"foot.{side}", 1.15)
    cx = ankle.x
    fy = (ankle.y + toe.y) / 2 + 0.015
    # Schaft: gerader Zylinder, Breite = Fussbreite
    rod((cx, ankle.y + 0.01, 0.085), (cx, ankle.y + 0.01, 0.285), RB, LEATH,
        f"schaft_{side}", verts=20)
    # Fuss: gleiche Breite wie der Schaft, nach vorne laenglich, flach (keine Kugel)
    sphere(f"fuss_{side}", (cx, fy - 0.01, 0.072), RB, LEATH, scale=(1.02, 1.52, 0.80))
    # duenne, nur leicht ueberstehende Sohle (dunkel) — kein Wulst
    sphere(f"sohle_{side}", (cx, fy, 0.028), RB, LEATH_D, scale=(1.14, 1.60, 0.30))

qb = bone_point("root", 0.0) + Vector((-0.06, -0.16, 0.14))
qdir = Vector((-0.30, -0.10, 0.95)).normalized(); qlen = 0.16
rod(qb - qdir * qlen, qb + qdir * qlen, 0.055, LEATH_D, "koecher", verts=18)
rod(qb + qdir * (qlen - 0.02), qb + qdir * (qlen + 0.02), 0.060, LEATH, "koecherrand", verts=18)
qs1 = qdir.cross(Vector((0, 0, 1))).normalized(); qs2 = qdir.cross(qs1).normalized()
for k in range(3):
    phi = math.radians(k * 120 + 40)
    off = (qs1 * math.cos(phi) + qs2 * math.sin(phi)) * 0.024
    top = qb + qdir * (qlen + 0.01) + off
    rod(top, top + qdir * 0.07, 0.007, WOOD, "koecherpfeil", verts=6)
    cone_at(top + qdir * 0.07, qdir, 0.016, 0.045, GOLD, "pfeilspitze_gold")

# === CARTOON-KOPF + KAPUZE (lokal bauen, Asserts lokal, dann transformieren) ==
M = cp.make_materials()
# gleiche Materialnamen wie Koerper? cartoon_parts hat eigene — konsistent halten:
M["BLUE"] = BLUE; M["GOLD"] = GOLD          # Kapuze/Feder = Koerperfarben
head_obj, head_objs = cp.build_head(M, with_hair=False, with_neck=False)
hood_objs = cp.build_hood(M, head_obj, style="robinhood", with_collar=True)
head_all = head_objs + hood_objs
# Shrinkwrap/Solidify der Kopf-Teile backen, damit die starre Transformation
# (Skalierung + Verschiebung) die Decals nicht verrutscht
for o in list(head_all):
    if o.type == 'MESH' and o.modifiers:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception as e:
                print("modifier_apply skip", o.name, md.name, e)
# lokale Kopf-Unterkante (Kinn) messen -> Cartoon-Kinn auf das ECHTE MH-Kinn
# (chin_z) setzen, mit kleiner Halsueberlappung. hb0 (Kopfknochen-Basis) liegt
# viel hoeher als das Kinn und war der Verankerungsfehler v1.
_hb = [head_obj.matrix_world @ v.co for v in head_obj.data.vertices]
loc_chin = min(p.z for p in _hb)                 # ~ -0.51 lokal
head_center_z = (chin_z + 0.02) + HEAD_DZ - HEAD_SCALE * loc_chin
# Kopf-TIEFE (y) ueber die BRUST-Achse (spine05), nicht ueber die konstruktiv weit
# vorne liegende MH-Kopf-Basis (hb0.y ~0.15) -> Kopf sitzt aufrecht ueber dem Rumpf
_chest_y = bone_point("spine05", 1.0).y
head_center_y = _chest_y + HEAD_DY
HEADM = (Matrix.Translation((0.0, head_center_y, head_center_z))
         @ Matrix.Scale(HEAD_SCALE, 4))
cp.place(head_all, HEADM)
print(f"KOPF-Y: chest_y {_chest_y:.3f} -> head_y {head_center_y:.3f} (vorher hb0.y {hb0.y:.3f})")
_ht = head_center_z + HEAD_SCALE * max(p.z for p in _hb)
_kinn = head_center_z + HEAD_SCALE * loc_chin
_kopf_sil = _ht - _kinn
print(f"KOPF platziert: scale {HEAD_SCALE} kinn {_kinn:.3f} scheitel {_ht:.3f} "
      f"| Kopf-Breite {1.05*HEAD_SCALE:.3f} vs Schulter {shoulder_w:.3f} "
      f"= Verhaeltnis {1.05*HEAD_SCALE/max(shoulder_w,1e-6):.2f} "
      f"| KOPFHOEHEN {T/_kopf_sil:.2f} (Ziel 2.0-3.0)")

# === CARTOON-FAEUSTE an die tatsaechlichen HANDGELENKE (beide greifend) =======
# Beide Faeuste sitzen exakt am posierten Handgelenk -> Unterarm verbindet
# sauber. Der Bogen laeuft durch beide Griffpunkte (= gemeinsame Achse).
wristL = bone_point("wrist.L", 1.0)   # Bogenhand (streckt nach links-vorne)
wristR = bone_point("wrist.R", 1.0)   # Sehnenhand (gebeugt zur Mitte)
print("HANDGELENKE: wristL(Bogen)", tuple(round(v, 3) for v in wristL),
      "wristR(Sehne)", tuple(round(v, 3) for v in wristR))
FIST_GRIP_LOCAL = Vector((0, 0, 0.26))       # Stab-Griffpunkt in Faust-Lokalkoord.


def place_fist(grip_world, axis, back_ref, spin_deg, name):
    objs = cp.build_fist(M, pfx=name + "_", with_wrist=True)
    zc = Vector(axis).normalized()           # lokal z -> Griffachse
    br = Vector(back_ref)
    yc = (br - zc * br.dot(zc)).normalized()  # lokal +y (Handflaeche/Kuppen) grob nach br
    xc = yc.cross(zc)
    Rot = Matrix.Rotation(math.radians(spin_deg), 4, zc) @ Matrix((xc, yc, zc)).transposed().to_4x4()
    grip_off = Rot @ (HAND_SCALE * FIST_GRIP_LOCAL)
    Mx = Matrix.Translation(grip_world - grip_off.to_3d()) @ Rot @ Matrix.Scale(HAND_SCALE, 4)
    cp.place(objs, Mx)


# --- BOGEN: AUFRECHT, KEINE Vorneigung (Entscheidung 2026-07-14). Sehne innen
# zum Koerper; die Naehe der Sehne zum linken Unterarm ist korrekt und wird von
# der ARMSCHIENE beantwortet, nicht von Geometrie-Tricks. Gekruemmt (C in der
# Bild-Ebene), obere Spitze tiefer (kollidiert nicht mit Kopf/Feder) -----------
bow_axis = Vector((0, 0, 1))
riser = Vector((wristL.x, wristL.y, wristL.z))   # Griff/Riser = Bogenhand (verbunden)
upper_len, lower_len = 0.50, 0.72     # oben kuerzer -> Spitze unter dem Kopf
curve = 0.24                          # Kruemmung in -x (vom Koerper weg, frontal sichtbar)
bstr = 0.050                          # kraeftigeres Holz
npts = 17; pts = []
for i in range(npts):
    s = -1.0 + 2.0 * i / (npts - 1)
    z = riser.z + (upper_len if s >= 0 else lower_len) * s
    x = riser.x - curve * (abs(s) ** 1.35)      # 0 am Griff, voll an den Spitzen
    pts.append(Vector((x, riser.y, z)))
for i in range(npts - 1):
    tt = abs(-1.0 + 2.0 * i / (npts - 1))
    rod(pts[i], pts[i + 1], bstr * (1.0 - 0.4 * tt), WOOD, "bogenarm", verts=14)
tip_top, tip_bot = pts[-1], pts[0]
for tip in (tip_top, tip_bot):
    cone_at(tip, (tip - riser).normalized(), bstr * 0.85, 0.07, GOLD, "bogentip")
bc = riser

# --- PFEIL: von der Sehnenhand durch den Riser nach vorne ---------------------
arrow_dir = (riser - wristR); arrow_dir.z *= 0.35
arrow_dir = arrow_dir.normalized()
arrow_start = wristR - arrow_dir * 0.10   # Pfeilende ragt knapp hinter der Faust raus
arrow_end = riser + arrow_dir * 0.42
rod(arrow_start, arrow_end, 0.013, WOOD, "pfeil", verts=10)
cone_at(arrow_end, arrow_dir, 0.030, 0.075, GOLD, "pfeilspitze")
for k in range(3):
    phi = math.radians(k * 120)
    a1 = arrow_dir.cross(Vector((0, 0, 1))).normalized()
    a2 = arrow_dir.cross(a1).normalized()
    off = (a1 * math.cos(phi) + a2 * math.sin(phi))
    obox("fed", arrow_start + arrow_dir * 0.03 + off * 0.02, (0.006, 0.05, 0.03), LEATH)

# --- SEHNE: helle Geometrie, endet an der FAUST-OBERFLAECHE der Zughand -------
# Die Zughand HAELT die Sehne (physikalisch korrekt); jede Sehnenhaelfte laeuft
# radial auf den Griffpunkt zu und stoppt an der Faust-Silhouette. Der Knick
# liegt verdeckt IM Faust-Volumen -> keine sichtbare Durchdringung mehr (vorher
# endete die Sehne bei wristR + 0.02 und schnitt sichtbar durch die Knoechel).
STRING = mat("sehne", (0.86, 0.85, 0.80), rough=0.6)
R_STRING = 0.016
FIST_HOLD = 0.118        # "Oberflaechen"-Radius der Cartoon-Faust (HAND_SCALE 0.8)
end_o = wristR + (tip_top - wristR).normalized() * FIST_HOLD
end_u = wristR + (tip_bot - wristR).normalized() * FIST_HOLD
rod(tip_top, end_o, R_STRING, STRING, "sehne_o", verts=8)
rod(tip_bot, end_u, R_STRING, STRING, "sehne_u", verts=8)

# --- FAEUSTE platzieren ------------------------------------------------------
place_fist(riser, bow_axis, Vector((0.4, 1.0, 0.0)), SPIN_L, "fistL")   # Bogenhand
place_fist(wristR, arrow_dir, Vector((0, 0, 1)), SPIN_R, "fistR")       # Sehnenhand
# Manschette NUR an der Zughand (rechts). Links uebernimmt die ARMSCHIENE den
# Uebergang Unterarm -> Faust: der Chibi-Unterarm ist nur ~0.21 lang, die blaue
# Kugel (r 0.13) verdeckte die Schiene sonst vollstaendig.
sphere("cuff", wristR, 0.12, BLUE, scale=(1.1, 1.1, 0.72))

# === ARMSCHIENE: Leder am LINKEN Unterarm (Ausruestungsliste ART_STYLE Pkt. 4.3)
# Beim echten Bogenschiessen streift die Sehne den Unterarm des Bogenarms —
# genau dafuer sitzt die Lederschiene dort. Sehnen-KONTAKT an der Schiene ist
# gewollt und erlaubt; verboten ist nur echtes DURCHDRINGEN von Arm oder Faust
# (Asserts unten).
elbL = bone_point("lowerarm01.L", 0.0)
fa = wristL - elbL; fa_len = fa.length; fa_dir = fa.normalized()
_dg4 = bpy.context.evaluated_depsgraph_get()
r_arm = 0.0
for v in body.evaluated_get(_dg4).data.vertices:
    w = body.matrix_world @ v.co
    t = (w - elbL).dot(fa_dir)
    if 0.38 * fa_len < t < 0.85 * fa_len:
        dr = ((w - elbL) - fa_dir * t).length
        if dr < 0.20:                    # nur Unterarm-Verts, nicht Torso/Bein
            r_arm = max(r_arm, dr)
BR_R = r_arm + 0.022                     # Leder deutlich staerker als der Arm
b0 = elbL + fa_dir * (0.12 * fa_len)     # deckt den sichtbaren Unterarm ab und
b1 = wristL                              # laeuft bis in die Faust (Uebergang)
rod(b0, b1, BR_R, LEATH, "armschiene", verts=20)
for _tq in (0.22, 0.78):                 # zwei dunkle Riemen fuer die Lesbarkeit
    _ctr = b0.lerp(b1, _tq)
    bpy.ops.mesh.primitive_torus_add(major_radius=BR_R + 0.002, minor_radius=0.012,
                                     location=_ctr)
    _tor = bpy.context.active_object; _tor.name = "armschiene_riemen"
    _tor.rotation_euler = Vector((0, 0, 1)).rotation_difference(fa_dir).to_euler()
    bpy.ops.object.shade_smooth(); _tor.data.materials.append(LEATH_D)
print(f"ARMSCHIENE: r_arm {r_arm:.3f} -> Schiene r {BR_R:.3f} "
      f"Spann {tuple(round(v, 3) for v in b0)} -> {tuple(round(v, 3) for v in b1)}")


# === SEHNEN-ASSERTS: Beruehrung an der Schiene ERLAUBT, Durchdringung VERBOTEN =
def _seg_pt(a, b, p):
    ab = b - a
    t_ = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t_)).length


def _seg_seg(a, b, c, d_):
    return min(_seg_pt(c, d_, a.lerp(b, i / 48)) for i in range(49))


FIST_CLEAR = 0.13        # Kern-Volumen der Cartoon-Faust um den Griffpunkt
for _sn, _s0, _s1 in (("sehne_o", tip_top, end_o), ("sehne_u", tip_bot, end_u)):
    dL = _seg_pt(_s0, _s1, riser)        # linke Faust (Bogenhand am Riser)
    dR = _seg_pt(_s0, _s1, wristR)       # rechte Faust (Zughand HAELT die Sehne:
    #                                      radialer Zulauf -> min = Endpunkt)
    dArm = _seg_seg(_s0, _s1, elbL, wristL)
    _kontakt = dArm <= BR_R + R_STRING + 0.01
    print(f"SEHNE {_sn}: FaustL {dL:.3f} FaustR {dR:.3f} Unterarm {dArm:.3f} "
          f"(Arm r {r_arm:.3f} / Schiene r {BR_R:.3f}) Schienen-Kontakt: {_kontakt}")
    assert dL >= FIST_CLEAR, f"{_sn} durchdringt LINKE Faust (d {dL:.3f} < {FIST_CLEAR})"
    assert dR >= FIST_HOLD - 1e-3, f"{_sn} durchdringt RECHTE Faust (d {dR:.3f} < {FIST_HOLD})"
    assert dArm >= r_arm - 0.01, f"{_sn} durchdringt linken UNTERARM (d {dArm:.3f} < Arm r {r_arm:.3f})"

# === KAMERA / LICHT / RENDER ==================================================
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam_data.ortho_scale = T * 1.28
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(40)
ko = bpy.data.objects.new("key", key); ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
bpy.context.collection.objects.link(ko)
fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200))
bpy.context.collection.objects.link(fo)
spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 38; spec.size = 1.6
so_ = bpy.data.objects.new("spec", spec); so_.location = (0.9, 2.2, 2.4)
so_.rotation_euler = (Vector((0, 0, 1.1)) - so_.location).to_track_quat('-Z', 'Y').to_euler()
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
            cprefs.compute_device_type = ctype; break
        except Exception:
            continue
    cprefs.get_devices()
    for d_ in cprefs.devices:
        d_.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU-Setup fehlgeschlagen, CPU-Fallback:', e)
sc.cycles.samples = {"check": 48, "verify": 64}.get(stage, 128)
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = {"check": 640, "verify": 760}.get(stage, 900)
sc.view_settings.view_transform = 'Standard'

el = math.radians(74); d = 24.0
target = Vector((0, 0, T * 0.50))
# Pruefbilder werden VERSIONIERT (nie ueberschreiben) — laufende Nummer der
# FIGUR_montage_check-Serie, aktuell v10.
CHECK_V = "v11"
if stage == "verify":
    VIEWS = [("front", 0), ("threequarter", 315)]
    _fname = lambda v: f"FIGUR_montage_check_{CHECK_V}_{v}.png"
else:
    VIEWS = [("front", 0), ("side", 270)] if stage == "check" else [
        ("front", 0), ("threequarter", 315), ("side", 270), ("back", 180)]
    _fname = lambda v: f"archer_full_{v}.png"
for vname, az_deg in VIEWS:
    az = math.radians(az_deg)
    cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                    d * math.sin(el) * math.cos(az), d * math.cos(el)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(outdir, _fname(vname))
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)

if stage == "verify":
    # Von-oben-Ansicht: zeigt den Sehnenverlauf relativ zu Unterarm/Armschiene
    _el_top = math.radians(4)
    cam.location = target + Vector((0, d * math.sin(_el_top), d * math.cos(_el_top)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(outdir, _fname("top"))
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)

if stage == "sheet":
    cam_data.ortho_scale = 0.62 * T
    tf = Vector((0, 0.1, chin_z + HEAD_SCALE * 0.5 + HEAD_DZ))
    cam.location = tf + Vector((d * math.sin(el) * math.sin(0), d * math.sin(el) * math.cos(0), d * math.cos(el)))
    cam.rotation_euler = (tf - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.render.filepath = os.path.join(outdir, "archer_full_FACE.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED FACE", sc.render.filepath)
print("DONE T=", round(T, 3))
