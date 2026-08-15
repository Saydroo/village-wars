"""Forschungslabor — 15-Level-Schema, HERZSTÜCK-Konzept (CoC-Recherche 2026-07-03).

CoC-Labor-Learnings (Fandom): radikale Struktur-Metamorphosen pro Stufe (Ring-
Stapel → Riesenschraube → Buch m. Goldflügeln) + leuchtende Elixier-Behälter.
UNSER HERZSTÜCK, das das toppt: ein RIESEN-ELIXIERKOLBEN, der mit JEDEM Level
wächst (r = 0.20 + 0.02·Level), pro Tier die Farbe wechselt (grün→amber→GOLD→
arkanblau) und um den herum die Struktur pro Tier radikal mutiert:
  T1 Hütte:        L1 Boden-Kolben auf Dreibein · L2 RIESENKOLBEN aufs Dach +
                   Kupferrohr · L3 +Zweitkolben + Verbindungsrohr + Schaumblasen
  T2 Steinturm:    L4 Kolben in DACHFASSUNG + Kupfer-Rohrring um den Turm ·
                   L5 +2. Rohrring + Wandkonsolen-Kolben + Fenster · L6 +ZAHNRAD
                   an der Wand + Kamin mit Glut
  T3 Alchemistenturm: L7 höher + KUPFERKRONE (4 Streben + Ring) über dem Kolben
                   + Fackeln · L8 +KASKADEN-DESTILLE (3 Kessel treppab) + Banner ·
                   L9 +Anbau mit TELESKOP auf dem Dach
  T4 Athenäum:     L10 Marmor + GOLD-Fassung mit 4 Klauen + Gold-Fensterrahmen ·
                   L11 +ASTROLAB (Armillarsphäre aus 2 Gold-Tori) auf Säule ·
                   L12 +2 AUSLEGER-ARME mit Schwesterkolben + Sonnen-Emblem
  T5 Arkan-Nexus:  L13 Elixier ARKANBLAU + KRISTALLRING um den Kolben (4 Streben)
                   + Glyphen · L14 +Wand-Kristalle + Runen-Ring + Tür-Glyphen ·
                   L15 +ELIXIER-ÜBERLAUF (Leucht-Rinnsale Krone→Boden→Adern) +
                   Kristallspitzen auf der Fassung + Beschwörungskreis
DESIGN-REGELN: L1 funktionstüchtig, Level-Deltas SPEKTAKULÄR, nichts schwebt.
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_lab_lvl{level:02d}.png")
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
ELIX = {1: (0.35, 0.88, 0.35), 2: (0.35, 0.88, 0.35), 3: (0.95, 0.62, 0.18),
        4: (0.98, 0.80, 0.22), 5: (0.50, 0.80, 1.0)}[tier]

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
    "copper": L.mat("copper", (0.72, 0.44, 0.22), rough=0.35, metal=0.9),
    "wall":   L.mat("wall",   wc,   rough=1.0),
    "wall_d": L.mat("wall_d", wc_d, rough=1.0),
    "cut":    L.mat("cut",    cc,   rough=0.9),
    "roof":   L.mat("roof",   T["accent"], rough=0.8),
    "cloth":  L.mat("cloth",  T["accent"], rough=0.9),
    "bore":   L.mat("bore",   (0.04, 0.04, 0.05), rough=1.0),
    "ember":  L.mat("ember",  (1.0, 0.55, 0.15), rough=0.6, emis=0.9),
    # HERZSTÜCK: Elixier leuchtet, Farbe je Tier (grün→amber→gold→arkanblau);
    # helle Tier-Farben brauchen weniger Emission, sonst Weiß-Clipping
    "elixir": L.mat("elixir", ELIX, rough=0.25, emis={1: 0.55, 2: 0.55, 3: 0.5, 4: 0.42, 5: 0.3}[tier]),
    "glass":  L.mat("glass",  (0.78, 0.87, 0.9), rough=0.12),
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


def big_flask(cx, cyy, zb, fr, ring_mat, claws=False, crown=False, crystal_ring=False,
              crystal_tips=False):
    """DAS HERZSTÜCK: Riesen-Elixierkolben in einer Fassung.
    zb = Oberkante der Trägerfläche (Dach/Turmkrone)."""
    cz = zb + fr * 0.55                            # Kugel halb versenkt in der Fassung
    sphere("elixkugel", (cx, cyy, cz), fr, M["elixir"])
    L.cylinder("fassring", (cx, cyy, zb + 0.045), fr * 0.98, 0.10, ring_mat, verts=18)
    # Glashals + offene Mündung
    L.cylinder("hals", (cx, cyy, cz + fr + 0.055), fr * 0.30, 0.16, M["glass"], verts=12)
    L.cylinder("halsring", (cx, cyy, cz + fr + 0.13), fr * 0.36, 0.035, ring_mat, verts=12)
    # Schaumblasen AM Hals/auf der Kugel (anliegend, nichts schwebt)
    if level >= 3:
        sphere("blase1", (cx + fr * 0.28, cyy + fr * 0.1, cz + fr * 0.92), fr * 0.16, M["elixir"])
        sphere("blase2", (cx - fr * 0.2, cyy - fr * 0.15, cz + fr * 0.99), fr * 0.11, M["elixir"])
    if claws:                                      # 4 Gold-Klauen greifen die Kugel
        for k in range(4):
            phi = math.radians(45 + k * 90)
            kx = cx + fr * 0.82 * math.cos(phi); ky = cyy + fr * 0.82 * math.sin(phi)
            obox("klaue", (kx, ky, zb + fr * 0.38), (0.09, 0.09, fr * 0.75), ring_mat,
                 rot=(math.radians(-18 * math.sin(phi)), math.radians(18 * math.cos(phi)), 0))
    if crown:                                      # Kupferkrone: 4 Streben + Ring überm Hals
        top = cz + fr + 0.24
        for k in range(4):
            phi = math.radians(k * 90)
            bx = cx + fr * 0.95 * math.cos(phi); by = cyy + fr * 0.95 * math.sin(phi)
            rod((bx, by, zb + 0.06), (cx + fr * 0.4 * math.cos(phi), cyy + fr * 0.4 * math.sin(phi), top),
                0.028, M["copper"], "kronstrebe")
        torus("kronring", (cx, cyy, top), fr * 0.42, 0.032, M["copper"])
    if crystal_ring:                               # T5: Kristallring um den Äquator
        torus("crysring", (cx, cyy, cz + fr * 0.1), fr * 1.22, 0.035, M["rune_bar"])
        for k in range(4):
            phi = math.radians(k * 90)
            rod((cx + fr * 0.95 * math.cos(phi), cyy + fr * 0.95 * math.sin(phi), zb + 0.05),
                (cx + fr * 1.2 * math.cos(phi), cyy + fr * 1.2 * math.sin(phi), cz + fr * 0.1),
                0.025, M["iron_d"], "ringstrebe")
        for k in range(5):
            phi = math.radians(20 + k * 72)
            L.crystal("ringcrys", (cx + fr * 1.22 * math.cos(phi), cyy + fr * 1.22 * math.sin(phi),
                                   cz + fr * 0.1 + 0.10), 0.045, 0.19, M["rune"])
    if crystal_tips:                               # L15: Kristallspitzen auf der Fassung
        for k in range(4):
            phi = math.radians(45 + k * 90)
            L.crystal("fasscrys", (cx + fr * 0.95 * math.cos(phi), cyy + fr * 0.95 * math.sin(phi),
                                   zb + 0.10 + 0.11), 0.05, 0.22, M["rune"])


def small_flask(cx, cyy, zb, r=0.09, mat=None):
    sphere("flask", (cx, cyy, zb + r), r, mat or M["elixir"])
    L.cylinder("fneck", (cx, cyy, zb + 2*r + 0.035), r * 0.32, 0.11, M["glass"], verts=10)
    L.cylinder("fkork", (cx, cyy, zb + 2*r + 0.10), r * 0.36, 0.035, M["wood_d"], verts=8)


def books(cx, cyy, n=3):
    cols = (M["cloth"], M["copper"], M["wall_d"])
    for i in range(n):
        obox("book", (cx, cyy, z0 + 0.03 + i * 0.055), (0.22 - i*0.02, 0.16, 0.05),
             cols[i % 3], rot=(0, 0, math.radians((i * 17) % 25 - 12)))


def torch(x, fyy, zb):
    obox("thalter", (x, fyy + 0.025, zb), (0.06, 0.06, 0.09), M["iron_d"])
    p2 = (x, fyy + 0.13, zb + 0.23)
    rod((x, fyy + 0.01, zb - 0.02), p2, 0.028, M["wood_d"], "torch", verts=8)
    sphere("flame", (p2[0], p2[1], p2[2] + 0.03), 0.055, M["ember"], scale=(1, 1, 1.7))


def gear(cx, fyy, cz, r=0.16):
    """Zahnrad an der Wand (Front)."""
    g = L.cylinder("gear", (cx, fyy + 0.02, cz), r, 0.05, M["iron_d"], verts=12)
    g.rotation_euler = (math.radians(90), 0, 0)
    for k in range(6):
        phi = k * math.pi / 3
        obox("tooth", (cx + (r + 0.03) * math.cos(phi), fyy + 0.02, cz + (r + 0.03) * math.sin(phi)),
             (0.06, 0.045, 0.05), M["iron_d"], rot=(0, -phi, 0))
    hub = L.cylinder("ghub", (cx, fyy + 0.045, cz), r * 0.3, 0.04, M["copper"], verts=10)
    hub.rotation_euler = (math.radians(90), 0, 0)


# --- Grassockel ---------------------------------------------------------------
L.box("dirt",   (0, 0, 0.13), (4.7*s, 4.4*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.3*s, 4.0*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.7*s, 3.5*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.7*s, -1.5*s), (1.75*s, 1.45*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.18, 0.12, M["moss"], verts=10)
L.box("yard", (0.15, 0.5, 0.405), (2.9, 2.1, 0.045), M["dirt_l"], bevel=0.02)

cy = -0.35
fr = 0.18 + 0.03 * level                          # HERZSTÜCK wächst mit JEDEM Level


def side_tank(cx, cyy, r, h, to_wall):
    """Elixier-Seitentank: leuchtende Glassäule m. Kupferdeckel + Rohr zum Turm."""
    L.cylinder("tanksockel", (cx, cyy, z0 + 0.05), r + 0.05, 0.10, M["wall_d"], verts=14)
    L.cylinder("tank", (cx, cyy, z0 + 0.10 + h/2), r, h, M["elixir"], verts=14)
    for hz in (0.3, 0.7):
        L.cylinder("tankband", (cx, cyy, z0 + 0.10 + h * hz), r + 0.02, 0.04, M["iron_d"], verts=14)
    L.cylinder("tankdeckel", (cx, cyy, z0 + 0.10 + h + 0.035), r * 0.9, 0.07, M["copper"], verts=14)
    rod((cx, cyy, z0 + 0.10 + h + 0.06), to_wall, 0.03, M["copper"], "tankrohr")
# =============================================================================
if tier == 1:
    # --- HÜTTEN-LABOR: Kolben erobert das Dach ---------------------------------
    hb, hd, hh = 1.15, 1.0, 0.72
    fy = cy + hd/2
    L.box("hut", (0, cy, z0 + hh/2), (hb, hd, hh), M["wood"], bevel=0.02)
    for k in (-0.35, 0.0, 0.35):
        L.box("fuge", (k, cy, z0 + hh/2), (0.03, hd + 0.02, hh - 0.05), M["wood_d"], bevel=0.0)
    L.box("hutdach", (0, cy, z0 + hh + 0.035), (hb + 0.18, hd + 0.18, 0.07), M["roof"], bevel=0.02)
    obox("door", (0.22, fy + 0.012, z0 + 0.26), (0.30, 0.03, 0.52), M["bore"])
    L.box("dframe", (0.22, fy + 0.005, z0 + 0.55), (0.38, 0.05, 0.06), M["wood_d"], bevel=0.01)
    books(0.9, 0.75, n=2)
    if level == 1:
        # Boden-Kolben auf Dreibein-Gestell + Feuerstelle darunter
        gx, gy_ = -1.0, 0.5
        for k in range(3):
            phi = math.radians(90 + k * 120)
            rod((gx + 0.22 * math.cos(phi), gy_ + 0.22 * math.sin(phi), z0),
                (gx, gy_, z0 + 0.34), 0.025, M["wood_d"], "tripod")
        sphere("feuer", (gx, gy_, z0 + 0.05), 0.09, M["ember"], scale=(1, 1, 0.5))
        sphere("elixkugel", (gx, gy_, z0 + 0.34 + fr * 0.8), fr * 0.8, M["elixir"])
        L.cylinder("hals", (gx, gy_, z0 + 0.34 + fr * 1.6 + 0.05), fr * 0.26, 0.14, M["glass"], verts=10)
    else:
        # RIESEN-KOLBEN AUF DEM DACH (Holzfassung), Kupferrohr vom Wandkessel
        # (Kessel auf +X = Bild-links, damit die Kamera ihn sieht)
        big_flask(0, cy, z0 + hh + 0.07, fr, M["wood_d"])
        L.cylinder("wkessel", (hb/2 + 0.20, cy + 0.25, z0 + 0.15), 0.14, 0.30, M["copper"], verts=12)
        sphere("wglut", (hb/2 + 0.20, cy + 0.25, z0 + 0.02), 0.08, M["ember"], scale=(1, 1, 0.4))
        rod((hb/2 + 0.20, cy + 0.25, z0 + 0.32), (fr * 0.5, cy, z0 + hh + 0.07 + fr * 0.9),
            0.035, M["copper"], "drohr")
    if level >= 3:
        # Zweitkolben auf dem Dach + Verbindungsrohr + Wandregal
        big2 = fr * 0.5
        sphere("elix2", (0.42, cy - 0.28, z0 + hh + 0.07 + big2), big2, M["elixir"])
        L.cylinder("fass2", (0.42, cy - 0.28, z0 + hh + 0.09), big2 * 0.9, 0.06, M["wood_d"], verts=12)
        rod((fr * 0.55, cy, z0 + hh + 0.07 + fr * 0.85), (0.42, cy - 0.28, z0 + hh + 0.07 + big2 * 1.7),
            0.028, M["copper"], "vrohr")
        L.box("regal", (hb/2 + 0.03, cy - 0.1, z0 + 0.46), (0.06, 0.46, 0.04), M["wood_d"], bevel=0.0)
        small_flask(hb/2 + 0.03, cy - 0.24, z0 + 0.48, r=0.05)
        small_flask(hb/2 + 0.03, cy + 0.04, z0 + 0.48, r=0.05)
else:
    # --- STEIN-/ALCHEMISTEN-TURM --------------------------------------------------
    tr = 0.60 + 0.02 * (level - 4)
    th = 0.85 + 0.09 * (level - 4)
    fy = cy + tr
    L.cylinder("tower", (0, cy, z0 + th/2), tr, th, M["wall"], verts=18)
    L.cylinder("plinth", (0, cy, z0 + 0.08), tr + 0.09, 0.16, M["wall_d"], verts=18)
    L.cylinder("tband", (0, cy, z0 + th - 0.045), tr + 0.05, 0.09, M["cut"], verts=18)
    # Tür + Stufe
    obox("door", (0, fy - 0.10, z0 + 0.28), (0.32, 0.22, 0.56), M["bore"])
    L.box("dframe", (0, fy - 0.06, z0 + 0.58), (0.44, 0.16, 0.07), M["wall_d"], bevel=0.01)
    L.box("dstep", (0, fy + 0.10, z0 + 0.035), (0.42, 0.22, 0.07), M["wall_d"], bevel=0.01)
    # === HERZSTÜCK: Riesen-Kolben auf der Turmkrone ===
    ring_mat = M["gold"] if level >= 10 else (M["copper"] if level >= 7 else M["cut"])
    big_flask(0, cy, z0 + th, fr, ring_mat,
              claws=(level >= 10), crown=(7 <= level <= 12),
              crystal_ring=(level >= 13), crystal_tips=(level >= 15))
    # Kupfer-Rohrringe um den Turm + Zuleitung in den Kolbenhals
    if level >= 4:
        L.cylinder("rohrring1", (0, cy, z0 + th * 0.55), tr + 0.05, 0.045, M["copper"], verts=18)
        rod((tr * 0.7, cy - tr * 0.7, z0 + th * 0.55),
            (fr * 0.35, cy - fr * 0.35, z0 + th + fr * 1.15), 0.035, M["copper"], "zuleitung")
    if level >= 5:
        L.cylinder("rohrring2", (0, cy, z0 + th * 0.32), tr + 0.05, 0.045, M["copper"], verts=18)
        # ELIXIER-SEITENTANK (großer Stage-Marker, wie CoC-"fluid vat" nur größer)
        side_tank(tr + 0.24, cy + 0.30, 0.15, 0.52, (tr * 0.8, cy + 0.2, z0 + th * 0.7))
        # Rundfenster
        win_mat = M["rune"] if level >= 13 else M["bore"]
        w = L.cylinder("rwin", (tr * 0.75, cy + tr * 0.62, z0 + th * 0.72), 0.10, 0.04, win_mat, verts=12)
        w.rotation_euler = (math.radians(90), 0, math.radians(-40))
        if level >= 10:
            wf = L.cylinder("rwinf", (tr * 0.76, cy + tr * 0.63, z0 + th * 0.72), 0.13, 0.03, M["gold"], verts=12)
            wf.rotation_euler = (math.radians(90), 0, math.radians(-40))
    if level >= 6:
        # ZAHNRAD-PAAR an der Front + 2. Seitentank hinten links
        gear(-tr * 0.68, cy + tr * 0.62, z0 + th * 0.48, r=0.18)
        gear(-tr * 0.94, cy + tr * 0.36, z0 + th * 0.30, r=0.11)
        side_tank(tr + 0.22, cy - 0.52, 0.12, 0.40, (tr * 0.8, cy - 0.35, z0 + th * 0.55))
        L.box("chim", (tr * 0.55, cy - tr * 0.62, z0 + th + 0.10), (0.14, 0.14, 0.26), M["wall_d"], bevel=0.01)
        sphere("chglut", (tr * 0.55, cy - tr * 0.62, z0 + th + 0.26), 0.05, M["ember"], scale=(1, 1, 0.6))
    # Fackeln an der Tür
    if level >= 7:
        for tx in (-0.32, 0.32):
            torch(tx, fy - 0.04, z0 + 0.52)
    # Kaskaden-Destille: 3 Kupferkessel treppab + Rohre.
    # Schritte fast nur entlang +Y: in der Iso-Ansicht heben sich +X- und
    # +Y-Versatz im Bild gegenseitig auf, die Kessel müssen also entlang EINER
    # Achse marschieren, sonst stapeln sie sich optisch zum Totem.
    if level >= 8:
        kes_mat = M["gold"] if level >= 12 else M["copper"]
        kx0, ky0 = 1.25, 0.45
        steps = ((0, 0, 0.19, 0.40), (0.04, 0.42, 0.15, 0.30), (0.08, 0.80, 0.11, 0.22))
        for i, (dx, dy, kr, kh_) in enumerate(steps):
            L.cylinder(f"kessel{i}", (kx0 + dx, ky0 + dy, z0 + kh_/2), kr, kh_, kes_mat if i == 0 else M["copper"], verts=14)
            sphere(f"khaube{i}", (kx0 + dx, ky0 + dy, z0 + kh_), kr * 0.9, kes_mat if i == 0 else M["copper"], scale=(1, 1, 0.6))
            if i:
                pdx, pdy, _, pkh = steps[i - 1]
                rod((kx0 + pdx, ky0 + pdy, z0 + pkh + 0.08), (kx0 + dx, ky0 + dy, z0 + kh_ + 0.06),
                    0.028, M["copper"], "krohr")
        sphere("kglut", (kx0, ky0, z0 + 0.03), 0.10, M["ember"], scale=(1, 1, 0.35))
        # Zuleitung: kurzes, flaches Rohr aus der Turmwand (mit Flansch) in den
        # obersten Kessel — NICHT vom Dachkolben, das gab eine Stange quer übers Bild
        wdir = Vector((kx0, ky0 - cy, 0)).normalized()
        fphi = math.atan2(wdir.y, wdir.x)
        fl = L.cylinder("kflansch", (tr * wdir.x, cy + tr * wdir.y, z0 + th * 0.42), 0.07, 0.06,
                        M["copper"], verts=10)
        fl.rotation_euler = (0, math.radians(90), fphi)
        rod((tr * wdir.x * 0.98, cy + tr * wdir.y * 0.98, z0 + th * 0.42),
            (kx0, ky0, z0 + 0.50), 0.035, M["copper"], "hauptrohr")
        L.banner("ban", -1.6, -0.55, z0, 0.30, 0.38, M["wood_d"], M["cloth"], M["gold"], pole_h=1.3)
    # Anbau + TELESKOP auf dem Anbaudach
    if level >= 9:
        ax = -tr - 0.34
        L.box("annex", (ax, cy + 0.1, z0 + 0.31), (0.62, 0.72, 0.62), M["wall_d"], bevel=0.02)
        L.box("aroof", (ax, cy + 0.1, z0 + 0.655), (0.72, 0.82, 0.07), M["cut"], bevel=0.02)
        obox("awin", (ax + 0.02, cy + 0.47, z0 + 0.40), (0.14, 0.03, 0.18),
             M["rune"] if level >= 13 else M["bore"])
        # Teleskop: Fuß auf dem Anbaudach, Rohr schräg Richtung Himmel
        rod((ax, cy + 0.05, z0 + 0.69), (ax, cy + 0.05, z0 + 0.82), 0.04, M["iron_d"], "telefuss")
        t2 = (ax - 0.34, cy - 0.28, z0 + 1.18)
        rod((ax, cy + 0.05, z0 + 0.80), t2, 0.05, M["copper"], "tele")
        rod((t2[0] - 0.05 * (t2[0] - ax), t2[1] - 0.05 * (t2[1] - cy - 0.05), t2[2] - 0.04),
            t2, 0.068, M["gold"] if level >= 10 else M["iron_d"], "telering")
        books(ax + 0.12, cy + 0.58, n=2)
    # Gold-Zierband
    if level >= 11:
        L.cylinder("goldband", (0, cy, z0 + th - 0.16), tr + 0.03, 0.045, M["gold"], verts=18)
        # ASTROLAB: Armillarsphäre aus 2 Gold-Tori auf Säule (links, frei vom
        # Beschwörungskreis der Destille)
        asx, asy = -1.35, 0.95
        L.cylinder("assockel", (asx, asy, z0 + 0.05), 0.16, 0.10, M["wall_d"], verts=12)
        L.cylinder("assaeule", (asx, asy, z0 + 0.28), 0.045, 0.40, M["cut"], verts=10)
        torus("asring1", (asx, asy, z0 + 0.62), 0.17, 0.022, M["gold"], rot=(math.radians(90), 0, math.radians(30)))
        torus("asring2", (asx, asy, z0 + 0.62), 0.17, 0.022, M["gold"], rot=(math.radians(66), 0, math.radians(-40)))
        sphere("asglobus", (asx, asy, z0 + 0.62), 0.075, M["copper"])
    # Ausleger-Arme mit Schwesterkolben
    if level >= 12:
        for sgn in (-1, 1):
            arm_y = cy + sgn * 0.15
            rod((sgn * tr * 0.9, arm_y, z0 + th * 0.82), (sgn * (tr + 0.42), arm_y, z0 + th * 0.86),
                0.04, M["gold"], "arm")
            L.cylinder("armteller", (sgn * (tr + 0.42), arm_y, z0 + th * 0.86 + 0.03), 0.13, 0.05,
                       M["gold"], verts=12)
            sfr = 0.115
            sphere("armelix", (sgn * (tr + 0.42), arm_y, z0 + th * 0.86 + 0.055 + sfr), sfr, M["elixir"])
        # Sonnen-Emblem über der Tür
        emb_mat = M["rune"] if level >= 13 else M["gold"]
        wz = z0 + 0.82
        se = L.cylinder("sonne", (0, fy - 0.02, wz), 0.06, 0.03, emb_mat, verts=12)
        se.rotation_euler = (math.radians(90), 0, 0)
        for k in range(8):
            phi = k * math.pi / 4
            obox("strahl", (0.09 * math.cos(phi), fy - 0.022, wz + 0.09 * math.sin(phi)),
                 (0.04, 0.025, 0.02), emb_mat, rot=(0, -phi, 0))
    # T5: Glyphen + Runen-Ring + Wand-Kristalle
    if level >= 13:
        for x in (-0.8, 0.8):
            obox("rgly", (x * tr, cy + tr * 0.55, z0 + th * 0.60), (0.05, 0.04, 0.15), M["rune"],
                 rot=(0, 0, math.radians(x * 35)))
            obox("rgly2", (x * tr, cy + tr * 0.55, z0 + th * 0.70), (0.12, 0.04, 0.05), M["rune"],
                 rot=(0, 0, math.radians(x * 35)))
    if level >= 14:
        L.cylinder("trunering", (0, cy, z0 + th * 0.22), tr + 0.035, 0.05, M["rune_bar"], verts=18)
        for phi_deg in (60, 160, 250):
            phi = math.radians(phi_deg)
            kx = tr * 0.99 * math.cos(phi); ky = cy + tr * 0.99 * math.sin(phi)
            obox("wkonsole", (kx, ky, z0 + th * 0.80 - 0.06), (0.12, 0.12, 0.05), M["wall_d"], rot=(0, 0, phi))
            L.crystal("wcrys", (kx, ky, z0 + th * 0.80 + 0.06), 0.045, 0.18, M["rune"])
    # L15: ELIXIER-ÜBERLAUF — Leucht-Rinnsale von der Krone über die Wand in den Boden
    if level >= 15:
        for phi_deg in (28, 152):
            phi = math.radians(phi_deg)
            rx = math.cos(phi); ry = math.sin(phi)
            # Rinnsal an der Wand (flacher Streifen), von der Krone bis zum Sockel —
            # im Elixier-Material, damit es als übergelaufenes Elixier lesbar ist
            obox("rinnsal", (tr * 1.005 * rx, cy + tr * 1.005 * ry, z0 + th * 0.55),
                 (0.07, 0.035, th * 0.86), M["elixir"], rot=(0, 0, phi))
            # Pfütze am Fuß + Ader nach außen
            obox("pfuetze", ((tr + 0.18) * rx, cy + (tr + 0.18) * ry, z0 + 0.015),
                 (0.22, 0.16, 0.03), M["elixir"], rot=(0, 0, phi))
            obox("evein", ((tr + 0.48) * rx, cy + (tr + 0.48) * ry, z0 + 0.015),
                 (0.30, 0.08, 0.03), M["elixir"], rot=(0, 0, phi))
        # Beschwörungskreis auf der freien Hoffläche vor dem Turm (klar getrennt
        # von Kaskade, Türstufe und Sockel)
        ccx, ccy, cr = 0.55, 1.08, 0.40
        for k in range(6):
            phi = math.radians(k * 60 + 15)
            obox("ritual", (ccx + cr * math.cos(phi), ccy + cr * math.sin(phi), z0 + 0.013),
                 (0.20, 0.05, 0.03), M["rune_bar"], rot=(0, 0, phi + math.pi / 2))
        for k in range(3):
            phi = math.radians(k * 120 + 45)
            obox("ritudot", (ccx + cr * math.cos(phi), ccy + cr * math.sin(phi), z0 + 0.018),
                 (0.05, 0.05, 0.04), M["rune"], rot=(0, 0, phi))

cam_scale = 4.8 + 0.13 * level
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.85)
L.setup_lights()
L.render_png(out, res=700)
