"""Basis v4 — HEROISCHE Proportionen fuer den Barbaren-Krieger.
Recherche: Helden = Schultern 2-2.5 Kopfbreiten + KLEINERER Kopf (Kind-Optik ist
das Gegenteil); CoC Barbarian King = Muttonchops, massiver Guertel, Riesenschwert.
Hebel hier: MakeHuman-Targets (Muskeln/Kiefer) + KNOCHEN-SKALIERUNG (Kopf 0.85,
Schultern 1.3, Arme 1.45-1.55, Hals 1.35, grosse Faeuste, dicke Beine)."""
import bpy, os, math, glob
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

DATA = os.path.join(os.environ["APPDATA"], "Blender Foundation", "Blender", "4.2",
                    "extensions", ".user", "user_default", "mpfb", "data")
MPFB_T = os.path.join(os.environ["APPDATA"], "Blender Foundation", "Blender", "4.2",
                      "extensions", "user_default", "mpfb", "data", "targets")

macro = TargetService.get_default_macro_info_dict()
macro.update({"gender": 1.0, "age": 0.52, "muscle": 1.0, "weight": 0.62,
              "height": 0.68, "proportions": 0.9,
              "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}})
bm = HumanService.create_human(macro_detail_dict=macro)


def tgt(rel, w):
    for h in glob.glob(os.path.join(MPFB_T, rel)):
        try:
            TargetService.load_target(bm, h, weight=w)
        except Exception as e:
            print("TARGET FAIL", rel, e)


tgt(os.path.join("arms", "*upperarm-muscle-incr*"), 1.0)
tgt(os.path.join("arms", "*lowerarm-muscle-incr*"), 1.0)
tgt(os.path.join("legs", "*upperleg-muscle-incr*"), 0.9)
tgt(os.path.join("legs", "*lowerleg-muscle-incr*"), 0.8)
tgt(os.path.join("torso", "measure-shoulder-dist-incr*"), 1.0)
tgt(os.path.join("torso", "measure-frontchest-dist-incr*"), 0.8)
tgt(os.path.join("neck", "*circ-incr*"), 0.8)
tgt(os.path.join("chin", "chin-bones-incr*"), 0.7)
tgt(os.path.join("chin", "chin-prominent-incr*"), 0.5)

HumanService.set_character_skin(
    os.path.join(DATA, "skins", "middleage_caucasian_male", "middleage_caucasian_male.mhmat"),
    bm, skin_type="ENHANCED_SSS")
rig = HumanService.add_builtin_rig(bm, "default")
for asset, atype, mtype in (
        ("eyes/high-poly/high-poly.mhclo", "Eyes", "PROCEDURAL_EYES"),
        ("eyebrows/eyebrow010/eyebrow010.mhclo", "Eyebrows", "MAKESKIN"),
        ("hair/short02/short02.mhclo", "Hair", "MAKESKIN"),
        ("teeth/teeth_base/teeth_base.mhclo", "Teeth", "MAKESKIN")):
    HumanService.add_mhclo_asset(os.path.join(DATA, *asset.split("/")), bm,
                                 asset_type=atype, material_type=mtype)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.rotation_euler = (0, 0, math.radians(180))

# === HEROISCHE PROPORTIONEN via Knochen-Skalierung =============================
NO_INHERIT = ["upperarm01.L", "upperarm01.R", "upperarm02.L", "upperarm02.R",
              "lowerarm01.L", "lowerarm01.R", "lowerarm02.L", "lowerarm02.R",
              "wrist.L", "wrist.R", "neck02", "neck03", "head",
              "upperleg02.L", "upperleg02.R", "lowerleg01.L", "lowerleg01.R",
              "lowerleg02.L", "lowerleg02.R", "foot.L", "foot.R"]
for bn in NO_INHERIT:
    arm.data.bones[bn].inherit_scale = 'NONE'

SCALES = {
    "clavicle.L": (1.0, 1.30, 1.0), "clavicle.R": (1.0, 1.30, 1.0),
    "upperarm01.L": (1.45, 1.0, 1.45), "upperarm01.R": (1.45, 1.0, 1.45),
    "upperarm02.L": (1.45, 1.0, 1.45), "upperarm02.R": (1.45, 1.0, 1.45),
    "lowerarm01.L": (1.55, 1.0, 1.55), "lowerarm01.R": (1.55, 1.0, 1.55),
    "lowerarm02.L": (1.55, 1.0, 1.55), "lowerarm02.R": (1.55, 1.0, 1.55),
    "wrist.L": (1.2, 1.1, 1.2), "wrist.R": (1.2, 1.1, 1.2),
    "neck01": (1.35, 1.0, 1.35), "neck02": (1.35, 1.0, 1.35), "neck03": (1.35, 1.0, 1.35),
    "head": (0.85, 0.85, 0.85),
    "upperleg01.L": (1.28, 1.0, 1.28), "upperleg01.R": (1.28, 1.0, 1.28),
    "upperleg02.L": (1.28, 1.0, 1.28), "upperleg02.R": (1.28, 1.0, 1.28),
    "lowerleg01.L": (1.32, 1.0, 1.32), "lowerleg01.R": (1.32, 1.0, 1.32),
    "lowerleg02.L": (1.32, 1.0, 1.32), "lowerleg02.R": (1.32, 1.0, 1.32),
    "foot.L": (1.08, 1.05, 1.05), "foot.R": (1.08, 1.05, 1.05),
    "spine03": (1.10, 1.0, 1.06),
}
for bn, s in SCALES.items():
    arm.pose.bones[bn].scale = s

# === Vertex-Gruppen fuer Koerper-Klone =========================================
me = bm.data
gidx = {g.name: g.index for g in bm.vertex_groups}


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


def make_group(name, weight_dict):
    vg = bm.vertex_groups.new(name=name)
    for vi, w in weight_dict.items():
        vg.add([vi], min(w, 1.0), 'REPLACE')


body_w = weights_of("body")
jaw = weights_of("jaw")
lips = weights_of("lips")
# VOLLBART m. Schnurrbart + Koteletten
lips_z = [me.vertices[vi].co.z for vi in lips]
lz_mid = (min(lips_z) + max(lips_z)) / 2 if lips_z else 0
beard = {}
for vi, w in jaw.items():
    if w - 1.1 * lips.get(vi, 0) > 0.18:
        beard[vi] = 1.0
for vi, w in lips.items():
    if w > 0.25 and me.vertices[vi].co.z > lz_mid + 0.004:
        beard[vi] = 1.0
make_group("z_beard", {vi: w for vi, w in beard.items() if vi in body_w})

# Kriegsbemalung: Streifen unter den Augen.
# FALLE: me.vertices = UNGEMORPHTE Basis (Targets sind Shape-Keys!), Knochen
# leben im gemorphten Raum -> Mesh MIT Shape-Keys, aber OHNE Modifier auswerten.
vis_state = [(m, m.show_viewport) for m in bm.modifiers]
for m, _ in vis_state:
    m.show_viewport = False
dg = bpy.context.evaluated_depsgraph_get()
ev = bm.evaluated_get(dg)
evco = [v.co.copy() for v in ev.data.vertices]
for m, st in vis_state:
    m.show_viewport = st
eye_pos = arm.data.bones["eye.L"].head_local
ez = eye_pos.z
paint = {}
for vi, co in enumerate(evco):
    if vi not in body_w:
        continue
    if (ez - 0.044) < co.z < (ez - 0.018) and co.y < -0.02 and abs(co.x) < 0.10:
        paint[vi] = 1.0
print("PAINT verts:", len(paint))
make_group("z_paint", paint)

for side in ("R", "L"):
    br = {}
    for gn in ("lowerarm01." + side, "lowerarm02." + side):
        for vi, w in weights_of(gn).items():
            br[vi] = max(br.get(vi, 0), w)
    make_group("z_bracer_" + side, {vi: w for vi, w in br.items() if w > 0.5 and vi in body_w})
    bo = {}
    parts = ["foot." + side, "lowerleg02." + side]
    parts += [g.name for g in bm.vertex_groups if g.name.startswith("toe") and g.name.endswith("." + side)]
    for gn in parts:
        for vi, w in weights_of(gn).items():
            bo[vi] = max(bo.get(vi, 0), w)
    make_group("z_boot_" + side, {vi: w for vi, w in bo.items() if w > 0.35 and vi in body_w})

skirt = weights_of("helper-skirt")
make_group("z_kilt", {vi: 1.0 for vi in skirt if evco[vi].z > 0.89})


def clone(name, group, mat_rgb, rough, thickness, offset, metal=0.0, threshold=0.5):
    ob = bm.copy()
    ob.data = bm.data.copy()
    ob.name = name
    bpy.context.collection.objects.link(ob)
    ob.data.materials.clear()
    m = bpy.data.materials.new(name + "_mat")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*mat_rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    ob.data.materials.append(m)
    for mod in list(ob.modifiers):
        if mod.type != 'ARMATURE':
            ob.modifiers.remove(mod)
    mk = ob.modifiers.new("mask", 'MASK')
    mk.vertex_group = group
    mk.threshold = threshold
    dp = ob.modifiers.new("off", 'DISPLACE')
    dp.strength = offset
    dp.mid_level = 0
    so = ob.modifiers.new("solid", 'SOLIDIFY')
    so.thickness = thickness
    so.offset = 1
    ob.parent = arm
    return ob


bd_ = clone("Beard", "z_beard", (0.10, 0.065, 0.04), 0.95, 0.016, 0.004, threshold=0.28)
ss_ = bd_.modifiers.new("ss", 'SUBSURF'); ss_.levels = 2; ss_.render_levels = 2
sm_ = bd_.modifiers.new("sm", 'SMOOTH'); sm_.factor = 1.0; sm_.iterations = 6
pt_ = clone("Paint", "z_paint", (0.13, 0.22, 0.42), 0.85, 0.0015, 0.0008, threshold=0.4)
pss_ = pt_.modifiers.new("ss", 'SUBSURF'); pss_.levels = 1; pss_.render_levels = 1
psm_ = pt_.modifiers.new("sm", 'SMOOTH'); psm_.factor = 1.0; psm_.iterations = 4
clone("Bracer_R", "z_bracer_R", (0.30, 0.18, 0.09), 0.85, 0.012, 0.005)
clone("Bracer_L", "z_bracer_L", (0.30, 0.18, 0.09), 0.85, 0.012, 0.005)
clone("Boot_R", "z_boot_R", (0.16, 0.10, 0.055), 0.85, 0.012, 0.005, threshold=0.3)
clone("Boot_L", "z_boot_L", (0.16, 0.10, 0.055), 0.85, 0.012, 0.005, threshold=0.3)
clone("Kilt", "z_kilt", (0.48, 0.07, 0.06), 0.8, 0.010, 0.012, threshold=0.4)

print("BASE4:", [(o.name, o.type) for o in bpy.data.objects])
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Ufuk\vw_blender\tools\unit_base_male.blend")
print("SAVED v4")
