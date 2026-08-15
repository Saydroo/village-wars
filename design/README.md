# Design-Vorlagen (Bild pro Rasse)

Hier liegen die **Referenzbilder pro Rasse**, aus denen die Spiel-Grafik (Gebäude, Einheiten, Map)
umgesetzt wird. Dateibenennung: `<fraktion>.png` bzw. `<fraktion>-<element>.png`.

## Erwartete Dateien
- `humans.png` — Gesamtüberblick „Das Menschen Königreich" (Gebäude, Einheiten, Karte, Türme, Fallen,
  Epische/Boss). **Bitte in voller Auflösung ablegen** — je größer, desto besser die ausgeschnittenen Sprites.
- (später) `dragonfolk.png`, `fishfolk.png`, … pro weiterer Rasse.

## Workflow
1. Bild hier ablegen (volle Auflösung).
2. Einzelne Elemente werden ausgeschnitten nach `apps/mobile/src/assets/factions/<fraktion>/…`.
3. Renderer wählen die Sprites fraktions-/typabhängig (Fallback = bisherige Vektorgrafik).

> Stand 2026-06-22: `humans.png` wird erwartet (für den visuellen Teil der Menschen-Erweiterung).
