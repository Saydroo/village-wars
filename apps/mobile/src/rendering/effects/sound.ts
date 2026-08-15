/**
 * Sound-Cue-Abstraktion (Game-Juice-Spec, Abschnitt 8). Jeder größere visuelle
 * Effekt ruft hier einen kurzen Cue ab (Upgrade-Ding, Treffer-Thud,
 * Münz-Klimpern, Sieg-Fanfare …).
 *
 * BEWUSSTE ZURÜCKSTELLUNG: Das tatsächliche Abspielen braucht `expo-av` — ein
 * NATIVES Modul, dessen Hinzufügen einen Gradle-Rebuild erzwingt (STATUS §8
 * dokumentiert, wie aufwändig der native Build hier ist). Die Cue-Aufrufe sind
 * an allen richtigen Stellen verdrahtet, das Abspielen ist hinter `loadPlayer`
 * gekapselt und standardmäßig eine No-Op — exakt das Muster von IAP-Sandbox /
 * OAuth (strukturell fertig, externe Abhängigkeit später nachrüstbar). Zum
 * Aktivieren: expo-av installieren + `setSoundPlayer(expoAvPlayer)` einhängen.
 */
export type SoundCue =
  | 'button'
  | 'upgrade'
  | 'hit'
  | 'coin'
  | 'deploy'
  | 'destroy'
  | 'victory'
  | 'defeat'
  | 'boss'
  | 'reward'
  | 'star';

export type SoundPlayer = (cue: SoundCue) => void;

let soundEnabled = true;
let player: SoundPlayer | null = null;

/** Hängt eine echte Abspiel-Implementierung ein (z. B. expo-av). */
export function setSoundPlayer(p: SoundPlayer | null): void {
  player = p;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/** Spielt einen Cue (No-Op, solange kein Player eingehängt ist). */
export function playCue(cue: SoundCue): void {
  if (!soundEnabled || !player) return;
  player(cue);
}
