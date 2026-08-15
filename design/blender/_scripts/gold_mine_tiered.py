"""Menschen-Goldmine (gold_mine), parametrisch über LEVEL 1..15.
blender -b --python gold_mine_tiered.py -- <level> <out.png>
tier = tier_for_level(level), stage = (level-1)%3+1 (Baustufe 1..3 im Tier).

KONZEPT: eine ECHTE Mine = ein FELSBERG mit einem STOLLEN-EINGANG (Tunnel, der in
den Berg führt), nicht eine Grube im Boden. Ikonisch: dunkler Tunnelmund im Fels,
davor ein Holz-Portalrahmen (2 Pfosten + Querbalken = das universelle Minen-Symbol),
Schienen die aus dem Stollen herauslaufen, eine Lore mit Golderz, GOLDADERN im Fels
(macht es klar als GOLD-Mine erkennbar). NUR Level 1 ist die verfallene Ausgangsform
(Ruine — Portal eingestürzt, Stollen mit Geröll verschüttet, Lore umgekippt, kein
Glühen). Danach additiv reicher/edler:
  T1 (Holz):     krudes Holzportal, kleiner Berg, erste Goldadern.
  T2 (Stein):    repariertes Portal + hölzerne Verstärkungsbalken quer.
  T3 (Sandstein):Stahl-Verstärkung + Förderrad (Seilrolle) mit Seil über dem Stollen.
  T4 (Marmor):   höhere Stahlbalken + Zahnrad + Stachel-Ecken, größerer Berg.
  T5 (Magie):    arkane Version — leuchtende Runen-Balken + leuchtendes Rad + Glühen.
Das Erz bleibt IMMER Gold (alle Tiers), nur Rahmen/Rad/Adern werden edler.
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_mine_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

M = {
    "wood":   L.mat("wood",   T["wood"],   rough=0.9),
    "wood_d": L.mat("wood_d", T["wood_d"], rough=0.9),
    "accent": L.mat("accent", T["accent"], rough=(0.32 if T["gold"] else 0.85), metal=(0.9 if T["gold"] else 0.0)),
    "grass":  L.mat("grass",  T["ground"], rough=1.0),
    "grass_d":L.mat("grass_d",T["ground_d"],rough=1.0),
    "dirt":   L.mat("dirt",   (0.42, 0.31, 0.19), rough=1.0),
    "dirt_l": L.mat("dirt_l", (0.52, 0.40, 0.26), rough=1.0),
    "moss":   L.mat("moss",   (0.34, 0.50, 0.20), rough=1.0),
    "iron":   L.mat("iron",   (0.74, 0.77, 0.82), rough=0.35, metal=0.85),
    "iron_d": L.mat("iron_d", (0.30, 0.32, 0.36), rough=0.5, metal=0.6),
    "cave":   L.mat("cave",   (0.02, 0.02, 0.03), rough=1.0),               # Stollen-Inneres, fast schwarz
    "rock":   L.mat("rock",   (0.40, 0.38, 0.35), rough=1.0),              # Fels hell
    "rock_d": L.mat("rock_d", (0.29, 0.28, 0.26), rough=1.0),              # Fels dunkel / Schutt
    "rope":   L.mat("rope",   (0.28, 0.20, 0.11), rough=1.0),              # Förderseil
    "gold_ore":L.mat("gold_ore",(0.97, 0.76, 0.20), rough=0.4, metal=0.6, emis=0.15),  # IMMER Gold, alle Tiers
    "ember":  L.mat("ember",  (0.95, 0.55, 0.16), rough=0.5, emis=0.55),   # "leises Glühen" aus dem Stollen
    "rune":   L.mat("rune",   (0.55, 0.82, 1.0), rough=0.3, emis=1.1),          # kleine Akzente (Hub)
    "rune_bar": L.mat("rune_bar", (0.45, 0.68, 0.9), rough=0.35, emis=0.15),   # große Flächen (Balken/Rad/Glühen)
    "accent_blue": L.mat("accent_blue", (0.22, 0.42, 0.78), rough=0.4, metal=0.3),  # Lore-Räder (Wiki: "blue wheels")
}
s = T["scale"]
ruin = (tier == 1 and stage == 1)

# --- Leitmaße von Berg & Stollen ---------------------------------------------
z0 = 0.42                 # Bodenoberkante (Rasen)
pcx = 0.0                 # Stollen-Mitte X
pfront_y = 0.35           # vordere Ebene von Portalrahmen & Stollenmund (+Y = zur Kamera)
phw = 0.55                # halbe Stollenbreite
ph = 1.28                 # Stollenhöhe
ptop = z0 + ph            # Oberkante Stollen/Portal
grow = 0.05 * (tier - 1)  # der Berg wächst leicht mit dem Tier


def gold_or(mat_key):
    return M["accent"] if T["gold"] else M[mat_key]


def strut(p1, p2, th, mat, name="strut"):
    """Balken zwischen zwei Punkten (Box am Ursprung, dann rotiert+verschoben)."""
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
    """Rotierbare Box: bei (0,0,0) erzeugen, skalieren, ERST rotieren, DANN
    verschieben (strut-Muster). Achtung: transform_apply backt in Blender 4.2
    auch die Position ins Mesh — deshalb darf die Box beim Apply noch nicht an
    ihrer Zielposition stehen, sonst rotiert sie um den Weltursprung
    (L.box + rotation_euler hat die Ruinen-Lore so unsichtbar gemacht)."""
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
    """Gestauchte Ikosphäre — für Felsbrocken/Schutt. subdiv=1+smooth=False = kantig."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0, location=(cx, cy, cz))
    o = bpy.context.active_object
    o.name = name
    o.scale = (rx, ry, rz)
    bpy.ops.object.transform_apply(scale=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def nugget(cx, cy, cz, r, mat):
    return lump("nugget", cx, cy, cz, r, r * 0.9, r * 0.8, mat, subdiv=1)


def wheel(cx, cy, cz, r, depth, mat, spokes=False, hub_mat=None):
    """Speichenrad, Achse entlang X (Radfläche zeigt zur Kamera) — Seilrolle/Karren."""
    w = L.cylinder("wheel", (cx, cy, cz), r, depth, mat, verts=20)
    w.rotation_euler = (0, math.radians(90), 0)
    L.cylinder("hub", (cx, cy, cz), r*0.22, depth + 0.03, hub_mat or M["iron_d"], verts=10).rotation_euler = (0, math.radians(90), 0)
    if spokes:
        for a in (0.0, math.pi/3, 2*math.pi/3):
            strut((cx, cy + math.cos(a)*r*0.88, cz + math.sin(a)*r*0.88),
                  (cx, cy - math.cos(a)*r*0.88, cz - math.sin(a)*r*0.88), r*0.1, mat, "spoke")
    return w


def ore_pile(cx, cy, count):
    for i in range(count):
        a = i * 2.4
        nugget(cx + math.cos(a)*0.22, cy + math.sin(a)*0.18, z0 + (i % 3)*0.1, 0.13 + 0.02*(i % 2), M["gold_ore"])


# ---------------------------------------------------------------------------
# Grassockel (voll, wie bei den anderen Gebäuden — kein Loch, der Berg steht darauf).
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, -1.7*s), (1.95*s, 1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)


def build_mountain():
    """Fels-Massiv als kantiger Low-Poly-Klippenstock: große, leicht verdrehte
    ECKIGE Blöcke in Schichten (Basis -> Mittel -> Gipfel), Materialwechsel
    hell/dunkel = Gesteinsschichten. Liest sich als gewachsener Berg statt als
    Kugelhaufen. Der Stollen ist in die FRONTWAND geschnitten: Felswand über dem
    Sturz + Felswangen links/rechts rahmen den Eingang."""
    R, Rd = M["rock"], M["rock_d"]
    g = grow
    # Basis-Schicht: Wangen links/rechts vom Stollen + Rückwand
    obox("cliff_L1", (-1.45 - g, -0.55, z0 + 0.72), (1.5, 2.7, 1.5), Rd, rot=(0, math.radians(4), math.radians(7)))
    obox("cliff_R1", (1.45 + g, -0.55, z0 + 0.72), (1.5, 2.7, 1.5), Rd, rot=(0, math.radians(-5), math.radians(-6)))
    obox("cliff_B1", (0, -1.55, z0 + 0.9), (2.7, 1.5, 1.9), R, rot=(math.radians(-3), 0, math.radians(3)))
    # Frontwand ÜBER dem Stollenmund — dadurch wirkt der Tunnel in den Fels
    # geschnitten (vorher klaffte über dem Sturz nur Leere)
    obox("cliff_F1", (0, -0.55, z0 + 1.75), (2.5, 1.5, 1.05), R, rot=(math.radians(2), 0, math.radians(-2)))
    # Mittel-Schicht (zurückgestuft = Terrassen)
    obox("cliff_L2", (-1.1, -0.95, z0 + 1.95), (1.45, 1.8, 1.1), R, rot=(0, math.radians(-6), math.radians(9)))
    obox("cliff_R2", (1.05, -1.0, z0 + 1.85), (1.3, 1.6, 1.0), Rd, rot=(0, math.radians(7), math.radians(-8)))
    # Gipfel + facettierte Felsspitze (bricht die "gestapelte Kisten"-Silhouette)
    obox("peak",  (-0.25, -1.15, z0 + 2.6 + g), (1.6, 1.4, 1.15), Rd, rot=(math.radians(4), math.radians(6), math.radians(13)))
    obox("peak2", (0.6, -1.3, z0 + 2.35 + g), (1.05, 1.0, 0.9), R, rot=(0, math.radians(-8), math.radians(-16)))
    tip = L.cone("peaktip", (-0.3, -1.2, z0 + 3.45 + g), 0.85, 0.06, 0.85, R, verts=6)
    tip.rotation_euler = (0, math.radians(6), math.radians(20))
    # Moos-Polster auf den Fels-Terrassen (etwas Leben im Grau)
    lump("mossL", -1.15, 0.05, z0 + 1.52, 0.24, 0.18, 0.05, M["moss"], smooth=True)
    lump("mossR", 1.2, -0.1, z0 + 1.44, 0.2, 0.16, 0.05, M["moss"], smooth=True)
    lump("mossT", -0.35, -0.3, z0 + 2.3, 0.22, 0.18, 0.05, M["moss"], smooth=True)
    # Geröllbrocken am Fuß
    lump("mtn_s1", -1.05, 0.95, z0 + 0.02, 0.24, 0.2, 0.18, Rd, subdiv=1)
    lump("mtn_s2", 1.1, 0.9, z0 - 0.02, 0.2, 0.18, 0.16, R, subdiv=1)
    lump("mtn_s3", -1.5, 0.7, z0, 0.15, 0.13, 0.12, R, subdiv=1)


def apron():
    """Festgetretenes Erdplateau vor dem Stollen — der 'Minenhof', auf dem die
    Schienen liegen."""
    L.box("apron", (0.15, 1.15, 0.405), (2.3, 1.7, 0.045), M["dirt_l"], bevel=0.02)


def lantern(cx, cy):
    """Grubenlaterne am Pfosten neben dem Eingang (Glüh-Kern zwischen Eisenkappe
    und -boden, damit nichts verdeckt wird)."""
    L.box("lpost", (cx, cy, z0 + 0.35), (0.08, 0.08, 0.7), M["wood_d"], bevel=0.01)
    L.box("larm", (cx, cy + 0.1, z0 + 0.72), (0.06, 0.28, 0.06), M["wood_d"], bevel=0.01)
    L.box("lglow", (cx, cy + 0.22, z0 + 0.58), (0.11, 0.11, 0.14), M["ember"], bevel=0.01)
    L.box("lcap",  (cx, cy + 0.22, z0 + 0.68), (0.15, 0.15, 0.05), M["iron_d"], bevel=0.01)
    L.box("lbase", (cx, cy + 0.22, z0 + 0.5), (0.15, 0.15, 0.04), M["iron_d"], bevel=0.01)


def pickaxe(cx, cy, ang=38):
    """Spitzhacke, an den Fels gelehnt."""
    strut((cx, cy, z0), (cx + 0.12, cy - 0.28, z0 + 0.62), 0.05, M["wood"], "pickhandle")
    obox("pickhead", (cx + 0.13, cy - 0.3, z0 + 0.64), (0.42, 0.06, 0.09), M["iron_d"],
         rot=(0, math.radians(ang), math.radians(-12)))


def build_throat(glow=False):
    """Der dunkle Stollen im Berg: ein tiefer, fast schwarzer Hohlraum, der nach
    hinten/unten wegführt, mit gerundeter Decke. Front ragt knapp vor die
    Strebepfeiler-Innenkanten, damit er sichtbar bleibt."""
    L.box("throat", (pcx, -0.45, z0 + 0.55), (2*phw + 0.05, 1.5, ph - 0.05), M["cave"], bevel=0.05)
    lump("throat_back", pcx, -1.10, z0 + 0.55, 0.62, 0.62, 0.90, M["cave"], subdiv=2, smooth=True)
    lump("throat_arch", pcx, 0.06, z0 + 1.02, 0.52, 0.34, 0.30, M["cave"], subdiv=2, smooth=True)
    if glow:
        gmat = M["rune_bar"] if tier == 5 else M["ember"]
        L.box("glow", (pcx, pfront_y - 0.12, z0 + 0.06), (0.55, 0.34, 0.03), gmat, bevel=0.01)
        L.box("glow2", (pcx, pfront_y - 0.02, z0 + 0.38), (0.3, 0.05, 0.24), gmat, bevel=0.02)


def gold_veins(n):
    """Goldadern/-brocken im Fels rund um den Stollen — macht klar: GOLD-Mine.
    Sitzen auf den vorderen Felsflächen und poken leicht heraus (Wangen-Front
    y≈0.8, Frontwand über dem Stollen y≈0.2)."""
    spots = [
        (-1.05, 0.82, z0 + 0.85), (1.1, 0.80, z0 + 0.75),
        (-0.35, 0.28, z0 + 1.7), (0.42, 0.28, z0 + 1.55),
        (-1.45, 0.78, z0 + 0.45), (1.5, 0.76, z0 + 0.5),
        (0.04, 0.28, z0 + 2.0), (-0.85, 0.84, z0 + 1.2),
        (0.9, 0.82, z0 + 1.15), (-0.8, 0.28, z0 + 1.95),
        (0.85, 0.28, z0 + 1.85), (1.8, 0.74, z0 + 0.9),
    ]
    for (vx, vy, vz) in spots[:n]:
        nugget(vx, vy, vz, 0.10, M["gold_ore"])


def portal_frame(crude=False):
    """Holz-Portalrahmen um den Stollenmund: 2 Pfosten + Querbalken (Sturz) + Schwelle
    = das ikonische Minen-Eingangs-Symbol. crude=True gibt leichte Schieflage."""
    tilt = math.radians(3) if crude else 0.0
    for sx in (-1, 1):
        if crude:
            obox("post", (sx*0.62, pfront_y, z0 + ph*0.5), (0.16, 0.18, ph), M["wood_d"], rot=(0, sx*tilt, 0))
        else:
            L.box("post", (sx*0.62, pfront_y, z0 + ph*0.5), (0.16, 0.18, ph), M["wood_d"], bevel=0.02)
    L.box("lintel", (pcx, pfront_y, ptop + 0.02), (1.58, 0.20, 0.22), M["wood_d"], bevel=0.02)
    L.box("cap",    (pcx, pfront_y - 0.06, ptop + 0.24), (1.30, 0.18, 0.15), M["wood"], bevel=0.02)
    L.box("sill",   (pcx, pfront_y + 0.06, z0 + 0.08), (1.24, 0.18, 0.16), M["wood_d"], bevel=0.02)
    # kurze Kopfbänder (Diagonalstreben) in den oberen Ecken
    for sx in (-1, 1):
        strut((sx*0.55, pfront_y + 0.02, ptop - 0.25), (sx*0.28, pfront_y + 0.02, ptop + 0.02),
              0.09, M["wood"], "brace")


def reinforce(steel=False, tall=False, gear=False, spiked=False, glow=False):
    """Verstärkungsbalken QUER über die beiden Pfosten (T2 Holz, T3+ Stahl). tall/
    gear/spiked = CoC-Lvl-10-Look. Lassen bewusst Lücken → Stollen bleibt sichtbar."""
    mat = M["rune_bar"] if glow else (M["iron"] if steel else M["wood"])
    heights = [z0 + 0.5, z0 + 1.02]
    if tall:
        heights.append(z0 + 1.42)
    for hz in heights:
        L.box("reinf", (pcx, pfront_y + 0.08, hz), (1.52, 0.14, 0.13), mat, bevel=0.02)
        for sx in (-1, 1):
            L.box("bolt", (sx*0.62, pfront_y + 0.12, hz), (0.12, 0.09, 0.15), M["iron_d"], bevel=0.01)
    if gear:
        gz = ptop + 0.05
        L.cylinder("gearhub", (0.52, pfront_y + 0.06, gz), 0.2, 0.1, M["iron_d"], verts=16).rotation_euler = (0, math.radians(90), 0)
        for k in range(8):
            a = math.radians(k * 45)
            L.box("tooth", (0.52, pfront_y + 0.06 + math.cos(a)*0.22, gz + math.sin(a)*0.22),
                  (0.1, 0.08, 0.08), M["iron_d"], bevel=0.0)
    if spiked:
        for sx in (-1, 1):
            L.cone("spike", (sx*0.62, pfront_y + 0.05, ptop + 0.16), 0.09, 0.001, 0.3, M["iron_d"], verts=4)


def headgear(big=False, glow=False):
    """Förderrad (Seilrolle) auf einem kleinen Bock ÜBER dem Portal — MIT SEIL, das
    in den Stollen hinabhängt (frühes Feedback: 'am Seil-Rad ist kein Seil')."""
    ax_z = ptop + (0.62 if big else 0.5)
    wy = pfront_y + 0.14   # Rad deutlich VOR dem Fels-Sims (sonst halb im Berg)
    for sx in (-1, 1):
        strut((sx*0.3, pfront_y, ptop + 0.02), (sx*0.12, wy, ax_z), 0.1, M["wood_d"], "hframe")
    r = 0.34 if big else 0.26
    wmat = M["rune_bar"] if glow else M["iron"]
    wheel(0.0, wy, ax_z, r, 0.09, wmat, spokes=big, hub_mat=M["rune"] if glow else None)
    # Seil vom Rad hinab in den Stollen + Eimer am Ende
    rod((0.0, wy + 0.02, ax_z - r), (0.0, wy + 0.04, z0 + 0.55), 0.025, M["rope"], "rope")
    L.box("bucket", (0.0, wy + 0.04, z0 + 0.42), (0.2, 0.18, 0.22), M["iron_d"], bevel=0.03)


def repo_bin(cx, cy):
    """Kleines Holz-Depot, in das die Lore ihr Gold kippt."""
    L.box("binbody", (cx, cy, z0 + 0.16), (0.7, 0.55, 0.34), M["wood_d"], bevel=0.03)
    L.box("binrim",  (cx, cy, z0 + 0.34), (0.74, 0.59, 0.06), M["wood"], bevel=0.02)
    ore_pile(cx, cy, 3)


def sleepers_and_rails(length, n=5, gauge=0.42):
    """Schienen mit Querschwellen, vom Stollenmund nach vorn (+Y) zur Lore."""
    start_y = pfront_y + 0.28
    for i in range(n):
        ty = start_y + i * (length / n)
        L.box("tie", (0, ty, z0), (0.75*s, 0.14, 0.08), M["wood_d"], bevel=0.02)
    for sx in (-gauge, gauge):
        L.box("rail", (sx, start_y + length/2, z0 + 0.04), (0.05, length + 0.2, 0.05), M["iron"], bevel=0.01)


def mine_cart(cx, cy, ore_amount=2, tipped=False):
    """Lore auf 4 blauen Rädchen (Wiki: 'blue wheels'), immer mit Golderz beladen.
    Der TRIM (nicht das Erz!) wird mit dem Level edler: T1-2 Eisen, ab T3 Gold."""
    trim_mat = M["iron"] if tier <= 2 else gold_or("iron")
    if tipped:
        # WICHTIG: obox statt L.box — L.box backt die Position ins Mesh, eine
        # Rotation würde die Lore um den WELTURSPRUNG schleudern (unsichtbar).
        tip = (math.radians(58), 0, math.radians(10))
        obox("cartbody", (cx, cy, z0 + 0.16), (0.9, 0.62, 0.42), M["iron_d"], rot=tip)
        obox("cartrim",  (cx, cy + 0.1, z0 + 0.34), (0.94, 0.66, 0.08), trim_mat, rot=tip)
    else:
        L.box("cartbody", (cx, cy, z0 + 0.2), (0.9, 0.62, 0.42), M["iron_d"], bevel=0.03)
        L.box("cartrim",  (cx, cy, z0 + 0.42), (0.94, 0.66, 0.08), trim_mat, bevel=0.02)
    for wx in (-0.36, 0.36):
        for wy in (-0.24, 0.24):
            w = L.cylinder("cwheel", (cx + wx, cy + wy, z0 - 0.1), 0.16, 0.09, M["accent_blue"], verts=12)
            w.rotation_euler = (0, math.radians(90), 0)
    if not tipped:
        for i in range(ore_amount):
            ox = cx + (-0.24 + 0.24*(i % 3))
            oy = cy + (-0.1 + 0.12*((i // 3) % 2))
            oz = z0 + 0.48 + (i // 3) * 0.16
            nugget(ox, oy, oz, 0.15, M["gold_ore"])
    else:
        for i in range(2):
            nugget(cx - 0.3 + i*0.5, cy + 0.5, z0 - 0.07, 0.13, M["gold_ore"])


# ---------------------------------------------------------------------------
build_mountain()
apron()

if ruin:
    # Verfallene Mine: Portal eingestürzt (ein Pfosten schief, einer gefallen, Sturz
    # heruntergerutscht), Stollen mit Geröll verschüttet, Lore umgekippt, kein Glühen.
    build_throat(glow=False)
    obox("post", (-0.62, pfront_y, z0 + ph*0.46), (0.16, 0.18, ph*0.9), M["wood_d"], rot=(0, math.radians(-13), 0))
    strut((0.62, pfront_y, z0 + 0.05), (1.5, pfront_y + 0.35, z0 + 0.1), 0.15, M["wood_d"], "fallenpost")
    obox("lintel", (0.1, pfront_y + 0.05, z0 + 0.95), (1.5, 0.2, 0.2), M["wood_d"],
         rot=(math.radians(-8), 0, math.radians(-11)))
    # Geröll, das den Stollen halb verschüttet
    for (rx, ry, rz, rr) in [(0.05, 0.18, z0 + 0.18, 0.3), (-0.32, 0.28, z0 + 0.1, 0.22), (0.34, 0.12, z0 + 0.12, 0.2)]:
        lump("rubble", rx, ry, rz, rr, rr*0.9, rr*0.8, M["rock_d"], subdiv=1)
    gold_veins(2)
    L.box("tie", (0, pfront_y + 0.5, z0), (0.7, 0.12, 0.07), M["wood_d"], bevel=0.02)
    mine_cart(0.6, pfront_y + 1.15, tipped=True)
    obox("plank", (-0.55, pfront_y + 0.85, z0 - 0.02), (0.9, 0.12, 0.1), M["wood_d"], rot=(0, 0, math.radians(22)))

elif tier == 1:
    # Level 2-3: krudes, aber stehendes Holzportal.
    build_throat(glow=True)
    portal_frame(crude=True)
    lantern(-0.95, 1.05)
    pickaxe(1.15, 1.05)
    gold_veins(2 + stage)
    sleepers_and_rails(1.7 + 0.15*stage, n=4 + stage)
    mine_cart(0.05, pfront_y + 1.5 + 0.15*stage, ore_amount=1 + stage)
    if stage == 3:
        repo_bin(1.8, pfront_y + 0.85)

elif tier == 2:
    # Repariertes Portal + hölzerne Verstärkungsbalken quer.
    build_throat(glow=True)
    portal_frame(crude=False)
    reinforce(steel=False)
    lantern(-0.95, 1.05)
    pickaxe(1.15, 1.05)
    gold_veins(4 + stage)
    sleepers_and_rails(1.9 + 0.15*stage, n=5 + stage)
    mine_cart(0.05, pfront_y + 1.6 + 0.15*stage, ore_amount=2 + stage)
    repo_bin(1.8, pfront_y + 0.85)

else:
    rich = tier >= 4
    glow = (tier == 5)
    build_throat(glow=True)
    portal_frame(crude=False)
    reinforce(steel=True, tall=rich, gear=rich, spiked=rich, glow=glow)
    headgear(big=rich, glow=glow)
    lantern(-0.95, 1.05)
    pickaxe(1.15, 1.05)
    gold_veins(6 + tier + stage)
    sleepers_and_rails(2.1 + 0.15*stage, n=6 + stage)
    mine_cart(-0.1, pfront_y + 1.8 + 0.15*stage, ore_amount=3 + stage)
    mine_cart(0.95, pfront_y + 1.05, ore_amount=max(1, stage + 1))
    repo_bin(1.8, pfront_y + 0.9)
    ore_pile(1.8, pfront_y + 1.35, 3)


L.setup_iso_camera(ortho_scale=7.8, target_z=1.35)
L.setup_lights()
L.render_png(out, res=700)
