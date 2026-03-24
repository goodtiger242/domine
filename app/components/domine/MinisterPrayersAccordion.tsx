"use client";

import {
  liturgicalPrayerAfterMassLines,
  liturgicalPrayerBeforeMassLines,
} from "@/lib/content/liturgical-minister-prayers";

function AccordionPrayer({
  title,
  lines,
  previewLine,
}: {
  title: string;
  lines: readonly string[];
  previewLine: string;
}) {
  return (
    <details className="group rounded-2xl border border-[var(--lit-border)]/90 bg-[var(--lit-bg-elevated)] ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
      <summary className="flex min-h-[3.25rem] cursor-pointer list-none flex-col gap-1 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-muted)]">
          {title}
        </span>
        <span className="text-[15px] leading-relaxed text-[var(--lit-ink-muted)] group-open:hidden">
          {previewLine}
        </span>
        <span className="hidden text-[13px] text-[var(--lit-ink-subtle)] group-open:inline">
          전체 보기 · 탭하여 닫기
        </span>
      </summary>
      <div className="border-t border-[var(--lit-border)] px-5 pb-5 pt-4">
        <div className="space-y-2 text-[15px] leading-[1.72] text-[var(--lit-ink-muted)]">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </details>
  );
}

export function MinisterPrayersAccordion() {
  const beforePreview =
    liturgicalPrayerBeforeMassLines[0] ?? "";
  const afterPreview = liturgicalPrayerAfterMassLines[0] ?? "";

  return (
    <div className="mt-10 grid max-w-2xl gap-4 md:mt-14 md:mx-auto md:max-w-none md:grid-cols-2 md:gap-6 lg:gap-8">
      <AccordionPrayer
        title="미사 전"
        lines={liturgicalPrayerBeforeMassLines}
        previewLine={beforePreview}
      />
      <AccordionPrayer
        title="미사 후"
        lines={liturgicalPrayerAfterMassLines}
        previewLine={afterPreview}
      />
    </div>
  );
}
