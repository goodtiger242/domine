import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { nextGoal, rewardDisplay } from "@/lib/domine/pet-progress";
import type { V6Result } from "@/lib/domine/pet-rpc";
import { CATALOG, ACHIEVEMENTS } from "@/lib/domine/pet-catalog";
import PetItemIcon from "./PetItemIcon";
import { PETS } from "@/lib/domine/pet-photos";
export default function PetFeedback({ result, previousLevel }: { result: V6Result; previousLevel: number }) {
  const r = rewardDisplay(result.reward), leveled = (result.player?.level ?? 1) > previousLevel;
  const layer = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ host: HTMLElement; style: CSSProperties; target: Element } | null>(null);
  useLayoutEffect(() => {
    if (!r.coins || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const host = layer.current?.closest<HTMLElement>(".pet-game");
    const dog = host?.querySelector("[data-pet-actor]");
    const target = host?.querySelector(".pet-coin-total");
    if (!host || !dog || !target) return;
    const parent = host.getBoundingClientRect(), start = dog.getBoundingClientRect(), end = target.getBoundingClientRect();
    const x = start.left + start.width / 2, y = start.top + start.height / 2;
    setFlight({ host, target, style: { left: x - parent.left, top: y - parent.top,
      "--coin-x": `${end.left + end.width / 2 - x}px`, "--coin-y": `${end.top + end.height / 2 - y}px` } as CSSProperties });
  }, [r.coins]);
  const discovery = CATALOG.find((item) => item.id === result.reward?.newEntries[0]);
  return <div ref={layer} className="pet-feedback" aria-live="polite" role="status">
    <span className={`pet-reward ${r.quiet && !r.notice ? "pet-reward-quiet" : ""}`}>{r.notice || <>+{r.coins} 코인{r.xp ? ` · +${r.xp} XP` : ""}</>}</span>
    {flight && createPortal(<div className="pet-coin-layer" aria-hidden="true">{Array.from({ length: Math.max(3, Math.min(5, r.coins)) }, (_, i) => <i key={i} className="pet-coin-flight" style={{ ...flight.style, animationDelay: `${i * 60}ms` }}
      onAnimationEnd={() => { flight.target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 180 }); }}>●</i>)}</div>, flight.host)}
    {!r.quiet && <span className="pet-next-goal">다음 목표 · {nextGoal(result.player?.xp ?? 0, result.coins ?? result.player?.coins ?? 0, result.inventory ?? [])}</span>}
    {leveled && <><strong className="pet-level-up">{result.pet ? PETS[result.pet].name : ""} Lv. {result.player?.level} · 자랐어요!</strong>{Array.from({ length: 12 }, (_, i) => <i key={i} className="pet-level-particle" style={{ left: `${8 + i * 7}%`, animationDelay: `${i * 35}ms` }} aria-hidden="true">✦</i>)}</>}
    {discovery && <span className="pet-discovery"><PetItemIcon item={discovery} /> {discovery.name} · 기록했어요</span>}
    {!!result.reward?.newBadges.length && <span className="pet-new-badge">✦ {ACHIEVEMENTS.find((a) => a.id === result.reward?.newBadges[0])?.name ?? "새 업적"}</span>}
  </div>;
}
