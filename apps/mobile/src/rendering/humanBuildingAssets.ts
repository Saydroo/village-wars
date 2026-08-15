import { useMemo } from 'react';
import { useImage, type SkImage } from '@shopify/react-native-skia';

/**
 * Lädt die MENSCHEN-Gebäude-Sprites (Blender-Renders, 512er-Master mit
 * Fußpunkt-Anker) als Skia-Bilder — analog zum Einheiten-Weg
 * (humanUnitAssets.ts) und INKLUSIVE Anker aus der manifest.json.
 * Fehlt für einen Typ ein Sprite, rendert der Renderer weiter die
 * prozedurale Vektor-Optik.
 *
 * RN `require()` braucht statische String-Literale → die real vorhandenen
 * Gebäude-PNGs stehen in BUILDING_SOURCES; der Anker kommt generisch aus dem
 * Manifest. Neues Gebäude = EINE Zeile in BUILDING_SOURCES + eine useImage-
 * Zeile unten. useImage MUSS unkonditional laufen (feste Hook-Anzahl).
 *
 * Die Anzeigegröße kommt NICHT von hier, sondern aus dem gemeinsamen
 * Weltmaßstab (`buildingDisplayWidth`, packages/shared → worldScale.ts).
 */

const manifest = require('../assets/factions/humans/manifest.json') as {
  buildings?: Record<string, { file: string; anchor?: number[] }>;
};

export interface BuildingSprite {
  image: SkImage | null;
  /** Verankerungspunkt [x,y] in 0..1 der Master-Leinwand (Fußpunkt = Kachelmitte). */
  anchor: [number, number];
}

function anchorOf(type: string): [number, number] {
  const a = manifest.buildings?.[type]?.anchor;
  return Array.isArray(a) && a.length === 2 ? [a[0]!, a[1]!] : [0.5, 1.0];
}

export function useHumanBuildingSprites(): Record<string, BuildingSprite> {
  const town_hall = useImage(require('../assets/factions/humans/buildings/town_hall.png'));
  const clan_castle = useImage(require('../assets/factions/humans/buildings/clan_castle.png'));
  const barracks = useImage(require('../assets/factions/humans/buildings/barracks.png'));
  const watchtower = useImage(require('../assets/factions/humans/buildings/watchtower.png'));
  const cannon = useImage(require('../assets/factions/humans/buildings/cannon.png'));
  const wall = useImage(require('../assets/factions/humans/buildings/wall.png'));
  const gold_mine = useImage(require('../assets/factions/humans/buildings/gold_mine.png'));
  const quarry = useImage(require('../assets/factions/humans/buildings/quarry.png'));
  const lumber_camp = useImage(require('../assets/factions/humans/buildings/lumber_camp.png'));
  const storage_gold = useImage(require('../assets/factions/humans/buildings/storage_gold.png'));
  const storage_stone = useImage(require('../assets/factions/humans/buildings/storage_stone.png'));
  const storage_wood = useImage(require('../assets/factions/humans/buildings/storage_wood.png'));
  const research_lab = useImage(require('../assets/factions/humans/buildings/research_lab.png'));
  const hero_hall = useImage(require('../assets/factions/humans/buildings/hero_hall.png'));
  // Referenzstabil je Bild-Set (useMemo): ein neues Objekt entsteht NUR, wenn ein
  // Sprite fertig dekodiert (SkImage-Ref wechselt). So bleiben Objekt UND Anker-
  // Arrays über die vielen Frames konstant → React.memo(BuildingSprite) kann
  // unveränderte Gebäude überspringen (sonst wäre der Anker jeden Frame neu).
  return useMemo(
    () => ({
      town_hall: { image: town_hall, anchor: anchorOf('town_hall') },
      clan_castle: { image: clan_castle, anchor: anchorOf('clan_castle') },
      barracks: { image: barracks, anchor: anchorOf('barracks') },
      watchtower: { image: watchtower, anchor: anchorOf('watchtower') },
      cannon: { image: cannon, anchor: anchorOf('cannon') },
      wall: { image: wall, anchor: anchorOf('wall') },
      gold_mine: { image: gold_mine, anchor: anchorOf('gold_mine') },
      quarry: { image: quarry, anchor: anchorOf('quarry') },
      lumber_camp: { image: lumber_camp, anchor: anchorOf('lumber_camp') },
      storage_gold: { image: storage_gold, anchor: anchorOf('storage_gold') },
      storage_stone: { image: storage_stone, anchor: anchorOf('storage_stone') },
      storage_wood: { image: storage_wood, anchor: anchorOf('storage_wood') },
      research_lab: { image: research_lab, anchor: anchorOf('research_lab') },
      hero_hall: { image: hero_hall, anchor: anchorOf('hero_hall') },
    }),
    [town_hall, clan_castle, barracks, watchtower, cannon, wall, gold_mine, quarry, lumber_camp, storage_gold, storage_stone, storage_wood, research_lab, hero_hall],
  );
}
