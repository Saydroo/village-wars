"""Kanone (Verteidigung) — 15-Level-Schema, kumulative Sichtbar-Progression.

Silhouette: KANONE auf achteckiger Plattform, Rohr zeigt zur Front (+Y).
DESIGN-REGELN: L1 funktionstüchtig, jedes Level sichtbar anders, nichts schwebt,
Munition (Kugeln) bleibt IMMER eisern-dunkel (Ressourcen-Regel sinngemäß).
⚠️ Nutzer-Vorgabe: die UPGRADES ZEIGEN SICH ZUERST AN DER KANONE SELBST
(Rohr/Kaliber/Räder wachsen mit JEDEM Level + pro Level ein neues Bauteil an der
Waffe), die Umgebung ist nur Zweitschicht.
  Alle Rohre haben eine sichtbare MÜNDUNGSBOHRUNG (dunkle bore-Scheibe ragt aus
  der Rohrstirn). Rohr-Material je Tier: Gusseisen → BRONZE (T3) → poliert
  schwarz (T4) → Arkan (T5). Länge +0.075 und Kaliber +0.007 JE LEVEL.
  Waffen-Kette: L2 Richtkeil · L3 Holzbänder · L4 Eisenbänder + Wangenbeschlag ·
  L5 Mündungsring + Radreifen · L6 Knauf + Zündloch · L7 BOMBARDE (Kaliber-
  Sprung + Doppelring + Bronze) · L8 SCHUTZSCHILD · L9 Doppelreifen + dicke
  Verschlusswulst · L10 GOLD (Bänder/Mündung/Naben/Knauf) · L11 Goldringe +
  Gold-Kartusche · L12 Gold-MÜNDUNGSGLOCKE + Prunk-Kaliber · L13 ARKAN (Runen-
  bänder, Energiekanal, Kristall-Spike) · L14 Runen-Punkte am Rohr + Schild-
  Glyphe · L15 GLÜHRAND um die Mündung + Rohr-Kristalle
  Umgebung (Zweitschicht): L2 Fass/Pyramide · L3 Palisade · L4 Steinplattform ·
  L5 Sandsäcke · L6 Kohlebecken/Rack · L7 hohe Plattform · L8 Zinnen/Treppe ·
  L9 Banner · L10 Marmor · L11 Säulen · L12 Goldring Plattform · L13 Runenring ·
  L14 Obelisk/Glyphenplatten · L15 Energie-Ader/Zinnen-Kristalle
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_cannon_lvl{level:02d}.png")
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
    # Rohr wechselt Material je Tier (Gusseisen → BRONZE → poliert → Arkan);
    # Kugeln = MUNITION immer gleich dunkel (nie Tier-gefärbt)
    "barrel": L.mat("barrel", {
        1: (0.16, 0.17, 0.20), 2: (0.16, 0.17, 0.20),
        3: (0.40, 0.28, 0.16),
        4: (0.12, 0.13, 0.16),
        5: (0.13, 0.11, 0.18),
    }[tier], rough=(0.45 if tier >= 3 else 0.55), metal=0.75),
    "bore":   L.mat("bore",   (0.02, 0.02, 0.03), rough=1.0),
    "ball":   L.mat("ball",   (0.15, 0.16, 0.19), rough=0.5, metal=0.7),
    "wall":   L.mat("wall",   wc,   rough=1.0),
    "wall_d": L.mat("wall_d", wc_d, rough=1.0),
    "block":  L.mat("block",  bc,   rough=0.95),
    "cut":    L.mat("cut",    cc,   rough=0.9),
    "rope":   L.mat("rope",   (0.28, 0.20, 0.11), rough=1.0),
    "cloth":  L.mat("cloth",  T["accent"], rough=0.9),
    "sack":   L.mat("sack",   (0.60, 0.50, 0.36), rough=1.0),
    "ember":  L.mat("ember",  (1.0, 0.45, 0.12), rough=0.6, emis=0.8),
    "ember_b":L.mat("ember_b",(0.5, 0.75, 1.0), rough=0.6, emis=0.8),
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=1.1),
    "rune_bar": L.mat("rune_bar", (0.45, 0.68, 0.9), rough=0.35, emis=0.15),
}
s = T["scale"]
z0 = 0.42


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


# --- Grassockel ------------------------------------------------------------
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, -1.7*s), (1.95*s, 1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)
L.box("yard", (0.0, 0.35, 0.405), (3.2, 2.6, 0.045), M["dirt_l"], bevel=0.02)

# --- Plattform (wächst je Tier) ---------------------------------------------
plat_r = [0.95, 1.05, 1.25, 1.35, 1.40][tier - 1]
plat_h = [0.14, 0.24, 0.34, 0.40, 0.44][tier - 1]
px_c, py_c = 0.0, -0.15

if tier == 1:
    # Holz-Podest: Plankenscheibe auf dicken Balken
    L.cylinder("platw", (px_c, py_c, z0 + plat_h/2), plat_r, plat_h, M["wood"], verts=8)
    L.cylinder("platw2", (px_c, py_c, z0 + plat_h - 0.02), plat_r + 0.06, 0.05, M["wood_d"], verts=8)
    # Plankenfugen auf dem Deck, damit es als Holzpodest lesbar ist
    for k in (-0.5, -0.17, 0.17, 0.5):
        chord = 2 * math.sqrt(max(plat_r**2 - k**2, 0.05)) * 0.8
        obox("plank", (px_c + k, py_c, z0 + plat_h + 0.012), (0.045, chord, 0.025), M["wood_d"])
else:
    if tier >= 3:
        L.cylinder("platbase", (px_c, py_c, z0 + 0.09), plat_r + 0.22, 0.18, M["wall_d"], verts=8)
    L.cylinder("plat", (px_c, py_c, z0 + plat_h/2), plat_r, plat_h, M["wall"], verts=8)
    L.cylinder("platrim", (px_c, py_c, z0 + plat_h - 0.03), plat_r + 0.07, 0.07, M["cut"], verts=8)
plat_top = z0 + plat_h

if level == 12:
    # Gold-Zierring um die Plattformkante (L12-Signatur)
    L.cylinder("goldring", (px_c, py_c, plat_top - 0.10), plat_r + 0.10, 0.05, M["gold"], verts=8)
if level >= 13:
    # gedimmter Runen-Ring um die Plattformkante
    L.cylinder("runering", (px_c, py_c, plat_top - 0.10), plat_r + 0.10, 0.05, M["rune_bar"], verts=8)

# --- Kanone ------------------------------------------------------------------
# DIE KANONE TRÄGT DIE PROGRESSION: Rohr/Kaliber/Räder wachsen mit JEDEM Level,
# und pro Level kommt ein neues Bauteil an der Waffe dazu (Umgebung ist Zweitschicht):
#   L2 Richtkeil · L3 Holzbänder · L4 Eisenbänder+Wangenbeschlag · L5 Mündungsring+
#   Radreifen · L6 Knauf+Zündloch · L7 BOMBARDE (Kaliber-Sprung, Doppelring) ·
#   L8 Schutzschild · L9 Doppelreifen+Verschlusswulst · L10 GOLD (Bänder/Mündung/
#   Naben/Knauf) · L11 Extra-Goldringe+Goldkante Schild · L12 Mündungsglocke ·
#   L13 ARKAN (Runenbänder, Energiekanal, Kristall-Spike) · L14 Runen-Glyphe auf
#   Schild + Runenringe · L15 GLÜHENDE MÜNDUNG + Rohr-Kristalle
azim = math.radians(-14)             # kleine Drehung, Mündung Richtung unten-rechts
elev = math.radians(23)
dxy = Vector((math.sin(azim), math.cos(azim), 0.0))
ddir = Vector((dxy.x * math.cos(elev), dxy.y * math.cos(elev), math.sin(elev)))
q = Vector((dxy.y, -dxy.x, 0.0))     # Querrichtung (Radachse)
up = q.cross(ddir)
if up.z < 0:
    up = -up
up.normalize()

kf = (level - 1) / 14.0              # 0..1 über alle 15 Level
# steile Pro-Level-Sprünge: +0.075 Länge & +0.007 Kaliber JE Level, dazu
# Bombarden-Sprung bei L7 und Prunk-Sprung bei L12
barrel_len = 0.60 + 0.075 * (level - 1)
r1 = 0.085 + 0.007 * (level - 1) + (0.028 if level >= 7 else 0.0) + (0.018 if level >= 12 else 0.0)
r2 = r1 * 0.72
wheel_r = 0.14 + 0.008 * (level - 1)

base = Vector((px_c, py_c + 0.05, plat_top + wheel_r + 0.14))
p_breech = base - ddir * (barrel_len * 0.32)
p_muzzle = base + ddir * (barrel_len * 0.68)


def barrel_r_at(t):
    """Rohrradius an Position t (0=Basis-Anteil entlang ddir ab base)."""
    u = 0.32 + t
    return r1 - (r1 - r2) * u


rod(p_breech, p_muzzle, r1, M["barrel"], "barrel", r2=r2, verts=18)

# MÜNDUNGSBOHRUNG: dunkle Scheibe ragt minimal aus der Rohrstirn — liest sich
# als offenes Rohr (Boolean gibt es nicht); liegt vor Ring/Glocke/Glührand
rod(p_muzzle - ddir*0.02, p_muzzle + ddir*0.04, r2 * 0.70, M["bore"], "bore", verts=18)

# L2: Richtkeil unter dem Verschluss
if level >= 2:
    wp = base - ddir * (barrel_len * 0.26)
    obox("wedge", (wp.x, wp.y, plat_top + 0.065), (0.16, 0.20, 0.13), M["wood"], rot=(0, 0, -azim))

# Rohr-Bänder: L3 Holz, L4+ 3× Eisen, L10+ Gold, L13+ Runen (gedimmt)
if level >= 3:
    if level < 4:
        bmat, ts = M["wood_d"], (0.12, 0.38)
    else:
        bmat = M["rune_bar"] if level >= 13 else (M["gold"] if level >= 10 else M["iron_d"])
        ts = (0.08, 0.28, 0.48)
    for t in ts:
        c = base + ddir * (barrel_len * t)
        rod(c - ddir*0.026, c + ddir*0.026, barrel_r_at(t) + 0.012, bmat, "bband", verts=18)
# L11: zwei Gold-Zierringe + Gold-Kartusche (Plakette) oben auf dem Verschluss
if level >= 11:
    for t in (0.18, 0.38):
        c = base + ddir * (barrel_len * t)
        rod(c - ddir*0.016, c + ddir*0.016, barrel_r_at(t) + 0.014, M["gold"], "zring", verts=18)
    kp = base - ddir * (barrel_len * 0.16) + up * (barrel_r_at(-0.16) * 0.96)
    obox("kartusche", (kp.x, kp.y, kp.z), (0.10, 0.15, 0.035), M["gold"], rot=(0, 0, -azim))

# L5: Mündungsring (Eisen→Gold), L7: Doppelring, L12: Mündungsglocke
if level >= 5:
    mr_mat = M["gold"] if level >= 10 else M["iron_d"]
    rod(p_muzzle - ddir*0.08, p_muzzle + ddir*0.015, r2 + 0.03, mr_mat, "muzzle", verts=18)
    if level >= 7:
        rod(p_muzzle - ddir*0.17, p_muzzle - ddir*0.125, r2 + 0.022, mr_mat, "muzzle2", verts=18)
if level >= 12:
    rod(p_muzzle - ddir*0.14, p_muzzle + ddir*0.02, r2 * 0.95, M["gold"], "bell", r2=r2 * 1.3, verts=18)
# L15: Leuchtrand um die Mündungsbohrung (geladener Schuss)
if level >= 15:
    rod(p_muzzle - ddir*0.005, p_muzzle + ddir*0.028, r2 * 0.92, M["rune"], "muzzglow", verts=18)

# L6: Verschluss-Knauf + Zündloch-Beschlag; L13: Kristall-Spike statt Knauf
if level >= 13:
    rod(p_breech, p_breech - ddir*0.2, r1*0.5, M["rune"], "cryspike", r2=0.006, verts=10)
elif level >= 6:
    knob_mat = M["gold"] if level >= 10 else M["barrel"]
    lump("knob", p_breech.x - ddir.x*0.07, p_breech.y - ddir.y*0.07, p_breech.z - ddir.z*0.07,
         r1*0.55, r1*0.55, r1*0.55, knob_mat, subdiv=2, smooth=True)
if level >= 6:
    zl = base - ddir * (barrel_len * 0.22) + up * (barrel_r_at(-0.22) * 0.92)
    obox("vent", (zl.x, zl.y, zl.z), (0.06, 0.09, 0.035), M["iron_d"], rot=(0, 0, -azim))

# L9: Verschlusswulst (dicker Ring am Rohransatz)
if level >= 9:
    wmat = M["gold"] if level >= 10 else M["iron_d"]
    c = base - ddir * (barrel_len * 0.28)
    rod(c - ddir*0.038, c + ddir*0.038, barrel_r_at(-0.28) + 0.030, wmat, "breechring", verts=18)

# L14: leuchtende Runen-Punkte auf der kamerazugewandten Rohrseite
if level >= 14:
    for t in (0.30, 0.40, 0.50):
        c = base + ddir * (barrel_len * t) + q * (barrel_r_at(t) * 0.92)
        obox("runedot", (c.x, c.y, c.z), (0.05, 0.05, 0.05), M["rune"], rot=(0, 0, -azim))

# L13: Energiekanal längs der Rohr-Oberseite
if level >= 13:
    e1 = base + ddir * (barrel_len * 0.02) + up * (barrel_r_at(0.02) * 0.95)
    e2 = base + ddir * (barrel_len * 0.52) + up * (barrel_r_at(0.52) * 0.95)
    rod(e1, e2, 0.022, M["rune_bar"], "echan", verts=8)
# L15: zwei Kristall-Finnen auf dem Rohr
if level >= 15:
    for t in (0.16, 0.34):
        cpos = base + ddir * (barrel_len * t) + up * (barrel_r_at(t) * 0.75)
        L.crystal("barcrys", (cpos.x, cpos.y, cpos.z + 0.055), 0.035, 0.13, M["rune"])

# Lafette: 2 Holz-Wangen + Achse + Räder (wachsen mit)
cheek_len = 0.50 + 0.35 * kf
for sgn in (-1, 1):
    ck = base + q * (sgn * (r1 + 0.055)) - ddir * 0.05
    obox("cheek", (ck.x, ck.y, plat_top + (wheel_r + 0.10)/2),
         (0.09, cheek_len, wheel_r + 0.10), M["wood_d"], rot=(0, 0, -azim))
    # L4: Eisenbeschlag auf den Wangenoberkanten
    if level >= 4:
        obox("cheekiron", (ck.x, ck.y, plat_top + wheel_r + 0.10 + 0.012),
             (0.10, cheek_len * 0.9, 0.024), M["iron_d"], rot=(0, 0, -azim))
axle = base - ddir * 0.05
half_track = 0.34 + 0.14 * kf
rod((axle.x - q.x*(half_track + 0.02), axle.y - q.y*(half_track + 0.02), plat_top + wheel_r),
    (axle.x + q.x*(half_track + 0.02), axle.y + q.y*(half_track + 0.02), plat_top + wheel_r),
    0.045, M["wood_d"], "axle")
for sgn in (-1, 1):
    wc_ = Vector((axle.x, axle.y, plat_top + wheel_r)) + q * (sgn * half_track)
    rod((wc_.x - q.x*0.035, wc_.y - q.y*0.035, wc_.z), (wc_.x + q.x*0.035, wc_.y + q.y*0.035, wc_.z),
        wheel_r, M["wood"], "wheel", verts=16)
    if level >= 5:   # Eisen-Radreifen
        rod((wc_.x - q.x*0.04, wc_.y - q.y*0.04, wc_.z), (wc_.x + q.x*0.04, wc_.y + q.y*0.04, wc_.z),
            wheel_r + 0.018, M["iron_d"], "tire", verts=16)
    if level >= 9:   # Doppelreifen
        rod((wc_.x - q.x*0.045, wc_.y - q.y*0.045, wc_.z), (wc_.x + q.x*0.045, wc_.y + q.y*0.045, wc_.z),
            wheel_r + 0.032, M["iron_d"], "tire2", verts=16)
    hub_mat = M["gold"] if level >= 10 else M["wood_d"]
    rod((wc_.x - q.x*0.05, wc_.y - q.y*0.05, wc_.z), (wc_.x + q.x*0.05, wc_.y + q.y*0.05, wc_.z),
        0.05, hub_mat, "hub", verts=10)

# L8: Eisen-Schutzschild beidseits des Rohrs (steht auf der Plattform)
if level >= 8:
    sh_h = 0.46 + 0.10 * kf
    sh_c = base + dxy * 0.30
    tilt = math.radians(-12)
    for sgn in (-1, 1):
        sc = sh_c + q * (sgn * (r1 + 0.26))
        # Zentrum leicht abgesenkt: die gekippte Unterkante sinkt minimal in die
        # Plattform ein statt eine Schwebe-Fuge zu zeigen
        obox("shield", (sc.x, sc.y, plat_top + sh_h/2 - 0.012),
             (0.34, 0.045, sh_h), M["iron_d"], rot=(tilt, 0, -azim))
        if level >= 11:  # Goldkante oben (überlappt die gekippte Oberkante)
            tz = plat_top + sh_h - 0.03
            obox("shgold", (sc.x - dxy.x*0.05, sc.y - dxy.y*0.05, tz),
                 (0.36, 0.05, 0.04), M["gold"], rot=(tilt, 0, -azim))
        if level >= 14 and sgn == 1:  # Runen-Glyphe steckt in der Schildplatte
            gp = sc + dxy * 0.01
            obox("shgly1", (gp.x, gp.y, plat_top + sh_h*0.52), (0.05, 0.07, 0.16),
                 M["rune"], rot=(tilt, 0, -azim))
            obox("shgly2", (gp.x, gp.y, plat_top + sh_h*0.68), (0.13, 0.07, 0.045),
                 M["rune"], rot=(tilt, 0, -azim))

# --- Munition & Zubehör ------------------------------------------------------
def ball(cx, cy, cz, r=0.085):
    lump("ball", cx, cy, cz, r, r, r, M["ball"], subdiv=2, smooth=True)


def ball_pyramid(cx, cy, n=2):
    r = 0.085
    for i in range(n):
        for j in range(n):
            ball(cx + (i - (n-1)/2)*2*r, cy + (j - (n-1)/2)*2*r, z0 + r)
    if n >= 2:
        for i in range(n - 1):
            for j in range(n - 1):
                ball(cx + (i - (n-2)/2)*2*r, cy + (j - (n-2)/2)*2*r, z0 + r + 2*r*0.82)
    if n >= 3:
        ball(cx, cy, z0 + r + 4*r*0.82)


def powder_keg(cx, cy, lying=False):
    if lying:
        o = L.cylinder("keg", (cx, cy, z0 + 0.14), 0.14, 0.3, M["wood"], verts=14)
        o.rotation_euler = (0, math.radians(90), math.radians(25))
    else:
        L.cylinder("keg", (cx, cy, z0 + 0.16), 0.14, 0.32, M["wood"], verts=14)
        for hz in (0.07, 0.25):
            L.cylinder("kegband", (cx, cy, z0 + hz), 0.148, 0.03, M["iron_d"], verts=14)
        L.cylinder("keglid", (cx, cy, z0 + 0.33), 0.10, 0.03, M["wood_d"], verts=12)


def ramrod_lean(cx, cy):
    """Ladestock lehnt an der Plattformkante (Fuß am Boden, Kopf auf Kante)."""
    rod((cx, cy, z0 + 0.01), (px_c + (cx - px_c)*0.45, py_c + (cy - py_c)*0.45, plat_top + 0.04),
        0.022, M["wood"], "ramrod")
    lump("swab", cx, cy, z0 + 0.03, 0.05, 0.05, 0.04, M["sack"])


def sandbags(cx, cy, n=4):
    for i in range(n):
        a = math.radians(-30 + i * 24)
        bx = cx + 0.5 * math.sin(a); by = cy + 0.25 * math.cos(a)
        lump("sbag", bx, by, z0 + 0.075, 0.16, 0.11, 0.08, M["sack"], subdiv=2, smooth=True)
    for i in range(n - 1):
        a = math.radians(-18 + i * 24)
        bx = cx + 0.5 * math.sin(a); by = cy + 0.25 * math.cos(a)
        lump("sbag2", bx, by, z0 + 0.2, 0.15, 0.10, 0.075, M["sack"], subdiv=2, smooth=True)


def brazier(cx, cy):
    L.cylinder("brz", (cx, cy, z0 + 0.1), 0.11, 0.2, M["iron_d"], verts=10)
    em = M["ember_b"] if level >= 13 else M["ember"]
    lump("glow", cx, cy, z0 + 0.22, 0.08, 0.08, 0.05, em, subdiv=2, smooth=True)


def ball_rack(cx, cy, ang=0.0):
    """Holzrahmen mit 3 Kugeln in Reihe."""
    obox("rackb", (cx, cy, z0 + 0.05), (0.62, 0.2, 0.1), M["wood_d"], rot=(0, 0, ang))
    ca, sa = math.cos(ang), math.sin(ang)
    for k in (-0.18, 0.0, 0.18):
        ball(cx + k*ca, cy + k*sa, z0 + 0.10 + 0.075, r=0.075)


def palisade_arc(r_off=0.35):
    """Holz-Palisadenbogen hinter der Kanone."""
    for k in range(7):
        phi = math.radians(195 + k * 22)
        bx = px_c + (plat_r + r_off) * math.cos(phi)
        by = py_c + (plat_r + r_off) * math.sin(phi)
        h = 0.42 + (0.05 if k % 2 else 0)
        L.cylinder("pal", (bx, by, z0 + h/2), 0.055, h, M["wood_d"], verts=8)


def merlons(gold_caps=False):
    """Stein-Zinnen auf dem hinteren Plattformrand."""
    tops = []
    for k in range(7):
        phi = math.radians(190 + k * 23)
        bx = px_c + (plat_r - 0.09) * math.cos(phi)
        by = py_c + (plat_r - 0.09) * math.sin(phi)
        obox("merlon", (bx, by, plat_top + 0.11), (0.17, 0.12, 0.22), M["cut"], rot=(0, 0, phi))
        if gold_caps:
            obox("mercap", (bx, by, plat_top + 0.245), (0.19, 0.14, 0.05), M["gold"], rot=(0, 0, phi))
        tops.append((bx, by, plat_top + 0.22 + (0.07 if gold_caps else 0)))
    return tops


def pillar(cx, cy):
    L.box("pilbase", (cx, cy, z0 + 0.07), (0.3, 0.3, 0.14), M["wall_d"], bevel=0.02)
    L.cylinder("pilshaft", (cx, cy, z0 + 0.14 + 0.4), 0.1, 0.8, M["block"], verts=12)
    cap_mat = M["gold"] if level >= 11 else M["cut"]
    L.box("pilcap", (cx, cy, z0 + 0.99), (0.26, 0.26, 0.09), cap_mat, bevel=0.02)


def rune_obelisk(cx, cy):
    L.box("obase", (cx, cy, z0 + 0.09), (0.42, 0.42, 0.18), M["wall_d"], bevel=0.02)
    obox("oshaft", (cx, cy, z0 + 0.62), (0.24, 0.24, 0.9), M["cut"])
    for gz in (0.35, 0.62, 0.89):
        obox("ogly", (cx, cy + 0.13, z0 + gz), (0.1, 0.03, 0.1), M["rune"])
    L.crystal("otip", (cx, cy, z0 + 1.2), 0.09, 0.26, M["rune"])


# --- Level-Kette -------------------------------------------------------------
def at_edge(ang_deg, extra):
    """Position außerhalb der Plattformkante — Requisiten wandern mit dem
    Plattformradius mit (sonst stecken sie bei T4/T5 in der Plattform)."""
    a = math.radians(ang_deg)
    rr = plat_r + 0.22 + extra
    return (px_c + rr * math.cos(a), py_c + rr * math.sin(a))


pyr_x, pyr_y = at_edge(30, 0.25)
ball_pyramid(pyr_x, pyr_y, n=2 if level >= 2 else 1)
if level == 1:
    ball(pyr_x + 0.02, pyr_y - 0.20, z0 + 0.085)
    ball(pyr_x - 0.17, pyr_y + 0.10, z0 + 0.085)

# Ladestock lehnt immer an der Plattform (Gestell las sich im Render wirr)
lnx, lny = at_edge(128, 0.55)
ramrod_lean(lnx, lny)

if level >= 2:
    kx_, ky_ = at_edge(157, 0.15)
    powder_keg(kx_, ky_)

if 3 <= level < 8:
    palisade_arc()

if level >= 5:
    sx_, sy_ = at_edge(85, 0.35)
    sandbags(sx_, sy_)
    lx_, ly_ = at_edge(170, 0.2)
    powder_keg(lx_, ly_, lying=True)

if level >= 6:
    bx_, by_ = at_edge(40, 0.3)
    brazier(bx_, by_)
    rx_, ry_ = at_edge(100, 0.3)
    ball_rack(rx_, ry_, ang=math.radians(12))

if level >= 8:
    # Treppenstufen liegen an der Plattform-Frontflanke an
    sxs = plat_r * 0.45
    eys = py_c + math.sqrt(plat_r**2 - sxs**2) * 0.94
    obox("step1", (px_c + sxs, eys + 0.11, z0 + plat_h*0.32), (0.5, 0.24, plat_h*0.64), M["wall_d"])
    obox("step2", (px_c + sxs, eys + 0.33, z0 + plat_h*0.16), (0.5, 0.22, plat_h*0.32), M["wall_d"])
    merlon_tops = merlons(gold_caps=(level >= 12))
else:
    merlon_tops = []

if level >= 9:
    L.banner("ban", -1.85, 1.35, z0, 0.34, 0.42, M["wood_d"], M["cloth"], M["gold"], pole_h=1.5)
    gx_, gy_ = at_edge(0, 0.28)
    ball_pyramid(gx_, gy_, n=3)

if level >= 11:
    p1x, p1y = at_edge(226, 0.35)
    p2x, p2y = at_edge(310, 0.3)
    pillar(p1x, p1y)
    pillar(p2x, p2y)
    r2x, r2y = at_edge(117, 0.45)
    ball_rack(r2x, r2y, ang=math.radians(-8))

if level >= 14:
    ox_, oy_ = at_edge(14, 0.35)
    rune_obelisk(ox_, oy_)
    # Glyphenplatten tangential zur Plattform = Runenkreis-Fragmente
    for adeg in (135, 71):
        gx_, gy_ = at_edge(adeg, 0.3)
        obox("gplate", (gx_, gy_, z0 + 0.015), (0.38, 0.16, 0.035), M["rune_bar"],
             rot=(0, 0, math.radians(adeg + 90)))

if level >= 15:
    ox_, oy_ = at_edge(14, 0.35)
    dxa, dya = px_c - ox_, py_c - oy_
    ang = math.atan2(dya, dxa)
    # kurze Ader-Segmente NUR zwischen Obelisk-Fuß und Plattformkante
    for t in (0.08, 0.2):
        obox("evein", (ox_ + dxa*t, oy_ + dya*t, z0 + 0.015), (0.26, 0.09, 0.035),
             M["rune_bar"], rot=(0, 0, ang))
    if merlon_tops:
        for (bx, by, bz) in (merlon_tops[1], merlon_tops[5]):
            L.crystal("mercrys", (bx, by, bz + 0.09), 0.06, 0.2, M["rune"])

cam_scale = 5.4 + [0.0, 0.2, 0.5, 0.7, 0.8][tier - 1] + (0.2 if level >= 14 else 0.0)
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.75)
L.setup_lights()
L.render_png(out, res=700)
