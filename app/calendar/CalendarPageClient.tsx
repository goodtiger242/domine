"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { DayPicker } from "react-day-picker";
import {
  deleteCalendarEvent,
  insertCalendarEvent,
  type DomineCalendarEvent,
} from "@/app/actions/calendar";
import { formatLocalYMD, parseLocalYMD } from "@/lib/date/local";
import { formatMonthLabelKo } from "@/lib/date/month";
import { MonthNav } from "@/app/components/ui/MonthNav";
import { useRouter } from "next/navigation";

import "react-day-picker/style.css";

type Props = {
  year: number;
  month: number;
  events: DomineCalendarEvent[];
};

export function CalendarPageClient({ year, month, events }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(() => formatLocalYMD(new Date()));

  const monthDate = useMemo(
    () => new Date(year, month - 1, 1),
    [year, month]
  );

  const eventDates = useMemo(
    () =>
      [...new Set(events.map((e) => e.event_date))].map((s) => parseLocalYMD(s)),
    [events]
  );

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string) ?? "";
    const body = (fd.get("body") as string) ?? "";
    const event_date = (fd.get("event_date") as string) ?? formDate;

    startTransition(async () => {
      const r = await insertCalendarEvent({
        event_date,
        title,
        body,
      });
      if (r.ok) {
        setMsg("저장했습니다.");
        router.refresh();
        e.currentTarget.reset();
        setFormDate(formatLocalYMD(new Date()));
      } else {
        setMsg(r.error);
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("이 일정을 삭제할까요?")) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await deleteCalendarEvent(id);
      if (r.ok) {
        setMsg("삭제했습니다.");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  return (
    <div className="space-y-10">
      <MonthNav year={year} month={month} basePath="/calendar" />

      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
        <div className="[&_.rdp-month_caption]:hidden [&_.rdp-nav]:hidden rounded-2xl border border-stone-200/90 bg-white/90 p-4 shadow-sm dark:border-stone-700 dark:bg-stone-950/60">
          <DayPicker
            mode="single"
            locale={ko}
            month={monthDate}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{
              hasEvent:
                "font-semibold text-[#1a2f4a] dark:text-amber-200 relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-500 dark:after:bg-amber-400",
            }}
          />
          <p className="mt-1 text-center text-xs text-stone-500 dark:text-stone-500">
            표시된 달의 날짜에 점이 있으면 일정이 있습니다.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <h2 className="text-sm font-semibold text-[#1a2f4a] dark:text-amber-200">
            {formatMonthLabelKo(year, month)} 일정
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              등록된 일정이 없습니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/90 p-3 dark:border-stone-700 dark:bg-stone-900/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-stone-500 dark:text-stone-500">
                        {format(parseLocalYMD(ev.event_date), "M월 d일 (EEE)", {
                          locale: ko,
                        })}
                      </p>
                      <p className="font-medium text-stone-900 dark:text-stone-100">
                        {ev.title || "(제목 없음)"}
                      </p>
                      {ev.body.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-400">
                          {ev.body}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(ev.id)}
                      disabled={pending}
                      className="shrink-0 text-xs text-red-600 underline underline-offset-2 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg rounded-2xl border border-stone-200/90 bg-white/80 p-6 shadow-sm dark:border-stone-700 dark:bg-stone-950/50">
        <h2 className="text-sm font-semibold text-[#1a2f4a] dark:text-amber-200">
          일정 추가
        </h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-500">
          로그인 없이 누구나 추가할 수 있습니다.
        </p>
        <form onSubmit={onAdd} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
              날짜
            </label>
            <input
              name="event_date"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
              제목
            </label>
            <input
              name="title"
              type="text"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950"
              placeholder="예: 청년회 모임"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
              내용
            </label>
            <textarea
              name="body"
              rows={3}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950"
              placeholder="선택"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-full bg-[#1a2f4a] text-sm font-semibold text-white shadow-md transition hover:bg-[#142340] disabled:opacity-50 dark:bg-amber-100 dark:text-stone-900 dark:hover:bg-white"
          >
            {pending ? "저장 중…" : "일정 저장"}
          </button>
        </form>
        {msg ? (
          <p className="mt-3 text-center text-sm text-stone-600 dark:text-stone-400">
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
