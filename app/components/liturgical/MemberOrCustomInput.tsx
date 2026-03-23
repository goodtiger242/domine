"use client";

import { useEffect, useId, useState } from "react";
import {
  isYouthMemberName,
  sortedYouthMembers,
} from "@/lib/constants/youth-members";

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
};

export function MemberOrCustomInput({ label, value, onChange }: Props) {
  const baseId = useId();
  const members = sortedYouthMembers();

  const [mode, setMode] = useState<"member" | "custom">(() =>
    !value.trim()
      ? "member"
      : isYouthMemberName(value)
        ? "member"
        : "custom"
  );

  useEffect(() => {
    if (!value.trim()) {
      setMode("member");
      return;
    }
    if (isYouthMemberName(value)) {
      setMode("member");
    } else {
      setMode("custom");
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </label>
        <div
          className="inline-flex rounded-full bg-slate-200/80 p-0.5 dark:bg-slate-800"
          role="group"
          aria-label={`${label} 입력 방식`}
        >
          <button
            type="button"
            onClick={() => {
              setMode("member");
              if (!isYouthMemberName(value)) {
                onChange("");
              }
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs ${
              mode === "member"
                ? "bg-white text-indigo-950 shadow-sm dark:bg-slate-950 dark:text-amber-100"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            멤버 선택
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs ${
              mode === "custom"
                ? "bg-white text-indigo-950 shadow-sm dark:bg-slate-950 dark:text-amber-100"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            직접 입력
          </button>
        </div>
      </div>

      {mode === "member" ? (
        <select
          id={`${baseId}-sel`}
          value={isYouthMemberName(value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-950/35 focus:ring-2 focus:ring-indigo-950/12 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">선택하세요</option>
          {members.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`${baseId}-txt`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="이름을 입력하세요"
          className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-950/35 focus:ring-2 focus:ring-indigo-950/12 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
      )}
    </div>
  );
}
