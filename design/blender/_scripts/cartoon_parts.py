# -*- coding: utf-8 -*-
"""Cartoon-Bauteile fuer alle Einheiten — EINZIGE QUELLE.

Grundsatzentscheidung 2026-07-08: Kopf und Haende werden nicht mehr aus dem
MakeHuman-Mesh abgeleitet, sondern als einfache Cartoon-Grundformen gebaut.
Abgenommen:
  * nackter Kopf        2026-07-09
  * Kapuze Fassung B    2026-07-09  (HOOD_STYLE "robinhood" = Standard)
  * Haende              2026-07-10  (glatte Roehren-Bauweise, echte Finger)

Verbraucher:
  cartoon_head.py   — Abnahme-Renderer Kopf/Kapuze
  cartoon_hands.py  — Abnahme-Renderer Haende
  archer_full.py    — Zusammenfuehrung mit dem MakeHuman-Koerper

Dieses Modul rendert nichts und veraendert die Szene nur ueber die build_*-
Aufrufe. Alle Bauteile entstehen im lokalen Ursprung; der Verbraucher
transformiert sie per matrix_world an ihren Platz.
"""
import bpy, bmesh, math
from mathutils import Vector

# === FARBEN (Fraktionsblatt Menschen: Koenigsblau/Gold) ========================
COL_SKIN = (0.80, 0.52, 0.35)
COL_HAIR = (0.13, 0.075, 0.035)
COL_BLUE = (0.023, 0.102, 0.351)      # #2A5AA0 Koenigsblau (linear)
COL_BLUE_D = (0.012, 0.056, 0.184)
COL_GOLD = (0.68, 0.40, 0.075)
COL_WOOD = (0.26, 0.15, 0.05)
COL_LEATHER = (0.19, 0.082, 0.028)    # #7A5230 Leder (Sekundaerfarbe)
COL_LEATHER_D = (0.12, 0.055, 0.020)

# === KOPF-GRUNDMASSE (abgenommen — nicht ohne Neu-Abnahme aendern) ============
R = 0.5
HSX, HSY, HSZ = 1.05, 1.00, 1.02      # x Breite (groesste), y Tiefe, z Hoehe
BROW_Z = 0.223                        # Brauenlinie
NECK_TOP = -R * HSZ + 0.04


def mat(name, rgb, rough=0.85, metal=0.0, spec=0.20, emit=0.0):
    """MATERIALREGEL (ART_STYLE 2.3): matt, kleiner weicher Glanzpunkt, kein Chrom."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = spec
    if emit > 0:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def make_materials():
    """Alle Materialien der Cartoon-Teile in einem Dict."""
    return {
        "SKIN": mat("skin", COL_SKIN, rough=0.95),
        "HAIR": mat("hair", COL_HAIR, rough=0.95),
        # leichte Emission: der Brauenschatten auf den Augaepfeln las sich sonst
        # als boeser Blick — selbstleuchtende Augen bleiben flach-freundlich
        "WHITE": mat("eye_white", (0.92, 0.92, 0.90), rough=0.35, emit=0.5),
        "IRIS": mat("iris", (0.10, 0.05, 0.02), rough=0.3, emit=0.25),
        "LINE": mat("line", (0.08, 0.035, 0.02), rough=0.9),
        "BLUE": mat("blue", COL_BLUE, rough=0.85),
        "BLUE_D": mat("blue_d", COL_BLUE_D, rough=0.85),
        "GOLD": mat("gold", COL_GOLD, rough=0.4, metal=0.6),
        "WOOD": mat("wood", COL_WOOD, rough=0.7),
        "LEATH": mat("leath", COL_LEATHER, rough=0.9),
        "LEATH_D": mat("leath_d", COL_LEATHER_D, rough=0.9),
    }


# === PRIMITIVE =================================================================
def sphere(name, center, r, material, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=r, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
        bpy.ops.object.transform_apply(scale=True)
    o.location = Vector(center)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def rod(p1, p2, r, material, name="rod", verts=16):
    a = Vector(p1); b = Vector(p2); mid = (a + b) / 2; d = b - a
    if d.length < 1e-6:
        return None
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    o.location = (mid.x, mid.y, mid.z)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def tube(pts, name, material, bevres=10):
    """EINE glatte Roehre entlang einer Bezier-Achse. pts = [(Vector, radius), ...];
    der per-Punkt-Radius skaliert den Bevel -> praller Finger aus EINEM Stueck,
    keine Glieder, keine Einschnuerungen (Durchbruch 2026-07-10)."""
    cu = bpy.data.curves.new(name + "_c", 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 10
    cu.bevel_depth = 1.0                 # Radius kommt aus point.radius
    cu.bevel_resolution = bevres
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for i, (p, r) in enumerate(pts):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
        bp.radius = r
    sp.use_smooth = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return o


# Halbkugel-Profil fuer die nahtlose Fingerkuppe: (Abstand/R, Radius/R)
_TIP = ((0.38, 0.925), (0.68, 0.733), (0.88, 0.475), (0.99, 0.141))


def add_round_tip(pts):
    """Haengt an die Achse eine runde, NAHTLOSE Kuppe (Radienabfall wie Halbkugel)."""
    tang = (Vector(pts[-1][0]) - Vector(pts[-2][0])).normalized()
    p_end, R_end = Vector(pts[-1][0]), pts[-1][1]
    for d, rm in _TIP:
        pts.append((p_end + tang * (R_end * d), R_end * rm))
    return pts


def finger_tube(base, dirv, L, Rf, curl, name, material, curl_axis=(0, 1, 0), taper=0.16):
    """Ein Finger: EINE glatte, leicht gebogene Roehre + runde Kuppe.
    Gelenke werden allein durch die Biegung angedeutet (keine Ringe)."""
    dirv = Vector(dirv).normalized()
    ca = Vector(curl_axis).normalized()
    pts = []
    N = 5
    for i in range(N + 1):
        t = i / N
        p = Vector(base) + dirv * (L * t) + ca * (curl * L * t * t)
        pts.append((p, Rf * (1.0 - taper * t)))
    add_round_tip(pts)
    return tube(pts, name, material)


# === KOPF ======================================================================
def yface(x, z):
    """Vordere Kugeloberflaeche y an (x,z) — zur Feature-Platzierung."""
    val = 1 - (x / (R * HSX)) ** 2 - (z / (R * HSZ)) ** 2
    return R * HSY * math.sqrt(max(0.0, val))


def decal_strip(name, pts, halfwidth, mat_, project_target, offset=0.012):
    """Flacher Streifen aus einer Mittellinie (pts, in x-z), per Shrinkwrap auf
    die Kopf-Kugel projiziert -> liegt als flaches Decal auf der Haut."""
    bm = bmesh.new()
    top, bot = [], []
    for (x, z) in pts:
        top.append(bm.verts.new((x, R * HSY + 0.15, z + halfwidth)))
        bot.append(bm.verts.new((x, R * HSY + 0.15, z - halfwidth)))
    for i in range(len(pts) - 1):
        bm.faces.new((bot[i], bot[i + 1], top[i + 1], top[i]))
    dm = bpy.data.meshes.new(name)
    bm.to_mesh(dm); bm.free()
    o = bpy.data.objects.new(name, dm)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat_)
    sw = o.modifiers.new("wrap", 'SHRINKWRAP')
    sw.target = project_target
    sw.wrap_method = 'PROJECT'
    sw.use_project_y = True
    sw.use_negative_direction = True
    sw.offset = offset
    return o


def head_metrics(head):
    """(KB, KH, KT, FB, FH) der Kopf-Grundform in Weltmassen."""
    hw = [head.matrix_world @ v.co for v in head.data.vertices]
    KB = max(p.x for p in hw) - min(p.x for p in hw)
    KH = max(p.z for p in hw) - min(p.z for p in hw)
    KT = max(p.y for p in hw) - min(p.y for p in hw)
    _ymax = max(p.y for p in hw)
    faceP = [p for p in hw if p.y > 0.6 * _ymax]
    FB = max(p.x for p in faceP) - min(p.x for p in faceP)
    FH = max(p.z for p in faceP) - min(p.z for p in faceP)
    return KB, KH, KT, FB, FH


def build_head(M, with_hair=True, with_neck=True, neck_len=0.22, mouth="smile"):
    """Cartoon-Kopf: leicht in die Breite gehende Kugel, Kugel-Augen,
    Decal-Mund + Decal-Brauen, weiches Kinn. Gibt (head, objs) zurueck.
    mouth: "smile" (Laechel-Linie) | "open" (gefuellte Ellipse — Attack/Jubel,
    Posen-Plan 2026-07-14)."""
    objs = []
    head = sphere("kopf", (0, 0, 0), R, M["SKIN"], scale=(HSX, HSY, HSZ))
    objs.append(head)
    # Weiches Kinn + volle Wangen: untere Verts nur LEICHT verschmaelern
    for v in head.data.vertices:
        if v.co.z < 0:
            t = min(1.0, (-v.co.z) / (R * HSZ))
            v.co.x *= (1.0 - 0.10 * t ** 1.7)
    bpy.context.view_layer.update()

    KB, KH, KT, FB, FH = head_metrics(head)
    print(f"KOPF-BBOX B {KB:.3f} H {KH:.3f} T {KT:.3f} | H/B {KH/KB:.3f} T/B {KT/KB:.3f}")
    print(f"GESICHT B {FB:.3f} H {FH:.3f} | H/B {FH/FB:.3f}")
    assert 0.95 <= KH / KB <= 1.10, f"Kopf H/B={KH/KB:.3f} ausserhalb [0.95,1.10]"
    assert 0.90 <= KT / KB <= 1.05, f"Kopf T/B={KT/KB:.3f} ausserhalb [0.90,1.05]"
    assert 0.95 <= FH / FB <= 1.05, f"Gesicht H/B={FH/FB:.3f} ausserhalb [0.95,1.05]"

    # AUGEN: bewaehrte Kugeln (Sklera flach + vertikal, Iris, Glanz)
    sc_r = 0.15
    for sgn in (1, -1):
        ex, ez = sgn * 0.185, 0.02
        ey = yface(ex, ez)
        objs.append(sphere("sklera", (ex, ey - 0.04, ez), sc_r, M["WHITE"], scale=(1.0, 0.62, 1.20)))
        objs.append(sphere("iris", (ex, ey - 0.04 + sc_r * 0.55, ez - sc_r * 0.02),
                           sc_r * 0.60, M["IRIS"], scale=(1.0, 0.6, 1.0)))
        objs.append(sphere("glanz", (ex + sgn * sc_r * 0.20, ey - 0.04 + sc_r * 0.80, ez + sc_r * 0.34),
                           sc_r * 0.18, M["WHITE"]))

    # NASE: kleiner dezenter Cartoon-Knubbel
    nz = -0.05
    objs.append(sphere("nase", (0, yface(0, nz) - 0.02, nz), 0.055, M["SKIN"], scale=(1.0, 0.9, 0.8)))

    # MUND: flaches Decal (leicht nach oben gebogene Linie) ODER offene Ellipse
    mund_z = -0.235
    if mouth == "open":
        # OFFENER MUND (Attack-Schrei/Jubel): gefuellte dunkle Ellipse, als
        # Decal auf die Kopf-Kugel projiziert (gleiches Prinzip wie decal_strip)
        bm = bmesh.new()
        _vs = [bm.verts.new((0.072 * math.cos(2 * math.pi * i / 24),
                             R * HSY + 0.15,
                             (mund_z + 0.012) + 0.050 * math.sin(2 * math.pi * i / 24)))
               for i in range(24)]
        bm.faces.new(_vs)
        _dm = bpy.data.meshes.new("MundDecal")
        bm.to_mesh(_dm); bm.free()
        _mo = bpy.data.objects.new("MundDecal", _dm)
        bpy.context.collection.objects.link(_mo)
        _mo.data.materials.append(M["LINE"])
        _sw = _mo.modifiers.new("wrap", 'SHRINKWRAP')
        _sw.target = head; _sw.wrap_method = 'PROJECT'
        _sw.use_project_y = True; _sw.use_negative_direction = True
        _sw.offset = 0.014
        objs.append(_mo)
    else:
        mpts = [((-1 + 2 * i / 24) * 0.11, mund_z + 0.03 * (-1 + 2 * i / 24) ** 2) for i in range(25)]
        objs.append(decal_strip("MundDecal", mpts, 0.012, M["LINE"], head, offset=0.012))

    # BRAUEN: flache Decal-Boegen, waagerecht = neutral-freundliche Basis
    # (Emotionen kommen spaeter ueber ausgetauschte Decals pro Pose)
    for sgn in (1, -1):
        bpts = []
        for i in range(9):
            xn = -1 + 2 * i / 8
            bpts.append((sgn * (0.185 + xn * 0.085), BROW_Z + 0.006 * (1 - xn ** 2)))
        objs.append(decal_strip(f"Braue_{sgn}", sorted(bpts, key=lambda p: p[0]),
                                0.016, M["HAIR"], head, offset=0.012))

    if with_hair:
        objs.append(_build_hair(M))
    if with_neck:
        objs.append(rod((0, 0.02, NECK_TOP), (0, 0.02, NECK_TOP - neck_len), 0.17,
                        M["SKIN"], "hals", verts=24))
    return head, objs


def _build_hair(M):
    """Saubere Kalotte statt zackigem Kugel-Kugel-Schnitt: obere Kugel, unten
    geneigt abgeschnitten, Schnittkante geschwungen (weicher Haaransatz)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=R, location=(0, 0, 0))
    hair = bpy.context.active_object
    hair.name = "haar"
    hair.scale = (HSX * 1.02, HSY * 1.02, HSZ * 1.02)
    bpy.ops.object.transform_apply(scale=True)
    hb = bmesh.new(); hb.from_mesh(hair.data)
    res = bmesh.ops.bisect_plane(
        hb, geom=list(hb.verts) + list(hb.edges) + list(hb.faces),
        plane_co=(0, 0, 0.17), plane_no=(0, -0.30, 1), clear_inner=True)
    for el in res['geom_cut']:
        if isinstance(el, bmesh.types.BMVert):
            t = max(0.0, el.co.y) / (R * HSY * 1.02)      # 1 vorne, 0 seitlich/hinten
            if t > 0.05:
                xn = max(-1.0, min(1.0, el.co.x / (R * HSX)))
                el.co.z += t * (0.055 * abs(xn) - 0.020)  # Schlaefen hoch, Mitte leicht runter
    hb.normal_update()
    hb.to_mesh(hair.data); hb.free()
    bpy.ops.object.shade_smooth()
    hair.data.materials.append(M["HAIR"])
    return hair


# === KAPUZE ====================================================================
def build_hood(M, head, style="robinhood", with_collar=True, y_shift=None):
    """Zwei saubere Endfassungen (Bild-Entscheidung 2026-07-09):
      "kompakt"   kleine runde Frontoeffnung, eng anliegend, Seite geschlossener.
      "robinhood" vordere Haelfte offen (volles Profil frei), lockerer Stoffrand,
                  Zipfel hinten-oben + Nackenfall. -> STANDARD.
    TIEFENSITZ (2026-07-11): Die Haube ist in y TIEFER als breit/hoch (KAP_SY)
    und nach vorne geschoben (y_shift) — der Rand steht vorne deutlich ueber
    Stirn/Nase, der Hinterkopf liegt an der Schale AN, ohne sie zu durchstossen
    (beides per Assert). Nur den Kopf nach hinten zu schieben ist unmoeglich:
    die Haut wuerde die 0.014 duenne Schale hinten durchstossen."""
    objs = []
    hood_top = BROW_Z + 0.10                # oberer Rand auf Stirnmitte (beide)
    op_bot = -0.36                          # unterer Rand, Kinn frei (beide)
    KAP_S = 1.02 if style == "kompakt" else 1.06
    # Tiefe (y) groesser als Breite/Hoehe + Vorwaerts-Schub: Gesicht sitzt
    # zurueckversetzt, Hinterkopf angelegt (Werte s. Asserts unten)
    KAP_SY = 1.02 if style == "kompakt" else 1.18
    if y_shift is None:
        y_shift = 0.008 if style == "kompakt" else 0.10
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=48, radius=R, location=(0, 0, 0))
    kap = bpy.context.active_object; kap.name = "kapuze"
    kap.scale = (HSX * KAP_S, HSY * KAP_SY, HSZ * KAP_S)
    bpy.ops.object.transform_apply(scale=True)
    Rx, Ry, Rz = R * HSX * KAP_S, R * HSY * KAP_SY, R * HSZ * KAP_S
    kb = bmesh.new(); kb.from_mesh(kap.data)
    dfaces, open_centers = [], []
    if style == "kompakt":
        zo = (hood_top - op_bot) / 2
        zc = hood_top - zo
        xo = 0.37
        for f in kb.faces:
            c = f.calc_center_median()
            if c.y > 0.03 and (c.x / xo) ** 2 + ((c.z - zc) / zo) ** 2 < 1.0:
                dfaces.append(f); open_centers.append(c.copy())
        bmesh.ops.delete(kb, geom=dfaces, context='FACES')
        # Rand exakt auf die Ellipse + radial auf die KOPF-Oberflaeche legen:
        # loest Treppenkante UND Luftspalt zwischen Kopf und Kapuze
        for v in kb.verts:
            if v.is_boundary:
                ang = math.atan2((v.co.z - zc) / zo, v.co.x / xo)
                ex, ez = xo * math.cos(ang), zc + zo * math.sin(ang)
                r_ = 1 - (ex / (R * HSX)) ** 2 - (ez / (R * HSZ)) ** 2
                ey = R * HSY * math.sqrt(max(0.0, r_)) - 0.005
                v.co = Vector((ex, ey, ez))
    else:
        for v in kb.verts:
            p = v.co
            if p.y < -0.06:
                fy = min(1.0, (-p.y - 0.06) / (Ry - 0.06))
                ftop = max(0.0, (p.z - 0.05) / Rz)
                fbot = max(0.0, (0.05 - p.z) / Rz)
                p.y -= fy * ftop * 0.14
                p.z += fy * ftop * 0.11
                p.z -= fy * fbot * 0.16
        for f in kb.faces:
            c = f.calc_center_median()
            if c.y > 0.05 and op_bot < c.z < hood_top:
                dfaces.append(f); open_centers.append(c.copy())
        bmesh.ops.delete(kb, geom=dfaces, context='FACES')
        bv = [v for v in kb.verts if v.is_boundary]
        for _ in range(10):
            bmesh.ops.smooth_vert(kb, verts=bv, factor=0.5,
                                  use_axis_x=True, use_axis_y=True, use_axis_z=True)
        for v in bv:
            v.co = v.co + v.co.normalized() * 0.03   # abstehender weicher Stoffrand
    kb.normal_update()
    kb.to_mesh(kap.data); kb.free()
    bpy.ops.object.shade_smooth()
    sol = kap.modifiers.new("sol", 'SOLIDIFY'); sol.thickness = 0.014; sol.offset = 1
    kap.data.materials.append(M["BLUE"])
    objs.append(kap)

    if with_collar:
        bpy.ops.mesh.primitive_cone_add(vertices=44, radius1=0.24, radius2=0.47,
                                        depth=0.30, location=(0, 0.01, NECK_TOP - 0.15))
        kragen = bpy.context.active_object; kragen.name = "kragen"
        bpy.ops.object.shade_smooth()
        kragen.modifiers.new("s", 'SOLIDIFY').thickness = 0.02
        kragen.data.materials.append(M["BLUE"])
        objs.append(kragen)

    # FEDER: gerade Goldfeder, kurz, seitlich am Kapuzenrand ueber dem Ohr
    if style == "kompakt":
        fbase = Vector((math.sin(math.radians(62)) * Rx * 0.99, 0.0, 0.14))
    else:
        fbase = Vector((0.30, 0.0, 0.40))
    rem = 1 - (fbase.x / Rx) ** 2 - (fbase.z / Rz) ** 2
    fbase.y = Ry * math.sqrt(max(0.0, rem)) * 0.99          # Basis auf das Ellipsoid
    nd = math.sqrt((fbase.x / Rx) ** 2 + (fbase.y / Ry) ** 2 + (fbase.z / Rz) ** 2)
    assert 0.90 < nd < 1.10, f"Feder-Basis nicht an der Kapuze (nd={nd:.2f})"
    fdir = Vector((0.22, -0.80, 0.56)).normalized()
    assert math.degrees(math.acos(fdir.z)) > 45, "Feder steht zu senkrecht"
    assert fdir.y < 0, "Feder-Spitze zeigt nicht nach hinten"
    wvec = fdir.cross(Vector((0, 1, 0))).normalized()
    fm = bpy.data.meshes.new("federblatt"); fbm = bmesh.new()
    flen = 0.30
    fa, fbv = [], []
    for i in range(9):
        t = i / 8
        pp = fbase + fdir * (flen * t)
        hwid = 0.05 * (1.0 - 0.85 * t) + 0.004
        fa.append(fbm.verts.new(pp + wvec * hwid))
        fbv.append(fbm.verts.new(pp - wvec * hwid))
    for i in range(8):
        fbm.faces.new((fbv[i], fbv[i + 1], fa[i + 1], fa[i]))
    fbm.to_mesh(fm); fbm.free()
    fe = bpy.data.objects.new("feder", fm); bpy.context.collection.objects.link(fe)
    fe.data.materials.append(M["GOLD"])
    fe.modifiers.new("s", 'SOLIDIFY').thickness = 0.01
    objs.append(fe)
    kiel = sphere("federkiel", fbase - fdir * 0.01, 0.032, M["GOLD"])
    objs.append(kiel)
    print("ASSERT Feder ok: nd", round(nd, 3), "winkel",
          round(math.degrees(math.acos(fdir.z)), 1))

    # KAPUZEN-TIEFENSITZ: Schale + Feder nach vorne schieben -> hinten liegt die
    # Kapuze am Hinterkopf AN (ohne Durchstossen), Gesicht sitzt zurueckversetzt.
    for _o in (kap, fe, kiel):
        _o.location.y += y_shift
    _head_back = R * HSY                              # Hinterkopf |y|
    _fit = _head_back - (Ry - y_shift)                # >0 = liegt hinten an
    _marge = (Ry + 0.014 - y_shift) - _head_back      # >0 = durchstoesst NICHT
    _rim_y = Ry * math.sqrt(max(0.0, 1 - (hood_top / Rz) ** 2)) + y_shift
    print(f"KAPUZEN-SITZ: KAP_SY {KAP_SY} y_shift {y_shift:+.3f} -> Anlage {_fit:+.3f}, "
          f"Aussenwand-Marge {_marge:+.3f}, Rand-Vorstand vor Nase {_rim_y - 0.50:+.3f}")
    assert _fit >= 0, f"Kapuze liegt hinten nicht an (Spalt {-_fit:.3f})"
    assert _marge >= 0, f"Hinterkopf durchstoesst die Schale ({-_marge:.3f})"

    # ASSERT: Nacken/Hinterkopf bedeckt (Oeffnung nur vordere Haelfte)
    op_ys = [c.y for c in open_centers]
    assert min(op_ys) >= -0.05, "Oeffnung reicht in den Nacken"
    # ASSERT: Stirn ueber den Brauen sichtbar (vorne ausdruecklich erwuenscht)
    stirn = sum(1 for v in head.data.vertices
                if (head.matrix_world @ v.co).y > 0.12
                and BROW_Z + 0.02 < (head.matrix_world @ v.co).z < hood_top)
    assert stirn > 2, "Keine sichtbare Stirn ueber den Brauen"
    # ASSERT: Wandstaerke (kompakt eng, robinhood mehr Stoff-Volumen)
    dg = bpy.context.evaluated_depsgraph_get()
    kev = [kap.matrix_world @ v.co for v in kap.evaluated_get(dg).data.vertices]
    KAPB = max(p.x for p in kev) - min(p.x for p in kev)
    KB = head_metrics(head)[0]
    wall_lim = 1.12 if style == "kompakt" else 1.25
    print(f"ASSERT Wandstaerke: Kapuze {KAPB:.3f} vs Kopf {KB:.3f} = {KAPB/KB:.3f}x, "
          f"Stirn-Verts {stirn}, Nacken min-y {min(op_ys):.3f}")
    assert KAPB / KB < wall_lim, f"Kapuze zu dick (BBox {KAPB/KB:.3f}x Kopf)"
    return objs


# === KRAGEN (Stoff-Umhang ueber den Schultern, fuer die MONTIERTE Figur) ======
def build_collar(M, neck_r=0.175, neck_z=1.555):
    """Weicher Stoff-Kragen in KOERPER-Koordinaten: innen eng um den Hals (unter
    Kinn/Kapuzenrand), aussen laeuft er auf der Koerperoberflaeche aus — vorne
    zur Brust, hinten zum Ruecken, seitlich in die Schulterkugeln. Ersetzt den
    steifen Trichter-Kegel aus build_hood (der stand ab und liess den Hals sehen).
    Quadratische Bezier innen->aussen mit leichtem Stoff-Bausch."""
    evr = _steffen_eval(TORSO_PROFILE)
    evF = _steffen_eval(TORSO_FRONT)
    evB = _steffen_eval(TORSO_BACK)
    nu, nt = 56, 9
    bm = bmesh.new()
    grid = []
    for iu in range(nu):
        u = 2 * math.pi * iu / nu
        cu_, su_ = math.cos(u), math.sin(u)
        sp, sn = max(0.0, su_), max(0.0, -su_)
        # Saum-Hoehe: seitlich hoch (Schulter), vorne/hinten tiefer auslaufend
        z_e = 1.36 - 0.125 * sp * sp - 0.105 * sn * sn
        rx = max(evr(z_e), 1e-3)
        D = max(evF(z_e) if su_ >= 0 else evB(z_e), 1e-3)
        s_surf = 1.0 / math.sqrt((cu_ / rx) ** 2 + (su_ / D) ** 2)
        r_e = s_surf + 0.012                     # Saum liegt AUF der Oberflaeche
        r_m = (neck_r + r_e) / 2 + 0.035         # leichter Stoff-Bausch
        z_m = (neck_z + z_e) / 2 + 0.02
        row = []
        for it in range(nt):
            t = it / (nt - 1)
            r = (1 - t) ** 2 * neck_r + 2 * (1 - t) * t * r_m + t * t * r_e
            z = (1 - t) ** 2 * neck_z + 2 * (1 - t) * t * z_m + t * t * z_e
            row.append(bm.verts.new((r * cu_, r * su_, z)))
        grid.append(row)
    for iu in range(nu):
        a, b = grid[iu], grid[(iu + 1) % nu]
        for it in range(nt - 1):
            bm.faces.new((a[it], b[it], b[it + 1], a[it + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("kragen")
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("kragen", me)
    bpy.context.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    o.data.materials.append(M["BLUE"])
    sol = o.modifiers.new("s", 'SOLIDIFY'); sol.thickness = 0.016; sol.offset = 0
    return [o]


# === HAENDE ====================================================================
WR = 0.092        # Handgelenk-Radius (schmaler Unterarm-Ausgang)
# Ansatzpunkt fuer die Montage am Arm (lokale Koordinaten der Faust)
FIST_WRIST_ANCHOR = Vector((0, -0.095, -0.02))
OPEN_WRIST_ANCHOR = Vector((0, 0.0, -0.02))

#  offene Hand: fx (+x = Daumenseite), Laenge, Radius, Spreizung
OPEN_FING = ((0.083, 0.163, 0.0455, 0.16),      # Zeigefinger
             (0.028, 0.176, 0.0465, 0.05),      # Mittelfinger (laengster)
             (-0.028, 0.159, 0.0435, -0.05),    # Ringfinger
             (-0.083, 0.126, 0.0390, -0.18))    # kleiner Finger
#  Faust: fz (Hoehe am Stab), Radius, End-Wickelwinkel
FIST_FING = ((0.090, 0.0455, 168), (0.030, 0.0465, 172),
             (-0.029, 0.0435, 165), (-0.088, 0.0390, 155))


def _wrist(M, base_z, y_off, name):
    """Weicher Uebergang Arm->Hand: schlanker, in y abgeflachter Kegel."""
    dep = base_z * 0.92
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=WR * 0.92, radius2=WR * 1.00,
                                    depth=dep, location=(0, y_off, dep / 2 - 0.05))
    o = bpy.context.active_object; o.name = name
    o.scale = (1.0, 0.72, 1.0)                # Handgelenk ist flacher als rund
    bpy.ops.object.shade_smooth(); o.data.materials.append(M["SKIN"])
    return o


def build_open_hand(M, pfx="", with_wrist=True):
    """Neutrale offene Hand (rechte Hand). Vier glatte, leicht gebogene Finger-
    roehren unterschiedlicher Laenge + kraeftiger Daumen an der Handkante."""
    objs = []
    HC = Vector((0, 0, 0.14))
    objs.append(sphere(f"{pfx}mittelhand", HC, 0.086, M["SKIN"], scale=(1.50, 0.80, 1.22)))
    objs.append(sphere(f"{pfx}daumenballen", HC + Vector((0.084, 0.0, -0.035)), 0.060,
                       M["SKIN"], scale=(1.0, 1.0, 1.15)))
    objs.append(sphere(f"{pfx}kleinballen", HC + Vector((-0.086, 0.0, -0.030)), 0.050,
                       M["SKIN"], scale=(1.0, 1.0, 1.15)))
    for fi, (fx, L, Rf, spread) in enumerate(OPEN_FING):
        objs.append(finger_tube(HC + Vector((fx, 0.004, 0.066)), Vector((spread, 0.08, 1.0)),
                                L, Rf, 0.26, f"{pfx}finger{fi}", M["SKIN"]))
    objs.append(finger_tube(HC + Vector((0.088, -0.012, -0.038)), Vector((0.75, -0.10, 0.65)),
                            0.168, 0.050, 0.22, f"{pfx}daumen", M["SKIN"], curl_axis=(0, -0.4, 1.0)))
    if with_wrist:
        objs.append(_wrist(M, HC.z, 0.0, f"{pfx}handgelenk"))
    return objs


def build_fist(M, pfx="", with_wrist=True, staff=None):
    """Greifende Faust (rechte Hand): die glatten Fingerroehren kruemmen sich in
    einem weichen Bogen RINGSUM den Stab (Stabachse = lokale z-Achse), die
    Fingerkuppen tauchen vorne wieder auf, der Daumen kommt von der Handkante
    dagegen. staff = (r, z_von, z_bis) baut zusaetzlich einen Holzstab."""
    objs = []
    HC = Vector((0, 0, 0.26))                 # Stab-Achse bei x=0, y=0
    objs.append(sphere(f"{pfx}handballen", HC + Vector((0, -0.108, 0.0)), 0.080,
                       M["SKIN"], scale=(1.45, 0.95, 1.60)))
    objs.append(sphere(f"{pfx}daumenballen", HC + Vector((0.090, -0.082, -0.040)), 0.060,
                       M["SKIN"], scale=(1.0, 1.0, 1.25)))
    for fi, (fz, Rf, end_ang) in enumerate(FIST_FING):
        pts = []
        N = 6
        for k in range(N + 1):
            t = k / N
            a = math.radians(26 + t * (end_ang - 26))   # hinten -> vorne
            rr = 0.096 - 0.009 * t                      # Bogen zieht sich leicht zusammen
            pts.append((HC + Vector((-rr * math.sin(a), -rr * math.cos(a), fz)),
                        Rf * (1.0 - 0.15 * t)))
        add_round_tip(pts)
        objs.append(tube(pts, f"{pfx}finger{fi}", M["SKIN"]))
    tp = [(HC + Vector((0.128, -0.068, -0.026)), 0.051),
          (HC + Vector((0.120, -0.016, -0.010)), 0.048),
          (HC + Vector((0.098, 0.034, 0.002)), 0.045),
          (HC + Vector((0.052, 0.074, 0.014)), 0.042)]   # Kuppe trifft die Finger
    add_round_tip(tp)
    objs.append(tube(tp, f"{pfx}daumen", M["SKIN"]))
    if with_wrist:
        objs.append(_wrist(M, HC.z, -0.095, f"{pfx}handgelenk"))
    if staff:
        r_, z0, z1 = staff
        objs.append(rod((0, 0, z0), (0, 0, z1), r_, M["WOOD"], f"{pfx}stab", verts=18))
    return objs


def build_grip_fist(M, pfx="", thumb=False, grooves="bulges4"):
    # DEFAULT = "bulges4": Variante W4 ENDGUELTIG eingefroren
    # (Nutzer-Abnahme 2026-07-14 im Idle-v03-Posen-Kontext).
    """FAEUSTLINGS-Faust (Nutzer 2026-07-14): geschlossener, abgerundeter
    Faust-Blob OHNE Einzelfinger. KEIN Wrist-Kegel. Hautfarbe + Soft-Look wie
    die uebrigen Haende. Lokal: Stabachse = z-Achse durch den Ursprung;
    +x = Daumenseite (HAND-CHIRALITAETS-Check der Posen); +y = Handinnenseite.
    grooves (v07): "lines"  = 3 Furchen quer ueber die Vorderseite, fast voll
                             versenkt (nur duenne Linie sichtbar), Hautton
                             ~25% dunkler, 60-70% der Vorderseiten-Breite;
                   "bulges" = 3 breite Fingerwuelste, tief verschmolzen, die
                             die vordere Faustkontur selbst wellig machen —
                             Gliederung aus der FORM, gleicher Hautton.
    grooves (v09, alle mit 4 Rillen):
                   "cuts"    = ECHTE Kerben per Boolean-DIFFERENCE in die
                              Vorderseite, weiche Glaettung via shade_smooth;
                   "lines4"  = wie "lines", aber KOMPLETT buendig versenkt
                              (nur die dunkle Furchenlinie sichtbar), 4 Stk.;
                   "bulges4" = wie "bulges" mit 4 leicht kleineren Wuelsten
                              (Kontur bleibt ruhig wellig).
    thumb=True legt zusaetzlich die tangential gekippte Daumen-Kapsel
    diagonal ueber die obere Fausthaelfte (v06-Variante A)."""
    objs = []
    # Blob: entlang der Stabachse gestreckt, quer abgeflacht (hoeher als tief,
    # keine reine Eiform — Nutzer-Korrektur v02)
    objs.append(sphere(f"{pfx}faust", (0, -0.010, 0), 0.112, M["SKIN"],
                       scale=(1.16, 0.92, 1.52)))
    # --- FINGER-RILLEN: Hautton ~13% dunkler; Tiefe so flach, dass sie bei
    # 13 px Spielgroesse verschwinden (QA-Pflichtteil). Gerade Sehnen ueber
    # der gewoelbten Flaeche: die Enden tauchen von selbst in den Blob ein.
    a_, b_, c_ = 0.130, 0.103, 0.170              # Blob-Halbachsen (Welt-lokal)

    def _surf(t_deg, zk, off):
        """Punkt auf der Blob-Oberflaeche (Azimut t, Hoehe z), radial um off
        versetzt (off < 0 = eingesenkt). Normale = Ellipsoid-Gradient — so
        folgen die Kapseln der Woelbung, statt als Sehne frei zu ragen."""
        s_ = math.sqrt(max(0.0, 1.0 - (zk / c_) ** 2))
        t_ = math.radians(t_deg)
        px, py = a_ * s_ * math.cos(t_), b_ * s_ * math.sin(t_)
        n = Vector((px / (a_ * a_), py / (b_ * b_), zk / (c_ * c_))).normalized()
        return Vector((px, py - 0.010, zk)) + n * off

    if grooves == "lines":
        # Variante L: fast voll versenkte Furchen — nur eine duenne dunkle
        # Linie tritt aus (Ton x0.75); Bogen folgt der Woelbung, Spann ~72
        # Grad Azimut = 60-70% der sichtbaren Vorderseite
        _base = M["SKIN"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
        _dark = mat(f"{pfx}rille_mat", (_base[0] * 0.75, _base[1] * 0.75,
                                        _base[2] * 0.75), rough=0.95)
        for k, zk in enumerate((0.060, 0.005, -0.050)):
            arc = ((-36, -0.015, 0.009), (-18, -0.008, 0.011), (0, -0.007, 0.011),
                   (18, -0.008, 0.011), (36, -0.015, 0.009))
            rp = [(_surf(245 + da, zk, off), rr) for da, off, rr in arc]
            objs.append(tube(rp, f"{pfx}rille{k}", _dark))
    elif grooves == "bulges":
        # Variante W: breite, tief verschmolzene Fingerwuelste — die vordere
        # Faustkontur wird selbst wellig; Gliederung aus der FORM, gleicher
        # Hautton wie der Blob
        # tief verschmolzen: Mitte nur ~0.016 proud (r 0.040, off -0.024),
        # Enden buendig im Blob — die KONTUR wird wellig, nichts steht als
        # Einzelfinger ab (v07-W ragte mit ~0.05 viel zu weit heraus)
        for k, zk in enumerate((0.068, 0.002, -0.062)):
            arc = ((-34, -0.034, 0.030), (-16, -0.027, 0.038), (0, -0.024, 0.040),
                   (16, -0.027, 0.038), (34, -0.034, 0.030))
            rp = [(_surf(245 + da, zk, off), rr) for da, off, rr in arc]
            objs.append(tube(rp, f"{pfx}wulst{k}", M["SKIN"]))
    elif grooves == "lines4":
        # v09-L2: KOMPLETT buendig versenkte Kapseln — nur die dunkle
        # Furchenlinie tritt aus (~0.001 proud), 4 Linien
        _base = M["SKIN"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
        _dark = mat(f"{pfx}rille_mat", (_base[0] * 0.75, _base[1] * 0.75,
                                        _base[2] * 0.75), rough=0.95)
        for k, zk in enumerate((0.075, 0.028, -0.019, -0.066)):
            arc = ((-36, -0.016, 0.009), (-18, -0.011, 0.011), (0, -0.010, 0.011),
                   (18, -0.011, 0.011), (36, -0.016, 0.009))
            rp = [(_surf(245 + da, zk, off), rr) for da, off, rr in arc]
            objs.append(tube(rp, f"{pfx}rille{k}", _dark))
    elif grooves == "bulges4":
        # v09-W4: vier leicht kleinere Wuelste (r max 0.033, Mitte ~0.013
        # proud) — alle vier passen in die Vorderseite, Kontur ruhig wellig
        for k, zk in enumerate((0.075, 0.026, -0.023, -0.072)):
            arc = ((-34, -0.030, 0.025), (-16, -0.022, 0.031), (0, -0.020, 0.033),
                   (16, -0.022, 0.031), (34, -0.030, 0.025))
            rp = [(_surf(245 + da, zk, off), rr) for da, off, rr in arc]
            objs.append(tube(rp, f"{pfx}wulst{k}", M["SKIN"]))
    elif grooves == "cuts":
        # v09-K: ECHTE Kerben — Kapsel-Cutter (zu Mesh konvertiert) per
        # Boolean-DIFFERENCE aus der Blob-Vorderseite geschnitten, danach
        # shade_smooth als weiche Kantenglaettung. Auftretende Shading-
        # Artefakte werden im Abnahme-Bericht GEZEIGT, nicht versteckt.
        blob = objs[0]
        for k, zk in enumerate((0.075, 0.028, -0.019, -0.066)):
            arc = ((-36, -0.012, 0.009), (-18, 0.004, 0.011), (0, 0.005, 0.011),
                   (18, 0.004, 0.011), (36, -0.012, 0.009))
            rp = [(_surf(245 + da, zk, off), rr) for da, off, rr in arc]
            cut = tube(rp, f"{pfx}kerbe_cut{k}", M["SKIN"])
            bpy.ops.object.select_all(action='DESELECT')
            cut.select_set(True)
            bpy.context.view_layer.objects.active = cut
            bpy.ops.object.convert(target='MESH')
            cut = bpy.context.active_object
            md = blob.modifiers.new(f"kerbe{k}", 'BOOLEAN')
            md.operation = 'DIFFERENCE'; md.object = cut; md.solver = 'EXACT'
            bpy.context.view_layer.objects.active = blob
            bpy.ops.object.modifier_apply(modifier=md.name)
            bpy.data.objects.remove(cut, do_unlink=True)
        bpy.ops.object.select_all(action='DESELECT')
        blob.select_set(True)
        bpy.context.view_layer.objects.active = blob
        bpy.ops.object.shade_smooth()
    if thumb:
        # Daumen-Kapsel TANGENTIAL (90 Grad gekippt): folgt der Flaeche
        # diagonal ueber die obere Fausthaelfte, halb versenkt, beide Enden
        # tauchen in den Blob — kein Kappen-Ende zeigt nach aussen.
        tp = [(_surf(16, 0.010, -0.015), 0.034),
              (_surf(36, 0.052, +0.010), 0.042),
              (_surf(56, 0.094, -0.015), 0.032)]
        objs.append(tube(tp, f"{pfx}daumenhuegel", M["SKIN"]))
    return objs


def build_grip_unit(M, pfx="", staff_r=0.047, staff_len=0.46, thumb=False,
                    grooves="bulges4"):
    """VERBUND-Bauteil Faust + Stabsegment (Nutzer 2026-07-14): das Holz-
    Stabsegment (Radius = Bogenholz im Griffbereich) laeuft MITTIG durch das
    Faustvolumen entlang der lokalen z-Achse und tritt oben und unten sichtbar
    aus. Der Verbund wird in den Posen nur als GANZES platziert; der BOGEN
    richtet sich an der Achse dieses Stabsegments aus, nicht umgekehrt.
    GRIFF-CLEARANCE entfaellt fuer dieses Bauteil konstruktiv — der Stab darf
    und soll im Faustvolumen stecken. HAND-CHIRALITAET gilt weiter."""
    objs = build_grip_fist(M, pfx=pfx, thumb=thumb, grooves=grooves)
    objs.append(rod((0, 0, -staff_len / 2), (0, 0, staff_len / 2), staff_r,
                    M["WOOD"], f"{pfx}griffstab", verts=16))
    return objs


def build_forearm(M, pfx=""):
    """Nur fuer die Hand-Abnahme-Renders: Unterarm-Stumpf."""
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=WR, radius2=0.19,
                                    depth=0.68, location=(0, -0.10, -0.36))
    o = bpy.context.active_object; o.name = f"{pfx}unterarm"
    bpy.ops.object.shade_smooth(); o.data.materials.append(M["SKIN"])
    return [o]


# === KOERPER (Cartoon-Grundform, 2026-07-11) ==================================
# Grundsatz-Pivot: Rumpf/Arme/Beine werden NICHT mehr aus MakeHuman abgeleitet,
# sondern als einfache glatte Grundformen gebaut (wie Kopf/Haende). Neutrale,
# kerzengerade Standpose AB WERK — keine Armature, keine Rest-Vorbeuge.
# Masseinheiten = gleiche wie Kopf/Haende (Kopf ~1.0 hoch), damit alles zusammenpasst.
def _steffen_eval(profile):
    """Monotone kubische Interpolation (Steffen 1990) als Funktion f(z).
    Glatt UND ueberschwingfrei — Basis aller ruhigen Profil-Flaechen."""
    zs = [p[0] for p in profile]
    rs = [p[1] for p in profile]
    n = len(profile)
    h = [zs[i + 1] - zs[i] for i in range(n - 1)]
    d = [(rs[i + 1] - rs[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0                       # Extremum am Anker -> flach
        else:
            p_ = (d[i - 1] * h[i] + d[i] * h[i - 1]) / (h[i - 1] + h[i])
            m[i] = math.copysign(min(abs(d[i - 1]), abs(d[i]), 0.5 * abs(p_)), d[i - 1])

    def ev(z):
        z = min(max(z, zs[0]), zs[-1])
        i = max(0, min(n - 2, next((j for j in range(n - 1) if z <= zs[j + 1]), n - 2)))
        t = (z - zs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return (rs[i] * (2 * t3 - 3 * t2 + 1) + h[i] * m[i] * (t3 - 2 * t2 + t)
                + rs[i + 1] * (-2 * t3 + 3 * t2) + h[i] * m[i + 1] * (t3 - t2))
    return ev


def lathe(name, profile, material, yscale=1.0, segs=48, steps=12,
          front=None, back=None):
    """Profil-Koerper. profile = [(z, r), ...] unten->oben = SEITEN-Silhouette (x).
    Optional front/back = eigene TIEFEN-Profile [(z, tiefe), ...] fuer die vordere/
    hintere Flaeche (z.B. gerade Bauchlinie vorne, runder Ruecken hinten); ohne sie
    ist der Koerper eine Rotationsflaeche mit Tiefe r*yscale. Azimutal weich
    geblendet (smoothstep) -> keine Falz-Linien. tube()-AUTO-Handles beulten
    keilfoermig aus, Kosinus-Blend gab Wulst-Baender — daher Steffen."""
    evr = _steffen_eval(profile)
    evf = _steffen_eval(front) if front else None
    evb = _steffen_eval(back) if back else None
    zs_ = [p[0] for p in profile]
    samples = []
    nseg = len(profile) - 1
    for i in range(nseg):
        for k in range(max(2, steps)):
            t = k / max(2, steps)
            z = zs_[i] + (zs_[i + 1] - zs_[i]) * t
            samples.append(z)
    samples.append(zs_[-1])
    bm = bmesh.new()
    rings = []
    for z in samples:
        r = max(0.005, evr(z))
        F = max(0.005, evf(z)) if evf else r * yscale
        B = max(0.005, evb(z)) if evb else r * yscale
        ring = []
        for s in range(segs):
            a = 2 * math.pi * s / segs
            sa, ca = math.sin(a), math.cos(a)
            u = (sa + 1) / 2
            u = u * u * (3 - 2 * u)               # smoothstep: Ruecken -> Front
            depth = B + (F - B) * u
            ring.append(bm.verts.new((r * ca, sa * depth, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for s in range(segs):
            bm.faces.new((a[s], a[(s + 1) % segs], b[(s + 1) % segs], b[s]))
    for ring, zoff in ((rings[0], -0.02), (rings[-1], +0.02)):   # runde Pol-Kappen
        c = bm.verts.new((0, 0, ring[0].co.z + zoff))
        for s in range(segs):
            if zoff < 0:
                bm.faces.new((ring[(s + 1) % segs], ring[s], c))
            else:
                bm.faces.new((ring[s], ring[(s + 1) % segs], c))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    o.data.materials.append(material)
    return o

BODY_NECK_Z = 1.58        # Halsansatz — der Cartoon-Kopf sitzt hier auf
BODY_SHOULDER_Z = 1.36
BODY_HIP_Z = 0.80
BODY_ANKLE_Z = 0.13
BODY_STANCE_X = 0.19      # halbe Standbreite (Beinmitte) -> paralleler Stand
BODY_WRIST = {"R": Vector((0.42, 0.0, 0.56)),     # Ansatzpunkte fuer die Haende
              "L": Vector((-0.42, 0.0, 0.56))}    # (haengend, y=0 = Koerpermitte im Profil)
# Rumpf-Profile (Seiten-Silhouette + Tiefe vorne/hinten) — auch fuer Kleidung/
# Kragen, die der Koerperoberflaeche folgen muessen.
TORSO_PROFILE = [(0.64, 0.14), (0.72, 0.26), (0.84, 0.36), (1.00, 0.41),
                 (1.20, 0.415), (1.36, 0.345), (1.50, 0.235), (1.58, 0.12)]
TORSO_FRONT = [(0.64, 0.10), (0.72, 0.19), (0.90, 0.239), (1.06, 0.282),
               (1.22, 0.325), (1.36, 0.27), (1.50, 0.185), (1.58, 0.095)]
TORSO_BACK = [(0.64, 0.115), (0.72, 0.21), (0.84, 0.30), (1.00, 0.34),
              (1.20, 0.345), (1.36, 0.28), (1.50, 0.19), (1.58, 0.10)]


def build_body(M, with_neck=True, wrist_z=None, wrist_x=None, with_feet=True,
               straight_arms=(), arm_override=None, leg_override=None):
    """Nackter Cartoon-Koerper: Rumpf (gerade Bauchlinie) + 2 senkrechte Arme +
    2 senkrechte Beine, gerade Standpose. Gibt (objs, anchors) zurueck.
    wrist_z/wrist_x: Arm-Ende versetzen, wenn eine echte Hand angesetzt wird
    (kuerzerer Chibi-Arm, Hand endet auf Guertelhoehe — Korrektur 2026-07-11).
    with_feet=False: Platzhalter-Fuesse weglassen (die Stiefel ersetzen sie)."""
    objs = []
    SKIN = M["SKIN"]
    # --- RUMPF: exakter Rotationskoerper (lathe) — ruhiges, symmetrisches Profil.
    # Vorne/hinten identisch gewoelbt (Rotationsflaeche), unten laeuft die Kante
    # gleichmaessig auf Bein-Tiefe zu -> kein vorstehender Becken-Wulst.
    # Silhouette + getrennte Tiefen-Profile: VORNE exakt gerade Bauchlinie
    # (Anker kollinear -> Steffen = Gerade), HINTEN rund. Konstanten oben.
    torso = lathe("rumpf", TORSO_PROFILE, SKIN, yscale=0.82,
                  front=TORSO_FRONT, back=TORSO_BACK)
    objs.append(torso)
    if with_neck:
        objs.append(rod((0, 0, BODY_NECK_Z - 0.08), (0, 0, BODY_NECK_Z + 0.10),
                        0.165, SKIN, "hals", verts=24))
    # --- ARME: haengen STRIKT senkrecht seitlich am Rumpf. Dicke NAHEZU KONSTANT:
    # eine starke Verjuengung laesst die Silhouetten-Kanten schraeg zulaufen und
    # die kontrastreiche Hinterkante liest sich dann als Vorne-Neigung (v05).
    anchors = {"wrist": {}, "shoulder": {}, "hip": {}, "ankle": {}}
    for side, sx in (("R", 1), ("L", -1)):
        sh = Vector((sx * 0.37, 0.0, BODY_SHOULDER_Z))
        wr = Vector(BODY_WRIST[side])
        if wrist_z is not None:
            wr.z = wrist_z
        if wrist_x is not None:
            wx = wrist_x[side] if isinstance(wrist_x, dict) else wrist_x
            wr.x = sx * wx
        if arm_override and side in arm_override:
            # Kompletter Punkte-Zug vom Aufrufer (Nutzer 2026-07-14, Bogenarm):
            # EIN durchgehendes tube-Mesh Schulter -> Handgelenk -> Hand-Ansatz
            # mit stetigem Radius — wie die Finger, keine gestapelten Kapseln.
            arm_pts = [(Vector(p), r) for p, r in arm_override[side]]
        elif wrist_z is not None and side in straight_arms:
            # GERADER Arm (Nutzer 2026-07-14, Bogenarm): Ellenbogen liegt AUF
            # der Schulter->Handgelenk-Geraden -> kein seitlicher Versatz
            # zwischen Ober- und Unterarm, die Hand setzt die Linie fort.
            _ez = (BODY_SHOULDER_Z + wr.z) / 2 - 0.02
            elb = sh.lerp(wr, (sh.z - _ez) / (sh.z - wr.z))
            arm_pts = [(sh, 0.114), (sh.lerp(elb, 0.5), 0.112), (elb, 0.110),
                       (elb.lerp(wr, 0.5), 0.107), (wr, 0.104)]
        elif wrist_z is not None:
            # kurzer Arm: Ellenbogen DIREKT ueber dem Handgelenk -> Unterarm
            # senkrecht, Hand liegt gerade in seiner Verlaengerung (kein Knick
            # am Handgelenk; Oberarm uebernimmt die A-Pose-Schraege)
            elb = Vector((wr.x, 0.0, (BODY_SHOULDER_Z + wr.z) / 2 - 0.02))
            arm_pts = [(sh, 0.114), (sh.lerp(elb, 0.5), 0.112), (elb, 0.110),
                       (elb.lerp(wr, 0.5), 0.107), (wr, 0.104)]
        else:
            elb = Vector((sx * 0.40, 0.0, 1.00))
            arm_pts = [(sh, 0.114), (sh.lerp(elb, 0.5), 0.112), (elb, 0.110),
                       (elb.lerp(wr, 0.5), 0.107), (wr, 0.104)]
        add_round_tip(arm_pts)                         # weiche Handgelenk-Kuppe
        objs.append(tube(arm_pts, f"arm_{side}", SKIN, bevres=14))
        objs.append(sphere(f"schulter_{side}", sh, 0.128, SKIN))  # runde Schulter
        anchors["wrist"][side] = wr
        anchors["shoulder"][side] = sh
    # --- BEINE: strikt senkrecht (y=0), parallel, Ansatz IM Rumpf -------------
    for side, sx in (("R", 1), ("L", -1)):
        hp = Vector((sx * BODY_STANCE_X, 0.0, 0.82))
        kn = Vector((sx * BODY_STANCE_X, 0.0, 0.44))
        an = Vector((sx * BODY_STANCE_X, 0.0, BODY_ANKLE_Z))
        if leg_override and side in leg_override:
            # Posen (z. B. Schrittstellung): kompletter Punkte-Zug vom Aufrufer
            leg_pts = [(Vector(p), r) for p, r in leg_override[side]]
            an = Vector(leg_pts[-1][0])
        else:
            leg_pts = [(hp, 0.165), (hp.lerp(kn, 0.5), 0.145), (kn, 0.135),
                       (kn.lerp(an, 0.5), 0.120), (an, 0.106)]
        objs.append(tube(leg_pts, f"bein_{side}", SKIN, bevres=16))
        if with_feet:
            # einfacher Platzhalter-Fuss (der Stiefel ersetzt ihn)
            objs.append(sphere(f"fuss_{side}", (sx * BODY_STANCE_X, 0.08, 0.06), 0.13,
                               SKIN, scale=(1.0, 1.7, 0.62)))
        anchors["hip"][side] = hp
        anchors["ankle"][side] = an
    return objs, anchors


# === OUTFIT (Tunika + Guertel + Rock + Stiefel, ART_STYLE 70/20/10) ===========
def _surf_r(evr, evF, evB, u, z):
    """Abstand Koerperoberflaeche in Richtung u (Azimut) auf Hoehe z."""
    cu_, su_ = math.cos(u), math.sin(u)
    rx = max(evr(z), 1e-3)
    D = max(evF(z) if su_ >= 0 else evB(z), 1e-3)
    return 1.0 / math.sqrt((cu_ / rx) ** 2 + (su_ / D) ** 2)


def _band(name, mat_, z_rows, r_of, nu=56, solid=0.018):
    """Rundum-Flaeche: Reihen von z_rows, Radius je (u, z) aus r_of(u, z)."""
    bm = bmesh.new()
    grid = []
    for z in z_rows:
        ring = []
        for iu in range(nu):
            u = 2 * math.pi * iu / nu
            r = r_of(u, z)
            ring.append(bm.verts.new((r * math.cos(u), r * math.sin(u), z)))
        grid.append(ring)
    for a, b in zip(grid, grid[1:]):
        for iu in range(nu):
            bm.faces.new((a[iu], b[iu], b[(iu + 1) % nu], a[(iu + 1) % nu]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    o.data.materials.append(mat_)
    sol = o.modifiers.new("s", 'SOLIDIFY'); sol.thickness = solid; sol.offset = 0
    return o


def build_outfit(M, sleeve_to=None, boot_shift=None):
    """Kleidung fuer die montierte Figur (Koerper-Koordinaten), ART_STYLE 2.2:
    70 % Koenigsblau (Tunika+Aermel+Rock, mit Kapuze/Kragen), 20 % Leder
    (Guertel+Stiefel), 10 % Gold (Schnalle, mit Feder). Haut nur an Gesicht,
    Unterarmen, Haenden und einem Oberschenkel-Streifen."""
    objs = []
    evr = _steffen_eval(TORSO_PROFILE)
    evF = _steffen_eval(TORSO_FRONT)
    evB = _steffen_eval(TORSO_BACK)

    # --- TUNIKA: liegt eng auf dem Rumpf (dominante Blau-Flaeche) --------------
    n = 16
    rows = [1.44 - (1.44 - 0.80) * i / (n - 1) for i in range(n)]
    objs.append(_band("tunika", M["BLUE"], rows,
                      lambda u, z: _surf_r(evr, evF, evB, u, z) + 0.022))

    # --- ROCK: ab Huefte ausgestellt, endet ueber dem Knie (dunkleres Blau).
    # Flare 0.08: mehr versinken die Haende seitlich bzw. der Saum frisst die
    # innen laufende Bogensehne.
    def rock_r(u, z):
        t = (0.82 - z) / 0.28
        return _surf_r(evr, evF, evB, u, 0.82) + 0.026 + 0.08 * t

    nrock = 10
    rock_rows = [0.82 - 0.28 * i / (nrock - 1) for i in range(nrock)]
    objs.append(_band("rock", M["BLUE_D"], rock_rows, rock_r))

    # --- GUERTEL: Lederband auf der Tunika + Goldschnalle vorne ----------------
    nbelt = 4
    belt_rows = [0.795 + 0.085 * i / (nbelt - 1) for i in range(nbelt)]
    objs.append(_band("guertel", M["LEATH"], belt_rows,
                      lambda u, z: _surf_r(evr, evF, evB, u, z) + 0.052, solid=0.014))
    by = evF(0.84) + 0.085
    objs.append(obox_simple("schnalle", (0, by, 0.838), (0.095, 0.03, 0.115), M["GOLD"]))

    # --- KURZE AERMEL: blaue Kappen ueber Schulter + Oberarm -------------------
    for side, sx in (("R", 1), ("L", -1)):
        sh = Vector((sx * 0.37, 0.0, BODY_SHOULDER_Z))
        elb = Vector((sx * 0.40, 0.0, 1.00))
        if sleeve_to and side in sleeve_to:
            # Aermel folgt der ECHTEN Armachse (Nutzer 2026-07-14): sonst tritt
            # ein schraeger Arm seitlich aus der Aermelroehre aus (Stufe).
            elb = Vector(sleeve_to[side])
        objs.append(sphere(f"aermel_kappe_{side}", sh, 0.142, M["BLUE"]))
        a1 = sh.lerp(elb, 0.18)
        a2 = sh.lerp(elb, 0.62)
        objs.append(rod(a1, a2, 0.128, M["BLUE"], f"aermel_{side}", verts=22))

    # --- STIEFEL (abgenommene Form): Schaft+Fuss gleich breit, flache Sohle.
    # Schaft-Radius MUSS > Bein-Radius auf Schafthoehe sein (Bein ~0.125 bei
    # z=0.30), sonst drueckt die Haut als Zacken-Ring durch die Schaftwand.
    RB = 0.138
    for side, sx in (("R", 1), ("L", -1)):
        cx = sx * BODY_STANCE_X
        dy = (boot_shift or {}).get(side, 0.0)   # Posen: Schrittstellung (y)
        objs.append(rod((cx, dy, 0.055), (cx, dy, 0.30), RB, M["LEATH"],
                        f"stiefel_schaft_{side}", verts=20))
        objs.append(sphere(f"stiefel_fuss_{side}", (cx, dy + 0.095, 0.075), RB,
                           M["LEATH"], scale=(1.02, 1.55, 0.76)))
        objs.append(sphere(f"stiefel_sohle_{side}", (cx, dy + 0.10, 0.032), RB,
                           M["LEATH_D"], scale=(1.12, 1.66, 0.28)))
    return objs


def obox_simple(name, center, size, material):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    o = bpy.context.active_object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.location = Vector(center)
    o.data.materials.append(material)
    return o


# === MONTAGE-HELFER ============================================================
def orient_matrix(z_world, palm_world, mirror=False):
    """3x3-Basis fuer die Montage einer Hand.
      z_world    Welt-Richtung der lokalen +z-Achse (Handgelenk -> Knoechel)
      palm_world Welt-Richtung der lokalen +y-Achse (Handflaeche/Fingerkuppen)
      mirror     True fuer die linke Hand (spiegelt die lokale x-Achse)
    """
    from mathutils import Matrix
    zw = Vector(z_world).normalized()
    yw = Vector(palm_world)
    yw = (yw - zw * yw.dot(zw)).normalized()
    xw = yw.cross(zw)
    if mirror:
        xw = -xw
    return Matrix((xw, yw, zw)).transposed()


def place(objs, matrix):
    """Wendet eine Weltmatrix auf alle Objekte an (Bauteile stehen im Ursprung)."""
    for o in objs:
        o.matrix_world = matrix @ o.matrix_world
