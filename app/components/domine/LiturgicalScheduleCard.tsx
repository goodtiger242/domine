import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { FIXED_CONDUCTOR_NAME } from "@/lib/constants/liturgical";
import { formatYouthMemberDisplay } from "@/lib/constants/youth-members";

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function RoleCell({
  label,
  value,
  enrichDisplay,
  showEmptyWhenBlank,
}: {
  label: string;
  value: string;
  enrichDisplay?: boolean;
  showEmptyWhenBlank?: boolean;
}) {
  const trimmed = value.trim();
  if (!trimmed && !showEmptyWhenBlank) {
    return null;
  }
  const shown =
    trimmed && enrichDisplay ? formatYouthMemberDisplay(value) : trimmed;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[var(--lit-ink-subtle)]">
        {label}
      </span>
      <span className="break-words text-sm font-medium leading-snug text-[var(--lit-ink)]">
        {shown || "\u00a0"}
      </span>
    </div>
  );
}

function RoleLine({
  label,
  value,
  showEmptyWhenBlank,
}: {
  label: string;
  value: string;
  showEmptyWhenBlank?: boolean;
}) {
  const trimmed = value.trim();
  if (!trimmed && !showEmptyWhenBlank) {
    return null;
  }
  const shown = trimmed ? formatYouthMemberDisplay(value) : "";
  return (
    <p className="break-words text-sm leading-relaxed text-[var(--lit-ink-muted)]">
      <span className="text-[var(--lit-ink-subtle)]">{label}</span>
      <span className="text-[var(--lit-border-strong)]"> : </span>
      <span className="font-medium text-[var(--lit-ink)]">
        {shown || "\u00a0"}
      </span>
    </p>
  );
}

type Props = {
  schedule: LiturgicalSchedule;
  showEditLink?: boolean;
  emphasize?: boolean;
  /** 메인 등: 담당 미입력 시에도 라벨만 두고 빈칸 표시 */
  showEmptyRolePlaceholders?: boolean;
  /** DB에 해당 날짜 행이 없을 때(일요일 슬롯만 있는 경우) — 지휘 고정명도 비움 */
  syntheticEmpty?: boolean;
  /** 카드 래퍼 추가 클래스 (메인 톤 조정 등) */
  articleClassName?: string;
};

const cardBase =
  "rounded-sm border bg-[var(--lit-bg-elevated)] p-6 sm:p-8";

export function LiturgicalScheduleCard({
  schedule,
  showEditLink = true,
  emphasize = false,
  showEmptyRolePlaceholders = false,
  syntheticEmpty = false,
  articleClassName = "",
}: Props) {
  const enrich = !showEditLink;
  const showEmpty = showEmptyRolePlaceholders && enrich;

  const hasLiturgicalRoles = [
    schedule.role_commentator,
    schedule.role_reader_1,
    schedule.role_reader_2,
    schedule.role_gospel_acclamation,
    schedule.thurifer_main,
    schedule.thurifer_sub,
    schedule.organist,
  ].some((s) => s.trim());

  const showRolesBlock = hasLiturgicalRoles || showEmptyRolePlaceholders;
  const conductorValue = syntheticEmpty ? "" : FIXED_CONDUCTOR_NAME;

  return (
    <article
      className={`${
        emphasize
          ? `${cardBase} border-2 border-[var(--lit-ink)]`
          : `${cardBase} border-[var(--lit-border)]`
      }${articleClassName ? ` ${articleClassName}` : ""}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
            {formatDateLabel(schedule.liturgy_date)}
          </p>
          {schedule.title.trim() ? (
            <h3 className="mt-2 text-xl font-light tracking-tight text-[var(--lit-ink)]">
              {schedule.title}
            </h3>
          ) : null}
        </div>
        {showEditLink ? (
          <Link
            href={`/liturgical/edit?date=${schedule.liturgy_date}`}
            className="inline-flex h-10 shrink-0 items-center justify-center border border-[var(--lit-ink)] bg-transparent px-5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--lit-ink)] transition hover:bg-[var(--lit-ink)] hover:text-[var(--lit-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
          >
            수정
          </Link>
        ) : null}
      </div>

      {schedule.announcement_detail.trim() ? (
        <div className="mb-5 border border-[var(--lit-border)] bg-[var(--lit-bg)] p-4">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--lit-ink-muted)]">
            {schedule.announcement_detail}
          </p>
        </div>
      ) : null}

      {showRolesBlock ? (
        <div className="space-y-4 border border-[var(--lit-border)] bg-[var(--lit-bg)] p-4 sm:p-5">
          {enrich ? (
            <>
              <div>
                <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)]">
                  전례 봉사
                </h4>
                <div className="space-y-2">
                  <RoleLine
                    label="해설"
                    value={schedule.role_commentator}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <RoleLine
                    label="1독서"
                    value={schedule.role_reader_1}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <RoleLine
                    label="2독서"
                    value={schedule.role_reader_2}
                    showEmptyWhenBlank={showEmpty}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <RoleLine
                  label="복음 환호송"
                  value={schedule.role_gospel_acclamation}
                  showEmptyWhenBlank={showEmpty}
                />
              </div>

              <div>
                <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)]">
                  복사단
                </h4>
                <div className="space-y-2">
                  <RoleLine
                    label="대복"
                    value={schedule.thurifer_main}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <RoleLine
                    label="소복"
                    value={schedule.thurifer_sub}
                    showEmptyWhenBlank={showEmpty}
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)]">
                  지휘 · 반주
                </h4>
                <div className="space-y-2">
                  <RoleLine
                    label="지휘"
                    value={conductorValue}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <RoleLine
                    label="반주"
                    value={schedule.organist}
                    showEmptyWhenBlank={showEmpty}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)]">
                  전례 봉사
                </h4>
                <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-2">
                  <RoleCell
                    label="해설"
                    value={schedule.role_commentator}
                    enrichDisplay={enrich}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <RoleCell
                    label="1독서"
                    value={schedule.role_reader_1}
                    enrichDisplay={enrich}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <RoleCell
                    label="2독서"
                    value={schedule.role_reader_2}
                    enrichDisplay={enrich}
                    showEmptyWhenBlank={showEmpty}
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)]">
                  복음 환호송
                </h4>
                {schedule.role_gospel_acclamation.trim() || showEmpty ? (
                  <p className="text-sm font-medium text-[var(--lit-ink)]">
                    {schedule.role_gospel_acclamation.trim()
                      ? schedule.role_gospel_acclamation
                      : showEmpty
                        ? "\u00a0"
                        : null}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <RoleCell
                  label="대복"
                  value={schedule.thurifer_main}
                  enrichDisplay={enrich}
                  showEmptyWhenBlank={showEmpty}
                />
                <RoleCell
                  label="소복"
                  value={schedule.thurifer_sub}
                  enrichDisplay={enrich}
                  showEmptyWhenBlank={showEmpty}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <RoleCell
                  label="지휘"
                  value={conductorValue}
                  enrichDisplay={enrich}
                  showEmptyWhenBlank={showEmpty}
                />
                <RoleCell
                  label="반주"
                  value={schedule.organist}
                  enrichDisplay={enrich}
                  showEmptyWhenBlank={showEmpty}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="border border-[var(--lit-border)] bg-[var(--lit-bg)] p-4 sm:p-5">
          {enrich ? (
            <div className="space-y-2">
              <h4 className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-ink-subtle)]">
                지휘 · 반주
              </h4>
              <RoleLine label="지휘" value={conductorValue} />
              <RoleLine label="반주" value={schedule.organist} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <RoleCell
                label="지휘"
                value={conductorValue}
                enrichDisplay={enrich}
              />
              <RoleCell
                label="반주"
                value={schedule.organist}
                enrichDisplay={enrich}
              />
            </div>
          )}
        </div>
      )}

      {showEditLink && schedule.updated_at ? (
        <p className="mt-4 text-center text-xs text-[var(--lit-ink-subtle)]">
          마지막 저장:{" "}
          {new Date(schedule.updated_at).toLocaleString("ko-KR")}
        </p>
      ) : null}
    </article>
  );
}
