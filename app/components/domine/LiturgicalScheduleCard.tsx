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
      <span className="text-[11px] font-semibold tracking-wide text-[var(--lit-ink-muted)]">
        {label}
      </span>
      <span className="break-keep text-[15px] font-medium leading-snug text-[var(--lit-ink)]">
        {shown || "\u00a0"}
      </span>
    </div>
  );
}

/** 메인 등 읽기 전용: 라벨·이름 대비를 높이고 줄 수를 줄임 */
function DenseRoleSlot({
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
    <div className="min-w-0">
      <p className="text-[11px] font-semibold leading-tight text-[var(--lit-ink-muted)]">
        {label}
      </p>
      <p className="mt-1 break-keep text-[15px] font-medium leading-snug text-[var(--lit-ink)]">
        {shown || "\u00a0"}
      </p>
    </div>
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
  "rounded-xl border bg-[var(--lit-bg-elevated)] p-5 sm:p-6";

const rolesPanelClass =
  "rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)] p-4 sm:p-5";

const sectionTitleClass =
  "text-[13px] font-semibold tracking-[-0.02em] text-[var(--lit-ink)]";

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
          ? `${cardBase} border-2 border-[var(--lit-ink)] shadow-[0_0_0_1px_rgba(0,0,0,0.04)] ring-2 ring-[var(--lit-ink)]/12 dark:ring-[var(--lit-ink)]/25`
          : `${cardBase} border-[var(--lit-border)]`
      }${articleClassName ? ` ${articleClassName}` : ""}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={
              enrich
                ? "text-[15px] font-semibold leading-snug tracking-[-0.02em] text-[var(--lit-ink)]"
                : "text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]"
            }
          >
            {formatDateLabel(schedule.liturgy_date)}
          </p>
          {schedule.title.trim() ? (
            <h3
              className={`mt-2 tracking-tight text-[var(--lit-ink)] ${
                enrich
                  ? "text-lg font-medium leading-snug sm:text-xl"
                  : "text-xl font-light"
              }`}
            >
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
        <div className={enrich ? "mb-5" : "mb-6"}>
          <p
            className={`whitespace-pre-wrap text-[var(--lit-ink)] ${
              enrich
                ? "text-[15px] leading-relaxed"
                : "text-[15px] leading-[1.75]"
            }`}
          >
            {schedule.announcement_detail}
          </p>
        </div>
      ) : null}

      {showRolesBlock ? (
        <div
          className={
            enrich
              ? rolesPanelClass
              : "space-y-4 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)] p-4 sm:p-5"
          }
        >
          {enrich ? (
            <div className="space-y-4 sm:space-y-3">
              <div>
                <h4 className={`mb-2.5 sm:mb-2 ${sectionTitleClass}`}>
                  전례 봉사
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 sm:gap-x-4">
                  <DenseRoleSlot
                    label="해설"
                    value={schedule.role_commentator}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <DenseRoleSlot
                    label="1독서"
                    value={schedule.role_reader_1}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <div className="col-span-2 sm:col-span-1">
                    <DenseRoleSlot
                      label="2독서"
                      value={schedule.role_reader_2}
                      showEmptyWhenBlank={showEmpty}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--lit-border)] pt-3 sm:pt-2.5">
                <DenseRoleSlot
                  label="복음 환호송"
                  value={schedule.role_gospel_acclamation}
                  showEmptyWhenBlank={showEmpty}
                />
              </div>

              <div className="border-t border-[var(--lit-border)] pt-3 sm:pt-2.5">
                <h4 className={`mb-2.5 sm:mb-2 ${sectionTitleClass}`}>복사단</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
                  <DenseRoleSlot
                    label="대복"
                    value={schedule.thurifer_main}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <DenseRoleSlot
                    label="소복"
                    value={schedule.thurifer_sub}
                    showEmptyWhenBlank={showEmpty}
                  />
                </div>
              </div>

              <div className="border-t border-[var(--lit-border)] pt-3 sm:pt-2.5">
                <h4 className={`mb-2.5 sm:mb-2 ${sectionTitleClass}`}>
                  지휘 · 반주
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
                  <DenseRoleSlot
                    label="지휘"
                    value={conductorValue}
                    showEmptyWhenBlank={showEmpty}
                  />
                  <DenseRoleSlot
                    label="반주"
                    value={schedule.organist}
                    showEmptyWhenBlank={showEmpty}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h4 className={`mb-2 ${sectionTitleClass}`}>전례 봉사</h4>
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
                <h4 className={`mb-2 ${sectionTitleClass}`}>복음 환호송</h4>
                {schedule.role_gospel_acclamation.trim() || showEmpty ? (
                  <p className="text-[15px] font-medium leading-snug text-[var(--lit-ink)]">
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
        <div className={`${rolesPanelClass}`}>
          {enrich ? (
            <div>
              <h4 className={`mb-2.5 sm:mb-2 ${sectionTitleClass}`}>
                지휘 · 반주
              </h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
                <DenseRoleSlot label="지휘" value={conductorValue} />
                <DenseRoleSlot label="반주" value={schedule.organist} />
              </div>
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
