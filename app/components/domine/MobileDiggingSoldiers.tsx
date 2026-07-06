function SoldierFigure({ reverse = false }: { reverse?: boolean }) {
  return (
    <g className={reverse ? "military-dig-reverse" : "military-dig"}>
      <circle cx="18" cy="9" r="3.5" fill="currentColor" opacity="0.82" />
      <rect
        x="13.5"
        y="13"
        width="9"
        height="10"
        rx="2"
        fill="currentColor"
        opacity="0.76"
      />
      <path
        d="M14 16.5 8.5 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path
        d="M22 16.5 28 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path
        className="military-shovel"
        d="M27 8 20 25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        className="military-shovel"
        d="M18.5 26.5h5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.72"
      />
    </g>
  );
}

export function MobileDiggingSoldiers() {
  return (
    <div className="border-t border-[var(--lit-border)] px-3 py-1.5 text-[var(--lit-ink-subtle)] md:hidden">
      <svg
        viewBox="0 0 128 30"
        className="mx-auto h-7 w-full max-w-[13rem]"
        role="img"
        aria-label="군복무 응원 애니메이션"
      >
        <path
          d="M13 25.5h102"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.22"
        />
        <g transform="translate(23 0)">
          <SoldierFigure />
        </g>
        <g transform="translate(78 0) scale(-1 1)">
          <SoldierFigure reverse />
        </g>
      </svg>
    </div>
  );
}
