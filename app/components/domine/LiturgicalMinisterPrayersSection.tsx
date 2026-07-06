"use client";

import { useState } from "react";
import {
  liturgicalPrayerAfterMassLines,
  liturgicalPrayerBeforeMassLines,
} from "@/lib/content/liturgical-minister-prayers";

function PrayerBlock({
  title,
  lines,
  compact = false,
}: {
  title: string;
  lines: readonly string[];
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-[var(--lit-border)]/90 bg-[var(--lit-bg-elevated)] shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.02] dark:ring-white/[0.04] ${
        compact ? "p-4 sm:p-5" : "p-6 sm:p-8"
      }`}
    >
      <h3
        className={`border-b border-[var(--lit-border)] text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--lit-ink-subtle)] ${
          compact ? "mb-4 pb-3" : "mb-6 pb-4"
        }`}
      >
        {title}
      </h3>
      <div
        className={`text-[15px] text-[var(--lit-ink-muted)] ${
          compact ? "space-y-1.5 leading-[1.65]" : "space-y-2 leading-[1.85]"
        }`}
      >
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function LiturgicalMinisterPrayersSection({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [activePrayer, setActivePrayer] = useState<"before" | "after">(
    "before"
  );
  const activePrayerLines =
    activePrayer === "before"
      ? liturgicalPrayerBeforeMassLines
      : liturgicalPrayerAfterMassLines;

  return (
    <section
      id="home-prayers"
      className={`scroll-mt-28 border-t border-[var(--lit-border)]/80 bg-[var(--lit-bg)] px-5 md:px-10 lg:scroll-mt-24 lg:px-12 ${
        compact ? "pb-10 pt-2 md:py-16" : "py-24 md:py-32"
      }`}
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="liturgical-prayers-heading"
          className={`text-center font-light tracking-[-0.03em] text-[var(--lit-ink)] text-pretty max-lg:leading-snug ${
            compact
              ? "text-[clamp(1.35rem,4vw,1.85rem)] max-lg:text-[clamp(1.25rem,4.3vw,1.6rem)]"
              : "mt-4 text-[clamp(1.75rem,4.5vw,2.5rem)] max-lg:text-[clamp(1.5rem,5.2vw,1.95rem)] md:mt-6"
          }`}
        >
          전례 봉사자 기도
        </h2>
        {compact ? (
          <div className="mt-5">
            <div
              className="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]"
              role="tablist"
              aria-label="기도문 선택"
            >
              {[
                ["before", "미사 전"],
                ["after", "미사 후"],
              ].map(([key, label]) => {
                const selected = activePrayer === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActivePrayer(key as "before" | "after")}
                    className={`h-10 text-xs font-semibold tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lit-ring)] ${
                      selected
                        ? "bg-[var(--lit-ink)] text-[var(--lit-bg-elevated)]"
                        : "text-[var(--lit-ink-muted)] hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--lit-border)]/90 bg-[var(--lit-bg-elevated)] p-4 shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
              <div className="space-y-1.5 text-[15px] leading-[1.65] text-[var(--lit-ink-muted)]">
                {activePrayerLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-14 grid gap-8 md:mt-20 md:grid-cols-2 md:gap-10 lg:gap-12">
            <PrayerBlock
              title="미사 전"
              lines={liturgicalPrayerBeforeMassLines}
            />
            <PrayerBlock
              title="미사 후"
              lines={liturgicalPrayerAfterMassLines}
            />
          </div>
        )}
      </div>
    </section>
  );
}
