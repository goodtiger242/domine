import { progressOf } from "@/lib/domine/pet-progress";
import { useEffect, useRef, useState } from "react";
export default function PetProgress({ xp, coins, name }: { xp: number; coins: number; name: string }) {
  const [display, setDisplay] = useState({ xp, coins });
  const current = useRef(display);
  useEffect(() => {
    const from = current.current, start = performance.now();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const tick = () => {
      const t = media.matches ? 1 : Math.min(1, (performance.now() - start) / 400);
      current.current = { xp: Math.round(from.xp + (xp - from.xp) * t), coins: Math.round(from.coins + (coins - from.coins) * t) };
      setDisplay(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xp, coins]);
  const p = progressOf(display.xp);
  return <div className="pet-progress" aria-label={`${name} 레벨 ${p.level}, 경험치 ${p.value}, 우리 코인(공용) ${coins}`}>
    <strong>{name} Lv. {p.level}</strong><span className="pet-xp" role="progressbar" aria-label={`${name} 경험치`} aria-valuemin={0} aria-valuemax={p.needed || 1} aria-valuenow={p.needed ? p.current : 1}>
      <i style={{ transform: `scaleX(${p.needed ? p.current / p.needed : 1})` }} /></span><small>{p.needed ? `${p.current}/${p.needed}` : "MAX"}</small><strong className="pet-coin-total">우리 코인(공용) {display.coins}</strong>
  </div>;
}
