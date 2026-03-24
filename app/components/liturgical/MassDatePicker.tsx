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
    "relative font-semibold text-[var(--lit-ink)] after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:z-[1] after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--lit-gold)] after:shadow-[0_0_0_1px_rgba(255,252,246,0.5)]";

  const dotTwo =
    "relative font-semibold text-[var(--lit-ink)] after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:z-[1] after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--lit-gold)] after:shadow-[7px_0_0_0_var(--lit-gold-muted),0_0_0_1px_rgba(255,252,246,0.4)]";

  return (
    <div className="w-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-6 sm:p-8">
      <p className="mb-5 text-lg font-semibold text-[var(--lit-ink)]">
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
            today: "font-bold text-[var(--lit-ink)]",
            selected:
              "bg-[var(--lit-ink)] text-[var(--lit-bg-elevated)] rounded-sm",
            root: "w-full max-w-none",
            month_caption:
              "flex justify-center pt-1 relative items-center mb-3 text-xl font-semibold sm:text-2xl",
            chevron: "size-7 fill-[var(--lit-accent)] sm:size-8",
            weekdays: "text-sm font-semibold sm:text-base",
            day: "text-[1.05rem] sm:text-[1.125rem]",
          }}
        />
      </div>
      {label ? (
        <p className="mt-4 text-center text-sm text-[var(--lit-ink-muted)] sm:text-left">
          선택: {label}
        </p>
      ) : null}
    </div>
  );
}
