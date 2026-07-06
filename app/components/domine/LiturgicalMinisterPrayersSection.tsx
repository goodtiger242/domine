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
  return (
    <section
      id="home-prayers"
      className={`scroll-mt-28 border-t border-[var(--lit-border)]/80 bg-[var(--lit-bg)] px-5 md:px-10 lg:scroll-mt-24 lg:px-12 ${
        compact ? "py-12 md:py-16" : "py-24 md:py-32"
      }`}
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)] max-lg:tracking-[0.28em]">
          Prayers
        </p>
        <h2
          id="liturgical-prayers-heading"
          className={`text-center font-light tracking-[-0.03em] text-[var(--lit-ink)] text-pretty max-lg:leading-snug ${
            compact
              ? "mt-2 text-[clamp(1.45rem,4vw,2rem)] max-lg:text-[clamp(1.35rem,4.6vw,1.75rem)] md:mt-3"
              : "mt-4 text-[clamp(1.75rem,4.5vw,2.5rem)] max-lg:text-[clamp(1.5rem,5.2vw,1.95rem)] md:mt-6"
          }`}
        >
          전례 봉사자 기도
        </h2>
        <div
          className={`grid md:grid-cols-2 ${
            compact
              ? "mt-8 gap-5 md:mt-10 md:gap-6 lg:gap-8"
              : "mt-14 gap-8 md:mt-20 md:gap-10 lg:gap-12"
          }`}
        >
          <PrayerBlock
            title="미사 전"
            lines={liturgicalPrayerBeforeMassLines}
            compact={compact}
          />
          <PrayerBlock
            title="미사 후"
            lines={liturgicalPrayerAfterMassLines}
            compact={compact}
          />
        </div>
      </div>
    </section>
  );
}
