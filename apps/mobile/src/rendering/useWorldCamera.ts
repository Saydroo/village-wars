import { useEffect, useMemo, useReducer, useRef } from 'react';
import { PanResponder, Platform, type GestureResponderEvent } from 'react-native';
import { ZOOM_DEFAULT, clampZoom, zoomAround } from '@village-wars/shared';

/**
 * GEMEINSAMER KAMERA-ZUSTAND für VillageCanvas UND BattleCanvas — Pan + Zoom in
 * EINEM Modul, damit beide Canvases denselben Zustand und dieselbe Zoom-Mathe
 * benutzen (nur die Eingabe unterscheidet sich: Web = Mausrad, Mobil = Pinch).
 *
 * Weltmodell (identisch zum Harness, Quelle: worldScale.ts):
 *   screen = (base + pan) + zoom * world      → Group-Transform [translate, scale]
 *   world  = (screen - (base + pan)) / zoom    → Tap-Rückprojektion
 *
 * `base` zentriert das Grid (ändert sich nur bei Größenwechsel), `pan` ist die
 * Verschiebung, `zoom` skaliert die Kamera-Group ÜBER dem Pan. Die Sprites
 * werden dadurch nur skaliert — nichts lädt beim Zoomen nach.
 */

export interface CameraTransform {
  /** Verschiebung der Kamera-Group in Bildschirm-Pixeln (base + pan). */
  tx: number;
  ty: number;
  /** Skalierung der Kamera-Group (0.5 … 1.5). */
  zoom: number;
}

export interface WorldCamera {
  /** Aktueller Transform für den `<Group transform={[translate, scale]}>`. */
  transform: CameraTransform;
  /** PanResponder-Handler für die umschließende View (Pan + Pinch). */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  /** Ref auf die Container-View — nötig, um auf Web das Mausrad zu binden. */
  containerRef: React.MutableRefObject<unknown>;
  /** Bildschirm→Welt (für Tap-Erkennung), berücksichtigt Pan UND Zoom. */
  toWorld: (lx: number, ly: number) => { x: number; y: number };
  /** Screen-Offset eines Weltpunkts (für Overlays wie aufsteigende Zahlen). */
  worldToScreen: (wx: number, wy: number) => { x: number; y: number };
}

interface Options {
  /** Grid-Zentrierung (aus useMemo im Canvas), Pan wird additiv daraufgelegt. */
  base: { x: number; y: number };
  /** Tap auf lokale Koordinaten (nach Pan/Zoom-Rückprojektion im Canvas). */
  onTap: (lx: number, ly: number) => void;
  /** Sensitivität des Mausrads (Anteil Zoomänderung je „Klick"). */
  wheelStep?: number;
  /** Viewport-Größe (für Pan-Clamping). */
  viewport?: { width: number; height: number };
  /** Welt-Bounding-Box des Grids (für Pan-Clamping) — kein Scrollen ins Leere. */
  world?: { minX: number; maxX: number; minY: number; maxY: number };
  /**
   * „Contain"-Klemmung: die Welt-Box (inkl. Sprite-Überhängen) füllt den
   * Viewport, es bleibt höchstens `containMargin` Pixel Rand — kein Scrollen
   * ins Leere, kein am Bildrand angeschnittenes Gebäude. Ohne diesen Wert gilt
   * die lockere EDGE_SLACK-Klemmung (z.B. Battle-Canvas).
   */
  containMargin?: number;
}

const TAP_SLOP = 8;
/** Erlaubter Leerraum-Anteil hinter dem Dorfrand beim Pannen. */
const EDGE_SLACK = 0.30;

export function useWorldCamera({ base, onTap, wheelStep = 0.0016, viewport, world, containMargin }: Options): WorldCamera {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // Pan (Deviation von base) + Zoom — als Ref, damit Gesten ohne Re-Render laufen.
  const cam = useRef({ panX: 0, panY: 0, zoom: ZOOM_DEFAULT });
  const baseRef = useRef(base);
  baseRef.current = base;
  const boundsRef = useRef({ viewport, world, containMargin });
  boundsRef.current = { viewport, world, containMargin };
  const containerRef = useRef<unknown>(null);

  /**
   * Pan so begrenzen, dass der Dorfrand nicht weiter als EDGE_SLACK über den
   * Bildschirmrand hinaus scrollt (kein Scrollen ins Leere). Screen = t + zoom*w
   * mit t = base + pan; wir klemmen pan gegen die Grid-Bounding-Box.
   */
  const clampPan = (panX: number, panY: number, zoom: number): { panX: number; panY: number } => {
    const { viewport: vp, world: w, containMargin: cm } = boundsRef.current;
    if (!vp || !w) return { panX, panY };
    const b = baseRef.current;
    const clampAxis = (pan: number, vpSize: number, wMin: number, wMax: number, baseA: number): number => {
      let lo: number;
      let hi: number;
      if (cm != null) {
        // „Contain": die Welt-Box (Sprite-Überhänge inbegriffen) füllt den
        // Viewport bis auf `cm` Pixel Rand. Der untere/rechte Box-Rand (wMax)
        // darf nicht über vpSize-cm steigen, der obere/linke (wMin) nicht unter
        // cm sinken → hohe Gebäude (town_hall) bleiben komplett im Bild, ohne
        // dass man dahinter ins Leere scrollen kann.
        lo = vpSize - cm - zoom * wMax - baseA; // pan >= lo
        hi = cm - zoom * wMin - baseA; // pan <= hi
      } else {
        const slack = vpSize * EDGE_SLACK;
        // rechter/unterer Rand (wMax) darf nicht links/oben von `slack` landen,
        // linker/oberer Rand (wMin) nicht rechts/unten von vpSize-slack.
        lo = slack - zoom * wMax - baseA; // pan >= lo
        hi = vpSize - slack - zoom * wMin - baseA; // pan <= hi
      }
      if (lo > hi) { const m = (lo + hi) / 2; lo = m; hi = m; } // Box kleiner als Viewport → zentrieren
      return Math.min(hi, Math.max(lo, pan));
    };
    return {
      panX: clampAxis(panX, vp.width, w.minX, w.maxX, b.x),
      panY: clampAxis(panY, vp.height, w.minY, w.maxY, b.y),
    };
  };

  // Pan-Anker: gestureState.dx/dy ist kumulativ ab Grant; wir merken den Stand
  // bei (Neu-)Beginn einer reinen Verschiebung, damit ein Pinch dazwischen
  // keinen Sprung erzeugt.
  const panAnchor = useRef({ panX: 0, panY: 0, gdx: 0, gdy: 0 });
  const pinch = useRef({ active: false, startDist: 0, startZoom: 1 });
  const moved = useRef(0);

  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  // --- Zoom um einen Bildschirm-Fixpunkt (Maus bzw. Fingermitte) ---
  const applyZoom = (targetZoom: number, focus: { x: number; y: number }) => {
    const b = baseRef.current;
    const cur = cam.current;
    const t = { x: b.x + cur.panX, y: b.y + cur.panY };
    const res = zoomAround(t, cur.zoom, clampZoom(targetZoom), focus);
    const clamped = clampPan(res.cam.x - b.x, res.cam.y - b.y, res.zoom);
    cam.current = { panX: clamped.panX, panY: clamped.panY, zoom: res.zoom };
    bump();
  };

  // --- Web: Mausrad, zentriert auf die Mausposition ---
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as { addEventListener?: Function; removeEventListener?: Function } | null;
    if (!node || !node.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const focus = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // Exponentiell: gleiche Rad-Bewegung zoomt gefühlt gleichmäßig.
      const factor = Math.exp(-e.deltaY * wheelStep);
      applyZoom(cam.current.zoom * factor, focus);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener?.('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelStep]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const c = cam.current;
          panAnchor.current = { panX: c.panX, panY: c.panY, gdx: 0, gdy: 0 };
          pinch.current.active = false;
          moved.current = 0;
        },
        onPanResponderMove: (evt: GestureResponderEvent, g) => {
          const touches = evt.nativeEvent.touches ?? [];
          // --- Mobil: Zwei-Finger-Pinch, zentriert auf die Fingermitte ---
          if (touches.length >= 2) {
            const a = touches[0]!, b = touches[1]!;
            const dist = Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY);
            const mid = { x: (a.locationX + b.locationX) / 2, y: (a.locationY + b.locationY) / 2 };
            if (!pinch.current.active) {
              pinch.current = { active: true, startDist: dist || 1, startZoom: cam.current.zoom };
            } else {
              applyZoom(pinch.current.startZoom * (dist / pinch.current.startDist), mid);
            }
            moved.current = TAP_SLOP + 1; // kein Tap nach Pinch
            return;
          }
          // --- Reine Verschiebung (ein Finger / Maus-Drag) ---
          if (pinch.current.active) {
            // Pinch beendet → Pan-Anker neu setzen, sonst springt es.
            pinch.current.active = false;
            const c = cam.current;
            panAnchor.current = { panX: c.panX, panY: c.panY, gdx: g.dx, gdy: g.dy };
          }
          moved.current = Math.max(moved.current, Math.abs(g.dx) + Math.abs(g.dy));
          const an = panAnchor.current;
          const clamped = clampPan(an.panX + (g.dx - an.gdx), an.panY + (g.dy - an.gdy), cam.current.zoom);
          cam.current.panX = clamped.panX;
          cam.current.panY = clamped.panY;
          bump();
        },
        onPanResponderRelease: (e: GestureResponderEvent) => {
          if (moved.current < TAP_SLOP && !pinch.current.active) {
            onTapRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY);
          }
          pinch.current.active = false;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const c = cam.current;
  const tx = base.x + c.panX;
  const ty = base.y + c.panY;
  const zoom = c.zoom;

  return {
    transform: { tx, ty, zoom },
    panHandlers: pan.panHandlers,
    containerRef,
    toWorld: (lx, ly) => ({ x: (lx - tx) / zoom, y: (ly - ty) / zoom }),
    worldToScreen: (wx, wy) => ({ x: tx + zoom * wx, y: ty + zoom * wy }),
  };
}
