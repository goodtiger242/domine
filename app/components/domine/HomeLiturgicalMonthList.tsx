"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import Link from "next/link";

type Props = {
  /** 등록된 미사 전체 (날짜 오름차순) */
  schedules: LiturgicalSchedule[];
  nextUpcomingLiturgyDate: string | null;
};

const SWIPE_MIN_PX = 48;

function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

const navBtn =
  "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-3 text-[15px] font-medium text-[var(--lit-ink)] transition duration-150 active:scale-[0.97] enabled:hover:border-[var(--lit-border-strong)] disabled:text-[var(--lit-ink-subtle)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2";

export function HomeLiturgicalMonthList({
  schedules,
  nextUpcomingLiturgyDate,
}: Props) {
  const [index, setIndex] = useState(() => {
    const i = schedules.findIndex(
      (s) => s.liturgy_date === nextUpcomingLiturgyDate
    );
    return i >= 0 ? i : Math.max(schedules.length - 1, 0);
  });
  // 방향: 0 은 첫 표시(애니메이션 없음), 1 은 다음, -1 은 이전
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const last = schedules.length - 1;
  const go = useCallback(
    (delta: 1 | -1) => {
      const target = index + delta;
      if (target < 0 || target > last) {
        return;
      }
      setDir(delta);
      setIndex(target);
    },
    [index, last]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
        return;
      }
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) {
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 세로 스크롤과 구분: 가로 이동이 충분히 크고 세로보다 확실히 클 때만
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
    }
  }

  const current = schedules[index];
  const prev = schedules[index - 1];
  const next = schedules[index + 1];

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <h2 className="t-title min-w-0 text-[var(--lit-ink)]">
          <span className="break-keep">전례 안내</span>
        </h2>
        {current ? (
          <p
            className="t-label shrink-0 pb-1 tabular-nums text-[var(--lit-ink-muted)]"
            aria-live="polite"
          >
            {index + 1} / {schedules.length}
          </p>
        ) : null}
      </div>

      <div className="mt-5 md:mt-7">
        {current ? (
          <>
            <div
              className="-mx-2 touch-pan-y overflow-x-clip px-2 py-2"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div
                key={current.liturgy_date}
                className={
                  dir === 1 ? "slide-next" : dir === -1 ? "slide-prev" : ""
                }
              >
                <LiturgicalScheduleCard
                  schedule={current}
                  showEditLink={false}
                  emphasize={current.liturgy_date === nextUpcomingLiturgyDate}
                />
              </div>
            </div>

            <div
              className="mt-4 flex gap-3"
              role="group"
              aria-label="미사 이동"
            >
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={!prev}
                aria-label={
                  prev ? `이전 미사 ${shortDate(prev.liturgy_date)}` : "이전 미사 없음"
                }
                className={navBtn}
              >
                <span aria-hidden className="text-lg leading-none">
                  ‹
                </span>
                <span className="truncate">
                  {prev ? shortDate(prev.liturgy_date) : "처음"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={!next}
                aria-label={
                  next ? `다음 미사 ${shortDate(next.liturgy_date)}` : "다음 미사 없음"
                }
                className={navBtn}
              >
                <span className="truncate">
                  {next ? shortDate(next.liturgy_date) : "마지막"}
                </span>
                <span aria-hidden className="text-lg leading-none">
                  ›
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-8 py-16 text-center">
            <p className="t-body text-[var(--lit-ink-muted)]">
              등록된 전례 봉사 정보가 없습니다.
            </p>
            <Link
              href="/liturgical/edit"
              className="mt-8 inline-block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink)] underline decoration-[var(--lit-border-strong)] underline-offset-[6px] transition hover:opacity-70"
            >
              입력하기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
