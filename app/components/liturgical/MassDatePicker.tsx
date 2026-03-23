"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { formatLocalYMD, parseLocalYMD } from "@/lib/date/local";

import "react-day-picker/style.css";

type Props = {
  value: string;
  onChange: (iso: string) => void;
};

export function MassDatePicker({ value, onChange }: Props) {
  const selected = (() => {
    try {
      const d = parseLocalYMD(value);
      if (Number.isNaN(d.getTime())) {
        return undefined;
      }
      return d;
    } catch {
      return undefined;
    }
  })();

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

  return (
    <div className="w-full rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_40px_rgb(15,23,42,0.08)] sm:p-8 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none">
      <p className="mb-5 text-lg font-semibold text-indigo-950 dark:text-amber-100">
        미사 날짜
      </p>
      <div className="flex w-full min-w-0 flex-col items-stretch overflow-x-auto">
        <DayPicker
          mode="single"
          locale={ko}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatLocalYMD(d));
            }
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
