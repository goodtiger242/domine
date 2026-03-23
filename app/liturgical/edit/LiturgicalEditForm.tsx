"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  upsertLiturgicalSchedule,
  type LiturgicalSchedule,
} from "@/app/actions/liturgical";

const fieldClass =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-[#1a2f4a]/30 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100";

type Props = {
  weekSunday: string;
  initial: LiturgicalSchedule | null;
  weekOptions: string[];
};

export function LiturgicalEditForm({ weekSunday, initial, weekOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const defaults = useMemo(
    () => ({
      week_sunday: weekSunday,
      title: initial?.title ?? "",
      announcement_detail: initial?.announcement_detail ?? "",
      role_commentator: initial?.role_commentator ?? "",
      role_reader_1: initial?.role_reader_1 ?? "",
      role_reader_2: initial?.role_reader_2 ?? "",
      role_gospel_acclamation: initial?.role_gospel_acclamation ?? "",
      thurifer_main: initial?.thurifer_main ?? "",
      thurifer_sub: initial?.thurifer_sub ?? "",
      conductor: initial?.conductor ?? "",
      organist: initial?.organist ?? "",
    }),
    [initial, weekSunday]
  );

  const [form, setForm] = useState(defaults);

  function onWeekChange(next: string) {
    router.push(`/liturgical/edit?week=${encodeURIComponent(next)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await upsertLiturgicalSchedule(form);
      if (r.ok) {
        setMsg("저장했습니다. 메인에서 확인해 주세요.");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
          적용 주일
        </label>
        <select
          value={weekSunday}
          onChange={(e) => onWeekChange(e.target.value)}
          className={fieldClass}
        >
          {weekOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-500">
          날짜는 자동으로 그 주의 주일로 맞춰 저장됩니다.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
          제목 · 한 줄 공지
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={fieldClass}
          placeholder="예: 03월 29일 주님 수난 성지 주일 미사 투표"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
          추가 안내 (투표 마감, 일정 등)
        </label>
        <textarea
          value={form.announcement_detail}
          onChange={(e) =>
            setForm((f) => ({ ...f, announcement_detail: e.target.value }))
          }
          rows={8}
          className={fieldClass}
          placeholder="여러 줄로 입력 가능합니다."
        />
      </div>

      <fieldset className="rounded-xl border border-stone-200 bg-white/60 p-4 dark:border-stone-700 dark:bg-stone-950/40">
        <legend className="px-1 text-sm font-semibold text-[#1a2f4a] dark:text-amber-200">
          전례 봉사
        </legend>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              해설
            </label>
            <input
              type="text"
              value={form.role_commentator}
              onChange={(e) =>
                setForm((f) => ({ ...f, role_commentator: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              1독서
            </label>
            <input
              type="text"
              value={form.role_reader_1}
              onChange={(e) =>
                setForm((f) => ({ ...f, role_reader_1: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              2독서
            </label>
            <input
              type="text"
              value={form.role_reader_2}
              onChange={(e) =>
                setForm((f) => ({ ...f, role_reader_2: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-stone-200 bg-white/60 p-4 dark:border-stone-700 dark:bg-stone-950/40">
        <legend className="px-1 text-sm font-semibold text-[#1a2f4a] dark:text-amber-200">
          복음 환호송
        </legend>
        <input
          type="text"
          value={form.role_gospel_acclamation}
          onChange={(e) =>
            setForm((f) => ({ ...f, role_gospel_acclamation: e.target.value }))
          }
          className={fieldClass}
        />
      </fieldset>

      <fieldset className="rounded-xl border border-stone-200 bg-white/60 p-4 dark:border-stone-700 dark:bg-stone-950/40">
        <legend className="px-1 text-sm font-semibold text-[#1a2f4a] dark:text-amber-200">
          복사단
        </legend>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              대복
            </label>
            <input
              type="text"
              value={form.thurifer_main}
              onChange={(e) =>
                setForm((f) => ({ ...f, thurifer_main: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              소복
            </label>
            <input
              type="text"
              value={form.thurifer_sub}
              onChange={(e) =>
                setForm((f) => ({ ...f, thurifer_sub: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-stone-200 bg-white/60 p-4 dark:border-stone-700 dark:bg-stone-950/40">
        <legend className="px-1 text-sm font-semibold text-[#1a2f4a] dark:text-amber-200">
          지휘 · 반주
        </legend>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              지휘
            </label>
            <input
              type="text"
              value={form.conductor}
              onChange={(e) =>
                setForm((f) => ({ ...f, conductor: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-stone-600 dark:text-stone-400">
              반주
            </label>
            <input
              type="text"
              value={form.organist}
              onChange={(e) =>
                setForm((f) => ({ ...f, organist: e.target.value }))
              }
              className={fieldClass}
            />
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-full bg-[#1a2f4a] text-sm font-medium text-white transition hover:bg-[#142340] disabled:opacity-50 dark:bg-amber-100 dark:text-stone-900 dark:hover:bg-white"
      >
        {pending ? "저장 중…" : "저장"}
      </button>

      {msg ? (
        <p className="text-center text-sm text-stone-600 dark:text-stone-400">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
