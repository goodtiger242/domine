"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { DayPicker } from "react-day-picker";
import {
  deleteCalendarEvent,
  insertCalendarEvent,
  updateCalendarEvent,
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
  /** 편집 모달 — 제목·내용 수정 */
  const [editDraft, setEditDraft] = useState<{
    id: string;
    event_date: string;
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    if (!editDraft) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        setEditDraft(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editDraft, pending]);

  const monthDate = useMemo(
    () => new Date(year, month - 1, 1),
    [year, month]
  );

  const eventDates = useMemo(
    () =>
      [...new Set(events.map((e) => e.event_date))].map((s) => parseLocalYMD(s)),
    [events]
  );

  const onCalendarMonthChange = useCallback(
    (d: Date) => {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      router.push(`/calendar?year=${y}&month=${m}`, { scroll: false });
    },
    [router]
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

  function onSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editDraft) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await updateCalendarEvent({
        id: editDraft.id,
        event_date: editDraft.event_date,
        title: editDraft.title,
        body: editDraft.body,
      });
      if (r.ok) {
        setMsg("수정했습니다.");
        setEditDraft(null);
        router.refresh();
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
        <div className="[&_.rdp-month_caption]:hidden w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgb(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none">
          <DayPicker
            key={`${year}-${month}`}
            mode="single"
            locale={ko}
            month={monthDate}
            onMonthChange={onCalendarMonthChange}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{
              hasEvent:
                "font-semibold text-indigo-950 dark:text-amber-200 relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-500 dark:after:bg-amber-400",
            }}
            className="w-full [--rdp-cell-size:2.75rem] sm:[--rdp-cell-size:3rem] text-base"
          />
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-500">
            표시된 달의 날짜에 점이 있으면 일정이 있습니다.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <h2 className="text-base font-bold text-indigo-950 dark:text-amber-200">
            {formatMonthLabelKo(year, month)} 일정
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              등록된 일정이 없습니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {format(parseLocalYMD(ev.event_date), "M월 d일 (EEE)", {
                          locale: ko,
                        })}
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {ev.title || "(제목 없음)"}
                      </p>
                      {ev.body.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
                          {ev.body}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditDraft({
                            id: ev.id,
                            event_date: ev.event_date,
                            title: ev.title,
                            body: ev.body,
                          })
                        }
                        disabled={pending}
                        className="rounded-full border border-indigo-900/25 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-950 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50 dark:border-amber-200/30 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(ev.id)}
                        disabled={pending}
                        className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200/90 bg-white/90 p-7 shadow-[0_8px_30px_rgb(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-950/50 dark:shadow-none">
        <h2 className="text-base font-bold text-indigo-950 dark:text-amber-200">
          일정 추가
        </h2>
        <form onSubmit={onAdd} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              날짜
            </label>
            <input
              name="event_date"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              제목
            </label>
            <input
              name="title"
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              placeholder="예: 청년회 모임"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              내용
            </label>
            <textarea
              name="body"
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              placeholder="선택"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-full bg-indigo-950 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-900 disabled:opacity-50 dark:bg-amber-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {pending ? "저장 중…" : "일정 저장"}
          </button>
        </form>
        {msg ? (
          <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400">
            {msg}
          </p>
        ) : null}
      </div>

      {editDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center sm:p-6"
          role="presentation"
          onClick={() => {
            if (!pending) {
              setEditDraft(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-edit-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="calendar-edit-title"
              className="text-lg font-bold text-indigo-950 dark:text-amber-100"
            >
              일정 수정
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              날짜·제목·내용을 수정한 뒤 저장하세요.
            </p>
            <form onSubmit={onSaveEdit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-date"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  날짜
                </label>
                <input
                  id="edit-date"
                  type="date"
                  required
                  value={editDraft.event_date}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, event_date: e.target.value } : d
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-title"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  제목
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={editDraft.title}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, title: e.target.value } : d
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                  placeholder="예: 청년회 모임"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-body"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  내용
                </label>
                <textarea
                  id="edit-body"
                  value={editDraft.body}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, body: e.target.value } : d
                    )
                  }
                  rows={5}
                  className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed dark:border-slate-600 dark:bg-slate-900"
                  placeholder="일정 상세 내용"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setEditDraft(null)}
                  disabled={pending}
                  className="h-11 rounded-full border border-slate-200 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-11 rounded-full bg-indigo-950 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-900 disabled:opacity-50 dark:bg-amber-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  {pending ? "저장 중…" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
