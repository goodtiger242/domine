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
    <div className="rounded-2xl border border-stone-200/90 bg-white/90 p-4 shadow-sm dark:border-stone-700 dark:bg-stone-950/60">
      <p className="mb-3 text-sm font-medium text-[#1a2f4a] dark:text-amber-100">
        미사 날짜
      </p>
      <div className="flex flex-col items-center sm:items-start">
        <DayPicker
          mode="single"
          locale={ko}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatLocalYMD(d));
            }
          }}
          className="rdp-modern [--rdp-accent-color:#1a2f4a] [--rdp-background-color:#f5f0e8] dark:[--rdp-accent-color:#fcd34d] dark:[--rdp-background-color:#1c1917]"
          classNames={{
            today: "font-bold text-[#1a2f4a] dark:text-amber-200",
            selected:
              "bg-[#1a2f4a] text-white rounded-lg dark:bg-amber-100 dark:text-stone-900",
            root: "w-full",
            month_caption: "flex justify-center pt-1 relative items-center mb-2",
            chevron: "fill-[#1a2f4a] dark:fill-amber-200",
          }}
        />
      </div>
      {label ? (
        <p className="mt-3 text-center text-xs text-stone-500 dark:text-stone-400 sm:text-left">
          선택: {label}
        </p>
      ) : null}
    </div>
  );
}
