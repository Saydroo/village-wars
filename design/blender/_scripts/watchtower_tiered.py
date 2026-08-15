"""Menschen-Wachturm (watchtower), parametrisch über LEVEL 1..15.
blender -b --python watchtower_tiered.py -- <level> <out.png>
tier = tier_for_level(level), stage = (level-1)%3+1 (Baustufe 1..3 im Tier).

Verteidigungsgebäude — hoch & schmal (eigene Silhouette). Tier 1-2 = Holzgerüst-Turm,
Tier 3-4 = runder Steinturm mit Zinnen-Wehrplattform, Tier 5 = Kristall-Magieturm.
Signatur (ab Vollausbau): Wehrplattform mit Zinnen + Wach-Geschütz (Armbrust/Balliste/
Kristall) + Spähfenster/Schießscharten + Fahne. NUR Level 1 ist die kaputte Ruine;
danach wird der Turm additiv höher/wehrhafter bis zur nächsten Tier-Stufe.
"""
import bpy, sys, os, math
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import lib_iso as L
from themes import THEMES, tier_for_level

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
level = max(1, min(15, int(argv[0]) if len(argv) >= 1 else 9))
tier = tier_for_level(level)
stage = (level - 1) % 3 + 1
WU = {1: 0.55, 2: 0.78, 3: 1.0}[stage]   # Geschütz-Größe je Baustufe (mini/mittel/voll)
out = argv[1] if len(argv) >= 2 else os.path.join(os.path.dirname(__file__), f"out_wt_lvl{level:02d}.png")
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
    "crystal":L.mat("crystal",(0.58, 0.38, 0.92), rough=0.2, emis=1.4),
    "iron":   L.mat("iron",   (0.74, 0.77, 0.82), rough=0.35, metal=0.85),
    "iron_d": L.mat("iron_d", (0.30, 0.32, 0.36), rough=0.5, metal=0.6),
    "dark":   L.mat("dark",   (0.12, 0.10, 0.10), rough=1.0),   # Schießscharten-Schatten
    "rune":   L.mat("rune",   (0.35, 0.62, 1.0), rough=0.3, emis=1.9),
    "mflame": L.mat("mflame", (0.74, 0.4, 1.0),  rough=0.3, emis=2.4),
    "mdeep":  L.mat("mdeep",  (0.34, 0.2, 0.5),  rough=0.85),
    "flame":  L.mat("flame",  (1.0, 0.38, 0.04), rough=0.5, emis=2.2),   # orange Flammenkörper
    "flame_c":L.mat("flame_c",(1.0, 0.78, 0.28), rough=0.4, emis=3.0),   # heißer gelber Kern
    "flame_r":L.mat("flame_r",(0.82, 0.12, 0.02),rough=0.6, emis=1.5),   # rote, kühlere Außenhülle
    "ember":  L.mat("ember",  (1.0, 0.36, 0.08), rough=0.5, emis=2.0),   # glühende Bolzenspitze
    "smoke":  L.mat("smoke",  (0.28, 0.26, 0.26),rough=1.0),             # Rauch
    "rope":   L.mat("rope",   (0.66, 0.55, 0.36),rough=1.0),             # Sehnen-/Spannseil
    "rock":   L.mat("rock",   (0.42, 0.41, 0.39),rough=1.0),             # Wurfgeschoss (Stein)
}
s = T["scale"]
decay = T["decay"]


def gold_or(mat_key):
    return M["accent"] if T["gold"] else M[mat_key]


# --- Grassockel ---
L.box("dirt",  (0, 0, 0.13), (4.4*s, 4.4*s, 0.26), M["dirt"],  bevel=0.08)
L.box("grass", (0, 0, 0.32), (4.0*s, 4.0*s, 0.14), M["grass"], bevel=0.06)
L.box("grass2",(0, 0, 0.40), (3.3*s, 3.3*s, 0.05), M["grass_d"], bevel=0.05)
for (gx, gy) in [(-1.6*s, 1.5*s), (1.7*s, -1.4*s)]:
    L.cylinder("tuft", (gx, gy, 0.45), 0.2, 0.12, M["moss"], verts=10)


def strut(p1, p2, th, mat, name="strut"):
    """Balken zwischen zwei beliebigen Punkten (für geneigte Pfosten/Diagonalstreben).
    WICHTIG: Box am Ursprung erzeugen + skalieren, DANN rotieren (um die Box-Mitte) +
    verschieben — nicht über L.box, da dieses die location ins Mesh backt (Rotation
    würde sonst um den fernen Nullpunkt laufen → Strebe schwingt weit raus)."""
    a = Vector(p1); b = Vector(p2)
    mid = (a + b) / 2
    d = b - a
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
    """Zylinder/Kegel zwischen zwei Punkten (robust: am Ursprung erzeugt, dann gedreht)."""
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


def flame_drop(cx, cy, cz, r, h, mat, lean=0.0):
    """Eine tropfenförmige Flamme: runde Basis (gestauchte Kugel) + züngelnde Spitze.
    lean = horizontale Verschiebung der Spitze (Flackern)."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=(cx, cy, cz + r*0.85))
    o = bpy.context.active_object
    o.name = "fdrop"
    o.scale = (1.0, 1.0, 1.25)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    # züngelnde Spitze (schlanker Kegel, leicht gebogen über lean)
    rod((cx, cy, cz + r*1.1), (cx + lean, cy + lean*0.4, cz + r*1.1 + h), r*0.92, mat, "ftip", r2=0.004, verts=12)


def flame_cluster(bx, by, bz, u):
    """Realistische Flamme: geschichtete Tropfen (rote Hülle → orange → gelber Kern),
    züngelnde Seitenflammen, Funken, Rauch."""
    # Schichten von außen (rot, groß, kühl) nach innen (gelb, klein, heiß)
    flame_drop(bx, by, bz, 0.3*u, 1.05*u, M["flame_r"], lean=0.05*u)
    flame_drop(bx, by + 0.02*u, bz + 0.06*u, 0.21*u, 0.82*u, M["flame"], lean=-0.04*u)
    flame_drop(bx, by + 0.03*u, bz + 0.12*u, 0.12*u, 0.55*u, M["flame_c"], lean=0.03*u)
    # züngelnde Seitenflammen (kleine Tropfen, schräg)
    for (ox, oy, lean) in [(-0.24, 0.0, -0.12*u), (0.24, 0.04, 0.12*u), (0.04, 0.2, 0.05*u)]:
        flame_drop(bx + ox*u, by + oy*u, bz + 0.12*u, 0.1*u, 0.4*u, M["flame"], lean=lean)
    # Funken + Rauchfähnchen oben
    for (sx, sy, sz) in [(0.2, 0.1, 1.15), (-0.16, 0.06, 1.3), (0.05, 0.2, 1.45)]:
        L.box("spark", (bx + sx*u, by + sy*u, bz + sz*u), (0.04*u, 0.04*u, 0.04*u), M["flame_c"], bevel=0.0)
    for i, sz in enumerate((1.5, 1.75, 2.0)):
        L.cylinder("smoke", (bx - 0.04*u*i, by + 0.05*u, bz + sz*u), (0.1 + i*0.04)*u, 0.12*u, M["smoke"], verts=10)


def round_battlement(cz, r, mat, n=10, mh=0.3, mw=0.22):
    """Zinnenkranz auf rundem Turm (Merlons im Kreis)."""
    for k in range(n):
        a = 2 * math.pi * k / n
        L.box("merlon", (math.cos(a)*r, math.sin(a)*r, cz), (mw, mw, mh), mat, bevel=0.02)


def loopholes(cz_list, r, face_y=1):
    """Schießscharten (dunkle Schlitze) auf der +Y-Front."""
    for cz in cz_list:
        L.box("loop", (0, r*0.92*face_y, cz), (0.12, 0.1, 0.4), M["dark"], bevel=0.01)


def war_engine(cx, cy, cz, u=1.0, fire=False):
    """Wach-Geschütz, geneigt nach vorn-oben (+Y). u = Gesamtgröße (skaliert mit Baustufe:
    mini/mittel/voll). Balliste (T1-4) bzw. leuchtendes Kristall-Geschütz (T5).
    fire=True → Feuer-Balliste: brennende Bolzenspitze + Kohlebecken."""
    if T["magic"]:
        cr, rn, md, mf = M["crystal"], M["rune"], M["mdeep"], M["mflame"]
        a = Vector((cx, cy - 0.32*u, cz + 0.55*u))   # Lauf hinten
        b = Vector((cx, cy + 1.0*u, cz + 1.12*u))    # Mündung vorn-oben
        d = (b - a).normalized()
        perp1 = Vector((1, 0, 0))
        perp2 = d.cross(perp1).normalized()
        # verzierte Drehlafette + Runen-Ring + Gabel
        L.cylinder("wbase", (cx, cy, cz + 0.18*u), 0.42*u, 0.34*u, md, verts=18)
        L.cylinder("wrune", (cx, cy, cz + 0.39*u), 0.44*u, 0.1*u, rn, verts=24)
        for sx in (-0.22, 0.22):
            L.box("wfork", (cx + sx*u, cy - 0.05*u, cz + 0.52*u), (0.08*u, 0.28*u, 0.46*u), md, bevel=0.03)
        # Hauptlauf (Arkanstein) + 3 leuchtende Energie-Adern + Runen-Ringe
        rod(a, b, 0.17*u, md, "wbar")
        for ang in (0, 120, 240):
            r = math.radians(ang)
            off = (perp1*math.cos(r) + perp2*math.sin(r)) * 0.15*u
            rod(a + off, b + off, 0.026*u, rn, "wvein")
        for t in (0.3, 0.62, 0.9):
            c = a + (b - a)*t
            rod(c - d*0.04*u, c + d*0.04*u, 0.2*u, rn, "wring")
        # großer Kristall-Fokus an der Mündung (wächst nach vorne)
        rod(b - d*0.1*u, b + d*0.45*u, 0.12*u, cr, "wcore", r2=0.3*u)
        # geladene Energie-Korona + heller Energieball an der Spitze
        cor = b + d*0.2*u
        L.cylinder("wcorona", (cor.x, cor.y, cor.z), 0.34*u, 0.06*u, rn, verts=20).rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        tip = b + d*0.5*u
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.16*u, location=(tip.x, tip.y, tip.z))
        eb = bpy.context.active_object; eb.name = "weball"; eb.data.materials.append(mf)
        # (schwebende Orbit-Kristalle um die Mündung entfernt — kommen in der App als
        #  animierter, leuchtender Effekt-Layer zurück, falls gut aussehend)
        return
    big = tier >= 4
    u = u * (1.25 if big else 1.0)
    bm = gold_or("wood_d")
    # Drehsockel + Pivot
    L.cylinder("wbase", (cx, cy, cz + 0.14*u), 0.38*u, 0.28*u, M["wood_d"], verts=16)
    L.cylinder("wpiv", (cx, cy, cz + 0.32*u), 0.17*u, 0.18*u, M["iron_d"], verts=12)
    # Lauf-Schiene (geneigt) + Gestell-Stützen
    rod((cx, cy - 0.6*u, cz + 0.42*u), (cx, cy + 1.1*u, cz + 1.0*u), 0.11*u, M["wood"], "wrail")
    rod((cx - 0.3*u, cy - 0.22*u, cz + 0.18*u), (cx, cy + 0.15*u, cz + 0.72*u), 0.075*u, M["wood_d"], "wsupL")
    rod((cx + 0.3*u, cy - 0.22*u, cz + 0.18*u), (cx, cy + 0.15*u, cz + 0.72*u), 0.075*u, M["wood_d"], "wsupR")
    # Bogenarme (V nach vorn-außen) + Sehne
    L.box("wbowhub", (cx, cy + 0.5*u, cz + 0.82*u), (0.2*u, 0.2*u, 0.2*u), bm, bevel=0.03)
    rod((cx, cy + 0.5*u, cz + 0.82*u), (cx - 1.0*u, cy + 0.28*u, cz + 0.74*u), 0.08*u, bm, "wbowL")
    rod((cx, cy + 0.5*u, cz + 0.82*u), (cx + 1.0*u, cy + 0.28*u, cz + 0.74*u), 0.08*u, bm, "wbowR")
    rod((cx - 1.0*u, cy + 0.28*u, cz + 0.74*u), (cx, cy - 0.42*u, cz + 0.64*u), 0.028*u, M["iron_d"], "wstrL")
    rod((cx + 1.0*u, cy + 0.28*u, cz + 0.74*u), (cx, cy - 0.42*u, cz + 0.64*u), 0.028*u, M["iron_d"], "wstrR")
    # dicker Bolzen ragt weit nach vorn-oben + große Spitze (glühend bei Feuer) + Flügel
    rod((cx, cy - 0.42*u, cz + 0.62*u), (cx, cy + 1.45*u, cz + 1.08*u), 0.075*u, M["wood"], "wbolt")
    rod((cx, cy + 1.45*u, cz + 1.08*u), (cx, cy + 1.9*u, cz + 1.22*u), 0.14*u, M["ember"] if fire else M["iron"], "whead", r2=0.004)
    for fx in (-1, 1):
        L.box("wfletch", (cx + fx*0.12*u, cy - 0.42*u, cz + 0.62*u), (0.16*u, 0.18*u, 0.04*u), M["iron_d"], bevel=0.0)
    if fire:
        # Öl-umwickelter Brandkopf + große lodernde Flamme an der Bolzenspitze
        rod((cx, cy + 1.4*u, cz + 1.07*u), (cx, cy + 1.78*u, cz + 1.2*u), 0.15*u, M["iron_d"], "woil")
        flame_cluster(cx, cy + 1.82*u, cz + 1.22*u, u*1.25)
        # loderndes Kohlebecken am Gestell
        L.cylinder("wbraz", (cx + 0.46*u, cy - 0.32*u, cz + 0.42*u), 0.2*u, 0.24*u, M["iron_d"], verts=12)
        flame_cluster(cx + 0.46*u, cy - 0.32*u, cz + 0.6*u, u*0.7)


def _wheel(cx, cy, cz, r, u):
    """Speichenrad mit Eisenreifen, Achse entlang X (rollt in Y)."""
    w = L.cylinder("wheel", (cx, cy, cz), r, 0.09*u, M["wood_d"], verts=16)
    w.rotation_euler = (0, math.radians(90), 0)
    tire = L.cylinder("tire", (cx, cy, cz), r*1.02, 0.05*u, M["iron_d"], verts=18)
    tire.rotation_euler = (0, math.radians(90), 0)
    L.cylinder("hub", (cx, cy, cz), 0.07*u, 0.12*u, M["iron"], verts=10).rotation_euler = (0, math.radians(90), 0)
    # Speichen robust per strut (durch die Nabe), in der Rad-Ebene Y-Z
    for a in (0.0, math.pi/3, 2*math.pi/3):
        strut((cx, cy + math.cos(a)*r*0.92, cz + math.sin(a)*r*0.92),
              (cx, cy - math.cos(a)*r*0.92, cz - math.sin(a)*r*0.92), 0.045*u, M["wood"], "spoke")


def _rock(cx, cy, cz, r):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=(cx, cy, cz))
    o = bpy.context.active_object; o.name = "rock"
    o.scale = (1.0, 0.92, 0.86)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(M["rock"])


def catapult(cx, cy, cz, u=1.0):
    """Katapult (Onager) — massiver Holzrahmen mit Eisenbeschlägen, Torsionsbündel,
    Wurfarm mit Wurflöffel + Felsbrocken, Spannwinde, Räder, Munition. Feuert nach +Y."""
    big = tier >= 4
    u = u * (1.15 if big else 1.0)
    wm, wd, ir, iron = M["wood"], M["wood_d"], M["iron_d"], M["iron"]

    # --- massiver Schlitten-Rahmen: 2 dicke Kufen + 3 Querbalken + Eisen-Eckbeschläge ---
    for sx in (-0.5, 0.5):
        L.box("cbeam", (cx + sx*u, cy, cz + 0.17*u), (0.17*u, 1.75*u, 0.22*u), wd, bevel=0.03)
    for sy in (-0.72, 0.0, 0.66):
        L.box("ccross", (cx, cy + sy*u, cz + 0.17*u), (1.18*u, 0.15*u, 0.2*u), wd, bevel=0.03)
    for (sx, sy) in [(-0.5, -0.72), (0.5, -0.72), (-0.5, 0.66), (0.5, 0.66)]:
        L.box("cfit", (cx + sx*u, cy + sy*u, cz + 0.17*u), (0.21*u, 0.21*u, 0.24*u), iron, bevel=0.02)
    # --- 4 Speichenräder ---
    for (sx, sy) in [(-0.52, -0.5), (0.52, -0.5), (-0.52, 0.5), (0.52, 0.5)]:
        _wheel(cx + sx*u, cy + sy*u, cz + 0.2*u, 0.24*u, u)

    # --- Torsions-Sehnenbündel quer (Energiespeicher) + seitliche Halterahmen ---
    tb_y, tb_z = cy + 0.3*u, cz + 0.62*u
    rod((cx - 0.52*u, tb_y, tb_z), (cx + 0.52*u, tb_y, tb_z), 0.15*u, M["rope"], "ctorsion")
    for sx in (-0.5, 0.5):
        L.box("ctframe", (cx + sx*u, tb_y, tb_z + 0.06*u), (0.12*u, 0.34*u, 0.66*u), wd, bevel=0.03)
        L.cylinder("ctcap", (cx + sx*u, tb_y, tb_z), 0.13*u, 0.1*u, iron, verts=10).rotation_euler = (0, math.radians(90), 0)

    # --- A-Frame-Ständer zum oberen Anschlag ---
    top_y, top_z = cy + 0.62*u, cz + 1.25*u
    for sx in (-0.46, 0.46):
        strut((cx + sx*u, cy - 0.55*u, cz + 0.28*u), (cx + sx*0.4*u, top_y, top_z), 0.1*u, wm, "cstandA")
        strut((cx + sx*u, cy + 0.55*u, cz + 0.28*u), (cx + sx*0.4*u, top_y, top_z), 0.1*u, wm, "cstandB")
    # gepolsterter Anschlagbalken oben quer (gegen den der Arm schlägt)
    rod((cx - 0.5*u, top_y, top_z), (cx + 0.5*u, top_y, top_z), 0.09*u, wm, "cstoptop")
    L.box("cpad", (cx, top_y + 0.02*u, top_z - 0.02*u), (0.7*u, 0.14*u, 0.14*u), M["rope"], bevel=0.05)

    # --- Wurfarm vom Torsionsbündel nach vorn-oben (geladen) + Eisenband ---
    arm_base = (cx, tb_y, tb_z)
    arm_end = (cx, cy + 0.78*u, cz + 2.0*u)
    rod(arm_base, arm_end, 0.1*u, wm, "carm")
    rod((cx, cy + 0.52*u, cz + 1.25*u), (cx, cy + 0.56*u, cz + 1.42*u), 0.12*u, iron, "carmband")
    # Wurflöffel (Schale) + Felsbrocken
    L.cylinder("cbowl", (arm_end[0], arm_end[1], arm_end[2]), 0.2*u, 0.12*u, ir, verts=14)
    _rock(arm_end[0], arm_end[1] + 0.02*u, arm_end[2] + 0.16*u, 0.17*u)

    # --- Spannwinde hinten (Trommel + Kurbel + Seil zum Arm) ---
    wz = cz + 0.55*u
    rod((cx - 0.42*u, cy - 0.66*u, wz), (cx + 0.42*u, cy - 0.66*u, wz), 0.09*u, wm, "cwinch")
    L.cylinder("ccrank", (cx + 0.52*u, cy - 0.66*u, wz), 0.06*u, 0.18*u, iron, verts=8).rotation_euler = (0, math.radians(90), 0)
    L.box("ccrankh", (cx + 0.6*u, cy - 0.74*u, wz), (0.05*u, 0.05*u, 0.2*u), wd, bevel=0.0)
    rod((cx, cy - 0.66*u, wz + 0.06*u), (cx, cy + 0.4*u, cz + 1.55*u), 0.022*u, M["rope"], "cwrope")

    # --- Munition: kleiner Steinhaufen neben dem Rahmen ---
    for (rx, ry, rz) in [(-0.74, -0.55, 0.32), (-0.6, -0.66, 0.32), (-0.68, -0.6, 0.5)]:
        _rock(cx + rx*u, cy + ry*u, cz + rz*u, 0.14*u)


def minigun(cx, cy, cz, u=1.0):
    """Minigun — rotierendes Laufbündel auf Drehlafette, feuert nach vorn (+Y). u = Größe."""
    mt, md = M["iron"], M["iron_d"]
    # Drehsockel + Säule
    L.cylinder("mgbase", (cx, cy, cz + 0.12*u), 0.32*u, 0.2*u, md, verts=16)
    L.cylinder("mgcol", (cx, cy, cz + 0.32*u), 0.13*u, 0.24*u, md, verts=12)
    # Gabel-Halterung (U) hält das Gehäuse
    for sx in (-0.24, 0.24):
        L.box("mgfork", (cx + sx*u, cy - 0.05*u, cz + 0.62*u), (0.09*u, 0.34*u, 0.58*u), md, bevel=0.03)
    body_z = cz + 0.82*u
    # Gehäuse (dicker Körper nach +Y) + hintere Kappe
    rod((cx, cy - 0.45*u, body_z), (cx, cy + 0.42*u, body_z), 0.2*u, md, "mgbody")
    L.cylinder("mgrear", (cx, cy - 0.45*u, body_z), 0.22*u, 0.12*u, mt, verts=14).rotation_euler = (math.radians(90), 0, 0)
    # Laufbündel: 6 rotierende Läufe nach +Y + Halteringe
    for k in range(6):
        a = 2*math.pi*k/6
        bx = cx + math.cos(a)*0.11*u
        bz = body_z + math.sin(a)*0.11*u
        rod((bx, cy + 0.35*u, bz), (bx, cy + 1.3*u, bz), 0.033*u, mt, "mgbarrel")
    for ry in (0.72, 1.18):
        L.cylinder("mgring", (cx, cy + ry*u, body_z), 0.16*u, 0.05*u, md, verts=14).rotation_euler = (math.radians(90), 0, 0)
    # Munitionskasten + Gurt (Messing) + hinterer Griff
    L.box("mgammo", (cx + 0.46*u, cy - 0.35*u, cz + 0.56*u), (0.3*u, 0.44*u, 0.4*u), M["wood_d"], bevel=0.03)
    rod((cx + 0.33*u, cy - 0.3*u, cz + 0.74*u), (cx + 0.06*u, cy - 0.25*u, body_z - 0.05*u), 0.045*u, M["accent"], "mgbelt")
    L.box("mggrip", (cx, cy - 0.62*u, body_z - 0.02*u), (0.08*u, 0.12*u, 0.3*u), md, bevel=0.02)


def cannon(cx, cy, cz, u=1.0, fancy=1):
    """Kanone auf Lafette, feuert nach vorn-oben (+Y). fancy 1..3 = zunehmend prächtiger
    (Eisen → Gold-Ringe → Gold-Mündungsglocke + glühender Lauf)."""
    wd, iron, ir, gold = M["wood_d"], M["iron"], M["iron_d"], M["accent"]
    gi = gold if fancy >= 2 else ir
    a = Vector((cx, cy - 0.58*u, cz + 0.5*u))    # Bodenstück (hinten, tief)
    b = Vector((cx, cy + 0.9*u, cz + 0.74*u))    # Mündung (vorn, höher)
    d = (b - a).normalized()
    # Rohr (konisch: hinten dick → vorn dünner)
    rod(a, b, 0.18*u, ir, "cnbarrel", r2=0.13*u, verts=18)
    # Bodenstück-Knauf hinten
    kn = a - d*0.1*u
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.13*u, location=(kn.x, kn.y, kn.z))
    ko = bpy.context.active_object; ko.name = "cnknob"; ko.data.materials.append(gi)
    # Verstärkungsringe (Wülste) entlang des Rohrs
    for t in (0.22, 0.5, 0.74):
        c = a + (b - a)*t
        rod(c - d*0.04*u, c + d*0.04*u, 0.2*u - 0.045*u*t, gi, "cnring", verts=16)
    # Mündungswulst
    mw = b - d*0.05*u
    rod(mw - d*0.05*u, mw + d*0.05*u, 0.17*u, gi, "cnmw", verts=16)
    # Lafette: 2 Wangen + Zapfen (Trunnions) + Lafettenschwanz
    for sx in (-0.21, 0.21):
        L.box("cncheek", (cx + sx*u, cy - 0.12*u, cz + 0.34*u), (0.1*u, 0.95*u, 0.52*u), wd, bevel=0.03)
    rod((cx - 0.26*u, cy, cz + 0.5*u), (cx + 0.26*u, cy, cz + 0.5*u), 0.06*u, iron, "cntrun")
    L.box("cntail", (cx, cy - 0.78*u, cz + 0.16*u), (0.16*u, 0.5*u, 0.14*u), wd, bevel=0.03)
    # 2 Speichenräder
    for sx in (-0.3, 0.3):
        _wheel(cx + sx*u, cy - 0.12*u, cz + 0.26*u, 0.32*u, u)
    if fancy >= 2:
        # Gold-Zierbänder an den Wangen
        for sx in (-0.21, 0.21):
            L.box("cngild", (cx + sx*u, cy - 0.12*u, cz + 0.5*u), (0.11*u, 0.5*u, 0.06*u), gold, bevel=0.02)
    muzzle_front = b
    if fancy >= 3:
        # prunkvolle Gold-Mündungsglocke + goldener Zier-Wappenknauf hinten
        bell = b + d*0.02*u
        rod(bell - d*0.04*u, bell + d*0.12*u, 0.15*u, gold, "cnbell", r2=0.26*u, verts=18)
        muzzle_front = bell + d*0.12*u
        L.crystal("cncrest", (cx, cy - 0.5*u, cz + 0.78*u), 0.1*u, 0.32*u, gold)
    # MÜNDUNGSLOCH (dunkle Bohrung) — bei jeder Kanone, in die Mündung versenkt
    r_bore = 0.14*u if fancy >= 3 else 0.085*u
    rod(muzzle_front + d*0.02*u, muzzle_front - d*0.26*u, r_bore, M["dark"], "cnbore", verts=14)


def roof_cone(cx, cy, cz, r, h, with_flag=True, pole_h=0.7):
    """Kegeldach über der Plattform + optional Fahne auf der Spitze."""
    if T["roof_style"] == "spire":
        L.cone("rcap", (cx, cy, cz + h*1.25/2), r, 0.001, h*1.25, M["roof"], verts=22)
        L.crystal("rtip", (cx, cy, cz + h*1.25 + 0.2), 0.12, 0.5, M["crystal"])
        return
    L.cone("rcap", (cx, cy, cz + h/2), r, 0.001, h, M["roof"], verts=22)
    if T["gold"]:
        L.cone("rcap_g", (cx, cy, cz + h*0.5), r*1.02, 0.001, h*0.16, M["accent"], verts=22)
    if with_flag:
        L.banner("rf", cx, cy, cz + h - 0.05, 0.42, 0.3, M["wood_d"], M["flag"], M["accent"], pole_h=pole_h)


def build_wood_tower():
    """Tier 1-2: Holzgerüst-Wachturm (T2 mit Steinsockel). Nur L1 = Ruine."""
    is_t2 = (tier == 2)
    ruined = (tier == 1 and stage == 1)
    sh = {1: 2.3, 2: 2.8, 3: 3.1}[stage]
    rb, rt = 0.95, 0.72                       # Basis-/Top-Halbweite (Verjüngung)
    corners = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    if is_t2:
        L.box("stbase", (0, 0, 0.58), (2.2, 2.2, 0.72), M["wall"], bevel=0.05)
        L.box("stbnd", (0, 0, 0.95), (2.3, 2.3, 0.1), M["wall_l"], bevel=0.02)
        foot = 0.92
    else:
        foot = 0.34
    top = foot + sh
    tilt = math.radians(7) if ruined else 0.0

    # 4 geneigte Eckpfosten (bei Ruine fehlt einer)
    skip = corners[1] if ruined else None
    for (sx, sy) in corners:
        if (sx, sy) == skip:
            continue
        p1 = (sx*rb, sy*rb, foot)
        p2 = (sx*rt + (0.25 if ruined and sx > 0 else 0), sy*rt, top)
        strut(p1, p2, 0.15, M["wood_d"], "post")
    # waagerechte Ring-Streben auf 2 Höhen
    for hz in (foot + sh*0.36, foot + sh*0.72):
        rr = rb + (rt - rb) * ((hz - foot) / sh)
        for (ax, ay, bx, by) in [(-rr, -rr, rr, -rr), (rr, -rr, rr, rr), (rr, rr, -rr, rr), (-rr, rr, -rr, -rr)]:
            strut((ax, ay, hz), (bx, by, hz), 0.08, M["wood"], "ring")
    # Andreaskreuz-Streben in den beiden sichtbaren Seitenebenen (planar, konstante Tiefe rm)
    if not ruined:
        rm = (rb + rt) / 2
        zlo, zhi = foot + 0.1, top - 0.1
        # Front (+Y-Ebene)
        strut((-rm, rm, zlo), (rm, rm, zhi), 0.055, M["wood"], "x1")
        strut((rm, rm, zlo), (-rm, rm, zhi), 0.055, M["wood"], "x2")
        # rechte Seite (+X-Ebene)
        strut((rm, -rm, zlo), (rm, rm, zhi), 0.055, M["wood"], "x3")
        strut((rm, rm, zlo), (rm, -rm, zhi), 0.055, M["wood"], "x4")
    # Leiter vorne
    if not ruined:
        for lz in (foot+0.4, foot+0.9, foot+1.4):
            L.box("rung", (0, -rb-0.1, lz), (0.5, 0.06, 0.06), M["wood_d"], bevel=0.0)
        for sx in (-0.22, 0.22):
            strut((sx, -rb-0.1, foot), (sx, -rt-0.1, top-0.3), 0.05, M["wood_d"], "rail")

    # Plattform
    plat_r = rt + 0.34
    pz = top + 0.12
    if ruined:
        # ramponierte, aber DURCHGEHENDE Plattform (Balliste steht fest, schwebt nicht)
        L.box("plat", (0, 0, pz), (2*plat_r*0.92, 2*plat_r*0.92, 0.15), M["wood"], bevel=0.03)
        L.box("platband", (0, 0, pz+0.1), (2*plat_r*0.9, 2*plat_r*0.9, 0.05), M["wood_d"], bevel=0.02)
        # Schaden: dunkle Loch-Ecke + 2 ramponierte Rest-Brüstungsstücke
        L.box("phole", (plat_r*0.55, -plat_r*0.55, pz+0.05), (0.42, 0.4, 0.12), M["wood_d"], bevel=0.02)
        bp = L.box("para", (-plat_r*0.45, plat_r*0.85, pz+0.3), (0.6, 0.09, 0.44), M["wood_d"], bevel=0.02)
        bp.rotation_euler = (math.radians(6), 0, 0)
        L.box("para", (plat_r*0.85, -plat_r*0.2, pz+0.3), (0.09, 0.6, 0.44), M["wood_d"], bevel=0.02)
    else:
        L.box("plat", (0, 0, pz), (2*plat_r, 2*plat_r, 0.16), M["wood"], bevel=0.03)
        L.box("platband", (0, 0, pz+0.12), (2*plat_r+0.06, 2*plat_r+0.06, 0.06), M["wood_d"], bevel=0.02)
        # Holz-Brüstung ringsum; niedrig bei stage1, höher+verstärkt ab stage2.
        # Bei Vollausbau vorne eine Schießluke fürs Geschütz.
        ph_b = 0.4 if stage == 1 else 0.56
        bz = pz + 0.1 + ph_b/2
        for (ex, ey, ax) in [(0, plat_r, 1), (0, -plat_r, 1), (plat_r, 0, 0), (-plat_r, 0, 0)]:
            if ey == plat_r:   # vorne immer eine Schießluke fürs Geschütz
                for ox in (-1, 1):
                    L.box("para", (ox*plat_r*0.62, plat_r, bz), (plat_r*0.66, 0.1, ph_b), M["wood_d"], bevel=0.02)
            else:
                w = (2*plat_r, 0.1, ph_b) if ax else (0.1, 2*plat_r, ph_b)
                L.box("para", (ex, ey, bz), w, M["wood_d"], bevel=0.02)
        if stage >= 2:
            # verstärkendes oberes Band (Palisaden-Krone)
            for (ex, ey, ax) in [(0, plat_r, 1), (0, -plat_r, 1), (plat_r, 0, 0), (-plat_r, 0, 0)]:
                w = (2*plat_r+0.1, 0.13, 0.1) if ax else (0.13, 2*plat_r+0.1, 0.1)
                L.box("paratop", (ex, ey, pz + 0.1 + ph_b), w, M["wood"], bevel=0.02)

    if ruined:
        # provisorische Mini-Balliste auf der Plattform (notdürftige Verteidigung) + Trümmer + Moos
        war_engine(0.1, -0.1, pz + 0.1, u=WU)
        fb = strut((-1.6, 1.3, 0.4), (-0.7, 1.9, 0.9), 0.12, M["wood_d"], "fallen")
        L.cone("rub", (1.4, 1.4, 0.46), 0.34, 0.14, 0.3, M["wall_d"], verts=10)
        L.box("moss", (0.2, -rb-0.02, foot+0.6), (0.4, 0.04, 0.5), M["moss"], bevel=0.04)
        return

    # OFFENE Wehrplattform (KEIN Dach, KEINE Stützpfosten) — nur Fahne (+ Geschütz bei Vollausbau).
    fr = plat_r * 0.78
    pole_h = 1.0 if stage == 1 else 1.25
    L.banner("rf", -fr, -fr, pz + 0.55, 0.46, 0.34, M["wood_d"], M["flag"], M["accent"], pole_h=pole_h)
    # Verteidigung in jeder Stufe (Größe wächst mini→mittel→voll, WU):
    # Tier 1 = Balliste, Tier 2 = Katapult.
    if is_t2:
        catapult(0, -0.05, pz + 0.16, u=WU)
    else:
        war_engine(0, -0.05, pz + 0.16, u=WU)
    if stage == 3:
        L.cylinder("barrel", (-fr + 0.1, -fr + 0.1, pz + 0.45), 0.15, 0.4, M["wood_d"], verts=12)
        L.cylinder("barrelr", (-fr + 0.1, -fr + 0.1, pz + 0.65), 0.16, 0.06, M["accent"], verts=12)


def build_stone_tower():
    """Tier 3-4: runder Steinturm mit Wehrplattform. Additiv besser je stage."""
    rich = tier >= 4
    sh = {1: 2.7, 2: 3.2, 3: 3.6}[stage] + (0.3 if rich else 0)
    R = 1.0
    # Fuß + Schaft (leicht verjüngt)
    L.cylinder("foot", (0, 0, 0.5), R + 0.28, 0.5, M["wall_d"], verts=28)
    L.cone("shaft", (0, 0, 0.5 + sh/2), R + 0.08, R - 0.06, sh, M["wall"], verts=28)
    # Steinfugen-Bänder
    for bz in (0.5 + sh*0.33, 0.5 + sh*0.66):
        L.cylinder("bnd", (0, 0, bz), R + 0.02, 0.08, M["wall_d"], verts=28)
    loopholes([0.5 + sh*0.4, 0.5 + sh*0.7], R)
    # Tür unten (+Y)
    L.box("door", (0, R*0.9, 0.95), (0.6, 0.2, 0.95), M["wood_d"], bevel=0.03)
    L.box("doorfr", (0, R*0.86, 1.0), (0.74, 0.16, 1.1), gold_or("wall_l"), bevel=0.03)

    top = 0.5 + sh
    # Maschikuli-Auskragung (Wehrerker) ab stage 2
    if stage >= 2:
        L.cylinder("mach", (0, 0, top + 0.05), R + 0.34, 0.32, M["wall_l"], verts=28)
        for k in range(14):
            a = 2*math.pi*k/14
            L.box("corbel", (math.cos(a)*(R+0.3), math.sin(a)*(R+0.3), top - 0.12), (0.14, 0.14, 0.22), M["wall_d"], bevel=0.02)
    # Wehrplattform
    plat_r = (R + 0.36) if stage >= 2 else (R + 0.12)
    pz = top + (0.32 if stage >= 2 else 0.12)
    L.cylinder("plat", (0, 0, pz), plat_r, 0.18, M["wall_l"], verts=28)
    # Zinnenkranz ab stage 2
    if stage >= 2 and T["battlements"]:
        round_battlement(pz + 0.28, plat_r - 0.04, M["wall_d"], n=12, mh=0.34, mw=0.24)
    # OFFENE Wehrplattform (kein Dach) — Fahne + Geschütz (Größe wächst je Stufe).
    # Tier 3 = Minigun, Tier 4 = Balliste.
    L.banner("rf", -plat_r*0.6, -plat_r*0.6, pz + 0.35, 0.48, 0.34, M["wood_d"], M["flag"], M["accent"],
             pole_h=1.0 if stage == 1 else 1.25)
    if rich:
        cannon(0, 0.0, pz + 0.2, u=WU, fancy=stage)   # T4 Kanone, je Stufe prächtiger
    else:
        minigun(0, 0.0, pz + 0.2, u=WU)               # T3 Minigun


def build_arcane_tower():
    """Tier 5: Kristall-Magieturm (dunkler Arkanstein + leuchtende Kristalle)."""
    M["wall"]   = L.mat("awall",   (0.30, 0.24, 0.42), rough=0.9)
    M["wall_l"] = L.mat("awall_l", (0.44, 0.36, 0.58), rough=0.82)
    M["wall_d"] = L.mat("awall_d", (0.19, 0.14, 0.28), rough=0.95)
    sh = {1: 3.6, 2: 4.0, 3: 4.3}[stage]
    R = 1.0
    L.cylinder("foot", (0, 0, 0.5), R + 0.28, 0.5, M["wall_d"], verts=28)
    L.cone("shaft", (0, 0, 0.5 + sh/2), R + 0.08, R - 0.08, sh, M["wall"], verts=28)
    # leuchtende Energie-Adern (vertikal) + Runen-Ring
    for k in range(6):
        a = 2*math.pi*k/6
        L.box("vein", (math.cos(a)*(R+0.02), math.sin(a)*(R+0.02), 0.5 + sh*0.5), (0.06, 0.06, sh*0.7), M["rune"], bevel=0.0)
    L.cylinder("rring", (0, 0, 0.5 + sh*0.5), R + 0.04, 0.12, M["rune"], verts=28)
    # Portal-Tür
    L.box("door", (0, R*0.9, 0.95), (0.6, 0.2, 1.0), M["mdeep"], bevel=0.03)
    L.box("doorg", (0, R*0.95, 0.95), (0.4, 0.1, 0.8), M["rune"], bevel=0.02)

    top = 0.5 + sh
    L.cylinder("mach", (0, 0, top + 0.05), R + 0.34, 0.32, M["wall_l"], verts=28)
    plat_r = R + 0.36
    pz = top + 0.32
    L.cylinder("plat", (0, 0, pz), plat_r, 0.18, M["wall_l"], verts=28)
    round_battlement(pz + 0.3, plat_r - 0.04, M["wall_d"], n=12, mh=0.36, mw=0.24)

    # OFFENE Wehrplattform (kein Spitzdach). Magie über leuchtende Kristalle an der
    # Brüstung + (Vollausbau) Kristall-Geschütz + schwebende Orbit-Kristalle.
    L.banner("rf", -plat_r*0.58, -plat_r*0.58, pz + 0.4, 0.46, 0.34, M["wood_d"], M["flag"], M["accent"],
             pole_h=1.0 if stage == 1 else 1.2)
    # Kristall-Geschütz in jeder Stufe (Größe wächst je Stufe)
    war_engine(0, 0.0, pz + 0.2, u=WU)
    if stage == 1:
        return
    # ab stage 2: Kristalle ragen aus der Brüstung (magische Zinnen)
    for k in range(6):
        a = 2*math.pi*k/6 + 0.3
        L.crystal("merc", (math.cos(a)*(plat_r-0.06), math.sin(a)*(plat_r-0.06), pz + 0.34), 0.1, 0.55, M["crystal"])
    if stage == 3:
        # Magie-Kristalle an der Basis (verankert). Schwebende Orbit-Kristalle über der
        # Plattform entfernt → App-Effekt-Layer (animiert), falls gut aussehend.
        for (cx2, cy2) in [(-1.7, 1.1), (1.7, 0.9)]:
            L.crystal("gc", (cx2, cy2, 0.6), 0.15, 0.7, M["crystal"])


if tier <= 2:
    build_wood_tower()
elif tier == 5:
    build_arcane_tower()
else:
    build_stone_tower()

# Kamera: Turm ist hoch & schmal → enger Rahmen, Ziel höher
if tier == 5:
    L.setup_iso_camera(ortho_scale=8.6 if stage == 3 else 8.0, target_z=3.0)
elif tier >= 3:
    L.setup_iso_camera(ortho_scale=7.4, target_z=2.6)
else:
    L.setup_iso_camera(ortho_scale=7.0, target_z=2.2)
L.setup_lights()
L.render_png(out, res=700)
