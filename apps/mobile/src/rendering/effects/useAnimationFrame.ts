import { useEffect, useRef } from 'react';

/**
 * Treibt einen requestAnimationFrame-Loop, solange `active` true ist
 * (konsistent mit DungeonBattleView/DungeonPortal — kein reanimated nötig).
 * `onFrame` bekommt die aktuelle Zeit (ms) und das Delta zum letzten Frame.
 * Optional auf `fps` gedrosselt, um die Render-Last zu begrenzen (z. B. 30 FPS
 * für die Idle-Atmung im Dorf, 60 FPS für Kampf-Partikel).
 *
 * Ein einziger Loop steuert pro Canvas alle Animationen (Partikel, Floating
 * Text, Shake, Idle) — der Aufrufer ruft darin die einzelnen `step()` auf und
 * erzwingt ein Re-Render.
 */
export function useAnimationFrame(
  onFrame: (now: number, dtMs: number) => void,
  active: boolean,
  fps = 60,
): void {
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  const minInterval = fps > 0 ? 1000 / fps : 0;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = Date.now();
    let acc = 0;
    const tick = () => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc >= minInterval) {
        cbRef.current(now, acc);
        acc = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, minInterval]);
}
