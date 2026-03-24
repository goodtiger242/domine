"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  deleteLiturgicalSchedule,
  upsertLiturgicalSchedule,
  type LiturgicalSchedule,
} from "@/app/actions/liturgical";
import { MassDatePicker } from "@/app/components/liturgical/MassDatePicker";
import { MemberOrCustomInput } from "@/app/components/liturgical/MemberOrCustomInput";
import { FIXED_CONDUCTOR_NAME } from "@/lib/constants/liturgical";
import {
  isYouthMemberName,
  isValidCustomLiturgicalName,
} from "@/lib/constants/youth-members";

const fieldClass =
  "mt-1 w-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-3 py-2.5 text-sm text-[var(--lit-ink)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2";

type Props = {
  liturgyDate: string;
  initial: LiturgicalSchedule | null;
  /** ISO 날짜 → 저장된 미사·전례 건수(달력 점 표시용) */
  savedDateCounts: Record<string, number>;
};

function isValidRoleField(v: string): boolean {
  const t = v.trim();
  if (!t) {
    return true;
  }
  return isYouthMemberName(t) || isValidCustomLiturgicalName(t);
}

function emptyFormState() {
  return {
    title: "",
    announcement_detail: "",
    role_commentator: "",
    role_reader_1: "",
    role_reader_2: "",
    role_gospel_acclamation: "",
    thurifer_main: "",
    thurifer_sub: "",
    organist: "",
  };
}

export function LiturgicalEditForm({
  liturgyDate,
  initial,
  savedDateCounts,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState(() =>
    initial
      ? {
          title: initial.title,
          announcement_detail: initial.announcement_detail,
          role_commentator: initial.role_commentator,
          role_reader_1: initial.role_reader_1,
          role_reader_2: initial.role_reader_2,
          role_gospel_acclamation: initial.role_gospel_acclamation,
          thurifer_main: initial.thurifer_main,
          thurifer_sub: initial.thurifer_sub,
          organist: initial.organist,
        }
      : emptyFormState()
  );

  const hasSavedSchedule = initial !== null;

  function onDateChange(nextIso: string) {
    router.push(`/liturgical/edit?date=${encodeURIComponent(nextIso)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const roleChecks: Array<[string, string]> = [
      ["해설", form.role_commentator],
      ["1독서", form.role_reader_1],
      ["2독서", form.role_reader_2],
      ["복음 환호송", form.role_gospel_acclamation],
      ["대복", form.thurifer_main],
      ["소복", form.thurifer_sub],
      ["반주", form.organist],
    ];
    for (const [label, val] of roleChecks) {
      if (!isValidRoleField(val)) {
        setMsg(
          `${label}: 멤버는 목록에서 선택하면 세례명까지 함께 저장됩니다. 직접 입력은 한글 성명만 2~4자로 적어 주세요.`
        );
        return;
      }
    }
    startTransition(async () => {
      const r = await upsertLiturgicalSchedule({
        liturgy_date: liturgyDate,
        title: form.title,
        announcement_detail: form.announcement_detail,
        role_commentator: form.role_commentator,
        role_reader_1: form.role_reader_1,
        role_reader_2: form.role_reader_2,
        role_gospel_acclamation: form.role_gospel_acclamation,
        thurifer_main: form.thurifer_main,
        thurifer_sub: form.thurifer_sub,
        conductor: FIXED_CONDUCTOR_NAME,
        organist: form.organist,
      });
      if (r.ok) {
        setMsg("저장했습니다.");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function onClickDelete() {
    if (!hasSavedSchedule) {
      return;
    }
    const step1 = window.confirm(
      "이 날짜에 저장된 미사·전례 정보를 삭제할까요?\n삭제하면 복구할 수 없습니다."
    );
    if (!step1) {
      return;
    }
    const step2 = window.confirm(
      "정말 정말 삭제할까요?\n메인·전례 안내 페이지에서도 더 이상 표시되지 않습니다."
    );
    if (!step2) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await deleteLiturgicalSchedule(liturgyDate);
      if (r.ok) {
        setForm(emptyFormState());
        setMsg("삭제했습니다.");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,34rem)_1fr] xl:grid-cols-[minmax(0,44rem)_1fr] 2xl:grid-cols-[minmax(0,52rem)_1fr] lg:items-start">
        <MassDatePicker
          value={liturgyDate}
          onChange={onDateChange}
          savedDateCounts={savedDateCounts}
        />
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--lit-ink-muted)]">
              제목
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              className={fieldClass}
              placeholder="선택 사항입니다"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--lit-ink-muted)]">
              추가 안내
            </label>
            <textarea
              value={form.announcement_detail}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  announcement_detail: e.target.value,
                }))
              }
              rows={8}
              className={fieldClass}
              placeholder="투표 마감, 연습 일정 등 자유롭게 입력"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--lit-ink-subtle)]">
          전례 봉사
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <MemberOrCustomInput
            label="해설"
            value={form.role_commentator}
            onChange={(v) =>
              setForm((f) => ({ ...f, role_commentator: v }))
            }
          />
          <MemberOrCustomInput
            label="1독서"
            value={form.role_reader_1}
            onChange={(v) => setForm((f) => ({ ...f, role_reader_1: v }))}
          />
          <MemberOrCustomInput
            label="2독서"
            value={form.role_reader_2}
            onChange={(v) => setForm((f) => ({ ...f, role_reader_2: v }))}
          />
          <MemberOrCustomInput
            label="복음 환호송"
            value={form.role_gospel_acclamation}
            onChange={(v) =>
              setForm((f) => ({ ...f, role_gospel_acclamation: v }))
            }
          />
        </div>
      </div>

      <div className="space-y-6 border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--lit-ink-subtle)]">
          복사단
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <MemberOrCustomInput
            label="대복"
            value={form.thurifer_main}
            onChange={(v) => setForm((f) => ({ ...f, thurifer_main: v }))}
          />
          <MemberOrCustomInput
            label="소복"
            value={form.thurifer_sub}
            onChange={(v) => setForm((f) => ({ ...f, thurifer_sub: v }))}
          />
        </div>
      </div>

      <div className="space-y-6 border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--lit-ink-subtle)]">
          지휘 · 반주
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--lit-ink-muted)]">
              지휘
            </label>
            <p className="mt-0.5 border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm text-[var(--lit-ink)]">
              {FIXED_CONDUCTOR_NAME}
            </p>
          </div>
          <MemberOrCustomInput
            label="반주"
            value={form.organist}
            onChange={(v) => setForm((f) => ({ ...f, organist: v }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 border border-[var(--lit-ink)] bg-[var(--lit-ink)] text-sm font-semibold text-[var(--lit-bg-elevated)] transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {hasSavedSchedule ? (
          <button
            type="button"
            disabled={pending}
            onClick={onClickDelete}
            className="h-12 shrink-0 rounded-lg border border-red-200/90 bg-[var(--lit-bg-elevated)] px-6 text-sm font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            이 미사 정보 삭제
          </button>
        ) : null}
      </div>

      {msg ? (
        <p className="text-center text-sm text-[var(--lit-ink-muted)]">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
