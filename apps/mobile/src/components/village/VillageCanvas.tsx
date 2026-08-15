import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Rect, Circle, RadialGradient, Fill, Shader, vec } from '@shopify/react-native-skia';
import type { Building, EffectsConfig } from '@village-wars/shared';
import { gridToScreen, screenToGrid, buildingDisplayWidth, buildingDisplayScale, wallPredicate, wallConnectionAt, footprintCenter, footprintContains, footprintTiles } from '@village-wars/shared';
import { BuildingSprite } from '../../rendering/buildingSprite';
import { WallSprite } from '../../rendering/wallSprite';
import { SPRITE_CONTENT_BOX, FULL_CONTENT_BOX } from '../../rendering/spriteContentBox';
import { useHumanBuildingSprites } from '../../rendering/humanBuildingAssets';
import { useWorldCamera } from '../../rendering/useWorldCamera';
import { Terrain } from '../../rendering/terrain';
import { backdropEffect } from '../../rendering/shaders';
import type { ActiveSkins } from '../../rendering/skins';
import {
  EASING,
  FloatingTextLayer,
  FloatingTextSystem,
  ParticleField,
  ParticleSystem,
  playCue,
  useAnimationFrame,
} from '../../rendering/effects';

interface Props {
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  buildings: Building[];
  selectedId: string | null;
  /** Im Platzier-/Verschieben-/Inventar-Modus: jeder Tap zählt als Feld-Tap. */
  placing?: boolean;
  /** Effekt-Parameter (game-config.json `effects`). */
  effects: EffectsConfig;
  reduceEffects: boolean;
  /** Angewandte Skins (Gebäude + Dorf-Theme), rein kosmetisch. */
  activeSkins: ActiveSkins;
  /** Fraktion des Dorfbesitzers → fraktionseigener Baustil. */
  faction?: string;
  maxLevelFor: (type: string) => number;
  onTapBuilding: (id: string) => void;
  onTapTile: (gx: number, gy: number) => void;
}

const POP_MS = 360; // Pop-In-Dauer (easeOutBack)
const UPGRADE_MS = 520; // Upgrade-Squash-Dauer

function diamondPath(gx: number, gy: number): string {
  const c = gridToScreen(gx + 0.5, gy + 0.5);
  const t = gridToScreen(gx + 0.5, gy);
  const r = gridToScreen(gx + 1, gy + 0.5);
  const b = gridToScreen(gx + 0.5, gy + 1);
  const l = gridToScreen(gx, gy + 0.5);
  void c;
  return `M ${t.x} ${t.y} L ${r.x} ${r.y} L ${b.x} ${b.y} L ${l.x} ${l.y} Z`;
}

export function VillageCanvas({
  width,
  height,
  gridWidth,
  gridHeight,
  buildings,
  selectedId,
  placing = false,
  effects,
  reduceEffects,
  activeSkins,
  faction,
  maxLevelFor,
  onTapBuilding,
  onTapTile,
}: Props): React.ReactElement {
  // Kamera: Grid-Mitte auf Bildschirmmitte zentrieren, Pan additiv.
  const base = useMemo(() => {
    const wc = gridToScreen(gridWidth / 2, gridHeight / 2);
    return { x: width / 2 - wc.x, y: height / 2 - wc.y };
  }, [width, height, gridWidth, gridHeight]);

  // Gebäude-Sprites (Blender-Master, Fußpunkt-Anker) — Fallback: Vektor-Optik.
  const buildingSprites = useHumanBuildingSprites();

  const [, setTick] = useState(0);
  const force = () => setTick((t) => t + 1);

  // --- Effekt-Systeme (einmalig erstellt) ---
  const particles = useRef(new ParticleSystem(effects, reduceEffects)).current;
  const floating = useRef(new FloatingTextSystem(effects.floating_text)).current;
  const clockRef = useRef(0);
  // Pop-In/Upgrade-Animationen je Gebäude (id → Startzeit).
  const popIn = useRef(new Map<string, number>());
  const upgradeAnim = useRef(new Map<string, number>());
  // Voriger Gebäudestand zum Erkennen von Neubau/Upgrade-Abschluss.
  const prevBuildings = useRef<Map<string, { level: number }> | null>(null);

  // Umgebungs-Partikel (Pollen/Glühpunkte) im Bildschirmraum — Atmosphäre.
  const motes = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number; ph: number }>>([]);
  if (motes.current.length === 0 && width > 0 && height > 0) {
    motes.current = Array.from({ length: 20 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() * 2 - 1) * 0.18,
      vy: -0.1 - Math.random() * 0.22,
      r: 1 + Math.random() * 1.8,
      ph: Math.random() * Math.PI * 2,
    }));
  }

  useEffect(() => {
    particles.setReduce(reduceEffects);
  }, [particles, reduceEffects]);

  // Gemeinsame Kamera (Pan + Zoom). Tap-Rückprojektion nutzt Pan UND Zoom.
  const camApi = useRef<ReturnType<typeof useWorldCamera> | null>(null);
  const handleTap = (lx: number, ly: number) => {
    const cam = camApi.current;
    if (!cam) return;
    const w = cam.toWorld(lx, ly);
    const { gx, gy } = screenToGrid(w.x, w.y);
    if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;
    if (placing) {
      onTapTile(gx, gy);
      return;
    }
    // Footprint-bewusster Hit-Test: trifft auf JEDER belegten Kachel der
    // Grundfläche (gemeinsamer Helfer footprintContains), nicht nur der
    // Ursprungskachel. Bei Überlappung gewinnt das visuell vorderste Gebäude —
    // dieselbe Tiefe wie die Tiefensortierung (Footprint-Vorderecke fw+fh),
    // damit Auswahl und Zeichenreihenfolge nie auseinanderlaufen (wichtig, seit
    // die Sprites größer sind und stärker überlappen).
    const hits = buildings.filter((b) => footprintContains(b.building_type, b.grid_x, b.grid_y, gx, gy));
    const tapDepth = (b: Building): number => {
      const [fw, fh] = footprintTiles(b.building_type);
      return b.grid_x + fw + b.grid_y + fh;
    };
    const hit = hits.length
      ? hits.reduce((a, b) => (tapDepth(b) >= tapDepth(a) ? b : a))
      : undefined;
    if (hit) onTapBuilding(hit.id);
    else onTapTile(gx, gy);
  };
  // Welt-Bounding-Box des Grids (für Pan-Clamping — kein Scrollen ins Leere).
  const worldBounds = useMemo(() => {
    const tl = gridToScreen(0, 0);
    const tr = gridToScreen(gridWidth, 0);
    const bl = gridToScreen(0, gridHeight);
    const br = gridToScreen(gridWidth, gridHeight);
    const gridMinX = bl.x, gridMaxX = tr.x, gridMinY = tl.y, gridMaxY = br.y;
    // Im PLATZIER-Modus muss man an jede (auch leere) Randkachel scrollen können
    // → volles Grid. Im Ansichtsmodus nur die BEBAUTEN Bereiche umrahmen, damit
    // man nicht in die leeren Grid-Ecken scrollt („kein Scrollen ins Leere").
    let minX = placing ? gridMinX : Infinity;
    let maxX = placing ? gridMaxX : -Infinity;
    let minY = placing ? gridMinY : Infinity;
    let maxY = placing ? gridMaxY : -Infinity;
    // Gebäude-SPRITES ragen über ihre Kacheln hinaus — vor allem nach OBEN
    // (Turmspitzen der town_hall). Die Clamp-Box umschließt die tatsächliche
    // (opake) Sprite-Silhouette, damit hohe Gebäude am Rand komplett bleiben.
    // Dieselbe Größen-/Anker-Rechnung wie der Renderer (buildingSprite.tsx),
    // aber NUR gelesen — Rendering, Sprites, Footprints und
    // BUILDING_DISPLAY_SCALE bleiben unberührt.
    for (const b of buildings) {
      // Mauern rendern seit der 1×1-Umstellung prozedural (kein großes Master-
      // Sprite) → ihre alte wall.png-Content-Box würde die Scroll-Grenze
      // aufblähen; die Kachel-Ecke unten deckt sie über die anderen Gebäude ab.
      if (b.building_type === 'wall') continue;
      const sprite = buildingSprites[b.building_type];
      const img = sprite?.image;
      if (!img) continue; // Vektor-Fallback: keine feste Sprite-Box → Kachel-Ecke genügt
      const iw = img.width() || 1;
      const ih = img.height() || 1;
      const dispW = buildingDisplayWidth(iw) * buildingDisplayScale(b.building_type);
      const dispH = dispW * (ih / iw);
      const ax = sprite.anchor[0];
      const ay = sprite.anchor[1];
      // Nur die SICHTBARE (opake) Fläche des Masters zählt: der transparente
      // Rand über/neben der Silhouette (town_hall ~37 % oben) darf die
      // Scroll-Grenze nicht aufblähen, sonst bliebe dort Leerraum stehen.
      const [fL, fT, fR, fB] = SPRITE_CONTENT_BOX[b.building_type] ?? FULL_CONTENT_BOX;
      const [cgx, cgy] = footprintCenter(b.building_type, b.grid_x, b.grid_y);
      const c = gridToScreen(cgx, cgy);
      minX = Math.min(minX, c.x - (ax - fL) * dispW);
      maxX = Math.max(maxX, c.x + (fR - ax) * dispW);
      minY = Math.min(minY, c.y - (ay - fT) * dispH);
      maxY = Math.max(maxY, c.y + (fB - ay) * dispH);
    }
    // Kein Sprite geladen (leeres Dorf / Sprites noch am Dekodieren) → volles Grid.
    if (!Number.isFinite(minX)) { minX = gridMinX; maxX = gridMaxX; minY = gridMinY; maxY = gridMaxY; }
    return { minX, maxX, minY, maxY };
  }, [gridWidth, gridHeight, buildings, buildingSprites, placing]);
  const camera = useWorldCamera({
    base,
    onTap: handleTap,
    viewport: { width, height },
    world: worldBounds,
    // „Contain"-Klemmung: die bebaute Sprite-Box füllt den Viewport. Kein
    // Scrollen ins Leere; town_hall bleibt am oberen Rand komplett (Turmspitzen
    // inklusive). Etwas Rand-Luft, damit Gebäude nicht am Bildrand kleben.
    containMargin: 48,
  });
  camApi.current = camera;

  // --- Trigger: Neubau (Pop-In) & Upgrade-Abschluss (Burst + LEVEL UP) ---
  useEffect(() => {
    const prev = prevBuildings.current;
    if (prev) {
      for (const b of buildings) {
        const p = prev.get(b.id);
        const c = gridToScreen(b.grid_x + 0.5, b.grid_y + 0.5);
        if (!p) {
          // Neu platziert/aus Inventar → Pop-In.
          popIn.current.set(b.id, Date.now());
        } else if (b.level > p.level) {
          // Upgrade abgeschlossen → Burst + Squash + „LEVEL UP!" + Sound.
          upgradeAnim.current.set(b.id, Date.now());
          particles.emit('upgradeBurst', c.x, c.y - 24);
          // Aufsteigender Text im Bildschirmraum → Weltpunkt inkl. Zoom umrechnen.
          const s = camApi.current?.worldToScreen(c.x, c.y - 40) ?? { x: c.x, y: c.y - 40 };
          floating.spawn('LEVEL UP!', s.x, s.y, 'resource');
          playCue('upgrade');
        }
      }
    }
    const next = new Map<string, { level: number }>();
    for (const b of buildings) next.set(b.id, { level: b.level });
    prevBuildings.current = next;
  }, [buildings, base, particles, floating]);

  // --- Render-Loop: Idle-Atmung + Partikel/Text-Schritt ---
  const animating = !reduceEffects || particles.isActive() || floating.isActive() || popIn.current.size > 0 || upgradeAnim.current.size > 0;
  useAnimationFrame(
    (now) => {
      clockRef.current = now;
      particles.step();
      floating.step();
      // Umgebungs-Partikel driften lassen (mit Bildschirm-Wrap).
      if (!reduceEffects) {
        for (const m of motes.current) {
          m.x += m.vx; m.y += m.vy; m.ph += 0.04;
          if (m.y < -4) { m.y = height + 4; m.x = Math.random() * width; }
          if (m.x < -4) m.x = width + 4; else if (m.x > width + 4) m.x = -4;
        }
      }
      // Abgelaufene Pop-In/Upgrade-Animationen aufräumen.
      for (const [id, start] of popIn.current) if (now - start > POP_MS) popIn.current.delete(id);
      for (const [id, start] of upgradeAnim.current) if (now - start > UPGRADE_MS) upgradeAnim.current.delete(id);
      force();
    },
    animating,
    reduceEffects ? 60 : 30, // Idle ruhig (30 FPS), Partikel flüssig genug
  );

  // Externer Skalierungsfaktor je Gebäude (Pop-In/Upgrade-Squash).
  const extraScaleFor = (id: string, now: number): number => {
    const pop = popIn.current.get(id);
    if (pop !== undefined) {
      const tp = Math.min(1, (now - pop) / POP_MS);
      return Math.max(0.05, EASING.easeOutBack(tp));
    }
    const up = upgradeAnim.current.get(id);
    if (up !== undefined) {
      const tp = Math.min(1, (now - up) / UPGRADE_MS);
      const peak = effects.squash.upgrade_peak_scale;
      return 1 + (peak - 1) * Math.sin(Math.PI * tp); // sanfter Squash-Puls
    }
    return 1;
  };

  // Tiefensortierung an der Footprint-Vorderecke (konsistent zur Platzierung).
  const sorted = useMemo(() => {
    const depth = (b: Building) => {
      const [fw, fh] = footprintTiles(b.building_type);
      return b.grid_x + fw + b.grid_y + fh;
    };
    return [...buildings].sort((a, b) => depth(a) - depth(b));
  }, [buildings]);

  // Auto-Connect: Prädikat über alle 1×1-Mauern (welche Kachel ist Mauer) für die
  // Nachbar-Abfrage. Rein clientseitig aus dem buildings-Array — kein Server nötig.
  const isWallTile = useMemo(
    () => wallPredicate(buildings.filter((b) => b.building_type === 'wall')),
    [buildings],
  );

  const { tx, ty, zoom } = camera.transform;
  const clock = clockRef.current;

  return (
    <View
      {...camera.panHandlers}
      ref={camera.containerRef as React.Ref<View>}
      style={{ width, height }}
    >
      <Canvas style={{ width, height }}>
        {/* Animierter atmosphärischer Hintergrund (Shader, Bildschirmraum) — Fallback: Vignette. */}
        {backdropEffect && !reduceEffects ? (
          <Fill>
            <Shader source={backdropEffect} uniforms={{ u_res: [width, height], u_time: clock / 1000 }} />
          </Fill>
        ) : (
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={vec(width / 2, height * 0.42)}
              r={Math.max(width, height) * 0.75}
              colors={['#1b3a30', '#122620', '#0a1411']}
            />
          </Rect>
        )}
        {/* Kamera-Group: erst Pan (translate), dann Zoom (scale) — der Zoom
            skaliert die ganze Welt-Group, die Sprites laden nicht neu. */}
        <Group transform={[{ translateX: tx }, { translateY: ty }, { scale: zoom }]}>
          <Terrain gridWidth={gridWidth} gridHeight={gridHeight} variant="grass" clock={clock} tint={activeSkins.villageTheme?.ground} />
          {sorted.map((b) => {
            // Footprint-bewusst am ZENTRUM der Grundfläche verankert: der Master-
            // Fußpunkt-Anker (bleibt unverändert) sitzt auf der Mitte der belegten
            // Kacheln, damit das Gebäude mittig auf seinem Feld steht statt an die
            // Vorderecke versetzt zu überlappen. Gemeinsamer Helfer mit dem Hit-Test.
            const [cgx, cgy] = footprintCenter(b.building_type, b.grid_x, b.grid_y);
            const c = gridToScreen(cgx, cgy);
            // Mauern: connection-aware Auto-Connect (Phase 2, prozeduraler Vektor).
            // Der Verbindungstyp kommt aus der Nachbarschaft (shared/wallConnect).
            if (b.building_type === 'wall') {
              return (
                <WallSprite
                  key={b.id}
                  cx={c.x}
                  cy={c.y}
                  connection={wallConnectionAt(isWallTile, b.grid_x, b.grid_y)}
                  selected={b.id === selectedId}
                />
              );
            }
            return (
              <BuildingSprite
                key={b.id}
                type={b.building_type}
                level={b.level}
                maxLevel={maxLevelFor(b.building_type)}
                cx={c.x}
                cy={c.y}
                selected={b.id === selectedId}
                isUpgrading={b.is_upgrading}
                clock={clock}
                idle={effects.idle}
                reduceEffects={reduceEffects}
                extraScale={extraScaleFor(b.id, clock)}
                skin={activeSkins.buildings[b.building_type]}
                faction={faction}
                image={buildingSprites[b.building_type]?.image ?? null}
                imageAnchor={buildingSprites[b.building_type]?.anchor}
              />
            );
          })}
          {/* Partikel in Welt-Koordinaten (teilen die Kamera-Transform). */}
          <ParticleField particles={particles.snapshot()} clock={clock} />
        </Group>
        {/* Umgebungs-Partikel (Bildschirmraum, über der Welt). */}
        {!reduceEffects &&
          motes.current.map((m, i) => (
            <Circle key={`m${i}`} cx={m.x} cy={m.y} r={m.r} color="#ffe9a8" opacity={0.18 + 0.16 * (0.5 + 0.5 * Math.sin(m.ph))} />
          ))}
      </Canvas>
      {/* Aufsteigende Zahlen als Overlay in Bildschirm-Koordinaten. */}
      <FloatingTextLayer items={floating.snapshot()} shadow={effects.floating_text.shadow} />
    </View>
  );
}

// (diamondPath bleibt für künftige Tile-Highlights verfügbar)
export { diamondPath };
