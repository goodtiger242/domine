import {
  liturgicalPrayerAfterMassLines,
  liturgicalPrayerBeforeMassLines,
} from "@/lib/content/liturgical-minister-prayers";
import { litDisplay } from "@/lib/fonts/display";

function PrayerBlock({
  title,
  lines,
}: {
  title: string;
  lines: readonly string[];
}) {
  return (
    <div className="flex flex-col border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-6 sm:p-8">
      <h3
        className={`${litDisplay.className} mb-6 border-b border-[var(--lit-border)] pb-4 text-lg font-semibold text-[var(--lit-ink)]`}
      >
        {title}
      </h3>
      <div className="space-y-2 text-[15px] leading-[1.8] text-[var(--lit-ink-muted)]">
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
      className="border-t border-[var(--lit-border)] bg-[var(--lit-bg)] px-6 py-20 md:px-8 md:py-24"
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="liturgical-prayers-heading"
          className={`${litDisplay.className} mb-12 text-center text-[clamp(1.5rem,4vw,2rem)] font-semibold tracking-tight text-[var(--lit-ink)] md:mb-16`}
        >
          전례 봉사자 기도
        </h2>
        <div className="grid gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
          <PrayerBlock title="미사 전" lines={liturgicalPrayerBeforeMassLines} />
          <PrayerBlock title="미사 후" lines={liturgicalPrayerAfterMassLines} />
        </div>
      </div>
    </section>
  );
}
