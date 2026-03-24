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
}: {
  label: string;
  value: string;
  enrichDisplay?: boolean;
}) {
  if (!value.trim()) {
    return null;
  }
  const shown =
    enrichDisplay ? formatYouthMemberDisplay(value) : value;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
        {label}
      </span>
      <span className="break-words text-sm font-medium leading-snug text-[var(--lit-ink)]">
        {shown}
      </span>
    </div>
  );
}

function RoleLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value.trim()) {
    return null;
  }
  const shown = formatYouthMemberDisplay(value);
  return (
    <p className="break-words text-sm leading-relaxed text-[var(--lit-ink-muted)]">
      <span className="text-[var(--lit-ink-subtle)]">{label}</span>
      <span className="text-[var(--lit-border-strong)]"> : </span>
      <span className="font-medium text-[var(--lit-ink)]">
        {shown}
      </span>
    </p>
  );
}

type Props = {
  schedule: LiturgicalSchedule;
  showEditLink?: boolean;
  emphasize?: boolean;
};

const cardBase =
  "rounded-2xl border bg-[var(--lit-bg-elevated)] p-6 shadow-[var(--lit-paper-shadow)] sm:p-7";

export function LiturgicalScheduleCard({
  schedule,
  showEditLink = true,
  emphasize = false,
}: Props) {
  const enrich = !showEditLink;

  const hasLiturgicalRoles = [
    schedule.role_commentator,
    schedule.role_reader_1,
    schedule.role_reader_2,
    schedule.role_gospel_acclamation,
    schedule.thurifer_main,
    schedule.thurifer_sub,
    schedule.organist,
  ].some((s) => s.trim());

  return (
    <article
      className={
        emphasize
          ? `relative overflow-hidden ${cardBase} border-2 border-[var(--lit-gold)]/55 ring-1 ring-[var(--lit-gold)]/25`
          : `${cardBase} border-[var(--lit-border)]`
      }
    >
      {emphasize ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--lit-accent)] via-[var(--lit-gold-muted)] to-[var(--lit-gold)]"
          aria-hidden
        />
      ) : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--lit-gold-muted)]">
            {formatDateLabel(schedule.liturgy_date)}
          </p>
          {schedule.title.trim() ? (
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--lit-ink)]">
              {schedule.title}
            </h3>
          ) : null}
        </div>
        {showEditLink ? (
          <Link
            href={`/liturgical/edit?date=${schedule.liturgy_date}`}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[var(--lit-border-strong)] bg-[var(--lit-bg)] px-5 text-sm font-medium text-[var(--lit-ink)] transition hover:border-[var(--lit-gold)] hover:text-[var(--lit-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
          >
            수정
          </Link>
        ) : null}
      </div>

      {schedule.announcement_detail.trim() ? (
        <div className="mb-5 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)] p-4">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--lit-ink-muted)]">
            {schedule.announcement_detail}
          </p>
        </div>
      ) : null}

      {hasLiturgicalRoles ? (
        <div className="space-y-4 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)]/80 p-4 sm:p-5">
          {enrich ? (
            <>
              <div>
                <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-gold)]">
                  전례 봉사
                </h4>
                <div className="space-y-2">
                  <RoleLine
                    label="해설"
                    value={schedule.role_commentator}
                  />
                  <RoleLine
                    label="1독서"
                    value={schedule.role_reader_1}
                  />
                  <RoleLine
                    label="2독서"
                    value={schedule.role_reader_2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <RoleLine
                  label="복음 환호송"
                  value={schedule.role_gospel_acclamation}
                />
              </div>

              <div>
                <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-gold)]">
                  복사단
                </h4>
                <div className="space-y-2">
                  <RoleLine label="대복" value={schedule.thurifer_main} />
                  <RoleLine label="소복" value={schedule.thurifer_sub} />
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-gold)]">
                  지휘 · 반주
                </h4>
                <div className="space-y-2">
                  <RoleLine label="지휘" value={FIXED_CONDUCTOR_NAME} />
                  <RoleLine label="반주" value={schedule.organist} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-gold)]">
                  전례 봉사
                </h4>
                <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-2">
                  <RoleCell
                    label="해설"
                    value={schedule.role_commentator}
                    enrichDisplay={enrich}
                  />
                  <RoleCell
                    label="1독서"
                    value={schedule.role_reader_1}
                    enrichDisplay={enrich}
                  />
                  <RoleCell
                    label="2독서"
                    value={schedule.role_reader_2}
                    enrichDisplay={enrich}
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-gold)]">
                  복음 환호송
                </h4>
                {schedule.role_gospel_acclamation.trim() ? (
                  <p className="text-sm font-medium text-[var(--lit-ink)]">
                    {schedule.role_gospel_acclamation}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <RoleCell
                  label="대복"
                  value={schedule.thurifer_main}
                  enrichDisplay={enrich}
                />
                <RoleCell
                  label="소복"
                  value={schedule.thurifer_sub}
                  enrichDisplay={enrich}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <RoleCell
                  label="지휘"
                  value={FIXED_CONDUCTOR_NAME}
                  enrichDisplay={enrich}
                />
                <RoleCell
                  label="반주"
                  value={schedule.organist}
                  enrichDisplay={enrich}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)]/80 p-4 sm:p-5">
          {enrich ? (
            <div className="space-y-2">
              <h4 className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--lit-gold)]">
                지휘 · 반주
              </h4>
              <RoleLine label="지휘" value={FIXED_CONDUCTOR_NAME} />
              <RoleLine label="반주" value={schedule.organist} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <RoleCell
                label="지휘"
                value={FIXED_CONDUCTOR_NAME}
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
