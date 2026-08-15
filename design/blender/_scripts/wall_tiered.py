"""Mauer (Verteidigung) — 15-Level-Schema, kumulative Sichtbar-Progression.

Silhouette: EIN MAUERSEGMENT entlang X (Kamera sieht die +Y-Front), mit
Eckpfeilern. Die MAUER trägt die Progression: Höhe wächst mit jedem Level,
Material je Tier (Palisade → Stein → Sandstein-Burg → Marmor+Gold → Arkan).
DESIGN-REGELN: L1 funktionstüchtig, jedes Level sichtbar anders, nichts schwebt.
  L1  Holzpalisade (angespitzte Pfähle + Querriegel)
  L2  +höher, +2. Querriegel, +Eisenbänder an den Endpfählen
  L3  +höher, +Stützstreben hinten, +Eisenkappen auf Endpfählen (T1 max)
  L4  T2: STEINMAUER massiv + Eckpfeiler + Sockelleiste
  L5  +höher, +Fugenlinien, +Kammleiste oben
  L6  +4 ZINNEN auf der Krone
  L7  T3: Burgmauer hoch, Eckpfeiler mit Kappen, 5 Zinnen
  L8  +WAPPENSCHILD vorn Mitte
  L9  +Pyramiden-Spitzen auf Pfeilern, +Bossenreihe am Sockel
  L10 T4: Marmor, +GOLD-Pfeilerkappen
  L11 +Gold-Zierband unter der Krone
  L12 +Gold-Zinnenkappen + Gold-Wappenrahmen
  L13 T5: Arkanstein, RUNEN-Fugen leuchten, Wappen wird Runen-Tafel
  L14 +2 Runen-Glyphen an der Front, +Kristalle auf den Pfeilern
  L15 +leuchtender Runen-Kamm über der Krone, +große Eck-Kristalle, +Energie-Adern
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_wall_lvl{level:02d}.png")
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
    "cloth":  L.mat("cloth",  T["accent"], rough=0.9),
    "bore":   L.mat("bore",   (0.04, 0.04, 0.05), rough=1.0),
    "ember":  L.mat("ember",  (1.0, 0.55, 0.15), rough=0.6, emis=0.9),
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


# --- Grassockel (kompakt für ein Mauersegment) -------------------------------
L.box("dirt",   (0, 0, 0.13), (4.4*s, 3.4*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.0*s, 3.0*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.5*s, 2.6*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.55*s, -0.95*s), (1.6*s, 0.9*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.16, 0.12, M["moss"], verts=10)
L.box("bed", (0, 0, 0.405), (3.0, 1.15, 0.045), M["dirt_l"], bevel=0.02)

wall_len = 2.2
half = wall_len / 2

def torch(x, fy, zb):
    """Wandfackel: Eisenhalter an der Front + schräger Stab + Flamme AM Stab."""
    obox("thalter", (x, fy + 0.025, zb), (0.07, 0.07, 0.10), M["iron_d"])
    p2 = (x, fy + 0.15, zb + 0.26)
    a = Vector((x, fy + 0.01, zb - 0.03)); b = Vector(p2); mid = (a + b) / 2; d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.032, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = "torch"
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    o.data.materials.append(M["wood_d"])
    # Flamme überlappt die Stabspitze (fest verbunden, keine Schwebe-Optik)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(p2[0], p2[1], p2[2] + 0.035))
    f = bpy.context.active_object
    f.name = "flame"
    f.scale = (0.062, 0.062, 0.115)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    f.data.materials.append(M["ember"])


def spike_lean(sx):
    """Anti-Sturm-Spieß: schräg nach vorn-oben, Fuß im Boden."""
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.052, radius2=0.005, depth=0.72, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = "spike"
    d = Vector((0, 0.42, 0.52)); d.normalize()
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (sx, 0.42, z0 + 0.20)
    o.data.materials.append(M["wood_d"])


# =============================================================================
if tier == 1:
    # --- HOLZPALISADE --------------------------------------------------------
    pal_h = 0.78 + 0.13 * (level - 1)
    n = 9
    xs = [(-half + 0.06) + i * (wall_len - 0.12) / (n - 1) for i in range(n)]
    for i, x in enumerate(xs):
        h = pal_h + (0.035 if i % 2 else 0.0)
        end_post = (i == 0 or i == n - 1)
        r = 0.105 if end_post else 0.085
        L.cylinder("post", (x, 0, z0 + h/2), r, h, M["wood"] if i % 2 else M["wood_d"], verts=10)
        if end_post and level >= 3:
            # Eisenkappe statt Holzspitze auf den Endpfählen
            L.cylinder("postcap", (x, 0, z0 + h + 0.03), r + 0.015, 0.07, M["iron_d"], verts=10)
        else:
            L.cone("tip", (x, 0, z0 + h + 0.08), r, 0.012, 0.17, M["wood_d"] if i % 2 else M["wood"], verts=10)
        if end_post and level >= 2:
            L.cylinder("postband", (x, 0, z0 + h * 0.55), r + 0.014, 0.055, M["iron_d"], verts=10)
    # Querriegel vorn
    L.box("rail1", (0, 0.13, z0 + pal_h * 0.42), (wall_len, 0.07, 0.10), M["wood_d"], bevel=0.01)
    if level >= 2:
        L.box("rail2", (0, 0.13, z0 + pal_h * 0.74), (wall_len, 0.07, 0.10), M["wood_d"], bevel=0.01)
        torch(0.0, 0.17, z0 + pal_h * 0.55)
    if level >= 3:
        # Anti-Sturm-Spieße vorn + Stützstreben hinten
        for sx in (-0.72, 0.0, 0.72):
            spike_lean(sx)
        for x in (-0.62, 0.62):
            strut((x, -0.52, z0 + 0.01), (x, -0.09, z0 + pal_h * 0.72), 0.07, M["wood"], "brace")
            L.box("bracefoot", (x, -0.52, z0 + 0.035), (0.14, 0.14, 0.07), M["wood_d"], bevel=0.01)
else:
    # --- STEINMAUER -----------------------------------------------------------
    wall_h = 0.70 + 0.055 * (level - 4)
    body_d = 0.40
    fy = body_d / 2                     # Frontebene
    L.box("body", (0, 0, z0 + wall_h/2), (wall_len, body_d, wall_h), M["wall"], bevel=0.03)
    # sichtbare BLOCK-Struktur: vorstehende Einzelquader auf der Front verteilt
    # (untere Wandzone; lässt Platz für Blendbögen/Wappen weiter oben)
    for i in range(8):
        bx = -0.92 + i * 0.263
        if level >= 7 and abs(abs(bx) - 0.78) < 0.20:
            continue                     # Platz für die Blendbogen-Nischen
        bz = min(0.10 + ((i * 37) % 4) * 0.12, wall_h * 0.45)
        bmat = M["cut"] if i % 3 else M["wall_d"]
        L.box("blockrelief", (bx, 0, z0 + bz + 0.08), (0.22 + (i % 2) * 0.06, body_d + 0.035, 0.15),
              bmat, bevel=0.02)
    # Sockelleiste
    L.box("plinth", (0, 0, z0 + 0.07), (wall_len + 0.12, body_d + 0.12, 0.14), M["wall_d"], bevel=0.02)
    # Eckpfeiler
    pil_h = wall_h + 0.16
    for x in (-half - 0.08, half + 0.08):
        L.box("pillar", (x, 0, z0 + pil_h/2), (0.46, 0.54, pil_h), M["wall_d"], bevel=0.03)
        cap_mat = M["gold"] if level >= 10 else M["cut"]
        L.box("pilcap", (x, 0, z0 + pil_h + 0.045), (0.54, 0.62, 0.09), cap_mat, bevel=0.02)
        if level >= 9:
            # Pyramiden-Spitze (ab T4 gold)
            tip_mat = M["gold"] if level >= 10 else M["cut"]
            L.cone("piltip", (x, 0, z0 + pil_h + 0.09 + 0.11), 0.24, 0.015, 0.22, tip_mat, verts=4)
        if level >= 14:
            # Pfeiler werden Runen-Obelisken: leuchtende Ringe + Kristall
            for rz in (0.35, 0.62):
                obox("pilring", (x, 0, z0 + pil_h * rz), (0.50, 0.58, 0.045), M["rune_bar"])
            czt = z0 + pil_h + 0.09 + (0.22 if level >= 9 else 0.0)
            csize = 0.30 if level >= 15 else 0.22
            L.crystal("pilcrys", (x, 0, czt + csize/2 - 0.07), 0.09, csize, M["rune"])
            if level >= 15:
                # Kristall-CLUSTER: zwei kleinere, schräg gekippte Nebenkristalle
                for (dx2, dy2, sc, tilt) in ((0.15, 0.10, 0.62, 14), (-0.14, -0.08, 0.5, -12)):
                    c2 = L.crystal("pilcrys2", (x + dx2, dy2, czt + csize*sc/2 - 0.10),
                                   0.055, csize * sc, M["rune"])
                    c2.rotation_euler = (math.radians(-tilt * 0.6), math.radians(tilt), 0)
        elif level >= 8:
            # Wimpel-Fahnen auf den Eckpfeilern (bis der Kristall sie ersetzt)
            pole_top = z0 + pil_h + 0.09 + (0.22 if level >= 9 else 0.0)
            L.cylinder("wpole", (x, 0, pole_top + 0.17), 0.022, 0.38, M["wood_d"], verts=8)
            obox("wflag", (x + 0.11, 0, pole_top + 0.28), (0.20, 0.025, 0.12), M["cloth"])
    # Fugenlinien (ragen minimal aus der Front)
    if level >= 5:
        fmat = M["rune_bar"] if level >= 13 else M["wall_d"]
        for fz in (0.38, 0.62):
            L.box("fuge", (0, 0, z0 + wall_h * fz), (wall_len, body_d + 0.02, 0.025), fmat, bevel=0.0)
    # Kammleiste oben + FACKELN an den Pfeilerfronten
    if level >= 5:
        L.box("kamm", (0, 0, z0 + wall_h - 0.035), (wall_len + 0.06, body_d + 0.08, 0.07), M["cut"], bevel=0.02)
        for tx in (-half - 0.08, half + 0.08):
            torch(tx, 0.28, z0 + wall_h * 0.55)
    # Schießscharten (dunkle Schlitze, ab T5 leuchtend)
    if level >= 6:
        sc_mat = M["rune"] if level >= 13 else M["bore"]
        for x in (-0.42, 0.42):
            L.box("scharte", (x, fy + 0.008, z0 + wall_h * 0.58), (0.055, 0.03, 0.30), sc_mat, bevel=0.0)
    # Blendbogen-Nischen an der Front
    if level >= 7:
        for x in (-0.78, 0.78):
            L.box("bogen_r", (x, fy + 0.005, z0 + wall_h * 0.30), (0.26, 0.025, 0.30), M["wall_d"], bevel=0.0)
            c = L.cylinder("bogen_c", (x, fy + 0.005, z0 + wall_h * 0.30 + 0.15), 0.13, 0.025, M["wall_d"], verts=16)
            c.rotation_euler = (math.radians(90), 0, 0)
    # L11: Gold-Zierband unter der Krone
    if level >= 11:
        L.box("goldband", (0, 0, z0 + wall_h - 0.115), (wall_len + 0.02, body_d + 0.03, 0.045),
              M["gold"], bevel=0.01)
    # Zinnen
    if level >= 6:
        nz = 5 if level >= 7 else 4
        zx = [(-0.82) + i * 1.64 / (nz - 1) for i in range(nz)]
        for x in zx:
            if level >= 15 and abs(x) < 0.05:
                # L15: ARKAN-MONOLITH ersetzt die mittlere Zinne (Silhouette!)
                obox("monolith", (0, 0, z0 + wall_h + 0.27), (0.30, 0.34, 0.54), M["wall_d"])
                obox("monogly1", (0, 0.18, z0 + wall_h + 0.24), (0.06, 0.03, 0.16), M["rune"])
                obox("monogly2", (0, 0.18, z0 + wall_h + 0.38), (0.13, 0.03, 0.05), M["rune"])
                L.crystal("monocrys", (0, 0, z0 + wall_h + 0.54 + 0.13), 0.08, 0.30, M["rune"])
                continue
            L.box("merlon", (x, 0, z0 + wall_h + 0.10), (0.22, 0.30, 0.20), M["wall"], bevel=0.02)
            if level >= 12:
                L.box("mercap", (x, 0, z0 + wall_h + 0.225), (0.26, 0.34, 0.05), M["gold"], bevel=0.01)
        # Speerspitzen (Gold, L11+) bzw. Kristall-Zacken (L15) in den Zinnen-Lücken
        if level >= 11:
            gaps = [(zx[i] + zx[i+1]) / 2 for i in range(len(zx) - 1)]
            for gx in gaps:
                if level >= 15:
                    L.crystal("crownc", (gx, 0, z0 + wall_h + 0.13), 0.055, 0.26, M["rune"])
                else:
                    L.cone("speer", (gx, 0, z0 + wall_h + 0.10), 0.045, 0.005, 0.22, M["gold"], verts=8)
    # Maschikuli-Konsolen unter der Krone
    if level >= 9:
        for i in range(7):
            L.box("konsole", (-0.84 + i * 0.28, fy + 0.045, z0 + wall_h - 0.20), (0.10, 0.09, 0.10),
                  M["cut"], bevel=0.01)
    # Bossenreihe am Sockel (vorstehende Quader)
    if level >= 9:
        for x in (-0.75, -0.25, 0.25, 0.75):
            L.box("boss", (x, body_d/2 + 0.045, z0 + 0.145), (0.30, 0.07, 0.13), M["cut"], bevel=0.02)
    # Gold-Rosetten an der Front
    if level >= 10:
        for x in (-0.60, 0.60):
            r_ = L.cylinder("rosette", (x, fy + 0.02, z0 + wall_h * 0.68), 0.085, 0.035, M["gold"], verts=12)
            r_.rotation_euler = (math.radians(90), 0, 0)
            r2_ = L.cylinder("rosette2", (x, fy + 0.035, z0 + wall_h * 0.68), 0.035, 0.03, M["cut"], verts=10)
            r2_.rotation_euler = (math.radians(90), 0, 0)
    # Wappenschild vorn Mitte — ab L12 SONNEN-Emblem, ab T5 Runen-Tafel
    if level >= 8:
        wy = fy + 0.015
        frame_mat = M["gold"] if level >= 12 else M["iron_d"]
        shield_mat = M["rune_bar"] if level >= 13 else M["cloth"]
        L.box("wframe", (0, wy + 0.02, z0 + wall_h * 0.50), (0.40, 0.06, 0.46), frame_mat, bevel=0.02)
        L.box("wshield", (0, wy + 0.055, z0 + wall_h * 0.50), (0.32, 0.05, 0.38), shield_mat, bevel=0.02)
        if level >= 12:
            emb_mat = M["rune"] if level >= 13 else M["gold"]
            sc_ = L.cylinder("sonne", (0, wy + 0.095, z0 + wall_h * 0.50), 0.075, 0.035, emb_mat, verts=12)
            sc_.rotation_euler = (math.radians(90), 0, 0)
            for k in range(8):
                phi = k * math.pi / 4
                sx_ = 0.115 * math.cos(phi); sz_ = 0.115 * math.sin(phi)
                obox("strahl", (sx_, wy + 0.09, z0 + wall_h * 0.50 + sz_), (0.055, 0.03, 0.022),
                     emb_mat, rot=(0, -phi, 0))
        else:
            L.box("wemblem", (0, wy + 0.09, z0 + wall_h * 0.50), (0.10, 0.04, 0.16), M["gold"], bevel=0.01)
    # T5: RUNEN-SCHRIFTZEILE über die Front (wechselnde Glyphenformen)
    if level >= 13:
        gz = z0 + wall_h * 0.80
        for i, x in enumerate((-0.80, -0.53, -0.27, 0.27, 0.53, 0.80)):
            f = i % 4
            if f == 0:
                obox("rgly", (x, fy + 0.015, gz), (0.045, 0.03, 0.14), M["rune"])
            elif f == 1:
                obox("rgly", (x, fy + 0.015, gz), (0.045, 0.03, 0.14), M["rune"], rot=(0, math.radians(28), 0))
            elif f == 2:
                obox("rgly", (x, fy + 0.015, gz), (0.045, 0.03, 0.13), M["rune"])
                obox("rgly2", (x, fy + 0.015, gz + 0.02), (0.11, 0.03, 0.04), M["rune"])
            else:
                obox("rgly", (x, fy + 0.015, gz), (0.11, 0.03, 0.045), M["rune"])
    # Runen-Kamm L15: leuchtende Leiste über der ganzen Krone
    if level >= 15:
        L.box("runekamm", (0, 0, z0 + wall_h + 0.005), (wall_len + 0.02, body_d - 0.14, 0.045),
              M["rune_bar"], bevel=0.0)
    # große Runen-Glyphen an der Front
    if level >= 14:
        for x in (-0.58, 0.58):
            obox("gly1", (x, fy + 0.02, z0 + wall_h * 0.36), (0.05, 0.04, 0.22), M["rune"])
            obox("gly2", (x, fy + 0.02, z0 + wall_h * 0.47), (0.16, 0.04, 0.05), M["rune"])
    # ENERGIE-RISSE in der Front: brechen aus den Blendbögen nach oben
    if level >= 15:
        for x in (-0.78, 0.78):
            for (dz, dx2, ln, ang) in ((0.48, 0.0, 0.17, 0), (0.60, 0.05, 0.15, 22), (0.71, -0.02, 0.13, -18)):
                obox("crack", (x + dx2, fy + 0.012, z0 + wall_h * dz), (0.045, 0.028, ln),
                     M["rune"], rot=(0, math.radians(ang), 0))
    # ENERGIE-ADERN: zusammenhängende Leucht-Risse, beginnen am Mauerfuß und
    # laufen nach vorn aus (zur Spitze hin schmaler) — "Magie strömt aus dem
    # Fundament", gleiche Ascension-Sprache wie bei den anderen T5-Finalen
    if level >= 15:
        for (x0, mirror) in ((-0.70, 1), (0.55, -1)):
            segs = [
                ((x0,                 0.40), 18 * mirror, 0.34, 0.10),
                ((x0 + 0.10 * mirror, 0.68), -8 * mirror, 0.28, 0.085),
                ((x0 + 0.16 * mirror, 0.92), 14 * mirror, 0.22, 0.07),
            ]
            for (cx, cy), ang, ln, w in segs:
                obox("evein", (cx, cy, z0 + 0.015), (w, ln, 0.035), M["rune_bar"],
                     rot=(0, 0, math.radians(ang)))
        # BESCHWÖRUNGSKREIS-Siegel am Boden vor der Mauer: Bogensegmente +
        # Glyphenpunkte + gekreuztes Zentrums-Siegel
        ccx, ccy, cr = 0.0, 0.80, 0.48
        for k in range(5):
            phi = math.radians(195 + k * 37.5)
            px_ = ccx + cr * math.cos(phi); py_ = ccy + cr * math.sin(phi)
            obox("ritual", (px_, py_, z0 + 0.013), (0.24, 0.055, 0.03), M["rune_bar"],
                 rot=(0, 0, phi + math.pi / 2))
        for k in range(4):
            phi = math.radians(213.75 + k * 37.5)
            px_ = ccx + cr * math.cos(phi); py_ = ccy + cr * math.sin(phi)
            obox("ritudot", (px_, py_, z0 + 0.018), (0.055, 0.055, 0.04), M["rune"],
                 rot=(0, 0, phi))
        obox("sigil1", (ccx, ccy - 0.10, z0 + 0.013), (0.30, 0.05, 0.028), M["rune_bar"],
             rot=(0, 0, math.radians(35)))
        obox("sigil2", (ccx, ccy - 0.10, z0 + 0.013), (0.30, 0.05, 0.028), M["rune_bar"],
             rot=(0, 0, math.radians(-35)))

cam_scale = 4.3 + 0.05 * level
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.55)
L.setup_lights()
L.render_png(out, res=700)
