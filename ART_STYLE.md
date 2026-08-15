# ART_STYLE.md – Verbindlicher Art-Style-Guide für Village-Wars

> Diese Datei ist die oberste Instanz für alle Charakter- und Einheiten-Assets.
> Jede Asset-Generierung (KI-Prompt, Blender, Nachbearbeitung) MUSS diesen Regeln folgen.
> Bei Konflikt zwischen einem Prompt und dieser Datei gewinnt diese Datei.

---

## 1. Ziel-Look in einem Satz

Stilisierter, freundlicher Mobile-Strategy-Look: übertriebene Chibi-Proportionen,
große flache Farbflächen, dicke saubere Outlines, sofort lesbar bei 80 px Höhe.

**Nicht-Ziel:** Semi-realistische, painterly Fantasy-Illustration. Keine realistische
Anatomie, keine Mikromuster, kein fotorealistisches Licht.

---

## 2. Harte Regeln (nicht verhandelbar)

### 2.1 Proportionen
- Körperhöhe = 2,5 Kopfhöhen (Toleranz: 2,0 bis 3,0)
- Kopf, Hände und Waffen deutlich übergroß (Waffe mind. 60 % der Körperhöhe)
- Beine kurz und stämmig, Füße groß und einfach (keine detaillierten Schnürungen)
- Hals kaum sichtbar, Kopf sitzt fast direkt auf den Schultern

### 2.2 Farben
- 70/20/10-Regel:
  - 70 % Fraktions-Primärfarbe und deren Abstufungen
  - 20 % Sekundärfarbe (Leder, Holz, Metall)
  - 10 % Akzentfarbe (Waffenspitze, Gürtelschnalle, Federn)
- Fraktionsfarbe muss die größte zusammenhängende Fläche des Sprites sein
  (Torso/Kleidung), NICHT die Hautfarbe
- Max. 6 bis 8 unterscheidbare Farbtöne pro Einheit
- Haut ist immer bedeckt genug, dass sie nicht dominiert (kein nackter Oberkörper
  als Standard; Ausnahme nur, wenn es das Erkennungsmerkmal der Einheit ist,
  dann kompensieren mit großem farbigem Kleidungsstück wie Kilt + Umhang)

### 2.3 Shading und Linien
- Flat Cel-Shading: max. 2 Schattenstufen + 1 Highlight
- Outlines sind OPTIONAL. Standard ist der glatte Soft-Figuren-Look OHNE
  Outlines (Entscheidung 2026-07-05). Wenn Outlines in Sonderfällen eingesetzt
  werden: dick und sauber, dunkler Ton der jeweiligen Lokalfarbe, kein reines
  Schwarz
- Materialregel (2026-07-05, gilt für ALLE Einheiten): Materialien MATT halten.
  Kleiner, weicher Glanzpunkt erlaubt, kein Chrom-Effekt / keine großen weißen
  Glanzflächen — auch nicht auf Metall
- Keine Texturen unter 4 px Strukturgröße im finalen Sprite:
  KEIN Karo/Tartan, KEINE Kettenhemd-Ringe, KEINE Fell-Einzelhaare,
  KEINE Adern/Muskeldefinition, KEINE Stofffalten-Schraffur
- Fell/Stoff nur als gewellte Silhouettenkante andeuten, nicht als Muster

### 2.4 Gesicht
- Große, einfache Gesichtszüge: klare Augen (oder markante Augenbrauen),
  große Nase erlaubt, Bart als eine geschlossene Form
- Augen dürfen NIEMALS von Kopfbedeckung/Stirnband verdeckt sein
- Gesicht muss bei 80 px noch als Gesicht erkennbar sein

### 2.5 Silhouette
- Jede Einheit muss als reine schwarze Silhouette eindeutig identifizierbar sein
- Rollen-Erkennung über Form: Fernkämpfer = Bogen prominent seitlich abstehend,
  Nahkämpfer = Waffe + Schild klar getrennt vom Körper
- Keine Pose, bei der Waffe oder Arme mit dem Körper zu einem Klumpen verschmelzen

### 2.6 Kamera und Format
- Ansicht: leicht erhöhte 3/4-Perspektive (ca. 30 Grad von oben), passend zur
  Spielkamera
- Freigestellt auf transparentem Hintergrund, Figur füllt 85 bis 90 % der Bildhöhe
- Bodenkontakt: beide Füße auf einer gedachten Bodenlinie (wichtig fürs Placement)
- Keine Bodenschatten im Sprite (Schatten kommt aus der Engine)

---

## 3. Fraktions-Farbpaletten

> Führende Quelle für Farb- und Design-Fragen: die Fraktions-Übersichtsblätter
> in `design/referenzen/fraktionen/` (Entscheidung 2026-07-05).

| Fraktion              | Primär                 | Sekundär                        | Akzent            |
|-----------------------|------------------------|---------------------------------|-------------------|
| Menschen Königreich   | #2A5AA0 Königsblau     | #A9AEB6 Stahl / #7A5230 Leder   | #D8A94E Gold      |
| Zwergen Klanreich     | (festlegen)            | (festlegen)                     | (festlegen)       |
| Riesenreich           | (festlegen)            | (festlegen)                     | (festlegen)       |
| ... übrige Fraktionen | (festlegen)            | (festlegen)                     | (festlegen)       |

> Menschen-Werte abgeleitet aus dem Fraktionsblatt (gemessen: Dächer #204B78,
> Stahl #A09B86, Leder #6E502A, Gold #D6AA5A; für 80px-Lesbarkeit aufbereitet).
> TODO Ufuk: Paletten der restlichen Fraktionen eintragen, BEVOR deren Einheiten
> generiert werden. Regel: Keine zwei Fraktionen mit ähnlicher Primärfarbe.
> Grün ist für die Elfen reserviert.

---

## 4. Verbindlicher Workflow pro Einheit

1. **Referenz-Sheet zuerst:** Ein Turnaround-Bild (Front, 3/4, Seite, Rücken)
   in neutraler A-Pose generieren. Erst wenn dieses Sheet von Ufuk abgesegnet
   ist, dürfen Posen/Varianten erzeugt werden.
2. **Jede weitere Generierung** (Posen, Animationsframes, Skins) verwendet das
   abgesegnete Referenz-Sheet als Bildinput. Reine Text-Prompts sind ab diesem
   Punkt verboten, weil sie Inkonsistenz erzeugen (wechselnde Ausrüstung,
   Farben, Details).
3. **Ausrüstungs-Checkliste** pro Einheit führen (z. B. Archer: Stirnband ÜBER
   den Augen, Köcher auf dem Rücken links, Armschiene nur linker Unterarm,
   Pfeilspitzen grau). Nach jeder Generierung gegen die Liste prüfen.
4. **QA-Pflichttests vor Abnahme** (Skript: tools/sprite_qa.py):
   - Scale-Test: Sprite auf 80 px Höhe auf Grasgrün (#6A994E). Einheit und Rolle
     in unter 1 Sekunde erkennbar? Sonst Rework.
   - Dünne helle Details (Sehnen, Riemen, Fäden, Schnüre) müssen den 80px-Test
     einzeln bestehen, sonst verschwinden sie im Spiel — dicker und/oder dunkler
     bauen (Lehre Archer-Bogensehne 2026-07-12; gilt für alle Einheiten).
   - Silhouetten-Test: Sprite als schwarze Silhouette. Einheit von allen anderen
     Einheiten der Fraktion unterscheidbar? Sonst Rework.
   - Alpha-Check: Bounding Box korrekt, keine abgeschnittenen Gliedmaßen,
     keine halbtransparenten Artefakte (bekanntes Problem aus dem v0.2-Pack).
5. **Dateinamen-Konvention:** `fraktion_einheit_zweck_vXX.png`
   Beispiel: `menschen_archer_ref-sheet_v01.png`, `menschen_archer_idle_v01.png`
6. **Rendering-Standard (Entscheidung 2026-07-05):** Alle Spiel-Sprites sind
   PURE Soft-Renders aus Blender (Cycles, weiches Licht, ohne KI-Nachbearbeitung).
   Der img2img-Pass mit IP-Adapter (`design/blender/_scripts/gen_ai_pass.py`) bleibt als
   OPTIONALES Werkzeug ausschließlich für Marketing-Renders erhalten und wird
   für Einheiten-Sprites NICHT verwendet.

---

## 5. Verbotsliste (häufige Fehlerquellen)

- Realistische 7-Kopf-Proportionen
- Nackte, muskeldefinierte Oberkörper als Farbträger
- Tartan-/Karomuster und alle Muster unter 4 px
- Painterly-Rendering, weiche fotorealistische Lichtverläufe
- Kopfbedeckungen, die Augen verdecken
- Uneinheitliche Ausrüstung zwischen Varianten derselben Einheit
- In-Sprite-Schatten auf dem Boden
- Text oder Level-Zahlen ins Sprite einbacken (bekanntes Problem aus dem
  Gebäude-Pack: Level-Texte gehören in die UI, nicht ins Asset)
