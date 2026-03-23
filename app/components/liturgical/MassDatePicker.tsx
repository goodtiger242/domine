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
    <div className="w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_40px_rgb(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none xl:max-w-none">
      <p className="mb-4 text-base font-semibold text-indigo-950 dark:text-amber-100">
        미사 날짜
      </p>
      <div className="flex flex-col items-stretch">
        <DayPicker
          mode="single"
          locale={ko}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatLocalYMD(d));
            }
          }}
          className="rdp-mass-calendar w-full [--rdp-accent-color:#1e1b4b] [--rdp-background-color:#f8fafc] [--rdp-cell-size:3rem] sm:[--rdp-cell-size:3.5rem] [--rdp-day-height:3rem] [--rdp-day-width:3rem] dark:[--rdp-accent-color:#fcd34d] dark:[--rdp-background-color:#0f172a]"
          classNames={{
            today: "font-bold text-indigo-950 dark:text-amber-200",
            selected:
              "bg-indigo-950 text-white rounded-xl dark:bg-amber-100 dark:text-slate-900",
            root: "w-full max-w-none text-base",
            month_caption:
              "flex justify-center pt-1 relative items-center mb-2 text-lg font-semibold",
            chevron: "size-6 fill-indigo-950 dark:fill-amber-200",
            weekdays: "text-sm font-medium",
            day: "text-base",
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
