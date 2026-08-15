"""Menschen-Kaserne (barracks), parametrisch über Material-Tier (1..5).
blender -b --python barracks_tiered.py -- <tier> <out.png>
Tier 1   = rustikales, schiefes Holz-Trainingshaus (Strohdach).
Tier 2   = aufgewertetes Steinhaus (Schornstein, Stein-Eckquader, Tordach, Ziegeldach).
Tier 3   = befestigte Sandstein-Waffenhalle (Zinnen-Strebepfeiler).
Tier 4   = Marmorhalle mit 4 Ecktürmen + brennenden Feuerschalen am Tor.
Tier 5   = magische Halle: Kristall-Spitztürme, leuchtende Runen, schwebender Kristall.

Kaserne-Signatur (alle Tiers): gekreuzte Schwerter überm Tor, Speerständer, Trainings-
puppe im Vorhof, militärrote Wimpel. Bewusst niedriger/breiter als das Rathaus und mit
weniger/kleineren Türmen (kein zentraler Bergfried), damit das Rathaus dominant bleibt.
"""
import bpy, sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import lib_iso as L
from themes import THEMES, tier_for_level

# Argument = LEVEL 1..15 (nicht mehr Tier). Daraus: tier (Material-Thema, je 3 Level)
# + stage 1..3 (Baufortschritt INNERHALB des Tiers — jeder Level-Up sichtbar):
#   stage 1 = Rohbau/baufällig, stage 2 = fertig & schlicht, stage 3 = Vollausbau.
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
level = max(1, min(15, int(argv[0]) if len(argv) >= 1 else 3))
tier = tier_for_level(level)
stage = (level - 1) % 3 + 1
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_barr_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

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
    "crystal":L.mat("crystal",(0.62, 0.42, 0.95), rough=0.2, emis=2.2),
    "iron":   L.mat("iron",   (0.74, 0.77, 0.82), rough=0.35, metal=0.85),
    "iron_d": L.mat("iron_d", (0.30, 0.32, 0.36), rough=0.5, metal=0.6),
    "straw":  L.mat("straw",  (0.86, 0.70, 0.34), rough=1.0),
    "sand":   L.mat("sand",   (0.78, 0.68, 0.45), rough=1.0),
    "smoke":  L.mat("smoke",  (0.72, 0.72, 0.74), rough=1.0),
    "flame":  L.mat("flame",  (1.0, 0.5, 0.13),  rough=0.4, emis=3.4),  # Feuerschale
    "flame_c":L.mat("flame_c",(1.0, 0.86, 0.42), rough=0.3, emis=4.6),  # Flammenkern
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=3.4),  # Magie-Runen (T5)
    "mblade": L.mat("mblade", (0.62, 0.8, 1.0),  rough=0.22, metal=0.7, emis=1.8),  # Geister-Klinge
    "mflame": L.mat("mflame", (0.62, 0.42, 1.0), rough=0.3, emis=4.2),  # Magie-Flamme
    "mflame_c":L.mat("mflame_c",(0.85,0.78,1.0), rough=0.3, emis=5.0),  # Magie-Flammenkern
    "portal": L.mat("portal", (0.66, 0.5, 1.0),  rough=0.25, emis=3.4),  # Tor-Portal
    "mdeep":  L.mat("mdeep",  (0.34, 0.2, 0.5),  rough=0.85),            # dunkler Magie-Stein
}
s = T["scale"]
decay = T["decay"]


def gold_or(mat_key):
    return M["accent"] if T["gold"] else M[mat_key]


# --- Grassockel (breiter als hoch — passt zur Kaserne) ---
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
L.cylinder("yard", (0.9*s, 1.85*s, 0.42), 0.95, 0.05, M["sand"], verts=24)
for (gx, gy) in [(-2.0*s, 1.7*s), (-2.1*s, -1.5*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.22, 0.12, M["moss"], verts=10)


def crossed_swords(cx, cy, cz, sc=1.0):
    """Gekreuzte Schwerter auf dunkler Wappen-Plakette, flach an der Frontwand."""
    L.box("plrim",  (cx, cy - 0.04, cz), (1.02*sc, 0.05, 1.12*sc), gold_or("wall_d"), bevel=0.08)
    L.box("plaque", (cx, cy + 0.00, cz), (0.86*sc, 0.06, 0.96*sc), M["wood_d"], bevel=0.06)
    for ang in (27, -27):
        a = math.radians(ang)
        blade = L.box("blade", (cx, cy + 0.08, cz + 0.10*sc), (0.07*sc, 0.05, 0.72*sc), M["iron"], bevel=0.012)
        blade.rotation_euler = (0, a, 0)
        tip = L.cone("stip", (cx + math.sin(a)*0.46*sc, cy + 0.08, cz + 0.10*sc + math.cos(a)*0.46*sc),
                     0.055*sc, 0.001, 0.16*sc, M["iron"], verts=4)
        tip.rotation_euler = (0, a, 0)
        hilt = L.box("hilt", (cx - math.sin(a)*0.40*sc, cy + 0.08, cz + 0.10*sc - math.cos(a)*0.40*sc),
                     (0.06*sc, 0.05, 0.2*sc), M["accent"] if T["gold"] else M["iron_d"], bevel=0.02)
        hilt.rotation_euler = (0, a, 0)
    L.box("guard", (cx, cy + 0.1, cz - 0.18*sc), (0.56*sc, 0.06, 0.08*sc), M["accent"] if T["gold"] else M["iron"], bevel=0.02)
    L.cylinder("boss", (cx, cy + 0.04, cz + 0.04*sc), 0.1*sc, 0.1, gold_or("wall_l"), verts=16)


def weapon_rack(cx, cy, cz):
    """Speer-Ständer (an der +X-Seite)."""
    L.box("rackp", (cx, cy - 0.5, cz + 0.45), (0.09, 0.09, 0.9), M["wood_d"], bevel=0.02)
    L.box("rackp", (cx, cy + 0.5, cz + 0.45), (0.09, 0.09, 0.9), M["wood_d"], bevel=0.02)
    L.box("rackb", (cx, cy, cz + 0.78), (0.1, 1.15, 0.09), M["wood"], bevel=0.02)
    for sy in (-0.34, -0.11, 0.11, 0.34):
        L.cylinder("spear", (cx, cy + sy, cz + 0.62), 0.03, 1.2, M["wood"], verts=8)
        L.cone("sphead", (cx, cy + sy, cz + 1.32), 0.06, 0.001, 0.22, M["iron"], verts=8)


def training_dummy(cx, cy, cz):
    """Trainingspuppe: Pfahl + Querarme + Strohkopf + Rundschild."""
    L.cylinder("dpost", (cx, cy, cz + 0.6), 0.09, 1.2, M["wood_d"], verts=12)
    L.box("darm", (cx, cy, cz + 0.98), (0.85, 0.11, 0.11), M["wood"], bevel=0.02)
    L.cylinder("dbody", (cx, cy, cz + 0.9), 0.23, 0.45, M["straw"], verts=16)
    L.cylinder("dhead", (cx, cy, cz + 1.28), 0.15, 0.24, M["straw"], verts=16)
    sh = L.cylinder("dshield", (cx, cy - 0.26, cz + 0.9), 0.2, 0.07, gold_or("iron_d"), verts=20)
    sh.rotation_euler = (math.radians(90), 0, 0)


def banner_on(cx, cy, base_z, pole_h=0.85, w=0.5, h=0.34):
    """Wimpel, dessen Mast-Fuß auf base_z sitzt (auf Dach/Turm — schwebt NICHT)."""
    L.banner("bf", cx, cy, base_z, w, h, M["wood_d"], M["flag"], M["accent"], pole_h=pole_h)


def brazier(cx, cy, cz, fm=None, fc=None):
    """Brennende Feuerschale auf Pfosten (emissive Flamme). fm/fc = Flamme/Kern-Material."""
    fm = fm or M["flame"]; fc = fc or M["flame_c"]
    L.cylinder("brpost", (cx, cy, cz + 0.42), 0.08, 0.84, M["wood_d"], verts=8)
    L.cone("brbowl", (cx, cy, cz + 0.9), 0.25, 0.13, 0.26, gold_or("iron_d"), verts=14)
    L.cylinder("brember", (cx, cy, cz + 1.0), 0.16, 0.12, fm, verts=12)
    L.cone("brflame", (cx, cy, cz + 1.28), 0.16, 0.001, 0.5, fm, verts=12)
    L.cone("brcore", (cx, cy, cz + 1.24), 0.09, 0.001, 0.36, fc, verts=10)


def floating_sword(x, y, cz, length=0.85):
    """Magisch schwebendes Schwert (Spitze nach unten), glühende Geister-Klinge."""
    L.box("fsblade", (x, y, cz), (0.09, 0.09, length), M["mblade"], bevel=0.012)
    tip = L.cone("fstip", (x, y, cz - length/2 - 0.08), 0.075, 0.001, 0.22, M["mblade"], verts=4)
    tip.rotation_euler = (math.radians(180), 0, 0)
    L.box("fsguard", (x, y, cz + length/2 + 0.03), (0.32, 0.32, 0.06), M["accent"], bevel=0.02)
    L.cylinder("fsgrip", (x, y, cz + length/2 + 0.22), 0.05, 0.32, M["wood_d"], verts=8)
    L.cylinder("fspom", (x, y, cz + length/2 + 0.42), 0.07, 0.1, M["accent"], verts=10)


def sword_monument(x, y, cz, blade_h=2.3):
    """Großes Geister-Schwert, in den Sockel gerammt (Schwert-im-Stein), glühende Klinge."""
    L.cone("smrock", (x, y, cz + 0.12), 0.42, 0.3, 0.4, M["mdeep"], verts=18)   # Felssockel
    L.box("smblade", (x, y, cz + 0.25 + blade_h/2), (0.17, 0.09, blade_h), M["mblade"], bevel=0.02)
    L.box("smedge",  (x, y + 0.05, cz + 0.25 + blade_h/2), (0.05, 0.05, blade_h*0.82), M["rune"], bevel=0.0)
    L.box("smguard", (x, y, cz + 0.25 + blade_h), (0.74, 0.16, 0.13), M["accent"], bevel=0.03)
    L.cylinder("smgrip", (x, y, cz + 0.25 + blade_h + 0.32), 0.08, 0.52, M["wood_d"], verts=10)
    L.cylinder("smpom",  (x, y, cz + 0.25 + blade_h + 0.62), 0.12, 0.18, M["accent"], verts=12)


def rune_circle(cx, cy, cz, r=1.0):
    """Leuchtender Runenkreis am Boden (Ring + Glyphen)."""
    L.cylinder("rcout", (cx, cy, cz), r, 0.05, M["portal"], verts=40)
    L.cylinder("rcin",  (cx, cy, cz + 0.012), r - 0.16, 0.05, M["sand"], verts=40)
    L.cylinder("rcmid", (cx, cy, cz), r - 0.42, 0.055, M["portal"], verts=32)
    L.cylinder("rcmid2",(cx, cy, cz + 0.012), r - 0.56, 0.055, M["sand"], verts=32)
    for k in range(8):
        a = math.radians(k * 45)
        g = L.box("glyph", (cx + math.cos(a)*(r-0.29), cy + math.sin(a)*(r-0.29), cz + 0.02),
                  (0.1, 0.1, 0.05), M["portal"], bevel=0.01)
        g.rotation_euler = (0, 0, a)


def thatch_roof(cx, cy, cz, lx, wy, h, damaged=False):
    """Dickes Strohdach: Walm + großer Überstand, gerollter First-Wulst, dicke Traufe.
    damaged=True ergänzt ein eingesunkenes Loch + abstehende Strohbüschel (kaputt)."""
    L.hip_roof("roof", (cx, cy, cz + h/2), lx + 0.3, wy + 0.3, h, M["roof"], ridge=0.5)
    # dicke, überstehende Traufe unten
    L.box("eave", (cx, cy, cz + 0.08), (lx + 0.42, wy + 0.42, 0.16), M["roof_d"], bevel=0.06)
    # gerollter First-Wulst (entlang X)
    roll = L.cylinder("ridgeroll", (cx, cy, cz + h - 0.04), 0.15, lx * 0.55, M["roof_d"], verts=10)
    roll.rotation_euler = (0, math.radians(90), 0)
    # ein paar abstehende Strohbüschel (Struktur)
    for (bx, by) in [(-lx*0.28, 0.55), (lx*0.3, -0.5), (lx*0.05, 0.7)]:
        t = L.cone("tuft", (cx + bx, cy + by, cz + h*0.55), 0.07, 0.02, 0.3, M["roof_d"], verts=6)
        t.rotation_euler = (math.radians(38 if by > 0 else -38), 0, 0)
    if damaged:
        # GROSSES eingesunkenes Loch (dunkel) + freiliegende Dachsparren darin
        hole = L.box("hole", (cx + 0.45, cy - 0.35, cz + h - 0.14), (1.05, 0.92, 0.14), M["wood_d"], bevel=0.04)
        hole.rotation_euler = (math.radians(-15), 0, 0)
        for sx in (0.1, 0.45, 0.8):
            r = L.box("exraf", (cx + sx, cy - 0.35, cz + h - 0.16), (0.06, 0.98, 0.06), M["wood_d"], bevel=0.0)
            r.rotation_euler = (math.radians(-15), 0, 0)
        L.box("exbeam", (cx + 0.45, cy - 0.35, cz + h - 0.16), (1.0, 0.06, 0.06), M["wood_d"], bevel=0.0)
        # fehlende Dachecke (dunkles Dreieck am Rand)
        ec = L.box("edgegap", (cx - 1.35, cy + 0.7, cz + h*0.55), (0.5, 0.5, 0.1), M["wood_d"], bevel=0.03)
        ec.rotation_euler = (math.radians(34), 0, 0)
        # viele ausgefranste, abstehende Strohhalme am Lochrand
        for k in range(8):
            hx = cx - 0.1 + k * 0.16
            st = L.cone("strawb", (hx, cy - 0.05, cz + h*0.66 + (k % 3)*0.09), 0.045, 0.01, 0.4, M["roof_d"], verts=5)
            st.rotation_euler = (math.radians(18 + k*7), 0, math.radians(k*7 - 16))
    return cz + h


def main_roof(cx, cy, cz, lx, wy, h):
    """Dach je Stil; gibt die First-Höhe (z) zurück, damit Flaggen darauf sitzen."""
    style = T["roof_style"]
    if style == "thatch":
        return thatch_roof(cx, cy, cz, lx, wy, h)
    elif style == "spire":
        L.hip_roof("roof", (cx, cy, cz + h*1.2/2), lx, wy, h*1.2, M["roof"], ridge=0.22)
        L.crystal("spire_c", (cx, cy, cz + h*1.2 + 0.2), 0.16, 0.6, M["crystal"])
        ridge_z = cz + h*1.2
    else:
        L.hip_roof("roof", (cx, cy, cz + h/2), lx, wy, h, M["roof"], ridge=0.55)
        ridge_z = cz + h
    if T["gold"]:
        L.box("ridge", (cx, cy, cz + h*0.96), (lx*0.5, 0.14, 0.14), M["accent"], bevel=0.03)
    return ridge_z


def build_tower(sx, sy, th=3.0):
    """Ecksturm + Kappe; Flagge sitzt auf der Kappe (kein Schweben)."""
    L.cylinder("twr", (sx, sy, th/2 + 0.4), 0.46, th, M["wall"], verts=20)
    L.box("twrband", (sx, sy, th + 0.1), (1.0, 1.0, 0.12), M["wall_d"], bevel=0.03)
    L.battlement_ring("tmer", sx, sy, 0.44, 0.44, th + 0.3, M["wall_d"], merlon=0.18, gap=0.16, h=0.2)
    if T["roof_style"] == "spire":
        L.cone("twrcap", (sx, sy, th + 0.95), 0.56, 0.001, 1.3, M["roof"], verts=20)
        L.crystal("tc", (sx, sy, th + 1.7), 0.1, 0.42, M["crystal"])
    else:
        L.cone("twrcap", (sx, sy, th + 0.85), 0.6, 0.001, 1.05, M["roof"], verts=20)
        banner_on(sx, sy, th + 1.3, pole_h=0.55, w=0.4, h=0.28)


def build_hut():
    """Tier 1-2 in 3 Baustufen (stage). NUR Tier 1 / Level 1 ist die kaputte Ruine —
    alle weiteren Stufen sind intakt und werden additiv besser bis zur nächsten Tier-Stufe.
    Tier 2: stage1 schlichtes Steinhaus → stage2 +Eckquader+Schornstein → stage3 Vollausbau."""
    is_t2 = (tier == 2)
    base_h = 0.34
    full_h = 1.45
    hall_top = base_h + full_h + 0.17  # = 1.96
    crooked = (decay > 0 and not is_t2)
    corners = [(-1.55, 1.05), (1.55, 1.05), (-1.55, -1.15), (1.55, -1.15)]
    L.box("base", (0, -0.1, 0.4), (3.6, 2.5, base_h), M["wall_d"], bevel=0.05)

    ruined = (tier == 1 and stage == 1)
    # ---- Mauern (alle Stufen = volles Haus; bei ruined deutlich schief/verfallen) ----
    body = L.box("hall", (0, -0.1, base_h + full_h/2 + 0.17), (3.2, 2.2, full_h), M["wall"], bevel=0.06)
    if ruined:
        body.rotation_euler = (math.radians(6.5), 0, math.radians(-7.5))   # stark verfallen, schief
    elif crooked and stage == 2:
        body.rotation_euler = (math.radians(decay*1.4), 0, math.radians(-decay*1.1))

    if is_t2 and stage >= 2:
        # Stein-Eckquader (erste Aufwertung ab Level 5)
        for (px, py) in corners:
            for i, qz in enumerate((0.7, 1.15, 1.6)):
                w = 0.34 if i % 2 == 0 else 0.28
                L.box("quoin", (px, py, qz), (w, w, 0.3), M["wall_l"], bevel=0.03)
    else:
        # Holz-Eckpfosten; bei ruined fehlt einer + einer steht schief (verfallen)
        skip = corners[2] if ruined else None
        for idx, (px, py) in enumerate(corners):
            if (px, py) == skip:
                continue
            p = L.box("post", (px, py, hall_top/2 + 0.2), (0.15, 0.15, hall_top - 0.2), M["wood_d"], bevel=0.0)
            if ruined and idx == 1:
                p.rotation_euler = (math.radians(7), 0, 0)
        if ruined:
            # ausgefranste Wand-Oberkante: einzelne abstehende Latten, einige fehlen
            for lx2 in (-1.25, -0.7, 0.35, 0.95):
                sl = L.box("slat", (lx2, 1.02, hall_top - 0.02), (0.11, 0.12, 0.38), M["wood_d"], bevel=0.0)
                sl.rotation_euler = (math.radians(8), 0, math.radians(lx2*4))
            # Wandlöcher (fehlende Bretter — dunkle Lücken, bündig auf der Front/Seite)
            for (hx, hy, hd, hz, hw, hh) in [(-0.7, 1.01, 0.0, 1.35, 0.34, 0.45),
                                              (0.62, 1.01, 0.0, 0.78, 0.26, 0.4),
                                              (1.61, 0.3, 1, 1.1, 0.4, 0.5)]:
                if hd == 0:
                    L.box("whole", (hx, hy, hz), (hw, 0.06, hh), M["wood_d"], bevel=0.02)
                else:
                    L.box("whole", (hx, hy, hz), (0.06, hw, hh), M["wood_d"], bevel=0.02)
            # mehr Trümmer am Boden: 2 gefallene Balken + Schutthaufen + lose Bretter
            fb = L.box("fallen", (-1.75, 1.7, 0.5), (0.13, 0.13, 1.6), M["wood_d"], bevel=0.0)
            fb.rotation_euler = (math.radians(82), 0, math.radians(14))
            fb2 = L.box("fallen2", (1.2, 1.9, 0.46), (0.12, 1.3, 0.12), M["wood"], bevel=0.0)
            fb2.rotation_euler = (0, 0, math.radians(24))
            L.cone("rubble", (-1.5, -1.5, 0.46), 0.42, 0.16, 0.34, M["wall_d"], verts=12)
            for i in range(2):
                L.box("debris", (-1.0 + i*0.3, -1.7, 0.46 + i*0.08), (0.5, 0.14, 0.1), M["wood_d"], bevel=0.02)
            # Moosflecken
            for (mx, my, mz) in [(-1.62, 0.4, 0.7), (1.62, -0.3, 1.1), (-0.2, 1.02, 0.6)]:
                L.box("moss", (mx, my, mz), (0.04 if mx < -1 else 0.3, 0.5 if mx < -1 else 0.04, 0.4), M["moss"], bevel=0.05)

    # Tür + Fenster (bei ruined: Tür fehlt, ein Fenster dunkel/leer)
    L.box("dframe", (0, 1.06, 0.9), (1.25, 0.12, 1.25), M["wood_d"], bevel=0.02)
    if not ruined:
        L.box("door", (0, 1.12, 0.84), (1.02, 0.12, 1.1), M["wood"], bevel=0.03)
    else:
        L.box("doordark", (0, 1.0, 0.84), (0.95, 0.1, 1.05), M["wood_d"], bevel=0.02)  # dunkle Öffnung
    for i, x in enumerate((-1.05, 1.05)):
        L.box("wfr", (x, 1.08, 1.22), (0.42, 0.08, 0.42), M["wood_d"], bevel=0.02)
        wm = M["wood_d"] if (ruined and i == 0) else M["win"]   # ein Fenster leer bei ruined
        L.box("win", (x, 1.12, 1.22), (0.3, 0.08, 0.3), wm, bevel=0.02)

    ridge_z = thatch_roof(0, -0.1, hall_top, 3.7, 2.7, 1.05, damaged=ruined) if T["roof_style"] == "thatch" \
        else main_roof(0, -0.1, hall_top, 3.7, 2.7, 1.05)
    if not ruined:
        banner_on(0.7, -0.1, ridge_z - 0.05, pole_h=0.7)

    if is_t2 and stage >= 2:
        # Schornstein mit Rauch (Aufwertung ab Level 5)
        L.box("chimney", (-1.15, -0.7, hall_top + 0.55), (0.34, 0.34, 1.1), M["wall_l"], bevel=0.04)
        L.box("chimtop", (-1.15, -0.7, hall_top + 1.12), (0.42, 0.42, 0.12), M["wall_d"], bevel=0.03)
        for i, dz in enumerate((1.4, 1.75, 2.05)):
            L.cylinder("smoke", (-1.15 - i*0.08, -0.7, hall_top + dz), 0.1 + i*0.04, 0.14, M["smoke"], verts=10)

    if stage == 3:
        # Vollausbau: restliche Tier-2-Extras + komplette Kaserne-Signatur
        if is_t2:
            L.box("canopy", (0, 1.55, 1.62), (1.4, 0.7, 0.1), M["roof"], bevel=0.03)
            for cx2 in (-0.5, 0.5):
                L.box("cpost", (cx2, 1.85, 1.05), (0.08, 0.08, 1.1), M["wood_d"], bevel=0.0)
            for x in (-1.05, 1.05):
                L.box("wsill", (x, 1.06, 0.98), (0.5, 0.12, 0.09), M["wall_l"], bevel=0.02)
        crossed_swords(0, 1.18, hall_top - 0.28, sc=0.46)
        weapon_rack(1.95, -0.2, 0.36)
        training_dummy(1.0, 2.0, 0.36)


def build_hall():
    """Tier 3-4 in 3 intakten Baustufen (additiv besser, KEINE Ruine):
    stage1 = schlichte Halle + Dach; stage2 = +Strebepfeiler/Türme +Wappen;
    stage3 = Vollausbau (T3 +Speer/Puppe; T4 4 Türme + Feuerschalen)."""
    rich = tier >= 4
    L.box("base",  (0, -0.1, 0.62), (4.0, 2.9, 0.55), M["wall_d"], bevel=0.06)
    L.box("hall",  (0, -0.1, 0.9 + 1.55/2), (3.5, 2.4, 1.55), M["wall"],  bevel=0.07)
    L.box("band",  (0, -0.1, 1.08), (3.55, 2.45, 0.1), M["wall_l"], bevel=0.02)
    hall_top = 0.9 + 1.55  # = 2.45

    # T3: Strebepfeiler mit Zinnenkappe — ab stage 2 (Aufwertung)
    if not rich and stage >= 2:
        for (px, py) in [(-1.7, 1.15), (1.7, 1.15), (-1.7, -1.35), (1.7, -1.35)]:
            L.box("butt", (px, py, 1.05), (0.32, 0.32, hall_top - 0.1), M["wall_l"], bevel=0.04)
            if T["battlements"]:
                L.battlement_ring("bm", px, py, 0.18, 0.18, hall_top - 0.05, M["wall_d"], merlon=0.16, gap=0.12, h=0.2)

    # breites Tor mit Rahmen (immer)
    L.box("portal",  (0, 1.04, 1.05), (1.7, 0.26, 1.6), M["wall_l"], bevel=0.04)
    L.box("doorway", (0, 0.96, 0.95), (1.25, 0.4, 1.3), M["wood_d"], bevel=0.02)
    L.box("door",    (0, 1.07, 0.95), (1.12, 0.12, 1.25), M["wood"], bevel=0.03)
    for px in (-0.64, 0.64):
        L.box("post", (px, 1.14, 0.98), (0.12, 0.14, 1.5), gold_or("wall_l"), bevel=0.03)
    L.box("lintel", (0, 1.14, 1.78), (1.58, 0.16, 0.16), gold_or("wall_l"), bevel=0.03)
    L.box("step", (0, 1.5, 0.42), (1.5, 0.42, 0.14), M["wall_l"], bevel=0.03)
    for x in (-1.2, 1.2):
        L.box("wframe", (x, 1.04, 1.5), (0.42, 0.1, 0.72), M["wall_l"], bevel=0.03)
        L.box("wglass", (x, 1.1, 1.5), (0.24, 0.08, 0.54), M["win"], bevel=0.02)
        L.box("wsill",  (x, 1.06, 1.12), (0.48, 0.12, 0.1), M["wall_d"], bevel=0.02)

    ridge_z = main_roof(0, -0.1, hall_top, 3.6, 2.55, 1.2)
    L.box("eaveF", (0, 1.18, hall_top + 0.04), (3.55, 0.13, 0.13), gold_or("roof_d"), bevel=0.02)
    banner_on(0.85, -0.1, ridge_z - 0.05, pole_h=0.8)   # Flagge AUF dem Dachfirst (immer)

    if stage >= 2:
        crossed_swords(0, 1.18, hall_top - 0.37, sc=0.6)   # Wappen ab stage 2

    if rich:
        # T4 Ecktürme schon ab stage 1 (2 Türme) → klar grandioser als die nackte
        # T3-Halle (Level 7); ab stage 2 alle 4; Feuerschalen erst stage 3.
        coords = [(-1.9, -1.4), (1.9, -1.4)]
        if stage >= 2:
            coords += [(-1.9, 1.3), (1.9, 1.3)]
        for (sx, sy) in coords:
            build_tower(sx, sy, th=3.0)
        if stage == 3:
            brazier(-1.05, 1.85, 0.36)
            brazier(1.05, 1.85, 0.36)

    if stage == 3:
        weapon_rack(2.2, -0.2, 0.5)
        training_dummy(1.05, 2.05, 0.36)


def build_arcane():
    """Tier 5 — ARKANE GARNISON: eigene, klar krassere Silhouette als T4.
    Kristall-Cluster statt Dach, schwebende Geister-Schwerter, Portal-Tor,
    Energie-Adern, Runenkreis, Magie-Flammen."""
    # DUNKLER ARKANSTEIN (lokaler Override nur für diese T5-Kaserne) — der dunkle
    # Korpus + stark leuchtende Kristalle/Runen geben den epischen Kontrast.
    M["wall"]   = L.mat("awall",   (0.30, 0.24, 0.42), rough=0.9)
    M["wall_l"] = L.mat("awall_l", (0.44, 0.36, 0.58), rough=0.82)
    M["wall_d"] = L.mat("awall_d", (0.19, 0.14, 0.28), rough=0.95)
    M["roof"]   = L.mat("aroof",   (0.26, 0.15, 0.44), rough=0.6)
    # Sockel + Halle (dunkler Magie-Marmor, höher als T4)
    L.box("base", (0, -0.1, 0.62), (4.0, 2.9, 0.55), M["wall_d"], bevel=0.06)
    L.box("hall", (0, -0.1, 0.9 + 1.7/2), (3.5, 2.4, 1.7), M["wall"], bevel=0.07)
    L.box("band", (0, -0.1, 1.12), (3.55, 2.45, 0.12), M["accent"], bevel=0.02)
    hall_top = 0.9 + 1.7  # = 2.6
    # leuchtende Energie-Adern (vertikal) auf Front + Seiten
    for x in (-1.55, -0.95, 0.95, 1.55):
        L.box("vein", (x, 1.16, 1.85), (0.06, 0.04, 1.3), M["rune"], bevel=0.0)
    for y in (-0.7, 0.0, 0.7):
        L.box("veinL", (-1.77, y, 1.85), (0.04, 0.06, 1.3), M["rune"], bevel=0.0)
        L.box("veinR", (1.77, y, 1.85), (0.04, 0.06, 1.3), M["rune"], bevel=0.0)
    # Magie-Portal-Tor: Steinbogen + leuchtende Portalfläche
    L.box("portalfr", (0, 1.04, 1.1), (1.75, 0.26, 1.7), M["wall_l"], bevel=0.04)
    L.box("portalglow", (0, 1.12, 1.0), (1.15, 0.12, 1.45), M["portal"], bevel=0.03)
    L.cylinder("parch", (0, 1.1, 1.78), 0.62, 0.24, M["wall_l"], verts=20)
    L.cylinder("parchg", (0, 1.18, 1.78), 0.48, 0.12, M["portal"], verts=20)
    for px in (-0.66, 0.66):
        L.box("ppost", (px, 1.16, 1.0), (0.13, 0.15, 1.6), M["accent"], bevel=0.03)
    L.box("step", (0, 1.5, 0.42), (1.5, 0.42, 0.14), M["wall_l"], bevel=0.03)
    # leuchtende Kristall-Fenster
    for x in (-1.25, 1.25):
        L.box("wframe", (x, 1.04, 1.55), (0.44, 0.1, 0.78), M["accent"], bevel=0.03)
        L.crystal("wcry", (x, 1.12, 1.5), 0.16, 0.62, M["crystal"])
    # flaches dunkles Dach als Sockel
    L.hip_roof("roof", (0, -0.1, hall_top + 0.4), 3.5, 2.5, 0.8, M["mdeep"], ridge=0.4)
    roof_z = hall_top + 0.8

    # KRISTALL-TÜRME + Magie-Flammen + Wappen (IMMER, ab Level 13)
    for (sx, sy) in [(-1.95, -1.45), (1.95, -1.45), (-1.95, 1.35), (1.95, 1.35)]:
        th = 2.7
        L.cylinder("twr", (sx, sy, th/2 + 0.4), 0.44, th, M["wall"], verts=20)
        L.cylinder("twrglow", (sx, sy, th * 0.6), 0.455, 0.18, M["rune"], verts=20)
        L.box("twrband", (sx, sy, th + 0.08), (0.98, 0.98, 0.12), M["accent"], bevel=0.03)
        L.crystal("twrcry", (sx, sy, th + 1.05), 0.42, 2.0, M["crystal"])
    brazier(-1.15, 1.95, 0.36, fm=M["mflame"], fc=M["mflame_c"])
    brazier(1.15, 1.95, 0.36, fm=M["mflame"], fc=M["mflame_c"])
    crossed_swords(0, 1.18, hall_top - 0.42, sc=0.62)

    if stage == 1:
        # Level 13: Kristalltürme-Festung, noch ohne Kern → Banner krönt das Dach
        banner_on(0.85, -0.1, roof_z - 0.05, pole_h=0.85)
        return

    # stage 2 & 3: zentraler Kristallkern + Monument + Runenkreis + Bodenkristalle
    L.cylinder("coreglow", (0, -0.2, roof_z + 0.1), 0.5, 0.3, M["rune"], verts=24)
    L.crystal("core", (0, -0.2, roof_z), 0.55, 3.4, M["crystal"])
    for (cx2, cy2, rr, hh, tl) in [(-0.95, -0.1, 0.26, 1.7, 10), (0.95, -0.1, 0.26, 1.7, -10),
                                    (0.0, 0.8, 0.22, 1.35, 0), (0.0, -0.95, 0.22, 1.35, 0)]:
        c = L.crystal("shard", (cx2, cy2, roof_z - 0.05), rr, hh, M["crystal"])
        c.rotation_euler = (math.radians(tl) if cy2 == 0 else math.radians(10 if cy2 > 0 else -10),
                            0, math.radians(tl))
    rune_circle(0.9, 1.95, 0.43, r=1.1)
    sword_monument(0.9, 1.95, 0.45, blade_h=2.2)
    for (cx2, cy2, rr, hh) in [(-2.35, 1.3, 0.18, 0.95), (2.35, 1.2, 0.16, 0.8),
                                (-2.3, -1.0, 0.15, 0.7), (2.3, -1.1, 0.17, 0.85)]:
        L.crystal("gc", (cx2, cy2, 0.55), rr, hh, M["crystal"])

    if stage == 3:
        # ---- LEVEL 15: ASCENSION (deutlich krasser) ----
        core_top = roof_z + 3.4
        # 1) gleißender Energiestrahl aus dem Kern nach oben
        L.cylinder("beam", (0, -0.2, core_top + 0.7), 0.16, 1.8, M["mflame_c"], verts=16)
        L.cylinder("beam2", (0, -0.2, core_top + 0.5), 0.32, 1.3, M["rune"], verts=20)
        L.crystal("beamtip", (0, -0.2, core_top + 1.65), 0.24, 0.8, M["crystal"])
        # 2) Glüh-Halos (flache Ringe) um den Kern
        for (hz, hr) in [(roof_z + 0.9, 1.25), (roof_z + 1.9, 1.0), (roof_z + 2.7, 0.7)]:
            L.cylinder("halo_o", (0, -0.2, hz), hr, 0.05, M["portal"], verts=40)
            L.cylinder("halo_i", (0, -0.2, hz + 0.012), hr - 0.13, 0.05, M["mdeep"], verts=40)
        # 3) Orbit-Ring aus schwebenden Kristallsplittern um die Festung
        for k in range(8):
            a = math.radians(k * 45)
            cs = L.crystal("orb", (math.cos(a)*2.45, -0.2 + math.sin(a)*2.0, roof_z + 0.6 + (k % 2)*0.5),
                           0.13, 0.62, M["crystal"])
            cs.rotation_euler = (math.radians(90), 0, a)
        # 4) schwebende Kristall-Inseln (klar magisch: Fels-Spitze unten + Kristall + Glühscheibe)
        for (ix, iy, iz) in [(-2.9, 1.0, 2.7), (2.9, 0.4, 3.1), (0.2, -3.0, 2.9)]:
            isl = L.cone("isle", (ix, iy, iz), 0.5, 0.16, 0.5, M["mdeep"], verts=12)
            isl.rotation_euler = (math.radians(180), 0, 0)   # Spitze nach unten
            L.cylinder("isleglow", (ix, iy, iz + 0.2), 0.42, 0.05, M["rune"], verts=20)
            L.crystal("islec", (ix, iy, iz + 0.28), 0.18, 0.85, M["crystal"])
        # 5) großer leuchtender Runenkreis um die ganze Festung
        L.cylinder("bigring_o", (0, -0.1, 0.46), 2.75, 0.05, M["portal"], verts=64)
        L.cylinder("bigring_i", (0, -0.1, 0.472), 2.5, 0.05, M["grass"], verts=64)


if tier <= 2:
    build_hut()
elif tier == 5:
    build_arcane()
else:
    build_hall()

if tier == 5:
    if stage == 1:
        L.setup_iso_camera(ortho_scale=10.0, target_z=2.5)   # Kristalltürme
    elif stage == 2:
        L.setup_iso_camera(ortho_scale=11.0, target_z=2.9)   # + Kristallkern
    else:
        L.setup_iso_camera(ortho_scale=13.0, target_z=3.6)   # Ascension (Energiestrahl)
else:
    L.setup_iso_camera(ortho_scale=9.0, target_z=2.0)
L.setup_lights()
L.render_png(out, res=700)
