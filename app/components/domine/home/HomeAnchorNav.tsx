"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const TABS = [
  { id: "home-today", label: "오늘" },
  { id: "home-military", label: "복무" },
  { id: "liturgical", label: "전례" },
  { id: "home-gallery", label: "사진" },
  { id: "home-prayers", label: "기도" },
] as const;

export function HomeAnchorNav() {
  const [active, setActive] = useState<string>(TABS[0].id);

  useEffect(() => {
    const nodes = TABS.map((t) =>
      document.getElementById(t.id)
    ).filter(Boolean) as HTMLElement[];
    if (nodes.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActive(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: "-12% 0px -55% 0px",
        threshold: [0.08, 0.2, 0.35],
      }
    );

    for (const el of nodes) {
      obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  return (
    <nav
      className="sticky top-14 z-40 border-b border-[var(--lit-border)]/85 bg-[var(--lit-bg-elevated)]/96 backdrop-blur-md lg:hidden"
      aria-label="페이지 구역 이동"
    >
      <div className="flex gap-1 overflow-x-auto px-3 py-2.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const isOn = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => scrollTo(t.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 ${
                isOn
                  ? "bg-[var(--lit-ink)] text-[var(--lit-bg-elevated)]"
                  : "bg-transparent text-[var(--lit-ink-muted)] hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <Link
          href="/youth"
          className="min-h-11 shrink-0 self-center rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.02em] text-[var(--lit-ink-muted)] transition-colors hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
        >
          멤버
        </Link>
      </div>
    </nav>
  );
}
