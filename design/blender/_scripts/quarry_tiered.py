"""Menschen-Steinbruch (quarry), parametrisch über LEVEL 1..15.
blender -b --python quarry_tiered.py -- <level> <out.png>
tier = tier_for_level(level), stage = (level-1)%3+1.

KONZEPT: gestufte ABBAU-TERRASSEN (Steinbruch-Bänke) als Felswand hinten, davor der
Werkhof mit behauenen Steinquadern. Das Gestein wandelt sich je Tier: Grau-Fels →
Sandstein → MARMOR → dunkler Arkanstein. DESIGN-REGELN (Nutzer): L1 funktionstüchtig,
JEDES Level sichtbar anders (kumulativ), NICHTS schwebt (hängende Kran-/Winden-Lasten
am Seil sind ok). Level-Kette:
  L1  kleine Felswand, angelehnte Spitzhacke, 1 roher Block mit Hammer+Meißel
  L2  +Blockstapel, +SCHUBKARRE
  L3  +Holzrampe zur Terrasse, Wand -> 2 Terrassen
  L4  T2: +GERÜST mit Leiter an der Wand, +Zaun
  L5  +Seilwinde oben mit am Seil hängendem Block
  L6  +Blockpalette (geordnete Reihe), +Werkzeugständer
  L7  T3: Sandstein, Wand -> 3 Terrassen, +Steinkarren voll Blöcke
  L8  +KRAN mit hängendem Block, +2. Stapel
  L9  +in den Fels gehauene TREPPE, +Banner
  L10 T4: MARMOR-Wand, +liegender Säulen-Rohling
  L11 +2 fertige Säulen (Basis+Kapitell), +2. Banner
  L12 +goldener Prunk-Meißel im Block, +Gold-Kappen
  L13 T5: Arkanstein + leuchtende KRISTALL-ADERN in der Wand + Terrassen-Kristalle
  L14 +fertiger Runen-Obelisk + halbfertiger Rohling (liegend)
  L15 +große Runen-GLYPHE auf der Wand, +Kristall-Geode, +Energie-Ader, +Kristall-Deckblock
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_quarry_lvl{level:02d}.png")
T = THEMES[tier]

L.reset_scene()

# Gesteins-Farben je Tier (Wand hell/dunkel, Quader, Schnittfläche)
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
    "rope":   L.mat("rope",   (0.28, 0.20, 0.11), rough=1.0),
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
L.box("yard", (0.0, 0.7, 0.405), (3.4, 2.0, 0.045), M["dirt_l"], bevel=0.02)

n_terr = 2 if level <= 2 else 3
step_h = 0.72
terr_front = []   # (y_front, z_top) je Terrasse


def quarry_wall():
    """Ein BERG, in den Abbau-Terrassen geschnitten wurden (Gold-Mine-Prinzip:
    kantige, leicht verdrehte Blöcke): vorn saubere gestufte Bänke mit hellen
    Schnitt-Platten, hinten/oben roher Naturfels mit facettierter Spitze."""
    for i in range(n_terr):
        w = 3.9 - i*0.65
        d = 1.7 - i*0.1
        y = -0.7 - i*0.4
        zc = z0 + step_h/2 + i*step_h
        mat = M["wall"] if i % 2 == 0 else M["wall_d"]
        obox(f"terr{i}", (0.05*i, y, zc), (w, d, step_h), mat,
             rot=(0, 0, math.radians(2 - i*1.6)))
        yf = y + d/2
        terr_front.append((yf, zc + step_h/2))
        # helle Schnitt-Platten (Abbau-Spuren) auf der Terrassen-Front
        for k, fx in enumerate((-w*0.3, w*0.12, w*0.34)):
            if (i + k) % 3 != 2:
                L.box(f"cutm{i}{k}", (fx + 0.05*i, yf + 0.02, zc + 0.04 - 0.12*(k % 2)),
                      (0.42, 0.05, 0.34), M["cut"], bevel=0.01)
    # roher Naturfels als Kappe hinten/oben (der noch nicht abgebaute Berg)
    top_z = z0 + n_terr*step_h
    obox("cap1", (-0.35, -1.65, top_z + 0.3), (1.7, 1.1, 0.75), M["wall_d"],
         rot=(math.radians(3), math.radians(5), math.radians(9)))
    obox("cap2", (0.75, -1.55, top_z + 0.18), (1.05, 0.95, 0.55), M["wall"],
         rot=(0, math.radians(-7), math.radians(-11)))
    tip = L.cone("peaktip", (-0.3, -1.6, top_z + 0.82), 0.72, 0.05, 0.6, M["wall"], verts=6)
    tip.rotation_euler = (0, math.radians(5), math.radians(18))
    # grobe Flanken-Felsen links/rechts (verdreht + Brocken, kein Kisten-Look)
    obox("flankL", (-2.0, -0.7, z0 + 0.5), (0.95, 1.5, 1.05), M["wall_d"],
         rot=(math.radians(-4), math.radians(-7), math.radians(15)))
    obox("flankR", (2.0, -0.7, z0 + 0.5), (0.95, 1.5, 1.05), M["wall"],
         rot=(math.radians(3), math.radians(8), math.radians(-13)))
    lump("frockL", -2.2, 0.15, z0 + 0.12, 0.32, 0.28, 0.24, M["wall"], subdiv=1)
    lump("frockR", 2.2, 0.1, z0 + 0.1, 0.28, 0.25, 0.21, M["wall_d"], subdiv=1)
    # Schutt/Geröll am Fuß der Abbauwand
    for (rx, ry, rr) in ((-1.1, 0.35, 0.14), (0.15, 0.3, 0.11), (1.3, 0.28, 0.13), (-0.4, 0.42, 0.09)):
        lump("scree", rx, terr_front[0][0] + ry, z0 + rr*0.5, rr, rr*0.85, rr*0.7, M["wall_d"], subdiv=1)


def stone_block(cx, cy, cz, w=0.38, mat=None):
    L.box("sblock", (cx, cy, cz), (w, w*0.9, w*0.75), mat or M["block"], bevel=0.03)


def block_stack(cx, cy, big=False):
    stone_block(cx - 0.21, cy, z0 + 0.15)
    stone_block(cx + 0.21, cy + 0.03, z0 + 0.15)
    stone_block(cx + 0.02, cy - 0.02, z0 + 0.44)
    if big:
        stone_block(cx - 0.2, cy + 0.4, z0 + 0.15)
        stone_block(cx + 0.05, cy + 0.02, z0 + 0.72)


def block_pallet(cx, cy):
    """Geordnete 3x2-Blockreihe auf Holzbohlen (Palette)."""
    L.box("pallet", (cx, cy, z0 + 0.04), (1.3, 0.85, 0.08), M["wood_d"], bevel=0.01)
    for ix in range(3):
        for iy in range(2):
            stone_block(cx - 0.42 + ix*0.42, cy - 0.2 + iy*0.4, z0 + 0.24, w=0.36)


def pickaxe_lean(cx, cy, ang=-28):
    strut((cx, cy, z0), (cx + 0.14, cy - 0.3, z0 + 0.68), 0.05, M["wood"], "pickhandle")
    obox("pickhead", (cx + 0.15, cy - 0.32, z0 + 0.7), (0.44, 0.06, 0.09), M["iron_d"],
         rot=(0, math.radians(ang), math.radians(-10)))


def hammer_chisel(cx, cy, cz):
    """Hammer + Meißel liegen auf einem Block (Detail-Signatur)."""
    obox("hhandle", (cx, cy, cz + 0.03), (0.3, 0.05, 0.05), M["wood"], rot=(0, 0, math.radians(20)))
    obox("hhead", (cx - 0.13, cy - 0.05, cz + 0.05), (0.09, 0.14, 0.1), M["iron_d"], rot=(0, 0, math.radians(20)))
    obox("chisel", (cx + 0.1, cy + 0.14, cz + 0.02), (0.22, 0.04, 0.04), M["iron"], rot=(0, 0, math.radians(-30)))


def wheelbarrow(cx, cy, loaded=False):
    """Schubkarre: Wanne leicht geneigt, kleines Rad VORN unter der Wanne,
    2 lange Griffe hinten, 2 Stützbeine."""
    obox("wbbed", (cx, cy, z0 + 0.24), (0.5, 0.7, 0.2), M["wood"], rot=(math.radians(-6), 0, 0))
    w = L.cylinder("wbwheel", (cx, cy + 0.4, z0 + 0.12), 0.12, 0.07, M["wood_d"], verts=12)
    w.rotation_euler = (0, math.radians(90), 0)
    for sx in (-0.16, 0.16):
        strut((cx + sx, cy - 0.62, z0 + 0.3), (cx + sx, cy + 0.3, z0 + 0.18), 0.045, M["wood_d"], "wbgriff")
        L.box("wbleg", (cx + sx, cy - 0.3, z0 + 0.08), (0.05, 0.05, 0.16), M["wood_d"], bevel=0.01)
    if loaded:
        stone_block(cx, cy + 0.02, z0 + 0.4, w=0.28)


def ramp(cx, tyf, tzt):
    """Bohlen-Rampe vom Hof zur ersten Terrassen-Kante."""
    p_lo = (cx, tyf + 1.15, z0)
    p_hi = (cx, tyf - 0.1, tzt)
    for sx in (-0.24, 0.24):
        strut((p_lo[0] + sx, p_lo[1], p_lo[2] + 0.04), (p_hi[0] + sx, p_hi[1], p_hi[2] + 0.04),
              0.09, M["wood_d"], "ramprail")
    n = 5
    for i in range(1, n):
        t = i / n
        px = p_lo[0]; py = p_lo[1] + (p_hi[1]-p_lo[1])*t; pz = p_lo[2] + (p_hi[2]-p_lo[2])*t
        L.box("rampplank", (px, py, pz + 0.06), (0.62, 0.14, 0.05), M["wood"], bevel=0.01)


def scaffold(cx, tyf, tzt):
    """Holz-Gerüst vor der Terrassen-Front: 4 Pfosten, Plattform, Leiter."""
    ph = tzt - z0 + 0.25
    for px in (-0.55, 0.55):
        for py in (0.12, 0.62):
            L.box("scpost", (cx + px, tyf + py, z0 + ph/2), (0.09, 0.09, ph), M["wood_d"], bevel=0.01)
    for i in range(3):
        L.box("scplank", (cx, tyf + 0.37, z0 + ph + 0.03), (1.3, 0.22, 0.05), M["wood"], bevel=0.01)
        break
    L.box("scdeck", (cx, tyf + 0.37, z0 + ph + 0.02), (1.3, 0.6, 0.06), M["wood"], bevel=0.01)
    # Leiter
    lx = cx + 0.75
    for sx in (-0.12, 0.12):
        strut((lx + sx, tyf + 0.85, z0), (lx + sx, tyf + 0.45, z0 + ph + 0.05), 0.045, M["wood"], "ladderrail")
    for i in range(4):
        t = (i + 1) / 5
        L.box("rung", (lx, tyf + 0.85 + (0.45 - 0.85)*t, z0 + (ph + 0.05)*t), (0.28, 0.045, 0.045),
              M["wood"], bevel=0.005)


def hoist(cx, tyf, tzt):
    """Seilwinde auf der Terrassen-Kante: A-Bock + Ausleger, Block hängt am Seil."""
    for sx in (-0.3, 0.3):
        strut((cx + sx, tyf - 0.35, tzt), (cx, tyf - 0.28, tzt + 0.75), 0.08, M["wood_d"], "hleg")
    strut((cx, tyf - 0.28, tzt + 0.72), (cx, tyf + 0.55, tzt + 0.6), 0.08, M["wood"], "hjib")
    rod((cx, tyf + 0.5, tzt + 0.58), (cx, tyf + 0.5, z0 + 0.62), 0.02, M["rope"], "hrope")
    stone_block(cx, tyf + 0.5, z0 + 0.42, w=0.32)


def tool_rack(cx, cy):
    """Werkzeugständer: Querstange mit 2 angelehnten Hämmern/Hacken."""
    for sx in (-0.3, 0.3):
        L.box("trpost", (cx + sx, cy, z0 + 0.3), (0.06, 0.06, 0.6), M["wood_d"], bevel=0.01)
    L.box("trbar", (cx, cy, z0 + 0.56), (0.75, 0.06, 0.06), M["wood"], bevel=0.01)
    strut((cx - 0.15, cy + 0.16, z0), (cx - 0.1, cy + 0.02, z0 + 0.52), 0.04, M["wood"], "trtool")
    obox("trhead", (cx - 0.1, cy + 0.0, z0 + 0.54), (0.2, 0.05, 0.08), M["iron_d"])
    strut((cx + 0.2, cy + 0.16, z0), (cx + 0.24, cy + 0.02, z0 + 0.52), 0.04, M["wood"], "trtool2")
    obox("trhead2", (cx + 0.24, cy, z0 + 0.54), (0.05, 0.05, 0.14), M["iron"])


def stone_cart(cx, cy, n_blocks=3):
    L.box("cartbed", (cx, cy, z0 + 0.18), (1.0, 0.6, 0.1), M["wood"], bevel=0.02)
    for wx in (-0.34, 0.34):
        for wy in (-0.26, 0.26):
            w = L.cylinder("cwheel", (cx + wx, cy + wy, z0 - 0.06), 0.15, 0.08, M["wood_d"], verts=12)
            w.rotation_euler = (0, math.radians(90), 0)
    for rx in (-0.42, 0.42):
        L.box("stake", (cx + rx, cy, z0 + 0.42), (0.07, 0.5, 0.5), M["wood_d"], bevel=0.01)
    for i in range(n_blocks):
        row, col = divmod(i, 2)
        stone_block(cx - 0.15 + col*0.34, cy + (col - 0.5)*0.0 + (i % 2)*0.02 - 0.12 + row*0.1,
                    z0 + 0.4 + row*0.3, w=0.32)


def crane(cx, cy):
    L.box("cmast", (cx, cy, z0 + 0.95), (0.16, 0.16, 1.9), M["wood_d"], bevel=0.02)
    strut((cx, cy, z0 + 1.78), (cx - 0.95, cy + 0.55, z0 + 1.45), 0.11, M["wood"], "cjib")
    strut((cx, cy, z0 + 1.15), (cx - 0.62, cy + 0.36, z0 + 1.52), 0.07, M["wood"], "cbrace")
    rod((cx - 0.95, cy + 0.55, z0 + 1.45), (cx - 0.95, cy + 0.55, z0 + 0.78), 0.02, M["rope"], "crope")
    stone_block(cx - 0.95, cy + 0.55, z0 + 0.58, w=0.34)
    L.box("cbase", (cx, cy, z0 + 0.06), (0.5, 0.5, 0.12), M["wood"], bevel=0.02)


def carved_stairs(cx, tyf):
    """In den Fels gehauene Treppe an der ersten Terrassen-Front."""
    for i in range(4):
        L.box("stair", (cx, tyf + 0.28 - i*0.14, z0 + 0.08 + i*0.15),
              (0.55, 0.3, 0.16), M["cut"], bevel=0.01)


def pillar(cx, cy, h=1.15, lying=False):
    """Behauene Säule mit Basis + Kapitell — das Marmor-Produkt (T4)."""
    if lying:
        rod((cx - h/2, cy, z0 + 0.2), (cx + h/2, cy, z0 + 0.2), 0.17, M["block"], "plshaft", verts=14)
        L.box("plbase", (cx - h/2 - 0.08, cy, z0 + 0.2), (0.14, 0.44, 0.44), M["cut"], bevel=0.02)
    else:
        L.box("pbase", (cx, cy, z0 + 0.08), (0.44, 0.44, 0.16), M["cut"], bevel=0.02)
        L.cylinder("pshaft", (cx, cy, z0 + 0.16 + h/2), 0.16, h, M["block"], verts=14)
        L.box("pcap", (cx, cy, z0 + 0.24 + h), (0.42, 0.42, 0.14), M["cut"], bevel=0.02)


def gold_chisel_monument(cx, cy):
    """Goldener Prunk-Meißel steckt im Fels-Block (analog goldene Axt beim Lager)."""
    stone_block(cx, cy, z0 + 0.2, w=0.5)
    rod((cx, cy, z0 + 0.42), (cx + 0.2, cy + 0.2, z0 + 1.0), 0.06, M["gold"], "gchisel", r2=0.02)
    obox("gchiselcap", (cx + 0.22, cy + 0.22, z0 + 1.04), (0.14, 0.14, 0.08), M["gold"])


def crystal_veins():
    """T5: leuchtende Kristall-Adern auf den Terrassen-Fronten + Kristalle oben."""
    for i, (yf, zt) in enumerate(terr_front):
        for k, fx in enumerate((-1.0 + i*0.3, 0.4 - i*0.2, 1.1 - i*0.3)):
            obox(f"vein{i}{k}", (fx, yf + 0.02, zt - 0.28), (0.34, 0.04, 0.07),
                 M["rune_bar"], rot=(0, math.radians(25 + k*40), 0))
        L.crystal(f"tcrys{i}", (0.9 - i*0.7, yf - 0.3, zt), 0.09, 0.3, M["rune"])


def rune_obelisk(cx, cy):
    """Schaft aus HELLEM Schnittstein (aus diesem Bruch gehauen) — dunkler
    iron_d-Schaft war vor der dunklen T5-Wand unsichtbar."""
    L.box("obase", (cx, cy, z0 + 0.12), (0.5, 0.5, 0.24), M["wall_d"], bevel=0.03)
    L.cone("oshaft", (cx, cy, z0 + 0.82), 0.24, 0.13, 1.2, M["cut"], verts=4)
    for hz in (0.55, 0.85, 1.15):
        L.box("oband", (cx, cy + 0.16 - hz*0.045, z0 + hz), (0.16, 0.08, 0.1), M["rune"], bevel=0.01)
    L.crystal("otip", (cx, cy, z0 + 1.55), 0.1, 0.32, M["rune"])


def rough_obelisk(cx, cy):
    """Halbfertiger Obelisk-Rohling, liegt schräg auf Stützhölzern."""
    for sx in (-0.4, 0.4):
        L.box("osupport", (cx + sx, cy, z0 + 0.09), (0.12, 0.4, 0.18), M["wood_d"], bevel=0.01)
    o = obox("oshaft2", (cx, cy, z0 + 0.32), (1.3, 0.3, 0.3), M["wall"], rot=(0, 0, math.radians(8)))
    obox("otipflat", (cx + 0.72, cy + 0.1, z0 + 0.32), (0.2, 0.24, 0.24), M["cut"], rot=(0, 0, math.radians(8)))


def wall_glyph():
    """L15: große leuchtende Runen-Glyphe auf der untersten Terrassen-Front."""
    yf, zt = terr_front[0]
    gz = zt - 0.3
    obox("gly1", (-0.05, yf + 0.03, gz + 0.18), (0.08, 0.04, 0.4), M["rune"])
    obox("gly2", (-0.05, yf + 0.03, gz + 0.38), (0.3, 0.04, 0.08), M["rune"])
    obox("gly3", (-0.18, yf + 0.03, gz + 0.05), (0.08, 0.04, 0.26), M["rune"], rot=(0, math.radians(28), 0))
    obox("gly4", (0.1, yf + 0.03, gz + 0.05), (0.08, 0.04, 0.26), M["rune"], rot=(0, math.radians(-28), 0))


def geode(cx, cy):
    """Aufgebrochener Fels mit Kristallen im Inneren."""
    lump("georock", cx, cy, z0 + 0.14, 0.32, 0.28, 0.22, M["wall_d"], subdiv=1)
    L.crystal("geoc1", (cx + 0.02, cy + 0.05, z0 + 0.3), 0.09, 0.3, M["rune"])
    L.crystal("geoc2", (cx - 0.14, cy - 0.06, z0 + 0.26), 0.06, 0.2, M["rune_bar"])
    L.crystal("geoc3", (cx + 0.16, cy - 0.08, z0 + 0.24), 0.05, 0.16, M["rune_bar"])


def banner_at(cx, cy):
    L.banner("banner", cx, cy, z0, 0.34, 0.5, M["wood_d"], M["cloth"], M["iron_d"], pole_h=1.5)


def fence_piece(cx, cy):
    for t in (0.0, 0.5, 1.0):
        L.box("fpost", (cx + t*0.9, cy, z0 + 0.22), (0.08, 0.08, 0.44), M["wood_d"], bevel=0.01)
    L.box("frail", (cx + 0.45, cy, z0 + 0.34), (1.0, 0.06, 0.06), M["wood"], bevel=0.01)


# ---------------------------------------------------------------------------
quarry_wall()

# Basis (immer): Spitzhacke + roher Block mit Hammer & Meißel
pickaxe_lean(-1.45, 0.55)
stone_block(0.55, 0.6, z0 + 0.15, w=0.44)
hammer_chisel(0.55, 0.6, z0 + 0.32)

if level >= 2:
    block_stack(1.25, 0.85, big=(level >= 5))
    wheelbarrow(-0.65, 1.25, loaded=(level >= 4))

if level >= 3:
    ramp(1.55, terr_front[0][0], terr_front[0][1])

if level >= 4:
    scaffold(-0.9, terr_front[0][0], terr_front[0][1])
    fence_piece(-1.95, 1.7)

if level >= 5:
    hoist(0.35, terr_front[min(1, n_terr-1)][0], terr_front[min(1, n_terr-1)][1])

if level >= 6:
    block_pallet(-0.15, 1.55)
    tool_rack(-1.6, 0.05)

if level >= 7:
    stone_cart(0.95, 1.5, n_blocks=2 + min(stage, 2))

if level >= 8:
    crane(1.85, 0.85)
    block_stack(1.7, 1.7)

if level >= 9:
    carved_stairs(-0.35, terr_front[0][0])
    banner_at(-1.9, 0.95)

if level >= 10:
    pillar(0.0, 0.55, lying=True)

if level >= 11:
    pillar(-1.35, 1.6, h=1.15)
    pillar(-1.85, 1.25, h=1.15)

if level >= 12:
    gold_chisel_monument(0.6, 1.15)
    L.box("cmastcap", (1.85, 0.85, z0 + 1.94), (0.22, 0.22, 0.08), M["gold"], bevel=0.02)

if level >= 13:
    crystal_veins()

if level >= 14:
    rune_obelisk(0.5, 1.8)
    rough_obelisk(-0.75, 0.75)

if level >= 15:
    wall_glyph()
    geode(1.75, 1.35)
    # Energie-Ader: von der Glyphe über den Hof zum Obelisken
    ox, oy = 0.5, 1.8
    gx, gy = -0.05, terr_front[0][0] + 0.1
    dxa, dya = ox - gx, oy - gy
    ang = math.atan2(dya, dxa)
    for t in (0.2, 0.5, 0.8):
        obox("evein", (gx + dxa*t, gy + dya*t, z0 + 0.015), (0.36, 0.09, 0.035),
             M["rune_bar"], rot=(0, 0, ang))
    # Kristall-Deckblock auf dem großen Stapel
    stone_block(1.25, 0.83, z0 + 0.98, w=0.34, mat=M["rune_bar"])


cam_scale = 7.4 + (0.3 if level >= 8 else 0.0)
L.setup_iso_camera(ortho_scale=cam_scale, target_z=1.2 + (0.1 if level >= 8 else 0.0))
L.setup_lights()
L.render_png(out, res=700)
