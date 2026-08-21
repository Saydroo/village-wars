import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, Image as SkiaImage, Path, Rect, vec } from '@shopify/react-native-skia';
import type { BattleBuilding, BattleStateUpdate, EffectsConfig, DeployZoneBuilding, WallConnection } from '@village-wars/shared';
import { gridToScreen, screenToGrid, lerpColor, unitDisplayWidth, wallPredicate, wallConnectionAt, footprintCenter, isDeployBlocked, deployBlockedTiles } from '@village-wars/shared';
import { BuildingSprite } from '../../rendering/buildingSprite';
import { WallSprite } from '../../rendering/wallSprite';
import { useHumanBuildingSprites } from '../../rendering/humanBuildingAssets';
import { useHumanUnitSprites, selectUnitSprite } from '../../rendering/humanUnitAssets';
import { useWorldCamera } from '../../rendering/useWorldCamera';
import { Terrain } from '../../rendering/terrain';
import {
  FloatingTextLayer,
  FloatingTextSystem,
  ParticleField,
  ParticleSystem,
  ScreenShake,
  playCue,
  useAnimationFrame,
} from '../../rendering/effects';

interface Props {
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  /** Statische Gebäude-Positionen/Stufen aus dem Battle-Setup. */
  buildings: BattleBuilding[];
  /** Live-Zustand (HP, alive) aus battle:state_update. */
  update: BattleStateUpdate | null;
  effects: EffectsConfig;
  reduceEffects: boolean;
  maxLevelFor: (type: string) => number;
  /** Angewandte Einheiten-Skins (nur eigene Angreifer) je `unit_type`. */
  unitSkins?: Record<string, { primary?: string; accent?: string }>;
  /** Fraktion des verteidigenden Dorfs → fraktionseigener Baustil der Gebäude. */
  faction?: string;
  /** Tap auf ein Feld (zum Deployen). */
  onTapTile: (gx: number, gy: number) => void;
}

const COLLAPSE_MS = 500;
const SPAWN_MS = 300;
// Die Anzeigegröße der Einheiten-Sprites kommt aus dem GEMEINSAMEN WELTMASSSTAB
// (`unitDisplayWidth`, packages/shared → worldScale.ts) — dieselbe Rechnung wie
// bei den Gebäuden. Keine feste UNIT_DISP_W-Konstante mehr.

const lighten = (hex: string, a: number) => lerpColor(hex, '#ffffff', a);
const darken = (hex: string, a: number) => lerpColor(hex, '#000000', a);

/** Farbe je Einheiten-Rolle (grobe Kategorie über das Präfix des Typs). */
function unitColor(type: string): string {
  if (type.includes('archer') || type.includes('thrower') || type.includes('catapult')) return '#ffd24a';
  if (type.includes('healer') || type.includes('smith')) return '#4ade80';
  if (type.includes('giant') || type.includes('knight')) return '#ff7b54';
  return '#7aa7ff';
}

/**
 * Iso-Raute EINER Deploy-Kachel — exakt das `screenToGrid`-Urbild von (gx,gy):
 * die Bildschirmpunkte, die auf die Kachel (gx,gy) runden (Punkt-Konvention,
 * zentriert auf gridToScreen(gx,gy)). So deckt die rote Zone GENAU die Kacheln,
 * die der Server über dieselbe (gx,gy) ablehnt — kachelgenau, keine halbe-Kachel-
 * Verschiebung. (Die Terrain-Kacheln sind bewusst um eine halbe Kachel versetzt
 * und hier NICHT die Referenz — Referenz ist das Tap-/Deploy-Raster.)
 */
function tapTileDiamond(gx: number, gy: number): string {
  const t = gridToScreen(gx - 0.5, gy - 0.5); // oben
  const r = gridToScreen(gx + 0.5, gy - 0.5); // rechts
  const b = gridToScreen(gx + 0.5, gy + 0.5); // unten
  const l = gridToScreen(gx - 0.5, gy + 0.5); // links
  return `M ${t.x} ${t.y} L ${r.x} ${r.y} L ${b.x} ${b.y} L ${l.x} ${l.y} Z`;
}

export function BattleCanvas({
  width,
  height,
  gridWidth,
  gridHeight,
  buildings,
  update,
  effects,
  reduceEffects,
  maxLevelFor,
  unitSkins,
  faction,
  onTapTile,
}: Props): React.ReactElement {
  const base = useMemo(() => {
    const wc = gridToScreen(gridWidth / 2, gridHeight / 2);
    return { x: width / 2 - wc.x, y: height / 2 - wc.y };
  }, [width, height, gridWidth, gridHeight]);

  const [, force] = React.useReducer((n: number) => n + 1, 0);
  // Einheiten-Sprites (aus manifest.json, inkl. Anker) — Fallback: Kreis.
  const unitSprites = useHumanUnitSprites();
  // Gebäude-Sprites (Blender-Master, Fußpunkt-Anker) — Fallback: Vektor-Optik.
  const buildingSprites = useHumanBuildingSprites();

  // --- Effekt-Systeme ---
  const particles = useRef(new ParticleSystem(effects, reduceEffects)).current;
  const floating = useRef(new FloatingTextSystem(effects.floating_text)).current;
  const shake = useRef(new ScreenShake(effects.screenshake)).current;
  const clockRef = useRef(0);
  const shakeOffset = useRef({ x: 0, y: 0 });
  // Animationszustände.
  const collapse = useRef(new Map<string, number>()); // buildingId → Zerstör-Zeit
  const flash = useRef(new Map<string, number>()); // buildingId → Flash 0..1
  const unitSpawn = useRef(new Map<string, number>()); // unitId → Spawn-Zeit
  const prevB = useRef<Map<string, { hp: number; alive: boolean }> | null>(null);
  const prevU = useRef<Map<string, { hp: number; x: number; y: number }>>(new Map());
  // Aktuelle Sperrzonen-Gebäude für den Tap-Reject (stets der neueste Render-Stand).
  const zoneBuildingsRef = useRef<DeployZoneBuilding[]>([]);

  useEffect(() => {
    particles.setReduce(reduceEffects);
    shake.setEnabled(!reduceEffects);
  }, [particles, shake, reduceEffects]);

  // Gemeinsame Kamera (Pan + Zoom) — identisch zum VillageCanvas.
  const camApi = useRef<ReturnType<typeof useWorldCamera> | null>(null);
  const handleTap = (lx: number, ly: number) => {
    const cam = camApi.current;
    if (!cam) return;
    const w = cam.toWorld(lx, ly);
    const { gx, gy } = screenToGrid(w.x, w.y);
    if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;
    // Client-Vorabprüfung: in der roten Sperrzone gar nicht erst deployen (der
    // Server lehnt es ohnehin autoritativ ab — spart die Socket-Runde). Dieselbe
    // geteilte Regel wie das Overlay und der Server-Check (inkl. Grid-Maße für
    // den Innenraum-Flood-Fill).
    if (isDeployBlocked(zoneBuildingsRef.current, gx, gy, gridWidth, gridHeight)) return;
    onTapTile(gx, gy);
  };
  const camera = useWorldCamera({ base, onTap: handleTap });
  camApi.current = camera;

  const hpById = useMemo(() => {
    const m = new Map<string, { hp: number; max_hp: number; alive: boolean }>();
    for (const b of update?.buildings ?? []) m.set(b.id, b);
    return m;
  }, [update]);

  const buildingPos = useMemo(() => {
    const m = new Map<string, { gx: number; gy: number; type: string }>();
    for (const b of buildings) m.set(b.id, { gx: b.gx, gy: b.gy, type: b.building_type });
    return m;
  }, [buildings]);

  // --- Deploy-Sperrzone (rot) ---------------------------------------------------
  // Dieselbe geteilte Regel, die der Server autoritativ durchsetzt (shared →
  // deployZone). Innenraum hinter dem geschlossenen Mauerring (Flood-Fill) +
  // kleiner Radius um freistehende Außen-Gebäude. Live-`alive` macht es dynamisch:
  // fällt eine Mauer (Bresche), öffnet sich der Innenraum dahinter (wie in Clash).
  // Stabile Alive-Signatur (nur Alive, kein HP) über die Gebäude in der stabilen
  // `buildings`-Reihenfolge. Alive ist die EINZIGE Live-Eingabe, die computeBlocked
  // auswertet (deployZone.ts:109 Mauern, :123 Außen-Radius). Der String ist wertgleich
  // über reine HP-Ticks (nur Zahlen ändern sich) und wechselt erst, wenn etwas stirbt
  // (Bresche/Einsturz) — genau dann, wenn sich die Sperrzone ändern kann.
  const deadSig = useMemo(() => {
    let s = '';
    for (const b of buildings) s += hpById.get(b.id)?.alive === false ? '0' : '1';
    return s;
  }, [buildings, hpById]);
  // Sperrzonen-Gebäude hängen an `deadSig` statt an der pro-Tick frischen `hpById`-
  // Referenz → nur EIN Neubau pro Tod statt pro Tick. Alive kommt positionsgleich aus
  // `deadSig` ('1' = lebend/fehlend, '0' = tot) — identische Semantik zu `?? true`.
  const zoneBuildings = useMemo<DeployZoneBuilding[]>(
    () =>
      buildings.map((b, i) => ({
        building_type: b.building_type,
        gx: b.gx,
        gy: b.gy,
        alive: deadSig[i] !== '0',
      })),
    [buildings, deadSig],
  );
  // Der Tap-Reject in handleTap liest stets den aktuellen Stand über diesen Ref.
  zoneBuildingsRef.current = zoneBuildings;
  // Alle gesperrten Kacheln zu EINEM Skia-Pfad (ein Node, wie die Terrain-Kacheln).
  const zonePath = useMemo(() => {
    let p = '';
    for (const t of deployBlockedTiles(zoneBuildings, gridWidth, gridHeight)) {
      p += tapTileDiamond(t.gx, t.gy) + ' ';
    }
    return p;
  }, [zoneBuildings, gridWidth, gridHeight]);

  // Mauern verbinden sich im Kampf über DENSELBEN Auto-Connect-Pfad wie im Dorf
  // (shared/wallConnect): Prädikat über alle 1×1-Mauer-Kacheln aus dem statischen
  // Layout. BattleBuilding nutzt gx/gy → auf grid_x/grid_y mappen, das der Helfer
  // erwartet. So ergibt sich gerade/Ecke/T/Kreuzung/Ende von selbst — kein wall.png.
  const isWallTile = useMemo(
    () =>
      wallPredicate(
        buildings
          .filter((b) => b.building_type === 'wall')
          .map((b) => ({ grid_x: b.gx, grid_y: b.gy })),
      ),
    [buildings],
  );

  // Mauer-Verbindung je Mauer EINMAL vorberechnen (referenzstabil), damit
  // React.memo(WallSprite) greift: wallConnectionAt() erzeugt sonst pro Render ein
  // frisches WallConnection-Objekt → die Prop-Referenz wechselte jeden Frame und die
  // Memo liefe leer. Das Mauer-Layout (isWallTile) ist im Kampf statisch, also bleibt
  // die Verbindung konstant — dieselbe Idee wie useHumanBuildingSprites (useMemo).
  const wallConnById = useMemo(() => {
    const m = new Map<string, WallConnection>();
    for (const b of buildings) {
      if (b.building_type === 'wall') m.set(b.id, wallConnectionAt(isWallTile, b.gx, b.gy));
    }
    return m;
  }, [buildings, isWallTile]);

  // --- Trigger aus dem Live-Update ableiten (Treffer, Zerstörung, Spawn, Tod) ---
  useEffect(() => {
    if (!update) return;
    // Aufsteigende Zahlen im Bildschirmraum → Weltpunkt inkl. Zoom umrechnen.
    const w2s = camApi.current?.worldToScreen ?? ((x: number, y: number) => ({ x, y }));

    // Gebäude: HP-Verlust → Funken/Flash/Schadenszahl; Zerstörung → Burst/Shake.
    const prev = prevB.current;
    if (prev) {
      for (const b of update.buildings) {
        const p = prev.get(b.id);
        if (!p) continue;
        const pos = buildingPos.get(b.id);
        if (!pos) continue;
        // Effekte am footprint-zentrierten Fuß (wie das Gebäude gezeichnet wird).
        const [cgx, cgy] = footprintCenter(pos.type, pos.gx, pos.gy);
        const c = gridToScreen(cgx, cgy);
        if (p.alive && !b.alive) {
          collapse.current.set(b.id, Date.now());
          particles.emit('destroyBurst', c.x, c.y);
          shake.trigger(pos.type === 'town_hall' ? 'town_hall_destroyed' : 'building_destroyed');
          playCue('destroy');
        } else if (b.hp < p.hp) {
          const dmg = Math.round(p.hp - b.hp);
          particles.emit('hitSpark', c.x, c.y - 12);
          flash.current.set(b.id, 1);
          if (dmg > 0) {
            const crit = dmg >= 300;
            const s = w2s(c.x, c.y - 30);
            floating.spawn(crit ? `-${dmg}!` : `-${dmg}`, s.x, s.y, crit ? 'crit' : 'damage');
          }
          playCue('hit');
        }
      }
    }
    const nb = new Map<string, { hp: number; alive: boolean }>();
    for (const b of update.buildings) nb.set(b.id, { hp: b.hp, alive: b.alive });
    prevB.current = nb;

    // Einheiten: neue Angreifer → Deploy-Funken; Tod → kleiner Funke.
    const pu = prevU.current;
    const nu = new Map<string, { hp: number; x: number; y: number }>();
    for (const u of update.units) {
      const c = gridToScreen(u.x + 0.5, u.y + 0.5);
      if (!pu.has(u.id)) {
        if (u.side === 'attacker') {
          unitSpawn.current.set(u.id, Date.now());
          particles.emit('deploySpawn', c.x, c.y);
          playCue('deploy');
        }
      }
      nu.set(u.id, { hp: u.hp, x: u.x, y: u.y });
    }
    // Gefallene Einheiten (waren da, jetzt weg) → kurzer Funke am letzten Ort.
    for (const [id, last] of pu) {
      if (!nu.has(id)) {
        const c = gridToScreen(last.x + 0.5, last.y + 0.5);
        particles.emit('hitSpark', c.x, c.y);
        unitSpawn.current.delete(id);
      }
    }
    prevU.current = nu;
  }, [update, buildingPos, particles, floating, shake]);

  // --- Render-Loop (60 FPS, solange Effekte aktiv) ---
  const animating =
    particles.isActive() ||
    floating.isActive() ||
    shake.isActive() ||
    flash.current.size > 0 ||
    collapse.current.size > 0 ||
    unitSpawn.current.size > 0;
  useAnimationFrame(
    (now) => {
      clockRef.current = now;
      particles.step();
      floating.step();
      shake.step();
      shakeOffset.current = shake.offset();
      for (const [id, v] of flash.current) {
        const nv = v - 0.12; // Spec 3.3
        if (nv <= 0) flash.current.delete(id);
        else flash.current.set(id, nv);
      }
      for (const [id, start] of collapse.current) if (now - start > COLLAPSE_MS + 50) collapse.current.delete(id);
      for (const [id, start] of unitSpawn.current) if (now - start > SPAWN_MS) unitSpawn.current.delete(id);
      force();
    },
    animating,
    60,
  );

  // Gemeinsame TIEFEN-Sortierung (Painter's Algorithm) über Gebäude UND
  // Einheiten: kleinerer (gx+gy) = weiter hinten = zuerst gezeichnet. So steht
  // eine Einheit korrekt vor bzw. hinter einem Gebäude, je nach Y-Tiefe.
  type BUnit = BattleStateUpdate['units'][number];
  const depthItems = useMemo(() => {
    const arr: Array<{ depth: number; b: BattleBuilding; u: null } | { depth: number; b: null; u: BUnit }> = [];
    for (const b of buildings) arr.push({ depth: b.gx + b.gy, b, u: null });
    for (const u of update?.units ?? []) arr.push({ depth: u.x + u.y, b: null, u });
    arr.sort((a, z) => a.depth - z.depth);
    return arr;
  }, [buildings, update]);

  const now = clockRef.current;
  // Pan/Zoom aus der gemeinsamen Kamera; Screen-Shake additiv obendrauf.
  const { tx: camTx, ty: camTy, zoom } = camera.transform;
  const tx = camTx + shakeOffset.current.x;
  const ty = camTy + shakeOffset.current.y;
  const BAR_W = 28;

  // --- Off-Screen-Culling (Perf): nur Sichtbares zeichnen. Weltpunkt (gridToScreen,
  // VOR der Kamera) → Bildschirm = welt*zoom + (tx,ty), exakt wie worldToScreen.
  // Ränder in WELT-Einheiten (×zoom), großzügig nach OBEN, weil hohe Sprites
  // (Rathaus) weit über ihren Fußpunkt ragen und am Bildrand nicht wegspringen
  // dürfen. Spart bei ~80 Gebäuden viele Skia-Knoten, wenn hineingezoomt ist. ---
  const CULL_SIDE = 140;
  const CULL_UP = 260;
  const CULL_DOWN = 160;
  const offscreen = (wx: number, wy: number): boolean => {
    const sx = wx * zoom + tx;
    const sy = wy * zoom + ty;
    return (
      sx < -CULL_SIDE * zoom ||
      sx > width + CULL_SIDE * zoom ||
      sy < -CULL_UP * zoom ||
      sy > height + CULL_DOWN * zoom
    );
  };

  // Einsturz-Skala (1 → 0) bzw. Spawn-Skala (0.2 → 1.1 → 1).
  const collapseScale = (id: string): number => {
    const start = collapse.current.get(id);
    if (start === undefined) return 1;
    return Math.max(0, 1 - (now - start) / COLLAPSE_MS);
  };
  const spawnScale = (id: string): number => {
    const start = unitSpawn.current.get(id);
    if (start === undefined) return 1;
    const tp = Math.min(1, (now - start) / SPAWN_MS);
    const { spawn_start_scale: s0, spawn_overshoot_scale: s1 } = effects.squash;
    return tp < 0.6 ? s0 + (s1 - s0) * (tp / 0.6) : s1 + (1 - s1) * ((tp - 0.6) / 0.4);
  };

  // --- Ein Gebäude (Bild-Sprite oder Vektor via BuildingSprite) ---
  const renderBuilding = (b: BattleBuilding): React.ReactElement | null => {
    const live = hpById.get(b.id);
    const alive = live ? live.alive : true;
    // Footprint-bewusst am ZENTRUM der Grundfläche verankert — identisch zum Dorf
    // (VillageCanvas) und zum footprint-basierten Deploy-Overlay (deployZone →
    // footprintBounds). Vorher saß der Fuß auf der Ursprungskachel (gx+0.5,gy+0.5),
    // wodurch mehrkachelige Gebäude gegenüber ihrer footprint-basierten Sperrzone
    // versetzt gezeichnet wurden. Für 1×1 (Mauern) ist footprintCenter == gx+0.5.
    const [cgx, cgy] = footprintCenter(b.building_type, b.gx, b.gy);
    const c = gridToScreen(cgx, cgy);
    const cs = collapse.current.get(b.id);
    // Mauern: 1×1-Auto-Connect wie im Dorf (WallSprite, connection aus der
    // Nachbarschaft), NICHT das große wall.png. Zerstörte Mauer → Lücke (kein
    // weißer Riesen-Rest); der Einsturz skaliert die kleine Mauer kurz herunter.
    if (b.building_type === 'wall') {
      if (!alive && cs === undefined) return null;
      return (
        <Group key={b.id} transform={[{ scale: collapseScale(b.id) }]} origin={vec(c.x, c.y)}>
          <WallSprite cx={c.x} cy={c.y} connection={wallConnById.get(b.id) ?? wallConnectionAt(isWallTile, b.gx, b.gy)} />
        </Group>
      );
    }
    if (!alive && cs === undefined) {
      return <Circle key={b.id} cx={c.x} cy={c.y} r={6} color="#00000066" />;
    }
    const ratio = live ? Math.max(0, live.hp / live.max_hp) : 1;
    const barColor = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#ffd24a' : '#ff5a5a';
    return (
      <Group key={b.id}>
        <BuildingSprite
          type={b.building_type}
          level={b.level}
          maxLevel={maxLevelFor(b.building_type)}
          cx={c.x}
          cy={c.y}
          selected={false}
          isUpgrading={false}
          extraScale={collapseScale(b.id)}
          flash={flash.current.get(b.id) ?? 0}
          faction={faction}
          image={buildingSprites[b.building_type]?.image ?? null}
          imageAnchor={buildingSprites[b.building_type]?.anchor}
        />
        {alive && ratio < 1 ? (
          <Group>
            <Rect x={c.x - BAR_W / 2} y={c.y - 34} width={BAR_W} height={4} color="#000000aa" />
            <Rect x={c.x - BAR_W / 2} y={c.y - 34} width={BAR_W * ratio} height={4} color={barColor} />
          </Group>
        ) : null}
      </Group>
    );
  };

  // --- Eine Einheit: Bild-Sprite am Anker (Fußpunkt), sonst prozeduraler Kreis ---
  const renderUnit = (u: BUnit): React.ReactElement => {
    const c = gridToScreen(u.x + 0.5, u.y + 0.5);
    const ratio = Math.max(0, u.hp / u.max_hp);
    const isDefender = u.side === 'defender';
    const sc = spawnScale(u.id);
    // Sprite-Wahl PRO FRAME nach dem vom Server gelieferten Zustand + Blickrichtung
    // (laufend=walk in Laufrichtung, angreifend=attack Richtung Ziel, sonst idle) —
    // reine Auswahl, kein Frame-Zyklus. Typen ohne Facing-Set → Vektor-Fallback.
    const sprite = selectUnitSprite(unitSprites, u.unit_type, u.state, u.facing);
    if (sprite?.image) {
      const iw = sprite.image.width() || 1;
      const ih = sprite.image.height() || 1;
      const dispW = unitDisplayWidth(iw);
      const dispH = dispW * (ih / iw);
      // Anker (Fußpunkt, 0..1 der Leinwand) auf den Kachelpunkt c legen.
      const ix = c.x - sprite.anchor[0] * dispW;
      const iy = c.y - sprite.anchor[1] * dispH;
      const barColor = isDefender ? '#ffd24a' : ratio > 0.4 ? '#7cdc5a' : '#ff5a5a';
      return (
        <Group key={u.id} transform={[{ scale: sc }]} origin={vec(c.x, c.y)}>
          {/* Boden-Schatten am Fußpunkt (skaliert mit der Sprite-Größe). */}
          <Group transform={[{ scaleY: 0.4 }]} origin={vec(c.x, c.y)}>
            <Circle cx={c.x} cy={c.y} r={dispW * 0.11} color="#00000044" />
          </Group>
          <SkiaImage image={sprite.image} x={ix} y={iy} width={dispW} height={dispH} fit="contain" />
          {/* HP-Balken über dem Kopf. */}
          {ratio < 1 ? (
            <Group>
              <Rect x={c.x - 9} y={iy + 4} width={18} height={3} color="#000000aa" />
              <Rect x={c.x - 9} y={iy + 4} width={18 * ratio} height={3} color={barColor} />
            </Group>
          ) : null}
        </Group>
      );
    }
    // Fallback: prozeduraler Kreis (unveränderte Alt-Optik).
    const body = isDefender ? '#e84545' : (unitSkins?.[u.unit_type]?.primary ?? unitColor(u.unit_type));
    const head = lighten(body, 0.28);
    const outline = darken(body, 0.4);
    const phase = (u.id.charCodeAt(0) + u.id.charCodeAt(u.id.length - 1)) % 10;
    const bob = Math.sin(now / 170 + phase) * 1.4;
    const fy = c.y + bob;
    return (
      <Group key={u.id} transform={[{ scale: sc }]} origin={vec(c.x, c.y)}>
        <Group transform={[{ scaleY: 0.4 }]} origin={vec(c.x, c.y + 4)}>
          <Circle cx={c.x} cy={c.y + 4} r={6} color="#00000044" />
        </Group>
        {isDefender ? <Circle cx={c.x} cy={fy} r={9} color="#c0202055" /> : null}
        <Circle cx={c.x} cy={fy - 1} r={5.4} color={outline} />
        <Circle cx={c.x} cy={fy - 1} r={4.4} color={body} />
        <Circle cx={c.x} cy={fy - 5.5} r={3} color={outline} />
        <Circle cx={c.x} cy={fy - 5.5} r={2.2} color={head} />
        <Rect x={c.x - 7} y={fy - 15} width={14} height={3} color="#000000aa" />
        <Rect x={c.x - 7} y={fy - 15} width={14 * ratio} height={3} color={isDefender ? '#ffd24a' : ratio > 0.4 ? '#7cdc5a' : '#ff5a5a'} />
      </Group>
    );
  };

  return (
    <View
      {...camera.panHandlers}
      ref={camera.containerRef as React.Ref<View>}
      style={{ width, height }}
    >
      <Canvas style={{ width, height }}>
        {/* Kamera-Group: Pan (translate) → Zoom (scale); Sprites laden nicht neu. */}
        <Group transform={[{ translateX: tx }, { translateY: ty }, { scale: zoom }]}>
          <Terrain gridWidth={gridWidth} gridHeight={gridHeight} variant="battle" clock={now} />

          {/* Rote Deploy-Sperrzone auf dem Boden (unter Gebäuden/Einheiten).
              Dieselbe geteilte Logik, die der Server autoritativ durchsetzt.
              Füllung + heller Kachel-Rand je Kachel → deutlich sichtbar auf dem
              rotbraunen Schlachtfeld UND zeigt die kachelgenaue Auflösung. */}
          {zonePath ? (
            <Group>
              <Path path={zonePath} color="#ff2012" opacity={0.42} />
              <Path path={zonePath} style="stroke" strokeWidth={1} color="#ffcaa0" opacity={0.55} />
            </Group>
          ) : null}

          {/* Gebäude UND Einheiten gemeinsam nach Y-Tiefe sortiert (Painter's
              Algorithm): so verdeckt ein weiter vorne stehendes Element ein
              weiter hinten stehendes korrekt. */}
          {depthItems.map((it) => {
            // Fuß-Weltpunkt für den Culling-Test — dort sitzt der Sprite-Fuß.
            // Gebäude footprint-zentriert (exakt wie gezeichnet), Einheiten am Kachelpunkt.
            const [wgx, wgy] = it.b
              ? footprintCenter(it.b.building_type, it.b.gx, it.b.gy)
              : [it.u.x + 0.5, it.u.y + 0.5];
            const wc = gridToScreen(wgx, wgy);
            if (offscreen(wc.x, wc.y)) return null;
            return it.b ? renderBuilding(it.b) : renderUnit(it.u);
          })}

          {/* Partikel in Welt-Koordinaten (teilen Kamera + Shake). */}
          <ParticleField particles={particles.snapshot()} clock={now} />
        </Group>
      </Canvas>
      <FloatingTextLayer items={floating.snapshot()} shadow={effects.floating_text.shadow} />
    </View>
  );
}
