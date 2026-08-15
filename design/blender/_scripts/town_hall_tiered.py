"""Menschen-Rathaus, parametrisch über Material-Tier (1..5).
blender -b --python town_hall_tiered.py -- <tier> <out.png>
Tier 1-2 = bescheidenes Haus (Holz→Stein), Tier 3-5 = wachsende Burg.
"""
import bpy, sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import lib_iso as L
from themes import THEMES

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
tier = int(argv[0]) if len(argv) >= 1 else 3
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_th_tier{tier}.png")
T = THEMES[tier]

L.reset_scene()

# Material-Set aus dem Theme
M = {
    "wall":   L.mat("wall",   T["wall"],   rough=0.95),
    "wall_l": L.mat("wall_l", T["wall_l"], rough=0.92),
    "wall_d": L.mat("wall_d", T["wall_d"], rough=1.0),
    "roof":   L.mat("roof",   T["roof"],   rough=0.6),
    "roof_d": L.mat("roof_d", T["roof_d"], rough=0.6),
    "wood":   L.mat("wood",   T["wood"],   rough=0.9),
    "wood_d": L.mat("wood_d", T["wood_d"], rough=0.9),
    "accent": L.mat("accent", T["accent"], rough=(0.32 if T["gold"] else 0.85), metal=(0.9 if T["gold"] else 0.0)),
    "win":    L.mat("win",    T["window"], rough=0.3, emis=(2.6 if T["magic"] else 2.2)),
    "grass":  L.mat("grass",  T["ground"], rough=1.0),
    "grass_d":L.mat("grass_d",T["ground_d"],rough=1.0),
    "dirt":   L.mat("dirt",   (0.42, 0.31, 0.19), rough=1.0),
    "moss":   L.mat("moss",   (0.34, 0.50, 0.20), rough=1.0),
    "flag":   L.mat("flag",   (0.84, 0.17, 0.17), rough=0.8),
    "crystal":L.mat("crystal",(0.62, 0.42, 0.95), rough=0.2, emis=2.0),
}
s = T["scale"]
decay = T["decay"]

# --- Grassockel (immer) ---
L.box("dirt",   (0, 0, 0.13), (4.8*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.4*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.7*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, 1.7*s), (2.0*s, -1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.22, 0.12, M["moss"], verts=10)


def gold_or(mat_key):
    return M["accent"] if T["gold"] else M[mat_key]


def main_roof(cx, cy, cz, lx, wy, h):
    """Dach je nach Stil."""
    style = T["roof_style"]
    if style == "thatch":
        # Strohdach: hip, leicht windschief, dunkler Akzent-First
        o = L.hip_roof("roof", (cx + decay*0.1, cy, cz + h/2), lx, wy, h, M["roof"], ridge=0.5)
        if decay > 0:
            o.rotation_euler = (0, math.radians(decay*4), 0)
    elif style == "spire":
        # Spitzdach (Magie): höher, mit Kristall
        L.hip_roof("roof", (cx, cy, cz + h/2), lx, wy, h*1.25, M["roof"], ridge=0.18)
        L.crystal("spire_c", (cx, cy, cz + h*1.25 + 0.25), 0.18, 0.7, M["crystal"])
    else:  # tile / hip
        L.hip_roof("roof", (cx, cy, cz + h/2), lx, wy, h, M["roof"], ridge=0.5)
    if T["gold"]:
        L.box("ridge", (cx, cy, cz + h*0.98), (lx*0.5, 0.15, 0.15), M["accent"], bevel=0.03)


def build_cottage():
    """Tier 1-2: bescheidenes Haus."""
    # Hauptkörper (bei Verfall leicht schief)
    body = L.box("hall", (0, -0.1, 1.05), (2.6, 2.0, 1.3), M["wall"], bevel=0.06)
    if decay > 0:
        body.rotation_euler = (math.radians(decay*2.5), 0, math.radians(-decay*2))
    L.box("base", (0, -0.1, 0.5), (2.8, 2.2, 0.3), M["wall_d"], bevel=0.05)
    # Eck-Holzpfosten
    for (px, py) in [(-1.25, 0.95), (1.25, 0.95), (-1.25, -1.05), (1.25, -1.05)]:
        L.box("post", (px, py, 1.05), (0.16, 0.16, 1.5), M["wood_d"], bevel=0.0)
    # Tür + Fenster
    L.box("door", (0, 0.92, 0.78), (0.7, 0.16, 1.0), M["wood"], bevel=0.03)
    for x in (-0.85, 0.85):
        L.box("win", (x, 0.92, 1.2), (0.36, 0.1, 0.42), M["win"], bevel=0.02)
        L.box("wfr", (x, 0.9, 1.2), (0.46, 0.08, 0.52), M["wood_d"], bevel=0.02)
    # Schornstein (CoC TH1)
    L.box("chimney", (-0.95, -0.7, 2.3), (0.3, 0.3, 1.0), M["wall_d"], bevel=0.04)
    # Dach
    main_roof(0, -0.1, 1.75, 3.1, 2.5, 1.15)
    # einfacher Holz-Wimpel statt Gold
    L.banner("b", 0, -0.1, 2.9, 0.45, 0.32, M["wood_d"], M["flag"], M["accent"], pole_h=0.7)


def build_castle():
    """Tier 3-5: Burg, mit Tier wachsend."""
    # Hauptkörper
    L.box("base",  (0, -0.1, 0.62), (3.6, 2.7, 0.5), M["wall_d"], bevel=0.06)
    L.box("hall",  (0, -0.1, 1.45), (3.2, 2.3, 1.4), M["wall"],  bevel=0.07)
    L.box("band",  (0, -0.1, 1.02), (3.25, 2.35, 0.1), M["wall_l"], bevel=0.02)
    if T["battlements"]:
        L.battlement_ring("merlon", 0, -0.1, 1.65, 1.2, 2.2, M["wall_d"], merlon=0.32, gap=0.34, h=0.34)
    # Tor mit Rahmen
    L.box("portal",  (0, 1.05, 1.0), (1.45, 0.28, 1.55), M["wall_l"], bevel=0.04)
    L.box("doorway", (0, 0.95, 0.9), (1.05, 0.4, 1.25), M["wood_d"], bevel=0.02)
    L.box("door",    (0, 1.06, 0.9), (0.94, 0.12, 1.2), M["wood"], bevel=0.03)
    for px in (-0.56, 0.56):
        L.box("post", (px, 1.12, 0.95), (0.12, 0.16, 1.45), gold_or("wall_l"), bevel=0.03)
    L.box("lintel", (0, 1.12, 1.74), (1.36, 0.18, 0.16), gold_or("wall_l"), bevel=0.03)
    L.box("step1", (0, 1.5, 0.45), (1.3, 0.4, 0.16), M["wall_l"], bevel=0.03)
    L.box("step2", (0, 1.78, 0.33), (1.6, 0.4, 0.14), M["wall_d"], bevel=0.03)
    # Fenster
    for x in (-1.15, 1.15):
        L.box("wframe", (x, 1.05, 1.55), (0.5, 0.1, 0.72), M["wall_l"], bevel=0.03)
        L.box("wglass", (x, 1.11, 1.55), (0.32, 0.08, 0.54), M["win"], bevel=0.02)
        L.box("wsill",  (x, 1.08, 1.16), (0.56, 0.12, 0.1), M["wall_d"], bevel=0.02)
    # Obergeschoss + Fachwerk
    L.box("upper", (0, -0.1, 2.7), (2.7, 1.85, 0.8), M["wall_l"], bevel=0.06)
    for x in (-1.15, -0.4, 0.4, 1.15):
        L.box("beamV", (x, 0.84, 2.7), (0.1, 0.06, 0.75), M["wood_d"], bevel=0.0)
    L.box("beamH",  (0, 0.84, 3.05), (2.7, 0.06, 0.1), M["wood_d"], bevel=0.0)
    L.box("beamH2", (0, 0.84, 2.35), (2.7, 0.06, 0.1), M["wood_d"], bevel=0.0)
    L.cylinder("oc",  (0, 0.84, 2.7), 0.26, 0.12, gold_or("wall_l"), verts=20)
    L.cylinder("ocg", (0, 0.80, 2.7), 0.18, 0.1, M["win"], verts=16)
    # Dach
    main_roof(0, -0.1, 3.12, 3.6, 3.1, 1.25)
    L.box("eaveF", (0, 1.42, 3.16), (3.55, 0.13, 0.14), gold_or("roof_d"), bevel=0.02)
    L.banner("rb", -1.45, -0.1, 3.12+1.25+0.05, 0.55, 0.38, M["wood_d"], M["flag"], M["accent"], pole_h=0.8)
    # Türme
    coords = {2: [(-1.7,-1.2),(1.7,-1.2)],
              4: [(-1.7,-1.2),(1.7,-1.2),(-1.7,1.0),(1.7,1.0)]}.get(T["towers"], [])
    for (sx, sy) in coords:
        th = 3.7 if sy < 0 else 3.0
        L.cylinder("twr", (sx, sy, th/2+0.5), 0.52, th, M["wall"], verts=22)
        L.box("twrband", (sx, sy, th+0.2), (1.1, 1.1, 0.13), M["wall_d"], bevel=0.03)
        L.battlement_ring("tmer", sx, sy, 0.5, 0.5, th+0.35, M["wall_d"], merlon=0.2, gap=0.18, h=0.22)
        if T["roof_style"] == "spire":
            L.cone("twrcap", (sx, sy, th+1.05), 0.62, 0.001, 1.5, M["roof"], verts=22)
            L.crystal("tc", (sx, sy, th+1.9), 0.1, 0.4, M["crystal"])
        else:
            L.cone("twrcap", (sx, sy, th+0.95), 0.66, 0.001, 1.15, M["roof"], verts=22)
            L.cylinder("twrknob", (sx, sy, th+1.55), 0.085, 0.22, M["accent"], verts=10)
        L.banner("tb", sx, sy, th+1.6, 0.42, 0.3, M["wood_d"], M["flag"], M["accent"], pole_h=0.55)
    # Magie-Kristalle an der Basis (Tier 5)
    if T["magic"]:
        for (cx2, cy2) in [(-2.1, 1.5), (2.1, 1.5), (0, 2.0)]:
            L.crystal("bc", (cx2, cy2, 0.7), 0.16, 0.7, M["crystal"])


if tier <= 2:
    build_cottage()
else:
    build_castle()

L.setup_iso_camera(ortho_scale=8.4, target_z=2.0)
L.setup_lights()
L.render_png(out, res=700)
