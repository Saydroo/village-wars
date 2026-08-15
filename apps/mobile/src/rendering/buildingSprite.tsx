import React from 'react';
import { Group, Path, Circle, RoundedRect, LinearGradient, RadialGradient, Shader, vec, Image as SkiaImage, ColorMatrix, type SkImage } from '@shopify/react-native-skia';
import {
  MATERIAL_COLORS,
  TILE_HEIGHT,
  TILE_WIDTH,
  buildingDisplayWidth,
  buildingDisplayScale,
  lerpColor,
  tierProgress,
  hasGoldAccents,
  hasMagicAura,
  hasLegendaryAura,
  type IdleConfig,
} from '@village-wars/shared';
import { materialEffect, MAT } from './shaders';

/** Hex → [r,g,b] in 0..1 für Shader-Uniforms. */
function rgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** Material je Gebäudetyp (Stein/Holz/Putz/Metall). */
const MATERIAL_FOR: Record<string, number> = {
  town_hall: MAT.plaster,
  clan_castle: MAT.stone,
  lumber_camp: MAT.wood,
  quarry: MAT.wood,
  gold_mine: MAT.stone,
  storage_wood: MAT.wood,
  storage_stone: MAT.stone,
  storage_gold: MAT.metal,
  wall: MAT.stone,
  barracks: MAT.wood,
  watchtower: MAT.stone,
  cannon: MAT.stone,
};

/**
 * Iso-Gebäude-Renderer mit TYP-EIGENER Silhouette + Ikonografie (Phase-6-Politur 2).
 * Jeder Gebäudetyp hat eine erkennbare Form und ein klares Symbol (Goldmine =
 * Mineneingang + Lore, Kanone = Lauf, Kaserne = gekreuzte Schwerter, Burg = Zinnen
 * + Turm, Lager = sichtbares Material …), damit man auf den ersten Blick weiß, was
 * es ist — angelehnt an Clash of Clans. Level-Progression (Gold-Trim ab 5, Magie-/
 * Legendär-Aura ab 7/9, leuchtende Fenster) wird obenauf gelegt; die TYP-Identität
 * bleibt dominant. Größe konstant, nur Effekte/Trim ändern sich mit der Stufe.
 */

export interface BuildingSpriteProps {
  type: string;
  level: number;
  maxLevel: number;
  cx: number;
  cy: number;
  selected?: boolean;
  isUpgrading?: boolean;
  clock?: number;
  idle?: IdleConfig;
  reduceEffects?: boolean;
  extraScale?: number;
  flash?: number;
  /** Angewandter Gebäude-Skin (rein kosmetisch): überschreibt Wand-/Dach-/Akzentfarbe. */
  skin?: { primary?: string; accent?: string };
  /** Fraktion des Gebäude-Besitzers → fraktionseigener Baustil (z.B. Menschen: blaue Dächer, Grassockel). */
  faction?: string;
  /** Ausgeschnittenes Bild-Sprite (z.B. Menschen-Gebäude aus der Vorlage). Hat Vorrang vor der Vektorgrafik. */
  image?: SkImage | null;
  /** Anker [x,y] in 0..1 der Master-Leinwand (Fußpunkt = Kachelmitte), aus der manifest.json. */
  imageAnchor?: [number, number];
}

type P = [number, number];

const FW = TILE_WIDTH * 1.5; // 96
const FH = TILE_HEIGHT * 1.5; // 48

function poly(points: P[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}
function lineP(a: P, b: P): string {
  return `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
}
const dk = (hex: string, a: number) => lerpColor(hex, '#000000', a);
const lt = (hex: string, a: number) => lerpColor(hex, '#ffffff', a);

// --- Iso-Box-Geometrie ---
interface BoxGeom {
  T: P; R: P; B: P; L: P; Tt: P; Rt: P; Bt: P; Lt: P;
  hw: number; hh: number; h: number; cx: number; cy: number;
}
function boxGeom(cx: number, cy: number, hw: number, hh: number, h: number): BoxGeom {
  return {
    cx, cy, hw, hh, h,
    T: [cx, cy - hh], R: [cx + hw, cy], B: [cx, cy + hh], L: [cx - hw, cy],
    Tt: [cx, cy - hh - h], Rt: [cx + hw, cy - h], Bt: [cx, cy + hh - h], Lt: [cx - hw, cy - h],
  };
}
/** Punkt auf der LINKEN Wand (s = quer 0..1, t = abwärts 0..1). */
function onLeft(g: BoxGeom, s: number, t: number): P {
  return [g.Lt[0] + (g.Bt[0] - g.Lt[0]) * s, g.Lt[1] + (g.Bt[1] - g.Lt[1]) * s + g.h * t];
}
/** Punkt auf der RECHTEN Wand. */
function onRight(g: BoxGeom, s: number, t: number): P {
  return [g.Bt[0] + (g.Rt[0] - g.Bt[0]) * s, g.Bt[1] + (g.Rt[1] - g.Bt[1]) * s + g.h * t];
}

// --- Wiederverwendbare Iso-Bausteine ---

// Aktuelles Material/Clock je Gebäude (von BuildingSprite vor dem Render gesetzt;
// Box liest sie als Fallback → kein Durchreichen an jede Box-Instanz nötig, da
// React synchron tiefenzuerst rendert).
let _mat: number | undefined;
let _clk = 0;

function Box({ g, color, outline = true, material, clock }: { g: BoxGeom; color: string; outline?: boolean; material?: number; clock?: number }): React.ReactElement {
  const m = material ?? _mat;
  const ck = clock ?? _clk;
  const topHi = lt(color, 0.3), topMid = lt(color, 0.1), topLo = dk(color, 0.05);
  const leftHi = lt(color, 0.05), leftLo = dk(color, 0.36);
  const rightHi = dk(color, 0.24), rightLo = dk(color, 0.55);
  const oc = dk(color, 0.66);
  const leftPath = poly([g.L, g.B, g.Bt, g.Lt]);
  const rightPath = poly([g.B, g.R, g.Rt, g.Bt]);
  const topPath = poly([g.Tt, g.Rt, g.Bt, g.Lt]);
  // Material-Shader pro Fläche (Welt-UV-Projektion + Richtungslicht); Fallback: Verlauf.
  const useMat = m !== undefined && materialEffect;
  const col01 = useMat ? rgb01(color) : [0, 0, 0];
  const t = ck / 1000;
  const matFace = (path: string, o: P, ux: P, vy: P, shade: number) => (
    <Path path={path}>
      <Shader source={materialEffect!} uniforms={{ u_o: o, u_ux: ux, u_vy: vy, u_col: col01, u_mat: m!, u_shade: shade, u_time: t }} />
    </Path>
  );
  return (
    <Group>
      {useMat ? (
        <>
          {matFace(leftPath, g.Lt, [g.Bt[0] - g.Lt[0], g.Bt[1] - g.Lt[1]], [0, g.h], 0.95)}
          {matFace(rightPath, g.Bt, [g.Rt[0] - g.Bt[0], g.Rt[1] - g.Bt[1]], [0, g.h], 0.66)}
          {matFace(topPath, g.Tt, [g.Rt[0] - g.Tt[0], g.Rt[1] - g.Tt[1]], [g.Lt[0] - g.Tt[0], g.Lt[1] - g.Tt[1]], 1.12)}
        </>
      ) : (
        <>
          <Path path={leftPath}>
            <LinearGradient start={vec(g.cx, g.cy - g.h)} end={vec(g.cx, g.cy + g.hh)} colors={[leftHi, leftLo]} />
          </Path>
          <Path path={rightPath}>
            <LinearGradient start={vec(g.cx, g.cy - g.h)} end={vec(g.cx, g.cy + g.hh)} colors={[rightHi, rightLo]} />
          </Path>
          <Path path={topPath}>
            <LinearGradient start={vec(g.Tt[0], g.Tt[1])} end={vec(g.Bt[0], g.Bt[1])} colors={[topHi, topMid, topLo]} />
          </Path>
        </>
      )}
      {/* Rim-Light auf den oberen Kanten */}
      <Path path={lineP(g.Lt, g.Tt)} color={lt(color, 0.55)} style="stroke" strokeWidth={1.5} opacity={0.8} />
      <Path path={lineP(g.Tt, g.Rt)} color={lt(color, 0.3)} style="stroke" strokeWidth={1} opacity={0.5} />
      {/* dunkle Innenkanten für Plastizität */}
      <Path path={lineP(g.Lt, g.Bt)} color={oc} style="stroke" strokeWidth={1.2} opacity={0.5} />
      <Path path={lineP(g.Rt, g.Bt)} color={oc} style="stroke" strokeWidth={1.2} opacity={0.5} />
      <Path path={lineP(g.B, g.Bt)} color={oc} style="stroke" strokeWidth={1.2} opacity={0.45} />
      {/* Außen-Outline (Sticker-Look) */}
      {outline && (
        <Path path={poly([g.Tt, g.Rt, g.R, g.B, g.L, g.Lt])} style="stroke" color={oc} strokeWidth={1.9} opacity={0.9} />
      )}
    </Group>
  );
}

/** Pyramidendach mit Überstand + First. `spire` = höher/spitzer (Türme), `finial` = Gold-Knauf,
 *  `gold` = Gold-Grate + Gold-Traufe (prächtiges Dach). Immer mit Schindel-Linien für Detail. */
function Roof({ g, height, color, overhang = 0.14, spire = false, finial, gold }:
  { g: BoxGeom; height: number; color: string; overhang?: number; spire?: boolean; finial?: string; gold?: string }): React.ReactElement {
  const Cc: P = [g.cx, g.cy - g.h];
  const exp = (p: P): P => [Cc[0] + (p[0] - Cc[0]) * (1 + overhang), Cc[1] + (p[1] - Cc[1]) * (1 + overhang) + 3];
  const eTt = exp(g.Tt), eRt = exp(g.Rt), eBt = exp(g.Bt), eLt = exp(g.Lt);
  const apexH = spire ? height * 1.55 : height; // spitze Turmspitze für Menschen
  const apex: P = [g.cx, g.cy - g.hh - g.h - apexH];
  const oc = dk(color, 0.62);
  const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // Schindel-Linien: parallel zur Traufe auf beiden Sichtflächen.
  const shingleL = [0.34, 0.58, 0.8].map((t) => lineP(mix(apex, eLt, t), mix(apex, eBt, t)));
  const shingleR = [0.34, 0.58, 0.8].map((t) => lineP(mix(apex, eRt, t), mix(apex, eBt, t)));
  return (
    <Group>
      {/* Traufe/Unterschatten */}
      <Path path={poly([eTt, eRt, eBt, eLt])} color={dk(color, 0.55)} opacity={0.75} />
      <Path path={poly([eLt, eTt, apex, eBt])}>
        <LinearGradient start={vec(apex[0], apex[1])} end={vec(eBt[0], eBt[1])} colors={[lt(color, 0.28), color, dk(color, 0.3)]} />
      </Path>
      <Path path={poly([eRt, eTt, apex, eBt])}>
        <LinearGradient start={vec(apex[0], apex[1])} end={vec(eBt[0], eBt[1])} colors={[lt(color, 0.06), dk(color, 0.5)]} />
      </Path>
      {/* Schindel-Linien (Detail) */}
      {shingleL.map((p, i) => <Path key={`sl${i}`} path={p} color={dk(color, 0.4)} style="stroke" strokeWidth={0.9} opacity={0.45} />)}
      {shingleR.map((p, i) => <Path key={`sr${i}`} path={p} color={dk(color, 0.5)} style="stroke" strokeWidth={0.9} opacity={0.4} />)}
      {/* vordere Hip-Kante dunkel, First hell */}
      <Path path={lineP(apex, eBt)} color={oc} style="stroke" strokeWidth={1.3} opacity={0.5} />
      <Path path={lineP(apex, eTt)} color={lt(color, 0.5)} style="stroke" strokeWidth={1.6} opacity={0.9} />
      {/* Außen-Outline */}
      <Path path={poly([eLt, apex, eRt, eBt])} style="stroke" color={oc} strokeWidth={1.9} opacity={0.9} />
      {/* Gold-Grate auf den Hips + Gold-Traufband (prächtiges Dach) */}
      {gold && (
        <>
          <Path path={lineP(apex, eLt)} color={gold} style="stroke" strokeWidth={1.8} opacity={0.95} />
          <Path path={lineP(apex, eRt)} color={dk(gold, 0.15)} style="stroke" strokeWidth={1.8} opacity={0.9} />
          <Path path={lineP(apex, eBt)} color={gold} style="stroke" strokeWidth={2} opacity={0.95} />
          <Path path={poly([eLt, eBt, eRt])} color={gold} style="stroke" strokeWidth={2.2} opacity={0.95} />
          <Path path={poly([eLt, eBt, eRt])} color={lt(gold, 0.3)} style="stroke" strokeWidth={0.9} opacity={0.7} />
        </>
      )}
      {/* Gold-Finial (Stange + Kugel) an der Spitze */}
      {finial && (
        <Group>
          <Path path={lineP(apex, [apex[0], apex[1] - 10])} color={dk(finial, 0.25)} style="stroke" strokeWidth={2.2} />
          <Circle cx={apex[0]} cy={apex[1] - 12} r={3.4} color={finial} />
          <Circle cx={apex[0] - 0.9} cy={apex[1] - 13} r={1.3} color={lt(finial, 0.45)} />
        </Group>
      )}
    </Group>
  );
}

/** Gabeldach (Satteldach) — First-Linie statt Spitze (für Hütten/Kaserne). */
function GableRoof({ g, height, color }: { g: BoxGeom; height: number; color: string }): React.ReactElement {
  const ridgeF: P = [g.cx, g.Bt[1] - height]; // First vorne (über Bt)
  const ridgeB: P = [g.cx, g.Tt[1] - height]; // First hinten
  const oh = 0.12;
  const Cc: P = [g.cx, g.cy - g.h];
  const exp = (p: P): P => [Cc[0] + (p[0] - Cc[0]) * (1 + oh), Cc[1] + (p[1] - Cc[1]) * (1 + oh) + 2];
  const eLt = exp(g.Lt), eBt = exp(g.Bt), eRt = exp(g.Rt), eTt = exp(g.Tt);
  void eTt;
  const oc = dk(color, 0.62);
  return (
    <Group>
      <Path path={poly([eLt, eBt, ridgeF, ridgeB])}>
        <LinearGradient start={vec(ridgeB[0], ridgeB[1])} end={vec(eBt[0], eBt[1])} colors={[lt(color, 0.2), dk(color, 0.28)]} />
      </Path>
      <Path path={poly([eBt, eRt, ridgeB, ridgeF])}>
        <LinearGradient start={vec(ridgeB[0], ridgeB[1])} end={vec(eBt[0], eBt[1])} colors={[color, dk(color, 0.5)]} />
      </Path>
      <Path path={lineP(eBt, ridgeF)} color={oc} style="stroke" strokeWidth={1.2} opacity={0.5} />
      <Path path={lineP(ridgeF, ridgeB)} color={lt(color, 0.45)} style="stroke" strokeWidth={1.7} opacity={0.9} />
      <Path path={poly([eLt, eBt, eRt, ridgeB])} style="stroke" color={oc} strokeWidth={1.9} opacity={0.9} />
    </Group>
  );
}

/** Senkrechter Zylinder (Silo/Tank/Fass). */
function Cylinder({ x, baseY, rx, h, color }: { x: number; baseY: number; rx: number; h: number; color: string }): React.ReactElement {
  const ry = rx * 0.42;
  return (
    <Group>
      <Path path={`M ${x - rx} ${baseY - h} L ${x - rx} ${baseY} A ${rx} ${ry} 0 0 0 ${x + rx} ${baseY} L ${x + rx} ${baseY - h} Z`}>
        <LinearGradient start={vec(x - rx, 0)} end={vec(x + rx, 0)} colors={[dk(color, 0.32), lt(color, 0.16), dk(color, 0.42)]} />
      </Path>
      <Group transform={[{ scaleY: 0.42 }]} origin={vec(x, baseY - h)}>
        <Circle cx={x} cy={baseY - h} r={rx} color={lt(color, 0.22)} />
      </Group>
    </Group>
  );
}

/** Runder Eckturm mit Stein-Schaft, Cornice-Ring, hohem Kegeldach + Gold-Knauf
 *  (für den Menschen-Keep — angelehnt an die Bild-Vorlage). */
function RoundTower({ x, baseY, r, h, coneH, wall, roof, gold, pennant }:
  { x: number; baseY: number; r: number; h: number; coneH: number; wall: string; roof: string; gold: string; pennant?: string }): React.ReactElement {
  const ry = r * 0.42;
  const topY = baseY - h;
  const apex = topY - coneH;
  const eave = r * 1.18; // Dachüberstand
  return (
    <Group>
      {/* Schaft */}
      <Path path={`M ${x - r} ${topY} L ${x - r} ${baseY} A ${r} ${ry} 0 0 0 ${x + r} ${baseY} L ${x + r} ${topY} Z`}>
        <LinearGradient start={vec(x - r, 0)} end={vec(x + r, 0)} colors={[dk(wall, 0.36), lt(wall, 0.16), dk(wall, 0.5)]} />
      </Path>
      {/* Steinfugen (waagerechte Lagen) */}
      {[0.34, 0.62].map((f, i) => (
        <Path key={`c${i}`} path={`M ${x - r} ${topY + h * f} A ${r} ${ry} 0 0 0 ${x + r} ${topY + h * f}`} color={dk(wall, 0.3)} style="stroke" strokeWidth={0.9} opacity={0.45} />
      ))}
      {/* schmales Bogenfenster */}
      <Path path={`M ${x - 1.6} ${topY + 6} L ${x + 1.6} ${topY + 6} L ${x + 1.6} ${topY + 13} Q ${x} ${topY + 16} ${x - 1.6} ${topY + 13} Z`} color="#11233a" />
      {/* Cornice-Ring (heller Steinkranz) */}
      <Path path={`M ${x - r} ${topY} A ${r} ${ry} 0 0 0 ${x + r} ${topY}`} color={lt(wall, 0.18)} style="stroke" strokeWidth={2.4} />
      <Path path={`M ${x - r} ${topY - 2} A ${r} ${ry} 0 0 0 ${x + r} ${topY - 2}`} color={dk(wall, 0.18)} style="stroke" strokeWidth={1.2} opacity={0.6} />
      {/* Kegeldach */}
      <Path path={poly([[x - eave, topY], [x, apex], [x + eave, topY]])}>
        <LinearGradient start={vec(x, apex)} end={vec(x, topY)} colors={[lt(roof, 0.28), roof, dk(roof, 0.42)]} />
      </Path>
      {/* Traufkante vorne */}
      <Path path={`M ${x - eave} ${topY} A ${eave} ${eave * 0.42} 0 0 0 ${x + eave} ${topY}`} color={dk(roof, 0.48)} opacity={0.55} />
      {/* heller Mittelgrat + Außen-Outline */}
      <Path path={`M ${x} ${apex} L ${x} ${topY}`} color={lt(roof, 0.45)} style="stroke" strokeWidth={1.2} opacity={0.7} />
      <Path path={poly([[x - eave, topY], [x, apex], [x + eave, topY]])} style="stroke" color={dk(roof, 0.62)} strokeWidth={1.5} opacity={0.85} />
      {/* Gold-Knauf (+ optionaler Wimpel) */}
      <Path path={`M ${x} ${apex} L ${x} ${apex - (pennant ? 16 : 9)}`} color={dk(gold, 0.25)} style="stroke" strokeWidth={2.2} />
      {pennant && (
        <Path path={poly([[x, apex - 16], [x + 12, apex - 13], [x + 7, apex - 9], [x, apex - 9]])}>
          <LinearGradient start={vec(x, apex - 16)} end={vec(x + 12, apex - 9)} colors={[lt(pennant, 0.2), dk(pennant, 0.12)]} />
        </Path>
      )}
      <Circle cx={x} cy={apex - (pennant ? 18 : 11)} r={3.1} color={gold} />
      <Circle cx={x - 0.9} cy={apex - (pennant ? 19 : 12)} r={1.2} color={lt(gold, 0.45)} />
    </Group>
  );
}

/** Liegender Stamm/Bohle (Querschnitt sichtbar). */
function Log({ x, y, len, r, color }: { x: number; y: number; len: number; r: number; color: string }): React.ReactElement {
  return (
    <Group>
      <RoundedRect x={x} y={y - r} width={len} height={r * 2} r={r} color={dk(color, 0.1)} />
      <Group transform={[{ scaleX: 0.5 }]} origin={vec(x, y)}>
        <Circle cx={x} cy={y} r={r} color={lt(color, 0.18)} />
        <Circle cx={x} cy={y} r={r * 0.55} color={dk(color, 0.18)} />
      </Group>
    </Group>
  );
}

// --- Farb-Paletten je Typ (Identität dominiert über Tier) ---
interface Pal { wall: string; roof: string; accent: string }
const PALETTE: Record<string, Pal> = {
  town_hall: { wall: '#e3d6ac', roof: '#caa12e', accent: '#f0c040' },
  clan_castle: { wall: '#8d929c', roof: '#6b4ea0', accent: '#b39bff' },
  lumber_camp: { wall: '#9c6b3a', roof: '#6e4423', accent: '#b5823f' },
  quarry: { wall: '#9aa0a6', roof: '#6b7176', accent: '#c2c8ce' },
  gold_mine: { wall: '#7a5a32', roof: '#5a3f22', accent: '#f0c040' },
  storage_wood: { wall: '#8a5a28', roof: '#6e4423', accent: '#b5823f' },
  storage_stone: { wall: '#8a9098', roof: '#6b7176', accent: '#c2c8ce' },
  storage_gold: { wall: '#caa12e', roof: '#9a7a1e', accent: '#ffe08a' },
  wall: { wall: '#b0a890', roof: '#9a927a', accent: '#cfc7ad' },
  barracks: { wall: '#9c4a3a', roof: '#5a2a22', accent: '#d9433f' },
  watchtower: { wall: '#9aa6b2', roof: '#5a6b7a', accent: '#cdd6df' },
  cannon: { wall: '#50505a', roof: '#3a3a42', accent: '#7a7a84' },
};
const DEFAULT_PAL: Pal = { wall: '#b08a5a', roof: '#7a4a8a', accent: '#c79bff' };

// --- MENSCHEN-Baustil (nach Bild-Vorlage „Das Menschen Königreich"):
// royalblaue (Spitz-)Dächer, helle Steinmauern, Gold-Zierde; Grassockel separat im Rahmen. ---
const HUMAN_ROOF = '#2f5fbf';
const HUMAN_PALETTE: Record<string, Pal> = {
  town_hall: { wall: '#e8dcb8', roof: HUMAN_ROOF, accent: '#f0c040' },
  clan_castle: { wall: '#c4c8d0', roof: HUMAN_ROOF, accent: '#f0c040' },
  lumber_camp: { wall: '#b07c44', roof: HUMAN_ROOF, accent: '#caa15a' },
  quarry: { wall: '#b8bcc2', roof: HUMAN_ROOF, accent: '#dadfe4' },
  gold_mine: { wall: '#9a7340', roof: HUMAN_ROOF, accent: '#f0c040' },
  storage_wood: { wall: '#b07c44', roof: HUMAN_ROOF, accent: '#caa15a' },
  storage_stone: { wall: '#b8bcc2', roof: HUMAN_ROOF, accent: '#dadfe4' },
  storage_gold: { wall: '#cdaa3a', roof: HUMAN_ROOF, accent: '#ffe08a' },
  wall: { wall: '#c6c0a8', roof: '#a9a48c', accent: '#dcd6c0' },
  barracks: { wall: '#ddd2b2', roof: HUMAN_ROOF, accent: '#c0392b' },
  watchtower: { wall: '#ced3db', roof: HUMAN_ROOF, accent: '#f0c040' },
  cannon: { wall: '#9aa0aa', roof: HUMAN_ROOF, accent: '#cfd4dc' },
};
const HUMAN_DEFAULT: Pal = { wall: '#ddd2b2', roof: HUMAN_ROOF, accent: '#f0c040' };

// Hero-Gebäude werden größer gerendert, damit ihre Details auf dem Handy sichtbar sind
// (Rathaus = Mittelpunkt des Dorfs, wie in Clash of Clans). Skaliert um den Sockel.
const TYPE_SCALE: Record<string, number> = { town_hall: 1.55, clan_castle: 1.2 };

/** Leuchtende-Fenster-Helfer (auf linker Wand). */
function windows(g: BoxGeom, count: number, lit: boolean, magic: boolean, pulse: number): React.ReactElement {
  const winColor = lit ? (magic ? '#aef0ff' : '#ffe9a8') : '#23303f';
  const glow = lit ? (magic ? '#00ccff' : '#f0b000') : null;
  return (
    <Group>
      {Array.from({ length: count }).map((_, i) => {
        const s = count === 1 ? 0.5 : 0.3 + i * 0.4;
        const c = [onLeft(g, s - 0.09, 0.28), onLeft(g, s + 0.09, 0.28), onLeft(g, s + 0.09, 0.55), onLeft(g, s - 0.09, 0.55)] as P[];
        const ctr = onLeft(g, s, 0.42);
        const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const frame = lit ? (magic ? '#0a3a4a' : '#7a5a10') : '#11161e';
        return (
          <Group key={i}>
            {glow && <Circle cx={ctr[0]} cy={ctr[1]} r={7} color={glow} opacity={0.3 + 0.25 * pulse} />}
            <Path path={poly(c)} color={winColor} />
            {/* Sprossenkreuz + Rahmen */}
            <Path path={lineP(mid(c[0], c[1]), mid(c[3], c[2]))} color={frame} style="stroke" strokeWidth={1} opacity={0.8} />
            <Path path={lineP(mid(c[0], c[3]), mid(c[1], c[2]))} color={frame} style="stroke" strokeWidth={1} opacity={0.8} />
            <Path path={poly(c)} style="stroke" color={frame} strokeWidth={1.2} opacity={0.9} />
          </Group>
        );
      })}
    </Group>
  );
}

/** Zinnen entlang der oberen vorderen Kante (Lt→Bt→Rt). */
function battlements(g: BoxGeom, color: string): React.ReactElement {
  const merlon = (a: P, b: P, frac: number, w: number, hgt: number) => {
    const mx = a[0] + (b[0] - a[0]) * frac, my = a[1] + (b[1] - a[1]) * frac;
    const mx2 = a[0] + (b[0] - a[0]) * (frac + w), my2 = a[1] + (b[1] - a[1]) * (frac + w);
    return poly([[mx, my], [mx2, my2], [mx2, my2 - hgt], [mx, my - hgt]]);
  };
  return (
    <Group>
      {[0.08, 0.5, 0.84].map((f, i) => <Path key={`l${i}`} path={merlon(g.Lt, g.Bt, f, 0.12, 8)} color={lt(color, 0.06)} />)}
      {[0.16, 0.58, 0.84].map((f, i) => <Path key={`r${i}`} path={merlon(g.Bt, g.Rt, f, 0.12, 8)} color={dk(color, 0.12)} />)}
    </Group>
  );
}

/** Tür auf der linken Wand. */
function door(g: BoxGeom, color: string): React.ReactElement {
  return <Path path={poly([onLeft(g, 0.4, 0.5), onLeft(g, 0.6, 0.5), onLeft(g, 0.6, 1), onLeft(g, 0.4, 1)])} color={color} />;
}

function BuildingSpriteImpl({
  type, level, maxLevel, cx, cy, selected, isUpgrading,
  clock = 0, idle, reduceEffects = false, extraScale = 1, flash = 0, skin, faction, image,
  imageAnchor,
}: BuildingSpriteProps): React.ReactElement {
  const t = tierProgress(level, maxLevel);
  const isHuman = faction === 'humans';
  const basePal = isHuman ? (HUMAN_PALETTE[type] ?? HUMAN_DEFAULT) : (PALETTE[type] ?? DEFAULT_PAL);
  // Menschen: goldener Dach-Knauf auf den blauen Spitztürmen (Bild-Signatur).
  const humanGold = isHuman ? '#f0c040' : undefined;
  // Angewandter Skin überschreibt die Typ-Palette (Identität bleibt über die
  // Silhouette erhalten, nur die Farben wechseln); Dach = abgedunkelte Hauptfarbe.
  const pal: Pal = skin
    ? {
        wall: skin.primary ?? basePal.wall,
        roof: skin.primary ? dk(skin.primary, 0.28) : basePal.roof,
        accent: skin.accent ?? basePal.accent,
      }
    : basePal;
  const wall = lt(pal.wall, t * 0.12); // Tier hellt leicht auf, Identität bleibt
  const roof = pal.roof;
  // Aktuelles Material/Clock setzen, damit alle Box-Instanzen dieses Gebäudes
  // die passende Shader-Textur bekommen (Fallback gilt, wenn Shader nicht kompiliert).
  _mat = MATERIAL_FOR[type] ?? MAT.plaster;
  _clk = clock;

  const idleActive = idle && !reduceEffects && clock > 0;
  const breathing = idleActive ? 1 + idle!.breathing_amplitude * Math.sin((clock / 1000 / idle!.breathing_period_seconds) * Math.PI * 2) : 1;
  // TYPE_SCALE korrigiert nur die PROZEDURALE Vektor-Optik (dort ist die Größe
  // frei erfunden). Bild-Sprites tragen ihren Maßstab bereits im Master —
  // ein zusätzlicher Typ-Faktor würde den gemeinsamen Weltmaßstab brechen.
  //
  // Die Idle-„Atmung" (breathing) wirkt NUR auf die prozeduralen Vektor-Fallbacks.
  // Auf den fotorealistischen Bild-Sprites ließ das dauerhafte Skalieren jedes
  // Gebäude sichtbar „pulsieren wie ein Herz" — ein Steinbau atmet nicht. Bild-
  // Sprites bleiben daher im Ruhezustand fix bei Scale 1.0 (extraScale === 1) und
  // zeigen nur die EINMALIGE Pop-In-/Upgrade-Animation (extraScale via popIn).
  const scale = image ? extraScale : breathing * extraScale * (TYPE_SCALE[type] ?? 1);
  const flagSway = idleActive ? Math.sin((clock / 1000 / idle!.flag_sway_period_seconds) * Math.PI * 2) * idle!.flag_sway_amplitude_deg * 0.7 : 0;
  const pulse = clock > 0 ? 0.5 + 0.5 * Math.sin(clock / 600) : 0.5;

  // --- BILD-SPRITE-Pfad (z.B. Menschen-Gebäude aus der Vorlage) ---
  // Hat Vorrang vor der Vektorgrafik; behält Schatten/Auswahl/Upgrade/Flash bei.
  if (image) {
    const iw = image.width() || 1;
    const ih = image.height() || 1;
    // GEMEINSAMER WELTMASSSTAB: die Breite folgt aus den px/Welteinheit des
    // Masters — dieselbe Rechnung, die auch die Einheiten benutzen (keine
    // Tile-Faustformel). Danach eine BEWUSSTE Pro-Typ-Feinjustierung der
    // Größenhierarchie (buildingDisplayScale, CoC-Style: Rathaus dominant,
    // Lager/Verteidigung kompakt) — rein optisch, reversibel, Master unberührt.
    const dispW = buildingDisplayWidth(iw) * buildingDisplayScale(type);
    const dispH = dispW * (ih / iw);
    // Anker aus dem Manifest = Fußpunkt (Weltursprung des Gebäudes) → exakt auf
    // die Kachelmitte legen. Fallback: unten-mitte.
    const ax = imageAnchor?.[0] ?? 0.5;
    const ay = imageAnchor?.[1] ?? 1.0;
    const ix = cx - ax * dispW;
    const iy = cy - ay * dispH;
    const baseY = cy;
    const topY = iy + dispH * 0.12;
    // Auswahl-Ring am Sockel folgt der Sprite-Größe.
    const ringR = dispW * 0.26;
    return (
      <Group transform={[{ scale }]} origin={vec(cx, baseY)}>
        {/* KEIN Boden-Schatten mehr: die sockellosen Gebäude sitzen direkt auf
            dem Dorf-Rasen (CoC-Style). Eine losgelöste Schatten-Ellipse ließ
            die Gebäude — vor allem die runden — schweben wirken. */}
        {/* Auswahl-Ring am Sockel */}
        {selected && (
          <Group transform={[{ scaleY: 0.5 }]} origin={vec(cx, baseY - 6)}>
            <Circle cx={cx} cy={baseY - 6} r={ringR} color="#ffffff" style="stroke" strokeWidth={3} opacity={0.9} />
          </Group>
        )}
        {/* Das Gebäude-Sprite */}
        <SkiaImage image={image} x={ix} y={iy} width={dispW} height={dispH} fit="contain" />
        {/* Hit-Flash: dasselbe Sprite weiß eingefärbt darüber */}
        {flash > 0 && (
          <Group opacity={Math.min(1, flash)}>
            <SkiaImage image={image} x={ix} y={iy} width={dispW} height={dispH} fit="contain">
              <ColorMatrix matrix={[0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]} />
            </SkiaImage>
          </Group>
        )}
        {/* Upgrade-Indikator */}
        {isUpgrading && (
          <>
            <Circle cx={cx} cy={topY - 14} r={9} color="#7cdc5a" opacity={0.25 + 0.2 * pulse} />
            <Circle cx={cx} cy={topY - 14} r={5} color="#7cdc5a" />
          </>
        )}
      </Group>
    );
  }

  const showGold = hasGoldAccents(level);
  const showMagic = hasMagicAura(level);
  const showAura = hasLegendaryAura(level);
  const winCount = level >= 5 ? 2 : 1;
  const winLit = level >= 6;
  // Schornstein-Rauch für Wohn-/Werk-Gebäude (Leben in der Szene).
  const hasSmoke = !reduceEffects && (type === 'town_hall' || type === 'barracks' || type === 'lumber_camp' || type === 'quarry' || PALETTE[type] === undefined);

  // Flagge & Spitzen-Funken-Helfer.
  const flagAt = (x: number, topY: number, color: string) => (
    <Group>
      <Path path={`M ${x} ${topY} L ${x} ${topY - 20}`} color="#2a2014" style="stroke" strokeWidth={2.4} />
      <Path path={poly([[x, topY - 19], [x + 16 + flagSway, topY - 14 + flagSway * 0.3], [x + 14 + flagSway * 0.8, topY - 9], [x, topY - 7]])}>
        <LinearGradient start={vec(x, topY - 18)} end={vec(x + 16, topY - 8)} colors={[lt(color, 0.2), dk(color, 0.15)]} />
      </Path>
    </Group>
  );

  // --- TYP-SPEZIFISCHE KÖRPER ---
  let body: React.ReactElement;
  let flashG: BoxGeom; // Bounding-Box für den Hit-Flash
  let topY: number; // höchster Punkt (für Aura/Funken)

  switch (type) {
    case 'town_hall': {
      if (isHuman) {
        // Prächtiger Keep nach Bild-Vorlage: Steinsaal + großes blaues Pavillon-Dach
        // (Gold-Grate/Knauf) + VIER runde Eck-Türme mit hohen blauen Kegeldächern +
        // Gold-Knäufen, Bogentor, leuchtende Bogenfenster.
        const hw = FW * 0.44, hh = FH * 0.44, wh = 28;
        const hall = boxGeom(cx, cy, hw, hh, wh);
        const tr = 11, tsh = 44, tcone = 24;
        const blue = '#2f5fbf';
        flashG = hall;
        topY = cy - 100; // höchster Punkt (zentraler Bergfried)
        const dCol = '#16273d';
        // ein leuchtendes Bogenfenster auf der linken Wand bei Quer-Position s
        const archWin = (s: number, key: string) => {
          const a = onLeft(hall, s - 0.07, 0.34), b = onLeft(hall, s + 0.07, 0.34);
          const a2 = onLeft(hall, s - 0.07, 0.66), b2 = onLeft(hall, s + 0.07, 0.66);
          const top = onLeft(hall, s, 0.24);
          const ctr = onLeft(hall, s, 0.5);
          return (
            <Group key={key}>
              <Circle cx={ctr[0]} cy={ctr[1]} r={7} color="#ffe9a8" opacity={0.28 + 0.22 * pulse} />
              <Path path={`M ${a[0]} ${a[1]} L ${a2[0]} ${a2[1]} L ${b2[0]} ${b2[1]} L ${b[0]} ${b[1]} Q ${top[0]} ${top[1]} ${a[0]} ${a[1]} Z`} color="#ffdf91" />
              <Path path={`M ${a[0]} ${a[1]} L ${a2[0]} ${a2[1]} L ${b2[0]} ${b2[1]} L ${b[0]} ${b[1]} Q ${top[0]} ${top[1]} ${a[0]} ${a[1]} Z`} style="stroke" color={humanGold!} strokeWidth={1.4} opacity={0.9} />
            </Group>
          );
        };
        // lodernde Fackel am Tor (flackert über die Uhr)
        const brazier = (p: P, key: string) => {
          const fl = 0.6 + 0.4 * Math.sin(clock / 110 + p[0] * 0.3);
          return (
            <Group key={key}>
              <Path path={`M ${p[0]} ${p[1]} L ${p[0]} ${p[1] - 9}`} color="#2a1d10" style="stroke" strokeWidth={2.6} />
              <Circle cx={p[0]} cy={p[1] - 13} r={8} color="#ff9a3c" opacity={0.32 * fl} />
              <Circle cx={p[0]} cy={p[1] - 13} r={3.6} color="#ffd45a" opacity={0.9 * fl} />
              <Circle cx={p[0]} cy={p[1] - 15} r={1.6} color="#fff2c0" />
            </Group>
          );
        };
        body = (
          <Group>
            {/* goldener Glüh-Schein hinter dem Keep */}
            {!reduceEffects && (
              <Circle cx={cx} cy={cy - 26} r={FW * 0.82}>
                <RadialGradient c={vec(cx, cy - 26)} r={FW * 0.82} colors={[`rgba(255,212,120,${0.16 + 0.08 * pulse})`, 'rgba(255,200,90,0)']} />
              </Circle>
            )}
            {/* hinterer Eckturm (zuerst = hinten) */}
            <RoundTower x={cx} baseY={cy - hh} r={tr} h={tsh} coneH={tcone} wall={wall} roof={roof} gold={humanGold!} pennant={blue} />
            {/* Hauptsaal */}
            <Box g={hall} color={wall} />
            {/* Bogentor mittig */}
            <Path path={poly([onLeft(hall, 0.4, 0.46), onLeft(hall, 0.6, 0.46), onLeft(hall, 0.6, 1), onLeft(hall, 0.4, 1)])} color={dCol} />
            <Circle cx={onLeft(hall, 0.5, 0.46)[0]} cy={onLeft(hall, 0.5, 0.46)[1]} r={(onLeft(hall, 0.6, 0.46)[0] - onLeft(hall, 0.4, 0.46)[0]) / 2} color={dCol} />
            <Path path={`M ${onLeft(hall, 0.4, 0.46)[0]} ${onLeft(hall, 0.4, 0.46)[1]} A 6 6 0 0 1 ${onLeft(hall, 0.6, 0.46)[0]} ${onLeft(hall, 0.6, 0.46)[1]}`} style="stroke" color={humanGold!} strokeWidth={1.6} opacity={0.85} />
            {/* Wandbanner über dem Tor (blau/gold mit Wappen) */}
            <Path path={poly([onLeft(hall, 0.43, 0.05), onLeft(hall, 0.57, 0.05), onLeft(hall, 0.57, 0.34), onLeft(hall, 0.5, 0.42), onLeft(hall, 0.43, 0.34)])}>
              <LinearGradient start={vec(onLeft(hall, 0.5, 0.05)[0], onLeft(hall, 0.5, 0.05)[1])} end={vec(onLeft(hall, 0.5, 0.42)[0], onLeft(hall, 0.5, 0.42)[1])} colors={[lt(blue, 0.12), dk(blue, 0.18)]} />
            </Path>
            <Path path={poly([onLeft(hall, 0.43, 0.05), onLeft(hall, 0.57, 0.05), onLeft(hall, 0.57, 0.34), onLeft(hall, 0.5, 0.42), onLeft(hall, 0.43, 0.34)])} style="stroke" color={humanGold!} strokeWidth={1.4} opacity={0.9} />
            <Circle cx={onLeft(hall, 0.5, 0.2)[0]} cy={onLeft(hall, 0.5, 0.2)[1]} r={3} color={humanGold!} />
            {/* leuchtende Bogenfenster */}
            {archWin(0.2, 'w1')}
            {archWin(0.8, 'w2')}
            {/* Zinnen-Parapet auf dem Saal */}
            {battlements(hall, wall)}
            {/* großer zentraler Bergfried (sauberer Rundturm, kein buggy Dach) */}
            <RoundTower x={cx} baseY={cy - 22} r={14} h={40} coneH={28} wall={wall} roof={roof} gold={humanGold!} pennant={blue} />
            {/* seitliche Eck-Türme (mit Wimpel) */}
            <RoundTower x={cx - hw} baseY={cy} r={tr} h={tsh} coneH={tcone} wall={wall} roof={roof} gold={humanGold!} pennant={blue} />
            <RoundTower x={cx + hw} baseY={cy} r={tr} h={tsh} coneH={tcone} wall={wall} roof={roof} gold={humanGold!} pennant={blue} />
            {/* vorderer Eckturm (zuletzt = vorne) */}
            <RoundTower x={cx} baseY={cy + hh} r={tr} h={tsh} coneH={tcone} wall={wall} roof={roof} gold={humanGold!} pennant={blue} />
            {/* Fackeln links/rechts vom Tor */}
            {brazier(onLeft(hall, 0.26, 1), 'bl')}
            {brazier(onLeft(hall, 0.74, 1), 'br')}
          </Group>
        );
        break;
      }
      const base = boxGeom(cx, cy, FW * 0.56, FH * 0.56, 30);
      const tier2 = boxGeom(cx, cy - 30, FW * 0.36, FH * 0.36, 26);
      flashG = base; topY = cy - 30 - 26 - 40;
      body = (
        <Group>
          <Box g={base} color={wall} />
          {door(base, dk(roof, 0.2))}
          {/* Wappen-Rund am Sockel */}
          <Circle cx={onLeft(base, 0.5, 0.36)[0]} cy={onLeft(base, 0.5, 0.36)[1]} r={6} color={pal.accent} />
          <Circle cx={onLeft(base, 0.5, 0.36)[0]} cy={onLeft(base, 0.5, 0.36)[1]} r={3} color={dk(pal.accent, 0.3)} />
          <Box g={tier2} color={lt(wall, 0.05)} />
          {windows(tier2, 2, winLit, level >= 9, pulse)}
          <Roof g={tier2} height={40} color={roof} overhang={0.2} />
          {flagAt(cx, cy - 30 - 26 - 40, level >= 7 ? MATERIAL_COLORS.magic_cyan : pal.accent)}
        </Group>
      );
      break;
    }
    case 'clan_castle': {
      if (isHuman) {
        // Kompakte Burg im Keep-Stil: 3 Rundtürme + Zinnen-Saal + Tor + Banner.
        const hw = FW * 0.4, hh = FH * 0.4, wh = 26;
        const hall = boxGeom(cx, cy, hw, hh, wh);
        flashG = hall; topY = (cy - hh) - 38 - 22 - 16;
        const cg = '#1c1726';
        return wrap(
          <Group>
            <RoundTower x={cx} baseY={cy - hh} r={9} h={36} coneH={20} wall={wall} roof={roof} gold={humanGold!} pennant={HUMAN_ROOF} />
            <Box g={hall} color={wall} />
            {battlements(hall, wall)}
            {/* Burgtor */}
            <Path path={poly([onLeft(hall, 0.38, 0.46), onLeft(hall, 0.62, 0.46), onLeft(hall, 0.62, 1), onLeft(hall, 0.38, 1)])} color={cg} />
            <Circle cx={onLeft(hall, 0.5, 0.46)[0]} cy={onLeft(hall, 0.5, 0.46)[1]} r={(onLeft(hall, 0.62, 0.46)[0] - onLeft(hall, 0.38, 0.46)[0]) / 2} color={cg} />
            {/* kleines Wappenbanner */}
            <Path path={poly([onLeft(hall, 0.44, 0.06), onLeft(hall, 0.56, 0.06), onLeft(hall, 0.56, 0.32), onLeft(hall, 0.5, 0.4), onLeft(hall, 0.44, 0.32)])} color={dk(HUMAN_ROOF, 0.1)} />
            <Path path={poly([onLeft(hall, 0.44, 0.06), onLeft(hall, 0.56, 0.06), onLeft(hall, 0.56, 0.32), onLeft(hall, 0.5, 0.4), onLeft(hall, 0.44, 0.32)])} style="stroke" color={humanGold!} strokeWidth={1.2} opacity={0.9} />
            {/* vordere Ecktürme */}
            <RoundTower x={cx - hw} baseY={cy} r={9} h={36} coneH={20} wall={wall} roof={roof} gold={humanGold!} pennant={HUMAN_ROOF} />
            <RoundTower x={cx + hw} baseY={cy} r={9} h={36} coneH={20} wall={wall} roof={roof} gold={humanGold!} pennant={HUMAN_ROOF} />
          </Group>,
        );
      }
      const base = boxGeom(cx, cy, FW * 0.54, FH * 0.54, 34);
      const turret = boxGeom(cx + FW * 0.34, cy - 6, FW * 0.18, FH * 0.18, 52);
      flashG = base; topY = cy - 6 - 52 - 18;
      body = (
        <Group>
          <Box g={base} color={wall} />
          {battlements(base, wall)}
          {/* Burgtor (Bogen) */}
          <Path path={poly([onLeft(base, 0.36, 0.42), onLeft(base, 0.64, 0.42), onLeft(base, 0.64, 1), onLeft(base, 0.36, 1)])} color="#2a2230" />
          <Circle cx={onLeft(base, 0.5, 0.42)[0]} cy={onLeft(base, 0.5, 0.42)[1]} r={(onLeft(base, 0.64, 0.42)[0] - onLeft(base, 0.36, 0.42)[0]) / 2} color="#2a2230" />
          {/* Eckturm */}
          <Box g={turret} color={lt(wall, 0.04)} />
          {battlements(turret, wall)}
          <Roof g={turret} height={22} color={roof} overhang={0.25} />
          {flagAt(turret.cx, turret.cy - turret.hh - turret.h - 22, pal.accent)}
        </Group>
      );
      break;
    }
    case 'gold_mine': {
      // Erdhügel + Mineneingang + Stützbalken + Lore mit Gold.
      const hill = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 16);
      flashG = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 30); topY = cy - 30;
      const ent = [onLeft(hill, 0.3, 0.15), onLeft(hill, 0.7, 0.15), onLeft(hill, 0.7, 1), onLeft(hill, 0.3, 1)] as P[];
      return wrap(
        <Group>
          <Box g={hill} color={wall} />
          {/* Eingang dunkel + Holzrahmen */}
          <Path path={poly(ent)} color="#140f0a" />
          <Path path={lineP(onLeft(hill, 0.3, 0.15), onLeft(hill, 0.3, 1))} color={dk(pal.accent, 0.4)} style="stroke" strokeWidth={3} />
          <Path path={lineP(onLeft(hill, 0.7, 0.15), onLeft(hill, 0.7, 1))} color={dk(pal.accent, 0.4)} style="stroke" strokeWidth={3} />
          <Path path={lineP(onLeft(hill, 0.3, 0.15), onLeft(hill, 0.7, 0.15))} color={dk(pal.accent, 0.4)} style="stroke" strokeWidth={4} />
          {/* Goldklumpen im Eingang */}
          <Circle cx={onLeft(hill, 0.5, 0.7)[0]} cy={onLeft(hill, 0.5, 0.7)[1]} r={5} color={pal.accent} />
          {/* Lore mit Gold rechts */}
          <RoundedRect x={cx + 14} y={cy - 16} width={22} height={13} r={2} color="#4a3526" />
          <Circle cx={cx + 19} cy={cy + 1} r={4} color="#2a2018" />
          <Circle cx={cx + 31} cy={cy + 1} r={4} color="#2a2018" />
          {[0, 1, 2].map((i) => <Circle key={i} cx={cx + 18 + i * 6} cy={cy - 17} r={3} color={lt(pal.accent, i * 0.1)} />)}
        </Group>,
      );
    }
    case 'lumber_camp': {
      const cabin = boxGeom(cx - FW * 0.14, cy, FW * 0.4, FH * 0.4, 26);
      flashG = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 30); topY = cy - 26 - 24;
      return wrap(
        <Group>
          <Box g={cabin} color={wall} />
          {door(cabin, dk(roof, 0.2))}
          <GableRoof g={cabin} height={20} color={roof} />
          {/* Holzstapel rechts */}
          <Log x={cx + 6} y={cy + 2} len={30} r={5} color={pal.accent} />
          <Log x={cx + 9} y={cy - 7} len={26} r={5} color={lt(pal.accent, 0.06)} />
          <Log x={cx + 12} y={cy - 16} len={22} r={5} color={pal.accent} />
          {/* Axt im Stumpf */}
          <Circle cx={cx + 30} cy={cy + 8} r={6} color={dk(pal.accent, 0.25)} />
          <Path path={`M ${cx + 30} ${cy + 6} L ${cx + 38} ${cy - 6}`} color="#6b4a2a" style="stroke" strokeWidth={2.5} />
          <Path path={poly([[cx + 36, cy - 5], [cx + 42, cy - 9], [cx + 41, cy - 2]])} color="#c2c8ce" />
        </Group>,
      );
    }
    case 'quarry': {
      const shed = boxGeom(cx - FW * 0.16, cy, FW * 0.34, FH * 0.34, 22);
      flashG = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 26); topY = cy - 22 - 16;
      const block = (bx: number, by: number, s: number, col: string) => <Box g={boxGeom(bx, by, s, s * 0.5, s)} color={col} />;
      return wrap(
        <Group>
          <Box g={shed} color={wall} />
          <GableRoof g={shed} height={16} color={roof} />
          {/* Steinblöcke gestapelt rechts */}
          {block(cx + 16, cy + 4, 11, pal.accent)}
          {block(cx + 30, cy + 4, 11, dk(pal.accent, 0.1))}
          {block(cx + 23, cy - 8, 11, lt(pal.accent, 0.06))}
          {/* Spitzhacke */}
          <Path path={`M ${cx + 6} ${cy - 4} L ${cx - 2} ${cy - 20}`} color="#6b4a2a" style="stroke" strokeWidth={2.5} />
          <Path path={`M ${cx - 8} ${cy - 18} Q ${cx - 2} ${cy - 24} ${cx + 4} ${cy - 18}`} color="#9aa0a6" style="stroke" strokeWidth={3} />
        </Group>,
      );
    }
    case 'storage_wood': {
      const g = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 22);
      flashG = g; topY = cy - 22 - 18;
      return wrap(
        <Group>
          <Box g={g} color={dk(wall, 0.1)} />
          {/* offener Stapel Holz oben */}
          {[0, 1, 2, 3].map((i) => <Log key={`a${i}`} x={cx - 24} y={cy - 22 - 2 + Math.floor(i / 2) * -9} len={48} r={5} color={i % 2 ? lt(pal.accent, 0.06) : pal.accent} />)}
          <Roof g={g} height={16} color={roof} overhang={0.22} />
        </Group>,
      );
    }
    case 'storage_stone': {
      flashG = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 30); topY = cy - 34;
      const block = (bx: number, by: number, s: number, col: string) => <Box g={boxGeom(bx, by, s, s * 0.5, s)} color={col} />;
      return wrap(
        <Group>
          {/* Haufen großer Steinblöcke */}
          {block(cx - 20, cy + 6, 16, dk(wall, 0.08))}
          {block(cx + 8, cy + 8, 16, wall)}
          {block(cx - 4, cy - 8, 17, lt(wall, 0.06))}
          {block(cx + 18, cy - 6, 13, dk(wall, 0.04))}
        </Group>,
      );
    }
    case 'storage_gold': {
      const g = boxGeom(cx, cy, FW * 0.46, FH * 0.46, 30);
      flashG = g; topY = cy - 30 - 8;
      return wrap(
        <Group>
          <Box g={g} color={wall} />
          {showGold ? null : null}
          {/* Tresortür (Rad) */}
          <Circle cx={onLeft(g, 0.5, 0.5)[0]} cy={onLeft(g, 0.5, 0.5)[1]} r={9} color={dk(pal.accent, 0.35)} />
          <Circle cx={onLeft(g, 0.5, 0.5)[0]} cy={onLeft(g, 0.5, 0.5)[1]} r={6} color={lt(pal.accent, 0.1)} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + 0.4;
            const cc = onLeft(g, 0.5, 0.5);
            return <Path key={i} path={`M ${cc[0]} ${cc[1]} L ${cc[0] + Math.cos(a) * 11} ${cc[1] + Math.sin(a) * 6}`} color={dk(pal.accent, 0.4)} style="stroke" strokeWidth={2} />;
          })}
          {/* Goldmünzen oben drauf */}
          {[0, 1, 2].map((i) => <Circle key={`c${i}`} cx={cx - 8 + i * 8} cy={cy - 30 - 2} r={5} color={lt(pal.accent, 0.08)} />)}
          <Circle cx={cx} cy={cy - 30 - 7} r={5} color={pal.accent} />
        </Group>,
      );
    }
    case 'barracks': {
      if (isHuman) {
        // Menschen-Kaserne: Steinhalle + blaues Satteldach (Gold-First), Wach-Rundturm,
        // Wappen mit gekreuzten Schwertern, Wimpel.
        const g = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 26);
        const e = onLeft(g, 0.5, 0.36);
        flashG = g; topY = cy - 26 - 40 - 18;
        return wrap(
          <Group>
            {/* Wach-Rundturm hinten rechts */}
            <RoundTower x={cx + FW * 0.36} baseY={cy - 4} r={8} h={34} coneH={18} wall={wall} roof={roof} gold={humanGold!} pennant={HUMAN_ROOF} />
            <Box g={g} color={wall} />
            {/* Tor */}
            <Path path={poly([onLeft(g, 0.42, 0.52), onLeft(g, 0.58, 0.52), onLeft(g, 0.58, 1), onLeft(g, 0.42, 1)])} color="#1c2433" />
            {/* Wappenschild mit gekreuzten Schwertern */}
            <Circle cx={e[0]} cy={e[1]} r={8} color={dk(HUMAN_ROOF, 0.1)} />
            <Circle cx={e[0]} cy={e[1]} r={8} style="stroke" color={humanGold!} strokeWidth={1.3} />
            <Path path={`M ${e[0] - 6} ${e[1] + 5} L ${e[0] + 6} ${e[1] - 7}`} color="#e4e8ee" style="stroke" strokeWidth={2.2} strokeCap="round" />
            <Path path={`M ${e[0] + 6} ${e[1] + 5} L ${e[0] - 6} ${e[1] - 7}`} color="#e4e8ee" style="stroke" strokeWidth={2.2} strokeCap="round" />
            {/* blaues Satteldach + Gold-First */}
            <GableRoof g={g} height={20} color={roof} />
            <Path path={lineP([cx, g.Bt[1] - 20], [cx, g.Tt[1] - 20])} color={humanGold!} style="stroke" strokeWidth={1.6} opacity={0.85} />
            {flagAt(cx - FW * 0.2, cy - 26 - 20, HUMAN_ROOF)}
          </Group>,
        );
      }
      const g = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 28);
      flashG = g; topY = cy - 28 - 20;
      const e = onLeft(g, 0.5, 0.34); // Emblem-Zentrum
      return wrap(
        <Group>
          <Box g={g} color={wall} />
          {door(g, dk(roof, 0.2))}
          {/* gekreuzte Schwerter */}
          <Path path={`M ${e[0] - 8} ${e[1] + 7} L ${e[0] + 8} ${e[1] - 9}`} color="#d7dbe0" style="stroke" strokeWidth={2.6} strokeCap="round" />
          <Path path={`M ${e[0] + 8} ${e[1] + 7} L ${e[0] - 8} ${e[1] - 9}`} color="#d7dbe0" style="stroke" strokeWidth={2.6} strokeCap="round" />
          <Circle cx={e[0]} cy={e[1] - 1} r={2.4} color={pal.accent} />
          <GableRoof g={g} height={20} color={roof} />
          {flagAt(cx, cy - 28 - 20, pal.accent)}
        </Group>,
      );
    }
    case 'watchtower': {
      if (isHuman) {
        // Sauberer runder Wachturm im Keep-Stil (Steinschaft, blaues Kegeldach, Gold-Knauf, Wimpel).
        flashG = boxGeom(cx, cy, FW * 0.32, FH * 0.32, 56); topY = cy - 56 - 26 - 18;
        return wrap(
          <Group>
            <RoundTower x={cx} baseY={cy} r={13} h={54} coneH={26} wall={wall} roof={roof} gold={humanGold!} pennant={HUMAN_ROOF} />
          </Group>,
        );
      }
      const shaft = boxGeom(cx, cy, FW * 0.3, FH * 0.3, 56);
      const platform = boxGeom(cx, cy - 56, FW * 0.42, FH * 0.42, 12);
      flashG = boxGeom(cx, cy, FW * 0.36, FH * 0.36, 56); topY = cy - 56 - 12 - 18;
      return wrap(
        <Group>
          <Box g={shaft} color={wall} />
          {windows(shaft, 1, winLit, level >= 9, pulse)}
          {/* überstehende Aussichtsplattform */}
          <Box g={platform} color={lt(wall, 0.05)} />
          {battlements(platform, wall)}
          {/* Spitzdach */}
          <Roof g={platform} height={18} color={roof} overhang={0.1} spire={isHuman} finial={humanGold} />
        </Group>,
      );
    }
    case 'cannon': {
      if (isHuman) {
        // Kanonenturm: Steinturm mit Zinnen + Kanonenrohr auf der Plattform.
        const twr = boxGeom(cx, cy, FW * 0.4, FH * 0.4, 38);
        flashG = twr; topY = cy - 66;
        const pivot: P = [cx - 5, cy - 46];
        const ang = -0.55;
        const d: P = [Math.cos(ang), Math.sin(ang)];
        const pp: P = [-Math.sin(ang), Math.cos(ang)];
        const Lb = 30, tk = 6;
        const muz: P = [pivot[0] + d[0] * Lb, pivot[1] + d[1] * Lb];
        const q = (c: P, t: number): P => [c[0] + pp[0] * t, c[1] + pp[1] * t];
        const barrelH = poly([q(pivot, tk), q(pivot, -tk), q(muz, -tk * 0.8), q(muz, tk * 0.8)]);
        return wrap(
          <Group>
            <Box g={twr} color={wall} />
            {windows(twr, 1, true, false, pulse)}
            {battlements(twr, wall)}
            {/* Lafette + Kanonenrohr */}
            <RoundedRect x={cx - 12} y={cy - 44} width={24} height={8} r={2} color="#5a4124" />
            <Path path={barrelH}>
              <LinearGradient start={vec(q(pivot, tk)[0], q(pivot, tk)[1])} end={vec(q(pivot, -tk)[0], q(pivot, -tk)[1])} colors={['#13131a', '#8a8a96', '#3a3a44', '#0e0e14']} />
            </Path>
            <Path path={barrelH} style="stroke" color="#0a0a0e" strokeWidth={1.4} opacity={0.9} />
            <Circle cx={pivot[0]} cy={pivot[1]} r={tk + 1} color="#26262e" />
            <Group transform={[{ rotate: ang + Math.PI / 2 }]} origin={vec(muz[0], muz[1])}>
              <Group transform={[{ scaleX: 0.5 }]} origin={vec(muz[0], muz[1])}>
                <Circle cx={muz[0]} cy={muz[1]} r={tk * 0.8} color="#070709" />
              </Group>
            </Group>
          </Group>,
        );
      }
      const base = boxGeom(cx, cy, FW * 0.46, FH * 0.46, 10);
      flashG = boxGeom(cx, cy, FW * 0.46, FH * 0.46, 38); topY = cy - 44;
      // Lauf-Geometrie (zielt hoch-rechts).
      const pivot: P = [cx - 6, cy - 18];
      const ang = -0.5;
      const d: P = [Math.cos(ang), Math.sin(ang)];
      const pp: P = [-Math.sin(ang), Math.cos(ang)];
      const Lb = 44, tkB = 8, tkM = 6;
      const muz: P = [pivot[0] + d[0] * Lb, pivot[1] + d[1] * Lb];
      const q = (c: P, t: number, off = 0): P => [c[0] + pp[0] * t + d[0] * off, c[1] + pp[1] * t + d[1] * off];
      const barrel = poly([q(pivot, tkB), q(pivot, -tkB), q(muz, -tkM), q(muz, tkM)]);
      const ringAt = (frac: number, tk: number) => {
        const c: P = [pivot[0] + d[0] * Lb * frac, pivot[1] + d[1] * Lb * frac];
        return poly([q(c, tk, -2.5), q(c, -tk, -2.5), q(c, -tk, 2.5), q(c, tk, 2.5)]);
      };
      const Wheel = ({ wx, wy, r }: { wx: number; wy: number; r: number }) => (
        <Group>
          <Group transform={[{ scaleY: 0.92 }]} origin={vec(wx, wy)}>
            <Circle cx={wx} cy={wy} r={r} color="#43301c" />
            <Circle cx={wx} cy={wy} r={r} style="stroke" color="#1c1208" strokeWidth={2.2} />
            {[0, 1, 2, 3].map((i) => {
              const a2 = i * (Math.PI / 4) + 0.3;
              return <Path key={i} path={`M ${wx} ${wy} L ${wx + Math.cos(a2) * (r - 1)} ${wy + Math.sin(a2) * (r - 1)}`} color="#2a1c0e" style="stroke" strokeWidth={1.6} />;
            })}
            <Circle cx={wx} cy={wy} r={r * 0.32} color="#5a4124" />
            <Circle cx={wx} cy={wy} r={r * 0.32} style="stroke" color="#1c1208" strokeWidth={1.2} />
          </Group>
        </Group>
      );
      return wrap(
        <Group>
          {/* Stein-/Holzsockel */}
          <Box g={base} color={wall} />
          {/* hinteres Rad */}
          <Wheel wx={cx - 16} wy={cy + 1} r={9} />
          {/* Lafetten-Wange (Holz) */}
          <Path path={poly([[cx - 20, cy - 2], [cx + 16, cy - 12], [cx + 8, cy - 22], [cx - 24, cy - 11]])} color="#6e4a28" />
          <Path path={poly([[cx - 20, cy - 2], [cx + 16, cy - 12], [cx + 8, cy - 22], [cx - 24, cy - 11]])} style="stroke" color="#3a2614" strokeWidth={1.6} opacity={0.8} />
          {/* Lauf mit metallischem Querverlauf */}
          <Path path={barrel}>
            <LinearGradient start={vec(q(pivot, tkB)[0], q(pivot, tkB)[1])} end={vec(q(pivot, -tkB)[0], q(pivot, -tkB)[1])} colors={['#13131a', '#8a8a96', '#3a3a44', '#0e0e14']} />
          </Path>
          <Path path={barrel} style="stroke" color="#0a0a0e" strokeWidth={1.6} opacity={0.9} />
          {/* Verstärkungsbänder */}
          <Path path={ringAt(0.32, tkB + 0.5)} color="#0c0c12" />
          <Path path={ringAt(0.62, tkM + 1.2)} color="#0c0c12" />
          {/* Glanzlinie */}
          <Path path={lineP(q(pivot, tkB * 0.35), q(muz, tkM * 0.35))} color="#b9b9c4" style="stroke" strokeWidth={1.4} opacity={0.7} />
          {/* Mündung (Bohrung) */}
          <Group transform={[{ rotate: ang + Math.PI / 2 }]} origin={vec(muz[0], muz[1])}>
            <Group transform={[{ scaleX: 0.5 }]} origin={vec(muz[0], muz[1])}>
              <Circle cx={muz[0]} cy={muz[1]} r={tkM + 1} color="#2a2a32" />
              <Circle cx={muz[0]} cy={muz[1]} r={tkM - 1.5} color="#070709" />
            </Group>
          </Group>
          {/* Bodenstück + Cascabel */}
          <Circle cx={pivot[0]} cy={pivot[1]} r={tkB} color="#26262e" />
          <Circle cx={pivot[0] - d[0] * 5} cy={pivot[1] - d[1] * 5} r={2.6} color="#3a3a44" />
          {/* vorderes Rad */}
          <Wheel wx={cx + 12} wy={cy + 4} r={10} />
          {/* Kanonenkugel-Pyramide */}
          {([[cx - 30, cy + 7], [cx - 22, cy + 9], [cx - 26, cy + 2]] as P[]).map((p, i) => (
            <Group key={i}>
              <Circle cx={p[0]} cy={p[1]} r={4.6} color="#23232b" />
              <Circle cx={p[0] - 1.4} cy={p[1] - 1.4} r={1.5} color="#5e5e6a" />
            </Group>
          ))}
        </Group>,
      );
    }
    case 'wall': {
      const g = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 26);
      flashG = g; topY = cy - 38;
      const seam = dk(wall, 0.3);
      // Merlon (Zinne) als kleiner 3D-Block auf der Mauerkrone.
      const merlon = (f: number, edge: 'l' | 'r') => {
        const a = edge === 'l' ? g.Lt : g.Bt;
        const b = edge === 'l' ? g.Bt : g.Rt;
        const p: P = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        return <Box g={boxGeom(p[0], p[1], 9, 4.5, 12)} color={lt(wall, 0.06)} />;
      };
      return wrap(
        <Group>
          <Box g={g} color={wall} />
          {/* horizontale Stein-Lagen */}
          {[0.36, 0.7].map((t, i) => (
            <React.Fragment key={`h${i}`}>
              <Path path={lineP(onLeft(g, 0, t), onLeft(g, 1, t))} color={seam} style="stroke" strokeWidth={1.2} opacity={0.65} />
              <Path path={lineP(onRight(g, 0, t), onRight(g, 1, t))} color={dk(wall, 0.4)} style="stroke" strokeWidth={1.2} opacity={0.6} />
            </React.Fragment>
          ))}
          {/* versetzte vertikale Fugen (Mauerwerk-Verband) */}
          {[0.28, 0.62].map((s, i) => <Path key={`va${i}`} path={lineP(onLeft(g, s, 0.04), onLeft(g, s, 0.36))} color={seam} style="stroke" strokeWidth={1.1} opacity={0.5} />)}
          {[0.45, 0.8].map((s, i) => <Path key={`vb${i}`} path={lineP(onLeft(g, s, 0.36), onLeft(g, s, 0.7))} color={seam} style="stroke" strokeWidth={1.1} opacity={0.5} />)}
          {[0.3, 0.66].map((s, i) => <Path key={`vc${i}`} path={lineP(onRight(g, s, 0.36), onRight(g, s, 0.7))} color={dk(wall, 0.4)} style="stroke" strokeWidth={1.1} opacity={0.45} />)}
          {/* eingesenkter Wehrgang (dunkles Oberfeld) */}
          <Path path={poly([
            [g.Tt[0], g.Tt[1] + 3], [g.Rt[0] - 5, g.Rt[1] + 2], [g.Bt[0], g.Bt[1] - 3], [g.Lt[0] + 5, g.Lt[1] + 2],
          ])} color={dk(wall, 0.22)} opacity={0.5} />
          {/* 3D-Zinnen mit Lücken entlang der Frontkante */}
          {[0.2, 0.5, 0.8].map((f, i) => <Group key={`ml${i}`}>{merlon(f, 'l')}</Group>)}
          {[0.5, 0.8].map((f, i) => <Group key={`mr${i}`}>{merlon(f, 'r')}</Group>)}
        </Group>,
      );
    }
    default: {
      // Fraktionsexklusiv/unbekannt: schmuckes „magisches" Gebäude mit Kristall.
      const g = boxGeom(cx, cy, FW * 0.5, FH * 0.5, 30);
      flashG = g; topY = cy - 30 - 24;
      body = (
        <Group>
          <Box g={g} color={wall} />
          {door(g, dk(roof, 0.2))}
          {windows(g, winCount, winLit, true, pulse)}
          <Roof g={g} height={24} color={roof} overhang={0.16} spire={isHuman} finial={humanGold} />
          {/* schwebender Kristall */}
          <Path path={poly([[cx, cy - 30 - 30], [cx + 6, cy - 30 - 20], [cx, cy - 30 - 10], [cx - 6, cy - 30 - 20]])} color={lt(pal.accent, 0.1)} opacity={0.9} />
        </Group>
      );
      break;
    }
  }

  // Hilfsfunktion: umschließt den (früh zurückgegebenen) Body mit dem Rahmen.
  function wrap(inner: React.ReactElement): React.ReactElement {
    body = inner;
    return frame();
  }

  function frame(): React.ReactElement {
    return (
      <Group transform={[{ scale }]} origin={vec(cx, cy + FH / 2)}>
        {/* Weicher Kontakt-Schatten (Radial) */}
        <Group transform={[{ scaleY: 0.32 }]} origin={vec(cx, cy + 3)}>
          <Circle cx={cx} cy={cy + 3} r={FW * 0.6}>
            <RadialGradient c={vec(cx, cy + 3)} r={FW * 0.6} colors={['#00000059', '#0000002e', '#00000000']} />
          </Circle>
        </Group>
        {/* MENSCHEN-Grassockel (Gebäude steht auf eigener Grasplattform, wie im Bild) */}
        {isHuman && (() => {
          const phw = FW * 0.74, phh = FH * 0.68;
          const dia = (e: number, dy: number): string =>
            poly([[cx, cy - phh * e + dy], [cx + phw * e, cy + dy], [cx, cy + phh * e + dy], [cx - phw * e, cy + dy]]);
          return (
            <Group>
              {/* Erdrand (Tiefe) — klar abgesetzt, damit das Gebäude auf einer Plattform steht */}
              <Path path={dia(1.1, 11)} color="#2a1c0d" opacity={0.9} />
              <Path path={dia(1.06, 7)} color="#6b4f2e" />
              <Path path={dia(1.02, 3)} color="#7a5c36" />
              {/* gepflegte Grasdecke — heller/saturierter als das wilde Terrain */}
              <Path path={dia(1.0, 0)}>
                <LinearGradient start={vec(cx, cy - phh)} end={vec(cx, cy + phh)} colors={['#82cc66', '#56a247']} />
              </Path>
              <Path path={dia(1.0, 0)} style="stroke" color="#9bd97e" strokeWidth={1.5} opacity={0.7} />
            </Group>
          );
        })()}
        {/* Aura */}
        {showAura && (
          <Circle cx={cx} cy={(cy + topY) / 2} r={FW * (0.6 + 0.08 * pulse)}>
            <RadialGradient c={vec(cx, (cy + topY) / 2)} r={FW * (0.6 + 0.08 * pulse)} colors={[`rgba(255,68,255,${0.3 + 0.16 * pulse})`, 'rgba(119,0,187,0)']} />
          </Circle>
        )}
        {showMagic && !showAura && (
          <Circle cx={cx} cy={(cy + topY) / 2} r={FW * 0.5}>
            <RadialGradient c={vec(cx, (cy + topY) / 2)} r={FW * 0.5} colors={[`rgba(170,68,255,${0.22 + 0.13 * pulse})`, 'rgba(170,68,255,0)']} />
          </Circle>
        )}

        {body}

        {/* Schornstein-Rauch (animiert) */}
        {hasSmoke && (
          <Group>
            <RoundedRect x={cx - 15} y={topY + 8} width={7} height={11} r={1.5} color={dk(roof, 0.25)} />
            <RoundedRect x={cx - 15} y={topY + 8} width={7} height={3} r={1.5} color={dk(roof, 0.45)} />
            {[0, 1, 2, 3].map((i) => {
              const ph = ((clock / 950 + i * 0.27) % 1 + 1) % 1;
              const yy = topY + 6 - ph * 26;
              const rr = 2 + ph * 5;
              return (
                <Circle key={i} cx={cx - 11.5 + Math.sin(clock / 520 + i * 1.6) * 5 * ph} cy={yy} r={rr} color="#dcdcdc" opacity={(1 - ph) * 0.32} />
              );
            })}
          </Group>
        )}

        {/* Gold-Zierband am Sockel ab Lvl 5 */}
        {showGold && (
          <>
            <Path path={lineP(flashG.Lt, flashG.Bt)} color={MATERIAL_COLORS.gold_accent} style="stroke" strokeWidth={2.5} opacity={0.9} />
            <Path path={lineP(flashG.Bt, flashG.Rt)} color={lt(MATERIAL_COLORS.gold_accent, 0.1)} style="stroke" strokeWidth={2.5} opacity={0.9} />
          </>
        )}

        {/* Magie-Funken ab Lvl 7 */}
        {showMagic && [0, 1, 2, 3].map((i) => (
          <Circle key={i} cx={cx - 16 + i * 11 + Math.cos(clock / 700 + i) * 4} cy={topY - 4 - (i % 2) * 9 - Math.sin(clock / 500 + i) * 4}
            r={1.8 + (i % 2) * 0.8} color={i % 2 ? '#dcc4ff' : MATERIAL_COLORS.magic_cyan} opacity={0.5 + 0.4 * pulse} />
        ))}

        {/* Hit-Flash über die Bounding-Box */}
        {flash > 0 && (
          <>
            <Path path={poly([flashG.L, flashG.B, flashG.Bt, flashG.Lt])} color="#ffffff" opacity={Math.min(1, flash)} />
            <Path path={poly([flashG.B, flashG.R, flashG.Rt, flashG.Bt])} color="#ffffff" opacity={Math.min(1, flash)} />
            <Path path={poly([flashG.Tt, flashG.Rt, flashG.Bt, flashG.Lt])} color="#ffffff" opacity={Math.min(1, flash)} />
          </>
        )}

        {/* Auswahl-Ring */}
        {selected && (
          <Group transform={[{ scaleY: 0.5 }]} origin={vec(cx, cy)}>
            <Circle cx={cx} cy={cy} r={FW * 0.6} color="#ffffff" style="stroke" strokeWidth={3} opacity={0.9} />
          </Group>
        )}

        {/* Upgrade-Indikator */}
        {isUpgrading && (
          <>
            <Circle cx={cx} cy={topY - 16} r={9} color="#7cdc5a" opacity={0.25 + 0.2 * pulse} />
            <Circle cx={cx} cy={topY - 16} r={5} color="#7cdc5a" />
          </>
        )}
      </Group>
    );
  }

  return frame();
}

/**
 * React.memo — RENDER-PERFORMANCE (Battle/Village zeichnen jeden Frame neu via
 * force()/clock). Ohne Memo würde JEDES der ~80 Gebäude jeden Frame komplett neu
 * aufgebaut. Der Vergleich überspringt Gebäude mit unveränderten Props; Voraus-
 * setzung sind referenzstabile `image`/`imageAnchor` (siehe useHumanBuildingSprites,
 * useMemo). Im KAMPF wird `clock` NICHT durchgereicht → statische Gebäude bleiben
 * stehen, nur getroffene/einstürzende animieren (flash/extraScale). Im DORF ändert
 * sich `clock` je Frame bewusst weiter → die Idle-Atmung bleibt unverändert.
 */
export const BuildingSprite = React.memo(BuildingSpriteImpl);
