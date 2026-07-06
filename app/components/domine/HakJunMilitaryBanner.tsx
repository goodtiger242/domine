import Image from "next/image";
import {
  formatKoreanDate,
  formatProgressPercentDisplay,
  getMilitaryServiceStats,
  HAK_JUN_MILITARY_MEMBER,
  type MilitaryServiceMember,
} from "@/lib/domine/hak-jun-military";

type Props = {
  /** 메인 등: 바깥 카드가 있을 때 테두리·배경 생략 */
  embedded?: boolean;
  member?: MilitaryServiceMember;
};

type CardProps = {
  member: MilitaryServiceMember;
};

export function MilitaryServiceCompactCard({ member }: CardProps) {
  const stats = getMilitaryServiceStats(member);
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
    <div className="min-w-0 text-center">
      <div className="mx-auto w-full max-w-[8.25rem] md:max-w-[10.5rem]">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--lit-bg)]">
          {member.photoSrc ? (
            <Image
              src={member.photoSrc}
              alt={`${member.label} 사진`}
              fill
              sizes="(max-width: 768px) 44vw, 208px"
              className="object-cover object-top"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--lit-border)] text-4xl font-semibold tracking-[-0.03em] text-[var(--lit-ink-muted)] md:text-5xl">
              {member.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-2 max-w-[12rem] md:mt-3">
        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--lit-ink)] md:text-base">
          {member.label}
        </p>
        <div className="mt-1.5 flex items-baseline justify-center gap-2.5 md:mt-2 md:gap-3">
          <span className="text-xl font-light tabular-nums tracking-tight text-[var(--lit-ink)] md:text-3xl">
            {ddayLabel}
          </span>
          <span className="text-sm font-light tabular-nums text-[var(--lit-ink-muted)] md:text-lg">
            {pctLabel}%
          </span>
        </div>
        <p className="mt-1.5 break-keep text-[10px] leading-relaxed text-[var(--lit-ink-muted)] md:mt-2 md:text-[11px]">
          {formatKoreanDate(member.enlistDate)} -{" "}
          {formatKoreanDate(member.dischargeDate)}
        </p>
      </div>
    </div>
  );
}

export function MilitaryServiceBanner({
  embedded = false,
  member = HAK_JUN_MILITARY_MEMBER,
}: Props) {
  const compact = embedded;
  const stats = getMilitaryServiceStats(member);
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
        <div
          className={
            compact
              ? "grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] items-start gap-2.5 md:grid-cols-[minmax(0,220px)_1fr] md:items-center md:gap-10 lg:gap-14"
              : "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-start gap-3 md:grid-cols-[minmax(0,280px)_1fr] md:items-center md:gap-16 lg:gap-24"
          }
        >
          <div
            className={
              compact
                ? "relative aspect-[3/4] w-full max-w-[5.5rem] shrink-0 overflow-hidden bg-[var(--lit-bg)] md:max-w-none"
                : "relative aspect-[3/4] w-full max-w-[7rem] shrink-0 overflow-hidden bg-[var(--lit-bg)] md:max-w-none"
            }
          >
            {member.photoSrc ? (
              <Image
                src={member.photoSrc}
                alt={`${member.label} 사진`}
                fill
                sizes={
                  compact
                    ? "(max-width: 768px) 88px, 260px"
                    : "(max-width: 768px) 112px, 320px"
                }
                className="object-cover object-top"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--lit-border)] text-xl font-semibold tracking-[-0.03em] text-[var(--lit-ink-muted)] md:text-5xl">
                {member.name.slice(0, 1)}
              </div>
            )}
          </div>

          <div
            className={
              compact
                ? "min-w-0 space-y-3 text-left md:space-y-6 md:text-left"
                : "min-w-0 space-y-4 text-left md:space-y-8 md:text-left"
            }
          >
            <div>
              <p className="break-keep text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)] md:text-[11px] md:tracking-[0.22em]">
                {member.label} · 복무 카운트
              </p>
              <div
                className={
                  compact
                    ? "mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--lit-ink-muted)] md:mt-4 md:gap-x-5 md:text-sm"
                    : "mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--lit-ink-muted)] md:mt-6 md:gap-x-6 md:text-sm"
                }
              >
                <span className="break-keep">
                  <span className="text-[var(--lit-ink-subtle)]">입대</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(member.enlistDate)}
                  </span>
                </span>
                <span className="text-[var(--lit-border-strong)]" aria-hidden>
                  /
                </span>
                <span className="break-keep">
                  <span className="text-[var(--lit-ink-subtle)]">전역</span>{" "}
                  <span className="font-medium text-[var(--lit-ink)]">
                    {formatKoreanDate(member.dischargeDate)}
                  </span>
                </span>
              </div>
            </div>

            <div
              className={
                compact
                  ? "flex flex-row flex-wrap items-end gap-3 sm:gap-8 md:gap-8"
                  : "flex flex-row flex-wrap items-end gap-4 sm:gap-10 md:gap-10"
              }
            >
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)] md:text-[10px] md:tracking-[0.2em]">
                  남은 일수
                </p>
                <p
                  className={
                    compact
                      ? "mt-1 font-light text-2xl tabular-nums tracking-tight text-[var(--lit-ink)] md:mt-1.5 md:text-4xl lg:text-5xl"
                      : "mt-1 font-light text-3xl tabular-nums tracking-tight text-[var(--lit-ink)] md:mt-2 md:text-5xl lg:text-6xl"
                  }
                >
                  {ddayLabel}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)] md:text-[10px] md:tracking-[0.2em]">
                  진행률
                </p>
                <p
                  className={
                    compact
                      ? "mt-1 text-lg font-light tabular-nums text-[var(--lit-ink)] md:mt-1.5 md:text-xl lg:text-2xl"
                      : "mt-1 text-xl font-light tabular-nums text-[var(--lit-ink)] md:mt-2 md:text-2xl lg:text-3xl"
                  }
                >
                  {pctLabel}
                  <span
                    className={
                      compact
                        ? "text-sm font-normal text-[var(--lit-ink-muted)] md:text-base"
                        : "text-base font-normal text-[var(--lit-ink-muted)] md:text-lg"
                    }
                  >
                    %
                  </span>
                </p>
                <div
                  className={
                    compact
                      ? "mt-1.5 h-[2.5px] w-full overflow-hidden rounded-full bg-[var(--lit-border)] md:mt-3"
                      : "mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--lit-border)] md:mt-4"
                  }
                >
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

export function HakJunMilitaryBanner({ embedded = false }: Props) {
  return (
    <MilitaryServiceBanner
      embedded={embedded}
      member={HAK_JUN_MILITARY_MEMBER}
    />
  );
}
