# Blender-Render-Pipeline für Menschen-Gebäude (Village Wars / P10-Grafik)

> **Zweck:** Hochwertige isometrische Gebäude-Sprites **per Code** in Blender erzeugen
> (3D-Modell aus Primitiven → gerendertes 2D-Sprite, der CoC-Weg). Vollständig headless
> über die Kommandozeile steuerbar — KEINE GUI-Bedienung nötig. Das ersetzt den
> verworfenen UE5-Sprite-Ansatz (siehe ganz unten).

## Tooling
- **Blender 4.2.3 LTS portable** (kein Admin, kein Installer):
  `C:\Users\Ufuk\vw_blender\blender-4.2.3-windows-x64\blender.exe`
- Render-Engine **EEVEE Next** (schnell, mit Schatten + Ambient Occlusion).
- Headless Python-API (`bpy`) — verifiziert lauffähig.

## Aufruf
```powershell
$blender = "C:\Users\Ufuk\vw_blender\blender-4.2.3-windows-x64\blender.exe"
& $blender --background --python <script>.py -- <args...>
# z.B. Rathaus Tier 3:
& $blender --background --python town_hall_tiered.py -- 3 out_th_tier3.png
```
> Hinweis: Blender wirft beim Start die harmlose Zeile `TBBmalloc: skip allocation …`
> und gelegentlich Exit-Code 255 — solange `RENDERED <pfad>` erscheint und das PNG
> existiert, ist alles ok. Bilder zum Ansehen ggf. auf dunklen BG legen (transparent).

## Dateien
- **`lib_iso.py`** — Helfer-Bibliothek:
  - Geometrie: `box`, `cylinder`, `cone`, `roof_prism` (Satteldach), `hip_roof`
    (Walmdach, **liest sich in Iso am besten**), `pyramid`, `battlement_ring` (Zinnen),
    `shingle_roof`, `banner` (Mast+Wimpel), `crystal` (Magie).
  - `mat(name, rgb, rough, metal, emis)` — Principled-BSDF-Material. **CoC-Trick:**
    Materialien bewusst **rau** (rough ~0.9–1.0) für schöne Farbverläufe.
  - `setup_iso_camera(ortho_scale, target_z)` — **WICHTIG:** Kamera steht Süd-Ost-oben
    (60° vom Zenit = 30° über Horizont) und sieht die **+Y-Fläche (= Gebäude-FRONT mit
    Tor/Fenster)** und die +X-Fläche. → Tor/Fenster IMMER auf **+Y** modellieren, sonst
    zeigen sie von der Kamera weg (dieser Fehler kostete in v1/v2 Zeit).
  - `setup_lights()` — Sonne (weiche Schatten) + Himmel-Fülllicht.
  - `render_png(out, res)` — EEVEE, transparenter Hintergrund (`film_transparent`),
    `Standard`-View-Transform (flache satte Farben, kein Filmic), AO an.
- **`themes.py`** — **das Tier-System** (vom Nutzer abgesegnet): `THEMES[1..5]` = Material-
  Sets (Farben) + Stil-Flags je Tier; `tier_for_level(level)` mappt Gebäude-Level 1..15
  auf Tier 1..5 (je 3 Level). **Alle Gebäude teilen pro Tier dasselbe Thema.**
  - Tier 1 (Lv1-3): **Holz**, baufällig, Strohdach, kein Gold (`decay`-Flag macht schief).
  - Tier 2 (Lv4-6): **Stein+Holz**, rotes Ziegeldach.
  - Tier 3 (Lv7-9): **Sandstein-Burg**, Zinnen, 2 Türme, blaue Dächer, Gold.
  - Tier 4 (Lv10-12): **Edel/Marmor**, 4 Türme, viel Gold.
  - Tier 5 (Lv13-15): **Magie/Episch**, violette Spitzdächer + Kristalle, leuchtend.
  - Stil-Flags je Tier: `roof_style` (thatch/tile/hip/spire), `battlements`, `towers`
    (0/2/4), `gold`, `magic`, `decay`, `scale`.
- **`town_hall_tiered.py`** — parametrisches **Rathaus** (erstes Referenz-Gebäude).
  Arg `<tier> <out.png>`. `build_cottage()` für Tier 1-2 (Haus), `build_castle()` für
  Tier 3-5 (Burg). **Das ist die Vorlage für alle weiteren Gebäude.**
- **`barracks_tiered.py`** — **Kaserne** (2. Gebäude, FERTIG + abgesegnet). **Nimmt jetzt
  `<level 1..15> <out.png>`** (nicht mehr Tier!). Daraus `tier = tier_for_level(level)` +
  `stage = (level-1)%3 + 1` (Baustufe 1..3 INNERHALB des Tiers). **Jeder Level-Up verändert
  sichtbar die Struktur**, beim Tier-Wechsel zusätzlich das Material-Thema. Regel (vom Nutzer
  bestätigt): **NUR Level 1 ist die kaputte Ruine** (Dachloch, Wandlöcher, schief, Schutt);
  alle weiteren Level sind intakt und werden **additiv besser** bis zur nächsten Tier-Stufe
  (stage1 schlicht → stage2 erste Aufwertung → stage3 Vollausbau). Funktionen: `build_hut()`
  T1-2, `build_hall()` T3-4, `build_arcane()` T5. **Tier 5 = „Arkane Garnison"** (eigener,
  krasserer Look: dunkler Magiestein-Override, leuchtende Kristall-Türme, Energie-Adern,
  Portal-Tor; **Level 14** = Kristallkern + Schwert-im-Stein-Monument im Runenkreis;
  **Level 15 = „Ascension"** = Energiestrahl + Glüh-Ringe + schwebende Kristall-Inseln +
  Orbit-Splitter + großer Bodenkreis). Kaserne-Signatur (ab Vollausbau): Schwerter-Wappen
  über dem Tor, Speerständer, Trainingspuppe. Tier 4 hat ab Level 10 schon 2 Türme (damit
  Level 7/T3 vs Level 10/T4 klar verschieden sind). Helfer im Skript: `thatch_roof`
  (dickes Strohdach + First-Wulst + `damaged`-Schaden), `build_tower`, `brazier` (Feuerschale,
  `fm`/`fc` für Magie-Flamme), `floating_sword`, `sword_monument`, `rune_circle`, `crossed_swords`.
- **`watchtower_tiered.py`** — **Wachturm** (3. Gebäude, 15-Level-Schema, vom Nutzer abgenommen).
  Verteidigungsgebäude, hoch & schmal (eigene Silhouette): `build_wood_tower()` T1-2
  (Holzgerüst-Turm, T2 mit Steinsockel), `build_stone_tower()` T3-4 (runder Steinturm),
  `build_arcane_tower()` T5 (dunkler Kristall-Magieturm). **Durchgehend OFFENE Wehrplattformen**
  (KEINE Dachspitzen — bewusste Nutzer-Entscheidung). **Jede Stufe hat ein Geschütz, dessen
  Größe je Baustufe wächst** (`WU = {1:0.55, 2:0.78, 3:1.0}[stage]`). **Je Tier eine EIGENE Waffe:**
  T1 = **Balliste** (`war_engine`, geneigter Bolzen über die Brüstung), T2 = **Katapult** (`catapult`:
  Schlittenrahmen + Eisenbeschläge + Torsions-Sehnenbündel + Wurfarm mit Löffel + Felsbrocken +
  Spannseil + Speichenräder + Munition), T3 = **Minigun** (`minigun`: rotierendes 6-Lauf-Bündel +
  Munitionskasten), T4 = **Kanone** (`cannon`, `fancy=stage` → je Stufe prächtiger: Eisen →
  Gold-Ringe → Gold-Mündungsglocke; alle mit dunklem **Mündungsloch**), T5 = **Kristall-Geschütz**
  (`war_engine` magic-Zweig: Arkanstein-Lauf + Energie-Adern + Runen-Ringe + Kristall-Fokus +
  geladener Energieball + Orbit-Kristalle). Nur Level 1 = Ruine (Mini-Balliste auf fester Plattform).
  ⚠️ Emissive Magie-Materialien (rune/mflame/crystal) bewusst gedämpft (emis ~1.4–2.4), sonst
  überstrahlt in EEVEE alles zu Weiß. **WICHTIGE Helfer (robust gegen das
  L.box-location-Baking):** `strut(p1,p2,...)` (Balken zwischen 2 Punkten — Box am Ursprung
  bauen, DANN rotieren+verschieben) und `rod(p1,p2,r,...,r2=)` (Zylinder/Kegel zwischen 2
  Punkten). **Merke:** `L.box(...).rotation_euler = ...` rotiert um den fernen Nullpunkt
  (location ist ins Mesh gebacken) → Objekt schwingt weit raus; für gedrehte Boxen IMMER
  `strut`/`rod` nutzen. `L.cylinder(...).rotation_euler` ist dagegen ok (cylinder backt nicht).
- **`gold_mine_tiered.py`** — **Goldmine** (4. Gebäude, 15-Level, vom Nutzer abgenommen).
  Ressourcengebäude: **kantiges Fels-Massiv** (Low-Poly-Klippenstock aus leicht verdrehten
  `obox`-Blöcken in 3 Schichten + facettierte Kegel-Spitze — NICHT aus Ikosphären, das las
  sich als „Kugelhaufen") mit **Stollen in die Frontwand geschnitten** (dunkler `throat`-
  Hohlraum + Felswand ÜBER dem Sturz), Holz-Portalrahmen (2 Pfosten + Sturz + Kopfbänder),
  Schienen + Loren mit Golderz (Räder blau, CoC-Wiki), Grubenlaterne, Spitzhacke, Erdplateau
  („Minenhof"), Goldadern-Nuggets auf den Felsfronten (mehr je Tier). Progression: L1 Ruine
  (Portal eingestürzt, Stollen verschüttet, Lore umgekippt) → T1 krummes Portal → T2 +
  Holz-Verstärkungsbalken → T3 Stahlbalken + Förderrad MIT Seil+Eimer → T4 höher + Zahnrad +
  Stachel-Ecken → T5 leuchtende Runen-Balken/-Rad. **Erz bleibt IMMER Gold** (Nutzer-Vorgabe),
  nur Trim/Rahmen werden edler. ⚠️ **Neuer Helfer `obox(name, center, size, mat, rot=)`** —
  rotierbare Box nach dem strut-Muster (bei (0,0,0) erzeugen → skalieren → rotieren → DANN
  verschieben); `transform_apply` backt in 4.2 auch bei `location=`-Erzeugung die Position
  ins Mesh, d. h. auch dieser Weg rotiert sonst um den Weltursprung (hat die Ruinen-Lore
  unsichtbar gemacht — per Probe-Skript bewiesen). Große Emissiv-Flächen (Runen-Balken/Rad)
  brauchen ein eigenes gedimmtes Material (`rune_bar`, emis 0.15), sonst Weiß-Clipping.
- **`lumber_camp_tiered.py`** — **Holzfäller-Lager** (5. Gebäude, 15-Level, abgenommen
  2026-07-02 „perfekt"). ⚠️ **NEUE DESIGN-REGELN vom Nutzer (gelten ab jetzt für ALLE
  Gebäude):** (1) **Level 1 ist FUNKTIONSTÜCHTIG** — keine Ruine mehr (altes „nur L1 =
  Ruine"-Schema ist tot), sondern der kargste arbeitsfähige Start. (2) **JEDES Level
  unterscheidet sich SICHTBAR** — kumulative Progression, pro Level ein klar erkennbares
  neues Element (nicht nur 3 Baustufen je Tier). (3) **NICHTS darf schweben** — schwebende
  Deko liest der Nutzer als Fehler (schwebende Magie-Stämme wurden 2× reklamiert und durch
  einen geerdeten Runen-Obelisken ersetzt; an Seilen HÄNGENDE Lasten am Kran sind ok).
  Level-Kette: L1 Stumpf+Axt/leerer Sägebock → L2 +Stamm+Handsäge+Stapel → L3 +Lean-to →
  L4 Ziegel-Unterstand+Zaun → L5 +Schleifstein+Karren → L6 +Werkzeugwand+Bretter → L7
  TISCHKREISSÄGE (Blatt ragt durch die Bank, Zähne nur am freien Halbkreis) → L8 +Stamm-
  Rutsche → L9 +Lagerschuppen+Banner → L10 +KRAN m. hängendem Stamm+Gold-First → L11
  +Bretterturm+Goldnabe → L12 +Gold-Zähne/-Kappen/-Prunkaxt → L13 violett+Runenblatt+
  Kristall → L14 +Runen-Obelisk → L15 „Ascension": Runen-First+Dacheck-Kristalle+Energie-
  Ader im Boden+Kristall-Stamm auf Stapel+Runenkreis+Kristallbäume. Helfer: `log_x`
  (Stamm m. hellen Schnittflächen), `log_pile`, `plank_stack`, `sawhorse`, `lean_to`,
  `shelter(back_wall,tools)`, `grindstone`, `circular_saw`, `log_cart`, `log_ramp`,
  `shed`, `crane`, `rune_obelisk`, `rune_circle`, `crystal_pine`.
- **Die 3 Lager** (`storage_wood/stone/gold_tiered.py`) — ⚠️ Nutzer-Vorgabe: Lager dürfen
  NICHT 1:1 gleich aussehen → drei bewusst verschiedene Silhouetten: **Holzlager = hohe
  Brennholz-KRIPPE mit Dach** (Stämme entlang Y, helle Schnittflächen zur Kamera, Füllstand
  wächst `min(2+level//2, …)`, Gold-/Kristall-Stämme als T4/T5-Specials, Dacheck-Kristalle
  AUF Balkenenden — abgenommen 2026-07-02), **Steinlager = flacher massiver BUNKER**
  (U-Kammern mit Block-Gitter, Stapel ragen über die Mauerkrone — Lesbarkeits-Regel: die
  Ressource muss SICHTBAR sein, hohe Mauern = „Ruinen-Labyrinth"-Falle; wall_h nur
  0.55/0.68/0.8), **Goldlager = runde SCHATZKAMMER** (Tresor-Kessel auf Steinsockel,
  Goldhaufen quillt oben raus `heap=min(0.12+0.045·lvl, 0.62)`, Eisentür m. Schloss, L10
  Gold-Zierkranz, L12 Gold-Gitterkuppel, L14 Runenring, L15 Kristall-Nuggets+Glyphe).
  ⚠️ Schwebe-Falle: angelehnte Deckel/Scheiben (rotation um X) heben die Unterkante vom
  Boden ab → Deckel FLACH auf den Boden legen (`lid_flap`, z0+0.03).
- **`make_progression.js`** (sharp) — 5 Tier-Renders nebeneinander.
  **`make_level_strip.js`** — beliebige Bilder + Custom-Labels in einem Streifen.
  **`make_grid.js`** — die 15 Level-Renders als **5×3-Grid** (Zeile = Tier, Spalte = Level):
  `NODE_PATH=C:\Users\Ufuk\vw_imgtools\node_modules node make_grid.js out_barr_lvl GRID_barracks.png "Kaserne"`.
  ⚠️ **Anzeige-Limit:** Übersichtsbild Höhe ≤ ~1100 px halten, sonst zeigt der Client es
  nicht (1760-px-Grid blieb unsichtbar → mit sharp `{height:1040}` herunterskalieren), oder
  per `Start-Process <png>` direkt im Windows-Bildbetrachter öffnen.
- Outputs: `out_barr_lvl01..15.png` (Kaserne), `out_th_tier1..5.png` (Rathaus),
  Vergleichsbilder `GRID_barracks.png` / `PROGRESSION_*.png`.
- Ältere Iterationen (Referenz): `town_hall.py` (v1), `town_hall_v2.py`, `town_hall_v3.py`.

> **Hinweis Rathaus:** `town_hall_tiered.py` nutzt noch das ALTE 5-Tier-Schema (arg `<tier>`).
> Für Konsistenz müsste es später auch auf das 15-Level-System (3 Baustufen je Tier, nur L1
> Ruine) umgestellt werden — analog zur Kaserne.

> **Bugfix `hip_roof`/`roof_prism` (lib_iso.py):** Die "oberen" Dach-Verts wurden per
> `v.co.z > 0` bestimmt — falsch, sobald Blender die `location` in die Mesh-Koordinaten
> backt (lokale z dann alle > 0 → das ganze Dach kollabiert zu einer senkrechten Platte).
> Jetzt relativ zum Mesh-Mittelpunkt (`z > zmid`, First bei `ymid`/`xmid`). **Verbessert
> auch das Rathaus** (dort war das Hauptdach latent kollabiert, nur durch die 4 Türme +
> Oberetage verdeckt) → `PROGRESSION_town_hall.png` neu gerendert.

## Workflow (vom Nutzer gewünscht)
1. Gebäude per Code modellieren (neues `<gebaeude>_tiered.py`, nutzt `lib_iso` + `themes`).
2. Rendern → Screenshot ansehen (Read auf das PNG; ggf. auf dunklen BG legen).
3. Dem **Nutzer zeigen** → Feedback → iterieren, bis es passt.
4. Erst **nach Freigabe** in die App einbinden.

## Stil-Entscheidungen (abgesegnet)
- 5 Material-Tiers wie oben, **Progression Holz→Stein→Burg→Marmor→Magie** (Nutzer: „klingt gut").
- CoC-Recherche bestätigt: TH1 Holz/schief, Stein ab ~TH5, Gold/Zinnen ab ~TH6-8,
  Thema-Wechsel (dunkler Stein/Magie) ab ~TH9. Quelle: CoC-Fandom Town_Hall/Upgrade_Differences.
- Walmdach (`hip_roof`) statt Satteldach — sieht in Iso voluminöser/klarer aus.

## NÄCHSTE SCHRITTE
1. Restliche Gebäude bauen (je `_tiered.py`, Form modellieren, Theme automatisch).
   **Fertig + abgesegnet:** ~~town_hall~~ (5 Tiers, noch nicht auf 15 Level umgestellt),
   ~~**barracks**~~ (volles 15-Level-System — Referenz für das Level-/Baustufen-Schema),
   ~~**watchtower**~~ (15-Level, offene Wehrplattformen + skalierende Geschütze/Katapult),
   ~~**gold_mine**~~ (15-Level, Fels-Massiv + Stollen, abgenommen 2026-07-02),
   ~~**lumber_camp**~~ (15-Level, kumulative Sichtbar-Progression, abgenommen 2026-07-02),
   ~~**quarry**~~ (15-Level, Berg mit Abbau-Terrassen, Gestein wandelt sich je Tier
   Grau→Sandstein→Marmor→Arkanstein, abgenommen 2026-07-02; `quarry_tiered.py`).
   ~~**storage_wood**~~ (Krippe), ~~**storage_stone**~~ (Bunker), ~~**storage_gold**~~
   (Schatzkammer) — alle 3 Lager abgenommen 2026-07-02. ⚠️ **RESSOURCEN-REGEL** (Nutzer):
   die gelagerte/geförderte Ressource wird NIE vom Tier mitgefärbt — Steinblöcke immer
   grau (eigenes `res`-Material), Erz immer Gold; Gold-/Runen-Schmuck gehört ans GEBÄUDE
   (Pfeilerkappen, Relief, Klammern), nie an die Ware.
   ~~**cannon**~~ (abgenommen 2026-07-02; `cannon_tiered.py`). ⚠️ **WAFFEN-REGEL**
   (Nutzer, gilt für alle Verteidigungen): die Upgrades zeigen sich ZUERST an der
   Waffe selbst (wächst mit JEDEM Level + pro Level ein neues Bauteil), Umgebung
   ist Zweitschicht; Mündungen brauchen sichtbare BOHRUNG (bore-Scheibe ragt aus
   der Rohrstirn — kein Boolean nötig); Waffen-Material darf je Tier wechseln
   (Gusseisen→Bronze→poliert→Arkan).
   ~~**wall**~~ (abgenommen 2026-07-03; `wall_tiered.py` — Mauersegment, Palisade→Stein-
   Blockstruktur→Burg→Marmor→Arkan; ⚠️ Nutzer wollte 2× mehr: „mehr Variation/epischer"
   → Rezept: Fackeln m. Wandhalter, Schießscharten, Blendbögen, Wimpel, Maschikuli,
   Rosetten, Sonnen-Emblem, Runen-Schriftzeile, Energie-Risse aus den Bögen, Arkan-
   MONOLITH statt Mittelzinne, Kristall-CLUSTER, Beschwörungskreis-Siegel am Boden.
   Boden-Deko muss LESBAR sein: Adern beginnen sichtbar am Fundament, nicht verstreut).
   ~~**clan_castle**~~ (abgenommen 2026-07-03; `clan_castle_tiered.py` — Festung:
   Bergfried m. battlement_ring-Zinnenkranz, Torbogen m. Fallgitter (leuchtet ab T5),
   4 Ecktürme m. Kegeldächern, Vorhof-Mauern, Erker, Kristall-Krone + Portal-Ring L15).
   ~~**research_lab**~~ (abgenommen 2026-07-03 „perfekt"; `research_lab_tiered.py`).
   ⚠️ **HERZSTÜCK-REGEL + KONKURRENZ-CHECK** (Nutzer, Dauer-Regel für ALLE weiteren
   Strukturen): VOR jedem neuen Modell erst CoC-Fandom + andere Strategiespiele im Netz
   recherchieren, deren Signatur-Element identifizieren und mit einem eigenen **Herzstück**
   toppen — ein Signatur-Element, das mit JEDEM Level wächst/mutiert (nicht nur Material-
   Tint); Level-Deltas müssen SPEKTAKULÄR sein. Labor-Herzstück: **Riesen-Elixierkolben**
   (`big_flask`, `fr = 0.18 + 0.03·level`, Tier-Farben grün→amber→gold→arkanblau, Fassung
   Holz→Stein→Kupferkrone→Gold-Klauen→Kristallring), drumherum Tier-Mutationen: Seitentanks
   (L5/6), Zahnräder, Kaskaden-Destille (L8), Teleskop (L9), Astrolab aus Gold-Tori (L11),
   Ausleger-Arme m. Schwesterkolben (L12), Elixier-Überlauf-Rinnsale + Beschwörungskreis
   (L15). ⚠️ Elixier-Emission tierabhängig dimmen ({1:0.55 … 5:0.3}), helle Farben clippen
   sonst weiß. ⚠️ **Iso-Falle:** Requisiten-Ketten (Kaskaden-Kessel) NIE diagonal in +X UND
   +Y versetzen — die Versätze heben sich im Bild auf und alles stapelt sich optisch zum
   „Totem"; entlang EINER Achse marschieren lassen. Lange dünne Rohre quer über die Fassade
   vermeiden — Zuleitungen kurz + flach aus der Wand (mit Flansch) führen.
   ~~**hero_hall**~~ (abgenommen 2026-07-03 „sieht gut aus"; `hero_hall_tiered.py`).
   Herzstück: **KOLOSSAL-HELDENSTATUE** m. gerecktem Schwert (`hero_statue`, st = 0.50 +
   0.045·level, Klinge wächst pro Level), Material je Tier Holzfigur→Stein→Bronze→Marmor
   m. Gold-Schwert→Obsidian m. Runen-Augen + Kristallklinge; ab L11 echte GOLD-KRONE
   (CoC-Kronen-Motiv wörtlich getoppt). Halle mutiert je Tier: Holzschrein→Steinhalle→
   Säulen-Portikus m. Kronen-Zahnband→Marmor m. Gold-First/Traufe/Kapitellen+Triumphbogen→
   Arkan-Pantheon m. Spitzturm; L15 Apotheose (Klingen-Glüh + Energie-Ringe um die Klinge,
   Beschwörungskreis, Adern, Kristalle). ⚠️ **hip_roof-Falle:** `center` ist das
   VOLUMEN-Zentrum (Basis = z − h/2) — wer die Basis übergibt, versenkt das halbe Dach
   in der Wand („flache Wanne"); Dachneigung ≥ ~35° wählen, sonst liest die Iso-Kamera
   (30° über Horizont) die Flächen als flach. ⚠️ Dachfarbe IMMER `T["roof"]` aus
   themes.py (T3/T4 royalblau, T5 violett) — NICHT `T["accent"]` (= Gold ab T3).
   ⚠️ Kompositions-Regel: großes Vorhof-Herzstück (Statue) und Fassade per Versatz
   trennen (Halle hx = −0.30 nach Bild-rechts, feste Fassadenlinie FY, Statue-Sockel
   gedeckelt `min(…, 0.42)`), sonst verdeckt das Herzstück Tür/Portikus.
   **ALLE GEBÄUDE FERTIG.** **Offen:** Einheiten + ggf. weitere Verteidigungen. **Neue
   Strukturen direkt im 15-Level-Schema bauen** (level-Argument + stage-Logik wie
   barracks/watchtower) und IMMER erst Konkurrenz recherchieren (Herzstück-Regel).
   ⚠️ Nutzer-Vorgabe 2026-07-02: **ERST alle Gebäude + Einheiten + Verteidigungen fertig
   bauen, DANN App-Integration** (Schritt 3/4 unten zurückgestellt).
2. Optional: Einheiten-Sprites (Milizionär, Bogenschütze, Ritter, Held …) im selben Stil.
3. Sprites je Tier rendern → nach `apps/mobile/src/assets/factions/humans/buildings/<type>_t<tier>.png`.
4. **In die App einbinden:** den dormanten Loader [humanBuildingAssets.ts](../../apps/mobile/src/rendering/humanBuildingAssets.ts)
   reaktivieren/erweitern (Level→Tier-Auswahl via `tier_for_level`), `image`-Prop-Wiring in
   `VillageCanvas`/`BattleCanvas` WIEDER aktivieren (heute entfernt), `buildingSprite.tsx`
   `image`-Pfad ist vorhanden. Dann Metro-Bundle (kein nativer Rebuild) + Emulator-Verifikation.

## Verworfen: UE5-Sprite-Lieferung des Nutzers
Der Nutzer lieferte 2 ZIPs (`design/Human_Barracks_UE5_AssetPack.zip`,
`Humans_Complete_UE5_Pack_v0_2.zip`, entpackt in `design/incoming/`). Das waren gerenderte
PNGs, ABER: die v0.2-„lvl01"-Sprites tragen **eingebrannte Text-Labels** („Warehouse" etc.)
und sind teils Mehrfach-Sheets; Mauer ungeeignet. Nur townhall+barracks (v0.1) waren sauber.
Dem Nutzer gefielen sie **nicht** → komplett verworfen. Stattdessen diese Blender-Pipeline.
Die App rendert aktuell wieder die **prozedurale Vektorgrafik** (Bild-Sprite-Wiring entfernt).
