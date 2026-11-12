import { kingProgress } from "@/lib/domine/pet-king-client";
import { useEffect, useRef, useState } from "react";
import type { KingSettlement } from "@/lib/domine/pet-king-rpc";
export function usePetProgressNumbers(xp: number, coins: number) {
  const [display, setDisplay] = useState({ xp, coins });
  const current = useRef(display);
  useEffect(() => {
    const from = current.current, start = performance.now();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const tick = () => {
      const t = media.matches ? 1 : Math.min(1, (performance.now() - start) / 300);
      current.current = { xp: Math.round(from.xp + (xp - from.xp) * t), coins: Math.round(from.coins + (coins - from.coins) * t) };
      setDisplay(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xp, coins]);
  return display;
}
export type PetNeeds = { fullness: number; mood: number; clean: number };
const NEEDS = [["fullness", "배부름", "🍖", "#e6a94a"], ["mood", "기분", "♥", "#f08aa0"], ["clean", "청결", "💧", "#5bbfd1"]] as const;
export default function PetProgress({ xp, coins, name, level = 1, needs, onInfo, reward, coinLabel = "우리 코인(공용)" }: { xp: number; coins: number; name: string; level?: number; needs?: PetNeeds; onInfo?: () => void; reward?: KingSettlement; coinLabel?: string }) {
  const display = usePetProgressNumbers(xp, coins);
  const p = kingProgress(display.xp, level);
  const confirmed = kingProgress(xp, level);
  return <div className="pet-progress" aria-label={`${name} 레벨 ${p.level}, 경험치 ${p.value}, ${coinLabel} ${coins}`}>
    <strong>{name} Lv.{p.level}</strong>{onInfo && <button type="button" className="pet-info-button" aria-label={`${name} 정보 보기`} onClick={onInfo}>ⓘ</button>}<span className="pet-xp" role="progressbar" aria-label={`${name} 경험치`} aria-valuemin={0} aria-valuemax={p.needed || 1} aria-valuenow={p.needed ? p.current : 1}>
      <i style={{ transform: `scaleX(${p.needed ? p.current / p.needed : 1})` }} /></span><small>{p.needed ? `${p.current}/${p.needed}` : "MAX"}</small><strong className="pet-coin-total" aria-label={`우리 코인(공용) ${display.coins}`}>🪙 {display.coins}</strong>
    {needs && <span className="pet-needs">{NEEDS.map(([key, label, icon, color]) => <span className="pet-need" key={key} title={`${label} ${needs[key]} / 100`}><i aria-hidden="true">{icon}</i><b role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={needs[key]}><u style={{ width: `${Math.max(0, Math.min(100, needs[key]))}%`, background: color }} /></b></span>)}</span>}
    {reward && reward.outcome !== "quit" && <small key={reward.ticket} className="pet-growth-reward" role="status">
      XP +{reward.xp} · 🪙 +{reward.coins} · {confirmed.needed ? `Lv.${level + 1}까지 ${confirmed.needed - confirmed.current} XP` : "최고 레벨"}
    </small>}
  </div>;
}
