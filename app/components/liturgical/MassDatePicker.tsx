"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { formatLocalYMD, parseLocalYMD } from "@/lib/date/local";

import "react-day-picker/style.css";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  /** ISO 날짜 → 저장된 미사·전례 건수. 1이면 점 1개, 2 이상이면 점 2개 */
  savedDateCounts?: Record<string, number>;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthFromValue(value: string): Date {
  try {
    const d = parseLocalYMD(value);
    if (Number.isNaN(d.getTime())) {
      return startOfMonth(new Date());
    }
    return startOfMonth(d);
  } catch {
    return startOfMonth(new Date());
  }
}

export function MassDatePicker({
  value,
  onChange,
  savedDateCounts = {},
}: Props) {
  const selected = useMemo(() => {
    try {
      const d = parseLocalYMD(value);
      if (Number.isNaN(d.getTime())) {
        return undefined;
      }
      return d;
    } catch {
      return undefined;
    }
  }, [value]);

  /** 표시 중인 달 — ‹ › 로 넘길 때 필수(비제어 시 월이 안 바뀌는 경우 방지) */
  const [month, setMonth] = useState(() => monthFromValue(value));

  useEffect(() => {
    setMonth(monthFromValue(value));
  }, [value]);

  const countFor = useCallback(
    (d: Date) => savedDateCounts[formatLocalYMD(d)] ?? 0,
    [savedDateCounts]
  );

  const modifiers = useMemo(
    () => ({
      litSavedOne: (d: Date) => countFor(d) === 1,
      litSavedTwo: (d: Date) => countFor(d) >= 2,
    }),
    [countFor]
  );

  const label = (() => {
    try {
      const d = parseLocalYMD(value);
      if (Number.isNaN(d.getTime())) {
        return "";
      }
      return format(d, "yyyy년 M월 d일 EEEE", { locale: ko });
    } catch {
      return "";
    }
  })();

  const dotOne =
    "relative font-semibold text-indigo-950 dark:text-amber-200 after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:z-[1] after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-amber-500 after:shadow-[0_0_0_1px_rgba(255,255,255,0.35)] dark:after:bg-amber-400 dark:after:shadow-[0_0_0_1px_rgba(0,0,0,0.2)]";

  const dotTwo =
    "relative font-semibold text-indigo-950 dark:text-amber-200 after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:z-[1] after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-amber-500 after:shadow-[7px_0_0_0_rgb(245,158,11),0_0_0_1px_rgba(255,255,255,0.35)] dark:after:bg-amber-400 dark:after:shadow-[7px_0_0_0_rgb(251,191,36),0_0_0_1px_rgba(0,0,0,0.2)]";

  return (
    <div className="w-full rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_40px_rgb(15,23,42,0.08)] sm:p-8 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none">
      <p className="mb-5 text-lg font-semibold text-indigo-950 dark:text-amber-100">
        미사 날짜
      </p>
      <div className="flex w-full min-w-0 flex-col items-stretch overflow-x-auto">
        <DayPicker
          mode="single"
          locale={ko}
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatLocalYMD(d));
            }
          }}
          modifiers={modifiers}
          modifiersClassNames={{
            litSavedOne: dotOne,
            litSavedTwo: dotTwo,
          }}
          className="rdp-mass-calendar w-full min-w-0 max-w-none justify-center"
          classNames={{
            today: "font-bold text-indigo-950 dark:text-amber-200",
            selected:
              "bg-indigo-950 text-white rounded-xl dark:bg-amber-100 dark:text-slate-900",
            root: "w-full max-w-none",
            month_caption:
              "flex justify-center pt-1 relative items-center mb-3 text-xl font-semibold sm:text-2xl",
            chevron:
              "size-7 fill-indigo-950 sm:size-8 dark:fill-amber-200",
            weekdays: "text-sm font-semibold sm:text-base",
            day: "text-[1.05rem] sm:text-[1.125rem]",
          }}
        />
      </div>
      {label ? (
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400 sm:text-left">
          선택: {label}
        </p>
      ) : null}
    </div>
  );
}
