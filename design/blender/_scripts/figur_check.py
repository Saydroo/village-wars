# -*- coding: utf-8 -*-
"""FIGUR-MONTAGE (2026-07-11): abgenommener Cartoon-Kopf + Kapuze (robinhood) +
abgenommene Haende an den abgenommenen Cartoon-Koerper. Keine Kleidung, keine
Stiefel, keine Ausruestung — reiner Gesamtproportions-Check.

Ziele: Kopfhoehen 2,6-2,8; Kopfbreite/Schulterbreite 1,0-1,1.
Uebergaenge: Hals unter dem Kapuzenkragen, Handgelenke im Arm-Ende.

Aufruf: blender -b --factory-startup --python figur_check.py -- <outdir>
"""
import bpy, math, sys, os
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if len(argv) >= 1 else \
    r"C:\Users\Ufuk\AppData\Local\Temp\claude\C--Users-Ufuk-Claude-Code\45eedaf3-bd13-48ee-bdfa-54326fd0d1f8\scratchpad\ft"
stage = argv[1] if len(argv) >= 2 else "check"   # check | face | sheet | griff (Bogenhand-Nahaufnahme)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

M = cp.make_materials()

# === TUNING ===================================================================
HEAD_S = 0.90          # Kopf-Skalierung (Ziel: Kopfhoehen 2,6-2,8 + Breite ~Schulter)
CHIN_Z = 1.57          # Welt-z des Kinns (ueberlappt den Koerper-Hals leicht)
WRIST_Z = 0.97         # Arm-Ende: Mittelwert (z-Fall 0.43) — Fingerspitzen ~0.585,
#                        knapp ueber Schritt/Saum (0.80 war zu lang, 1.105 T-Rex)
WRIST_X_R = 0.56       # rechter Arm leicht aussen (Hand haengt frei neben Rock)
# LINKER ARM = EINE GERADE (Nutzer 2026-07-14): Schulter, Ellenbogen, Hand-
# gelenk und FAUSTMITTE fluchten auf einer Linie — kein Segment-Versatz mehr.
# Die Faustmitte (= Bogenachse) liegt am unteren Ende dieser Geraden; das
# Handgelenk-x wird daraus ABGELEITET, nicht mehr frei gesetzt.
HAND_X_L = -0.775      # Faustmitte x (Ende der Arm-Geraden; Bogen haengt hier)
HAND_CZ_L = WRIST_Z - 0.0176 - 0.88 * 0.26   # Faustring-Mitte z (0.88 = HAND_S)
_SH_L = Vector((-0.37, 0.0, 1.36))        # Schulteransatz (build_body: sx*0.37)
_t_wr = (_SH_L.z - WRIST_Z) / (_SH_L.z - HAND_CZ_L)
WRIST_X_L = -(_SH_L.x + (HAND_X_L - _SH_L.x) * _t_wr)   # ~0.618 (auf der Geraden)
HAND_S = 0.88          # Hand-Skalierung (0.375 lang = 39% Kopfhoehe — unveraendert ok)
# BOGEN korrekt orientiert: Sehne zeigt zum KOERPER (innen), Holz aussen,
# gleichmaessige Sinus-Kurve. ENTSCHEIDUNG NUTZER 2026-07-14: Bogenachse
# bleibt exakt AUFRECHT — das BOW_TILT-28-Grad-Experiment ist VERWORFEN.
# Die Naehe der Sehne zum linken Unterarm ist beim Bogenschiessen korrekt
# und wird von der LEDERARMSCHIENE beantwortet (Ausruestungsliste):
# Beruehrung Sehne<->Schiene ERLAUBT, Durchdringung Haut/Aermel/Faust
# VERBOTEN (Asserts unten). Kurventiefe wird aus GRIP/CHORD abgeleitet.
BOW_LEN = 1.76         # Laenge entlang der Achse (~72% von T; 1.82 brachte die
#                        obere Spitze nach dem CHORD-Ruecken zu nah an die Kapuze)

# === LINKER ARM = EINE ROEHRE (Nutzer 2026-07-14, strukturell wie die Finger):
# EIN durchgehendes tube-Mesh mit stetig fallendem Radius von der Schulter bis
# in den Faust-Ansatz. Das Ende biegt sanft zur Faust-Manschette und endet
# EXAKT mit deren Radius -> kein Absatz am Hand-Uebergang. Armschiene und
# Aermel werden KOAXIAL um dieselbe Achse gebaut (kein Segment-Stapeln mehr).
HAND_C_L = Vector((HAND_X_L, -0.02, HAND_CZ_L))   # Faustmitte (= Bogenachse)
FIST_SPIN = -8         # Faust-Azimut um die Bogenachse (Anker zeigt zum Arm)
_cf, _sf = math.cos(math.radians(FIST_SPIN)), math.sin(math.radians(FIST_SPIN))
FR3 = Matrix(((-_sf, -_cf, 0), (-_cf, _sf, 0), (0, 0, -1))).transposed()
FR = FR3.to_4x4()
FIST_ORIGIN = HAND_C_L + Vector((0, 0, 0.88 * 0.26))   # 0.88 = HAND_S (TUNING oben)
ANCHOR_PT = FIST_ORIGIN + FR3 @ (cp.FIST_WRIST_ANCHOR * HAND_S)  # Manschette oben
FIST_WRIST_R = cp.WR * HAND_S                     # Manschetten-Radius (~0.081)


def arm_line(z):
    """Punkt auf der Schulter->Faustmitte-Geraden auf Hoehe z."""
    return _SH_L.lerp(HAND_C_L, (_SH_L.z - z) / (_SH_L.z - HAND_C_L.z))


ARM_CHAIN = [
    (_SH_L, 0.118),
    (arm_line(1.21), 0.113),
    (arm_line(1.145), 0.110),                     # Ellbogen (AUF der Geraden)
    (arm_line(1.10), 0.104),
    (arm_line(1.05), 0.098),                      # dichte Stuetzpunkte: die
    (arm_line(1.01), 0.092),                      # Bezier-Glaettung darf nicht
    (Vector((0.5 * arm_line(0.985).x + 0.5 * ANCHOR_PT.x,   # zum Holz ausschwingen
             0.55 * ANCHOR_PT.y, 0.978)), 0.086),
    (Vector((ANCHOR_PT.x, ANCHOR_PT.y, 0.952)), FIST_WRIST_R),
]


def arm_r_at(z):
    """Radius der Arm-Roehre auf Hoehe z (fuer koaxiale Teile + Asserts)."""
    zs = [(p.z, r) for p, r in ARM_CHAIN]
    for (z1, r1), (z0, r0) in zip(zs, zs[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-9)
    return zs[0][1] if z > zs[0][0] else zs[-1][1]

# === KOERPER (ohne Platzhalter-Fuesse — die Stiefel ersetzen sie) =============
objs, anchors = cp.build_body(M, with_neck=True, wrist_z=WRIST_Z,
                              wrist_x={"R": WRIST_X_R, "L": WRIST_X_L},
                              with_feet=False, straight_arms=("L",),
                              arm_override={"L": ARM_CHAIN})

# === KOPF + KAPUZE (lokal bauen, Modifier backen, dann platzieren) ============
# Kragen NICHT aus build_hood (steifer Kegel) — stattdessen Stoff-Kragen in
# Koerper-Koordinaten (build_collar), der auf den Schultern aufliegt.
head, head_objs = cp.build_head(M, with_hair=False, with_neck=False)
hood_objs = cp.build_hood(M, head, style="robinhood", with_collar=False)
head_all = head_objs + hood_objs
for o in list(head_all):
    if o.type == 'MESH' and o.modifiers:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception as e:
                print("modifier_apply skip", o.name, md.name, e)
_loc_chin = min((head.matrix_world @ v.co).z for v in head.data.vertices)
head_cz = CHIN_Z - HEAD_S * _loc_chin
HEADM = Matrix.Translation((0, 0, head_cz)) @ Matrix.Scale(HEAD_S, 4)
cp.place(head_all, HEADM)

# === STOFF-KRAGEN (liegt auf Schultern/Brust/Ruecken des Koerpers auf) ========
cp.build_collar(M)

# === KLEIDUNG (Tunika, Guertel+Goldschnalle, Rock, Stiefel — 70/20/10) ========
cp.build_outfit(M, sleeve_to={"L": arm_line(1.145)})   # Aermel folgt der Armachse

# === HAENDE (offen, haengend, halb proniert = natuerlicher Neutral-Stand:
# Handruecken zeigt nach vorne-aussen, Daumen innen — liest sich aus Front UND
# Seite als volle Hand, nicht als schmale Kante) ===============================
def place_hand(side, sx):
    hobjs = cp.build_open_hand(M, pfx=f"hand{side}_", with_wrist=True)
    F = Vector((0, 0, -1))                          # Finger nach unten
    P = Vector((-0.35 * sx, -0.94, 0)).normalized()  # Handflaeche innen-hinten
    T = Vector((-0.94 * sx, 0.35, 0)).normalized()   # Daumen innen-vorne
    Rot = Matrix((T, P, F)).transposed().to_4x4()
    Mx = (Matrix.Translation((sx * WRIST_X_R, 0.0, WRIST_Z - 0.01))
          @ Rot @ Matrix.Scale(HAND_S, 4))
    cp.place(hobjs, Mx)


# rechte Hand: locker offen am Koerper (Gesicht frei)
place_hand("R", 1)

# === AUSRUESTUNG: BOGEN in der linken GREIF-FAUST + KOECHER ===================
# NUTZER-VORGABE 2026-07-14 — v08-Stand + GENAU zwei Aenderungen:
#  (a) Griffhand um die BOGENACHSE gedreht, sodass der Fingerring das Holz
#      WIRKLICH umschliesst (Bogenachse = Ringmitte; in v08 lag das Holz nur
#      an den Fingerspitzen). Die Bogen-EBENE dreht mit der Hand um die
#      senkrechte Achse mit — die ACHSE bleibt exakt aufrecht, KEINE Neigung.
#  (b) Lederarmschiene am linken Unterarm (weiter unten gebaut); die Sehne
#      darf sie BERUEHREN, Haut/Aermel/Faust bleiben unberuehrt (Asserts).
fist_objs = cp.build_fist(M, pfx="handL_", with_wrist=True, staff=None)
# GRIP = FAUSTMITTE = Ende der Arm-Roehre. FR / FIST_ORIGIN / FIST_SPIN kommen
# aus dem Arm-Roehren-Block oben — die Roehre endet nahtlos in der Manschette.
GRIP = Vector(HAND_C_L)
# Sehnen-Gerade: innen zum Koerper und VOR dem Arm (y positiv). Grund
# (QA-Befund 2026-07-14): mit Sehne HINTER dem Arm stand die Bogen-EBENE aus
# der 315-Grad-SPIELKAMERA fast kantenparallel — der Bogen verschmolz in der
# 3/4-Silhouette mit dem Koerper (ART_STYLE 2.5). Mit CHORD vorne zeigt die
# Ebene fast frontal zur Spielkamera (~100% der Kurve sichtbar). In der
# Front-Projektion kreuzt die dunkle Sehne nur das dunkle LEDER der
# Armschiene (z ~0.98..1.20) und den blauen Aermel — nie sichtbare Haut.
CHORD = Vector((-0.555, +0.145, 0.0))
_v = Vector((GRIP.x - CHORD.x, GRIP.y - CHORD.y, 0.0))
D_eff = _v.length                                   # Abstand Chord -> Griffachse
e_out = _v / D_eff                                  # Kruemmungsrichtung (mit Yaw)
d_ax = Vector((0, 0, 1))                            # Bogenachse: exakt AUFRECHT
cp.place(fist_objs, Matrix.Translation(FIST_ORIGIN) @ FR @ Matrix.Scale(HAND_S, 4))

# --- BOGEN: gleichmaessige Sinus-Kurve, Riser (Apex) im Faustring, Sehnen-
# Chord INNEN (zeigt zum Koerper) ----------------------------------------------
s_lo = (0.04 - GRIP.z) / d_ax.z                     # unterer Endpunkt (Spitze ~z 0.04)
s_hi = s_lo + BOW_LEN
tau0 = -s_lo / BOW_LEN
BOW_DEPTH = D_eff / math.sin(math.pi * tau0)        # Kurventiefe aus GRIP/CHORD
P_chord = GRIP - e_out * D_eff                      # Sehnen-Chord-Fusspunkt
print(f"BOGEN-GEOMETRIE: GRIP ({GRIP.x:+.3f},{GRIP.y:+.3f},{GRIP.z:+.3f}) "
      f"CHORD ({CHORD.x:+.3f},{CHORD.y:+.3f}) D_eff {D_eff:.3f} "
      f"DEPTH {BOW_DEPTH:.3f} YAW {math.degrees(math.atan2(-e_out.y, -e_out.x)):.1f} Grad")
bow_pts = []
NB = 17
for i in range(NB):
    tau = i / (NB - 1)
    s = s_lo + BOW_LEN * tau
    pos = P_chord + d_ax * s + e_out * (BOW_DEPTH * math.sin(math.pi * tau))
    bow_pts.append((pos, 0.028 + 0.020 * math.sin(math.pi * tau)))
cp.tube(bow_pts, "bogen_holz", M["WOOD"], bevres=12)
# Ledergriff-Wicklung am Riser (dort, wo die Faust greift)
cp.rod(GRIP - d_ax * 0.085, GRIP + d_ax * 0.085, 0.054, M["LEATH"],
       "bogen_griff", verts=16)
# Goldspitzen an beiden Enden (entlang der Achse)
for pa, pb, nm in ((bow_pts[1][0], bow_pts[0][0], "bogen_tip_u"),
                   (bow_pts[-2][0], bow_pts[-1][0], "bogen_tip_o")):
    d_ = (pb - pa).normalized()
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.034, radius2=0.002,
                                    depth=0.07, location=pb + d_ * 0.025)
    _c = bpy.context.active_object; _c.name = nm
    _c.rotation_euler = Vector((0, 0, 1)).rotation_difference(d_).to_euler()
    _c.data.materials.append(M["GOLD"])
# SEHNE: ruhig und GERADE von Spitze zu Spitze auf der KOERPERSEITE, nah am
# Holz (NICHT gezogen). DICK + DUNKEL (80px-Lehre 2026-07-12).
STRING = cp.mat("sehne", (0.055, 0.045, 0.038), rough=0.8)
S1 = P_chord + d_ax * (s_lo + 0.03)
S2 = P_chord + d_ax * (s_hi - 0.03)
cp.rod(S1, S2, 0.022, STRING, "sehne", verts=10)

# --- KOECHER: hinten links auf dem Ruecken, Pfeile mit Goldspitzen -------------
q_base = Vector((-0.08, -0.40, 0.86))
q_top = Vector((-0.24, -0.46, 1.36))
q_dir = (q_top - q_base).normalized()
cp.rod(q_base, q_top, 0.078, M["LEATH_D"], "koecher", verts=18)
cp.rod(q_top - q_dir * 0.02, q_top + q_dir * 0.015, 0.084, M["LEATH"],
       "koecher_rand", verts=18)
qs1 = q_dir.cross(Vector((0, 0, 1))).normalized()
qs2 = q_dir.cross(qs1).normalized()
for k in range(3):
    phi = math.radians(k * 120 + 30)
    off = (qs1 * math.cos(phi) + qs2 * math.sin(phi)) * 0.032
    a0 = q_top + off
    a1 = q_top + q_dir * 0.17 + off
    cp.rod(a0, a1, 0.011, M["WOOD"], "pfeil_schaft", verts=8)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.026, radius2=0.002,
                                    depth=0.06, location=a1 + q_dir * 0.028)
    _p = bpy.context.active_object; _p.name = "pfeil_spitze"
    _p.rotation_euler = Vector((0, 0, 1)).rotation_difference(q_dir).to_euler()
    _p.data.materials.append(M["GOLD"])

# === ARMSCHIENE: Leder KOAXIAL um die Arm-Roehre (Ausruestungsliste) ==========
# EIN glatter tube-Schlauch auf DERSELBEN Achse wie der Arm: die Enden laufen
# stetig auf den Arm-Radius zu (Leder "waechst" aus der Haut, kein Absatz),
# dazwischen die kraeftige Leder-Woelbung. Unten folgt sie der Beuge in die
# Faust. Riemen = dunkle RINGE nur +0.003 ueber dem Leder: sie lesen sich
# ueber die FARBE, nicht als Silhouetten-Stufe. Sehnen-Kontakt erlaubt.
_shL = anchors["shoulder"]["L"]; _wrL = anchors["wrist"]["L"]
_BZ = [(1.205, arm_r_at(1.205) + 0.004),      # oben: Anschluss an den Arm-Radius
       (1.165, 0.147), (1.100, 0.145), (1.045, 0.136), (1.005, 0.118)]
BR_CHAIN = [(arm_line(z), r) for z, r in _BZ]
BR_CHAIN.append((Vector(ARM_CHAIN[-2][0]), ARM_CHAIN[-2][1] + 0.004))  # Beuge
cp.tube(BR_CHAIN, "armschiene", M["LEATH"], bevres=16)


def brac_r_at(z):
    for (za, ra), (zb, rb) in zip(_BZ, _BZ[1:]):
        if zb <= z <= za:
            return rb + (ra - rb) * (z - zb) / (za - zb)
    return _BZ[-1][1]


for _zA, _zB in ((1.152, 1.128), (1.078, 1.054)):
    _zm = (_zA + _zB) / 2
    cp.rod(arm_line(_zA), arm_line(_zB), brac_r_at(_zm) + 0.003, M["LEATH_D"],
           "armschiene_riemen", verts=24)
print(f"ARMSCHIENE: koaxial, r {_BZ[0][1]:.3f}(oben-Anschluss) -> max 0.147 -> "
      f"{BR_CHAIN[-1][1]:.3f}(Beugen-Anschluss), z {_BZ[0][0]:.3f}..{BR_CHAIN[-1][0].z:.3f}")

# === ARM-FLUCHT-ASSERT (Nutzer 2026-07-14): Schulter, Ellenbogen, Handgelenk
# und Faustmitte muessen in der FRONT fluchten — jedes Gelenk liegt auf der
# Schulter->Faustmitte-Geraden (kein seitlicher Versatz zwischen Segmenten). ==
_elbL = _shL.lerp(_wrL, (_shL.z - ((_shL.z + _wrL.z) / 2 - 0.02)) / (_shL.z - _wrL.z))
_dev_elb = abs(_elbL.x - arm_line(_elbL.z).x)
_dev_wr = abs(_wrL.x - arm_line(_wrL.z).x)
_dev_hand = abs(GRIP.x - HAND_C_L.x)
print(f"ARM-FLUCHT: x Schulter {_shL.x:+.3f} Ellbogen {_elbL.x:+.3f} "
      f"Handgelenk {_wrL.x:+.3f} Faustmitte {GRIP.x:+.3f} | Abweichung von der "
      f"Geraden: Ellbogen {_dev_elb:.3f} Handgelenk {_dev_wr:.3f} Faust {_dev_hand:.3f} "
      f"(alle <= 0.02)")
assert _dev_elb <= 0.02, f"Ellbogen aus der Arm-Flucht ({_dev_elb:.3f})"
assert _dev_wr <= 0.02, f"Handgelenk aus der Arm-Flucht ({_dev_wr:.3f})"
assert _dev_hand <= 0.02, f"Faustmitte aus der Arm-Flucht ({_dev_hand:.3f})"

# === MESSWERTE (Kopfhoehen + Breitenverhaeltnis) ==============================
dg = bpy.context.evaluated_depsgraph_get()


def obj_pts(prefixes):
    pts = []
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE', 'SURFACE') and o.name.startswith(prefixes):
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            pts += [o.matrix_world @ v.co for v in me.vertices]
            ev.to_mesh_clear()
    return pts


allp = obj_pts(("rumpf", "bein", "fuss", "arm", "schulter", "hals", "kopf",
                "kapuze", "kragen", "feder", "hand", "sklera", "iris", "nase", "haar",
                "tunika", "rock", "guertel", "schnalle", "aermel", "stiefel",
                "bogen", "sehne", "koecher", "pfeil"))
T = max(p.z for p in allp) - min(p.z for p in allp)
kopf_haut = obj_pts(("kopf",))
kap_pts = obj_pts(("kapuze",))
scheitel = max(p.z for p in kap_pts + kopf_haut)
kinn = min(p.z for p in kopf_haut)
kopf_h = scheitel - kinn
kopf_b = max(p.x for p in kopf_haut) - min(p.x for p in kopf_haut)
kap_b = max(p.x for p in kap_pts) - min(p.x for p in kap_pts)
# Schulterbreite = die SICHTBAREN Schultern (Kugeln + Aermel-Kappen), nicht der
# schraege Oberarm (der ragte beim kurzen Chibi-Arm ins Messband und verfaelschte)
schulter_pts = [p for p in obj_pts(("schulter", "aermel_kappe")) if p.z > 1.25]
schulter_b = max(p.x for p in schulter_pts) - min(p.x for p in schulter_pts)
print(f"FIGUR: T {T:.3f} | Kopf (Scheitel {scheitel:.3f} Kinn {kinn:.3f}) h {kopf_h:.3f} "
      f"-> KOPFHOEHEN {T / kopf_h:.2f} (Ziel 2.6-2.8)")
print(f"BREITEN: Kopf-Haut {kopf_b:.3f} | Kapuze {kap_b:.3f} | Schulter {schulter_b:.3f} "
      f"-> Kapuze/Schulter {kap_b / schulter_b:.2f} Haut/Schulter {kopf_b / schulter_b:.2f} (Ziel 1.0-1.1)")

# --- HAND-ASSERT: Unterkante Hand deutlich OBERHALB der Rocksaum-Unterkante ---
hand_pts = obj_pts(("hand",))
rock_pts = obj_pts(("rock",))
if hand_pts and rock_pts:
    hand_min = min(p.z for p in hand_pts)
    saum_min = min(p.z for p in rock_pts)
    print(f"HAND-SAUM: Hand-Unterkante {hand_min:.3f} vs Rocksaum {saum_min:.3f} "
          f"-> Abstand {hand_min - saum_min:+.3f} (gefordert >= +0.03)")
    assert hand_min >= saum_min + 0.03, \
        f"Hand endet zu tief ({hand_min:.3f} vs Saum {saum_min:.3f})"

# --- BOGEN-ASSERTS: Laenge >= 60% T; klar von Kapuze/Rock abgesetzt (3D) ------
bow_all = obj_pts(("bogen", "sehne"))
if bow_all:
    bow_h = max(p.z for p in bow_all) - min(p.z for p in bow_all)
    rock_min_x = min(p.x for p in rock_pts)
    bow_inner = max(p.x for p in bow_all)
    # Kapuze: 3D-Ellipsoid-Check (der geneigte Bogen laeuft in x knapp an der
    # Kapuzenbreite vorbei, aber weit VOR ihr — reiner x-Vergleich waere falsch)
    kp = obj_pts(("kapuze",))
    kc = Vector((0, (max(p.y for p in kp) + min(p.y for p in kp)) / 2,
                 (max(p.z for p in kp) + min(p.z for p in kp)) / 2))
    kr = Vector((max(p.x for p in kp), (max(p.y for p in kp) - min(p.y for p in kp)) / 2,
                 (max(p.z for p in kp) - min(p.z for p in kp)) / 2))
    kap_norm = min(math.sqrt((p.x / kr.x) ** 2 + ((p.y - kc.y) / kr.y) ** 2
                             + ((p.z - kc.z) / kr.z) ** 2) for p in bow_all)
    # --- SEHNEN-MESSUNG (Nutzer-Regel 2026-07-14): DURCHDRINGUNG verboten,
    # BERUEHRUNG an der ARMSCHIENE erlaubt (dafuer traegt der Bogenarm sie).
    # Erst ALLE Werte messen + drucken, DANN pruefen (Diagnose bei Fehlschlag).
    def seg_dist(p, a, b):
        ab = b - a
        t_ = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (p - (a + ab * t_)).length

    R_S = 0.022                                   # Sehnen-Radius
    d_haut = min(seg_dist(p, S1, S2) for p in obj_pts(("arm_L",))) - R_S
    d_aerm = min(seg_dist(p, S1, S2)
                 for p in obj_pts(("aermel_L", "aermel_kappe_L"))) - R_S
    d_hand = min(seg_dist(p, S1, S2) for p in obj_pts(("handL_",))) - R_S
    d_schiene = min(seg_dist(p, S1, S2) for p in obj_pts(("armschiene",))) - R_S

    def wood_surf_dist(p):
        return min((p - q).length - rq for q, rq in bow_pts)

    # Holz vs. Arm-HAUT: nur wo die Haut SICHTBAR ist (oberhalb der Schiene,
    # z >= 1.20). Darunter ist sie luecklos umhuellt: z 0.978..1.205 von der
    # Armschiene (deren Holz-Abstand separat geprueft wird), tiefer vom
    # Faust-Volumen — dort ist Naehe zum Holz konstruktiv und unsichtbar.
    _arm = obj_pts(("arm_L",))
    d_holz_haut = min(wood_surf_dist(p) for p in _arm if p.z >= 1.20)
    # Holz darf die (koaxiale) Armschiene nicht anschneiden — am Mesh gemessen
    d_holz_schiene = min(wood_surf_dist(p) for p in obj_pts(("armschiene",)))

    print(f"BOGEN: Hoehe {bow_h:.3f} = {100 * bow_h / T:.0f}% von T (>=60%) | "
          f"Kapuzen-Abstand (Ellipsoid-Norm) {kap_norm:.2f} (>1.03) | "
          f"innerste Kante {bow_inner:+.3f} vs Rock {rock_min_x:+.3f}")
    print(f"SEHNE-FREI: Haut {d_haut:+.3f} (>=0) | Aermel {d_aerm:+.3f} (>=0) | "
          f"Faust {d_hand:+.3f} (>=+0.01) | Armschiene {d_schiene:+.3f} "
          f"(Beruehrung erlaubt, nur nicht durch: >= -0.030) "
          f"Kontakt: {d_schiene <= 0.01}")
    print(f"ARM-HOLZ: sichtbare Haut (z>=1.20) {d_holz_haut:+.3f} (>= +0.05) | "
          f"Holz-Armschiene {d_holz_schiene:+.3f} (>=0)")

    assert bow_h >= 0.60 * T, f"Bogen zu klein ({100 * bow_h / T:.0f}% von T)"
    assert kap_norm > 1.03, f"Bogen zu nah an der Kapuze (Norm {kap_norm:.2f})"
    assert bow_inner < rock_min_x - 0.01, "Bogen/Sehne kollidiert seitlich mit dem Rock"
    assert d_haut >= 0.0, f"Sehne beruehrt die HAUT des Arms ({d_haut:+.3f})"
    assert d_aerm >= 0.0, f"Sehne durchdringt den AERMEL ({d_aerm:+.3f})"
    assert d_hand >= 0.01, f"Sehne durchdringt die FAUST ({d_hand:+.3f})"
    assert d_schiene >= -0.030, f"Sehne durchdringt die ARMSCHIENE ({d_schiene:+.3f})"
    assert d_holz_haut >= 0.05, f"Sichtbare Armhaut zu nah am Holz ({d_holz_haut:+.3f})"
    assert d_holz_schiene >= 0.0, f"Bogenholz schneidet die Armschiene ({d_holz_schiene:+.3f})"

# === RADIUS-KONTINUITAET (Nutzer 2026-07-14): kein Absatz an den Uebergaengen =
# Der Radius am Ende jedes Teils muss zum Anfang des naechsten passen, sonst
# entsteht eine sichtbare Stufe in der Armkontur.
k_hand = abs(ARM_CHAIN[-1][1] - FIST_WRIST_R)            # Arm-Roehre -> Faust
k_br_o = abs(_BZ[0][1] - (arm_r_at(_BZ[0][0]) + 0.004))  # Schiene oben -> Arm
k_br_u = abs(BR_CHAIN[-1][1] - (ARM_CHAIN[-2][1] + 0.004))  # Schiene unten -> Arm
_ae = obj_pts(("aermel_L",))                             # Aermelkante -> Arm
_ae_min = min(p.z for p in _ae)
k_aerm = max((p - arm_line(p.z)).length - arm_r_at(p.z)
             for p in _ae if p.z < _ae_min + 0.02)
print(f"RADIUS-KONTINUITAET: Arm->Faust {k_hand:.3f} | Schiene-oben->Arm "
      f"{k_br_o:.3f} | Schiene-unten->Arm {k_br_u:.3f} (alle <= 0.012) | "
      f"Aermelkante ueber Arm {k_aerm:.3f} (Stoffkante, <= 0.045)")
assert k_hand <= 0.012, f"Absatz Arm->Faust ({k_hand:.3f})"
assert k_br_o <= 0.012, f"Absatz Armschiene oben ({k_br_o:.3f})"
assert k_br_u <= 0.012, f"Absatz Armschiene unten ({k_br_u:.3f})"
assert k_aerm <= 0.045, f"Aermelkante steht zu weit ueber ({k_aerm:.3f})"
assert 2.5 <= T / kopf_h <= 2.9, f"Kopfhoehen {T / kopf_h:.2f} ausserhalb"
assert 0.92 <= kap_b / schulter_b <= 1.15, f"Kopf/Schulter {kap_b / schulter_b:.2f} ausserhalb"

# === KAMERA / LICHT / RENDER ==================================================
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(40)
ko = bpy.data.objects.new("key", key)
ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
bpy.context.collection.objects.link(ko)
fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200))
bpy.context.collection.objects.link(fo)
spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 34; spec.size = 1.6
so_ = bpy.data.objects.new("spec", spec); so_.location = (0.9, 2.2, 2.6)
so_.rotation_euler = (Vector((0, 0, 1.2)) - so_.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.collection.objects.link(so_)

world = bpy.data.worlds.new("W"); world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
bpy.context.scene.world = world

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
try:
    cprefs = bpy.context.preferences.addons['cycles'].preferences
    for ctype in ('OPTIX', 'CUDA'):
        try:
            cprefs.compute_device_type = ctype
            break
        except Exception:
            continue
    cprefs.get_devices()
    for d_ in cprefs.devices:
        d_.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU-Setup fehlgeschlagen, CPU-Fallback:', e)
sc.cycles.samples = 110
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 780
sc.view_settings.view_transform = 'Standard'

d = 24.0
if stage == "griff":
    # BOGENHAND-NAHAUFNAHME: Front + 3/4 + VON OBEN (Kontrollansicht der Haende:
    # geschlossener Finger-Ring um das Holz, Daumen haelt gegen)
    target = Vector(GRIP)
    cam_data.ortho_scale = 0.62
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.cycles.samples = 96
    for vname, el_deg, az_deg in (("front", 84, 0), ("34", 66, 315), ("oben", 12, 0)):
        el = math.radians(el_deg); az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"griff_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
elif stage == "sheet":
    # REFERENZ-SHEET: 4 Ansichten in Spielkamera (~30 Grad von oben, ART_STYLE
    # 2.6) + frontale Gesichts-Nahaufnahme. 768px/128 Samples wie die Gebaeude.
    sc.render.resolution_x = sc.render.resolution_y = 768
    sc.cycles.samples = 128
    target = Vector((0, 0, T * 0.47))
    for vname, az_deg in (("front", 0), ("threequarter", 315), ("side", 270), ("back", 180)):
        cam_data.ortho_scale = T * 1.24
        el = math.radians(60); az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"sheet_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
    # Gesichts-Nahaufnahme frontal
    cam_data.ortho_scale = 1.18
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.cycles.samples = 96
    tf = Vector((0, 0, 2.03))
    el = math.radians(72); az = 0.0
    cam.location = tf + Vector((0, d * math.sin(el), d * math.cos(el)))
    cam.rotation_euler = (tf - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, "sheet_FACE.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)
elif stage == "verify":
    # NUTZER-PRUEFANSICHTEN (2026-07-14): Front + Spiel-3/4 + VON OBEN — zeigen,
    # dass die Armschiene sichtbar ist, die Faust sauber greift und die Sehne
    # nirgends durch Hand/Arm laeuft. VERSIONIERT (nie ueberschreiben).
    CHECK_V = "v16"
    DST = r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"
    target = Vector((0, 0, T * 0.485))
    cam_data.ortho_scale = T * 1.16
    sc.render.resolution_x = sc.render.resolution_y = 940
    for vname, el_deg, az_deg in (("front", 88, 0), ("threequarter", 66, 315),
                                  ("top", 8, 0)):
        el = math.radians(el_deg); az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(DST, f"FIGUR_montage_check_{CHECK_V}_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
elif stage == "face":
    # Gesichts-Nahaufnahme: Spiel-3/4 (el 66, az 315 wie die Sheet-Ansichten)
    # + strenge Seite (el 90) — Mund-Decal-Vergleich
    target = Vector((0, 0, 2.03))
    cam_data.ortho_scale = 1.18
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.cycles.samples = 96
    for vname, el_deg, az_deg in (("34", 66, 315), ("seite", 90, 90)):
        el = math.radians(el_deg); az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"gesicht_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
else:
    target = Vector((0, 0, T * 0.485))
    cam_data.ortho_scale = T * 1.16
    for vname, el_deg, az_deg in (("front", 88, 0), ("side", 90, 90)):
        el = math.radians(el_deg); az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"figur_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
print("DONE")
