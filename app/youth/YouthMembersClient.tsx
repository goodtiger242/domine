"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { saveYouthProfiles } from "@/app/actions/youth";
import {
  feastDayDateOnly,
  type YouthProfile,
} from "@/lib/constants/youth-profiles";
import { litDisplay } from "@/lib/fonts/display";

type Props = {
  initialProfiles: YouthProfile[];
};

export function YouthMembersClient({ initialProfiles }: Props) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<YouthProfile[]>(initialProfiles);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<YouthProfile[]>(initialProfiles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(initialProfiles);
    if (!isEditing) {
      setDraft(initialProfiles);
    }
  }, [initialProfiles, isEditing]);

  const startEdit = useCallback(() => {
    setDraft(structuredClone(profiles));
    setError(null);
    setIsEditing(true);
  }, [profiles]);

  const cancelEdit = useCallback(() => {
    setDraft(structuredClone(profiles));
    setError(null);
    setIsEditing(false);
  }, [profiles]);

  const saveEdit = useCallback(async () => {
    const next = draft.map((p) => ({
      ...p,
      feastDay: feastDayDateOnly(p.feastDay),
    }));
    setSaving(true);
    setError(null);
    const res = await saveYouthProfiles(next);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProfiles(next);
    setIsEditing(false);
    router.refresh();
  }, [draft, router]);

  const updateDraft = useCallback(
    (index: number, patch: Partial<YouthProfile>) => {
      setDraft((prev) => {
        const copy = [...prev];
        const row = copy[index];
        if (!row) {
          return prev;
        }
        copy[index] = { ...row, ...patch };
        return copy;
      });
    },
    []
  );

  const rows = isEditing ? draft : profiles;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 border-b border-[var(--lit-border)] pb-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--lit-gold-muted)]">
            공동체
          </p>
          <h1
            className={`${litDisplay.className} mt-2 text-3xl tracking-tight text-[var(--lit-ink)] sm:text-4xl`}
          >
            청년회 멤버
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
            생일·축일·세례명을 확인합니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="h-10 rounded-lg border border-[var(--lit-border)] px-5 text-sm font-medium text-[var(--lit-ink-muted)] transition hover:border-[var(--lit-gold)] hover:text-[var(--lit-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="h-10 border border-[var(--lit-ink)] bg-[var(--lit-ink)] px-6 text-sm font-semibold text-[var(--lit-bg-elevated)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="h-10 border border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-6 text-sm font-semibold text-[var(--lit-ink)] transition hover:bg-[var(--lit-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
            >
              편집
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p, index) => (
          <li
            key={p.legalName}
            className="border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-6"
          >
            <div className="mx-auto mb-4 w-full max-w-[220px]">
              {p.imageSrc?.trim() ? (
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)]">
                  <Image
                    src={p.imageSrc}
                    alt={`${p.legalName} 사진`}
                    fill
                    sizes="220px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg)]">
                  <span
                    className={`${litDisplay.className} text-4xl font-semibold text-[var(--lit-gold-muted)]/50`}
                  >
                    {p.legalName.slice(0, 1)}
                  </span>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
                    성명
                  </label>
                  <p className="font-semibold text-[var(--lit-ink)]">
                    {p.legalName}
                  </p>
                </div>
                <div>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
                    세례명
                  </label>
                  <p className="font-medium text-[var(--lit-ink-muted)]">
                    {p.baptismalNameKo}
                  </p>
                </div>
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
                  <h2
                    className={`${litDisplay.className} text-lg font-semibold text-[var(--lit-ink)]`}
                  >
                    {p.legalName}
                  </h2>
                  <p className="text-sm font-medium text-[var(--lit-ink-muted)]">
                    세례명 {p.baptismalNameKo}
                  </p>
                </div>
                <dl className="space-y-2 border-t border-[var(--lit-border)] pt-3">
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
                      생일
                    </dt>
                    <dd className="text-[var(--lit-ink-muted)]">
                      {p.birthday || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
                      축일
                    </dt>
                    <dd className="text-[var(--lit-ink-muted)]">
                      {p.feastDay || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
                      특기
                    </dt>
                    <dd className="whitespace-pre-wrap text-[var(--lit-ink-muted)]">
                      {p.notes || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
                      장기
                    </dt>
                    <dd className="whitespace-pre-wrap text-[var(--lit-ink-muted)]">
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
    "mt-0.5 w-full rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 py-2 text-sm text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]";
  return (
    <div>
      <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lit-gold-muted)]">
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
