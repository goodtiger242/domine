import {
  formatKoreanDate,
  getHakJunMilitaryStats,
  HAK_JUN_DISCHARGE,
  HAK_JUN_ENLIST,
  HAK_JUN_NAME,
} from "@/lib/domine/hak-jun-military";

/**
 * 유머: 이학준 멤버 군 복무 카운터 (메인 상단)
 */
export function HakJunMilitaryBanner() {
  const stats = getHakJunMilitaryStats();
  const pctLabel =
    stats.progressPercent >= 100
      ? "100"
      : stats.progressPercent <= 0
        ? "0"
        : stats.progressPercent.toFixed(1);

  let ddayLabel: string;
  if (stats.isDischarged) {
    ddayLabel = "전역";
  } else if (stats.daysToDischarge <= 0) {
    ddayLabel = "D-day";
  } else {
    ddayLabel = `D-${stats.daysToDischarge}`;
  }

  return (
    <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-100 via-indigo-50/80 to-slate-100 dark:border-slate-800 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-10">
        <p className="mb-2 text-center text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {HAK_JUN_NAME} 님 복무 카운트
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:gap-y-2">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-sm text-slate-700 dark:text-slate-300">
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
              <span className="text-slate-500 dark:text-slate-500">전역(가정)</span>{" "}
              <span className="font-semibold text-indigo-950 dark:text-amber-100">
                {formatKoreanDate(HAK_JUN_DISCHARGE)}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200/80 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-700">
            <span className="text-sm font-bold tabular-nums text-indigo-950 dark:text-amber-200">
              {ddayLabel}
            </span>
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">진행</span>
              <span className="font-bold tabular-nums text-indigo-950 dark:text-amber-100">
                {pctLabel}%
              </span>
            </span>
            <div className="h-2 w-full max-w-[12rem] overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] dark:bg-amber-400"
                style={{
                  width: `${Math.min(100, Math.max(0, stats.progressPercent))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
