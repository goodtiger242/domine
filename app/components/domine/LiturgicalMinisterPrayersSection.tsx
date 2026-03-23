import {
  liturgicalPrayerAfterMassLines,
  liturgicalPrayerBeforeMassLines,
} from "@/lib/content/liturgical-minister-prayers";
import { outfitDisplay } from "@/lib/fonts/display";

function PrayerBlock({
  title,
  lines,
}: {
  title: string;
  lines: readonly string[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:p-6">
      <h3
        className={`${outfitDisplay.className} mb-4 border-b border-slate-200/80 pb-3 text-lg font-semibold text-indigo-950 dark:border-slate-600 dark:text-amber-50`}
      >
        {title}
      </h3>
      <div className="space-y-1.5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
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
      className="border-t border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-[#f4f6fb] px-5 py-14 sm:px-8 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950"
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="liturgical-prayers-heading"
          className={`${outfitDisplay.className} mb-8 text-center text-2xl text-indigo-950 dark:text-amber-50 sm:text-3xl`}
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
