"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyGalleryItem } from "@/lib/domine/family-gallery";

/** 자동 슬라이드 간격 (우측 방향 = 다음 장) */
const AUTO_MS = 2000;
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

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const len = images.length;
  const go = useCallback(
    (dir: -1 | 1) => {
      if (len <= 1) return;
      setIndex((i) => (i + dir + len) % len);
    },
    [len]
  );

  useEffect(() => {
    if (len <= 1 || reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % len);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [len, reducedMotion]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const x = e.changedTouches[0].clientX;
    const dx = x - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_PX) go(-1);
    else if (dx < -SWIPE_PX) go(1);
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
      <div className="relative aspect-[5/4] w-full overflow-hidden border border-[var(--lit-border)] bg-[var(--lit-bg)] shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:aspect-[4/3] md:aspect-[5/4] lg:aspect-[4/5] xl:aspect-[3/4]">
        <div
          className="flex h-full transition-transform duration-500 ease-out motion-reduce:duration-0"
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
        <div
          className="mt-1 flex flex-wrap items-center justify-center gap-1 py-0.5 md:mt-2 md:py-1"
          role="tablist"
          aria-label="단체 사진 선택"
        >
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              tabIndex={i === index ? 0 : -1}
              className="flex h-9 min-w-9 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 md:h-11 md:min-w-[2.75rem]"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}번째 사진 보기`}
            >
              <span
                className={`block h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                  i === index
                    ? "w-6 bg-[var(--lit-ink)]"
                    : "w-1.5 bg-[var(--lit-border-strong)] hover:bg-[var(--lit-ink-muted)]"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
