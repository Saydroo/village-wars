# -*- coding: utf-8 -*-
"""POSEN des Menschen-Archers auf Basis des ABGENOMMENEN Referenz-Sheets v10
(figur_check.py-Stand 2026-07-14). Die v10-Konstruktion (EIN-Roehren-Bogenarm,
koaxiale Armschiene, aufrechter Bogen, Sehne vor dem Arm) ist hier fuer
beliebige Arm-/Bein-/Bogenlagen generalisiert. Aenderungen am Grund-Look
gehoeren in figur_check.py — dieses Skript posiert nur.

Posen:
  idle    ruhig stehend, Bogen entspannt (leicht lebendiger als das Sheet:
          Kopf einen Hauch zum Bogen gedreht, rechte Hand locker vor dem Bein)
  attack  gespannter Bogen, Sehne gezogen, Pfeil eingelegt, offener
          Ellipsen-Mund, Kopf zum Ziel gedreht (Gesicht bleibt kamerasichtbar)
  walk    Schrittstellung (rechtes Bein vor, rechter Arm zurueck), Bogen dabei
  victory Bogen erhoben (leicht geneigt), rechte Hand jubelnd hoch, offener Mund

Aufruf:
  blender -b --factory-startup --python archer_poses.py -- <pose> [outdir]
Ausgabe: <outdir>/menschen_archer_<pose>_v01.png (Spielkamera el 60 / az 315)
"""
import bpy, math, sys, os
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
POSE = argv[0] if len(argv) >= 1 else "idle"
OUT = argv[1] if len(argv) >= 2 else \
    r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"
AZ = float(argv[2]) if len(argv) >= 3 else 45.0    # Kamera-Azimut (Facing); 45 = Basis-Konvention
DELTA_RAD = math.radians(AZ - 45.0)                # Lichter mitdrehen -> Licht bleibt oben-links
assert POSE in ("idle", "attack", "walk", "victory"), f"unbekannte Pose {POSE}"

# === FRONT_DEG(AZ): Koerper-Ausrichtung Richtung Aim (nur attack) ============
# Dreht den KOERPER (Torso/Schultern/Huefte/Beine/Kopf/Koecher/Outfit) um die
# Hochachse Richtung Aim, waehrend Bogenhand (HAND_L) und Nock FIX bleiben — Aim
# und gespannter Bogen zielen unveraendert, die Armketten spannen von den
# gedrehten Schultern zur fixen Hand neu auf. >0 dreht die Koerper-Front (+Y)
# Richtung Aim (frontaler zum Ziel), sodass attack die Front/Rueckseite von walk
# je Facing trifft (kein Umklappen Laufen<->Schiessen). Nur attack.
# PRO-FACING-Betrag FRONT_DEG(AZ) (analog ROT_ALIGN(AZ)): az45/135/315 = 45 (3/4).
# az225 = grid -x = Schuss vom Betrachter weg -> Ruecken; braucht wegen der Iso-
# Spiegelung eine GROESSERE Gegendrehung (~130, empirisch), damit der Koerper die
# Rueckseite zeigt wie walk_az225/az135, statt bei 45 nach vorn zu klappen.
# Modell (verifiziert): Front <=> cos(FRONT_DEG - ROT_ALIGN(AZ) - AZ) > 0.
# Env FRONT_DEG override-bar (Exploration); sonst der pro-Facing-Wert.
_FRONT_BY_AZ = {45: 45.0, 135: 45.0, 225: 130.0, 315: 45.0}
if POSE == "attack":
    _env_fd = os.environ.get("FRONT_DEG")
    FRONT_DEG = float(_env_fd) if _env_fd is not None else _FRONT_BY_AZ.get(int(round(AZ)), 45.0)
else:
    FRONT_DEG = 0.0
_FRONT = math.radians(FRONT_DEG)
FRONT_ROT = Matrix.Rotation(_FRONT, 4, 'Z')     # um die Hochachse durch (0,0)
FRONT_ROT3 = FRONT_ROT.to_3x3()

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
M = cp.make_materials()

# === v10-KONSTANTEN (identisch zu figur_check.py — NICHT frei aendern) ========
HEAD_S = 0.90
CHIN_Z = 1.57
WRIST_Z = 0.97
WRIST_X_R = 0.56
HAND_S = 0.88
SH_L = Vector((-0.37, 0.0, 1.36))
SH_R = Vector((+0.37, 0.0, 1.36))
if POSE == "attack" and abs(FRONT_DEG) > 1e-6:
    # Schultern mit dem Koerper drehen -> alle Armketten (ARM_CHAIN/ARM_R_CHAIN),
    # Armschiene, Aermel (via line_pt) und der Arm-Blob-Anker spannen automatisch
    # von der gedrehten Schulter zur fixen Bogenhand/Nock neu auf.
    SH_L = FRONT_ROT3 @ SH_L
    SH_R = FRONT_ROT3 @ SH_R
FIST_WRIST_R = cp.WR * HAND_S
RING_OFF = HAND_S * 0.26            # Faustring-Mitte relativ zum Faust-Ursprung

# === POSEN-PARAMETER ==========================================================
# HAND_L: Faustmitte der Bogenhand (= Bogenachse); BOW_AX: Achse (Einheitsv.);
# E_OUT: Kruemmungsrichtung (wird senkrecht zur Achse projiziert); TAU0:
# Griffposition entlang des Bogens; DRAWN: gespannte Sehne (+NOCK+Pfeil).
if POSE == "idle":
    HAND_L = Vector((-0.775, -0.02, 0.724))
    BOW_AX = Vector((0, 0, 1)); E_OUT_RAW = Vector((-0.22, -0.165, 0))
    BOW_LEN, TAU0, D_EFF, DRAWN = 1.76, 0.388, 0.275, False
    HEAD_YAW, MOUTH = 12, "smile"
    LEGS, BOOT_DY = None, None
elif POSE == "walk":
    HAND_L = Vector((-0.775, -0.02, 0.724))
    BOW_AX = Vector((0, 0, 1)); E_OUT_RAW = Vector((-0.22, -0.165, 0))
    BOW_LEN, TAU0, D_EFF, DRAWN = 1.76, 0.388, 0.275, False
    HEAD_YAW, MOUTH = 0, "smile"
    STRIDE = 0.32          # v03: moderat geschaerft (war 0.24)
    LEGS, BOOT_DY = {"R": +STRIDE, "L": -STRIDE}, {"R": +STRIDE, "L": -STRIDE}
elif POSE == "attack":
    HAND_L = Vector((-0.78, 0.20, 1.40))
    BOW_AX = Vector((0, 0, 1)); E_OUT_RAW = Vector((-0.5, -0.866, 0))
    BOW_LEN, TAU0, D_EFF, DRAWN = 1.60, 0.59, 0.40, True
    NOCK = Vector((0.06, 0.48, 1.28))    # v06: leicht abgesenkt + nach +x/+y —
    #                                      schafft echten GESICHT-FREI-Abstand
    #                                      (Ziel Arm >= 0.035); Apex der Sehne +
    #                                      Pfeil-Rueckende sitzen hier (eingenockt)
    # Yaw 22 statt 50 (v02): bei 50 Grad lagen Feder + Kapuzenform so zur
    # Kamera, dass die robinhood-Silhouette verloren ging (Nutzer-Befund)
    HEAD_YAW, MOUTH = 22, "open"
    LEGS, BOOT_DY = None, None
else:  # victory
    # Faust greift das UNTERE Drittel (TAU0 0.28): das untere Wurfarm-Holz
    # endet oberhalb der Armschiene, statt parallel am erhobenen Arm entlang-
    # zulaufen (erster Wurf: Holz-Schiene -0.033). Weit aussen, damit die
    # Sehnen-Gerade seitlich an der Kapuze vorbeilaeuft.
    # Bogen fast SENKRECHT bei stark schraegem Arm: so divergieren unterer
    # Wurfarm und Armschiene (~17 Grad) und das Holz bleibt frei vom Leder
    HAND_L = Vector((-0.84, 0.10, 2.30))
    BOW_AX = Vector((-0.18, 0.10, 0.978)).normalized()
    E_OUT_RAW = Vector((-0.60, -0.80, 0))
    BOW_LEN, TAU0, D_EFF, DRAWN = 1.76, 0.28, 0.27, False
    HEAD_YAW, MOUTH = 0, "open"
    LEGS, BOOT_DY = None, None

E_OUT = (E_OUT_RAW - BOW_AX * E_OUT_RAW.dot(BOW_AX)).normalized()

# === LINKER ARM + BOGENFAUST: FAEUSTLINGS-VERBUND (v03; W4 provisorisch) =====
# build_grip_unit = Faust-Blob + Stabsegment als EIN Verbund, nur als Ganzes
# platziert. Die Ringmitte liegt AUF der Bogenachse (kein FIST_OFF mehr — der
# Stab darf und soll im Faustvolumen stecken, GRIFF-CLEARANCE entfaellt per
# Nutzer-Vorgabe). Der BOGEN wird an der Stab-Achse ausgerichtet; das echte
# Bogenholz (r ~0.047) laeuft koaxial ueber dem skalierten Verbund-Stab.
# HAND-CHIRALITAET gilt weiter.
Z_FIST = -BOW_AX
# Daumenseite (lokal +x) zeigt zur Koerpermitte (Azimut ~30 Grad); die
# Wulst-/Knoechelseite (lokal Azimut 245) zeigt damit nach aussen-vorn,
# direkt in die az-315-Spielkamera. PALM = Z x Daumenrichtung.
PALM_L = Vector((0.5, -0.866, 0.0))
ROT_L = cp.orient_matrix(Z_FIST, PALM_L)
FIST_C = Vector(HAND_L)                # Ringmitte = Bogenachse (Verbund)
FIST_ORIGIN = Vector(HAND_L)           # Verbund-Ursprung liegt auf der Achse
END_R = 0.085                          # Blob-Anschluss (kein Wrist)
# BLOB-Kennwerte (build_grip_fist: Kugel r0.112 * scale (1.16,0.92,1.52),
# lokal-Zentrum (0,-0.010,0)) im WELT-System — Basis fuer den koaxialen Anker.
BLOB_SEMI = Vector((0.130, 0.103, 0.170)) * HAND_S
BLOB_C = FIST_ORIGIN + ROT_L @ (Vector((0.0, -0.010, 0.0)) * HAND_S)
# ARM-ANKER (v05): das Arm-Ende sitzt in JEDER Pose koaxial im Blob-Kern —
# auf dem Strahl von der Schulter in den Blob, bei Ellipsoid-Norm 0.82 (knapp
# unter der Blob-Oberflaeche, Radius-Anschluss wie im abgenommenen Idle v03).
# Vorher fixe Formel (FIST_C + _dsh*0.095 - Z_FIST*0.06): lag nur bei
# HAENGENDEM Arm im Blob und trat beim ERHOBENEN Victory-Arm oben aus.
_appr = (BLOB_C - SH_L).normalized()   # Schulter -> Blob (Arm-Anlaufrichtung)
_la = ROT_L.transposed() @ _appr       # in Blob-Lokalkoordinaten
_k = math.sqrt((_la.x / BLOB_SEMI.x) ** 2 + (_la.y / BLOB_SEMI.y) ** 2
               + (_la.z / BLOB_SEMI.z) ** 2)
ANCHOR_PT = BLOB_C - _appr * (0.82 / _k)
# BEWEIS-MODUS (arg "v04anchor"): alte v04-Ankerformel rekonstruieren, damit
# der neue ARM-FLUCHT-Assert den Victory-Fehler rueckwirkend fangen kann.
if "v04anchor" in argv:
    _dsh = (SH_L - FIST_C)
    _dsh = (_dsh - Z_FIST * _dsh.dot(Z_FIST)).normalized()
    ANCHOR_PT = FIST_C + _dsh * 0.095 - Z_FIST * 0.06
    print("BEWEIS: ARM-ANKER auf v04-Konstruktion gesetzt")


def line_pt(t):
    return SH_L.lerp(FIST_C, t)


ARM_T = ((0.0, 0.118), (0.236, 0.113), (0.338, 0.110), (0.409, 0.104),
         (0.487, 0.098), (0.55, 0.092))
ARM_CHAIN = [(line_pt(t), r) for t, r in ARM_T]
ARM_CHAIN.append(((line_pt(0.59) + ANCHOR_PT) * 0.5, 0.086))
ARM_CHAIN.append((ANCHOR_PT, END_R))


def arm_r_at_t(t):
    for (t0, r0), (t1, r1) in zip(ARM_T, ARM_T[1:]):
        if t0 <= t <= t1:
            return r0 + (r1 - r0) * (t - t0) / (t1 - t0)
    return ARM_T[0][1] if t < 0 else ARM_T[-1][1]


# === RECHTER ARM je Pose ======================================================
def chain_to(sh, end, radii=((0.0, 0.114), (0.35, 0.109), (0.65, 0.101),
                             (0.85, 0.090), (1.0, 0.078))):
    return [(sh.lerp(Vector(end), t), r) for t, r in radii]


R_HAND_MODE = {"idle": "open", "walk": "open", "attack": "fist",
               "victory": "open"}[POSE]
if POSE == "idle":
    HAND_R_END = Vector((0.54, 0.10, 0.99))       # locker leicht vor dem Bein
    F_R, P_R = Vector((0.20, 0.12, -0.97)), Vector((-0.35, -0.94, 0))
elif POSE == "walk":
    # v03: Gegenschwung SICHTBAR nach hinten (war -0.18 = knapp vorm Bein)
    # v04 (ARM-LAENGE): der Roehrenarm Schulter->Hand war ~14% laenger als in
    #   idle/attack -> der rechte Arm haengt sichtbar zu lang gerade herunter
    #   (Nutzer-Befund, am staerksten in az315). Fix: die RICHTUNG des
    #   Gegenschwungs bleibt EXAKT erhalten, aber die Distanz Schulter->Hand
    #   wird auf die idle-Armlaenge normiert (dort stimmt die Proportion).
    #   Betrifft NUR die walk-Pose; idle/attack/victory bleiben unberuehrt.
    _R_LEN_IDLE = (Vector((0.54, 0.10, 0.99)) - SH_R).length     # idle-Armlaenge
    _swing_dir = (Vector((0.52, -0.30, 1.02)) - SH_R).normalized()  # alte Richtung
    HAND_R_END = SH_R + _swing_dir * _R_LEN_IDLE
    F_R, P_R = Vector((0.12, -0.38, -0.92)), Vector((-0.35, -0.94, 0))
elif POSE == "victory":
    HAND_R_END = Vector((0.66, 0.10, 2.05))       # Jubel-Hand hoch
    F_R, P_R = Vector((0.30, 0.08, 0.95)), Vector((-0.50, 0.87, 0))
else:  # attack: Zughand haelt Sehne/Nock am Anker
    # v05: Pfeil-Ziel = Punkt KNAPP UEBER der Bogenfaust-Oberseite (Blob-
    # Halbhoehe 0.15 + Schaftradius + Luft = 0.17 entlang der Bogenachse),
    # ein Hauch zur Kamera. Der Schaft LIEGT auf der Oberseite auf statt sie
    # zu durchdringen. arrow_end wird an DIESEM Punkt verlaengert (nicht an
    # der Faustmitte GRIP — von dort tauchte der Schaft in v04/erster v05-
    # Wurf zurueck in den Blob, Eindringtiefe +0.063).
    ARROW_T = (Vector(HAND_L) + BOW_AX * 0.17
               + Vector((0.866, -0.5, 0.0)) * 0.040)
    ARROW_DIR = (ARROW_T - NOCK).normalized()
    ZR = ARROW_DIR                                # Ringachse entlang des Pfeils
    R_ORIGIN = NOCK - ZR * RING_OFF
    _to_shR = SH_R - NOCK
    PALM_R = -(_to_shR - ZR * _to_shR.dot(ZR)).normalized()
    # Zugfaust um die Pfeilachse gedreht: Daumen weg vom Kinn nach unten-
    # hinten (sonst schneidet er in der Kamera-Projektion die Gesichtszuege)
    PALM_R = (Matrix.Rotation(math.radians(-45), 3, ZR) @ PALM_R).normalized()
    ROT_R = cp.orient_matrix(ZR, PALM_R)
    ANCHOR_R = R_ORIGIN + ROT_R @ (cp.FIST_WRIST_ANCHOR * HAND_S)
    HAND_R_END = ANCHOR_R + ZR * 0.019

ARM_R_CHAIN = chain_to(SH_R, HAND_R_END)

# === BEINE (walk: Schrittstellung als gerade Roehren) =========================
leg_override = None
if LEGS:
    leg_override = {}
    for side, sx in (("R", 1), ("L", -1)):
        hp = Vector((sx * cp.BODY_STANCE_X, 0.0, 0.82))
        an = Vector((sx * cp.BODY_STANCE_X, LEGS[side], cp.BODY_ANKLE_Z))
        leg_override[side] = [(hp.lerp(an, t), r) for t, r in
                              ((0, 0.165), (0.25, 0.150), (0.5, 0.138),
                               (0.75, 0.120), (1.0, 0.106))]

# === KOERPER ==================================================================
objs, anchors = cp.build_body(M, with_neck=True, wrist_z=WRIST_Z,
                              wrist_x={"R": WRIST_X_R, "L": 0.618},
                              with_feet=False,
                              arm_override={"L": ARM_CHAIN, "R": ARM_R_CHAIN},
                              leg_override=leg_override)

# === KOPF + KAPUZE (v10; Yaw + Mund je Pose) ==================================
head, head_objs = cp.build_head(M, with_hair=False, with_neck=False, mouth=MOUTH)
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
HEADM = (Matrix.Translation((0, 0, head_cz))
         @ Matrix.Rotation(math.radians(HEAD_YAW) + _FRONT, 4, 'Z')  # +_FRONT: Kopf dreht mit Koerper
         @ Matrix.Scale(HEAD_S, 4))
cp.place(head_all, HEADM)
cp.build_collar(M)
cp.build_outfit(M, sleeve_to={"L": line_pt(0.338)}, boot_shift=BOOT_DY)

# === HAENDE ===================================================================
# Faeustlings-VERBUND (Faust + Stabsegment) als Ganzes an der Bogenachse
fistL = cp.build_grip_unit(M, pfx="handL_")
cp.place(fistL, Matrix.Translation(FIST_ORIGIN) @ ROT_L.to_4x4()
         @ Matrix.Scale(HAND_S, 4))
if R_HAND_MODE == "open":
    # GESPIEGELTES Bauteil (Nutzer v02): build_open_hand + mirror=True wie im
    # abgenommenen v10-Sheet — Daumen zeigt zur Koerpermitte, nicht nach aussen
    handR = cp.build_open_hand(M, pfx="handR_", with_wrist=True)
    RotR = cp.orient_matrix(F_R.normalized(), P_R, mirror=True)
    cp.place(handR, Matrix.Translation(HAND_R_END) @ RotR.to_4x4()
             @ Matrix.Scale(HAND_S, 4))
else:
    handR = cp.build_fist(M, pfx="handR_", with_wrist=True, staff=None)
    cp.place(handR, Matrix.Translation(R_ORIGIN) @ ROT_R.to_4x4()
             @ Matrix.Scale(HAND_S, 4))

# === BOGEN: gerader RISER + tangential anschliessende Wurfarme (v04) ==========
# Nutzer-Diagnose: der alte Sinus-Bogen kruemmte sich direkt am Griff weg —
# der GERADE Verbund-Stab trat unten sichtbar als "zweiter Stock" aus dem
# Holz. Fix: kurzer gerader Riser-Abschnitt (Radius = EXAKT der Verbund-
# Stab) mittig im Wurfarm; der Verbund liegt koaxial darin. Die gekruemmten
# Wurfarme schliessen oben/unten TANGENTIAL an (Smoothstep-Lateralprofil:
# Steigung 0 am Riser-Ende). Die Spitzen bleiben auf der Sehnen-Chord.
GRIP = Vector(HAND_L)
DEPTH = (D_EFF / math.sin(math.pi * TAU0)) if not DRAWN else 0.40
D0 = DEPTH * math.sin(math.pi * TAU0)     # Chord-Abstand der Riser-Achse
TIPLINE = GRIP - E_OUT * D0
R_RISER = 0.047 * HAND_S                  # = Weltradius des Verbund-Stabs
RISER_HALF = 0.23                         # deckt den Stab (+-0.23*HAND_S) ab
R_TIP = 0.026
s_lo, s_hi = -TAU0 * BOW_LEN, (1 - TAU0) * BOW_LEN


def _limb(u):
    return u * u * (3 - 2 * u)            # Smoothstep: tangential am Riser


bow_pts = []
NL = 7
for i in range(NL):                        # unterer Wurfarm: Spitze -> Riser
    u = 1 - i / (NL - 1)
    s = -RISER_HALF + (s_lo + RISER_HALF) * u
    bow_pts.append((GRIP + BOW_AX * s - E_OUT * (D0 * _limb(u)),
                    R_RISER + (R_TIP - R_RISER) * u))
bow_pts.append((GRIP, R_RISER))            # Riser-Mitte (gerade Achse)
for i in range(NL):                        # oberer Wurfarm: Riser -> Spitze
    u = i / (NL - 1)
    s = RISER_HALF + (s_hi - RISER_HALF) * u
    bow_pts.append((GRIP + BOW_AX * s - E_OUT * (D0 * _limb(u)),
                    R_RISER + (R_TIP - R_RISER) * u))
cp.tube(bow_pts, "bogen_holz", M["WOOD"], bevres=12)
# KEINE Leder-Griffwicklung mehr: der Faeustlings-Verbund (Faust + koaxialer
# Stab) IST der Griff; das Bogenholz laeuft an der Stab-Achse ausgerichtet
# mittig durch das Faustvolumen (Nutzer-Vorgabe Verbund-Bauteil).
tip_bot, tip_top = bow_pts[0][0], bow_pts[-1][0]
for pa, pb, nm in ((bow_pts[1][0], tip_bot, "bogen_tip_u"),
                   (bow_pts[-2][0], tip_top, "bogen_tip_o")):
    d_ = (pb - pa).normalized()
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.034, radius2=0.002,
                                    depth=0.07, location=pb + d_ * 0.025)
    _c = bpy.context.active_object; _c.name = nm
    _c.rotation_euler = Vector((0, 0, 1)).rotation_difference(d_).to_euler()
    _c.data.materials.append(M["GOLD"])

STRING = cp.mat("sehne", (0.055, 0.045, 0.038), rough=0.8)
R_S = 0.022
if not DRAWN:
    S_SEGS = [(TIPLINE + BOW_AX * (s_lo + 0.03), TIPLINE + BOW_AX * (s_hi - 0.03))]
    cp.rod(S_SEGS[0][0], S_SEGS[0][1], R_S, STRING, "sehne", verts=10)
else:
    # GEZOGENE Sehne (v06): beide Haelften laufen zu EINEM Apex = Nocking-
    # Punkt (Fingergriff der Zughand). Das hintere Pfeilende sitzt GENAU auf
    # diesem Apex -> der Pfeil ist EINGENOCKT (vorher endete die Sehne 0.165
    # vor dem NOCK, der Pfeil lag daneben). APEX = NOCK.
    APEX = Vector(NOCK)
    S_SEGS = [(tip_top, APEX), (tip_bot, APEX)]
    for tip in (tip_top, tip_bot):
        cp.rod(tip, APEX, R_S, STRING, "sehne", verts=10)
    # PFEIL: Rueckende AM Apex, ueber die Faust-Oberseite (ARROW_T) hinaus —
    # die Zentrallinie bleibt oberhalb des Blobs (kein Rueckdip in die Faust)
    ARROW_BACK = Vector(APEX)
    arrow_end = ARROW_T + ARROW_DIR * 0.40
    cp.rod(ARROW_BACK, arrow_end, 0.016, M["WOOD"], "pfeil_schuss", verts=10)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.036, radius2=0.002,
                                    depth=0.085, location=arrow_end + ARROW_DIR * 0.03)
    _p = bpy.context.active_object; _p.name = "pfeil_schuss_spitze"
    _p.rotation_euler = Vector((0, 0, 1)).rotation_difference(ARROW_DIR).to_euler()
    _p.data.materials.append(M["GOLD"])
    _a1 = ARROW_DIR.cross(Vector((0, 0, 1))).normalized()
    _a2 = ARROW_DIR.cross(_a1).normalized()
    for k in range(3):
        phi = math.radians(k * 120)
        off = (_a1 * math.cos(phi) + _a2 * math.sin(phi)) * 0.028
        cp.rod(ARROW_BACK + ARROW_DIR * 0.04 + off, ARROW_BACK + ARROW_DIR * 0.11 + off,
               0.009, M["LEATH"], "pfeil_schuss_feder", verts=6)

# === KOECHER (wie v10) ========================================================
q_base = FRONT_ROT3 @ Vector((-0.08, -0.40, 0.86))  # Koecher dreht mit Koerper (_FRONT)
q_top = FRONT_ROT3 @ Vector((-0.24, -0.46, 1.36))
q_dir = (q_top - q_base).normalized()
cp.rod(q_base, q_top, 0.078, M["LEATH_D"], "koecher", verts=18)
cp.rod(q_top - q_dir * 0.02, q_top + q_dir * 0.015, 0.084, M["LEATH"],
       "koecher_rand", verts=18)
qs1 = q_dir.cross(Vector((0, 0, 1))).normalized()
qs2 = q_dir.cross(qs1).normalized()
for k in range(3):
    phi = math.radians(k * 120 + 30)
    off = (qs1 * math.cos(phi) + qs2 * math.sin(phi)) * 0.032
    cp.rod(q_top + off, q_top + q_dir * 0.17 + off, 0.011, M["WOOD"],
           "pfeil_schaft", verts=8)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.026, radius2=0.002,
                                    depth=0.06, location=q_top + q_dir * 0.198 + off)
    _p = bpy.context.active_object; _p.name = "pfeil_spitze"
    _p.rotation_euler = Vector((0, 0, 1)).rotation_difference(q_dir).to_euler()
    _p.data.materials.append(M["GOLD"])

# === ARMSCHIENE: koaxial um die Bogenarm-Roehre (v10-Bauweise) ================
BR_T = ((0.2437, arm_r_at_t(0.2437) + 0.004), (0.3066, 0.147), (0.409, 0.145),
        (0.495, 0.136), (0.558, 0.118))
BR_CHAIN = [(line_pt(t), r) for t, r in BR_T]
BR_CHAIN.append((Vector(ARM_CHAIN[-2][0]), ARM_CHAIN[-2][1] + 0.004))
cp.tube(BR_CHAIN, "armschiene", M["LEATH"], bevres=16)


def brac_r_at_t(t):
    for (t0, r0), (t1, r1) in zip(BR_T, BR_T[1:]):
        if t0 <= t <= t1:
            return r0 + (r1 - r0) * (t - t0) / (t1 - t0)
    return BR_T[-1][1]


for tA, tB in ((0.327, 0.365), (0.443, 0.481)):
    tm = (tA + tB) / 2
    cp.rod(line_pt(tA), line_pt(tB), brac_r_at_t(tm) + 0.003, M["LEATH_D"],
           "armschiene_riemen", verts=24)

# === FRONT_DEG: KERN-KOERPER nachdrehen (nur attack) =========================
# Torso/Hals/Schultern/Beine/Outfit/Kragen sind an FIXEN, symmetrischen Positionen
# gebaut (unabhaengig von SH_L/SH_R) -> hier um die Hochachse mitdrehen. Arme,
# Aermel, Kopf, Kapuze und Koecher wurden bereits ueber die gedrehten Schultern /
# HEADM / q_base aufgebaut (NICHT erneut drehen). Hand/Bogen/Sehne/Pfeil bleiben
# fix -> Aim unveraendert. Bei FRONT_DEG=0 passiert nichts.
if POSE == "attack" and abs(FRONT_DEG) > 1e-6:
    _BODY_PREF = ("rumpf", "hals", "schulter_", "bein_", "fuss_", "tunika",
                  "rock", "guertel", "stiefel", "kragen")
    for _o in bpy.data.objects:
        if _o.type in ('MESH', 'CURVE', 'SURFACE') and _o.name.startswith(_BODY_PREF):
            _o.matrix_world = FRONT_ROT @ _o.matrix_world
    bpy.context.view_layer.update()

# === WALK: OBERKOERPER-VORLAGE (Nutzer v03: 4-6 Grad nach vorn) ===============
# Alles OBERHALB der Hueften (inkl. Arme, Bogen, Sehne, Koecher, Kopf) neigt
# 5 Grad nach vorn; Beine + Stiefel bleiben stehen. Objekte UND analytische
# Referenzen drehen mit DERSELBEN Matrix — alle Asserts bleiben konsistent.
if POSE == "walk":
    _piv = Vector((0, 0, 0.90))
    LM = (Matrix.Translation(_piv) @ Matrix.Rotation(math.radians(-5), 4, 'X')
          @ Matrix.Translation(-_piv))   # -X-Drehung = Scheitel kippt nach +y
    for o in bpy.data.objects:
        if (o.type in ('MESH', 'CURVE', 'SURFACE')
                and not o.name.startswith(("bein_", "stiefel_"))):
            o.matrix_world = LM @ o.matrix_world
    LM3 = LM.to_3x3()
    SH_L = LM @ SH_L
    HAND_L = LM @ HAND_L
    FIST_C = LM @ FIST_C
    GRIP = LM @ GRIP
    HAND_R_END = LM @ Vector(HAND_R_END)
    ARM_CHAIN = [(LM @ p, r) for p, r in ARM_CHAIN]
    bow_pts = [(LM @ p, r) for p, r in bow_pts]
    tip_top, tip_bot = LM @ tip_top, LM @ tip_bot
    S_SEGS = [(LM @ a, LM @ b) for a, b in S_SEGS]
    ROT_L = LM3 @ ROT_L
    RotR = LM3 @ RotR
    BOW_AX = (LM3 @ BOW_AX).normalized()
    Z_FIST = (LM3 @ Z_FIST).normalized()

# === KONVENTIONS-SPIEGELUNG (v07): Figur x -> -x =============================
# az45 = Spiegelung von az315 ueber x=0. Damit die Figur aus der neuen az45-
# Spielkamera (Gebaeude-/lib_iso-Konvention) den Bogen ZUR Kamera zeigt und das
# Licht von oben-links faellt, wird die gesamte Figur an x=0 gespiegelt. Die
# Reflexion ist eine ISOMETRIE -> alle Abstands-/Winkel-Asserts liefern
# identische Werte wie v06, nur die Figur ist seitenverkehrt (Nutzer: erwartet).
# Meshes ueber ein Eltern-Empty mit scale.x=-1 (Blender korrigiert Normalen bei
# negativer Objekt-Skalierung automatisch); rein analytische Referenzen werden
# per _mx (x negiert) nachgezogen, damit sie zu den gespiegelten Meshes passen.
# AUSRICHT-DREHUNG (nur attack, sonst Identitaet): Die Attack-Pose zielt
# konstruktionsbedingt seitlich — ihre Schussachse ARROW_DIR liegt ~110 Grad
# neben der walk-Vorwaertsachse +Y. Der Rig orbitet pro Facing NUR die Kamera
# (Figur fix), daher bildet ausschliesslich eine nach +Y gerichtete Aktions-
# achse sauber auf die vier Facings ab (deshalb stimmt walk). ROT_ALIGN dreht
# die GESAMTE Pose starr um Z, bis die GESPIEGELTE Schussachse in der XY-Ebene
# auf +Y faellt — Bogen/Rig relativ zur Figur bleiben unveraendert. Der Winkel
# wird aus der IST-Schussachse abgeleitet (nicht hart 110 Grad). ROT_ALIGN wird
# IDENTISCH auf die Objekte (_MROOT) UND die gecachten Variablen (_al) angewandt.
if POSE == "attack":
    # PRO-FACING-AUSRICHTUNG: Eine EINZELNE feste Drehung kann den Bogen NICHT in
    # allen vier Facings korrekt zielen lassen — die Iso-Kamera (up=+Z) spiegelt
    # Vorder-/Rueckansichten, sodass keine feste Weltachse auf alle vier Ziel-
    # Screenrichtungen faellt (per world_to_camera_view verifiziert). Deshalb haengt
    # ROT_ALIGN vom Azimut ab: PHI_TARGET[AZ] ist der world-XY-Winkel, dessen
    # Projektion durch die az-Kamera GENAU auf die Ziel-Screenrichtung des Facings
    # faellt (az45=unten-links, az315=unten-rechts, az135=oben-rechts, az225=oben-
    # links). Empirisch bestimmt (M^{-1}*d je Azimut, solve_phi), NICHT geraten;
    # Selbstkontrolle: az135/az225 ~ +Y (90 Grad), az45 ~ +X (0), az315 ~ -X (180).
    # Kamera-Orbit/DELTA_RAD/Ortho/Anker und alle anderen Posen bleiben unberuehrt.
    PHI_TARGET = {45: 3.37, 315: 176.63, 135: 93.37, 225: 86.63}  # Grad, world-XY
    _azk = int(round(AZ))
    assert _azk in PHI_TARGET, f"attack: kein PHI_TARGET fuer az{_azk}"
    _sd = Vector((-ARROW_DIR.x, ARROW_DIR.y, ARROW_DIR.z))  # Schussachse NACH Spiegelung
    _cur_ang = math.atan2(_sd.y, _sd.x)                    # Ist-XY-Winkel des Pfeils
    _tgt_ang = math.radians(PHI_TARGET[_azk])              # Ziel-XY-Winkel dieses Facings
    _align_ang = _tgt_ang - _cur_ang
    ROT_ALIGN = Matrix.Rotation(_align_ang, 3, 'Z')
    print(f"ROT-ALIGN attack az{_azk}: Pfeil-XY {math.degrees(_cur_ang):+.2f} -> Ziel "
          f"{PHI_TARGET[_azk]:+.2f} (world-XY) => Drehung {math.degrees(_align_ang):+.2f} Grad um Z")
else:
    ROT_ALIGN = Matrix.Identity(3)

_MROOT = bpy.data.objects.new("mirror_root", None)
bpy.context.collection.objects.link(_MROOT)
bpy.context.view_layer.update()
for _o in list(bpy.data.objects):
    if _o.type in ('MESH', 'CURVE', 'SURFACE') and _o.parent is None:
        _o.parent = _MROOT
        _o.matrix_parent_inverse = _MROOT.matrix_world.inverted()
# matrix_world = T @ R @ S: erst Spiegelung (S = scale.x -1), dann Ausricht-
# Drehung (R = ROT_ALIGN) -> exakt ROT_ALIGN @ diag(-1,1,1), konsistent zu _al().
_MROOT.scale = (-1.0, 1.0, 1.0)
_MROOT.rotation_euler = ROT_ALIGN.to_euler()
bpy.context.view_layer.update()


def _mx(v):
    return Vector((-v.x, v.y, v.z))


def _al(v):  # erst spiegeln (_mx), dann ausrichten (ROT_ALIGN) — wie _MROOT
    return ROT_ALIGN @ _mx(v)


_MM = Matrix.Diagonal((-1.0, 1.0, 1.0))
SH_L = _al(SH_L); HAND_L = _al(HAND_L); FIST_C = _al(FIST_C); GRIP = _al(GRIP)
BOW_AX = _al(BOW_AX); Z_FIST = _al(Z_FIST)
tip_top = _al(tip_top); tip_bot = _al(tip_bot)
ARM_CHAIN = [(_al(p), r) for p, r in ARM_CHAIN]
bow_pts = [(_al(p), r) for p, r in bow_pts]
S_SEGS = [(_al(a), _al(b)) for a, b in S_SEGS]
ROT_L = ROT_ALIGN @ _MM @ ROT_L
HAND_R_END = _al(Vector(HAND_R_END))
if R_HAND_MODE == "open":
    RotR = ROT_ALIGN @ _MM @ RotR
else:
    ROT_R = ROT_ALIGN @ _MM @ ROT_R
    NOCK = _al(NOCK); APEX = _al(APEX); ARROW_BACK = _al(ARROW_BACK)
    arrow_end = _al(arrow_end)

# === MESSWERTE + ASSERTS ======================================================
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


def seg_dist(p, a, b):
    ab = b - a
    t_ = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t_)).length


BODY_PREF = ("rumpf", "bein", "arm", "schulter", "hals", "kopf", "kapuze",
             "kragen", "hand", "tunika", "rock", "guertel", "stiefel", "aermel")
allp = obj_pts(BODY_PREF + ("feder", "sklera", "iris", "nase", "schnalle",
                            "bogen", "sehne", "koecher", "pfeil", "armschiene"))
body_p = obj_pts(BODY_PREF)
T_FIG = max(p.z for p in body_p) - min(p.z for p in body_p)

# ARM-FLUCHT (v05, gegen die IST-Position des platzierten Verbunds):
# Das Arm-Ende muss koaxial IM Faust-Blob enden. Gemessen wird gegen die
# tatsaechlichen Blob-Mesh-Punkte (nicht gegen Sollkoordinaten) — (a) der
# Anker liegt INNERHALB der Blob-Oberflaeche (Einbettung >= 0), (b) das
# letzte Arm-Segment zeigt in den Blob-Kern (Achswinkel klein). Faengt den
# Victory-v04-Fehler (Anker trat oben aus dem Blob) rueckwirkend.
_dir_line = (FIST_C - SH_L).normalized()   # Arm-Achse (fuer Holz-Filter unten)
_anchor = Vector(ARM_CHAIN[-1][0])
_penult = Vector(ARM_CHAIN[-2][0])
_blob_pts = obj_pts(("handL_faust", "handL_wulst"))
_bc = sum(_blob_pts, Vector((0, 0, 0))) / len(_blob_pts)
_u = _anchor - _bc
_ud = _u.length
_udir = _u / _ud if _ud > 1e-6 else Vector((0, 0, 1))
_r_dir = max((p - _bc).dot(_udir) for p in _blob_pts)  # Blob-Radius in Ankerrichtung
_embed = _r_dir - _ud                                  # >0 = Anker unter der Oberflaeche
_seg_dir = (_anchor - _penult).normalized()
_to_c = (_bc - _penult).normalized()
_axis_ang = math.degrees(_seg_dir.angle(_to_c))
print(f"ARM-FLUCHT (Ist-Verbund): Anker-Einbettung {_embed:+.3f} (>= +0.005) | "
      f"Achswinkel Arm->Blobkern {_axis_ang:.1f} Grad (<= 30)")
assert _embed >= 0.005, f"Arm-Ende nicht im Faust-Blob ({_embed:+.3f})"
assert _axis_ang <= 30, f"Arm-Achse zielt nicht in den Blob-Kern ({_axis_ang:.1f} Grad)"

# RADIUS-KONTINUITAET (kein Absatz)
k_hand = abs(ARM_CHAIN[-1][1] - END_R)
k_br_o = abs(BR_T[0][1] - (arm_r_at_t(BR_T[0][0]) + 0.004))
k_br_u = abs(BR_CHAIN[-1][1] - (ARM_CHAIN[-2][1] + 0.004))
print(f"RADIUS-KONTINUITAET: Arm->Faust {k_hand:.3f} | Schiene oben {k_br_o:.3f} "
      f"| Schiene unten {k_br_u:.3f} (alle <= 0.012)")
assert max(k_hand, k_br_o, k_br_u) <= 0.012, "Absatz in der Armkontur"

# HAND-CHIRALITAET (Nutzer v02): Daumenvektor zeigt pro Hand zur Koerper-
# mittellinie. Referenz ist die Sagittalebenen-Normale — bei der ausgerichteten
# Attack-Pose um ROT_ALIGN mitgedreht (sonst Welt-x), damit "zur Mitte" und die
# Mehrdeutigkeits-Schwelle |.| < 0.2 im gedrehten Rahmen gelten. Fuer alle
# anderen Posen ist ROT_ALIGN die Identitaet -> _mid_n = (1,0,0) = Welt-x (wie bisher).
_mid_n = ROT_ALIGN @ Vector((1.0, 0.0, 0.0))   # +x-Seite der Koerpermitte (mitgedreht)
_hands = [("Bogenfaust L", FIST_C, ROT_L)]
if R_HAND_MODE == "open":
    _hands.append(("offene Hand R", Vector(HAND_R_END), RotR))
else:
    _hands.append(("Zugfaust R", Vector(NOCK), ROT_R))
for _hn, _hc, _hr in _hands:
    _thumb = (_hr @ Vector((1, 0, 0))).normalized()
    _hc_m = _hc.dot(_mid_n)              # Lage relativ zur Mittelebene
    _thumb_m = _thumb.dot(_mid_n)        # Daumenrichtung relativ zur Mittelebene
    _ok = (-_hc_m) * _thumb_m            # >0 = Daumen zeigt Richtung Mitte
    _amb = abs(_hc_m) < 0.2
    print(f"HAND-CHIRALITAET {_hn}: Hand-mid {_hc_m:+.3f} Daumen-mid {_thumb_m:+.3f} "
          f"-> {'ok' if _ok > 0 else 'FALSCH'}{' (Mittellinie, nur Log)' if _amb else ''}")
    if not _amb:
        assert _ok > 0, f"Daumen der {_hn} zeigt von der Koerpermitte weg"

# SEHNE: Durchdringung verboten, Beruehrung an der Armschiene erlaubt
def min_seg(prefixes, segs):
    pts = obj_pts(prefixes)
    if not pts:
        return 9.9
    return min(seg_dist(p, a, b) for p in pts for a, b in segs) - R_S


d_haut = min_seg(("arm_L",), S_SEGS)
d_aerm = min_seg(("aermel_L", "aermel_kappe_L"), S_SEGS)
d_handL = min_seg(("handL_",), S_SEGS)
d_schiene = min_seg(("armschiene",), S_SEGS)
d_gesicht = min_seg(("kopf", "kapuze", "sklera", "iris", "nase", "MundDecal"), S_SEGS)
d_koerper = min_seg(("rumpf", "tunika", "rock", "kragen"), S_SEGS)
print(f"SEHNE-FREI: Haut {d_haut:+.3f} | Aermel {d_aerm:+.3f} | FaustL {d_handL:+.3f} "
      f"| Gesicht/Kapuze {d_gesicht:+.3f} | Koerper {d_koerper:+.3f} (alle >= 0) | "
      f"Armschiene {d_schiene:+.3f} (Beruehrung erlaubt >= -0.030) Kontakt: {d_schiene <= 0.01}")
assert d_haut >= 0.0, f"Sehne beruehrt Armhaut ({d_haut:+.3f})"
assert d_aerm >= 0.0, f"Sehne durchdringt Aermel ({d_aerm:+.3f})"
assert d_handL >= 0.0, f"Sehne durchdringt Bogenfaust ({d_handL:+.3f})"
assert d_gesicht >= 0.0, f"Sehne durchdringt Gesicht/Kapuze ({d_gesicht:+.3f})"
assert d_koerper >= 0.0, f"Sehne durchdringt Koerper ({d_koerper:+.3f})"
assert d_schiene >= -0.030, f"Sehne durchdringt Armschiene ({d_schiene:+.3f})"
if DRAWN:
    # v06: die Sehne laeuft jetzt zum Apex IM Fingergriff — Kontakt mit den
    # Fingern ist gewollt (die Faust HAELT Sehne+Nock), nur tiefe
    # Durchdringung des Faustkoerpers verboten (analog Armschiene).
    d_handR = min_seg(("handR_",), S_SEGS)
    print(f"SEHNE-ZUGHAND: {d_handR:+.3f} (Griff-Kontakt erlaubt >= -0.030)")
    assert d_handR >= -0.030, f"Sehne durchdringt Zughand-Koerper ({d_handR:+.3f})"
    # NOCK-KOPPLUNG (v06): Pfeil-Rueckende sitzt auf dem Sehnen-Apex
    _apex_gap = max((S_SEGS[0][1] - ARROW_BACK).length,
                    (S_SEGS[1][1] - ARROW_BACK).length)
    print(f"NOCK-KOPPLUNG: Pfeil-Rueckende zu Sehnen-Apex {_apex_gap:.4f} "
          f"(~0, Toleranz 0.01)")
    assert _apex_gap <= 0.01, f"Pfeil nicht eingenockt ({_apex_gap:.4f})"

# BOGENHOLZ: nichts anschneiden (sichtbare Armhaut, Schiene, Koerper/Kopf)
def wood_surf_dist(p):
    return min((p - q).length - rq for q, rq in bow_pts)


_arm = obj_pts(("arm_L",))
_br_top_s = (line_pt(BR_T[0][0]) - SH_L).length
d_holz_haut = min(wood_surf_dist(p) for p in _arm
                  if (p - SH_L).dot(_dir_line) < _br_top_s)
# Schiene: nur der SICHTBARE Teil (bis t 0.585 der Armlinie) — der Beugen-
# Auslauf ins Handgelenk liegt im Faust-Volumen, wo das Holz konstruktiv sitzt
_s_vis = (line_pt(0.585) - SH_L).length
d_holz_schiene = min(wood_surf_dist(p) for p in obj_pts(("armschiene",))
                     if (p - SH_L).dot(_dir_line) < _s_vis)
d_holz_koerper = min(wood_surf_dist(p) for p in
                     obj_pts(("rumpf", "tunika", "rock", "kopf", "kapuze", "bein",
                              "stiefel")))
print(f"ARM-HOLZ: sichtbare Haut {d_holz_haut:+.3f} (>= +0.05) | Schiene "
      f"{d_holz_schiene:+.3f} (>=0) | Koerper {d_holz_koerper:+.3f} (>=0)")
assert d_holz_haut >= 0.05, f"Armhaut zu nah am Holz ({d_holz_haut:+.3f})"
assert d_holz_schiene >= 0.0, f"Holz schneidet Armschiene ({d_holz_schiene:+.3f})"
assert d_holz_koerper >= 0.0, f"Holz schneidet Koerper ({d_holz_koerper:+.3f})"

# GRIFF-CLEARANCE entfaellt fuer den Faeustlings-VERBUND (Nutzer-Vorgabe:
# der Stab darf und soll im Faustvolumen stecken). HAND-CHIRALITAET bleibt.

# BOGEN-GRIFF (Nutzer v04): Der Verbund-Stab muss koaxial IM Riser liegen —
# Achsabstand am Griffpunkt ~0 und der Stab darf nirgends aus dem Holz
# austreten. Laeuft in JEDER Pose.
_staff_hw = 0.23 * HAND_S
_R_STAFF = 0.047 * HAND_S


def _line_dist(p, a, d_):
    v = p - a
    return (v - d_ * v.dot(d_)).length


_dE = max(_line_dist(HAND_L - Z_FIST * _staff_hw, GRIP, BOW_AX),
          _line_dist(HAND_L + Z_FIST * _staff_hw, GRIP, BOW_AX))
_uebertritt = _dE + _R_STAFF - R_RISER
print(f"BOGEN-GRIFF: Achsabstand Stab<->Riser {_dE:.4f} (<= 0.005) | "
      f"Stab-Uebertritt aus dem Holz {_uebertritt:+.4f} (<= +0.002) | "
      f"Stab-Halblaenge {_staff_hw:.3f} in Riser-Halblaenge {RISER_HALF:.3f}")
assert _dE <= 0.005, f"Verbund-Stab nicht koaxial zum Riser ({_dE:.4f})"
assert _uebertritt <= 0.002, f"Verbund-Stab tritt aus dem Holz aus ({_uebertritt:+.4f})"
assert _staff_hw <= RISER_HALF, "Verbund-Stab laenger als der Riser"

# BOGEN-GROESSE (ART_STYLE 2.1: Waffe >= 60% Koerperhoehe) — 3D-Spannweite,
# posenunabhaengig gegen die FIGUR-Hoehe (ohne Bogen) gemessen
bow_span = (tip_top - tip_bot).length
print(f"BOGEN: Spannweite {bow_span:.3f} = {100 * bow_span / T_FIG:.0f}% von "
      f"T_Figur {T_FIG:.3f} (>= 60%)")
assert bow_span >= 0.60 * T_FIG, f"Bogen zu klein ({100 * bow_span / T_FIG:.0f}%)"

# ATTACK: Gesicht frei — Zughand/rechter Arm duerfen die Gesichtszuege aus der
# SPIELKAMERA des jeweiligen Facings nicht verdecken. Kamera = AKTUELLER AZ, damit
# der Check das echte Render-Bild dieses Facings widerspiegelt; laeuft HART fuer
# JEDES Facing (nicht mehr nur az45) und sichert az45 damit hart ab.
if POSE == "attack":
    el, az = math.radians(60), math.radians(AZ)
    C = Vector((math.sin(el) * math.sin(az), math.sin(el) * math.cos(az), math.cos(el)))
    u = Vector((0, 0, 1)).cross(C).normalized()
    w = C.cross(u).normalized()

    def p2(p):
        return Vector((p.dot(u), p.dot(w)))

    feat = [p2(p) for p in obj_pts(("sklera", "iris", "MundDecal", "nase"))]
    _bh = [p2(p) for p in obj_pts(("handR_",))]
    _ba = [p2(p) for p in obj_pts(("arm_R",))]
    d_face_hand = min((f - b).length for f in feat for b in _bh)
    d_face_arm = min((f - b).length for f in feat for b in _ba)
    # Nutzer-Regel v06: echter Abstand statt Punktlandung — Zughand >= 0.05,
    # rechter Arm >= 0.035 (war 0.025 auf der Grenze).
    _azk = int(round(AZ))
    print(f"GESICHT-FREI (Kamera-Projektion az{_azk}): Zughand {d_face_hand:.3f} "
          f"(>= 0.05) | rechter Arm {d_face_arm:.3f} (>= 0.035)")
    assert d_face_hand >= 0.05, f"Zughand verdeckt das Gesicht az{_azk} ({d_face_hand:.3f})"
    assert d_face_arm >= 0.035, f"Zugarm zu nah am Gesicht az{_azk} ({d_face_arm:.3f})"

    # PFEIL-FREI (Nutzer v05): der Pfeilschaft darf das Grip-Faust-Volumen
    # NICHT durchdringen — die Zentrallinie muss ausserhalb der Blob-
    # Oberflaeche bleiben; ein Auflage-Kontakt an der OBERSEITE (Zentrallinie
    # knapp an der Oberflaeche, Schaftradius liegt auf) ist erlaubt.
    def blob_inside_depth(p):
        u_ = p - _bc
        ud_ = u_.length
        if ud_ < 1e-6:
            return _r_dir
        ud_dir = u_ / ud_
        return max((v - _bc).dot(ud_dir) for v in _blob_pts) - ud_

    _pen = max(blob_inside_depth(NOCK.lerp(arrow_end, i / 40)) for i in range(41))
    print(f"PFEIL-FREI: max Zentrallinien-Eindringtiefe in den Blob {_pen:+.3f} "
          f"(<= +0.005; Auflage-Kontakt an der Oberseite ok)")
    assert _pen <= 0.005, f"Pfeilschaft durchdringt die Bogenfaust ({_pen:+.3f})"

# === KAMERA / LICHT / RENDER (VERBINDLICHE KONVENTION v07: el 60, az 45) ======
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cam_data); bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam
# Key-Sonne IDENTISCH zur lib_iso-Gebaeude-Pipeline (rotation 50/12/35) -> im
# az45-Bild kommt das Licht von OBEN-LINKS; Archer + Gebaeude teilen damit
# dieselbe Sonnenrichtung (Kalibrierung 2026-07-14).
key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2; key.angle = math.radians(6)
ko = bpy.data.objects.new("key", key)
ko.rotation_euler = (math.radians(50), math.radians(12), math.radians(35) + DELTA_RAD)
bpy.context.collection.objects.link(ko)
fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5; fill.angle = math.radians(60)
fo = bpy.data.objects.new("fill", fill); fo.rotation_euler = (math.radians(55), 0, math.radians(200) + DELTA_RAD)
bpy.context.collection.objects.link(fo)
# Spec-Highlight auf die LINKE (Licht-)Seite gespiegelt (x negiert), passend zur
# gespiegelten Figur + Licht oben-links.
spec = bpy.data.lights.new("spec", 'AREA'); spec.energy = 34; spec.size = 1.6
so_ = bpy.data.objects.new("spec", spec)
so_.location = Matrix.Rotation(DELTA_RAD, 4, 'Z') @ Vector((-0.9, 2.2, 2.6))
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
sc.cycles.samples = 128
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 768
sc.view_settings.view_transform = 'Standard'

el, az, d = math.radians(60), math.radians(AZ), 24.0   # AZ = Facing-Azimut (Basis 45)
Cdir = Vector((math.sin(el) * math.sin(az), math.sin(el) * math.cos(az), math.cos(el)))
u_ax = Vector((0, 0, 1)).cross(Cdir).normalized()
w_ax = Cdir.cross(u_ax).normalized()
cu = [p.dot(u_ax) for p in allp]; cw = [p.dot(w_ax) for p in allp]
target = (u_ax * (max(cu) + min(cu)) / 2 + w_ax * (max(cw) + min(cw)) / 2
          + Cdir * Cdir.dot(Vector((0, 0, T_FIG * 0.5))))
_fit_ortho = 1.13 * max(max(cu) - min(cu), max(cw) - min(cw))
# FIXER Weltmaszstab ueber ALLE Posen/Richtungen (sonst aendert die Einheit beim
# Drehen die Groesse). FIXED_ORTHO deckt die breiteste Pose (attack, gespannt) mit
# Reserve; per Env override-bar zum Kalibrieren.
FIXED_ORTHO = float(os.environ.get("ARCHER_ORTHO", "3.10"))
cam_data.ortho_scale = FIXED_ORTHO
print(f"ORTHO fit={_fit_ortho:.3f} fixed={FIXED_ORTHO:.3f}")
cam.location = target + Cdir * d
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

# FUSSPUNKT-PROJEKTION: Mittelpunkt beider Stiefel-Sohlen durch die Render-Kamera
# projizieren -> exakter Fusspunkt-Anker (0..1 der Leinwand) fuer DIESE Richtung.
# Laeuft immer (nicht mehr nur als Sonder-Arg) und beendet NICHT vorzeitig.
from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()
_dgp = bpy.context.evaluated_depsgraph_get()


def _sole_contact(nm):
    o = bpy.data.objects[nm]
    ev = o.evaluated_get(_dgp); me = ev.to_mesh()
    ws = [o.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    cx_ = sum(p.x for p in ws) / len(ws)
    cy_ = sum(p.y for p in ws) / len(ws)
    return Vector((cx_, cy_, min(p.z for p in ws)))  # Mitte + Sohlen-Unterkante


_soles = [_sole_contact(nm) for nm in ("stiefel_sohle_L", "stiefel_sohle_R")]
_wmid = (_soles[0] + _soles[1]) / 2.0
_uv = world_to_camera_view(sc, cam, _wmid)
_ax, _ay = _uv.x, 1.0 - _uv.y
print(f"ANCHOR {POSE} az{int(AZ)} = [{_ax:.4f}, {_ay:.4f}]  "
      f"render_px ({_ax * sc.render.resolution_x:.1f}, {_ay * sc.render.resolution_y:.1f})")

# Ausgabe: 768er-Render je Pose/Azimut (Downscale auf 512 + Manifest separat).
_out = os.path.join(OUT, f"menschen_archer_{POSE}_az{int(AZ)}.png")
sc.render.filepath = _out
bpy.ops.render.render(write_still=True)
print("RENDERED", sc.render.filepath)
print("DONE", POSE)
