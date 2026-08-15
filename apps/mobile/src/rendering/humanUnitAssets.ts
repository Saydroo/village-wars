import { useImage, type SkImage } from '@shopify/react-native-skia';
import type { UnitFacing, UnitVisualState } from '@village-wars/shared';

/**
 * Lädt die MENSCHEN-Einheiten-Sprites als Skia-Bilder — analog zum Gebäude-Weg
 * (humanBuildingAssets.ts), aber je Einheit als FACING-SET: pro Anim-Zustand
 * (idle/walk/attack) × 4 Blickrichtungen (az45/az135/az225/az315), jeweils mit
 * eigenem Fußpunkt-Anker aus manifest.json → unit_poses. Der Kampf-Renderer wählt
 * pro Frame EIN Sprite nach dem vom Server gelieferten state+facing (kein Zyklus).
 *
 * RN `require()` braucht statische String-Literale → alle Facing-PNGs stehen als
 * feste Literale in ARCHER_POSES; die 12 `useImage`-Hooks laufen unkonditional
 * (feste Hook-Anzahl). Fehlt für einen Typ ein Pose-Set, rendert der Renderer den
 * prozeduralen Fallback. Neue Einheit mit Facings = analoges Pose-Objekt + Hooks.
 */

const manifest = require('../assets/factions/humans/manifest.json') as {
  unit_poses?: Record<
    string,
    Record<string, Record<string, { file: string; anchor?: number[] }>>
  >;
};

// Facing-PNGs (statische require-Literale). idle/attack unverändert freigegeben;
// walk = Arm-Fix v04 (rechte Armlänge an idle angeglichen).
const ARCHER_POSES = {
  idle: {
    az45: require('../assets/factions/humans/units/archer_idle_az45.png'),
    az135: require('../assets/factions/humans/units/archer_idle_az135.png'),
    az225: require('../assets/factions/humans/units/archer_idle_az225.png'),
    az315: require('../assets/factions/humans/units/archer_idle_az315.png'),
  },
  walk: {
    az45: require('../assets/factions/humans/units/archer_walk_az45.png'),
    az135: require('../assets/factions/humans/units/archer_walk_az135.png'),
    az225: require('../assets/factions/humans/units/archer_walk_az225.png'),
    az315: require('../assets/factions/humans/units/archer_walk_az315.png'),
  },
  attack: {
    az45: require('../assets/factions/humans/units/archer_attack_az45.png'),
    az135: require('../assets/factions/humans/units/archer_attack_az135.png'),
    az225: require('../assets/factions/humans/units/archer_attack_az225.png'),
    az315: require('../assets/factions/humans/units/archer_attack_az315.png'),
  },
} as const;

export interface UnitSprite {
  image: SkImage | null;
  /** Verankerungspunkt [x,y] in 0..1 der Sprite-Leinwand (Fußpunkt der Figur). */
  anchor: [number, number];
}

export type UnitPoseSprites = Record<UnitVisualState, Record<UnitFacing, UnitSprite>>;

export interface HumanUnitSprites {
  /** Pro unit_type ein Facing-Set (nur Typen mit echten Sprites, aktuell archer). */
  poses: Record<string, UnitPoseSprites>;
}

/** Anker aus dem Manifest (unit_poses); Fallback unten-mitte, falls nicht gepflegt. */
function poseAnchor(type: string, state: UnitVisualState, facing: UnitFacing): [number, number] {
  const a = manifest.unit_poses?.[type]?.[state]?.[facing]?.anchor;
  return Array.isArray(a) && a.length === 2 ? [a[0]!, a[1]!] : [0.5, 1.0];
}

export function useHumanUnitSprites(): HumanUnitSprites {
  // 12 useImage-Hooks (unkonditional, feste Anzahl — RN Hook-Regel).
  const idle45 = useImage(ARCHER_POSES.idle.az45);
  const idle135 = useImage(ARCHER_POSES.idle.az135);
  const idle225 = useImage(ARCHER_POSES.idle.az225);
  const idle315 = useImage(ARCHER_POSES.idle.az315);
  const walk45 = useImage(ARCHER_POSES.walk.az45);
  const walk135 = useImage(ARCHER_POSES.walk.az135);
  const walk225 = useImage(ARCHER_POSES.walk.az225);
  const walk315 = useImage(ARCHER_POSES.walk.az315);
  const attack45 = useImage(ARCHER_POSES.attack.az45);
  const attack135 = useImage(ARCHER_POSES.attack.az135);
  const attack225 = useImage(ARCHER_POSES.attack.az225);
  const attack315 = useImage(ARCHER_POSES.attack.az315);

  const sprite = (image: SkImage | null, state: UnitVisualState, facing: UnitFacing): UnitSprite => ({
    image,
    anchor: poseAnchor('archer', state, facing),
  });

  const archer: UnitPoseSprites = {
    idle: {
      az45: sprite(idle45, 'idle', 'az45'),
      az135: sprite(idle135, 'idle', 'az135'),
      az225: sprite(idle225, 'idle', 'az225'),
      az315: sprite(idle315, 'idle', 'az315'),
    },
    walk: {
      az45: sprite(walk45, 'walk', 'az45'),
      az135: sprite(walk135, 'walk', 'az135'),
      az225: sprite(walk225, 'walk', 'az225'),
      az315: sprite(walk315, 'walk', 'az315'),
    },
    attack: {
      az45: sprite(attack45, 'attack', 'az45'),
      az135: sprite(attack135, 'attack', 'az135'),
      az225: sprite(attack225, 'attack', 'az225'),
      az315: sprite(attack315, 'attack', 'az315'),
    },
  };

  return { poses: { archer } };
}

/**
 * Wählt EIN Sprite nach Typ + Anim-Zustand + Blickrichtung (pro Frame, kein
 * Zyklus). Fehlt das Pose-Set (Typ ohne Sprites) → null (Renderer nutzt den
 * Vektor-Fallback). Fehlt nur das einzelne Bild noch (async-Ladephase), liefert
 * es trotzdem den Slot mit `image=null` — der Renderer fällt dann sauber zurück.
 */
export function selectUnitSprite(
  sprites: HumanUnitSprites,
  type: string,
  state: UnitVisualState,
  facing: UnitFacing,
): UnitSprite | null {
  const pose = sprites.poses[type];
  if (!pose) return null;
  return pose[state]?.[facing] ?? pose.idle.az315;
}
