import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { PRESS_MS, pressAt, type TapPoint } from "@/lib/domine/pet-tap";

type Stroke = { phase: "start" | "hold" | "release"; point: TapPoint };
type Options = { disabled: boolean; cancelled: boolean; width: number; height: number; scale: number;
  onTap?: (point: TapPoint) => void; onContact?: (active: boolean) => void; onPet?: () => void; onRelease?: () => void };
export function usePetStroke(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const press = useRef<{ id: number; at: number; sent: boolean; target: SVGGElement; point: TapPoint; tap: TapPoint } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const releaseCapture = () => {
    const current = press.current; press.current = null;
    if (current?.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id);
  };
  const cancel = () => { clear(); releaseCapture(); setStroke(null); latest.current.onContact?.(false); };
  const commit = () => {
    const current = press.current;
    if (!current || latest.current.cancelled || latest.current.disabled || document.hidden) return;
    if (pressAt(performance.now() - current.at, current.sent).care) {
      current.sent = true; latest.current.onPet?.();
    }
  };
  useEffect(() => {
    if (options.cancelled || (options.disabled && !press.current?.sent)) cancel();
    // Cancellation follows lock changes, not pointer movement or callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.disabled, options.cancelled]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", hide);
    return () => { clear(); releaseCapture(); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", hide); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function point(event: PointerEvent<SVGGElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: -options.height / 2 };
  }
  return { stroke, handlers: {
    onPointerDown(event: PointerEvent<SVGGElement>) {
      if (options.disabled || options.cancelled || press.current || !event.isPrimary || event.button !== 0) return;
      event.preventDefault(); clear(); setStroke(null);
      const p = point(event);
      press.current = { id: event.pointerId, at: performance.now(), sent: false, target: event.currentTarget, point: { x: p.x, y: p.y },
        tap: { x: p.x / options.width + .5, y: (p.y + options.height - 1.5 * options.scale) / options.height } };
      event.currentTarget.setPointerCapture(event.pointerId); options.onContact?.(true);
      for (const delay of [PRESS_MS.start, PRESS_MS.hold]) timers.current.push(setTimeout(() => {
        const current = press.current;
        if (!current) return;
        const { phase } = pressAt(performance.now() - current.at);
        if (phase !== "tap") setStroke({ phase, point: current.point });
      }, delay));
      timers.current.push(setTimeout(commit, PRESS_MS.care));
    },
    onPointerMove(event: PointerEvent<SVGGElement>) {
      if (press.current?.id !== event.pointerId) return;
      const p = point(event); press.current.point = { x: p.x, y: p.y };
      setStroke((current) => current && { ...current, point: { x: p.x, y: p.y } });
    },
    onPointerUp(event: PointerEvent<SVGGElement>) {
      const current = press.current;
      if (current?.id !== event.pointerId) return;
      const { phase } = pressAt(performance.now() - current.at);
      clear(); commit(); releaseCapture();
      if (phase === "tap") { setStroke(null); latest.current.onContact?.(false); latest.current.onTap?.(current.tap); }
      else {
        setStroke({ phase: "release", point: current.point }); latest.current.onRelease?.();
        timers.current.push(setTimeout(() => { setStroke(null); latest.current.onContact?.(false); }, PRESS_MS.release));
      }
    },
    onPointerCancel(event: PointerEvent<SVGGElement>) { if (press.current?.id === event.pointerId) cancel(); },
    onLostPointerCapture(event: PointerEvent<SVGGElement>) { if (press.current?.id === event.pointerId) cancel(); },
    onContextMenu(event: React.MouseEvent<SVGGElement>) { event.preventDefault(); },
  } };
}
