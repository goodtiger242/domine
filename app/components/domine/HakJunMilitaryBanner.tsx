import Image from "next/image";
import {
  formatKoreanDate,
  formatProgressPercentDisplay,
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
  const displayPct = stats.isDischarged ? 100 : stats.progressPercent;
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
    <div className="border-b border-[var(--lit-border)] bg-[var(--lit-bg)]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-10 sm:py-6">
        <div
          className="flex flex-col gap-4 rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4 shadow-[var(--lit-paper-shadow)] sm:flex-row sm:items-center sm:gap-6 sm:p-5"
        >
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="relative aspect-[4/5] w-[6.5rem] overflow-hidden rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)] shadow-inner sm:w-[7.25rem]">
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
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--lit-gold-muted)]">
                {HAK_JUN_NAME} 님 복무 카운트
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-[var(--lit-ink-muted)] sm:justify-start">
                <span>
                  <span className="text-[var(--lit-ink-subtle)]">입대</span>{" "}
                  <span className="font-semibold text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_ENLIST)}
                  </span>
                </span>
                <span className="text-[var(--lit-border-strong)]" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="text-[var(--lit-ink-subtle)]">전역</span>{" "}
                  <span className="font-semibold text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_DISCHARGE)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex items-baseline justify-center gap-6 sm:justify-start">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--lit-ink)]">
                  {ddayLabel}
                </span>
                <span className="text-sm text-[var(--lit-ink-muted)]">
                  진행{" "}
                  <span className="text-lg font-bold tabular-nums text-[var(--lit-gold)]">
                    {pctLabel}%
                  </span>
                </span>
              </div>
              <div className="h-2.5 w-full min-w-0 flex-1 overflow-hidden rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--lit-accent)] to-[var(--lit-gold)]"
                  style={{
                    width:
                      displayPct <= 0
                        ? "0%"
                        : `max(${String(Math.min(100, Math.max(0, displayPct)))}%, 2px)`,
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
