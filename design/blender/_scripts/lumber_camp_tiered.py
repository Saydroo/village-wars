"""Menschen-Holzfäller-Lager (lumber_camp), parametrisch über LEVEL 1..15.
blender -b --python lumber_camp_tiered.py -- <level> <out.png>
tier = tier_for_level(level), stage = (level-1)%3+1 (Baustufe 1..3 im Tier).

KONZEPT: offener Werkhof im Wald. NUTZER-VORGABEN (2026-07-02): Level 1 ist
FUNKTIONSTÜCHTIG (keine Ruine!) und JEDES Level unterscheidet sich SICHTBAR vom
vorherigen — kumulative Progression, jede Stufe fügt ein klar erkennbares neues
Element hinzu:
  L1  Stumpf+Axt, gefällter Stamm, leerer Sägebock, Setzling (karger Start)
  L2  +Stamm+Handsäge auf dem Bock, +kleiner Stapel, +Späne
  L3  +Lean-to-Pultdach über dem Bock, +größerer Stapel, +2. Baum
  L4  T2: richtiger Unterstand (Ziegeldach) ersetzt Lean-to, +Zaun-Ecke
  L5  +Schleifstein, +leerer Karren, +2. Stapel
  L6  +Rückwand mit WERKZEUGWAND (hängende Äxte/Säge), +Bretterstapel
  L7  T3: TISCHKREISSÄGE ersetzt den Sägebock, Karren voll Stämme
  L8  +Stamm-RUTSCHE (Rampe zur Werkbank), +2. Bretterstapel
  L9  +Lagerschuppen-Dach über den Brettern, +Banner
  L10 T4: größere Halle + Gold-First, +KRAN mit hängendem Stamm
  L11 +Bretter-Turm, +Gold-Sägenabe, +2. Banner
  L12 +goldenes Prunkaxt-Monument im Stumpf, +Gold-Streben
  L13 T5: violettes Dach, RUNEN-Sägeblatt, Kristall am First
  L14 +SCHWEBENDE Stämme (levitieren zur Säge)
  L15 +Runenkreis am Boden, +Kristall-Baum
Die Stämme bleiben IMMER Naturholz, nur Beschläge/Säge/Dach werden edler.
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_lumber_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

M = {
    "wood":   L.mat("wood",   T["wood"],   rough=0.9),
    "wood_d": L.mat("wood_d", T["wood_d"], rough=0.9),
    "accent": L.mat("accent", T["accent"], rough=(0.32 if T["gold"] else 0.85), metal=(0.9 if T["gold"] else 0.0)),
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
    "leaf":   L.mat("leaf",   (0.22, 0.46, 0.20), rough=1.0),
    "rock_d": L.mat("rock_d", (0.31, 0.30, 0.28), rough=1.0),
    "cloth":  L.mat("cloth",  T["accent"], rough=0.9),
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=1.1),
    "rune_bar": L.mat("rune_bar", (0.45, 0.68, 0.9), rough=0.35, emis=0.15),
}
s = T["scale"]
z0 = 0.42


def gold_or(mat_key):
    return M["accent"] if T["gold"] else M[mat_key]


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
    """Rotierbare Box (strut-Muster: skalieren -> rotieren -> DANN verschieben)."""
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


# ---------------------------------------------------------------------------
# Grassockel + Werkhof
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, -1.7*s), (1.95*s, 1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)
L.box("yard", (0.1, 0.25, 0.405), (3.0, 2.4, 0.045), M["dirt_l"], bevel=0.02)


def log_x(cx, cy, cz, length, r=0.14):
    rod((cx - length/2, cy, cz), (cx + length/2, cy, cz), r, M["bark"], "log")
    for e in (-1, 1):
        rod((cx + e*length/2, cy, cz), (cx + e*(length/2 + 0.02), cy, cz), r*0.82, M["cut"], "logcut")


def log_pile(cx, cy, n_base, length=1.5, r=0.15):
    rows = 0
    n = n_base
    while n >= 1:
        for i in range(n):
            off = (i - (n - 1)/2) * (2*r + 0.02)
            log_x(cx, cy + off, z0 + r + rows * (2*r*0.86), length, r)
        rows += 1
        n -= 1
    for sy in (-1, 1):
        yy = cy + sy*((n_base - 1)/2 * (2*r + 0.02) + r + 0.07)
        L.box("stake", (cx - length*0.32, yy, z0 + 0.22), (0.07, 0.07, 0.45), M["wood_d"], bevel=0.01)


def plank_stack(cx, cy, layers=4, w=1.1):
    """Stapel gesägter BRETTER (das Produkt des Sägewerks) — kreuzweise gelegt."""
    for i in range(layers):
        z = z0 + 0.05 + i * 0.09
        if i % 2 == 0:
            for k in (-1, 0, 1):
                L.box("plank", (cx, cy + k*0.18, z), (w, 0.15, 0.07), M["plank"], bevel=0.01)
        else:
            for k in (-1, 1):
                L.box("plankq", (cx + k*w*0.3, cy, z), (0.15, 0.55, 0.07), M["plank"], bevel=0.01)


def stump(cx, cy, r=0.2, h=0.28, axe=False, golden=False):
    L.cylinder("stump", (cx, cy, z0 + h/2), r, h, M["bark"], verts=12)
    L.cylinder("stumptop", (cx, cy, z0 + h + 0.01), r*0.86, 0.03, M["cut"], verts=12)
    if axe:
        hm = M["gold"] if golden else M["iron_d"]
        sc = 1.5 if golden else 1.0
        obox("axehead", (cx + 0.02, cy + 0.03, z0 + h + 0.06*sc), (0.07, 0.26*sc, 0.16*sc), hm,
             rot=(math.radians(-18), 0, 0))
        strut((cx + 0.02, cy + 0.06, z0 + h + 0.1), (cx + 0.34*sc, cy + 0.34*sc, z0 + h + 0.62*sc),
              0.05, M["wood"], "axehandle")


def pine(cx, cy, h=1.5, r=0.5):
    L.cylinder("trunk", (cx, cy, z0 + 0.25), 0.11, 0.5, M["bark_d"], verts=10)
    zc = z0 + 0.45
    for i in range(3):
        f = 1.0 - i * 0.28
        L.cone("crown", (cx, cy, zc + i * h * 0.26), r * f, 0.03, h * 0.42, M["leaf"], verts=9)


def crystal_pine(cx, cy):
    """T5: Baum mit Kristall-Krone statt Nadelgrün."""
    L.cylinder("trunk", (cx, cy, z0 + 0.3), 0.11, 0.6, M["bark_d"], verts=10)
    L.crystal("ckrone", (cx, cy, z0 + 1.0), 0.34, 0.9, M["rune_bar"])
    L.crystal("ckrone2", (cx + 0.18, cy + 0.1, z0 + 0.75), 0.16, 0.45, M["rune"])


def sawhorse(cx, cy, with_log=True):
    for ex in (-0.35, 0.35):
        strut((cx + ex - 0.18, cy - 0.2, z0), (cx + ex + 0.18, cy + 0.2, z0 + 0.5), 0.07, M["wood_d"], "xleg")
        strut((cx + ex - 0.18, cy + 0.2, z0), (cx + ex + 0.18, cy - 0.2, z0 + 0.5), 0.07, M["wood_d"], "xleg")
    if with_log:
        log_x(cx, cy, z0 + 0.52, 1.4, 0.13)
        obox("sawblade", (cx + 0.18, cy, z0 + 0.72), (0.02, 0.34, 0.3), M["iron"],
             rot=(0, math.radians(8), 0))
        L.box("sawgrip", (cx + 0.18, cy, z0 + 0.92), (0.06, 0.3, 0.07), M["wood_d"], bevel=0.01)


def lean_to(cx, cy):
    """Kleines Pultdach auf 2 hohen + 2 niedrigen Pfosten (Vorstufe zum Unterstand)."""
    for (px, ph_) in ((-0.7, 0.95), (0.7, 0.95)):
        L.box("lpost", (cx + px, cy - 0.45, z0 + ph_/2), (0.11, 0.11, ph_), M["wood_d"], bevel=0.01)
    for (px, ph_) in ((-0.7, 0.65), (0.7, 0.65)):
        L.box("lpost2", (cx + px, cy + 0.45, z0 + ph_/2), (0.11, 0.11, ph_), M["wood_d"], bevel=0.01)
    obox("lroof", (cx, cy, z0 + 0.92), (1.8, 1.35, 0.07), M["wood"],
         rot=(math.radians(-17), 0, 0))


def shelter(w, d, post_h, fancy=False, back_wall=False, tools=False):
    """Offener Unterstand auf 4 Pfosten; optional Rückwand mit Werkzeugwand."""
    cx, cy = -0.55, -0.55
    for px in (-1, 1):
        for py in (-1, 1):
            L.box("post", (cx + px*w/2, cy + py*d/2, z0 + post_h/2), (0.14, 0.14, post_h), M["wood_d"], bevel=0.02)
    L.box("beamF", (cx, cy + d/2, z0 + post_h + 0.06), (w + 0.3, 0.13, 0.12), M["wood"], bevel=0.02)
    L.box("beamB", (cx, cy - d/2, z0 + post_h + 0.06), (w + 0.3, 0.13, 0.12), M["wood"], bevel=0.02)
    L.roof_prism("roof", (cx, cy, z0 + post_h + 0.42), w + 0.55, d + 0.6, 0.6, M["roof"])
    if fancy:
        L.box("ridge", (cx, cy, z0 + post_h + 0.74), (w + 0.6, 0.12, 0.08), gold_or("wood_d"), bevel=0.02)
    if back_wall:
        L.box("bwall", (cx, cy - d/2 + 0.08, z0 + post_h*0.5), (w - 0.1, 0.1, post_h), M["wood"], bevel=0.02)
        if tools:
            wy = cy - d/2 + 0.16   # knapp VOR der Wand (Verdeckungs-Regel!)
            for (tx, tz) in ((cx - w*0.3, z0 + post_h*0.62), (cx + w*0.05, z0 + post_h*0.66)):
                strut((tx - 0.05, wy, tz - 0.25), (tx + 0.05, wy, tz + 0.25), 0.045, M["wood"], "taxehandle")
                obox("taxehead", (tx + 0.02, wy + 0.02, tz + 0.22), (0.2, 0.05, 0.12), M["iron_d"])
            obox("twsaw", (cx + w*0.32, wy, z0 + post_h*0.6), (0.5, 0.03, 0.16), M["iron"],
                 rot=(0, math.radians(12), 0))
    return cx, cy


def grindstone(cx, cy):
    """Schleifstein: rundes Steinrad im Holzgestell mit Kurbel."""
    for sy in (-0.14, 0.14):
        L.box("gleg", (cx, cy + sy, z0 + 0.2), (0.3, 0.06, 0.4), M["wood_d"], bevel=0.01)
    wheel = L.cylinder("gwheel", (cx, cy, z0 + 0.45), 0.26, 0.09, M["rock_d"], verts=16)
    wheel.rotation_euler = (math.radians(90), 0, 0)
    rod((cx, cy - 0.1, z0 + 0.45), (cx, cy + 0.16, z0 + 0.45), 0.03, M["iron_d"], "gaxle")
    strut((cx, cy + 0.16, z0 + 0.45), (cx + 0.14, cy + 0.16, z0 + 0.58), 0.035, M["wood"], "gcrank")


def circular_saw(cx, cy, glow=False, big=False, gold_hub=False, gold_teeth=False):
    r = 0.52 if big else 0.44
    bench_top = z0 + 0.38
    L.box("bench", (cx, cy, z0 + 0.3), (1.7, 0.7, 0.16), M["wood"], bevel=0.02)
    for px in (-0.7, 0.7):
        for py in (-0.22, 0.22):
            L.box("bleg", (cx + px, cy + py, z0 + 0.12), (0.1, 0.1, 0.26), M["wood_d"], bevel=0.01)
    blade_mat = M["rune_bar"] if glow else M["iron"]
    blade = L.cylinder("blade", (cx, cy, bench_top), r, 0.035, blade_mat, verts=20)
    blade.rotation_euler = (math.radians(90), 0, 0)
    hub_mat = M["rune"] if glow else (M["gold"] if gold_hub else M["iron_d"])
    hub = L.cylinder("bladehub", (cx, cy, bench_top + r*0.45), r*0.18, 0.06, hub_mat, verts=10)
    hub.rotation_euler = (math.radians(90), 0, 0)
    tooth_mat = M["gold"] if gold_teeth else blade_mat
    for k in range(7):
        a = math.radians(15 + k * 25)
        obox("tooth", (cx + math.cos(a)*r, cy, bench_top + math.sin(a)*r),
             (0.1, 0.03, 0.1), tooth_mat, rot=(0, -a, 0))
    log_x(cx - 0.58, cy - 0.04, bench_top + 0.1, 0.75, 0.10)


def log_cart(cx, cy, n_logs=0):
    L.box("cartbed", (cx, cy, z0 + 0.18), (1.0, 0.6, 0.1), M["wood"], bevel=0.02)
    for wx in (-0.34, 0.34):
        for wy in (-0.26, 0.26):
            w = L.cylinder("cwheel", (cx + wx, cy + wy, z0 - 0.06), 0.15, 0.08, M["wood_d"], verts=12)
            w.rotation_euler = (0, math.radians(90), 0)
    for rx in (-0.42, 0.42):
        for ry in (-0.32, 0.32):
            L.box("stake", (cx + rx, cy + ry, z0 + 0.5), (0.07, 0.07, 0.65), M["wood_d"], bevel=0.01)
    for i in range(n_logs):
        row, col = divmod(i, 2)
        log_x(cx, cy + (col - 0.5) * 0.29, z0 + 0.37 + row * 0.26, 1.15, 0.13)


def log_ramp(cx, cy):
    """Schräge Stamm-Rutsche: 2 Schienenbalken + 1 Stamm, der hinabrollt."""
    for sy in (-0.2, 0.2):
        strut((cx + 0.9, cy + sy, z0 + 0.55), (cx - 0.55, cy + sy, z0 + 0.08), 0.08, M["wood_d"], "rampbeam")
    r = rod((cx + 0.55, cy - 0.16, z0 + 0.55), (cx + 0.55, cy + 0.16, z0 + 0.55), 0.12, M["bark"], "ramplog")
    for st in (-0.15, 0.55, 1.15):
        L.box("rampleg", (cx + st + 0.15, cy, z0 + 0.14 + 0.12*(st + 0.3)), (0.07, 0.5, 0.07), M["wood_d"], bevel=0.01)


def shed(cx, cy):
    """Kleines Lagerschuppen-Dach über den Bretterstapeln (kompakt, hoch genug,
    dass die Bretter darunter sichtbar bleiben)."""
    for px in (-1, 1):
        for py in (-1, 1):
            L.box("shpost", (cx + px*0.55, cy + py*0.38, z0 + 0.5), (0.09, 0.09, 1.0), M["wood_d"], bevel=0.01)
    obox("shroof", (cx, cy, z0 + 1.06), (1.35, 1.0, 0.06), M["roof"], rot=(math.radians(-11), 0, 0))


def crane(cx, cy):
    """Holzkran: Mast + schräger Ausleger + Seil + hängender Stamm (T4-Signatur)."""
    L.box("cmast", (cx, cy, z0 + 0.95), (0.16, 0.16, 1.9), M["wood_d"], bevel=0.02)
    strut((cx, cy, z0 + 1.78), (cx - 0.95, cy + 0.55, z0 + 1.45), 0.11, M["wood"], "cjib")
    strut((cx, cy, z0 + 1.15), (cx - 0.62, cy + 0.36, z0 + 1.52), 0.07, M["wood"], "cbrace")
    rod((cx - 0.95, cy + 0.55, z0 + 1.45), (cx - 0.95, cy + 0.55, z0 + 0.85), 0.02,
        L.mat("rope", (0.28, 0.20, 0.11), rough=1.0), "crope")
    log_x(cx - 0.95, cy + 0.55, z0 + 0.72, 0.9, 0.11)
    L.box("cbase", (cx, cy, z0 + 0.06), (0.5, 0.5, 0.12), M["wood"], bevel=0.02)


def banner_at(cx, cy):
    L.banner("banner", cx, cy, z0, 0.34, 0.5, M["wood_d"], M["cloth"], gold_or("iron_d"), pole_h=1.5)


def rune_circle(cx, cy, r=1.15):
    """Flacher Runenring aus Bodenplatten + kleine Kristalle (T5-Finale)."""
    for k in range(10):
        a = k * math.pi * 2 / 10
        obox("runeseg", (cx + math.cos(a)*r, cy + math.sin(a)*r, z0 + 0.01),
             (0.3, 0.12, 0.04), M["rune_bar"], rot=(0, 0, a + math.pi/2))
    for k in range(4):
        a = math.pi/4 + k * math.pi/2
        L.crystal("rcrys", (cx + math.cos(a)*r, cy + math.sin(a)*r, z0 + 0.18), 0.09, 0.3, M["rune"])


def rune_obelisk(cx, cy):
    """T5-Signatur, fest am Boden (NICHTS schwebt — Nutzer-Feedback): dunkler,
    sich verjüngender Runen-Obelisk mit leuchtendem Runenband und Kristallspitze."""
    L.box("obase", (cx, cy, z0 + 0.12), (0.5, 0.5, 0.24), M["rock_d"], bevel=0.03)
    L.cone("oshaft", (cx, cy, z0 + 0.82), 0.24, 0.13, 1.2, M["iron_d"], verts=4)
    for hz in (0.55, 0.85, 1.15):
        L.box("oband", (cx, cy + 0.16 - hz*0.045, z0 + hz), (0.16, 0.08, 0.1), M["rune"], bevel=0.01)
    L.crystal("otip", (cx, cy, z0 + 1.55), 0.1, 0.32, M["rune"])
    for k in range(3):
        a = k * 2.1 + 0.5
        L.crystal("obasecrys", (cx + math.cos(a)*0.38, cy + math.sin(a)*0.34, z0 + 0.12),
                  0.06, 0.2, M["rune_bar"])


def wood_chips(cx, cy, n=5):
    for i in range(n):
        a = i * 2.2
        lump("chip", cx + math.cos(a)*0.3, cy + math.sin(a)*0.25, z0 + 0.03,
             0.07, 0.05, 0.03, M["cut"], subdiv=1)


# ---------------------------------------------------------------------------
# KUMULATIVE PROGRESSION — jedes Level fügt sichtbar etwas hinzu.
# Werkzentrum: Sägebock (L1-6) bzw. Kreissäge (L7+) bei (-0.55/-0.75, -0.35)
glow = (tier == 5)
rich = (tier >= 4)

# Basis (immer): Stumpf mit Axt + Setzling/Baum (L15: kristallisierter Wald)
stump(-1.5, 0.75, axe=True, golden=(level >= 12))
if level >= 15:
    crystal_pine(1.8, -1.5)
else:
    pine(1.8, -1.5, h=1.2 + 0.06*level)

if level == 1:
    # funktionstüchtiger Minimal-Start: leerer Bock, 1 gefällter Stamm
    sawhorse(-0.55, -0.35, with_log=False)
    log_x(0.85, 0.75, z0 + 0.14, 1.5)
    wood_chips(-0.4, 0.35, 3)

if level >= 2:
    if level < 7:
        sawhorse(-0.55 if level < 3 else -0.55, -0.35, with_log=True)
    log_pile(1.0, 0.75, n_base=2 if level < 3 else 3, length=1.45)
    wood_chips(-0.4, 0.35, 5)

if level == 3:
    lean_to(-0.55, -0.35)
    pine(-1.85, -1.3, h=1.35)

if level >= 4:
    if level >= 15:
        crystal_pine(-1.85, -1.3)
    else:
        pine(-1.85, -1.3, h=1.35 + 0.05*(level - 4))
    fence_x = -1.95
    for t in (0.0, 0.5, 1.0):
        L.box("fpost", (fence_x + t*0.9, 1.6, z0 + 0.22), (0.08, 0.08, 0.44), M["wood_d"], bevel=0.01)
    L.box("frail", (fence_x + 0.45, 1.6, z0 + 0.34), (1.0, 0.06, 0.06), M["wood"], bevel=0.01)

if 4 <= level <= 6:
    shelter(1.9, 1.5, 1.05, back_wall=(level == 6), tools=(level == 6))

if level >= 5:
    grindstone(0.75, -1.35)
    log_cart(-0.5, 1.3, n_logs=0 if level < 7 else 2 + min(stage, 2))

if level >= 6:
    plank_stack(1.35, -0.5, layers=3 + (1 if level >= 8 else 0))

if level >= 7:
    shelter(2.1, 1.6, 1.32 + 0.1*(tier - 3), fancy=rich,
            back_wall=(level >= 6), tools=(level >= 6))
    circular_saw(-0.75, -0.35, glow=glow, big=rich, gold_hub=(level >= 11),
                 gold_teeth=(level == 12))

if level >= 8:
    log_ramp(1.1, 0.1)
    plank_stack(1.5, -1.15, layers=3)

if level >= 9:
    shed(1.42, -0.75)
    banner_at(-1.75, 0.0)

if level >= 10:
    crane(0.9, 1.15)

if level >= 11:
    plank_stack(-1.55, 1.45, layers=6, w=0.9)
    banner_at(0.62, -1.5)

if level >= 12:
    for sx2 in (-1, 1):
        strut((-0.55 + sx2*1.05, 0.25, z0 + 1.0), (-0.55 + sx2*0.75, 0.25, z0 + 1.45 + 0.1*(tier-3)),
              0.06, M["gold"], "goldstrut")
    # Gold-Kappen auf allen 4 Unterstand-Pfosten
    ph12 = 1.32 + 0.1*(tier - 3)
    for px in (-1, 1):
        for py in (-1, 1):
            L.box("postcap", (-0.55 + px*1.05, -0.55 + py*0.8, z0 + ph12 + 0.02),
                  (0.2, 0.2, 0.08), M["gold"], bevel=0.02)

if level >= 13:
    L.crystal("roofcrystal", (-0.55, -0.55, z0 + 1.32 + 0.1*(tier-3) + 0.95), 0.14, 0.5, M["rune"])

if level >= 14:
    rune_obelisk(1.7, 1.45)

if level >= 15:
    # "Ascension"-Finale — alles GEERDET (nichts schwebt, Nutzer-Feedback):
    # 1) Runenkreis als "Säge-Aura" auf dem Hofboden um die Werkbank
    rune_circle(-0.55, -0.35, r=0.95)
    # 2) leuchtender Runen-First + Kristalle an den 4 Dachecken
    ph15 = 1.32 + 0.1*(tier - 3)
    L.box("runeridge", (-0.55, -0.55, z0 + ph15 + 0.76), (2.7, 0.1, 0.07), M["rune_bar"], bevel=0.02)
    for px in (-1, 1):
        for py in (-1, 1):
            L.crystal("eavecrys", (-0.55 + px*1.3, -0.55 + py*1.08, z0 + ph15 + 0.16),
                      0.07, 0.26, M["rune"])
    # 3) Energie-Ader im Boden: vom Obelisken zur Säge (flache Leuchtsegmente)
    ox, oy = 1.7, 1.45
    dxa, dya = -0.75 - ox, -0.35 - oy
    ang = math.atan2(dya, dxa)
    for t in (0.12, 0.5, 0.68, 0.88):
        obox("vein", (ox + dxa*t, oy + dya*t, z0 + 0.015), (0.42, 0.1, 0.035),
             M["rune_bar"], rot=(0, 0, ang))
    # 4) kristallisierter Prunk-Stamm oben auf dem großen Stapel
    rod((0.3, 0.75, z0 + 0.92), (1.7, 0.75, z0 + 0.92), 0.13, M["rune_bar"], "cryslog")
    for e in (-1, 1):
        rod((1.0 + e*0.7, 0.75, z0 + 0.92), (1.0 + e*0.72, 0.75, z0 + 0.92), 0.105, M["rune"], "cryslogcut")


cam_scale = 7.0 + (0.4 if level >= 10 else 0.0)
L.setup_iso_camera(ortho_scale=cam_scale, target_z=1.0 + (0.15 if level >= 10 else 0.0))
L.setup_lights()
L.render_png(out, res=700)
