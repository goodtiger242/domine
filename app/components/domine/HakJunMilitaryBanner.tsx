import Image from "next/image";
import {
  formatKoreanDate,
  formatProgressPercentDisplay,
  getBannerProgressPercent,
  getHakJunMilitaryStats,
  HAK_JUN_DISCHARGE,
  HAK_JUN_ENLIST,
  HAK_JUN_NAME,
} from "@/lib/domine/hak-jun-military";

const PHOTO = "/image/이학준.jpg";

/**
 * 유머: 이학준 멤버 군 복무 카운터 (메인 상단)
 */
export function HakJunMilitaryBanner() {
  const stats = getHakJunMilitaryStats();
  const displayPct = getBannerProgressPercent(stats);
  const pctLabel = formatProgressPercentDisplay(displayPct);

  let ddayLabel: string;
  if (stats.isDischarged) {
    ddayLabel = "전역";
  } else if (stats.daysToDischarge <= 0) {
    ddayLabel = "D-day";
  } else {
    ddayLabel = `D-${stats.daysToDischarge}`;
  }

  return (
    <div className="border-b border-slate-200/80 bg-gradient-to-b from-slate-100/95 to-indigo-50/50 dark:border-slate-800 dark:from-slate-900 dark:to-indigo-950/30">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-10 sm:py-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_4px_24px_rgb(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-900/70 dark:shadow-none sm:flex-row sm:items-center sm:gap-6 sm:p-5">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="relative aspect-[4/5] w-[6.5rem] overflow-hidden rounded-2xl bg-slate-200 shadow-inner ring-2 ring-white/90 dark:bg-slate-800 dark:ring-slate-700/80 sm:w-[7.25rem]">
              <Image
                src={PHOTO}
                alt={`${HAK_JUN_NAME} 사진`}
                fill
                sizes="(max-width: 640px) 104px, 116px"
                className="object-cover object-top"
                priority
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="text-center sm:text-left">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {HAK_JUN_NAME} 님 복무 카운트
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-slate-700 dark:text-slate-300 sm:justify-start">
                <span>
                  <span className="text-slate-500 dark:text-slate-500">입대</span>{" "}
                  <span className="font-semibold text-indigo-950 dark:text-amber-100">
                    {formatKoreanDate(HAK_JUN_ENLIST)}
                  </span>
                </span>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="text-slate-500 dark:text-slate-500">전역</span>{" "}
                  <span className="font-semibold text-indigo-950 dark:text-amber-100">
                    {formatKoreanDate(HAK_JUN_DISCHARGE)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex items-baseline justify-center gap-6 sm:justify-start">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-indigo-950 dark:text-amber-200">
                  {ddayLabel}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  진행{" "}
                  <span className="text-lg font-bold tabular-nums text-indigo-950 dark:text-amber-100">
                    {pctLabel}%
                  </span>
                </span>
              </div>
              <div className="h-2.5 w-full min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-amber-400 dark:to-amber-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, displayPct))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
