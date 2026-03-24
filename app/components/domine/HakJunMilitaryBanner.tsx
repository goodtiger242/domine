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
    <div className="border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]">
      <div className="mx-auto max-w-[90rem] px-5 py-12 md:px-10 md:py-16 lg:px-12">
        <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)]">
          Feature
        </p>
        <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,280px)_1fr] md:items-center md:gap-16 lg:gap-24">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden bg-[var(--lit-bg)] md:mx-0 md:max-w-none">
            <Image
              src={PHOTO}
              alt={`${HAK_JUN_NAME} 사진`}
              fill
              sizes="(max-width: 768px) 220px, 320px"
              className="object-cover object-top"
              priority
            />
          </div>

          <div className="min-w-0 space-y-8 text-center md:text-left">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--lit-ink-subtle)]">
                {HAK_JUN_NAME} · 복무 카운트
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--lit-ink-muted)] md:justify-start">
                <span>
                  <span className="text-[var(--lit-ink-subtle)]">입대</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_ENLIST)}
                  </span>
                </span>
                <span className="hidden text-[var(--lit-border-strong)] sm:inline" aria-hidden>
                  /
                </span>
                <span>
                  <span className="text-[var(--lit-ink-subtle)]">전역</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_DISCHARGE)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
                  남은 일수
                </p>
                <p className="mt-2 font-light text-5xl tabular-nums tracking-tight text-[var(--lit-ink)] md:text-6xl">
                  {ddayLabel}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
                  진행률
                </p>
                <p className="mt-2 text-2xl font-light tabular-nums text-[var(--lit-ink)] md:text-3xl">
                  {pctLabel}
                  <span className="text-lg font-normal text-[var(--lit-ink-muted)]">%</span>
                </p>
                <div className="mt-4 h-[2px] w-full overflow-hidden bg-[var(--lit-border)]">
                  <div
                    className="h-full bg-[var(--lit-ink)] transition-[width] duration-700 ease-out"
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
    </div>
  );
}
