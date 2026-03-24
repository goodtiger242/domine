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

type Props = {
  /** 메인 등: 바깥 카드가 있을 때 테두리·배경 생략 */
  embedded?: boolean;
};

export function HakJunMilitaryBanner({ embedded = false }: Props) {
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
    <div
      className={
        embedded
          ? "bg-transparent"
          : "border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]"
      }
    >
      <div
        className={
          embedded
            ? "mx-auto w-full max-w-none px-0 py-0"
            : "mx-auto max-w-[90rem] px-4 py-6 md:px-10 md:py-12 lg:px-12 lg:py-16"
        }
      >
        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-start gap-3 md:grid-cols-[minmax(0,280px)_1fr] md:items-center md:gap-16 lg:gap-24">
          <div className="relative aspect-[3/4] w-full max-w-[7rem] shrink-0 overflow-hidden bg-[var(--lit-bg)] md:max-w-none">
            <Image
              src={PHOTO}
              alt={`${HAK_JUN_NAME} 사진`}
              fill
              sizes="(max-width: 768px) 112px, 320px"
              className="object-cover object-top"
              priority
            />
          </div>

          <div className="min-w-0 space-y-4 text-left md:space-y-8 md:text-left">
            <div>
              <p className="break-keep text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)] md:text-[11px] md:tracking-[0.22em]">
                {HAK_JUN_NAME} · 복무 카운트
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--lit-ink-muted)] md:mt-6 md:gap-x-6 md:text-sm">
                <span className="break-keep">
                  <span className="text-[var(--lit-ink-subtle)]">입대</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_ENLIST)}
                  </span>
                </span>
                <span className="text-[var(--lit-border-strong)]" aria-hidden>
                  /
                </span>
                <span className="break-keep">
                  <span className="text-[var(--lit-ink-subtle)]">전역</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(HAK_JUN_DISCHARGE)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-row flex-wrap items-end gap-4 sm:gap-10 md:gap-10">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)] md:text-[10px] md:tracking-[0.2em]">
                  남은 일수
                </p>
                <p className="mt-1 font-light text-3xl tabular-nums tracking-tight text-[var(--lit-ink)] md:mt-2 md:text-5xl lg:text-6xl">
                  {ddayLabel}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)] md:text-[10px] md:tracking-[0.2em]">
                  진행률
                </p>
                <p className="mt-1 text-xl font-light tabular-nums text-[var(--lit-ink)] md:mt-2 md:text-2xl lg:text-3xl">
                  {pctLabel}
                  <span className="text-base font-normal text-[var(--lit-ink-muted)] md:text-lg">
                    %
                  </span>
                </p>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--lit-border)] md:mt-4">
                  <div
                    className="h-full rounded-full bg-[var(--lit-ink)] transition-[width] duration-700 ease-out"
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
