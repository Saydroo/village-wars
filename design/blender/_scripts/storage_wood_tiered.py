"""Menschen-Holzlager (storage_wood), parametrisch über LEVEL 1..15.
blender -b --python storage_wood_tiered.py -- <level> <out.png>

KONZEPT: große HOLZ-KRIPPE (Brennholz-Lager) — Stämme liegen quer mit den hellen
SCHNITTFLÄCHEN zur Kamera (das ikonische Brennholzstapel-Bild), gehalten von
Doppelpfosten mit Seitenlatten. Der FÜLLSTAND wächst sichtbar mit dem Level
(mehr Reihen = mehr gelagertes Holz). DESIGN-REGELN: L1 funktionstüchtig, jedes
Level sichtbar anders (kumulativ), nichts schwebt.
  L1  kleine Krippe, halb gefüllt, Hackklotz mit Beil
  L2  +voller (3 Reihen), +Beistapel
  L3  +Abdeckbretter oben, +2. Beistapel
  L4  T2: +PULTDACH auf verlängerten Pfosten, +Stein-Sockelfüße
  L5  +zweite kleine Krippe rechts
  L6  +Zaun, +beladene Schubkarre
  L7  T3: Groß-Ausbau — Krippe breiter/höher, SATTELDACH (blau), Eisen-Bänder
  L8  +Anbau-Schuppen mit Bretterstapel
  L9  +Banner, +3. Beistapel, Krippe voller
  L10 T4: Gold-First, +Marmor-Bodenplatte, Krippe randvoll
  L11 +Gold-Banderolen um Front-Stämme, +Tor-Rahmen zwischen den Krippen
  L12 +Gold-Kappen auf allen Pfosten, +massiver GOLD-STAMM in der Front
  L13 T5: violettes Dach, leuchtende Runen-Bänder an Pfosten, Kristall am First
  L14 +Runen-Obelisk am Eingang
  L15 +KRISTALL-Stämme in der Front, +Energie-Ader, +Dacheck-Kristalle
"""
import bpy, sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import lib_iso as L
from themes import THEMES, tier_for_level

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
level = max(1, min(15, int(argv[0]) if len(argv) >= 1 else 3))
tier = tier_for_level(level)
stage = (level - 1) % 3 + 1
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_stwood_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

M = {
    "wood":   L.mat("wood",   T["wood"],   rough=0.9),
    "wood_d": L.mat("wood_d", T["wood_d"], rough=0.9),
    "gold":   L.mat("gold",   (0.98, 0.78, 0.22), rough=0.3, metal=0.9),
    "roof":   L.mat("roof",   T["roof"],   rough=0.85),
    "grass":  L.mat("grass",  T["ground"], rough=1.0),
    "grass_d":L.mat("grass_d",T["ground_d"],rough=1.0),
    "dirt":   L.mat("dirt",   (0.42, 0.31, 0.19), rough=1.0),
    "dirt_l": L.mat("dirt_l", (0.52, 0.40, 0.26), rough=1.0),
    "moss":   L.mat("moss",   (0.34, 0.50, 0.20), rough=1.0),
    "iron":   L.mat("iron",   (0.74, 0.77, 0.82), rough=0.35, metal=0.85),
    "iron_d": L.mat("iron_d", (0.30, 0.32, 0.36), rough=0.5, metal=0.6),
    "bark":   L.mat("bark",   (0.34, 0.24, 0.14), rough=1.0),
    "bark_d": L.mat("bark_d", (0.26, 0.18, 0.10), rough=1.0),
    "cut":    L.mat("cut",    (0.82, 0.66, 0.42), rough=0.9),
    "plank":  L.mat("plank",  (0.72, 0.54, 0.32), rough=0.9),
    "stone":  L.mat("stone",  (0.55, 0.53, 0.50), rough=1.0),
    "marble": L.mat("marble", (0.85, 0.84, 0.81), rough=0.9),
    "cloth":  L.mat("cloth",  T["accent"], rough=0.9),
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=1.1),
    "rune_bar": L.mat("rune_bar", (0.45, 0.68, 0.9), rough=0.35, emis=0.15),
}
s = T["scale"]
z0 = 0.42


def strut(p1, p2, th, mat, name="strut"):
    a = Vector(p1); b = Vector(p2); mid = (a + b) / 2; d = b - a
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.scale = (th / 2, th / 2, d.length / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    o.data.materials.append(mat)
    return o


def rod(p1, p2, r, mat, name="rod", r2=None, verts=12):
    a = Vector(p1); b = Vector(p2); mid = (a + b) / 2; d = b - a
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(0, 0, 0))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    o.data.materials.append(mat)
    return o


def obox(name, center, size, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0]/2, size[1]/2, size[2]/2)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = rot
    o.location = center
    o.data.materials.append(mat)
    return o


# ---------------------------------------------------------------------------
# Grassockel + Hof
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, -1.7*s), (1.95*s, 1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)
L.box("yard", (0.0, 0.5, 0.405), (3.2, 2.2, 0.045), M["dirt_l"], bevel=0.02)

LOG_R = 0.13
big = (level >= 7)
crib_cx, crib_cy = (-0.45, -0.4)
crib_w = 2.0 if big else 1.6
crib_d = 1.15
post_h_base = {False: 1.0, True: 1.45}[big]
roofed = (level >= 4)
post_h = post_h_base + (0.35 if roofed else 0.0)


def log_y(cx, cy, cz, length, r=LOG_R, mat_face=None):
    """Stamm entlang Y (Schnittfläche zeigt zur Kamera/Front)."""
    rod((cx, cy - length/2, cz), (cx, cy + length/2, cz), r, M["bark"], "slog", verts=10)
    rod((cx, cy + length/2, cz), (cx, cy + length/2 + 0.025, cz), r*0.82,
        mat_face or M["cut"], "slogcut", verts=10)


def crib(cx, cy, w, d, fill_rows, ph, iron_bands=False, rune_bands=False,
         gold_caps=False, front_special=None):
    """Holz-Krippe: 4 Pfosten + Seitenlatten, gefüllt mit Stämmen (Front = helle
    Schnittflächen). front_special: Liste (row, slot) -> Material für Sonderstämme."""
    for px in (-w/2, w/2):
        for py in (-d/2, d/2):
            L.box("cpost", (cx + px, cy + py, z0 + ph/2), (0.13, 0.13, ph), M["wood_d"], bevel=0.02)
            if gold_caps:
                L.box("cpostcap", (cx + px, cy + py, z0 + ph + 0.03), (0.19, 0.19, 0.07), M["gold"], bevel=0.02)
    # Seitenlatten (entlang Y, halten den Stapel seitlich)
    for px in (-w/2, w/2):
        for hz in (0.3, 0.68, 1.05):
            if hz < ph - 0.05:
                L.box("crail", (cx + px, cy, z0 + hz), (0.07, d + 0.16, 0.1), M["wood"], bevel=0.01)
    if iron_bands or rune_bands:
        bmat = M["rune"] if rune_bands else M["iron_d"]
        for px in (-w/2, w/2):
            for py in (-d/2, d/2):
                L.box("pband", (cx + px, cy + py, z0 + 0.42), (0.17, 0.17, 0.08), bmat, bevel=0.01)
                L.box("pband2", (cx + px, cy + py, z0 + ph - 0.28), (0.17, 0.17, 0.08), bmat, bevel=0.01)
    # Stämme: Reihen versetzt gestapelt, Schnittflächen zur Front
    inner_w = w - 0.26
    n_per = int(inner_w // (2*LOG_R + 0.015))
    pitch = inner_w / n_per
    specials = front_special or {}
    for row in range(fill_rows):
        zr = z0 + LOG_R + row * (2*LOG_R*0.87)
        n_row = n_per - (row % 2)
        for i in range(n_row):
            lx = cx - inner_w/2 + pitch/2 + i*pitch + (pitch/2 if row % 2 else 0)
            key = (row, i)
            if key in specials:
                sm = specials[key]
                rod((lx, cy - d/2 + 0.05, zr), (lx, cy + d/2 + 0.06, zr), LOG_R, sm, "special", verts=10)
            else:
                log_y(lx, cy, zr, d + 0.1)
    return z0 + ph


def side_pile(cx, cy, n=3, r=0.12):
    """Kleiner Beistapel (Pyramide, Schnittflächen zur Front)."""
    log_y(cx - r - 0.01, cy, z0 + r, 0.9, r)
    log_y(cx + r + 0.01, cy, z0 + r, 0.9, r)
    if n >= 3:
        log_y(cx, cy, z0 + r + 2*r*0.87, 0.9, r)


def chop_block(cx, cy):
    """Hackklotz mit steckendem Beil + 2 Scheite."""
    L.cylinder("chopblock", (cx, cy, z0 + 0.16), 0.2, 0.32, M["bark"], verts=12)
    L.cylinder("choptop", (cx, cy, z0 + 0.33), 0.17, 0.03, M["cut"], verts=12)
    obox("axehead", (cx + 0.02, cy + 0.03, z0 + 0.4), (0.07, 0.24, 0.15), M["iron_d"],
         rot=(math.radians(-18), 0, 0))
    strut((cx + 0.02, cy + 0.06, z0 + 0.44), (cx + 0.32, cy + 0.32, z0 + 0.92), 0.045, M["wood"], "axehandle")
    for (sx, sy) in ((0.4, -0.15), (0.5, 0.15)):
        obox("scheit", (cx + sx, cy + sy, z0 + 0.06), (0.12, 0.3, 0.12), M["cut"],
             rot=(0, 0, math.radians(30*sx)))


def cover_planks(cx, cy, w, ztop):
    """Zwei schmale Abdeckbretter mit LÜCKE oben auf dem Stapel (Wetterschutz) —
    breite/dichte Bretter lasen sich als massiver Deckel."""
    for i, px in enumerate((-w*0.26, w*0.28)):
        obox("cover", (cx + px, cy, ztop + 0.05), (w*0.22, 1.28, 0.045),
             M["plank"], rot=(math.radians(-7), 0, math.radians(5 - i*9)))


def lean_roof(cx, cy, w, d, ph):
    """Pultdach auf den Krippen-Pfosten."""
    obox("lroof", (cx, cy, z0 + ph + 0.14), (w + 0.5, d + 0.55, 0.08), M["roof"],
         rot=(math.radians(-14), 0, 0))


def gable_roof(cx, cy, w, d, ph, gold_ridge=False, rune_ridge=False):
    """Satteldach auf der großen Krippe."""
    L.box("beamF", (cx, cy + d/2, z0 + ph + 0.06), (w + 0.3, 0.12, 0.12), M["wood"], bevel=0.02)
    L.box("beamB", (cx, cy - d/2, z0 + ph + 0.06), (w + 0.3, 0.12, 0.12), M["wood"], bevel=0.02)
    L.roof_prism("roof", (cx, cy, z0 + ph + 0.4), w + 0.6, d + 0.6, 0.55, M["roof"])
    if gold_ridge:
        L.box("ridge", (cx, cy, z0 + ph + 0.7), (w + 0.65, 0.11, 0.08), M["gold"], bevel=0.02)
    if rune_ridge:
        L.box("ridge2", (cx, cy, z0 + ph + 0.7), (w + 0.65, 0.1, 0.07), M["rune_bar"], bevel=0.02)


def wheelbarrow(cx, cy):
    obox("wbbed", (cx, cy, z0 + 0.24), (0.5, 0.7, 0.2), M["wood"], rot=(math.radians(-6), 0, 0))
    w = L.cylinder("wbwheel", (cx, cy + 0.4, z0 + 0.12), 0.12, 0.07, M["wood_d"], verts=12)
    w.rotation_euler = (0, math.radians(90), 0)
    for sx in (-0.16, 0.16):
        strut((cx + sx, cy - 0.62, z0 + 0.3), (cx + sx, cy + 0.3, z0 + 0.18), 0.045, M["wood_d"], "wbgriff")
        L.box("wbleg", (cx + sx, cy - 0.3, z0 + 0.08), (0.05, 0.05, 0.16), M["wood_d"], bevel=0.01)
    log_y(cx, cy + 0.02, z0 + 0.42, 0.55, 0.11)


def shed(cx, cy):
    for px in (-1, 1):
        for py in (-1, 1):
            L.box("shpost", (cx + px*0.5, cy + py*0.35, z0 + 0.45), (0.09, 0.09, 0.9), M["wood_d"], bevel=0.01)
    obox("shroof", (cx, cy, z0 + 0.96), (1.25, 0.95, 0.06), M["roof"], rot=(math.radians(-11), 0, 0))
    for i in range(3):
        z = z0 + 0.05 + i * 0.09
        for k in (-1, 0, 1):
            L.box("plank", (cx, cy + k*0.15, z), (0.9, 0.13, 0.07), M["plank"], bevel=0.01)


def fence_piece(cx, cy):
    for t in (0.0, 0.5, 1.0):
        L.box("fpost", (cx + t*0.9, cy, z0 + 0.22), (0.08, 0.08, 0.44), M["wood_d"], bevel=0.01)
    L.box("frail", (cx + 0.45, cy, z0 + 0.34), (1.0, 0.06, 0.06), M["wood"], bevel=0.01)


def banner_at(cx, cy):
    L.banner("banner", cx, cy, z0, 0.34, 0.5, M["wood_d"], M["cloth"], M["iron_d"], pole_h=1.5)


def rune_obelisk(cx, cy):
    L.box("obase", (cx, cy, z0 + 0.1), (0.42, 0.42, 0.2), M["stone"], bevel=0.03)
    L.cone("oshaft", (cx, cy, z0 + 0.7), 0.2, 0.11, 1.0, M["marble"], verts=4)
    for hz in (0.45, 0.72, 0.98):
        L.box("oband", (cx, cy + 0.13 - hz*0.04, z0 + hz), (0.13, 0.07, 0.09), M["rune"], bevel=0.01)
    L.crystal("otip", (cx, cy, z0 + 1.32), 0.09, 0.28, M["rune"])


# ---------------------------------------------------------------------------
# Sonderstämme in der Front (Gold-/Kristall-Akzente je Level)
specials = {}
if level >= 12:
    specials[(1, 1)] = M["gold"]
if level >= 15:
    specials[(2, 0)] = M["rune_bar"]
    specials[(0, 3)] = M["rune_bar"]

fill = min(2 + level // 2, 6 if big else 4)   # wächst früh sichtbar: L1=2, L2=3, L4=4 …
crib_top = crib(crib_cx, crib_cy, crib_w, crib_d, fill, post_h,
                iron_bands=(7 <= level <= 12), rune_bands=(level >= 13),
                gold_caps=(level >= 12), front_special=specials)

chop_block(1.15, 0.9)

if level >= 2:
    side_pile(1.35, -0.5, n=2 + (1 if level >= 3 else 0))

if level >= 3:
    if not roofed:
        cover_planks(crib_cx, crib_cy, crib_w, z0 + fill * 2*LOG_R*0.87 + LOG_R)
    side_pile(-1.7, 0.6, n=3)

if level >= 4:
    for px in (-crib_w/2, crib_w/2):
        for py in (-crib_d/2, crib_d/2):
            L.box("sockel", (crib_cx + px, crib_cy + py, z0 + 0.05), (0.24, 0.24, 0.1), M["stone"], bevel=0.02)
    if level < 7:
        lean_roof(crib_cx, crib_cy, crib_w, crib_d, post_h)

if level >= 5:
    crib(1.35, 0.05, 0.95, 0.95, 3 if level < 9 else 4, 0.85)

if level >= 6:
    fence_piece(-1.95, 1.55)
    wheelbarrow(-1.0, 1.3)

if level >= 7:
    gable_roof(crib_cx, crib_cy, crib_w, crib_d, post_h,
               gold_ridge=(10 <= level <= 14), rune_ridge=(level >= 15))

if level >= 8:
    shed(1.7, -1.55)  # sichtbare Seite (hinter der großen Krippe war er verdeckt)

if level >= 9:
    banner_at(1.95, 1.35)
    side_pile(0.55, 1.35, n=3)

if level >= 10:
    L.box("marmorplatte", (crib_cx, crib_cy + crib_d/2 + 0.55, z0 + 0.02), (crib_w + 0.4, 0.85, 0.05),
          M["marble"], bevel=0.02)

if level >= 11:
    # Tor-Rahmen zwischen Haupt- und Nebenkrippe
    tx = 0.55
    for px in (-0.35, 0.35):
        L.box("torpost", (tx + px, -0.15, z0 + 0.65), (0.11, 0.11, 1.3), M["wood_d"], bevel=0.02)
    L.box("torbalken", (tx, -0.15, z0 + 1.36), (0.95, 0.13, 0.13), M["wood"], bevel=0.02)
    for row in (1, 2):
        pass  # Gold-Banderolen kommen über specials (L12)

if level >= 13:
    L.crystal("roofcrystal", (crib_cx, crib_cy, z0 + post_h + 0.95), 0.13, 0.45, M["rune"])

if level >= 14:
    rune_obelisk(0.55, 1.7)

if level >= 15:
    # Energie-Ader vom Obelisken zur Haupt-Krippe + Dacheck-Kristalle
    dxa, dya = crib_cx - 0.55, (crib_cy + crib_d/2) - 1.7
    ang = math.atan2(dya, dxa)
    for t in (0.25, 0.55, 0.85):
        obox("evein", (0.55 + dxa*t, 1.7 + dya*t, z0 + 0.015), (0.34, 0.09, 0.035),
             M["rune_bar"], rot=(0, 0, ang))
    # Kristalle sitzen AUF den Enden des vorderen Dachbalkens (nicht daneben in
    # der Luft — nichts schwebt!)
    for px in (-1, 1):
        L.crystal("eavecrys", (crib_cx + px*(crib_w/2 + 0.08), crib_cy + crib_d/2,
                               z0 + post_h + 0.18), 0.06, 0.22, M["rune"])


cam_scale = 6.6 + (0.5 if big else 0.0)
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.95 + (0.1 if big else 0.0))
L.setup_lights()
L.render_png(out, res=700)
