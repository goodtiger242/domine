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
    <div className="flex flex-col rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 shadow-[var(--lit-paper-shadow)] sm:p-6">
      <h3
        className={`${litDisplay.className} mb-4 border-b border-[var(--lit-border)] pb-3 text-lg font-semibold text-[var(--lit-ink)]`}
      >
        {title}
      </h3>
      <div className="space-y-1.5 text-[15px] leading-[1.75] text-[var(--lit-ink-muted)]">
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
      className="border-t border-[var(--lit-border)] bg-[var(--lit-bg)] px-5 py-14 sm:px-8"
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="liturgical-prayers-heading"
          className={`${litDisplay.className} mb-10 text-center text-2xl text-[var(--lit-ink)] sm:text-3xl`}
        >
          전례 봉사자 기도
        </h2>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <PrayerBlock title="미사 전" lines={liturgicalPrayerBeforeMassLines} />
          <PrayerBlock title="미사 후" lines={liturgicalPrayerAfterMassLines} />
        </div>
      </div>
    </section>
  );
}
