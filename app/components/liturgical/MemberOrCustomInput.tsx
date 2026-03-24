"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

  /** 값이 비어 있을 때만 탭 상태 사용(직접 입력 + 빈 칸). 값이 있으면 value에 따라 member/custom 고정 */
  const [emptyTab, setEmptyTab] = useState<"member" | "custom">("member");

  const mode = useMemo((): "member" | "custom" => {
    const v = value.trim();
    if (v) {
      return isYouthMemberName(value) ? "member" : "custom";
    }
    return emptyTab;
  }, [value, emptyTab]);

  const [customHint, setCustomHint] = useState<string | null>(null);

  const hadValueRef = useRef(false);
  useEffect(() => {
    const nonEmpty = value.trim().length > 0;
    if (!nonEmpty && hadValueRef.current) {
      queueMicrotask(() => setEmptyTab("member"));
    }
    hadValueRef.current = nonEmpty;
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--lit-ink-muted)]">
          {label}
        </label>
        <div
          className="inline-flex rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] p-0.5"
          role="group"
          aria-label={`${label} 입력 방식`}
        >
          <button
            type="button"
            onClick={() => {
              setEmptyTab("member");
              setCustomHint(null);
              if (!isYouthMemberName(value)) {
                onChange("");
              }
            }}
            className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] ${
              mode === "member"
                ? "bg-[var(--lit-bg-elevated)] text-[var(--lit-ink)] ring-1 ring-[var(--lit-border)]"
                : "text-[var(--lit-ink-subtle)]"
            }`}
          >
            멤버 선택
          </button>
          <button
            type="button"
            onClick={() => setEmptyTab("custom")}
            className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] ${
              mode === "custom"
                ? "bg-[var(--lit-bg-elevated)] text-[var(--lit-ink)] ring-1 ring-[var(--lit-border)]"
                : "text-[var(--lit-ink-subtle)]"
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
          className="mt-0.5 w-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-3 py-2.5 text-sm text-[var(--lit-ink)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
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
            className="mt-0.5 w-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-3 py-2.5 text-sm text-[var(--lit-ink)] outline-none transition placeholder:text-[var(--lit-ink-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] aria-invalid:border-[var(--lit-ink)]"
          />
          <p className="text-[11px] leading-snug text-[var(--lit-ink-subtle)]">
            직접 입력은 <span className="font-medium">한글 성명만 2~4자</span>
            입니다. &quot;최선호 프란치스코&quot;처럼 세례명을 붙이면 저장할 수
            없어요.
          </p>
          {customHint ? (
            <p className="text-[11px] font-medium text-[var(--lit-gold)]">
              {customHint}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
