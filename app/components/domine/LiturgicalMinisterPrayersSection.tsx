import {
  liturgicalPrayerAfterMassLines,
  liturgicalPrayerBeforeMassLines,
} from "@/lib/content/liturgical-minister-prayers";

function PrayerBlock({
  title,
  lines,
}: {
  title: string;
  lines: readonly string[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--lit-border)]/90 bg-[var(--lit-bg-elevated)] p-6 shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.02] sm:p-8 dark:ring-white/[0.04]">
      <h3 className="mb-6 border-b border-[var(--lit-border)] pb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--lit-ink-subtle)]">
        {title}
      </h3>
      <div className="space-y-2 text-[15px] leading-[1.85] text-[var(--lit-ink-muted)]">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function LiturgicalMinisterPrayersSection() {
  return (
    <section
      id="home-prayers"
      className="scroll-mt-28 border-t border-[var(--lit-border)]/80 bg-[var(--lit-bg)] px-5 py-24 md:px-10 md:py-32 lg:scroll-mt-24 lg:px-12"
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)] max-lg:tracking-[0.28em]">
          Prayers
        </p>
        <h2
          id="liturgical-prayers-heading"
          className="mt-4 text-center font-light text-[clamp(1.75rem,4.5vw,2.5rem)] tracking-[-0.03em] text-[var(--lit-ink)] text-pretty max-lg:text-[clamp(1.5rem,5.2vw,1.95rem)] max-lg:leading-snug md:mt-6"
        >
          전례 봉사자 기도
        </h2>
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
      </div>
    </section>
  );
}
