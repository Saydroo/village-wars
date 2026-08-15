"""Menschen-Steinlager (storage_stone), parametrisch über LEVEL 1..15.
blender -b --python storage_stone_tiered.py -- <level> <out.png>

KONZEPT: bewusst ANDERS als das Holzlager (Nutzer-Vorgabe: Lager nicht 1:1 gleich) —
kein Holzgerüst mit Dach, sondern ein FLACHER, MASSIVER STEIN-BUNKER: dicke U-förmige
Mauerkammern, oben offen, darin gestapelte Steinquader (das Produkt des Steinbruchs —
gleiche Gesteins-Tönung je Tier: Grau→Sandstein→Marmor→Arkanstein). Silhouette:
niedrig + breit + wuchtig. DESIGN-REGELN: L1 funktionstüchtig, jedes Level sichtbar
anders (kumulativ), nichts schwebt (hängende Kran-Last am Seil ok).
  L1  eine U-Kammer mit ersten Quadern, Brechstange + Hammer
  L2  +voller, +Blockstapel daneben
  L3  +ZWEITE Kammer rechts (L-Form)
  L4  T2: Mauern ERHÖHT, +Eck-Pfeiler mit Decksteinen
  L5  +Laderampe, +Schubkarre mit Block
  L6  +DRITTE Kammer vorn, +Zaun
  L7  T3: Sandstein, +Eisen-Klammern auf den Mauerkronen, +Steinkarren
  L8  +Schwenkkran auf Steinpfeiler (Block hängt am Seil)
  L9  +Bodenplatten-Weg, +Banner
  L10 T4: Marmor, +Relief-Deckplatte auf der Hauptkammer-Rückwand
  L11 +Säulen-Paar flankiert die Hauptkammer
  L12 +GOLD-Deckstein auf dem Stapel, +Gold-Kappen auf Pfeilern
  L13 T5: Arkanstein, leuchtende Runen-Klammern, +Kristall auf Kranpfeiler
  L14 +Runen-Obelisk, +Glyphe auf der Rückwand
  L15 +KRISTALL-Quader in den Kammern, +Energie-Ader, +Eck-Kristalle
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
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_ststone_lvl{level:02d}.png")
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
    # RESSOURCE: gelagerte Steinblöcke sind IMMER neutral grau (Tier färbt nur
    # das Gebäude, nie die Ware — analog "Erz immer Gold" in der Goldmine)
    "res":    L.mat("res",    (0.56, 0.53, 0.48), rough=0.95),
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
L.box("dirt",   (0, 0, 0.13), (5.0*s, 4.8*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass",  (0, 0, 0.32), (4.6*s, 4.4*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2", (0, 0, 0.40), (3.9*s, 3.7*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.9*s, -1.7*s), (1.95*s, 1.6*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)
L.box("yard", (0.0, 0.4, 0.405), (3.4, 2.3, 0.045), M["dirt_l"], bevel=0.02)

# Mauern bewusst NIEDRIG — die Quader-Stapel ragen ab mittleren Leveln über die
# Mauerkrone hinaus, damit die gelagerte Ressource klar lesbar bleibt (hohe
# Mauern versteckten die Blöcke komplett -> las sich als Ruinen-Labyrinth).
wall_h = 0.55 if level < 4 else (0.68 if level < 7 else 0.8)
wall_t = 0.24


def stone_block(cx, cy, cz, w=0.36, mat=None):
    L.box("sblock", (cx, cy, cz), (w, w*0.9, w*0.72), mat or M["res"], bevel=0.03)


def chamber(cx, cy, w, d, h, fill_rows, pillars=False, clamps=False, rune_clamps=False,
            gold_caps=False, specials=None):
    """U-Kammer: Rückwand + 2 Seitenwände (Öffnung zur Front/+Y), innen Quader-
    Stapel. clamps = Eisen-/Runen-Klammern auf den Mauerkronen."""
    L.box("cwB", (cx, cy - d/2 + wall_t/2, z0 + h/2), (w, wall_t, h), M["wall"], bevel=0.03)
    L.box("cwL", (cx - w/2 + wall_t/2, cy + wall_t*0.1, z0 + h/2), (wall_t, d, h), M["wall_d"], bevel=0.03)
    L.box("cwR", (cx + w/2 - wall_t/2, cy + wall_t*0.1, z0 + h/2), (wall_t, d, h), M["wall_d"], bevel=0.03)
    if pillars:
        for px in (-w/2 + 0.1, w/2 - 0.1):
            for py in (-d/2 + 0.1, d/2 + 0.02):
                L.box("cpil", (cx + px, cy + py, z0 + h/2 + 0.06), (0.26, 0.26, h + 0.12), M["wall"], bevel=0.03)
                cap = M["gold"] if gold_caps else M["cut"]
                L.box("cpilcap", (cx + px, cy + py, z0 + h + 0.16), (0.32, 0.32, 0.08), cap, bevel=0.02)
    if clamps or rune_clamps:
        cmat = M["rune"] if rune_clamps else M["iron_d"]
        for k in (-0.25, 0.25):
            L.box("clampB", (cx + k*w, cy - d/2 + wall_t/2, z0 + h + 0.02), (0.14, wall_t + 0.08, 0.07), cmat, bevel=0.01)
        L.box("clampL", (cx - w/2 + wall_t/2, cy + 0.1, z0 + h + 0.02), (wall_t + 0.08, 0.14, 0.07), cmat, bevel=0.01)
        L.box("clampR", (cx + w/2 - wall_t/2, cy + 0.1, z0 + h + 0.02), (wall_t + 0.08, 0.14, 0.07), cmat, bevel=0.01)
    # Quader-Stapel innen als ordentliches Gitter — ragt bei hohem Füllstand
    # über die Mauerkrone hinaus (Ressource von oben/vorn klar sichtbar)
    inner_w = w - 2*wall_t - 0.08
    inner_d = d - wall_t - 0.14
    bw = 0.37
    nx = max(1, int(inner_w // bw))
    ny = max(1, int(inner_d // bw))
    specials = specials or {}
    for row in range(fill_rows):
        zr = z0 + 0.14 + row * 0.28
        nxr = nx - (1 if (row % 2 and nx > 1) else 0)
        for i in range(nxr):
            for j in range(ny):
                bx = cx - inner_w/2 + bw/2 + i*bw + (bw/2 if row % 2 else 0) + 0.04
                by = cy - d/2 + wall_t + bw/2 + j*bw + 0.06
                mat = specials.get((row, i)) if j == ny - 1 else None
                stone_block(bx, by, zr, w=bw - 0.04, mat=mat)
    return z0 + h


def block_stack(cx, cy):
    stone_block(cx - 0.2, cy, z0 + 0.14)
    stone_block(cx + 0.2, cy + 0.04, z0 + 0.14)
    stone_block(cx + 0.0, cy - 0.02, z0 + 0.42)


def crowbar_tools(cx, cy):
    """Brechstange lehnt an Block + Hammer am Boden (L1-Signatur)."""
    stone_block(cx, cy, z0 + 0.14, w=0.42)
    rod((cx + 0.3, cy + 0.35, z0), (cx + 0.08, cy + 0.05, z0 + 0.52), 0.028, M["iron"], "crowbar")
    obox("hhandle", (cx - 0.4, cy + 0.25, z0 + 0.03), (0.28, 0.05, 0.05), M["wood"], rot=(0, 0, math.radians(35)))
    obox("hhead", (cx - 0.5, cy + 0.33, z0 + 0.05), (0.09, 0.13, 0.1), M["iron_d"], rot=(0, 0, math.radians(35)))


def wheelbarrow(cx, cy):
    obox("wbbed", (cx, cy, z0 + 0.24), (0.5, 0.7, 0.2), M["wood"], rot=(math.radians(-6), 0, 0))
    w = L.cylinder("wbwheel", (cx, cy + 0.4, z0 + 0.12), 0.12, 0.07, M["wood_d"], verts=12)
    w.rotation_euler = (0, math.radians(90), 0)
    for sx in (-0.16, 0.16):
        strut((cx + sx, cy - 0.62, z0 + 0.3), (cx + sx, cy + 0.3, z0 + 0.18), 0.045, M["wood_d"], "wbgriff")
        L.box("wbleg", (cx + sx, cy - 0.3, z0 + 0.08), (0.05, 0.05, 0.16), M["wood_d"], bevel=0.01)
    stone_block(cx, cy + 0.02, z0 + 0.4, w=0.26)


def ramp(cx, cy):
    obox("ramp", (cx, cy, z0 + 0.12), (0.9, 0.7, 0.06), M["wood"], rot=(math.radians(-14), 0, 0))
    for sy in (-0.28, 0.28):
        L.box("rampstop", (cx + 0.42, cy + sy, z0 + 0.06), (0.08, 0.08, 0.12), M["wood_d"], bevel=0.01)


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
        stone_block(cx - 0.15 + col*0.34, cy - 0.12 + row*0.1, z0 + 0.4 + row*0.3, w=0.3)


def swing_crane(cx, cy):
    """Schwenkkran auf Steinpfeiler: Ausleger + Seil + hängender Block."""
    L.box("kpil", (cx, cy, z0 + 0.65), (0.34, 0.34, 1.3), M["wall"], bevel=0.03)
    L.box("kpilcap", (cx, cy, z0 + 1.34), (0.42, 0.42, 0.1), M["cut"], bevel=0.02)
    strut((cx, cy, z0 + 1.38), (cx - 0.85, cy + 0.5, z0 + 1.28), 0.09, M["wood"], "kjib")
    strut((cx, cy, z0 + 0.95), (cx - 0.55, cy + 0.32, z0 + 1.22), 0.06, M["wood"], "kbrace")
    rod((cx - 0.85, cy + 0.5, z0 + 1.28), (cx - 0.85, cy + 0.5, z0 + 0.62), 0.02, M["rope"], "krope")
    stone_block(cx - 0.85, cy + 0.5, z0 + 0.44, w=0.32)


def paved_path(cx, cy):
    for i in range(4):
        L.box("pave", (cx, cy + i*0.5, z0 + 0.005), (0.55 - 0.04*(i % 2), 0.4, 0.03), M["cut"], bevel=0.01)


def pillar(cx, cy, h=1.15):
    L.box("pbase", (cx, cy, z0 + 0.08), (0.4, 0.4, 0.16), M["cut"], bevel=0.02)
    L.cylinder("pshaft", (cx, cy, z0 + 0.16 + h/2), 0.14, h, M["block"], verts=14)
    L.box("pcap", (cx, cy, z0 + 0.24 + h), (0.38, 0.38, 0.13), M["cut"], bevel=0.02)


def banner_at(cx, cy):
    L.banner("banner", cx, cy, z0, 0.34, 0.5, M["wood_d"], M["cloth"], M["iron_d"], pole_h=1.5)


def fence_piece(cx, cy):
    for t in (0.0, 0.5, 1.0):
        L.box("fpost", (cx + t*0.9, cy, z0 + 0.22), (0.08, 0.08, 0.44), M["wood_d"], bevel=0.01)
    L.box("frail", (cx + 0.45, cy, z0 + 0.34), (1.0, 0.06, 0.06), M["wood"], bevel=0.01)


def rune_obelisk(cx, cy):
    L.box("obase", (cx, cy, z0 + 0.1), (0.42, 0.42, 0.2), M["wall_d"], bevel=0.03)
    L.cone("oshaft", (cx, cy, z0 + 0.7), 0.2, 0.11, 1.0, M["cut"], verts=4)
    for hz in (0.45, 0.72, 0.98):
        L.box("oband", (cx, cy + 0.13 - hz*0.04, z0 + hz), (0.13, 0.07, 0.09), M["rune"], bevel=0.01)
    L.crystal("otip", (cx, cy, z0 + 1.32), 0.09, 0.28, M["rune"])


def wall_glyph(cx, cy, gz):
    """Leuchtende Glyphe auf der Rückwand-Front der Hauptkammer."""
    obox("gly1", (cx, cy, gz + 0.14), (0.07, 0.04, 0.3), M["rune"])
    obox("gly2", (cx, cy, gz + 0.28), (0.24, 0.04, 0.07), M["rune"])
    obox("gly3", (cx - 0.1, cy, gz + 0.04), (0.07, 0.04, 0.2), M["rune"], rot=(0, math.radians(26), 0))
    obox("gly4", (cx + 0.1, cy, gz + 0.04), (0.07, 0.04, 0.2), M["rune"], rot=(0, math.radians(-26), 0))


# ---------------------------------------------------------------------------
# Hauptkammer A (immer), Füllstand wächst mit Level — ab L9 ragen die Stapel
# über die Mauerkrone (0.8) hinaus (Reihe 3 endet bei ~1.0)
fillA = min(1 + level // 3, 4)
# KEINE specials im Stapel: die Blöcke sind die Ressource und bleiben grau —
# Gold/Runen-Schmuck gehört ans GEBÄUDE (Pfeilerkappen, Relief), nie an die Ware.
chamber(-0.7, -0.35, 1.7, 1.5, wall_h, fillA,
        pillars=(level >= 4), clamps=(7 <= level <= 12), rune_clamps=(level >= 13),
        gold_caps=(level >= 12))

crowbar_tools(1.05, 1.0)

if level >= 2:
    block_stack(1.45, 0.2)

if level >= 3:
    chamber(0.95, -0.5, 1.2, 1.2, wall_h * 0.9, min(fillA, 2),
            clamps=(7 <= level <= 12), rune_clamps=(level >= 13))

if level >= 5:
    ramp(-0.7, 0.75)
    wheelbarrow(-1.7, 0.9)

if level >= 6:
    # offene Block-Palette (statt dritter Kammer — Mauern versteckten alles)
    L.box("pallet", (-0.75, 1.35, z0 + 0.04), (1.2, 0.8, 0.08), M["wood_d"], bevel=0.01)
    for ix in range(3):
        for iy in range(2):
            stone_block(-0.75 - 0.38 + ix*0.38, 1.35 - 0.18 + iy*0.36, z0 + 0.23, w=0.33)
    if level >= 9:
        stone_block(-0.75 - 0.19, 1.35, z0 + 0.5, w=0.33)
        stone_block(-0.75 + 0.19, 1.35, z0 + 0.5, w=0.33)
    fence_piece(1.2, 1.75)

if level >= 7:
    stone_cart(0.3, 1.35, n_blocks=2 + min(stage, 2))

if level >= 8:
    swing_crane(1.75, -0.9)

if level >= 9:
    paved_path(-0.15, 0.55)
    banner_at(-1.95, 1.6)

if level >= 10:
    # Relief-Deckplatte auf der Rückwand der Hauptkammer
    L.box("relief", (-0.7, -1.02, z0 + wall_h + 0.08), (1.5, 0.3, 0.12), M["cut"], bevel=0.02)
    for k in (-0.4, 0.0, 0.4):
        # ab L12 wird der mittlere Zierstein GOLD (Gebäude-Schmuck, ersetzt den
        # früheren Gold-Block im Ressourcen-Stapel)
        dmat = M["gold"] if (level >= 12 and k == 0.0) else M["block"]
        L.box("reliefdot", (-0.7 + k, -1.02, z0 + wall_h + 0.17), (0.14, 0.26, 0.06), dmat, bevel=0.01)

if level >= 11:
    pillar(-1.75, -0.5)
    pillar(0.3, -0.85)

if level >= 13:
    L.crystal("kcrys", (1.75, -0.9, z0 + 1.5), 0.1, 0.34, M["rune"])

if level >= 14:
    rune_obelisk(1.85, 0.85)
    wall_glyph(-0.7, -1.02 + 0.15 + 0.03, z0 + wall_h*0.35)

if level >= 15:
    dxa, dya = -0.7 - 1.85, 0.3 - 0.85
    ang = math.atan2(dya, dxa)
    for t in (0.22, 0.5, 0.78):
        obox("evein", (1.85 + dxa*t, 0.85 + dya*t, z0 + 0.015), (0.34, 0.09, 0.035),
             M["rune_bar"], rot=(0, 0, ang))
    for (ex, ey) in ((-1.5, -1.05), (0.05, -1.05)):
        L.crystal("cornercrys", (ex, ey, z0 + wall_h + 0.1), 0.07, 0.24, M["rune"])


cam_scale = 6.8 + (0.3 if level >= 8 else 0.0)
L.setup_iso_camera(ortho_scale=cam_scale, target_z=0.9)
L.setup_lights()
L.render_png(out, res=700)
