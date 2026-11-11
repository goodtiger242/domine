import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { noticePages, rewardDisplay } from "@/lib/domine/pet-progress";
import type { V6Result } from "@/lib/domine/pet-rpc";
export function PetPickupFeedback({ coins, pouch }: { coins: number; pouch: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ host: HTMLElement; style: CSSProperties } | null>(null);
  useLayoutEffect(() => {
    const ground = layer.current, host = ground?.closest<HTMLElement>(".pet-game"), target = host?.querySelector(".pet-coin-total");
    if (!ground || !host || !target) return;
    const parent = host.getBoundingClientRect(), start = ground.getBoundingClientRect(), end = target.getBoundingClientRect();
    const x = start.left + start.width / 2, y = start.top;
    setFlight({ host, style: { left: x - parent.left, top: y - parent.top,
      "--coin-x": `${end.left + end.width / 2 - x}px`, "--coin-y": `${end.top + end.height / 2 - y}px` } as CSSProperties });
  }, []);
  return <div ref={layer} className="pet-pickup" role="status">
    <span>🪙 +{coins}</span>
    {flight && createPortal(<div className="pet-coin-layer" aria-hidden="true"><i className="pet-pickup-flight" data-pouch={pouch} style={flight.style}>{pouch ? "💰" : "🪙"}</i></div>, flight.host)}
  </div>;
}
export function PetNotice({ parts, onOpen }: { parts: string[]; onOpen: () => void }) {
  const button = useRef<HTMLButtonElement>(null), probe = useRef<HTMLSpanElement>(null);
  const [pages, setPages] = useState<string[]>([""]), [index, setIndex] = useState(0);
  const content = JSON.stringify(parts);
  useLayoutEffect(() => {
    const measure = () => {
      if (!button.current || !probe.current) return;
      const width = button.current.clientWidth;
      setPages(noticePages(JSON.parse(content), (text) => {
        probe.current!.textContent = text;
        return probe.current!.getBoundingClientRect().width <= width;
      }));
      setIndex(0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (button.current) observer.observe(button.current);
    if (probe.current) observer.observe(probe.current);
    return () => observer.disconnect();
  }, [content]);
  useEffect(() => {
    if (pages.length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % pages.length), 1600);
    return () => clearInterval(timer);
  }, [pages]);
  const full = parts.filter(Boolean).join(" · ");
  return <div className="pet-progress-note" role="status">
    <button ref={button} type="button" disabled={!full} title={full || undefined}
      aria-label={full ? `안내 전체 보기: ${full}` : "새 안내 없음"} onClick={onOpen}>
      <span aria-hidden="true">{pages[index] || "\u00a0"}</span>
    </button>
    <span ref={probe} className="pet-notice-measure" aria-hidden="true" />
  </div>;
}

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
  return <div ref={layer} className="pet-feedback" aria-hidden="true">
    {flight && createPortal(<div className="pet-coin-layer" aria-hidden="true">{Array.from({ length: Math.max(3, Math.min(5, r.coins)) }, (_, i) => <i key={i} className="pet-coin-flight" style={{ ...flight.style, animationDelay: `${i * 60}ms` }}
      onAnimationEnd={() => { flight.target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 180 }); }}>●</i>)}</div>, flight.host)}
    {leveled && Array.from({ length: 12 }, (_, i) => <i key={i} className="pet-level-particle" style={{ left: `${8 + i * 7}%`, animationDelay: `${i * 35}ms` }}>✦</i>)}
  </div>;
}
