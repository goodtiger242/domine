"use client";

import { useEffect, useId, useState } from "react";
import {
  formatYouthMemberDisplay,
  isYouthMemberName,
  isValidCustomLiturgicalName,
  resolveYouthMemberLegalName,
  sortedYouthMemberLegalNames,
} from "@/lib/constants/youth-members";

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
};

/** 직접 입력: 공백 제거 후 한글만, 최대 4자 — 세례명·띄어쓰기 입력 방지 */
function sanitizeCustomInput(raw: string): string {
  const noSpace = raw.replace(/\s/g, "");
  return noSpace.replace(/[^가-힣]/g, "").slice(0, 4);
}

export function MemberOrCustomInput({ label, value, onChange }: Props) {
  const baseId = useId();
  const members = sortedYouthMemberLegalNames();
  const memberSelectValue =
    isYouthMemberName(value) ? (resolveYouthMemberLegalName(value) ?? "") : "";

  const [mode, setMode] = useState<"member" | "custom">(() =>
    !value.trim()
      ? "member"
      : isYouthMemberName(value)
        ? "member"
        : "custom"
  );

  const [customHint, setCustomHint] = useState<string | null>(null);

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
              setCustomHint(null);
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
          value={memberSelectValue}
          onChange={(e) => {
            const legal = e.target.value;
            if (!legal) {
              onChange("");
              return;
            }
            onChange(formatYouthMemberDisplay(legal));
          }}
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
        <div className="space-y-1.5">
          <input
            id={`${baseId}-txt`}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={value}
            maxLength={4}
            onChange={(e) => {
              const raw = e.target.value;
              const parts = raw.trim().split(/\s+/).filter(Boolean);
              if (parts.length > 1) {
                setCustomHint(
                  "띄어쓰기 없이 성명만 입력해 주세요. 세례명은 넣지 마세요."
                );
                onChange(sanitizeCustomInput(parts[0] ?? ""));
                return;
              }
              const hangul = sanitizeCustomInput(raw);
              if (hangul.length > 4) {
                setCustomHint(
                  "성명은 한글 2~4자만 입력할 수 있어요. 세례명은 적지 마세요."
                );
                onChange(hangul.slice(0, 4));
                return;
              }
              setCustomHint(null);
              onChange(hangul);
            }}
            onBlur={() => {
              const t = value.trim();
              if (!t) {
                setCustomHint(null);
                return;
              }
              if (!isValidCustomLiturgicalName(t)) {
                setCustomHint(
                  "청년회 멤버는 위에서 선택하고, 직접 입력은 한글 성명만 2~4자로 적어 주세요."
                );
              } else {
                setCustomHint(null);
              }
            }}
            placeholder="예: 홍길동"
            aria-invalid={value.length > 0 && !isValidCustomLiturgicalName(value)}
            className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-950/35 focus:ring-2 focus:ring-indigo-950/12 aria-invalid:border-amber-600/80 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-500">
            직접 입력은 <span className="font-medium">한글 성명만 2~4자</span>
            입니다. &quot;최선호 프란치스코&quot;처럼 세례명을 붙이면 저장할 수
            없어요.
          </p>
          {customHint ? (
            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200/95">
              {customHint}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
