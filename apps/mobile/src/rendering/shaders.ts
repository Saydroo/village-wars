import { Skia } from '@shopify/react-native-skia';
import type { SkRuntimeEffect } from '@shopify/react-native-skia';

/**
 * GPU-Shader (SkSL, Phase-6-Politur „grenzenlos"). Echte prozedurale Texturen +
 * Beleuchtung statt flacher Vektor-Füllungen:
 *  - BACKDROP: animierter atmosphärischer Hintergrund (Bildschirmraum) — driftende
 *    Nebel/Aurora + Lichtblob + Vignette, lebt über die Zeit.
 *  - GROUND: prozeduraler Boden (Welt-Koordinaten → pant stabil mit) — Gras bzw.
 *    Schlachtfeld-Erde per fBm-Noise, mit Wind-Schimmer und Halmspitzen-Glanz.
 *
 * Kompilierung ist null-sicher: schlägt `Make` fehl (alte GPU/Treiber), liefert
 * der Helfer `null` und die Aufrufer fallen auf die bisherigen Verläufe zurück.
 */

const NOISE_LIB = `
float hash21(float2 p){
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(float2 p){
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + float2(1.0, 0.0));
  float c = hash21(i + float2(0.0, 1.0));
  float d = hash21(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(float2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * vnoise(p);
    p = p * 2.02 + float2(7.1, 3.3);
    a *= 0.5;
  }
  return v;
}
`;

const BACKDROP_SRC = `
uniform float2 u_res;
uniform float u_time;
${NOISE_LIB}
half4 main(float2 fc){
  float2 uv = fc / u_res;
  // Grund-Verlauf (tiefes Türkis oben → fast schwarz unten)
  float3 top = float3(0.09, 0.20, 0.19);
  float3 bot = float3(0.02, 0.05, 0.05);
  float3 col = mix(top, bot, clamp(uv.y, 0.0, 1.0));
  // driftende Nebelbänder
  float n = fbm(uv * float2(3.0, 2.2) + float2(u_time * 0.025, u_time * 0.01));
  float bands = smoothstep(0.42, 0.78, n);
  col += float3(0.04, 0.16, 0.11) * bands;
  // weicher wandernder Lichtblob
  float2 lc = float2(0.5 + 0.20 * sin(u_time * 0.05), 0.40 + 0.10 * cos(u_time * 0.04));
  float d = distance(uv, lc);
  col += float3(0.10, 0.14, 0.09) * smoothstep(0.55, 0.0, d);
  // ferne Funken/Sterne
  float s = fbm(uv * 22.0 + 3.0);
  col += float3(0.6, 0.8, 0.7) * smoothstep(0.93, 0.99, s) * (0.4 + 0.6 * sin(u_time + uv.x * 30.0));
  // Vignette
  float vig = smoothstep(1.15, 0.25, distance(uv, float2(0.5, 0.45)));
  col *= mix(0.5, 1.0, vig);
  return half4(col, 1.0);
}
`;

const GROUND_SRC = `
uniform float u_time;
uniform float u_grass;   // 1 = Gras, 0 = Schlachtfeld
${NOISE_LIB}
half4 main(float2 p){
  // p = Welt-Koordinaten (stabil beim Pannen)
  float2 uv = p * 0.055;
  float wind = sin(u_time * 0.6 + p.x * 0.02) * 0.06;
  float n = fbm(uv + float2(0.0, wind));
  float blades = fbm(uv * 4.3 + float2(wind, 0.0));
  float3 grassA = float3(0.33, 0.58, 0.24);
  float3 grassB = float3(0.15, 0.35, 0.13);
  float3 dirtA  = float3(0.46, 0.28, 0.21);
  float3 dirtB  = float3(0.27, 0.15, 0.12);
  float3 hi = mix(dirtA, grassA, u_grass);
  float3 lo = mix(dirtB, grassB, u_grass);
  float3 col = mix(lo, hi, clamp(n * 1.15, 0.0, 1.0));
  // hellere Halmspitzen
  col = mix(col, col * 1.18, smoothstep(0.55, 0.82, blades));
  // feine dunkle Sprenkel (Erdklümpchen)
  float spec = vnoise(p * 0.9);
  col *= 0.9 + 0.2 * n;
  col = mix(col, col * 0.82, smoothstep(0.85, 0.95, spec));
  return half4(col, 1.0);
}
`;

/**
 * MATERIAL-Shader für Gebäudeflächen: prozeduraler Stein-Quaderverband / Holz-
 * planken / Putz / Metall — flächengenau über eine Welt-UV-Projektion (u_o +
 * u_ux/u_vy = Ursprung + Flächen-Achsen), damit Steinlagen waagerecht und Planken
 * der Wand folgen und beim Pannen stabil bleiben. `u_shade` = Richtungslicht.
 */
const MATERIAL_SRC = `
uniform float2 u_o;     // Flächen-Ursprung (Welt)
uniform float2 u_ux;    // horizontale Flächen-Achse
uniform float2 u_vy;    // vertikale Flächen-Achse (nach unten)
uniform float3 u_col;   // Basisfarbe
uniform float u_mat;    // 0 Stein, 1 Holz, 2 Putz, 3 Metall
uniform float u_shade;  // Richtungs-Helligkeit
uniform float u_time;
${NOISE_LIB}
half4 main(float2 p){
  float2 rel = p - u_o;
  float ulen = max(length(u_ux), 0.001);
  float vlen = max(length(u_vy), 0.001);
  float uu = dot(rel, u_ux) / ulen;   // Welt-Pixel entlang der Fläche (quer)
  float vv = dot(rel, u_vy) / vlen;   // Welt-Pixel entlang der Fläche (runter)
  float3 col = u_col;
  if (u_mat < 0.5) {
    // STEIN — Quaderverband mit Fugen + Tönung je Stein
    float course = 11.0;
    float row = floor(vv / course);
    float offs = mod(row, 2.0) * 0.5;
    float bw = 17.0;
    float bx = uu / bw + offs;
    float fx = fract(bx);
    float fy = fract(vv / course);
    float joint = smoothstep(0.0, 0.07, fx) * smoothstep(1.0, 0.93, fx) * smoothstep(0.0, 0.12, fy) * smoothstep(1.0, 0.86, fy);
    float tone = vnoise(float2(floor(bx), row) + 0.5);
    col *= 0.8 + 0.32 * tone;
    col = mix(col * 0.5, col, joint);
  } else if (u_mat < 1.5) {
    // HOLZ — senkrechte Planken + Maserung
    float pw = 9.5;
    float plank = floor(uu / pw);
    float fx = fract(uu / pw);
    float gap = smoothstep(0.0, 0.09, fx) * smoothstep(1.0, 0.91, fx);
    float grain = fbm(float2(uu * 0.1, vv * 0.45) + plank * 5.0);
    col *= 0.82 + 0.34 * grain;
    col = mix(col * 0.58, col, gap);
  } else if (u_mat < 2.5) {
    // PUTZ — glatt mit feinen Flecken
    float n = fbm(float2(uu, vv) * 0.09);
    col *= 0.9 + 0.18 * n;
  } else {
    // METALL/GOLD — glatt mit Glanzstreifen
    float n = vnoise(float2(uu, vv) * 0.3);
    float g = fract(uu * 0.018 - u_time * 0.06);
    float glint = smoothstep(0.46, 0.5, g) * smoothstep(0.54, 0.5, g);
    col *= 0.9 + 0.12 * n;
    col += u_col * glint * 0.6;
  }
  // Ambiente-Verdunkelung zum Fuß + Richtungslicht
  col *= 1.06 - 0.16 * clamp(vv / vlen, 0.0, 1.0);
  col *= u_shade;
  return half4(col, 1.0);
}
`;

function compile(src: string): SkRuntimeEffect | null {
  try {
    return Skia.RuntimeEffect.Make(src) ?? null;
  } catch {
    return null;
  }
}

export const backdropEffect: SkRuntimeEffect | null = compile(BACKDROP_SRC);
export const groundEffect: SkRuntimeEffect | null = compile(GROUND_SRC);
export const materialEffect: SkRuntimeEffect | null = compile(MATERIAL_SRC);

/** Material-IDs für den MATERIAL-Shader. */
export const MAT = { stone: 0, wood: 1, plaster: 2, metal: 3 } as const;
