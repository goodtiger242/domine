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
      startTransition(() => {
        router.push(`/calendar?year=${y}&month=${m}`, { scroll: false });
      });
    },
    [router, startTransition]
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
        <div className="[&_.rdp-month_caption]:hidden w-full max-w-md rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 shadow-[var(--lit-paper-shadow)]">
          <DayPicker
            key={`${year}-${month}`}
            mode="single"
            locale={ko}
            month={monthDate}
            onMonthChange={onCalendarMonthChange}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{
              hasEvent:
                "relative font-semibold text-[var(--lit-ink)] after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-[var(--lit-gold)]",
            }}
            className="w-full [--rdp-cell-size:2.75rem] sm:[--rdp-cell-size:3rem] text-base"
          />
          <p className="mt-2 text-center text-xs text-[var(--lit-ink-subtle)]">
            표시된 달의 날짜에 점이 있으면 일정이 있습니다.
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <h2 className="text-base font-bold text-[var(--lit-ink)]">
            {formatMonthLabelKo(year, month)} 일정
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--lit-ink-muted)]">
              등록된 일정이 없습니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4 shadow-[var(--lit-paper-shadow)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--lit-ink-subtle)]">
                        {format(parseLocalYMD(ev.event_date), "M월 d일 (EEE)", {
                          locale: ko,
                        })}
                      </p>
                      <p className="font-semibold text-[var(--lit-ink)]">
                        {ev.title || "(제목 없음)"}
                      </p>
                      {ev.body.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--lit-ink-muted)]">
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
                        className="rounded-lg border border-[var(--lit-border-strong)] bg-[var(--lit-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--lit-ink)] transition hover:border-[var(--lit-gold)] hover:text-[var(--lit-gold)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(ev.id)}
                        disabled={pending}
                        className="rounded-lg border border-red-200/90 bg-[var(--lit-bg)] px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
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

      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-7 shadow-[var(--lit-paper-shadow)]">
        <h2 className="text-base font-bold text-[var(--lit-ink)]">
          일정 추가
        </h2>
        <form onSubmit={onAdd} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--lit-ink-muted)]">
              날짜
            </label>
            <input
              name="event_date"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--lit-ink-muted)]">
              제목
            </label>
            <input
              name="title"
              type="text"
              className="mt-1 w-full rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
              placeholder="예: 청년회 모임"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--lit-ink-muted)]">
              내용
            </label>
            <textarea
              name="body"
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
              placeholder="선택"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-lg border border-[var(--lit-border-strong)] bg-[var(--lit-ink)] text-sm font-semibold text-[var(--lit-bg-elevated)] shadow-[var(--lit-paper-shadow)] transition hover:bg-[var(--lit-accent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
          >
            {pending ? "저장 중…" : "일정 저장"}
          </button>
        </form>
        {msg ? (
          <p className="mt-3 text-center text-sm text-[var(--lit-ink-muted)]">
            {msg}
          </p>
        ) : null}
      </div>

      {editDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--lit-ink)]/45 p-4 backdrop-blur-[2px] sm:items-center sm:p-6"
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="calendar-edit-title"
              className="text-lg font-bold text-[var(--lit-ink)]"
            >
              일정 수정
            </h3>
            <p className="mt-1 text-sm text-[var(--lit-ink-muted)]">
              날짜·제목·내용을 수정한 뒤 저장하세요.
            </p>
            <form onSubmit={onSaveEdit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-date"
                  className="text-sm font-medium text-[var(--lit-ink-muted)]"
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
                  className="mt-1 w-full rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-title"
                  className="text-sm font-medium text-[var(--lit-ink-muted)]"
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
                  className="mt-1 w-full rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
                  placeholder="예: 청년회 모임"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-body"
                  className="text-sm font-medium text-[var(--lit-ink-muted)]"
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
                  className="mt-1 w-full resize-y rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
                  placeholder="일정 상세 내용"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setEditDraft(null)}
                  disabled={pending}
                  className="h-11 rounded-lg border border-[var(--lit-border)] px-5 text-sm font-medium text-[var(--lit-ink-muted)] transition hover:bg-[var(--lit-bg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-11 rounded-lg border border-[var(--lit-border-strong)] bg-[var(--lit-ink)] px-6 text-sm font-semibold text-[var(--lit-bg-elevated)] shadow-[var(--lit-paper-shadow)] transition hover:bg-[var(--lit-accent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
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
