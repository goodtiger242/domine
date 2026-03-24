"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyGalleryItem } from "@/lib/domine/family-gallery";

/** 자동 슬라이드 간격 (우측 방향 = 다음 장). 수동 조작 시 타이머 리셋 */
const AUTO_MS = 4200;
const SWIPE_PX = 48;

type Props = {
  images: readonly FamilyGalleryItem[];
  /** 히어로와 동일한 비율·커버 규칙 */
  imageClassName: string;
  sizes: string;
};

export function FamilyPhotoCarousel({
  images,
  imageClassName,
  sizes,
}: Props) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const len = images.length;

  const clearAuto = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const scheduleAuto = useCallback(() => {
    clearAuto();
    if (len <= 1 || reducedMotion) return;
    intervalRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % len);
    }, AUTO_MS);
  }, [len, reducedMotion, clearAuto]);

  useEffect(() => {
    scheduleAuto();
    return () => clearAuto();
  }, [scheduleAuto, clearAuto]);

  const go = useCallback(
    (dir: -1 | 1, userInitiated: boolean) => {
      if (len <= 1) return;
      setIndex((i) => (i + dir + len) % len);
      if (userInitiated) {
        scheduleAuto();
      }
    },
    [len, scheduleAuto]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const x = e.changedTouches[0].clientX;
    const dx = x - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_PX) go(-1, true);
    else if (dx < -SWIPE_PX) go(1, true);
  };

  if (len === 0) {
    return null;
  }

  const slidePct = len > 0 ? (index * 100) / len : 0;

  return (
    <div
      className="relative w-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl border border-[var(--lit-border)]/90 bg-[var(--lit-bg)] shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.02] sm:aspect-[4/3] md:aspect-[5/4] lg:aspect-[4/5] xl:aspect-[3/4] dark:ring-white/[0.04]">
        <div
          className="flex h-full transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0"
          style={{
            width: `${len * 100}%`,
            transform: `translateX(-${String(slidePct)}%)`,
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.src}
              className="relative h-full shrink-0"
              style={{ width: `${100 / len}%` }}
              aria-hidden={i !== index}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className={imageClassName}
                sizes={sizes}
                priority={i <= 1}
              />
            </div>
          ))}
        </div>
      </div>

      {len > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1, true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] text-xl font-light leading-none text-[var(--lit-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out hover:border-[var(--lit-border-strong)] hover:bg-[var(--lit-bg)] hover:shadow-[var(--lit-paper-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] active:scale-[0.96] motion-reduce:transition-none"
            aria-label="이전 사진"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5 px-2">
            <p className="text-[11px] font-medium tabular-nums tracking-[0.14em] text-[var(--lit-ink-muted)]">
              {index + 1} / {len}
            </p>
            <div className="h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-[var(--lit-border)]/80">
              <div
                className="h-full rounded-full bg-[var(--lit-ink)]/35 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:bg-[var(--lit-ink)]/25"
                style={{
                  width:
                    len <= 0 ? "0%" : `${((index + 1) / len) * 100}%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => go(1, true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] text-xl font-light leading-none text-[var(--lit-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out hover:border-[var(--lit-border-strong)] hover:bg-[var(--lit-bg)] hover:shadow-[var(--lit-paper-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] active:scale-[0.96] motion-reduce:transition-none"
            aria-label="다음 사진"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
