import Link from "next/link";

/** 메인으로 이동 — 영어 Domine 워드마크만 (한글 라벨 없음) */
export function SiteBrandLink() {
  return (
    <Link
      href="/"
      className="group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
    >
      <span
        className="inline-flex items-center rounded-2xl border border-[var(--lit-border)] bg-gradient-to-b from-[var(--lit-bg-elevated)] to-[var(--lit-bg)] px-4 py-2.5 text-[1.2rem] font-semibold uppercase tracking-[0.22em] text-[var(--lit-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--lit-border-strong)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)] active:scale-[0.98] md:rounded-none md:border-0 md:bg-none md:px-0 md:py-0 md:text-xl md:shadow-none md:hover:opacity-60 md:hover:shadow-none md:active:scale-100 lg:text-[1.35rem]"
      >
        Domine
      </span>
    </Link>
  );
}
