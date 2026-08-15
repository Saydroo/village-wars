# Checkliste — Cartoon-Archer (cartoon_parts.py / figur_check.py)

## ⏸ WO WIR STEHEN (2026-07-14) — nächster Chat startet hier

**ENTSCHIEDEN (Nutzer 2026-07-14): Bracer-Kontakt-Variante.** Die 28°-Bogen-
neigung ist VERWORFEN und aus `figur_check.py` entfernt. Stand (Prüfbilder
`FIGUR_montage_check_v15_{front,threequarter,top}.png`, 940 px, alle Asserts
grün):
- **LINKER ARM = EINE ROEHRE** (Nutzer-Korrektur nach v14 „gestückelt", struk-
  turell wie die Finger): EIN durchgehendes `tube`-Mesh mit stetig fallendem
  Radius von der Schulter über den Ellbogen (AUF der Geraden) bis in die
  Faust-Manschette — Ende EXAKT mit Manschetten-Radius (`ARM_CHAIN` +
  `arm_line`/`arm_r_at` in figur_check; `build_body(arm_override=…)`).
  Gelenk-Kette x: Schulter −0.370 → Ellbogen −0.507 → Handgelenk −0.618 →
  Faustmitte −0.775, Flucht-Abweichungen 0.000 (**ARM-FLUCHT-Assert** ≤ 0.02).
- **ARMSCHIENE KOAXIAL** um dieselbe Achse (`cp.tube`, Enden laufen stetig auf
  den Arm-Radius zu, max r 0.147, z ~0.98–1.205, folgt unten der Beuge in die
  Faust). Riemen = dunkle RINGE nur +0.003 über dem Leder (lesen über Farbe,
  nicht als Silhouetten-Stufe). Ärmel folgt der echten Armachse
  (`build_outfit(sleeve_to=…)` — vorher zielte er auf den alten Ellbogen und
  der Arm trat seitlich aus der Röhre aus).
- **RADIUS-KONTINUITÄTS-Assert** (kein Absatz): Arm→Faust 0.000, Schiene-oben→
  Arm 0.000, Schiene-unten→Arm 0.000 (≤ 0.012), Ärmelkante 0.041 (Stoffkante
  ≤ 0.045).
- Bogen: Achse exakt SENKRECHT in der Faustmitte, Sinus-Kurve, BOW_LEN 1.76
  (72 % von T); Sehnen-Gerade INNEN + HINTER dem Arm (CHORD (−0.505, −0.17)),
  liegt an der Schiene an (−0.008 = Berührung, erlaubt); Haut +0.031, Ärmel
  +0.029, Faust +0.130; Holz: sichtbare Haut (z≥1.20) +0.109, Schiene +0.040.
  Holz-Haut-Assert gilt nur für SICHTBARE Haut — darunter ist der Arm lücken-
  los von Schiene bzw. Faust umhüllt (dort separat geprüft bzw. unsichtbar).
- Hinweis: `FIGUR_montage_check_v10/v11` (im `_archiv`) waren ein Fehlversuch
  am falschen Skript (`archer_full.py`, alter MakeHuman-Pfad) — ignorieren.
**SHEET GERENDERT (2026-07-14): `menschen_archer_ref-sheet_v10.png`** (Figur-
Stand v15 abgenommen; QA `sprite_qa.py` auf alle 4 Ansichten OHNE Warnungen).
⚠️ QA-Befund dabei: Mit Sehne HINTER dem Arm (CHORD y −0.17) stand die Bogen-
EBENE aus der 315°-Spielkamera fast kantenparallel — Bogen verschmolz in der
3/4-Silhouette mit dem Körper (ART_STYLE 2.5). Fix: CHORD (−0.555, +0.145) =
Sehne VOR dem Arm, Ebene zeigt fast frontal zur Spielkamera; in der Front
kreuzt die dunkle Sehne nur Leder/Ärmel, nie Haut. Das erste v09-Sheet (mit
dem Befund) liegt im `_archiv`, ebenso v07+v08.
**Referenz-Sheet v10 ABGENOMMEN (2026-07-14)** — verbindliche Blaupause für den
Archer und Vorlage aller weiteren Menschen-Einheiten.
**POSEN v02 GERENDERT** (`archer_poses.py -- <pose>`; v01 blieb liegen; QA ohne
Warnungen, Blätter `qa_out/menschen_archer_<pose>_v02_qa.png`). Nutzer-
Korrekturen v01→v02 (2026-07-14):
- Offene rechte Hand als GESPIEGELTES Bauteil (`orient_matrix(..., mirror=
  True)` wie v10-Sheet) — Daumen zeigt zur Körpermitte.
- Bogenfaust: Ringmitte um FIST_OFF = Griffradius+Fingerdicke (~0.094) von
  der Bogenachse zur Ankerseite versetzt — Kontakt NUR über Fingerkapseln,
  Ballen/Handgelenk frei (GRIFF-CLEARANCE-Assert ≥ 0.01, Ballen +0.068).
- Wrist-Kegel der Faust NUR wenn der Arm von oben kommt (idle/walk) — bei
  Attack/Victory ragte er als Turm über die Faust (v01-Befund); dort endet
  die Arm-Röhre stattdessen im Faustkörper (END_R 0.085).
- Attack: Kopf-Yaw 50°→22° (bei 50° verlor die robinhood-Kapuze ihre
  Silhouette, Feder lag flach zur Kamera), Nock tiefer (0, 0.47, 1.30),
  Zugfaust −45° um die Pfeilachse gedreht (Daumen weg vom Kinn).
- NEUE Asserts: HAND-CHIRALITÄT (Daumenvektor pro Hand zur Körpermitte;
  Hände mit |x|<0.2 nur geloggt) + GRIFF-CLEARANCE (s. o.). GESICHT-FREI
  differenziert: Zughand ≥ 0.05 (0.293), Oberarm darf streifen ≥ 0.025
  (0.031 — läuft am Anker naturgemäß knapp am Mund vorbei).
**GRIFF-UMBAU IN ARBEIT (2026-07-14): Fäustlings-Verbund.** Neu in
`cartoon_parts.py`: `build_grip_fist` (geschlossener Fäustling: Blob +
Daumenhügel auf der Handinnenseite, KEIN Wrist-Kegel; lokal +x = Daumenseite,
Stabachse = lokale z durch den Ursprung) und `build_grip_unit` (Verbund
Faust + Holz-Stabsegment r 0.047 = Bogenholz im Griffbereich, tritt oben+
unten aus; wird in den Posen nur als GANZES platziert, der Bogen richtet
sich an der Stab-Achse aus). GRIFF-CLEARANCE-Assert entfällt für dieses
Bauteil (Stab steckt gewollt im Faustvolumen), HAND-CHIRALITÄT bleibt.
Nahaufnahmen (frontal/3/4/seitlich via `faust_griff_check.py` + PIL-Montage
`faust_montage.py`; QA-Blätter in `qa_out/`, Grasgrün, Spielgrößen-Patch
13 px, Alpha-Silhouette):
- `faust_griff_v01` — erster Wurf (Kugel-Daumenhügel, Eiform).
- `faust_griff_v02/v03` — Nutzer-Korrektur (Blob gestreckt/abgeflacht,
  Tropfen-Kapsel): Kapsel ragte noch als Daumen-Stummel heraus.
- `faust_griff_v04` — Buckel korrekt versenkt (überholt durch v05-Auftrag).
- `faust_griff_v05` — FEHLWURF der Rillen-Iteration: gerade Sehnen-Rillen
  standen von der anisotropen Ellipsoid-Fläche ab, Daumen-Kapsel zeigte ihre
  flache Endkappe. Lehre: Anbauteile auf dem Blob als FLÄCHEN-FOLGENDE
  gebogene tube-Kapseln bauen (`_surf(t, z, off)` in build_grip_fist:
  Ellipsoid-Punkt + Gradient-Normale; Enden off<0 im Blob, Mitte leicht
  proud).
- `faust_griff_v06` — Varianten A (Rillen + Daumen-Kapsel) / B (nur Rillen);
  überholt durch den v07-Auftrag (Rillen-Vergleich ohne Daumen).
- `faust_griff_v07` — FEHLWURF Variante W: Wülste standen als dicke
  Einzelfinger ~0.05 ab statt „tief verschmolzen".
- `faust_griff_v08` — 3-Rillen-Varianten L/W (überholt durch v09-Auftrag).
- **`faust_griff_v09` = ABNAHME-KANDIDAT, DREI VARIANTEN mit je 4 Rillen**
  (`build_grip_fist(M, pfx, grooves="cuts"|"lines4"|"bulges4")`):
  **K** = echte Boolean-Kerben (DIFFERENCE + shade_smooth). ⚠ Dokumentierte
  Shading-Artefakte (im Bericht gezeigt): dunkle Normalen-Verwerfungen an
  den Schnitträndern, Fläche zwischen den Kerben wellig — typisch für
  Boolean auf Smooth-Mesh ohne Remesh.
  **L2** = komplett bündig versenkte dunkle Furchenlinien (Ton ×0.75, kaum
  Relief). **W4** = vier leicht kleinere Fingerwülste (r max 0.033, Mitte
  ~0.013 proud), Kontur ruhig wellig. QA `qa_out/faust_griff_v09K/L2/W4_qa.
  png`: alle drei 13px-Patches sauber (keine dunklen Punkte, ruhige
  Silhouette).
**W4 ENDGÜLTIG EINGEFROREN (Nutzer 2026-07-14, nach Idle-v03-Kontext)** —
`build_grip_fist`-Default `grooves="bulges4"`. `archer_poses.py` nutzt den
VERBUND in allen Posen: Ringmitte = Bogenachse, Verbund als Ganzes platziert
(PALM fix: Daumen Azimut ~30° zur Mitte, Wülste in die az-315-Kamera), Arm
endet im Faustkörper (END_R 0.085), keine Leder-Griffwicklung (Bogenholz
läuft koaxial über dem Verbund-Stab), GRIFF-CLEARANCE entfernt,
HAND-CHIRALITÄT bleibt.
**POSEN v04 — BOGEN-GRIFF-FIX** (Riser): Bogen = gerader RISER-Abschnitt
(±0.23, Radius = Verbund-Stab 0.047·HAND_S) + Wurfarme mit Smoothstep-
Lateralprofil, tangentialer Anschluss; **BOGEN-GRIFF-Assert** (Stab koaxial
im Riser, kein Austritt). ⚠ Achtung: die v04-PNGs für idle/walk/victory
wurden beim v05-Lauf versehentlich mit v05-Geometrie überschrieben (Dateiname
erst nach dem ersten Lauf umgestellt); attack_v04 ist echt. v05 ist maßgeblich.

**POSEN v05 KOMPLETT — ARM-ANKER + PFEIL** (`menschen_archer_{idle,walk,attack,
victory}_v05.png`, alle Asserts grün, QA ohne Warnungen):
- **Arm-Anker neu (Ist-koaxial):** Arm-Ende sitzt in JEDER Pose auf dem Strahl
  Schulter→Blob bei Ellipsoid-Norm 0.82 im Faust-Blob (`BLOB_C`/`BLOB_SEMI`
  aus build_grip_fist). Vorher fixe Formel, die nur bei hängendem Arm im Blob
  lag → beim erhobenen Victory-Arm oben ausgetreten.
- **ARM-FLUCHT-Assert umgebaut** auf IST-Position des platzierten Verbunds:
  misst gegen die tatsächlichen Blob-Mesh-Punkte — Anker-Einbettung ≥ +0.005
  (ist +0.019…+0.025) UND Achswinkel Arm→Blobkern ≤ 30° (ist 1.9…11°).
  BEWEIS: gegen die v04-Konstruktion (`-- <pose> v04anchor`) schlägt er fehl
  (Victory: Einbettung −0.002, Winkel 40.3°).
- **Attack-Pfeil angehoben:** Ziel `ARROW_T` = knapp über der Faust-Oberseite
  (Bogenachse +0.17), `arrow_end` an ARROW_T verlängert (nicht mehr an GRIP →
  kein Rückdip). NOCK moderat 1.30→1.36. Neuer **PFEIL-FREI-Assert**:
  Zentrallinien-Eindringtiefe in den Blob ≤ +0.005 (ist −0.033 = Schaft über
  der Oberseite, keine Durchdringung). GESICHT-FREI weiter grün (Zughand
  0.255, Arm 0.025 = an der Grenze).
**POSEN v06 KOMPLETT — NOCK-KOPPLUNG + Schreibschutz** (`menschen_archer_
{idle,walk,attack,victory}_v06.png`, alle Asserts grün, QA ohne Warnungen):
- **Attack Pfeil eingenockt:** Sehne lief vorher 0.165 vor dem NOCK aus (an
  der Faust-Oberfläche), das Pfeil-Rückende lag daneben. Jetzt: beide
  Sehnenhälften treffen einen echten Apex = NOCK (Fingergriff), `ARROW_BACK`
  = Apex → Pfeil sitzt auf der Sehne. Neuer **NOCK-KOPPLUNG-Assert**
  (Attack): Abstand Pfeil-Rückende ↔ Sehnen-Apex ≤ 0.01 (ist 0.0000).
- SEHNE-ZUGHAND-Regel angepasst: Griff-Kontakt der Sehne mit den Zugfingern
  ist jetzt gewollt (die Faust hält Sehne+Nock), nur tiefe Körper-
  Durchdringung verboten (≥ −0.030; ist −0.020).
- **GESICHT-FREI verschärft:** rechter Arm ≥ 0.035 (war Punktlandung 0.025);
  NOCK leicht abgesenkt/versetzt (0.06, 0.48, 1.28) → Arm 0.043, Zughand
  0.321. PFEIL-FREI bleibt −0.033.
- **Schreibschutz** im Render-Skript: bestehende `_v06.png` brechen mit
  `SystemExit`-Meldung ab statt zu überschreiben (verifiziert). Behebt die
  v04-Clobber-Panne.
- idle/walk/victory unverändert zu v05 (nur Bogenarm/Verbund, keine
  Attack-Änderung betrifft sie).
**POSEN v07 — VERBINDLICHE KONVENTION (az 45, Licht oben-links)** (`menschen_
archer_{idle,walk,attack,victory}_v07.png`, alle Asserts grün, QA ohne
Warnungen; Schreibschutz aktiv, Dateiname v07):
- Kalibrierungs-Umstellung: Kamera **az 315 → az 45** (el 60 unverändert),
  Key-Sonne auf **lib_iso-Werte (50/12/35)** → Licht **oben-links**, identisch
  zur Gebäude-Pipeline (Archer + Gebäude teilen dieselbe Sonnenrichtung).
- Umsetzung: Figur wird nach dem Bau an **x=0 gespiegelt** (Eltern-Empty
  `mirror_root` scale.x=−1; Blender korrigiert Normalen bei negativer
  Objekt-Skalierung → keine Shading-Artefakte). az45 = Spiegelung von az315,
  Reflexion ist Isometrie → **alle Abstands-/Winkel-Asserts liefern identische
  Werte wie v06**, Figur nur seitenverkehrt (Bogen jetzt zur Kamera). Rein
  analytische Referenzen per `_mx` (x negiert) nachgezogen.
- Kamerabezogene Asserts auf az 45 verifiziert: GESICHT-FREI (Zughand 0.321,
  Arm 0.043), Fingerwülste zur az45-Kamera, HAND-CHIRALITÄT (Vorzeichen
  konsistent gespiegelt, Produkt erhalten → weiter „ok"). NOCK-KOPPLUNG
  0.0000, PFEIL-FREI −0.033.
- **Export-Master Idle v02:** `archer_export_master_512_v02.png` — 512×512,
  transparent, Framing höhenbegrenzt s=0.7155 (Körper ohne Bogen 200 px im
  Master; Anzeige der 512-Leinwand bei dispW ≈ 123 px ⇒ Körper = 48 px).
  **ANKER = FUSSPUNKT [0.5455, 0.8921]** (Mitte zwischen den beiden Stiefel-
  Sohlen), exakt aus der Kamera-Projektion der Sohlen-Kontaktpunkte (arg
  `footproj` in archer_poses.py: `world_to_camera_view` der `stiefel_sohle_L/R`
  → Render-Px → Master-Px), NICHT per Bild-Heuristik (Rock/Bogen verfälschen).
  Bogen ragt bewusst unter/neben den Fußpunkt. In `humans/units/archer`-Manifest
  eingetragen; Regel in ASSET-PIPELINE.md §2 festgehalten (Anker = Fußpunkt für
  alle Einheiten, Ausrüstung darf überstehen).
  ⚠ Ziel-Pfad `factions/menschen/units/` weicht vom Ist ab (App nutzt
  `humans`, kein `units/`-Ordner) — Master NICHT platziert, Stopp zur Sichtung.
**Nächster Schritt:** Nutzer-Sichtung v07 + Master v02 → App-Ablage
(Pfad/Fraktionsname `menschen` vs `humans` klären).

## Offene, **nicht blockierende** Feinschliff-Punkte

- [ ] **Abstehender Kapuzenrand in der Front einen Hauch dünner.** Fassung B
      (robinhood) — der weich abstehende Stoffrand um das Gesichtsoval wirkt in
      der Frontansicht minimal zu dick. In `cartoon_parts.py` den Rand-Aufweitungs-
      Faktor (`v.co + v.co.normalized() * 0.03`) leicht reduzieren oder die
      Solidify-Dicke am Rand feiner abstimmen.

- [ ] **Daumen der offenen Hand sitzt etwas tief.** Für Einheiten, die die offene
      Hand prominent zeigen, den Daumenansatz höher an die Handkante rücken.
      In `cartoon_parts.py`, `build_open_hand()`: Basis-z des `daumen`-Aufrufs
      (`HC + (0.088, -0.012, -0.038)`) anheben.

- [x] **Bogensehne sehr dünn und hell — ging bei 80px unter.** ERLEDIGT 2026-07-12
      (Sheet v08): Radius 0.012 → 0.022, Farbe fast-weiß → dunkles Braungrau.
      80px-Test bestanden (Zoom geprüft). Lehre in ART_STYLE §4 + sprite_qa Frage 4.

- [ ] **Rechte Hand wirkt mit gespreizten Fingern etwas steif.** (Sheet v07.)
      Für den nächsten Durchgang: Finger der offenen Hand enger zusammen /
      stärker gekrümmt (OPEN_FING-`spread`- und `curl`-Werte in `cartoon_parts.py`).

## Bewusste Entscheidungen (KEINE Bugs — nicht "fixen"!)

- **Mund-Decal im strengen 90°-Seitenprofil stark verkürzt** (winziger Strich/
  Punkt an der Silhouette). Entscheidung 2026-07-11 nach Vergleichsrender
  `MUND_profil_check_v01.png`: In der 3/4-Spielperspektive sitzt der Mund sauber
  und mittig; die Verkürzung bei exakt 90° ist reine Perspektiv-Geometrie eines
  flachen Shrinkwrap-Decals und im Spiel nie sichtbar. Der Mund bleibt wie er ist.

---
Abgenommen: nackter Cartoon-Kopf (2026-07-09), Kapuze Fassung B = robinhood
(Standard für Archer + Blaupause aller Einheiten). Fassung A = "kompakt" bleibt
als Parametersatz für Porträt/Marketing. Hände (offen + greifende Faust,
glatte Röhren-Bauweise) abgenommen 2026-07-10. Cartoon-Körper-Grundform
(`build_body`) abgenommen 2026-07-11; Gesamtproportion Kopf+Kapuze+Hände
(Kopfhöhen 2,68, Kapuze/Schulter 1,06, Kapuzen-Tiefensitz) abgenommen 2026-07-11.
