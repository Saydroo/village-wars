/**
 * Effekt-Schicht (Phase 6 — Game Juice). Reine, wiederverwendbare Bausteine für
 * Partikel, aufsteigende Zahlen, Screenshake, Squash & Stretch (Easing) und
 * Sound-Cues. Alle Effekte sind kosmetisch und beeinflussen KEINE Balance.
 * Zahlenwerte stammen aus game-config.json (`effects`).
 */
export { EASING, lerp, clamp01 } from './easing';
export { ParticleSystem, buildPreset } from './particles';
export type { Particle, ParticleType } from './particles';
export { FloatingTextSystem } from './floatingText';
export type { FloatingText, FloatingKind } from './floatingText';
export { ScreenShake } from './shake';
export type { ShakeEvent } from './shake';
export { playCue, setSoundEnabled, isSoundEnabled, setSoundPlayer } from './sound';
export type { SoundCue, SoundPlayer } from './sound';
export { useAnimationFrame } from './useAnimationFrame';
export { ParticleField } from './ParticleField';
export { FloatingTextLayer } from './FloatingTextLayer';
