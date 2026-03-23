"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  upsertLiturgicalSchedule,
  type LiturgicalSchedule,
} from "@/app/actions/liturgical";
import { MassDatePicker } from "@/app/components/liturgical/MassDatePicker";
import { MemberOrCustomInput } from "@/app/components/liturgical/MemberOrCustomInput";
import { FIXED_CONDUCTOR_NAME } from "@/lib/constants/liturgical";

const fieldClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-950/35 focus:ring-2 focus:ring-indigo-950/12 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

type Props = {
  liturgyDate: string;
  initial: LiturgicalSchedule | null;
};

export function LiturgicalEditForm({ liturgyDate, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    announcement_detail: initial?.announcement_detail ?? "",
    role_commentator: initial?.role_commentator ?? "",
    role_reader_1: initial?.role_reader_1 ?? "",
    role_reader_2: initial?.role_reader_2 ?? "",
    role_gospel_acclamation: initial?.role_gospel_acclamation ?? "",
    thurifer_main: initial?.thurifer_main ?? "",
    thurifer_sub: initial?.thurifer_sub ?? "",
    organist: initial?.organist ?? "",
  });

  function onDateChange(nextIso: string) {
    router.push(`/liturgical/edit?date=${encodeURIComponent(nextIso)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
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
        setMsg("저장했습니다. 메인에서 확인해 주세요.");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,34rem)_1fr] xl:grid-cols-[minmax(0,44rem)_1fr] 2xl:grid-cols-[minmax(0,52rem)_1fr] lg:items-start">
        <MassDatePicker value={liturgyDate} onChange={onDateChange} />
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
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
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
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

      <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-950 dark:text-amber-200">
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

      <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-950 dark:text-amber-200">
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

      <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-950 dark:text-amber-200">
          지휘 · 반주
        </h2>
        <p className="rounded-xl border border-indigo-950/10 bg-indigo-950/[0.03] px-4 py-3 text-sm text-slate-700 dark:border-amber-200/20 dark:bg-slate-900/50 dark:text-slate-300">
          지휘는 <span className="font-semibold text-indigo-950 dark:text-amber-100">{FIXED_CONDUCTOR_NAME}</span>
          로 고정입니다.
        </p>
        <div className="max-w-md">
          <MemberOrCustomInput
            label="반주"
            value={form.organist}
            onChange={(v) => setForm((f) => ({ ...f, organist: v }))}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-indigo-950 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-900 disabled:opacity-50 dark:bg-amber-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {pending ? "저장 중…" : "저장"}
      </button>

      {msg ? (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
