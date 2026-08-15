"""Menschen-Goldlager (storage_gold), parametrisch über LEVEL 1..15.
blender -b --python storage_gold_tiered.py -- <level> <out.png>

KONZEPT: bewusst ANDERS als Holz-/Steinlager (Nutzer-Vorgabe) — eine RUNDE
SCHATZKAMMER: großer offener TRESOR-KESSEL (Zylinder) auf Steinsockel, das Gold
quillt sichtbar oben heraus (Nugget-Haufen), davor Goldsäcke + Truhe + Eisentür
mit Schloss. Silhouette: rund + kompakt (vs. Krippe hoch, Bunker flach).
DESIGN-REGELN: L1 funktionstüchtig, jedes Level sichtbar anders, nichts schwebt.
  L1  kleine offene Steinwanne mit ersten Nuggets, +1 Goldsack
  L2  +mehr Gold (Haufen wächst), +2. Sack
  L3  +Holz-Verstärkungsbänder am Kessel, +angelehnte Deckelklappe
  L4  T2: +Steinsockel-Ring, +Eisenbänder statt Holz
  L5  +offene TRUHE voller Gold
  L6  +Gitterstäbe-Zaun vorn, +Laterne
  L7  T3: GROSS-TRESOR — Kessel größer auf Sockel, +EISENTÜR mit Schloss vorn
  L8  +Treppe zum Kessel + Podest, +3. Sack
  L9  +Banner, +Goldhaufen außen neben dem Sockel
  L10 T4: Marmor-Sockel, +goldener Zierkranz um die Kessel-Öffnung
  L11 +2 Säulen flankieren die Tür, +2. Truhe
  L12 +GOLD-GITTERKUPPEL (Streben) über dem offenen Kessel
  L13 T5: Arkanstein, RUNEN-Schloss leuchtet, +Kristall auf der Kuppel
  L14 +Runen-Obelisk, +Runenband um den Kessel
  L15 +KRISTALL-Nuggets im Gold, +Energie-Ader, +Glyphe auf der Tür
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_stgold_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

STONE = {
    1: ((0.44, 0.42, 0.38), (0.31, 0.30, 0.27)),
    2: ((0.44, 0.42, 0.38), (0.31, 0.30, 0.27)),
    3: ((0.72, 0.60, 0.42), (0.55, 0.45, 0.30)),
    4: ((0.85, 0.84, 0.81), (0.66, 0.65, 0.62)),
    5: ((0.24, 0.22, 0.31), (0.15, 0.14, 0.20)),
}
wc, wc_d = STONE[tier]

M = {
    "wood":   L.mat("wood",   T["wood"],   rough=0.9),
    "wood_d": L.mat("wood_d", T["wood_d"], rough=0.9),
    "gold":   L.mat("gold",   (0.98, 0.78, 0.22), rough=0.3, metal=0.9),
    "gold_ore":L.mat("gold_ore",(0.97, 0.76, 0.20), rough=0.4, metal=0.6, emis=0.15),
    "grass":  L.mat("grass",  T["ground"], rough=1.0),
    "grass_d":L.mat("grass_d",T["ground_d"],rough=1.0),
    "dirt":   L.mat("dirt",   (0.42, 0.31, 0.19), rough=1.0),
    "dirt_l": L.mat("dirt_l", (0.52, 0.40, 0.26), rough=1.0),
    "moss":   L.mat("moss",   (0.34, 0.50, 0.20), rough=1.0),
    "iron":   L.mat("iron",   (0.74, 0.77, 0.82), rough=0.35, metal=0.85),
    "iron_d": L.mat("iron_d", (0.30, 0.32, 0.36), rough=0.5, metal=0.6),
    "stone":  L.mat("stone",  wc,   rough=1.0),
    "stone_d":L.mat("stone_d",wc_d, rough=1.0),
    "sack":   L.mat("sack",   (0.62, 0.50, 0.34), rough=1.0),
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


def lump(name, cx, cy, cz, rx, ry, rz, mat, subdiv=1, smooth=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0, location=(cx, cy, cz))
    o = bpy.context.active_object
    o.name = name
    o.scale = (rx, ry, rz)
    bpy.ops.object.transform_apply(scale=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def nugget(cx, cy, cz, r, mat=None):
    return lump("nugget", cx, cy, cz, r, r*0.9, r*0.8, mat or M["gold_ore"], subdiv=1)


# ---------------------------------------------------------------------------
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, -1.7*s), (1.95*s, 1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)
L.box("yard", (0.0, 0.45, 0.405), (3.0, 2.1, 0.045), M["dirt_l"], bevel=0.02)

big = (level >= 7)
kx, ky = -0.35, -0.35             # Kessel-Zentrum
kr = 1.05 if big else 0.8         # Kessel-Radius
sockel_h = 0.5 if big else 0.28
kh = 0.85                          # Kesselwand-Höhe
k_base = z0 + sockel_h
k_top = k_base + kh


def vault():
    """Tresor-Kessel: Steinsockel + Zylinderwand, oben quillt der Goldhaufen
    heraus (gestauchte Gold-Halbkugel + einzelne Nuggets = Füllstand)."""
    if big:
        L.cylinder("sockel", (kx, ky, z0 + sockel_h/2), kr + 0.25, sockel_h, M["stone_d"], verts=24)
        L.cylinder("sockelrand", (kx, ky, z0 + sockel_h - 0.03), kr + 0.32, 0.07, M["stone"], verts=24)
    else:
        L.cylinder("sockel", (kx, ky, z0 + sockel_h/2), kr + 0.18, sockel_h, M["stone_d"], verts=20)
    L.cylinder("kessel", (kx, ky, k_base + kh/2), kr, kh, M["stone"], verts=24)
    L.cylinder("kesselrand", (kx, ky, k_base + kh - 0.04), kr + 0.07, 0.09, M["stone_d"], verts=24)
    # Gold-Füllung: Haufen wächst mit Level
    heap = min(0.12 + 0.045*level, 0.62)
    lump("goldheap", kx, ky, k_top - 0.06, kr*0.88, kr*0.88, heap, M["gold_ore"], subdiv=2, smooth=True)
    n_nug = min(3 + level, 14)
    for i in range(n_nug):
        a = i * 2.4
        rr = kr * (0.25 + 0.5 * ((i * 7) % 10) / 10)
        nugget(kx + math.cos(a)*rr, ky + math.sin(a)*rr, k_top + heap*0.55 - 0.05 - rr*0.12,
               0.1 + 0.03*((i * 3) % 3),
               M["rune_bar"] if (level >= 15 and i % 5 == 0) else None)


def gold_sack(cx, cy, r=0.2):
    """Goldsack: bauchiger Sack mit zugebundenem Hals + Nuggets obenauf."""
    lump("sack", cx, cy, z0 + r*0.8, r, r, r*0.85, M["sack"], subdiv=2, smooth=True)
    L.cylinder("sackhals", (cx, cy, z0 + r*1.6), r*0.32, r*0.35, M["sack"], verts=10)
    L.cylinder("sackband", (cx, cy, z0 + r*1.55), r*0.36, 0.04, M["wood_d"], verts=10)
    nugget(cx + 0.05, cy - 0.02, z0 + r*1.85, 0.07)


def chest(cx, cy, open_lid=True):
    """Truhe voller Gold, Deckel offen angelehnt."""
    L.box("chest", (cx, cy, z0 + 0.16), (0.5, 0.34, 0.3), M["wood_d"], bevel=0.02)
    L.box("chestband", (cx, cy, z0 + 0.16), (0.54, 0.1, 0.32), M["iron_d"], bevel=0.01)
    if open_lid:
        obox("chestlid", (cx, cy - 0.22, z0 + 0.38), (0.5, 0.3, 0.06), M["wood"],
             rot=(math.radians(-65), 0, 0))
        for (nx2, ny2) in ((-0.1, 0.0), (0.1, 0.04), (0.0, -0.06)):
            nugget(cx + nx2, cy + ny2, z0 + 0.36, 0.08)
    else:
        L.box("chestlid", (cx, cy, z0 + 0.34), (0.52, 0.36, 0.08), M["wood"], bevel=0.02)


def wood_bands():
    for hz in (0.3, 0.62):
        L.cylinder("wband", (kx, ky, k_base + hz), kr + 0.04, 0.08, M["wood_d"], verts=24)


def iron_bands(rune=False):
    bmat = M["rune_bar"] if rune else M["iron_d"]
    for hz in (0.28, 0.6):
        L.cylinder("iband", (kx, ky, k_base + hz), kr + 0.04, 0.07, bmat, verts=24)


def lid_flap(cx, cy):
    """Abgenommener runder Deckel, liegt flach auf dem Boden neben dem Kessel."""
    L.cylinder("lid", (cx, cy, z0 + 0.03), 0.5, 0.06, M["wood"], verts=18)
    L.cylinder("lidring", (cx, cy, z0 + 0.07), 0.2, 0.02, M["wood_d"], verts=14)
    L.box("lidgriff", (cx, cy, z0 + 0.10), (0.22, 0.06, 0.07), M["wood_d"], bevel=0.01)


def vault_door(glyph=False, rune_lock=False):
    """Eisentür mit Schloss in den Sockel eingelassen (Front/+Y), ragt vor."""
    dy = ky + kr + 0.25
    L.box("doorframe", (kx, dy - 0.06, z0 + 0.36), (0.72, 0.16, 0.7), M["stone_d"], bevel=0.02)
    L.box("door", (kx, dy + 0.02, z0 + 0.34), (0.52, 0.1, 0.6), M["iron_d"], bevel=0.02)
    lock_mat = M["rune"] if rune_lock else M["gold"]
    L.cylinder("lock", (kx + 0.12, dy + 0.09, z0 + 0.36), 0.08, 0.05,
               lock_mat, verts=12).rotation_euler = (math.radians(90), 0, 0)
    for hz in (0.14, 0.56):
        L.box("doorband", (kx, dy + 0.07, z0 + hz), (0.54, 0.03, 0.07), M["iron"], bevel=0.01)
    if glyph:
        obox("dgly1", (kx - 0.12, dy + 0.09, z0 + 0.36), (0.05, 0.03, 0.22), M["rune"])
        obox("dgly2", (kx - 0.12, dy + 0.09, z0 + 0.45), (0.14, 0.03, 0.05), M["rune"])


def stairs_podest():
    """Holztreppe + kleines Podest an der Kessel-Seite."""
    px = kx + kr + 0.12
    for i in range(4):
        L.box("step", (px + 0.3 - i*0.11, ky + 0.55, z0 + 0.07 + i*0.13),
              (0.34, 0.5, 0.14), M["wood"], bevel=0.01)
    L.box("podest", (px - 0.25, ky + 0.55, z0 + 0.55), (0.5, 0.55, 0.08), M["wood_d"], bevel=0.01)


def gold_crown():
    """Goldener Zierkranz um die Kessel-Öffnung (T4)."""
    L.cylinder("crown", (kx, ky, k_top + 0.02), kr + 0.1, 0.07, M["gold"], verts=24)
    for k in range(8):
        a = k * math.pi / 4
        L.box("crownspike", (kx + math.cos(a)*(kr + 0.08), ky + math.sin(a)*(kr + 0.08), k_top + 0.1),
              (0.07, 0.07, 0.12), M["gold"], bevel=0.01)


def gold_dome(crystal_top=False):
    """Gitterkuppel aus Goldstreben über dem offenen Kessel (L12+)."""
    apex = (kx, ky, k_top + 0.85)
    for k in range(6):
        a = k * math.pi / 3 + 0.26
        base = (kx + math.cos(a)*kr, ky + math.sin(a)*kr, k_top + 0.02)
        strut(base, apex, 0.055, M["gold"], "domestrut")
    L.cylinder("domering", (kx, ky, k_top + 0.45), kr*0.62, 0.05, M["gold"], verts=18)
    if crystal_top:
        L.crystal("domecrys", (kx, ky, k_top + 0.95), 0.11, 0.36, M["rune"])
    else:
        lump("domeknob", kx, ky, k_top + 0.92, 0.09, 0.09, 0.09, M["gold"], subdiv=2, smooth=True)


def lantern(cx, cy):
    L.box("lpost", (cx, cy, z0 + 0.35), (0.08, 0.08, 0.7), M["wood_d"], bevel=0.01)
    L.box("larm", (cx, cy + 0.1, z0 + 0.72), (0.06, 0.28, 0.06), M["wood_d"], bevel=0.01)
    L.box("lglow", (cx, cy + 0.22, z0 + 0.58), (0.11, 0.11, 0.14),
          L.mat("ember", (0.95, 0.55, 0.16), rough=0.5, emis=0.55), bevel=0.01)
    L.box("lcap",  (cx, cy + 0.22, z0 + 0.68), (0.15, 0.15, 0.05), M["iron_d"], bevel=0.01)
    L.box("lbase", (cx, cy + 0.22, z0 + 0.5), (0.15, 0.15, 0.04), M["iron_d"], bevel=0.01)


def iron_fence(cx, cy, n=5):
    """Gitterstäbe-Zaun (Tresor-Look, kein Holzzaun)."""
    for i in range(n):
        L.box("gpost", (cx + i*0.22, cy, z0 + 0.26), (0.05, 0.05, 0.52), M["iron_d"], bevel=0.005)
        L.cone("gspike", (cx + i*0.22, cy, z0 + 0.56), 0.04, 0.002, 0.1, M["iron_d"], verts=6)
    L.box("grail", (cx + (n-1)*0.11, cy, z0 + 0.42), ((n-1)*0.22 + 0.08, 0.05, 0.05), M["iron"], bevel=0.005)


def pillar(cx, cy, h=1.0):
    L.box("pbase", (cx, cy, z0 + 0.07), (0.34, 0.34, 0.14), M["stone_d"], bevel=0.02)
    L.cylinder("pshaft", (cx, cy, z0 + 0.14 + h/2), 0.12, h, M["stone"], verts=14)
    L.box("pcap", (cx, cy, z0 + 0.21 + h), (0.32, 0.32, 0.12), M["stone_d"], bevel=0.02)


def banner_at(cx, cy):
    L.banner("banner", cx, cy, z0, 0.34, 0.5, M["wood_d"], M["cloth"], M["iron_d"], pole_h=1.5)


def rune_obelisk(cx, cy):
    L.box("obase", (cx, cy, z0 + 0.1), (0.42, 0.42, 0.2), M["stone_d"], bevel=0.03)
    L.cone("oshaft", (cx, cy, z0 + 0.7), 0.2, 0.11, 1.0, M["stone"], verts=4)
    for hz in (0.45, 0.72, 0.98):
        L.box("oband", (cx, cy + 0.13 - hz*0.04, z0 + hz), (0.13, 0.07, 0.09), M["rune"], bevel=0.01)
    L.crystal("otip", (cx, cy, z0 + 1.32), 0.09, 0.28, M["rune"])


# ---------------------------------------------------------------------------
vault()

gold_sack(0.9, 0.85)

if level >= 2:
    gold_sack(1.25, 0.55, r=0.17)
    gold_sack(1.15, 1.15, r=0.15)

if level >= 3 and level < 4:
    wood_bands()
if level >= 4:
    iron_bands(rune=(level >= 13))

if level >= 3 and level < 12:
    lid_flap(kx + kr + (0.82 if big else 0.74), ky - 0.55)

if level >= 5:
    chest(0.45, 1.5)

if level >= 6:
    iron_fence(-1.85, 1.35)
    lantern(1.7, 0.2)

if level >= 7:
    vault_door(glyph=(level >= 15), rune_lock=(level >= 13))

if level >= 8:
    stairs_podest()
    gold_sack(-1.5, 0.9, r=0.19)

if level >= 9:
    banner_at(-1.9, 0.3)
    for (nx3, ny3) in ((-1.35, -0.15), (-1.2, 0.1), (-1.45, 0.12)):
        nugget(nx3, ny3, z0 + 0.08, 0.09)

if level >= 10:
    gold_crown()

if level >= 11:
    pillar(-0.95, 0.95)
    pillar(0.35, 1.05)
    chest(-0.35, 1.6, open_lid=False)

if level >= 12:
    gold_dome(crystal_top=(level >= 13))

if level >= 14:
    rune_obelisk(1.75, 1.5)
    L.cylinder("runering", (kx, ky, k_base + 0.44), kr + 0.05, 0.06, M["rune"], verts=24)

if level >= 15:
    dxa, dya = kx - 1.75, (ky + kr) - 1.5
    ang = math.atan2(dya, dxa)
    for t in (0.25, 0.55, 0.85):
        obox("evein", (1.75 + dxa*t, 1.5 + dya*t, z0 + 0.015), (0.34, 0.09, 0.035),
             M["rune_bar"], rot=(0, 0, ang))


cam_scale = 6.4 + (0.5 if big else 0.0) + (0.3 if level >= 12 else 0.0)
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.9 + (0.15 if level >= 12 else 0.0))
L.setup_lights()
L.render_png(out, res=700)
