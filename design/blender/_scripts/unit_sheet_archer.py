"""Archer REFERENZ-SHEET (Schritt A) nach ART_STYLE.md — CHIBI, voll stilisiert.
v02: MPFB-Realismus ersetzt (ART_STYLE 2.3/2.4): grosse Cartoon-Augen, flache
Haut ohne Poren, Haar/Bart als geschlossene Formen, Faeustlinge statt Finger,
Bogensehne als sichtbare Geometrie, Chibi-Rock (Kegel) statt Kilt-Klon.
Aufruf:
  blender -b unit_base_male.blend --python unit_sheet_archer.py -- <stage> <outdir> <style>
  stage: check (nur Front, schnell) | sheet (4 Ansichten, final)
  style: soft (weiches Licht, Cel-Look kommt vom KI-Pass) | toon (Toon-BSDF +
         Freestyle-Outlines direkt aus Blender)
"""
import bpy, os, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
stage = argv[0] if len(argv) >= 1 else "check"
outdir = argv[1] if len(argv) >= 2 else r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender"
style = argv[2] if len(argv) >= 3 else "soft"
variant = argv[3] if len(argv) >= 4 else "b"   # a = Eisenhut (spaeter Militia) | b = Kapuze+Feder
mouth = argv[4] if len(argv) >= 5 else "closed"  # closed (Standard/Idle) | open (Attack-Pose!)
prim_hex = argv[5] if len(argv) >= 6 else None   # Primaerfarben-Override (#RRGGBB) fuer Farbtests

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = bpy.data.objects["Human"]

# Fraktionsfarben aus ART_STYLE.md — MENSCHEN = KOENIGSBLAU/GOLD (Fraktionsblatt
# ist fuehrende Quelle, Entscheidung 2026-07-05). Namen GREEN* historisch.
COL_GREEN = (0.023, 0.102, 0.351)    # #2A5AA0 Koenigsblau (primaer)
COL_GREEN_D = (0.012, 0.056, 0.184)  # dunkleres Koenigsblau
COL_LEATHER = (0.19, 0.082, 0.028)   # #7A5230 Leder
COL_LEATHER_D = (0.12, 0.055, 0.020)
COL_GOLD = (0.68, 0.40, 0.075)       # #D8A94E Gold (Akzent, vom Blatt gemessen)
COL_STEEL = (0.40, 0.44, 0.49)       # #A9AEB6 helles Stahlgrau (sekundaer)
COL_WOOD = (0.16, 0.075, 0.03)
COL_SKIN = (0.80, 0.52, 0.35)        # flacher Cartoon-Hautton
COL_HAIR = (0.13, 0.075, 0.035)      # geschlossene Haarform, dunkelbraun


def hex2lin(h):
    h = h.lstrip('#')
    vals = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        vals.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(vals)


if prim_hex:
    COL_GREEN = hex2lin(prim_hex)
    COL_GREEN_D = tuple(v * 0.45 for v in COL_GREEN)

# === APPEAL: kuerzere Nase + markantes Kinn via MakeHuman-Targets ==============
# (muss VOR allen Messungen laufen — Targets sind Shape-Keys!)
try:
    from bl_ext.user_default.mpfb.services.targetservice import TargetService
    import glob as _glob
    _tdir = os.path.join(os.environ["APPDATA"], "Blender Foundation", "Blender",
                         "4.2", "extensions", "user_default", "mpfb", "data", "targets")
    for _pat, _w in (("nose/nose-scale-depth-decr*", 0.7),
                     ("nose/nose-scale-vert-decr*", 0.4),
                     ("chin/chin-prominent-incr*", 0.15),   # weniger langes/spitzes Kinn
                     ("chin/chin-height-decr*", 0.20),      # Kinn kuerzer
                     ("chin/chin-width-incr*", 0.22),       # Kinn breiter
                     ("head/head-scale-horiz-incr*", 0.15), # Wangen voller/breiter
                     ("chin/chin-jaw-drop-decr*", 0.3)):
        for _h in _glob.glob(os.path.join(_tdir, *_pat.split("/"))):
            try:
                TargetService.load_target(body, _h, weight=_w)
            except Exception as _e:
                print("TARGET FAIL", _pat, _e)
    print("APPEAL-Targets geladen")
except Exception as _e:
    print("MPFB nicht verfuegbar, Nase/Kinn bleiben:", _e)


def aim_bone(name, target_dir, twist_deg=0):
    bpy.context.view_layer.update()
    pb = arm.pose.bones[name]
    R = (arm.matrix_world @ pb.matrix).to_3x3()
    R.normalize()
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


# === CHIBI-PROPORTIONEN ========================================================
for bn in ("head",):
    arm.data.bones[bn].inherit_scale = 'NONE'
CHIBI = {
    "head": (3.45, 3.17, 3.08),  # Kugel-Proportion beibehalten, gesamt ~8% kleiner (mehr Koerper sichtbar)
    "neck01": (1.6, 0.15, 1.6), "neck02": (1.6, 0.15, 1.6), "neck03": (1.6, 0.15, 1.6),
    "spine03": (1.00, 0.82, 1.00),   # Rumpf schlanker (X/Z) + minimal laenger (Y)
    "spine02": (0.98, 0.82, 0.98),
    "clavicle.L": (0.95, 1.05, 1.0), "clavicle.R": (0.95, 1.05, 1.0),  # Schultern etwas schmaler
    # Verjuengung Schulter->Handgelenk: Oberarm kraeftig, Unterarm schlank
    # (vorher war der Unterarm 1.6 DICKER als der Oberarm 1.5 = Schlauch-Arm)
    "upperarm01.L": (1.72, 0.52, 1.72), "upperarm01.R": (1.72, 0.52, 1.72),
    "upperarm02.L": (1.56, 0.52, 1.56), "upperarm02.R": (1.56, 0.52, 1.56),
    "lowerarm01.L": (1.34, 0.52, 1.34), "lowerarm01.R": (1.34, 0.52, 1.34),
    "lowerarm02.L": (1.15, 0.52, 1.15), "lowerarm02.R": (1.15, 0.52, 1.15),
    # Handgelenk schmaler, damit die Faust nicht zum Ballon aufblaeht
    "wrist.L": (1.42, 1.4, 1.42), "wrist.R": (1.42, 1.4, 1.42),
    # Beine deutlich laenger (y 0.42->0.60) + minimal schlanker: eigener
    # Koerperabschnitt statt Knubbel unter dem Bauch
    "upperleg01.L": (1.45, 0.60, 1.45), "upperleg01.R": (1.45, 0.60, 1.45),
    "upperleg02.L": (1.45, 0.60, 1.45), "upperleg02.R": (1.45, 0.60, 1.45),
    "lowerleg01.L": (1.40, 0.60, 1.40), "lowerleg01.R": (1.40, 0.60, 1.40),
    "lowerleg02.L": (1.40, 0.60, 1.40), "lowerleg02.R": (1.40, 0.60, 1.40),
    "foot.L": (1.5, 1.25, 1.3), "foot.R": (1.5, 1.25, 1.3),
}
for bn, s in CHIBI.items():
    arm.pose.bones[bn].scale = s

# === NEUTRALE A-POSE ============================================================
aim_bone("spine02", (0, 0.0, 1.0))
aim_bone("head", (0, 0.0, 1.0))
aim_bone("upperarm01.R", (0.78, 0.0, -0.63))
aim_bone("lowerarm01.R", (0.80, 0.0, -0.60))
aim_bone("upperarm01.L", (-0.78, 0.0, -0.63))
aim_bone("lowerarm01.L", (-0.80, 0.0, -0.60))
aim_bone("upperleg01.R", (0.06, 0.0, -1.0))
aim_bone("lowerleg01.R", (0.02, 0.0, -1.0))
aim_bone("upperleg01.L", (-0.06, 0.0, -1.0))
aim_bone("lowerleg01.L", (-0.02, 0.0, -1.0))
aim_bone("foot.R", (0.06, 0.95, -0.30))
aim_bone("foot.L", (-0.06, 0.95, -0.30))
pb = arm.pose.bones["jaw"]
pb.rotation_mode = 'XYZ'
pb.rotation_euler = (0, 0, 0)   # Kiefer ZU — mit Kinn-Targets wirkte 2 Grad offen
# Kinn kuerzer (Y = Laengsachse zum Kinn) + breiter (X/Z): das lange schmale
# MakeHuman-Kinn entlaengen, Gesichtsflaeche runder (nicht flach-gequetscht)
pb.scale = (1.08, 0.87, 1.05)
# FAEUSTLINGE (ART_STYLE 2.1): Finger-Knochen einklappen — die Hand wird von
# einer Mitten-Kugel ersetzt, keine einzelnen duennen Finger
for side in ("R", "L"):
    for f in range(1, 6):
        for seg in range(1, 4):
            n = f"finger{f}-{seg}.{side}"
            if n in arm.pose.bones:
                fb = arm.pose.bones[n]
                fb.scale = (0.6, 0.18, 0.6)

# === KOPF RUNDEN: Schaedel-Silhouette zu ~runder Kugel stauchen ================
# Der MakeHuman-Schaedel ist von Natur laenglich; uniformes 3.7x-Scaling behaelt
# die Eiform. Wir bestimmen empirisch, welche head-Bone-Achse auf Welt-Hoehe (z)
# und Welt-Breite (x) wirkt, und stauchen Hoehe / weiten Breite symmetrisch, bis
# die Kopf-BBox z/x <= 1.15 erfuellt (rund). Messung an den posierten Haut-Verts
# der "body"-Gruppe: nur Armature-Modifier an (dann stimmen die me-Indizes wieder,
# die MASK-Modifier entfernen sonst die Helper -> Index-Versatz).
# === KOPF-RUNDUNG: Schaedel-Kalotte muss rund sein (Assert) ====================
# Die laengliche Eiform kommt vom uniformen 3.7x-Scaling des MakeHuman-Schaedels.
# Gegenmassnahme oben im CHIBI-Dict: head bone-X breiter (4.05), bone-Y niedriger
# (3.30). Hier der geforderte Assert: BBox der Schaedel-HAUT ab Augenhoehe (der
# sichtbare Schaedel oberhalb des Gesichts), Verhaeltnis Hoehe/Breite <= 1.15.
# Messung mit NUR Armature-Modifier aktiv, damit die me-Vertex-Indizes gueltig
# bleiben (die MASK-Modifier entfernen sonst die Helper -> Index-Versatz).
_bgi = body.vertex_groups["body"].index
_hv = [v.index for v in body.data.vertices
       if any(g.group == _bgi and g.weight > 0.001 for g in v.groups)]
_sv = [(m_, m_.show_viewport) for m_ in body.modifiers]
for m_ in body.modifiers:
    m_.show_viewport = (m_.type == 'ARMATURE')
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
_pv = body.evaluated_get(_dg).data.vertices
_mw = body.matrix_world
# Kopf-BBox: Kinn (jaw-Bone-Tail = anatomischer Anker) bis Scheitel, Breite =
# Schaedel-Haut dazwischen (zentral, ohne Arme/Hals-Seiten). Kein fragiler
# Hals-Scan noetig; fasst die ganze sichtbare Kopf-Silhouette Scheitel..Kinn.
_chin_z = bone_point("jaw", 1.0).z
_ez = bone_point("eye.L", 0.0).z
_kv = []
for i in _hv:
    w = _mw @ _pv[i].co
    if w.z >= _chin_z - 0.01 and abs(w.x) < 0.55 and abs(w.y) < 0.6:
        _kv.append(w)
for m_, st_ in _sv:
    m_.show_viewport = st_
# Breite/Tiefe an der breitesten Kopfstelle (Wangen/Schaedel ab eye_z-0.12); die
# A-Pose-Arme liegen tiefer und wuerden die Breite sonst faelschlich aufblaehen.
_cheek = [p for p in _kv if p.z > _ez - 0.12]
_kw = max(p.x for p in _cheek) - min(p.x for p in _cheek)     # Breite (x)
_kd = max(p.y for p in _cheek) - min(p.y for p in _cheek)     # Tiefe (y)
_kh = max(p.z for p in _kv) - _chin_z                         # Hoehe (Kinn->Scheitel)
print("KOPF-RUNDUNG: Kopf-BBox B", round(_kw, 3), "H", round(_kh, 3), "T", round(_kd, 3),
      "| H/B", round(_kh / _kw, 3), "T/B", round(_kd / _kw, 3))
assert _kh / _kw <= 1.20, f"Kopf noch zu eifoermig: H/B={_kh / _kw:.3f}"
assert _kd / _kw <= 1.25, f"Hinterkopf zu tief: T/B={_kd / _kw:.3f}"

# === GESICHT ENTLAENGEN: vordere zentrale Hautflaeche Braue..Kinn ==============
# Das lange schmale MakeHuman-Gesicht wird ueber jaw-Scaling + chin-Targets
# gestaucht/verbreitert. Assert: BBox der vorderen zentralen Gesichtshaut
# (y>0.05, |x|<0.3 = ohne Ohren/Arme), Kinn bis knapp ueber die Brauen, H/B <= 1.25.
_brow_z = _ez + 0.03
_fh = _brow_z - _chin_z                          # Gesichtshoehe Braue->Kinn (Anker, robust)
# Wangenbreite auf Augenhoehe messen: dort ist keine Arm-/Schulter-Naehe wie am Kinn
_cheekv = [p for p in _kv if abs(p.z - _ez) < 0.06 and p.y > 0.03]
_fw = max(p.x for p in _cheekv) - min(p.x for p in _cheekv)
print("GESICHT: Haut-BBox B", round(_fw, 3), "H", round(_fh, 3),
      "H/B", round(_fh / _fw, 3), "nverts", len(_cheekv))
assert _fh / _fw <= 1.25, f"Gesicht zu lang: H/B={_fh / _fw:.3f}"

# Fuesse auf den Boden + Koerperhoehe messen
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
eval_body = body.evaluated_get(dg)
ws = [(body.matrix_world @ v.co) for v in eval_body.data.vertices]
minz = min(v.z for v in ws)
maxz = max(v.z for v in ws)
arm.location.z -= minz
bpy.context.view_layer.update()
T = maxz - minz
chin = bone_point("head", 0.0).z
head_h = (maxz - minz) - (chin - 0)  # bis Kopfknochen-Basis
head_h = T - (chin)
print("DEBUG hoehe", round(T, 3), "kopf-basis", round(head_h, 3),
      "kopfhoehen(basis)", round(T / head_h, 2) if head_h > 0 else -1,
      "| echte-kopfhoehe(scheitel-kinn)", round(_kh, 3),
      "kopfhoehen(echt)", round(T / _kh, 2))


def body_radius_at(z, dz=0.02, xlim=None):
    dg2 = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg2)
    best = 0.0
    for v in ev.data.vertices:
        w = body.matrix_world @ v.co
        if abs(w.z - z) < dz and (xlim is None or abs(w.x) < xlim):
            r = math.hypot(w.x, w.y)
            best = max(best, r)
    return best


# === FLAT-MATERIALIEN ==========================================================
def mat(name, rgb, rough=0.85, metal=0.0, spec=0.20):
    """MATERIALREGEL (ART_STYLE 2.3): matt, kleiner weicher Glanzpunkt,
    kein Chrom — Specular standardmaessig stark reduziert."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = spec
    return m


GREEN = mat("green", COL_GREEN)
GREEN_D = mat("green_d", COL_GREEN_D)
LEATH = mat("leath", COL_LEATHER)
LEATH_D = mat("leath_d", COL_LEATHER_D)
GOLD = mat("gold", COL_GOLD, rough=0.4, metal=0.6)
WOOD = mat("wood", COL_WOOD)
SKIN = mat("skin_flat", COL_SKIN, rough=0.95)
HAIRC = mat("hair_flat", COL_HAIR, rough=0.95)
WHITE = mat("eye_white", (0.92, 0.92, 0.90), rough=0.35)
IRISM = mat("iris", (0.10, 0.05, 0.02), rough=0.3)
# leichte Emission: der Schatten des Brauenwulsts auf den Augaepfeln las sich
# als boeser Blick — selbstleuchtende Augen bleiben flach-freundlich
for _em, _st in ((WHITE, 0.5), (IRISM, 0.25)):
    _b = _em.node_tree.nodes["Principled BSDF"]
    _b.inputs["Emission Color"].default_value = _b.inputs["Base Color"].default_value
    _b.inputs["Emission Strength"].default_value = _st
LINE = mat("line", (0.08, 0.035, 0.02), rough=0.9)

# === STILISIERUNG (ART_STYLE 2.3 + 2.4) ========================================
# 1) Realistische MPFB-Assets ausblenden: Poren-Skin, Straehnen-Haar, Brauen,
#    Prozedural-Augen, Zaehne
for o in bpy.data.objects:
    n = o.name.lower()
    if any(k in n for k in ("high-poly", "eyebrow", "short02", "hair", "teeth")):
        o.hide_render = True
# 2) Haut FLACH: alle Body-Material-Slots durch Cartoon-Hautton ersetzen
for i in range(len(body.data.materials)):
    body.data.materials[i] = SKIN
pt = bpy.data.objects.get("Paint")
if pt:
    pt.hide_render = True

# Klone der Basis: Bracer nur LINKS, Boots braun, Bart als geschlossene Form
br_r = bpy.data.objects.get("Bracer_R")
if br_r:
    bpy.data.objects.remove(br_r, do_unlink=True)
for nm, m_ in (("Bracer_L_mat", LEATH), ("Beard_mat", HAIRC)):
    mm = bpy.data.materials.get(nm)
    if mm:
        b = mm.node_tree.nodes.get("Principled BSDF")
        src = m_.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = src.inputs["Base Color"].default_value
        b.inputs["Roughness"].default_value = 0.95
# Boot-Klone raus: Zehen blitzten hautfarben durch — ersetzt durch simple
# Stiefel-Geometrie (Kugel + Schaft), eindeutig braun (ART_STYLE: einfache Fuesse)
for bn_ in ("Boot_R", "Boot_L"):
    bo_ = bpy.data.objects.get(bn_)
    if bo_:
        bpy.data.objects.remove(bo_, do_unlink=True)
# alter Kilt-Klon weg -> Chibi-Rock kommt als Kegel (in allen Ansichten sichtbar)
old_kilt = bpy.data.objects.get("Kilt")
if old_kilt:
    bpy.data.objects.remove(old_kilt, do_unlink=True)

# === TUNIKA (Torso-Klon) =======================================================
me = body.data
gidx = {g.name: g.index for g in body.vertex_groups}


def weights_of(name):
    idx = gidx.get(name)
    w = {}
    if idx is None:
        return w
    for v in me.vertices:
        for g in v.groups:
            if g.group == idx and g.weight > 0.001:
                w[v.index] = g.weight
    return w


body_w = weights_of("body")
tun = {}
# inkl. Becken: fehlende pelvis/root-Gewichte rissen an den Hueftseiten
# beige Haut-Flecken in die Tunika
tgroups = [g.name for g in body.vertex_groups
           if g.name.startswith(("spine", "neck", "clavicle", "pelvis", "shoulder"))]
tgroups += ["upperarm01.L", "upperarm01.R", "upperarm02.L", "upperarm02.R", "root"]
for gn in tgroups:
    for vi, w in weights_of(gn).items():
        tun[vi] = max(tun.get(vi, 0), w)
# Positions-Fangnetz gegen Achsel-/Flanken-Restflecken.
# SHAPE-KEY-FALLE (Ray-Cast-Diagnose): me.vertices = UNGEMORPHTE Basis — alle
# Baender schlugen daneben. Gemorphte, unposierte Koordinaten via evaluierter
# Kopie mit deaktivierten Modifiern holen (evco-Muster aus mpfb_build_base4).
_vis = [(m_, m_.show_viewport) for m_ in body.modifiers]
for m_, _ in _vis:
    m_.show_viewport = False
_dg = bpy.context.evaluated_depsgraph_get()
evco = [v.co.copy() for v in body.evaluated_get(_dg).data.vertices]
for m_, st_ in _vis:
    m_.show_viewport = st_
# Obergrenze 1.44: bei 1.50 landeten KINN-Verts im Netz -> gruener Bart-Kragen
for v in me.vertices:
    co = evco[v.index]
    if v.index in body_w and 0.88 < co.z < 1.44 and abs(co.x) < 0.42:
        tun[v.index] = 1.0
vg = body.vertex_groups.new(name="z_tunic")
tun_set = set()
for vi, w in tun.items():
    if vi in body_w and w > 0.02:   # Achsel-Verts tragen nur Mini-Restgewichte
        vg.add([vi], 1.0, 'REPLACE')
        tun_set.add(vi)
# GARANTIE gegen Haut-Pünktchen: Koerper-Faces unter der Tunika werden GRUEN
# eingefaerbt („Unterhemd") — einzelne Verts entziehen sich jedem Netz, aber
# ein Loch in der Tunika-Schale kann so nur noch Gruen zeigen
body.data.materials.append(GREEN)
green_idx = len(body.data.materials) - 1
# POSITIONS-basiert (nicht ueber tun_set): die Achselfalten-Faces, deren
# Displace-Normale kippt und Haut VOR die Tunika stuelpt, fehlen in jeder
# Gewichts-Menge — das Rest-Koordinaten-Band erwischt sie alle
for poly in body.data.polygons:
    za = sum(evco[v_].z for v_ in poly.vertices) / len(poly.vertices)
    xa = sum(abs(evco[v_].x) for v_ in poly.vertices) / len(poly.vertices)
    if 0.86 < za < 1.44 and xa < 0.45:
        poly.material_index = green_idx

# === BART OEFFNEN (2026-07-05): Kinnbart unten voll, zu den Mundwinkeln hin
# offen — kein geschlossener dunkler Ring um den Mund. Neue Maske: nur
# z_beard-Verts UNTERHALB der Lippen (gemorphte Koordinaten!)
_bw = weights_of("z_beard")
_lips0 = sorted(evco[vi].z for vi in weights_of("lips") if vi in body_w)
# SCHNAUZER KOMPLETT WEG (2026-07-06): Schnitt unterhalb der UNTERLIPPE
# (15. Perzentil), nicht am Median — der liess einen Schnauzer-Balken stehen
lz0 = _lips0[int(0.15 * (len(_lips0) - 1))] - 0.008
beard_o = bpy.data.objects.get("Beard")
if beard_o and _bw:
    vg_b2 = beard_o.vertex_groups.new(name="z_beard2")
    kept = 0
    for vi in _bw:
        if evco[vi].z < lz0:
            vg_b2.add([vi], 1.0, 'REPLACE')
            kept += 1
    beard_o.modifiers["mask"].vertex_group = "z_beard2"
    print("DEBUG beard2:", kept, "von", len(_bw), "Verts, Schnitt z", round(lz0, 3))

tun_o = body.copy()
tun_o.data = body.data.copy()
tun_o.name = "Tunic"
bpy.context.collection.objects.link(tun_o)
tun_o.data.materials.clear()
tun_o.data.materials.append(GREEN)
for mod in list(tun_o.modifiers):
    if mod.type != 'ARMATURE':
        tun_o.modifiers.remove(mod)
mk = tun_o.modifiers.new("mask", 'MASK'); mk.vertex_group = "z_tunic"; mk.threshold = 0.3
dp = tun_o.modifiers.new("off", 'DISPLACE'); dp.strength = 0.019; dp.mid_level = 0
so = tun_o.modifiers.new("solid", 'SOLIDIFY'); so.thickness = 0.024; so.offset = 1
ss = tun_o.modifiers.new("ss", 'SUBSURF'); ss.levels = 1; ss.render_levels = 1
tun_o.parent = arm
tun_o.hide_render = False


def rod(p1, p2, r, material, name="rod", verts=16):
    a = Vector(p1); b = Vector(p2); mid = (a + b) / 2; d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def sphere(name, center, r, material, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=r,
                                         location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
        bpy.ops.object.transform_apply(scale=True)
    # Position NACH dem Apply setzen: transform_apply konnte die im Operator
    # gesetzte location wegbacken -> Objekt landete im Weltursprung
    o.location = Vector(center)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def cone_at(pos, ddir, r, h, material, name="c"):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=0.002, depth=h,
                                    location=Vector(pos) + Vector(ddir) * (h / 2))
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector(ddir)).to_euler()
    o.data.materials.append(material)
    return o


def obox(name, center, size, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = rot
    o.location = center
    o.data.materials.append(material)
    return o


# === KAPUZE + GUERTEL + ROCK ===================================================
npt = bone_point("neck01", 0.0)
hood = sphere("kapuze", (npt.x, npt.y - 0.17, npt.z - 0.01), 0.16, GREEN_D,
              scale=(1.5, 0.7, 0.9))
hip = bone_point("root", 0.0)
belt_r = body_radius_at(hip.z + 0.02, xlim=0.28) + 0.035
# Guertel OBERHALB der Rock-Oberkante, sonst verschluckt der Rock den Guertel
bpy.ops.mesh.primitive_torus_add(major_radius=belt_r, minor_radius=0.030,
                                 location=(0, 0, hip.z + 0.045))
belt = bpy.context.active_object
belt.name = "guertel"
bpy.ops.object.shade_smooth()
belt.data.materials.append(LEATH)
obox("schnalle", (0, belt_r + 0.012, hip.z + 0.045), (0.07, 0.03, 0.09), GOLD)
# Chibi-ROCK: einfacher Kegelstumpf — geschlossene Form, aus JEDER Ansicht
# sichtbar (der Kilt-Klon wurde in der Rueckansicht zur nackten Haut)
# Oberkante HOCH unter den Guertel + weiter: der Po drueckte hinten durch
skirt_top = hip.z + 0.05
skirt_len = 0.28
bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=belt_r + 0.04,
                                radius2=belt_r + 0.01, depth=skirt_len,
                                location=(0, 0, skirt_top - skirt_len / 2))
skirt = bpy.context.active_object
skirt.name = "rock"
bpy.ops.object.shade_smooth()
skirt.data.materials.append(GREEN_D)

# === STIRNBAND (Torus, UEBER den Brauen) =======================================
# Gesichts-Stapel ohne Luecken: Augen -> Brauen (0.10 hh) -> Band (0.19 hh)
# -> Haartolle (ab 0.27 hh) -> Kappe. Vorher klaffte Stirnhaut dazwischen.
eye_z = bone_point("eye.L", 0.0).z
band_z = eye_z + 0.19 * head_h
band_r = 0.46 * head_h + 0.02
hb = bone_point("head", 0.4)
cx, cy = 0.0, hb.y
print("DEBUG band_z", round(band_z, 3), "eye_z", round(eye_z, 3), "band_r", round(band_r, 3))
bpy.ops.mesh.primitive_torus_add(major_radius=band_r, minor_radius=0.044,
                                 location=(cx, cy + 0.02, band_z))
sb = bpy.context.active_object
sb.name = "stirnband"
bpy.ops.object.shade_smooth()
sb.data.materials.append(GREEN)
sphere("bandknoten", (0, cy + band_r * 1.05, band_z), 0.038, GOLD)

# === POSIERTE KOORDINATEN einmal zentral kopieren (dangling-pointer-sicher) ===
_vis2 = [(m_, m_.show_viewport) for m_ in body.modifiers]
for m_, _ in _vis2:
    if m_.type != 'ARMATURE':
        m_.show_viewport = False
_dg2 = bpy.context.evaluated_depsgraph_get()
_pv = body.evaluated_get(_dg2).data.vertices
pw = {vi: (body.matrix_world @ _pv[vi].co).copy() for vi in body_w}
for m_, st_ in _vis2:
    m_.show_viewport = st_
_lidx = [vi for vi in weights_of("lips") if vi in body_w]
_lco = sorted((pw[vi] for vi in _lidx), key=lambda c: c.z)
lz = _lco[len(_lco) // 2].z
_ys = sorted(c.y for c in _lco)
ly = _ys[int(0.9 * (len(_ys) - 1))]
print("DEBUG lips z", round(lz, 3), "y", round(ly, 3))

# === CARTOON-GESICHT (ART_STYLE 2.4) ===========================================
eL = bone_point("eye.L", 0.0)
eR = bone_point("eye.R", 0.0)
sc_r = 0.155 * head_h            # APPEAL: groessere, ausdrucksstarke Augen
for e, sgn in ((eL, 1), (eR, -1)):
    # grosse einfache Augen: WEIT VOR die Gesichtsflaeche (beim 3.7x-Kopf
    # woelbt sich das Gesicht weiter vor als gedacht -> Augen steckten drin)
    sphere("sklera", (e.x, e.y + 0.045, e.z), sc_r, WHITE, scale=(1.0, 0.70, 1.25))
    sphere("iris", (e.x, e.y + 0.045 + sc_r * 0.55, e.z - sc_r * 0.02),
           sc_r * 0.62, IRISM, scale=(1.0, 0.6, 1.0))
    sphere("glanz", (e.x + sgn * sc_r * 0.20, e.y + 0.045 + sc_r * 0.78, e.z + sc_r * 0.34),
           sc_r * 0.19, WHITE)
    # FREUNDLICH: Brauen hoeher ueber die Augen (Abstand = freundlich/offen)
    # und aussen abgesenkt (sanfter Bogen statt grimmiger Geraden)
    # BRAUEN-BOGEN aus Segmenten: Kugel-Brauen wurden vom schraegen Stirnwulst
    # zu Strichen Richtung Nase beschnitten (= grimmig im puren Render).
    # Ein expliziter Regenbogen-Bogen liest sich immer freundlich.
    # WEIT VOR die Stirn (frei schwebend wie bei Cartoon-Figuren ueblich):
    # bei y+0.052 schluckte der Stirnwulst die aeusseren Segmente -> wieder
    # schraege Reststriche. Dicker + ganz freigestellt = immer lesbar.
    br_r2 = 0.115 * head_h
    bz = e.z + 0.15 * head_h
    prev_b = None
    for i in range(5):
        xx = -br_r2 + i * (2 * br_r2 / 4)
        zz = bz + 0.06 * head_h * (1 - (xx / br_r2) ** 2)
        p = (e.x + xx, e.y + 0.082, zz)
        if prev_b:
            rod(prev_b, p, 0.042 * head_h, HAIRC, "braue", verts=10)
        prev_b = p
# HAAR-Tolle bleibt als Pony; die Kopfbedeckung je Variante ersetzt die Kappe
# (loest zugleich die Halbglatzen-Optik — Scalp ist komplett bedeckt)
sphere("haartolle", (0, eL.y + 0.0, eye_z + 0.31 * head_h),
       0.38 * head_h, HAIRC, scale=(1.25, 0.55, 0.35))
STEEL = mat("steel", COL_STEEL, rough=0.58, metal=0.75, spec=0.3)  # matt, kein Chrom
if variant == "a":
    # EISENHUT nach Fraktionsblatt-Bogenschuetze: Stahlkuppel + Krempe + Goldknauf
    # TIEF genug: die Krempe muss die Tolle-Oberkante beruehren (Halbglatzen-Verbot)
    hz = eye_z + 0.27 * head_h
    # z-Skala 0.95: bei 0.80 stach der Schaedel-Scheitel oben durch die Kuppel
    sphere("helmkuppel", (0, hb.y + 0.01, hz), 0.60 * head_h, STEEL,
           scale=(1.03, 1.03, 0.95))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.58 * head_h, minor_radius=0.055 * head_h,
                                     location=(0, hb.y + 0.02, hz + 0.06 * head_h),
                                     rotation=(math.radians(-9), 0, 0))
    kr = bpy.context.active_object
    kr.name = "helmkrempe"
    bpy.ops.object.shade_smooth()
    kr.data.materials.append(STEEL)
    sphere("helmknauf", (0, hb.y + 0.01, hz + 0.48 * head_h), 0.07 * head_h, GOLD)
else:
    # ECHTE KAPUZE in Koenigsblau: Haube + Zipfel + KRAGEN. Groesse wird
    # AUTOMATISCH gewaehlt: kleinste Skalierung, bei der KEIN Kopfhaut-Vert
    # (pw, oberhalb band_z+0.05) aus dem Ellipsoid ragt (Assert unten prueft)
    # Kapuzen-Ellipsoid-Faktoren: breiter (X) + flacher (Z) = rundere Silhouette
    # statt hoch-eifoermig. hz tiefer, damit die Haube nicht ueber den Schaedel
    # hinaus nach oben aussticht ("laeuft oben zu hoch/spitz aus").
    KAP_FX, KAP_FY, KAP_FZ = 1.10, 1.00, 0.95
    hz = eye_z + 0.23 * head_h
    hood_cx, hood_cy = 0.0, hb.y - 0.005
    hood_s = None
    for _s in (1.0, 1.04, 1.08, 1.12, 1.16, 1.20, 1.24, 1.28):
        r3 = (0.62 * head_h * KAP_FX * _s, 0.62 * head_h * KAP_FY * _s,
              0.62 * head_h * KAP_FZ * _s)
        bad = sum(1 for w in pw.values() if w.z > band_z + 0.05 and
                  ((w.x - hood_cx) / r3[0]) ** 2 + ((w.y - hood_cy) / r3[1]) ** 2 +
                  ((w.z - hz) / r3[2]) ** 2 > 1.0)
        if bad == 0:
            hood_s = _s
            break
    assert hood_s is not None, "Kapuze deckt Kopf selbst bei 1.20x nicht!"
    print("ASSERT Kapuzengroesse:", hood_s)
    hrx = 0.62 * head_h * KAP_FX * hood_s
    hry = 0.62 * head_h * KAP_FY * hood_s
    sphere("kapuzenhaube", (hood_cx, hood_cy, hz), 0.62 * head_h * hood_s, GREEN_D,
           scale=(KAP_FX, KAP_FY, KAP_FZ))
    cone_at((0, hood_cy - hry * 0.75, hz + 0.24 * head_h),
            Vector((0, -0.55, -0.84)).normalized(), 0.16 * head_h, 0.42 * head_h,
            GREEN_D, "kapuzenzipfel_b")
    ncl = bone_point("neck01", 0.0)
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.36, radius2=0.16,
                                    depth=0.24, location=(0, ncl.y - 0.015, ncl.z - 0.075))
    krg = bpy.context.active_object
    krg.name = "kapuzenkragen"
    bpy.ops.object.shade_smooth()
    krg.data.materials.append(GREEN_D)
    # GERADE FEDER (2026-07-06): flaches, verjuengtes Blatt, Basis AN der Haube,
    # Achse schraeg nach hinten-oben — mit ASSERTS abgesichert
    hood_c = Vector((hood_cx, hood_cy, hz))
    hood_r3 = (hrx, hry, 0.62 * head_h * KAP_FZ * hood_s)
    phi_f = math.radians(55)
    fbase = Vector((hood_cx + math.sin(phi_f) * hood_r3[0] * 0.98,
                    hood_cy + math.cos(phi_f) * hood_r3[1] * 0.98,
                    hz + 0.14 * head_h))
    fdir = Vector((0.28, -0.82, 0.50)).normalized()
    # ASSERT 1: Feder liegt an der Haube an (Basis nahe Ellipsoid-Oberflaeche)
    nd = math.sqrt(((fbase.x - hood_c.x) / hood_r3[0]) ** 2 +
                   ((fbase.y - hood_c.y) / hood_r3[1]) ** 2 +
                   ((fbase.z - hood_c.z) / hood_r3[2]) ** 2)
    assert 0.90 < nd < 1.10, f"Feder-Basis nicht an der Haube (nd={nd:.2f})"
    # ASSERT 2: nicht senkrecht (Antenne!) und Spitze nach HINTEN
    assert math.degrees(math.acos(fdir.z)) > 45, "Feder steht zu senkrecht"
    assert fdir.y < 0, "Feder-Spitze zeigt nicht nach hinten"
    # Blatt als STRIP-Mesh: Breitenrichtung fest in der x-z-BILDEBENE, sonst
    # liest sich jede Kegel-Abflachung von vorn wieder als Nadel/Antenne
    wvec = fdir.cross(Vector((0, 1, 0))).normalized()
    import bmesh as _bmf
    fm = bpy.data.meshes.new("federblatt")
    fb_ = _bmf.new()
    flen_ = 0.72 * head_h
    fverts_a, fverts_b = [], []
    for i in range(9):
        t = i / 8
        p = fbase + fdir * (flen_ * t)
        hwid = (0.085 * head_h) * (1.0 - 0.85 * t) + 0.006
        fverts_a.append(fb_.verts.new(p + wvec * hwid))
        fverts_b.append(fb_.verts.new(p - wvec * hwid))
    for i in range(8):
        fb_.faces.new((fverts_b[i], fverts_b[i + 1], fverts_a[i + 1], fverts_a[i]))
    fb_.to_mesh(fm)
    fb_.free()
    fe = bpy.data.objects.new("feder", fm)
    bpy.context.collection.objects.link(fe)
    fe.data.materials.append(GOLD)
    fsol = fe.modifiers.new("solid", 'SOLIDIFY')
    fsol.thickness = 0.012
    sphere("federkiel", fbase - fdir * 0.01, 0.05 * head_h, GOLD)
    print("ASSERT Feder ok: nd", round(nd, 3), "winkel",
          round(math.degrees(math.acos(fdir.z)), 1))
# === MUND ALS 2D-DECAL (2026-07-06, finale Bauweise nach 3 Geometrie-Versuchen)
# Regel: KEINE Mund-Geometrie. Gesicht unter der Nase glatt (lips-Smooth),
# Mund = flache Kurve, per Shrinkwrap auf die Gesichtsflaeche gelegt.
# Der offene ATTACK-Mund wird SPAETER EBENFALLS ALS DECAL gebaut
# (dunkle Ellipse per Shrinkwrap) — NICHT als Geometrie!
# (pw/lz/ly werden zentral nach dem Stirnband-Block gemessen)
lgrp = body.vertex_groups.new(name="z_lipflat")
for vi in _lidx:
    lgrp.add([vi], 1.0, 'REPLACE')
smd = body.modifiers.new("lipflat", 'SMOOTH')
smd.vertex_group = "z_lipflat"
smd.factor = 1.0
smd.iterations = 60

if mouth == "closed":
    # Bezugspunkte: Nasenspitze = vorderster Face-Vert zwischen Lippen und Augen
    nose_z, nose_ymax = lz, -9
    chin_z = 9
    for vi, w in pw.items():
        if lz - 0.01 < w.z < eye_z - 0.02 and abs(w.x) < 0.10 and w.y > nose_ymax:
            nose_ymax = w.y
            nose_z = w.z
    # Kinn = tiefster Vert der GESICHTS-Mittellinie. Drei Filter noetig:
    # |x|<0.12 (Zentrum), y>0.50 (Front), z>0.78 (ueber Brust/Bauch — die
    # woelben sich beim Chibi bis y~0.55 vor und kaperten sonst die Messung)
    for w in pw.values():
        if abs(w.x) < 0.12 and w.y > 0.50 and w.z > 0.78:
            chin_z = min(chin_z, w.z)
    mund_z = (nose_z + chin_z) / 2               # mittig Nasenspitze<->Kinn
    # Gesichtsbreite auf AUGEN-Hoehe messen (Mundhoehen-Slice traf die Schultern!)
    fw = max(abs(w.x) for w in pw.values()
             if abs(w.z - (eye_z - 0.02)) < 0.02 and w.y > 0.05)
    line_w = 0.35 * (2 * fw)                     # 35% der Gesichtsbreite
    stroke = 0.025 * head_h                      # 2-3% der Kopfhoehe
    print("DEBUG decal: nase_z", round(nose_z, 3), "kinn_z", round(chin_z, 3),
          "mund_z", round(mund_z, 3), "gesicht_b", round(2 * fw, 3))
    import bmesh as _bmd
    dm = bpy.data.meshes.new("munddecal")
    db = _bmd.new()
    nseg_m = 24
    top, bot = [], []
    for i in range(nseg_m + 1):
        xn = -1.0 + 2.0 * i / nseg_m
        xx = xn * line_w / 2
        zz = mund_z + 0.035 * head_h * xn ** 2   # Enden leicht nach OBEN
        top.append(db.verts.new((xx, ly + 0.15, zz + stroke / 2)))
        bot.append(db.verts.new((xx, ly + 0.15, zz - stroke / 2)))
    for i in range(nseg_m):
        db.faces.new((bot[i], bot[i + 1], top[i + 1], top[i]))
    db.to_mesh(dm)
    db.free()
    decal = bpy.data.objects.new("MundDecal", dm)
    bpy.context.collection.objects.link(decal)
    decal.data.materials.append(LINE)
    sw = decal.modifiers.new("wrap", 'SHRINKWRAP')
    sw.target = body
    sw.wrap_method = 'PROJECT'
    sw.use_project_y = True
    sw.use_negative_direction = True
    sw.offset = 0.014   # 0.006 tauchte in die geglaettete Lippen-Delle (heller Kern)
# mouth == "open": echte Lippen — NUR fuer Zwischen-Checks; die Attack-Pose
# bekommt spaeter ein Ellipsen-DECAL (siehe Regel oben)

# === KAPUZEN-ASSERT (Variante b): KEINE sichtbare Kopfhaut ueber dem Band =====
if variant != "a":
    offen = 0
    for vi, w in pw.items():
        if w.z > band_z + 0.05:
            ndh = math.sqrt(((w.x - hood_c.x) / (hood_r3[0] + 0.01)) ** 2 +
                            ((w.y - hood_c.y) / (hood_r3[1] + 0.01)) ** 2 +
                            ((w.z - hood_c.z) / (hood_r3[2] + 0.01)) ** 2)
            if ndh > 1.0:
                offen += 1
    print("ASSERT Kapuze: offene Kopfhaut-Verts =", offen)
    assert offen == 0, f"Kapuze offen: {offen} Kopfhaut-Verts ragen heraus!"

# === FAEUSTLINGE ===============================================================
# Kleinere, kompaktere Faust (vorher r=0.075 kugelig = Ballon-Hand): Radius
# runter, in Griffrichtung (y) leicht gelaengt und oben/unten (z) abgeflacht,
# damit die Form wie eine Faust liest und zum verjuengten Unterarm passt.
for side in ("R", "L"):
    mp = bone_point(f"wrist.{side}", 1.24)
    sphere(f"mitt_{side}", mp, 0.062, SKIN, scale=(1.28, 1.30, 0.86))

# === STIEFEL: einfache braune Formen (Kugel-Fuss + Schaft), Masse aus der
# KNOCHENLAENGE abgeleitet (feste Radien waren beim Chibi-Fuss unsichtbar klein)
for side in ("R", "L"):
    heel = bone_point(f"foot.{side}", 0.0)
    toe = bone_point(f"foot.{side}", 1.15)
    fmid = (heel + toe) / 2
    flen = (toe - heel).length
    # KLOBIG genug, dass auch der FUSSRUECKEN drin steckt (Chibi-Fuss ist ~0.2
    # hoch; kleinere Kugeln lugten nur unterm Spann hervor = nackte Zehen von oben)
    br_ = max(0.15, flen * 0.95)
    print(f"DEBUG boot {side} heel", tuple(round(v, 3) for v in heel),
          "toe", tuple(round(v, 3) for v in toe), "flen", round(flen, 3), "br", round(br_, 3))
    sphere(f"boot_{side}", (fmid.x, fmid.y + 0.03, 0.115), br_, LEATH,
           scale=(1.0, 1.6, 0.80))
    rod((heel.x, heel.y - 0.01, 0.05), (heel.x, heel.y - 0.01, 0.26),
        0.105, LEATH, f"bootschaft_{side}", verts=14)

# === KOECHER (hinten LINKS, goldene Spitzen) ===================================
qb = bone_point("root", 0.0) + Vector((-0.06, -0.16, 0.14))
qdir = Vector((-0.30, -0.10, 0.95)).normalized()
qlen = 0.16
rod(qb - qdir * qlen, qb + qdir * qlen, 0.055, LEATH_D, "koecher", verts=18)
rod(qb + qdir * (qlen - 0.02), qb + qdir * (qlen + 0.02), 0.060, LEATH, "koecherrand", verts=18)
qs1 = qdir.cross(Vector((0, 0, 1))).normalized()
qs2 = qdir.cross(qs1).normalized()
for k in range(3):
    phi = math.radians(k * 120 + 40)
    off = (qs1 * math.cos(phi) + qs2 * math.sin(phi)) * 0.024
    top = qb + qdir * (qlen + 0.01) + off
    rod(top, top + qdir * 0.07, 0.007, WOOD, "koecherpfeil", verts=6)
    cone_at(top + qdir * 0.07, qdir, 0.016, 0.045, GOLD, "pfeilspitze_gold")

# === BOGEN (>=60% Koerperhoehe) + SICHTBARE SEHNE ==============================
lhand = bone_point("wrist.L", 1.30)
bow_half = 0.34 * T
bdirs = Vector((0, 0, 1))
# Wurfarme diagonal nach hinten-aussen biegen: dadurch liegen Stab und Sehne
# aus JEDER Ansicht sichtbar auseinander (vorher: Sehne exakt hinter dem Stab)
bulge = Vector((-0.55, -0.55, 0)).normalized() * 0.085
npts = 11
pts = []
for i in range(npts):
    t = -1.0 + 2.0 * i / (npts - 1)
    pts.append(lhand + bdirs * (bow_half * t) + bulge * (abs(t) ** 1.6))
for i in range(npts - 1):
    tt = abs(-1.0 + 2.0 * i / (npts - 1))
    rod(pts[i], pts[i + 1], 0.030 * (1.0 - 0.35 * tt), WOOD, "bogenarm", verts=10)
rod(lhand - bdirs * 0.09, lhand + bdirs * 0.09, 0.036, LEATH_D, "bogengriff", verts=12)
for tip in (pts[0], pts[-1]):
    tdir = (tip - lhand).normalized()
    cone_at(tip, tdir, 0.020, 0.06, GOLD, "bogentip")
rod(pts[0], pts[-1], 0.008, mat("sehne", (0.05, 0.05, 0.05)), "sehne", verts=8)

# === TOON-VARIANTE: Toon-BSDF + Freestyle ======================================
if style == "toon":
    for m in bpy.data.materials:
        if not m.use_nodes or m.node_tree is None:
            continue                     # z.B. MPFB-Alt-Material ohne Nodes
        b = m.node_tree.nodes.get("Principled BSDF")
        base = tuple(b.inputs["Base Color"].default_value)[:3] if b else (0.5, 0.5, 0.5)
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        toon = nt.nodes.new("ShaderNodeBsdfToon")
        toon.component = 'DIFFUSE'
        toon.inputs["Color"].default_value = (*base, 1)
        toon.inputs["Size"].default_value = 0.95
        toon.inputs["Smooth"].default_value = 0.05
        nt.links.new(toon.outputs["BSDF"], out.inputs["Surface"])

for _o in bpy.data.objects:
    if "boot" in _o.name.lower():
        print("OBJ", _o.name, "loc", tuple(round(v, 3) for v in _o.location),
              "dim", tuple(round(v, 3) for v in _o.dimensions),
              "hide", _o.hide_render,
              "mat", _o.data.materials[0].name if _o.data.materials else None)

# === KAMERA / LICHT / RENDER ===================================================
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam_data.ortho_scale = T * 1.22
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

if style == "toon":
    # EIN hartes Key-Licht -> saubere 2-Stufen-Baender im Toon-BSDF
    key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.0; key.angle = math.radians(2)
    ko = bpy.data.objects.new("key", key); ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
    bpy.context.collection.objects.link(ko)
    wstrength = 0.35
else:
    # APPEAL-Licht: weiches Hauptlicht + Area-GLANZPUNKT (satte Farben, Pop)
    key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(40)
    ko = bpy.data.objects.new("key", key); ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
    bpy.context.collection.objects.link(ko)
    fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
    fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200))
    bpy.context.collection.objects.link(fo)
    spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 38; spec.size = 1.6
    so_ = bpy.data.objects.new("spec", spec)
    so_.location = (0.9, 2.2, 2.4)
    so_.rotation_euler = (Vector((0, 0, 1.1)) - so_.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(so_)
    wstrength = 0.55
world = bpy.data.worlds.new("W"); world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = wstrength
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
    print('CYCLES-GPU aktiv:', cprefs.compute_device_type)
except Exception as e:
    print('GPU-Setup fehlgeschlagen, CPU-Fallback:', e)
sc.cycles.samples = {"check": 48, "mini": 24}.get(stage, 128)
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = {"check": 560, "mini": 320}.get(stage, 768)
sc.view_settings.view_transform = 'Standard'

if style == "toon":
    # Dicke Outlines (ART_STYLE 2.3): dunkles Braun, kein reines Schwarz
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = 'ABSOLUTE'
    sc.render.line_thickness = 2.6
    vl = bpy.context.view_layer
    vl.use_freestyle = True
    ls = vl.freestyle_settings.linesets.new("outline")
    ls.linestyle.color = (0.16, 0.10, 0.06)
    ls.linestyle.thickness = 2.6

el = math.radians(60)
d = 24.0
target = Vector((0, 0, T * 0.46))

if stage == "ray":
    # Diagnose: Ray durch das Fleck-Pixel der 3/4-Ansicht -> welches Objekt?
    az = math.radians(315)
    cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                    d * math.sin(el) * math.cos(az),
                                    d * math.cos(el)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    cm3 = cam.matrix_world.to_3x3()
    right = cm3 @ Vector((1, 0, 0))
    upv = cm3 @ Vector((0, 1, 0))
    fwd = cm3 @ Vector((0, 0, -1))
    ow = cam_data.ortho_scale
    for px, py in ((437, 527), (445, 520), (430, 535)):
        u = px / 768 - 0.5
        v = 0.5 - py / 768
        origin = cam.location + right * (u * ow) + upv * (v * ow)
        dg9 = bpy.context.evaluated_depsgraph_get()
        hit, loc, nrm, idx, obj, mw = bpy.context.scene.ray_cast(dg9, origin, fwd)
        print("RAYHIT", (px, py), hit, obj.name if obj else None,
              tuple(round(x, 3) for x in loc))
    sys.exit(0)
VIEWS = [("front", 0)] if stage in ("check", "mini") else [
    ("front", 0), ("threequarter", 315), ("side", 270), ("back", 180)]
for vname, az_deg in VIEWS:
    az = math.radians(az_deg)
    cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                    d * math.sin(el) * math.cos(az),
                                    d * math.cos(el)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(outdir, f"sheet_archer_{vname}_{style}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)

# === GESICHTS-CHECK (QA-Erweiterung 2026-07-06): bei JEDEM Kopf-Render wird
# zusaetzlich eine frontale Nahaufnahme ausgegeben — Mundpartie direkt pruefbar
cam_data.ortho_scale = 1.9 * head_h
targetf = Vector((0, 0.1, eye_z - 0.07 * head_h))
azf = 0.0
cam.location = targetf + Vector((d * math.sin(el) * math.sin(azf),
                                 d * math.sin(el) * math.cos(azf),
                                 d * math.cos(el)))
cam.rotation_euler = (targetf - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.render.resolution_x = sc.render.resolution_y = 560
sc.cycles.samples = 48
sc.render.filepath = os.path.join(outdir, f"sheet_archer_FACE_{style}.png")
bpy.ops.render.render(write_still=True)
print("RENDERED FACE-CHECK", sc.render.filepath)
print("DONE T=", round(T, 3))
