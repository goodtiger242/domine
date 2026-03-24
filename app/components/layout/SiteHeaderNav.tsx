"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { SiteNavLink } from "@/lib/nav/site-nav";

type Props = {
  navLinks: SiteNavLink[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href;
}

export function SiteHeaderNav({ navLinks }: Props) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dialogId = "site-header-nav-dialog";

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <nav
        className="hidden items-center gap-0 md:flex"
        aria-label="주요 메뉴"
      >
        {navLinks.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 ${
                active
                  ? "text-[var(--lit-ink)]"
                  : "text-[var(--lit-ink-muted)] hover:text-[var(--lit-ink)]"
              }`}
            >
              {item.label}
              <span
                className={`absolute bottom-1 left-3 right-3 h-px origin-left bg-current transition-transform duration-300 ease-out ${
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/95 text-[var(--lit-ink)] shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:border-[var(--lit-border-strong)] hover:bg-[var(--lit-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 active:scale-[0.98]"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-label="메뉴 열기"
        >
          <span className="flex w-[18px] flex-col gap-[5px]" aria-hidden>
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
          </span>
        </button>
      </div>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[200] md:hidden" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-[rgba(0,0,0,0.38)] backdrop-blur-[3px]"
                onClick={close}
                aria-label="메뉴 닫기"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex max-h-full min-h-0 justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2"
              >
                <div
                  id={dialogId}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  className="pointer-events-auto flex h-auto max-h-[min(82dvh,calc(100dvh-2rem))] w-full max-w-lg min-h-0 flex-col overflow-hidden rounded-t-[1.35rem] border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/98 shadow-[0_-12px_48px_rgba(0,0,0,0.1)] backdrop-blur-md animate-[sheet-up_0.32s_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none motion-reduce:opacity-100"
                >
                  <div className="flex shrink-0 flex-col items-center pt-3 pb-1">
                    <div
                      className="h-1 w-11 rounded-full bg-[var(--lit-border-strong)]"
                      aria-hidden
                    />
                    <p
                      id={titleId}
                      className="mt-4 text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)]"
                    >
                      Menu
                    </p>
                  </div>
                  <nav
                    className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-5 pt-2 [-webkit-overflow-scrolling:touch]"
                    aria-label="주요 메뉴"
                  >
                    <ul className="flex flex-col gap-0.5">
                      {navLinks.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={close}
                              className={`flex min-h-[3.25rem] items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-inset ${
                                active
                                  ? "bg-[var(--lit-bg)] text-[var(--lit-ink)]"
                                  : "text-[var(--lit-ink-muted)] hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)]"
                              }`}
                            >
                              <span className="break-keep">{item.label}</span>
                              <span
                                className={`text-lg leading-none ${
                                  active
                                    ? "text-[var(--lit-ink)]"
                                    : "text-[var(--lit-ink-subtle)]"
                                }`}
                                aria-hidden
                              >
                                →
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
