"""Clan-Burg — 15-Level-Schema, kumulative Sichtbar-Progression.

Silhouette: kompakte FESTUNG — zentraler Bergfried mit Zinnenkranz, Tor mit
Fallgitter an der Front (+Y), runde Ecktürme mit Kegeldächern, Fahnen.
DESIGN-REGELN: L1 funktionstüchtig, jedes Level sichtbar anders, nichts schwebt,
epische Details (Fackeln, Runen, Glyphen — Rezept der Mauer).
  L1  Holz-Fort: Blockhaus mit Toröffnung + Pfosten
  L2  +Dachkanten-Spitzen, +Fahne, +Fackel am Tor
  L3  +2 Holz-Ecktürmchen mit Kegeldächern, +Tor-Querbalken
  L4  T2: STEIN-Bergfried + Holztor + 2 Fenster + Sockel
  L5  +ZINNENKRANZ, +Eisen-Torbeschläge, +2 Fackeln am Tor
  L6  +2 runde Ecktürme (vorn) mit Kegeldächern, +Banner
  L7  T3: alles größer, +TORBOGEN mit FALLGITTER, Türme höher
  L8  +2 hintere Ecktürme (4 total), +Vorhof-Mauerstücke mit Zinnen, +4 Fenster
  L9  +Wappen überm Tor, +Fahnen auf allen Türmen, +Treppe
  L10 T4: Marmor, +GOLD-Kegeldächer, +Gold-Fensterbänke
  L11 +ERKER überm Tor (auf Konsolen), +Gold-Zierband
  L12 +Gold-Turmspitzen, +SONNEN-Emblem, +Gold-Zinnenkappen
  L13 T5: Arkan — Fenster/Fallgitter LEUCHTEN, Runen-Fugen, Runen-Schriftzeile
  L14 +Runen-Ringe an Türmen, +Kristalle statt Fahnen, +Front-Glyphen
  L15 +KRISTALL-KRONE auf den Zinnen, +glühender Portal-Ring ums Tor,
      +Dach-Großkristall, +Energie-Adern + Beschwörungskreis
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_cc_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

STONE = {
    1: ((0.44, 0.42, 0.38), (0.31, 0.30, 0.27), (0.56, 0.53, 0.48), (0.66, 0.63, 0.57)),
    2: ((0.44, 0.42, 0.38), (0.31, 0.30, 0.27), (0.56, 0.53, 0.48), (0.66, 0.63, 0.57)),
    3: ((0.72, 0.60, 0.42), (0.55, 0.45, 0.30), (0.80, 0.69, 0.50), (0.88, 0.78, 0.60)),
    4: ((0.85, 0.84, 0.81), (0.66, 0.65, 0.62), (0.91, 0.90, 0.88), (0.96, 0.95, 0.93)),
    5: ((0.24, 0.22, 0.31), (0.15, 0.14, 0.20), (0.33, 0.30, 0.42), (0.42, 0.38, 0.53)),
}
wc, wc_d, bc, cc = STONE[tier]

M = {
    "wood":   L.mat("wood",   T["wood"],   rough=0.9),
    "wood_d": L.mat("wood_d", T["wood_d"], rough=0.9),
    "gold":   L.mat("gold",   (0.98, 0.78, 0.22), rough=0.3, metal=0.9),
    "grass":  L.mat("grass",  T["ground"], rough=1.0),
    "grass_d":L.mat("grass_d",T["ground_d"],rough=1.0),
    "dirt":   L.mat("dirt",   (0.42, 0.31, 0.19), rough=1.0),
    "dirt_l": L.mat("dirt_l", (0.52, 0.40, 0.26), rough=1.0),
    "moss":   L.mat("moss",   (0.34, 0.50, 0.20), rough=1.0),
    "iron":   L.mat("iron",   (0.74, 0.77, 0.82), rough=0.35, metal=0.85),
    "iron_d": L.mat("iron_d", (0.30, 0.32, 0.36), rough=0.5, metal=0.6),
    "wall":   L.mat("wall",   wc,   rough=1.0),
    "wall_d": L.mat("wall_d", wc_d, rough=1.0),
    "block":  L.mat("block",  bc,   rough=0.95),
    "cut":    L.mat("cut",    cc,   rough=0.9),
    "roof":   L.mat("roof",   T["accent"], rough=0.8),
    "cloth":  L.mat("cloth",  T["accent"], rough=0.9),
    "bore":   L.mat("bore",   (0.04, 0.04, 0.05), rough=1.0),
    "ember":  L.mat("ember",  (1.0, 0.55, 0.15), rough=0.6, emis=0.9),
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=1.1),
    "rune_bar": L.mat("rune_bar", (0.45, 0.68, 0.9), rough=0.35, emis=0.15),
}
s = T["scale"]
z0 = 0.42


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


def torch(x, fy, zb):
    """Wandfackel: Eisenhalter + schräger Stab + Flamme AM Stab."""
    obox("thalter", (x, fy + 0.025, zb), (0.07, 0.07, 0.10), M["iron_d"])
    p2 = (x, fy + 0.15, zb + 0.26)
    a = Vector((x, fy + 0.01, zb - 0.03)); b = Vector(p2); mid = (a + b) / 2; d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.032, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = "torch"
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    o.data.materials.append(M["wood_d"])
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(p2[0], p2[1], p2[2] + 0.035))
    f = bpy.context.active_object
    f.name = "flame"
    f.scale = (0.062, 0.062, 0.115)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    f.data.materials.append(M["ember"])


# --- Grassockel ---------------------------------------------------------------
L.box("dirt",   (0, 0, 0.13), (4.9*s, 4.6*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.5*s, 4.2*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.6*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.8*s, -1.6*s), (1.85*s, 1.5*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.18, 0.12, M["moss"], verts=10)
L.box("yard", (0, 0.55, 0.405), (2.6, 1.9, 0.045), M["dirt_l"], bevel=0.02)

# --- Bergfried-Maße -----------------------------------------------------------
cy = -0.25                                        # Bergfried-Zentrum (y)
if tier == 1:
    kb, kd, kh = 1.35, 1.25, 0.95                 # Holz-Fort
else:
    kb = 1.45 + 0.06 * (level - 4)                # wächst pro Level
    kd = 1.30 + 0.05 * (level - 4)
    kh = 1.15 + 0.075 * (level - 4)
fy = cy + kd/2                                    # Frontebene
gate_w, gate_h = 0.42, 0.52

# =============================================================================
if tier == 1:
    # --- HOLZ-FORT -------------------------------------------------------------
    L.box("keep", (0, cy, z0 + kh/2), (kb, kd, kh), M["wood"], bevel=0.03)
    for k in (-0.42, -0.14, 0.14, 0.42):          # Plankenfugen
        L.box("fuge", (k, cy, z0 + kh/2), (0.035, kd + 0.02, kh - 0.06), M["wood_d"], bevel=0.0)
    L.box("keeptop", (0, cy, z0 + kh - 0.03), (kb + 0.08, kd + 0.08, 0.07), M["wood_d"], bevel=0.02)
    # Tor: dunkle Öffnung + Pfosten + Sturz
    obox("gate", (0, fy + 0.01, z0 + gate_h/2), (gate_w, 0.06, gate_h), M["bore"])
    for gx in (-gate_w/2 - 0.045, gate_w/2 + 0.045):
        L.cylinder("gpost", (gx, fy + 0.03, z0 + (gate_h + 0.10)/2), 0.05, gate_h + 0.10, M["wood_d"], verts=8)
    L.box("glintel", (0, fy + 0.03, z0 + gate_h + 0.12), (gate_w + 0.24, 0.09, 0.09), M["wood_d"], bevel=0.01)
    if level >= 2:
        # Dachkanten-Spitzen + Fahne + Fackel
        for k in range(6):
            px = -0.55 + k * 0.22
            L.cone("dspike", (px, cy + kd/2 - 0.06, z0 + kh + 0.09), 0.05, 0.008, 0.16, M["wood_d"], verts=8)
        L.banner("ban", -0.45, cy - 0.1, z0 + kh - 0.02, 0.30, 0.36, M["wood_d"], M["cloth"], M["gold"], pole_h=0.85)
        torch(gate_w/2 + 0.22, fy + 0.03, z0 + 0.52)
    if level >= 3:
        # Holz-Ecktürmchen + Tor-Querbalken
        for tx in (-kb/2 - 0.02, kb/2 + 0.02):
            L.cylinder("wtower", (tx, fy - 0.15, z0 + (kh + 0.25)/2), 0.20, kh + 0.25, M["wood_d"], verts=12)
            L.cone("wroof", (tx, fy - 0.15, z0 + kh + 0.25 + 0.14), 0.26, 0.01, 0.3, M["roof"], verts=12)
        L.box("gbar", (0, fy + 0.055, z0 + gate_h * 0.55), (gate_w + 0.18, 0.05, 0.08), M["wood"], bevel=0.01)
        torch(-gate_w/2 - 0.22, fy + 0.03, z0 + 0.52)
else:
    # --- STEIN-BURG --------------------------------------------------------------
    L.box("keep", (0, cy, z0 + kh/2), (kb, kd, kh), M["wall"], bevel=0.03)
    L.box("plinth", (0, cy, z0 + 0.08), (kb + 0.14, kd + 0.14, 0.16), M["wall_d"], bevel=0.02)
    # Blockrelief-Quader an der Front (Struktur, wie bei der Mauer)
    for i in range(5):
        bx = -0.52 + i * 0.26
        if abs(bx) < 0.36:
            continue                              # Tor-Zone frei
        bz = 0.16 + ((i * 37) % 3) * 0.14
        L.box("brelief", (bx, cy, z0 + bz + 0.07), (0.20, kd + 0.03, 0.13),
              M["cut"] if i % 2 else M["wall_d"], bevel=0.02)
    # Zinnenkranz
    if level >= 5:
        L.box("crown", (0, cy, z0 + kh - 0.03), (kb + 0.10, kd + 0.10, 0.07), M["cut"], bevel=0.02)
        mz = z0 + kh + 0.085
        L.battlement_ring("merl", 0, cy, kb/2 - 0.02, kd/2 - 0.02, mz, M["wall"], merlon=0.20, gap=0.24, h=0.17)
        if level >= 12:
            L.battlement_ring("mercap", 0, cy, kb/2 - 0.02, kd/2 - 0.02, mz + 0.105, M["gold"],
                              merlon=0.23, gap=0.21, h=0.04)
        if level >= 15:
            # KRISTALL-KRONE: Kristalle auf den Zinnen-Ecken
            for (ex, ey) in ((-kb/2 + 0.08, cy - kd/2 + 0.08), (kb/2 - 0.08, cy - kd/2 + 0.08),
                             (-kb/2 + 0.08, cy + kd/2 - 0.08), (kb/2 - 0.08, cy + kd/2 - 0.08)):
                L.crystal("crownc", (ex, ey, z0 + kh + 0.22), 0.055, 0.24, M["rune"])
    # Tor
    gate_z = gate_h + (0.10 if level >= 7 else 0.0)
    obox("gatedark", (0, fy + 0.015, z0 + gate_z/2), (gate_w, 0.06, gate_z), M["bore"])
    if level >= 7:
        c = L.cylinder("gatearc", (0, fy + 0.015, z0 + gate_z), gate_w/2, 0.06, M["bore"], verts=16)
        c.rotation_euler = (math.radians(90), 0, 0)
        frame_mat = M["cut"]
        cf = L.cylinder("gatearcf", (0, fy + 0.005, z0 + gate_z), gate_w/2 + 0.09, 0.05, frame_mat, verts=16)
        cf.rotation_euler = (math.radians(90), 0, 0)
        # FALLGITTER
        grid_mat = M["rune"] if level >= 13 else M["iron_d"]
        for gx in (-0.12, 0.0, 0.12):
            obox("pcbar", (gx, fy + 0.045, z0 + gate_z * 0.52), (0.028, 0.03, gate_z * 0.96), grid_mat)
        for gz in (0.35, 0.65):
            obox("pcbarh", (0, fy + 0.045, z0 + gate_z * gz), (gate_w - 0.04, 0.03, 0.028), grid_mat)
    else:
        L.box("gatewood", (0, fy + 0.045, z0 + gate_z/2), (gate_w - 0.04, 0.05, gate_z - 0.04), M["wood_d"], bevel=0.01)
        if level >= 5:
            for gz in (0.18, 0.40):
                L.box("gband", (0, fy + 0.08, z0 + gz), (gate_w - 0.02, 0.03, 0.055), M["iron_d"], bevel=0.01)
    L.box("gframeL", (-gate_w/2 - 0.055, fy + 0.02, z0 + gate_z/2), (0.11, 0.10, gate_z), M["wall_d"], bevel=0.01)
    L.box("gframeR", (gate_w/2 + 0.055, fy + 0.02, z0 + gate_z/2), (0.11, 0.10, gate_z), M["wall_d"], bevel=0.01)
    if level < 7:
        L.box("glintel2", (0, fy + 0.02, z0 + gate_z + 0.05), (gate_w + 0.22, 0.10, 0.10), M["wall_d"], bevel=0.01)
    # L15: glühender PORTAL-Ring um den Torbogen
    if level >= 15:
        cp = L.cylinder("portalring", (0, fy + 0.002, z0 + gate_z), gate_w/2 + 0.16, 0.04, M["rune_bar"], verts=16)
        cp.rotation_euler = (math.radians(90), 0, 0)
    # Fenster
    n_win = 4 if level >= 8 else 2
    win_mat = M["rune"] if level >= 13 else M["bore"]
    win_z = z0 + kh * 0.68
    for i in range(n_win):
        wx = (-0.42 + i * 0.28) if n_win == 4 else (-0.3 + i * 0.6)
        if abs(wx) < 0.18 and level >= 11:
            continue                               # Platz für den Erker
        obox("win", (wx, fy + 0.012, win_z), (0.11, 0.03, 0.20), win_mat)
        if level >= 10:
            obox("winsill", (wx, fy + 0.02, win_z - 0.125), (0.15, 0.05, 0.035), M["gold"])
    # Fackeln am Tor
    if level >= 5:
        for tx in (-gate_w/2 - 0.28, gate_w/2 + 0.28):
            torch(tx, fy + 0.03, z0 + 0.55)
    # Ecktürme
    tower_r = 0.26 + 0.01 * max(0, level - 6)
    tower_h = kh + 0.32
    positions = []
    if level >= 6:
        positions += [(-kb/2 - 0.06, cy + kd/2 - 0.10), (kb/2 + 0.06, cy + kd/2 - 0.10)]
    if level >= 8:
        positions += [(-kb/2 - 0.06, cy - kd/2 + 0.10), (kb/2 + 0.06, cy - kd/2 + 0.10)]
    for (tx, ty) in positions:
        L.cylinder("tower", (tx, ty, z0 + tower_h/2), tower_r, tower_h, M["wall_d"], verts=14)
        L.cylinder("towerring", (tx, ty, z0 + tower_h - 0.05), tower_r + 0.035, 0.06, M["cut"], verts=14)
        roof_mat = M["gold"] if level >= 10 else M["roof"]
        L.cone("troof", (tx, ty, z0 + tower_h + 0.17), tower_r + 0.06, 0.012, 0.36, roof_mat, verts=14)
        if level >= 14:
            # Runen-Ringe am Turmschaft + Kristall statt Fahne
            for rz in (0.45, 0.7):
                L.cylinder("trune", (tx, ty, z0 + tower_h * rz), tower_r + 0.02, 0.04, M["rune_bar"], verts=14)
            L.crystal("tcrys", (tx, ty, z0 + tower_h + 0.35 + 0.09), 0.05, 0.22, M["rune"])
        elif level >= 12:
            L.cylinder("tspitz", (tx, ty, z0 + tower_h + 0.35 + 0.07), 0.022, 0.16, M["gold"], verts=8)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.035,
                                                  location=(tx, ty, z0 + tower_h + 0.35 + 0.16))
            kn = bpy.context.active_object; kn.name = "tknauf"
            bpy.ops.object.shade_smooth(); kn.data.materials.append(M["gold"])
        elif level >= 9:
            L.cylinder("tpole", (tx, ty, z0 + tower_h + 0.35 + 0.12), 0.018, 0.28, M["wood_d"], verts=8)
            obox("tflag", (tx + 0.09, ty, z0 + tower_h + 0.35 + 0.20), (0.16, 0.02, 0.10), M["cloth"])
    # Vorhof-Mauerstücke mit Zinnen
    if level >= 8:
        for sgn in (-1, 1):
            wx = sgn * (kb/2 - 0.15)
            L.box("court", (wx, fy + 0.45, z0 + 0.26), (0.16, 0.85, 0.52), M["wall"], bevel=0.02)
            L.box("courtcap", (wx, fy + 0.45, z0 + 0.545), (0.20, 0.89, 0.05), M["cut"], bevel=0.01)
            for my in (fy + 0.18, fy + 0.48, fy + 0.78):
                L.box("courtm", (wx, my, z0 + 0.63), (0.17, 0.14, 0.12), M["wall"], bevel=0.01)
    # Wappen / Sonnen-Emblem überm Tor
    if level >= 9:
        wz = z0 + gate_z + 0.38
        frame_mat = M["gold"] if level >= 12 else M["iron_d"]
        shield_mat = M["rune_bar"] if level >= 13 else M["cloth"]
        L.box("wframe", (0, fy + 0.02, wz), (0.34, 0.05, 0.38), frame_mat, bevel=0.02)
        L.box("wshield", (0, fy + 0.048, wz), (0.27, 0.04, 0.31), shield_mat, bevel=0.02)
        if level >= 12:
            emb_mat = M["rune"] if level >= 13 else M["gold"]
            sc_ = L.cylinder("sonne", (0, fy + 0.08, wz), 0.062, 0.03, emb_mat, verts=12)
            sc_.rotation_euler = (math.radians(90), 0, 0)
            for k in range(8):
                phi = k * math.pi / 4
                obox("strahl", (0.095 * math.cos(phi), fy + 0.077, wz + 0.095 * math.sin(phi)),
                     (0.045, 0.026, 0.02), emb_mat, rot=(0, -phi, 0))
        else:
            L.box("wemblem", (0, fy + 0.075, wz), (0.08, 0.03, 0.13), M["gold"], bevel=0.01)
    # Treppe vorm Tor
    if level >= 9:
        obox("step1", (0, fy + 0.16, z0 + 0.045), (0.56, 0.24, 0.09), M["wall_d"])
        obox("step2", (0, fy + 0.34, z0 + 0.025), (0.56, 0.16, 0.05), M["wall_d"])
    # Erker überm Tor
    if level >= 11:
        ez = z0 + kh * 0.70
        L.box("erker", (0, fy + 0.14, ez), (0.48, 0.28, 0.30), M["wall"], bevel=0.02)
        L.box("erkcap", (0, fy + 0.14, ez + 0.175), (0.52, 0.32, 0.05),
              M["gold"] if level >= 12 else M["cut"], bevel=0.01)
        for kx in (-0.16, 0.16):
            obox("konsole", (kx, fy + 0.10, ez - 0.20), (0.09, 0.16, 0.10), M["cut"])
        obox("erkwin", (0, fy + 0.285, ez + 0.02), (0.10, 0.03, 0.16),
             M["rune"] if level >= 13 else M["bore"])
    # Gold-Zierband am Bergfried
    if level >= 11:
        L.box("goldband", (0, cy, z0 + kh - 0.14), (kb + 0.03, kd + 0.03, 0.045), M["gold"], bevel=0.01)
    # T5: Runen-Fugen + Runen-Schriftzeile über dem Torbogen
    if level >= 13:
        for fz in (0.30, 0.52):
            L.box("rfuge", (0, cy, z0 + kh * fz), (kb + 0.02, kd + 0.02, 0.025), M["rune_bar"], bevel=0.0)
        gz_ = z0 + gate_z + 0.20
        for i, x in enumerate((-0.50, -0.32, 0.32, 0.50)):
            if i % 2 == 0:
                obox("rgly", (x, fy + 0.015, gz_), (0.04, 0.03, 0.12), M["rune"])
            else:
                obox("rgly", (x, fy + 0.015, gz_), (0.09, 0.03, 0.04), M["rune"])
    # T5: große Front-Glyphen
    if level >= 14:
        for x in (-0.56, 0.56):
            obox("gly1", (x, fy + 0.015, z0 + kh * 0.42), (0.045, 0.035, 0.20), M["rune"])
            obox("gly2", (x, fy + 0.015, z0 + kh * 0.52), (0.14, 0.035, 0.045), M["rune"])
    # L15: Dach-Großkristall auf Podest + Energie-Adern + Beschwörungskreis
    if level >= 15:
        L.box("cpodest", (0, cy, z0 + kh + 0.06), (0.34, 0.34, 0.12), M["wall_d"], bevel=0.02)
        L.crystal("bigcrys", (0, cy, z0 + kh + 0.12 + 0.24), 0.13, 0.55, M["rune"])
        for (x0, mirror) in ((-0.85, 1), (0.7, -1)):
            segs = [
                ((x0,                 fy + 0.30), 18 * mirror, 0.30, 0.09),
                ((x0 + 0.09 * mirror, fy + 0.55), -8 * mirror, 0.25, 0.075),
                ((x0 + 0.15 * mirror, fy + 0.76), 14 * mirror, 0.20, 0.06),
            ]
            for (cx_, cy_), ang, ln, w in segs:
                obox("evein", (cx_, cy_, z0 + 0.015), (w, ln, 0.035), M["rune_bar"],
                     rot=(0, 0, math.radians(ang)))
        ccx, ccy, cr = 0.0, fy + 0.85, 0.42
        for k in range(5):
            phi = math.radians(195 + k * 37.5)
            obox("ritual", (ccx + cr * math.cos(phi), ccy + cr * math.sin(phi), z0 + 0.013),
                 (0.20, 0.05, 0.03), M["rune_bar"], rot=(0, 0, phi + math.pi / 2))
        for k in range(4):
            phi = math.radians(213.75 + k * 37.5)
            obox("ritudot", (ccx + cr * math.cos(phi), ccy + cr * math.sin(phi), z0 + 0.018),
                 (0.05, 0.05, 0.04), M["rune"], rot=(0, 0, phi))

cam_scale = 5.2 + 0.14 * level
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.85)
L.setup_lights()
L.render_png(out, res=700)
