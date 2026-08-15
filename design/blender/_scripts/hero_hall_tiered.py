"""Heldenhalle — 15-Level-Schema, HERZSTÜCK-Konzept (Konkurrenz-Recherche 2026-07-03).

CoC-Hero-Hall-Learnings (Fandom/Suche): weiße Steinplattform m. Stufen, Trophäen
zeigen die einziehenden Helden an (angelehntes Schwert, Zielscheibe, schwarzer
Kristall), ab L8 goldene KRONEN-Balken, Gold-Dachkanten, Royal-Purpur, Gold-
Spitzen. Castle Clash: "Heroes Altar". Signatur der Konkurrenz = Trophäen +
Kronen-Motiv AM GEBÄUDE.
UNSER HERZSTÜCK, das das toppt: eine KOLOSSAL-HELDENSTATUE mit gerecktem
Schwert, die mit JEDEM Level wächst (st = 0.50 + 0.045·Level) und pro Tier das
Material wechselt: geschnitzte Holzfigur → Stein → BRONZE → Marmor m. GOLD-
Schwert → OBSIDIAN m. Runen-Augen + Kristallklinge. Die Krone toppen wir
wörtlich: ab L11 trägt der Held eine echte GOLD-KRONE.
  T1 Holzschrein:  L1 Holzfigur m. Speer auf Sockel + Feuerschale · L2 +SCHILD +
                   Waffenständer · L3 Figur RECKT DAS SCHWERT + Ehrenbanner
  T2 Steinhalle:   L4 alles Stein, 2-Stufen-Sockel, Ziegeldach · L5 +2 Feuer-
                   schalen flankieren · L6 +HELM m. Busch + Trophäen-Schilde
  T3 Ruhmeshalle:  L7 Statue BRONZE + Säulen-PORTIKUS + Kronen-Zahnband ·
                   L8 +UMHANG + 2 Heldenbanner · L9 +Gold-Emblem + Trophäen-
                   Säulen m. Helmen
  T4 Athenäum:     L10 Statue MARMOR m. Gold-Schwert/-Schild, Gold-First ·
                   L11 +GOLD-KRONE + Balustraden-Weg · L12 +TRIUMPHBOGEN m.
                   Sonnen-Emblem, Gold-Flammen
  T5 Pantheon:     L13 Statue OBSIDIAN, Runen-Augen, KRISTALLKLINGE, Arkan-
                   Halle m. Spitzturm · L14 +Runen-Ring + Wand-Kristalle +
                   Glyphen · L15 APOTHEOSE: AURA-RING hinter der Statue (auf
                   Streben geerdet!) + Klingen-Glühkante + Beschwörungskreis +
                   Energie-Adern + Kristall-Cluster
DESIGN-REGELN: L1 funktionstüchtig, Level-Deltas SPEKTAKULÄR, nichts schwebt,
Requisiten-Ketten nur entlang EINER Achse (Iso-Totem-Falle).
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_hh_lvl{level:02d}.png")
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
# Statue-Material je Tier: Holzfigur → Stein → Bronze → Marmor → Obsidian
SMAT = {1: ((0.45, 0.32, 0.18), 0.9, 0.0), 2: ((0.55, 0.53, 0.49), 0.95, 0.0),
        3: ((0.68, 0.42, 0.20), 0.35, 0.85), 4: ((0.92, 0.91, 0.88), 0.55, 0.0),
        5: ((0.14, 0.13, 0.19), 0.4, 0.3)}[tier]

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
    "cut":    L.mat("cut",    cc,   rough=0.9),
    "roof":   L.mat("roof",   T["roof"], rough=0.8),
    "cloth":  L.mat("cloth",  T["roof_d"], rough=0.9),
    "bore":   L.mat("bore",   (0.04, 0.04, 0.05), rough=1.0),
    "ember":  L.mat("ember",  (1.0, 0.55, 0.15), rough=0.6, emis=0.9),
    "statue": L.mat("statue", SMAT[0], rough=SMAT[1], metal=SMAT[2]),
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=1.1),
    "rune_bar": L.mat("rune_bar", (0.45, 0.68, 0.9), rough=0.35, emis=0.15),
}
# Waffen-/Schmuck-Material der Statue je Tier
WMAT = M["iron_d"] if tier <= 2 else (M["iron"] if tier == 3 else M["gold"])
BLADE = M["rune"] if tier == 5 else WMAT
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


def sphere(name, center, r, mat, smooth=True, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=r, location=center)
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
        bpy.ops.object.transform_apply(scale=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def torus(name, center, R, r, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=center,
                                     major_segments=24, minor_segments=8)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def rod(p1, p2, r, mat, name="rod", verts=10):
    a = Vector(p1); b = Vector(p2); mid = (a + b) / 2; d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    o.data.materials.append(mat)
    return o


def brazier(cx, cyy, gold=False):
    """Feuerschale auf 3 Beinen, Flamme überlappt die Schale (nichts schwebt)."""
    leg_m = M["gold"] if gold else M["iron_d"]
    for k in range(3):
        phi = math.radians(90 + k * 120)
        rod((cx + 0.10 * math.cos(phi), cyy + 0.10 * math.sin(phi), z0),
            (cx, cyy, z0 + 0.20), 0.02, leg_m, "bleg", verts=8)
    L.cylinder("bowl", (cx, cyy, z0 + 0.22), 0.12, 0.09, leg_m, verts=12)
    sphere("bfire", (cx, cyy, z0 + 0.30), 0.085, M["ember"], scale=(1, 1, 1.5))


def helmet(cx, cyy, cz, r, hmat, plume_mat, plume=True):
    """Helm m. Kamm-Busch (Busch entfällt, wenn die Krone draufkommt)."""
    L.cylinder("helm", (cx, cyy, cz), r, r * 0.85, hmat, verts=12)
    L.cone("helmtop", (cx, cyy, cz + r * 0.6), r * 0.85, r * 0.50, r * 0.5, hmat, verts=12)
    if plume:
        obox("busch", (cx, cyy, cz + r * 1.15), (r * 0.4, r * 1.9, r * 0.9), plume_mat)


def hero_statue(sx, sy, st):
    """DAS HERZSTÜCK: Heldenstatue, wächst mit jedem Level, Material je Tier."""
    ph = 0.13 + 0.018 * level                       # Sockel wächst mit
    pedr = min(0.34 * st + 0.14, 0.42)              # Deckel: sonst kollidiert der Sockel
                                                    # ab T5 mit dem Portikus
    if level >= 4:                                  # 2-Stufen-Sockel ab Stein-Tier
        L.box("pedbase", (sx, sy, z0 + 0.045), (pedr * 2 + 0.24, pedr * 2 + 0.24, 0.09), M["cut"], bevel=0.02)
    L.box("ped", (sx, sy, z0 + 0.09 + ph / 2), (pedr * 2, pedr * 2, ph), M["wall_d"], bevel=0.02)
    if level >= 10:                                 # Gold-Zierband am Sockel
        L.box("pedband", (sx, sy, z0 + 0.09 + ph - 0.03), (pedr * 2 + 0.03, pedr * 2 + 0.03, 0.04), M["gold"], bevel=0.01)
    zb = z0 + 0.09 + ph
    # --- Figur (blickt nach +Y = zur Kamera) ---
    L.cone("tunic", (sx, sy, zb + 0.26 * st), 0.30 * st, 0.20 * st, 0.52 * st, M["statue"], verts=10)
    L.cylinder("belt", (sx, sy, zb + 0.53 * st), 0.215 * st, 0.05 * st, WMAT, verts=10)
    L.box("torso", (sx, sy, zb + 0.74 * st), (0.46 * st, 0.30 * st, 0.42 * st), M["statue"], bevel=0.02)
    for sgn in (-1, 1):
        sphere("pauldron", (sx + sgn * 0.27 * st, sy, zb + 0.92 * st), 0.10 * st, M["statue"])
    sphere("head", (sx, sy, zb + 1.08 * st), 0.13 * st, M["statue"])
    if level >= 6:
        helmet(sx, sy, zb + 1.15 * st, 0.125 * st, WMAT, M["cloth"], plume=(level < 11))
    if tier == 5:                                   # Runen-Augen
        for sgn in (-1, 1):
            sphere("auge", (sx + sgn * 0.05 * st, sy + 0.115 * st, zb + 1.09 * st), 0.028 * st, M["rune"])
    if level >= 11:                                 # GOLD-KRONE (CoC-Kronen-Motiv getoppt)
        ck = zb + 1.25 * st if level >= 6 else zb + 1.18 * st
        L.cylinder("krone", (sx, sy, ck + 0.03 * st), 0.115 * st, 0.06 * st, M["gold"], verts=10)
        for k in range(4):
            phi = math.radians(45 + k * 90)
            L.cone("kzack", (sx + 0.10 * st * math.cos(phi), sy + 0.10 * st * math.sin(phi),
                             ck + 0.10 * st), 0.028 * st, 0.001, 0.09 * st, M["gold"], verts=6)
    # --- Arme + Waffen ---
    shoulder_r = (sx - 0.27 * st, sy, zb + 0.92 * st)
    if level >= 3:
        # Schwertarm GERECKT
        hand = (sx - 0.40 * st, sy + 0.07 * st, zb + 1.26 * st)
        rod(shoulder_r, hand, 0.055 * st, M["statue"], "arm_r")
        sphere("faust", hand, 0.065 * st, M["statue"])
        blade_len = st * (0.55 + 0.030 * level)     # Klinge wächst mit JEDEM Level
        obox("parier", (hand[0], hand[1], hand[2] + 0.075 * st), (0.20 * st, 0.05 * st, 0.035 * st), WMAT)
        obox("klinge", (hand[0], hand[1], hand[2] + 0.10 * st + blade_len / 2),
             (0.075 * st, 0.030 * st, blade_len), BLADE)
        L.cone("spitze", (hand[0], hand[1], hand[2] + 0.10 * st + blade_len + 0.05 * st),
               0.038 * st, 0.001, 0.10 * st, BLADE, verts=6)
        sphere("knauf", (hand[0], hand[1], hand[2] - 0.06 * st), 0.038 * st, WMAT)
        if level >= 15:                             # Glühkante + Energie-Ringe um die Klinge
            obox("gluh", (hand[0], hand[1] + 0.018 * st, hand[2] + 0.10 * st + blade_len / 2),
                 (0.078 * st, 0.012, blade_len * 0.96), M["rune"])
            for fz, fR in ((0.35, 0.17), (0.72, 0.13)):
                torus("klingenring", (hand[0], hand[1], hand[2] + 0.10 * st + blade_len * fz),
                      fR * st, 0.016 * st, M["rune"])
    else:
        # L1-2: Speer, steht auf dem Sockel
        spx = sx - 0.36 * st
        rod((spx, sy + 0.02, zb), (spx, sy + 0.02, zb + 1.38 * st), 0.028 * st, M["wood_d"], "speer")
        L.cone("speerkopf", (spx, sy + 0.02, zb + 1.44 * st), 0.05 * st, 0.001, 0.14 * st, M["iron_d"], verts=8)
        rod(shoulder_r, (spx + 0.03 * st, sy + 0.02, zb + 0.88 * st), 0.055 * st, M["statue"], "arm_r")
    # Schildarm
    if level >= 2:
        sh = (sx + 0.34 * st, sy + 0.06 * st, zb + 0.70 * st)
        rod((sx + 0.27 * st, sy, zb + 0.92 * st), sh, 0.055 * st, M["statue"], "arm_l")
        shd = L.cylinder("schild", sh, 0.19 * st, 0.035 * st, WMAT, verts=14)
        shd.rotation_euler = (math.radians(80), 0, math.radians(-18))
        sphere("sboss", (sh[0] + 0.012, sh[1] + 0.033 * st, sh[2]), 0.05 * st,
               M["gold"] if tier >= 4 else M["iron_d"])
    else:
        rod((sx + 0.27 * st, sy, zb + 0.92 * st), (sx + 0.30 * st, sy + 0.04, zb + 0.58 * st),
            0.055 * st, M["statue"], "arm_l")
    # Umhang (hinten, liegt am Rücken an)
    if level >= 8:
        obox("umhang", (sx, sy - 0.19 * st, zb + 0.60 * st), (0.50 * st, 0.055 * st, 0.72 * st),
             M["cloth"], rot=(math.radians(-6), 0, 0))
    return zb, ph, pedr


# --- Grassockel ---------------------------------------------------------------
L.box("dirt",   (0, 0, 0.13), (4.8*s, 4.5*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.4*s, 4.1*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.8*s, 3.6*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.75*s, -1.55*s), (1.8*s, 1.5*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.18, 0.12, M["moss"], verts=10)
L.box("yard", (0.15, 0.5, 0.405), (3.4, 2.5, 0.045), M["dirt_l"], bevel=0.02)

FY = 0.15                                           # feste Fassadenlinie: Halle wächst
                                                    # nach HINTEN, der Vorhof bleibt frei
hx = -0.30                                          # Halle nach Bild-rechts versetzt,
                                                    # damit die Statue die Fassade freilässt
sx, sy = 1.20, 0.85                                 # Statue im Vorhof (Bild: vorn links)
st = 0.50 + 0.045 * level                           # HERZSTÜCK wächst mit JEDEM Level

# =============================================================================
if tier == 1:
    # --- HOLZSCHREIN ------------------------------------------------------------
    hb, hd, hh = 1.30, 1.0, 0.68
    cy = FY - hd/2
    fy = FY
    L.box("hall", (hx, cy, z0 + hh/2), (hb, hd, hh), M["wood"], bevel=0.02)
    for k in (-0.4, 0.0, 0.4):
        L.box("fuge", (hx + k, cy, z0 + hh/2), (0.03, hd + 0.02, hh - 0.05), M["wood_d"], bevel=0.0)
    # hip_roof erwartet das VOLUMEN-Zentrum (Basis = z − h/2), sonst steckt das
    # halbe Dach in der Wand und liest sich als flache Wanne
    rh1 = 0.44
    L.hip_roof("dach", (hx, cy, z0 + hh + rh1/2 - 0.02), hb + 0.28, hd + 0.28, rh1, M["roof"])
    obox("door", (hx, fy + 0.012, z0 + 0.26), (0.32, 0.03, 0.52), M["bore"])
    L.box("dframe", (hx, fy + 0.005, z0 + 0.55), (0.40, 0.05, 0.06), M["wood_d"], bevel=0.01)
    brazier(-0.85, 0.55)
    if level >= 2:
        # Waffenständer: 2 angelehnte Speere an der Hallenfront
        for i, wx in enumerate((hx - 0.52, hx - 0.64)):
            rod((wx, fy + 0.16, z0), (wx + 0.06, fy - 0.02, z0 + 0.62), 0.022, M["wood_d"], "wspeer")
            L.cone("wkopf", (wx - 0.012, fy + 0.19 - 0.035, z0 + 0.02 + 0.62), 0.04, 0.001, 0.10, M["iron_d"], verts=8)
    if level >= 3:
        L.banner("ban", -1.35, 0.45, z0, 0.28, 0.36, M["wood_d"], M["cloth"], M["iron_d"], pole_h=1.15)
else:
    # --- STEIN-/RUHMES-/MARMOR-/ARKAN-HALLE --------------------------------------
    hb = 1.55 + 0.05 * (level - 4)
    hd = 1.15 + 0.03 * (level - 4)
    hh = 0.72 + 0.045 * (level - 4)
    rh = 0.48 + 0.03 * (level - 4)
    cy = FY - hd/2
    fy = FY
    L.box("hall", (hx, cy, z0 + hh/2), (hb, hd, hh), M["wall"], bevel=0.02)
    L.box("plinth", (hx, cy, z0 + 0.07), (hb + 0.14, hd + 0.14, 0.14), M["wall_d"], bevel=0.02)
    L.box("tband", (hx, cy, z0 + hh - 0.05), (hb + 0.06, hd + 0.06, 0.09), M["cut"], bevel=0.01)
    L.hip_roof("dach", (hx, cy, z0 + hh + 0.02 + rh/2), hb + 0.30, hd + 0.30, rh, M["roof"])
    if level >= 10:                                 # Gold-First + Gold-Traufkante
        L.box("first", (hx, cy, z0 + hh + 0.02 + rh), ((hb + 0.30) * 0.42 + 0.12, 0.09, 0.07), M["gold"], bevel=0.01)
        L.box("traufe", (hx, cy, z0 + hh + 0.03), (hb + 0.34, hd + 0.34, 0.045), M["gold"], bevel=0.01)
    # Tür + Stufen
    obox("door", (hx, fy + 0.012, z0 + 0.32), (0.36, 0.05, 0.62), M["bore"])
    L.box("dframe", (hx, fy + 0.02, z0 + 0.66), (0.48, 0.08, 0.08), M["wall_d"], bevel=0.01)
    for i in range(2):
        L.box("stufe", (hx, fy + 0.14 + i * 0.11, z0 + 0.055 - i * 0.025), (0.5 + i * 0.12, 0.12, 0.07 - i * 0.02),
              M["cut"], bevel=0.01)
    if level >= 6:
        # Trophäen-Schilde an der Front
        for wx in (hx - 0.55, hx + 0.55):
            ts = L.cylinder("tschild", (wx, fy + 0.02, z0 + hh * 0.68), 0.115, 0.035,
                            M["cloth"] if level < 13 else M["rune_bar"], verts=12)
            ts.rotation_euler = (math.radians(90), 0, 0)
            sphere("tsboss", (wx, fy + 0.045, z0 + hh * 0.68), 0.035, WMAT)
    if level >= 7:
        # Säulen-PORTIKUS + Kronen-Zahnband (Diamant-Zähne)
        py_ = fy + 0.30
        kap_m = M["gold"] if level >= 11 else M["cut"]
        for px in (hx - 0.62, hx - 0.21, hx + 0.21, hx + 0.62):
            L.cylinder("saeule", (px, py_, z0 + hh * 0.44), 0.075, hh * 0.88, M["cut"], verts=12)
            L.box("kapitell", (px, py_, z0 + hh * 0.88 + 0.03), (0.20, 0.20, 0.06), kap_m, bevel=0.01)
        L.box("architrav", (hx, py_, z0 + hh * 0.88 + 0.10), (1.5, 0.24, 0.09), M["wall"], bevel=0.01)
        L.box("portdach", (hx, py_ - 0.06, z0 + hh * 0.88 + 0.17), (1.62, 0.44, 0.05), M["roof"], bevel=0.01)
        zahn_m = M["gold"] if level >= 10 else M["cut"]
        for k in range(5):                          # Kronen-Zahnband: Diamanten
            obox("zahn", (hx - 0.6 + k * 0.3, py_ + 0.13, z0 + hh * 0.88 + 0.10),
                 (0.085, 0.03, 0.085), zahn_m, rot=(0, math.radians(45), 0))
    if level >= 9:
        # Gold-Sonnen-Emblem am Portikus + Trophäen-Säulen m. Helmen
        ey, ez = fy + 0.435, z0 + hh * 0.88 + 0.17
        se = L.cylinder("sonne", (hx, ey, ez + 0.045), 0.055, 0.03, M["gold"], verts=12)
        se.rotation_euler = (math.radians(90), 0, 0)
        for k in range(8):
            phi = k * math.pi / 4
            obox("strahl", (hx + 0.085 * math.cos(phi), ey, ez + 0.045 + 0.085 * math.sin(phi)),
                 (0.038, 0.024, 0.018), M["gold"], rot=(0, -phi, 0))
        # Trophäen-Säulen flankieren den Weg VOR dem Vorhof (frei von Statue + Bogen)
        for tx in (hx - 0.70, hx + 0.70):
            L.cylinder("tsaeule", (tx, fy + 1.15, z0 + 0.19), 0.075, 0.38, M["cut"], verts=10)
            L.box("tsockel", (tx, fy + 1.15, z0 + 0.035), (0.24, 0.24, 0.07), M["wall_d"], bevel=0.01)
            helmet(tx, fy + 1.15, z0 + 0.42, 0.075, WMAT, M["cloth"])
    if level >= 11:
        # Gold-Lorbeerkranz an der Fassade über der Tür
        torus("kranz", (hx, fy + 0.03, z0 + hh * 0.74), 0.14, 0.030, M["gold"],
              rot=(math.radians(90), 0, 0))
    if level >= 12:
        # TRIUMPHBOGEN am Vorhof-Eingang + Gold-Flammen
        ty_ = fy + 1.02
        for px in (hx - 0.44, hx + 0.44):
            L.box("tbpfeiler", (px, ty_, z0 + 0.36), (0.16, 0.16, 0.72), M["wall"], bevel=0.01)
            L.box("tbkapp", (px, ty_, z0 + 0.755), (0.22, 0.22, 0.07), M["gold"], bevel=0.01)
        L.box("tbsturz", (hx, ty_, z0 + 0.84), (1.10, 0.14, 0.12), M["wall"], bevel=0.01)
        se2 = L.cylinder("tbsonne", (hx, ty_ - 0.075, z0 + 0.84), 0.05, 0.03, M["gold"], verts=12)
        se2.rotation_euler = (math.radians(90), 0, 0)
        obox("tbzinne", (hx, ty_, z0 + 0.925), (0.09, 0.09, 0.09), M["gold"], rot=(0, math.radians(45), 0))
    if level >= 13:
        # Arkan-Spitzturm auf dem First + Dach-Kristalle
        L.cone("spitz", (hx, cy, z0 + hh + 0.02 + rh + 0.20), 0.17, 0.02, 0.48, M["roof"], verts=10)
        L.crystal("spitzcrys", (hx, cy, z0 + hh + 0.02 + rh + 0.54), 0.05, 0.20, M["rune"])
        for sgn in (-1, 1):
            L.crystal("eckcrys", (hx + sgn * (hb/2 + 0.10), cy + hd/2 + 0.10, z0 + hh + 0.10), 0.045, 0.18, M["rune"])
    if level >= 14:
        # Glyphen am Architrav + Wand-Kristalle an den Frontecken
        for k in range(4):
            obox("glyph", (hx - 0.45 + k * 0.3, fy + 0.02, z0 + hh * 0.5), (0.05, 0.03, 0.13),
                 M["rune"], rot=(0, math.radians((k % 2) * 40 - 20), 0))
        for sgn in (-1, 1):
            obox("wkonsole", (hx + sgn * (hb/2 - 0.10), fy + 0.03, z0 + hh * 0.30), (0.12, 0.08, 0.05), M["wall_d"])
            L.crystal("wcrys", (hx + sgn * (hb/2 - 0.10), fy + 0.03, z0 + hh * 0.30 + 0.11), 0.04, 0.16, M["rune"])

# === HERZSTÜCK: Statue im Vorhof =============================================
zb, ph, pedr = hero_statue(sx, sy, st)

if level >= 5:
    # Feuerschalen an den freien Sockel-Ecken (skalieren mit dem Sockel mit)
    brazier(sx - pedr - 0.35, sy + 0.15, gold=(level >= 12))
    brazier(sx + 0.15, sy - pedr - 0.28, gold=(level >= 12))
if level >= 8:
    # Heldenbanner-Reihe (Bild: vorn rechts)
    cloth = M["rune_bar"] if level >= 13 else M["cloth"]
    L.banner("hban1", -1.45, 0.30, z0, 0.28, 0.38, M["wood_d"], cloth, WMAT, pole_h=1.25)
    L.banner("hban2", -1.45, 0.75, z0, 0.28, 0.38, M["wood_d"], cloth, WMAT, pole_h=1.25)
if level >= 14:
    # Runen-Ring um den Sockel
    L.box("runering", (sx, sy, z0 + 0.10), (pedr * 2 + 0.10, pedr * 2 + 0.10, 0.035), M["rune_bar"], bevel=0.0)
if level >= 15:
    # APOTHEOSE: Beschwörungskreis auf der freien Vorhoffläche rechts +
    # Energie-Adern, die SICHTBAR am Statuensockel beginnen und zum Kreis fließen
    ccx, ccy, cr = -1.05, 0.60, 0.38
    for k in range(6):
        phi = math.radians(k * 60 + 10)
        obox("ritual", (ccx + cr * math.cos(phi), ccy + cr * math.sin(phi), z0 + 0.013),
             (0.19, 0.05, 0.03), M["rune"], rot=(0, 0, phi + math.pi / 2))
    for k in range(3):
        phi = math.radians(k * 120 + 70)
        obox("ritudot", (ccx + cr * math.cos(phi), ccy + cr * math.sin(phi), z0 + 0.018),
             (0.05, 0.05, 0.04), M["rune"], rot=(0, 0, phi))
    # Ader Sockel → Kreis (3 Segmente entlang der Verbindungslinie)
    a0 = Vector((sx - pedr, sy, 0)); a1 = Vector((ccx + cr + 0.06, ccy, 0))
    adir = (a1 - a0)
    for si in range(3):
        p = a0 + adir * (0.14 + 0.36 * si)
        obox("ader", (p.x, p.y, z0 + 0.013), (0.30 - si * 0.05, 0.07 - si * 0.015, 0.03),
             M["rune_bar"], rot=(0, 0, math.atan2(adir.y, adir.x)))
    # zweite Ader nach vorn + Glyphendot am Ende
    obox("ader2", (sx, sy + pedr + 0.22, z0 + 0.013), (0.07, 0.30, 0.03), M["rune_bar"])
    obox("aderdot", (sx, sy + pedr + 0.45, z0 + 0.018), (0.06, 0.06, 0.04), M["rune"],
         rot=(0, 0, math.radians(45)))
    # Kristall-Cluster am Vorhofrand
    L.crystal("cc1", (1.70, -0.10, z0 + 0.18), 0.08, 0.42, M["rune"])
    L.crystal("cc2", (1.58, 0.08, z0 + 0.12), 0.055, 0.26, M["rune"])
    c3 = L.crystal("cc3", (1.80, 0.10, z0 + 0.10), 0.045, 0.20, M["rune"])
    c3.rotation_euler = (math.radians(14), 0, 0)

cam_scale = 5.0 + 0.15 * level
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.9)
L.setup_lights()
L.render_png(out, res=700)
