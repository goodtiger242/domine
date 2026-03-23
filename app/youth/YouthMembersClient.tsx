"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  feastDayDateOnly,
  type YouthProfile,
} from "@/lib/constants/youth-profiles";

const STORAGE_KEY = "domine-youth-profiles-v1";

type Props = {
  initialProfiles: YouthProfile[];
};

function mergeByLegalName(
  defaults: YouthProfile[],
  stored: YouthProfile[]
): YouthProfile[] {
  const map = new Map(stored.map((p) => [p.legalName, p]));
  return defaults.map((d) => {
    const s = map.get(d.legalName);
    if (!s) {
      return d;
    }
    const merged = { ...d, ...s, legalName: d.legalName };
    return {
      ...merged,
      feastDay: feastDayDateOnly(merged.feastDay),
    };
  });
}

export function YouthMembersClient({ initialProfiles }: Props) {
  const [profiles, setProfiles] = useState<YouthProfile[]>(initialProfiles);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<YouthProfile[]>(initialProfiles);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YouthProfile[];
        if (Array.isArray(parsed)) {
          setProfiles(mergeByLegalName(initialProfiles, parsed));
        }
      }
    } catch {
      /* ignore */
    }
  }, [initialProfiles]);

  const startEdit = useCallback(() => {
    setDraft(structuredClone(profiles));
    setIsEditing(true);
  }, [profiles]);

  const cancelEdit = useCallback(() => {
    setDraft(structuredClone(profiles));
    setIsEditing(false);
  }, [profiles]);

  const saveEdit = useCallback(() => {
    const next = draft.map((p) => ({
      ...p,
      feastDay: feastDayDateOnly(p.feastDay),
    }));
    setProfiles(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setIsEditing(false);
  }, [draft]);

  const updateDraft = useCallback((index: number, patch: Partial<YouthProfile>) => {
    setDraft((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) {
        return prev;
      }
      next[index] = { ...row, ...patch };
      return next;
    });
  }, []);

  const rows = isEditing ? draft : profiles;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-indigo-950 dark:text-amber-50">
            청년회 멤버
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className="h-10 rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="h-10 rounded-full bg-indigo-950 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-900 dark:bg-amber-100 dark:text-slate-900 dark:hover:bg-white"
              >
                저장
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="h-10 rounded-full border border-indigo-900/25 bg-white px-6 text-sm font-semibold text-indigo-950 shadow-sm transition hover:bg-indigo-50 dark:border-amber-200/30 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
            >
              편집
            </button>
          )}
        </div>
      </div>

      <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p, index) => (
          <li
            key={p.legalName}
            className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_8px_30px_rgb(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none"
          >
            <div className="mx-auto mb-4 w-full max-w-[220px]">
              {p.imageSrc?.trim() ? (
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-200 ring-2 ring-white/80 dark:bg-slate-800 dark:ring-slate-700/80">
                  <Image
                    src={p.imageSrc}
                    alt={`${p.legalName} 사진`}
                    fill
                    sizes="220px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100/90 to-amber-50/80 ring-2 ring-white/80 dark:from-indigo-950/80 dark:to-slate-900 dark:ring-slate-700/80">
                  <span className="text-4xl font-bold text-indigo-950/40 dark:text-amber-200/50">
                    {p.legalName.slice(0, 1)}
                  </span>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    성명
                  </label>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {p.legalName}
                  </p>
                </div>
                <Field
                  label="세례명"
                  value={p.baptismalNameKo}
                  onChange={(v) => updateDraft(index, { baptismalNameKo: v })}
                />
                <Field
                  label="생일"
                  value={p.birthday}
                  onChange={(v) => updateDraft(index, { birthday: v })}
                />
                <Field
                  label="축일"
                  value={p.feastDay}
                  onChange={(v) => updateDraft(index, { feastDay: v })}
                />
                <Field
                  label="특기"
                  value={p.notes}
                  onChange={(v) => updateDraft(index, { notes: v })}
                  multiline
                />
                <Field
                  label="장기"
                  value={p.talents}
                  onChange={(v) => updateDraft(index, { talents: v })}
                  multiline
                />
                <Field
                  label="사진 경로"
                  value={p.imageSrc ?? ""}
                  onChange={(v) =>
                    updateDraft(index, {
                      imageSrc: v.trim() ? v.trim() : null,
                    })
                  }
                />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <h2 className="text-lg font-bold text-indigo-950 dark:text-amber-100">
                    {p.legalName}
                  </h2>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    세례명 {p.baptismalNameKo}
                  </p>
                </div>
                <dl className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-700">
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      생일
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {p.birthday || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      축일
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {p.feastDay || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      특기
                    </dt>
                    <dd className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                      {p.notes || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      장기
                    </dt>
                    <dd className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                      {p.talents || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const base =
    "mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  return (
    <div>
      <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={base}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}
