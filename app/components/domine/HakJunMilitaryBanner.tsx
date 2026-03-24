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
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-8">
        <div className="flex flex-col gap-6 border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="relative aspect-[4/5] w-[6.5rem] overflow-hidden border border-[var(--lit-border)] bg-[var(--lit-bg)] sm:w-[7.25rem]">
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

          <div className="min-w-0 flex-1 space-y-4">
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
                {HAK_JUN_NAME} 님 복무 카운트
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-[var(--lit-ink-muted)] sm:justify-start">
                <span>
                  <span className="text-[var(--lit-ink-subtle)]">입대</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_ENLIST)}
                  </span>
                </span>
                <span className="text-[var(--lit-border-strong)]" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="text-[var(--lit-ink-subtle)]">전역</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_DISCHARGE)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-baseline justify-center gap-6 sm:justify-start">
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--lit-ink)]">
                  {ddayLabel}
                </span>
                <span className="text-sm text-[var(--lit-ink-muted)]">
                  진행{" "}
                  <span className="text-lg font-semibold tabular-nums text-[var(--lit-ink)]">
                    {pctLabel}%
                  </span>
                </span>
              </div>
              <div className="h-2 w-full min-w-0 flex-1 overflow-hidden border border-[var(--lit-border)] bg-[var(--lit-bg)]">
                <div
                  className="h-full bg-[var(--lit-ink)]"
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
