# Asset-Pipeline & Unreal-Render-Brief (Roadmap P10 — Grafik auf CoC-Niveau)

> **Zweck:** Genaue Spezifikation, wie Gebäude/Einheiten/Terrain in **Unreal Engine** (oder
> Blender) als **vorgerenderte isometrische 2D-Sprites** erzeugt werden, sodass sie **1:1** in
> die bestehende Expo/RN-App (Skia) passen. Das ist der CoC-Weg: 3D modellieren → 2D rendern →
> als Sprites im 2D-Iso-Spiel zeigen. **Kein Engine-Wechsel** — Unreal ist nur das *Render-Werkzeug*.
>
> **Arbeitsteilung:** *Du / 3D-Artist* = Modelle aufstellen + Sprites rendern (nach diesem Brief).
> *Assistent* = App-seitige Loader/Manifest-Pipeline + Einbinden + Emulator-Verifikation.

## 0. Wichtigste Regel zuerst — Milestone „3 Test-Sprites"
**Nicht alles auf einmal rendern.** Zuerst NUR diese 3 (Menschen) liefern:
`town_hall`, `cannon`, `lumber_camp`. Damit verifiziert der Assistent **Maßstab, Anker und Look**
am Emulator und justiert diesen Brief. **Erst danach** den Rest in Serie rendern. Spart Stunden.

## 1. Projektion (die Iso-Geometrie der App)
Die App nutzt **2:1-Iso** (Diamant-Tiles **64×32 px**, `render.ts`: `TILE_WIDTH=64`, `TILE_HEIGHT=32`).
- **Kamera:** **orthografisch** (NICHT perspektivisch), **Yaw 45°**.
- **Pitch kalibrieren statt raten:** Lege eine flache 1×1-Bodenplatte (1 Tile) in die Szene und stelle
  den Pitch so ein, dass sie als **exakt 2:1-Diamant** rendert (Breite = 2 × Höhe). Das entspricht dem
  „isometrischen" CoC-Look (Pitch ≈ 30°). **Diese eine Kamera dann für ALLE Assets fixieren** (gleicher
  Maßstab über alles — kritisch).
- **Blickrichtung:** Süd-Ost (Standard-Iso), Licht von **oben-links** (die App erwartet diese Sonnen-
  richtung; Outlines/Rim-Light der Alt-Optik kommen von dort).

## 2. Maßstab & Anker (damit Sprites am richtigen Fleck stehen)
- **Pixel pro Tile:** Rendere mit **256 px Breite pro 1 Tile** Grundfläche. Ein 1×1-Gebäude ≈ 256 px breit,
  ein 2×2 ≈ 512 px. (Hoch rendern für scharfe Downscales; die App skaliert auf ~Tile×1.75.)
- **Footprint zentriert, Basis unten:** Gebäude **horizontal mittig**; die **Vorderkante der Grundfläche**
  sitzt am **unteren Bildrand**. Damit ist der Anker = **(0.5, 1.0)** (unten-mitte) — die App verankert das
  Sprite an der vorderen Tile-Kante. Türme/hohe Gebäude ragen nach oben aus dem Bild — das ist ok.
- **ANKER-REGEL FÜR EINHEITEN (verbindlich, alle künftigen Einheiten):** Der Anker ist **immer der
  FUSSPUNKT der Figur** — die **Mitte zwischen den beiden Stiefel-/Fuß-Sohlen** (x = horizontale Mitte
  zwischen den Füßen, NICHT Bounding-Box-Mitte; y = Sohlenlinie, NICHT unterer Bildrand). Überstehende
  Ausrüstung (Bogen, Speer, Umhang, Wurfarm) **darf außerhalb liegen und über den Fußpunkt hinausragen**;
  sie verändert den Anker **nicht**. Der Anker wird als normalisiertes `[x, y]` (0..1 der Leinwand) im
  Manifest je Einheit eingetragen — NICHT der Default `[0.5, 1.0]`. Bestimmung exakt über die Kamera-
  Projektion der Sohlen-Kontaktpunkte (nicht per Bild-Heuristik, die Ausrüstung mitzählt).
  Referenz Menschen-Archer (512×512-Master, idle): **`[0.5455, 0.8921]`** — der Bogen hängt unter/neben
  dem Fußpunkt und liegt bewusst außerhalb.
- **ANKER-REGEL FÜR GEBÄUDE (seit Blender-Umstellung 2026-07-22):** Auch Gebäude verankern am
  **Fußpunkt = Weltursprung (0,0,0) = Mitte der Grundfläche auf Bodenhöhe**, exakt per Kamera-Projektion
  bestimmt (`design/blender/_scripts/footproj_buildings.py` patcht `lib_iso.render_png` und projiziert
  den Ursprung, ohne neu zu rendern). Der Grassockel ragt bewusst unter den Fußpunkt hinaus. Werte der
  12 Menschen-Gebäude: ~`[0.50, 0.86]` je Typ im Manifest.
- **EINHEITLICHER WELTMASSSTAB (Pflicht bei Gebäude-Exporten):** Die Renders entstehen mit
  unterschiedlichem `ortho_scale` (4.7 … 9.0). Beim Export muss jedes Bild auf **dieselben Pixel pro
  Welteinheit** skaliert werden (aktuell **38.74 px/Welteinheit** bei 512er Leinwand) — sonst wird ein
  Wachturm so groß wie ein Rathaus, weil die App alle Master mit derselben Leinwandbreite zeigt.
- **Kein gebackener Schatten, keine Auswahl-Ringe:** Die App fügt **Boden-Schatten, Auswahl, Upgrade-Ring,
  Hit-Flash** selbst hinzu. Bitte **nur das Gebäude/die Einheit** rendern, frei auf Transparenz.

## 3. Ausgabeformat
- **PNG-24 mit Alpha** (echte Transparenz, kein Matte/Halo). Hintergrund komplett transparent.
- **Quadratische Leinwand** je Sprite (z. B. 512×512 oder 1024×1024), Gebäude darin nach Regel 2 platziert.
- **Trimmen optional** (die App nutzt den Anker, nicht den Beschnitt) — wenn getrimmt, dann den Anker im
  Manifest mitliefern (siehe §6).
- **Keine Kompressions-Artefakte**, kein Premultiplied-Alpha-Halo.

## 4. Stil (CoC-Anmutung, konsistent mit der App)
- **Toon/Cel-Shading + PBR-Materialien** (Holz/Stein/Metall/Putz), kräftige Farben, **klare dunkle
  Silhouetten-Kontur**, ein heller Sonnen-Rim oben-links — der „Sticker-Look".
- **Fraktions-Paletten** (Identität dominiert über Detail). Menschen (Lead-Fraktion, zuerst):
  **royalblaue Dächer `#2f5fbf`, helle Steinmauern, Gold-Akzente** (so wie die aktuelle Vektor-Optik —
  damit der Übergang nahtlos wirkt). Andere Fraktionen bekommen später eigene Paletten.
- **Lesbarkeit auf ~120 px Handy-Größe:** große Formen, wenig Mikro-Detail, sattes Material-Kontrast.

## 5. Ordner- & Namensschema (Ziel in der App)
```
apps/mobile/src/assets/factions/<faction>/buildings/<building_type>.png
apps/mobile/src/assets/factions/<faction>/units/<unit_type>.png
apps/mobile/src/assets/terrain/<biome>/ground.png      # kachelbar, optional
```
- `<faction>` = `humans | fishfolk | giants | dwarves | elves | undead | orcs | dragonfolk`.
- `<building_type>` (Menschen-Set, 12): `town_hall, clan_castle, lumber_camp, quarry, gold_mine,`
  `storage_wood, storage_stone, storage_gold, barracks, watchtower, cannon, wall`.
- Einheiten (Kern, 5): `militia, archer, knight, catapult, healer` (Fraktionsexklusive später).
- **Level-Tiers (später, optional):** `<building_type>_t<1..5>.png` für Holz/Stein/Metall/Magie/Legendär.
  Vorerst genügt **EIN** Sprite je Typ; die App legt Gold-Trim/Aura ab Level 5/7/9 generisch drüber.

## 6. Sprite-Manifest (verbindet Renders ↔ App)
Pro Fraktion eine `manifest.json` neben den PNGs. Der Assistent liest sie und lädt die Sprites
(Skia `useImage`). Felder pro Eintrag:
```json
{
  "buildings": {
    "town_hall":   { "file": "town_hall.png",   "anchor": [0.5, 1.0] },
    "cannon":      { "file": "cannon.png",       "anchor": [0.5, 1.0] },
    "lumber_camp": { "file": "lumber_camp.png",  "anchor": [0.5, 1.0] }
  }
}
```
- `anchor` = Verankerungspunkt im Bild (0..1, default unten-mitte `[0.5,1.0]`).
- **Footprint** (`tiles`, Grundfläche in Kacheln) liegt NICHT mehr im Manifest, sondern als
  geteilte Spiellogik-Quelle in `packages/shared/src/game/footprints.ts` (`BUILDING_FOOTPRINTS`),
  damit Server UND Client dieselbe Quelle nutzen. Das Manifest ist rein rendering (anchor+file).

## 7. Was der Assistent macht (sobald Sprites/Manifest da sind)
1. Dormante Infra **reaktivieren + generalisieren**: `rendering/humanBuildingAssets.ts` →
   fraktions-agnostischer `factionSprites`-Loader, der `manifest.json` liest (statt fest verdrahteter Liste).
2. `buildingSprite.tsx` hat bereits die **`image`-Prop** (hat Vorrang vor der Vektor-Optik) — Schatten/
   Auswahl/Upgrade/Hit-Flash bleiben generisch drüber; Anker/`tiles` aus dem Manifest fürs Positionieren.
3. **Skin-Vorrang** bleibt: aktiver Skin überschreibt weiterhin (Farb-Tönung über dem Sprite).
4. **Emulator-Verifikation** (Maßstab/Anker/Look), dann grünes Licht für die Serie.
> Fallback bleibt erhalten: fehlt ein Sprite, rendert die App weiter die aktuelle scharfe Vektor-Optik —
> die Migration ist also **risikofrei und schrittweise** (Gebäude für Gebäude).

## 8. Reihenfolge der Produktion (nach dem 3-Sprite-Milestone)
1. **Menschen-Gebäude** (12) — Lead-Fraktion, sofort sichtbarer Effekt im Dorf.
2. **Menschen-Einheiten** (5 Kern) — sichtbar im Kampf/Dungeon.
3. **Terrain** (Gras-Kachel) — ersetzt den prozeduralen Boden.
4. **Weitere Fraktionen** je nach Priorität.

> **Faustregel Qualität:** Lieber **wenige, perfekt konsistente** Sprites (gleiche Kamera, gleicher Maßstab,
> gleicher Stil) als viele uneinheitliche. Konsistenz > Menge — das ist, was CoC „teuer" aussehen lässt.
