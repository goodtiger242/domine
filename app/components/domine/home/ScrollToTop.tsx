"use client";

import { useEffect, useState } from "react";

export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > 360);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) {
    return null;
  }

  return (
    <button
      type="button"
      className="fixed bottom-5 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/98 text-lg text-[var(--lit-ink)] shadow-[var(--lit-paper-shadow)] backdrop-blur-sm transition hover:border-[var(--lit-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] lg:hidden"
      aria-label="맨 위로"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    >
      ↑
    </button>
  );
}
