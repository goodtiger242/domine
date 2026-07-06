function MarchingSoldier({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect
        x="7"
        y="10"
        width="8"
        height="9"
        rx="2"
        fill="currentColor"
        opacity="0.34"
      />
      <circle cx="20" cy="8" r="3.2" fill="currentColor" opacity="0.82" />
      <rect
        x="16"
        y="12"
        width="9"
        height="10"
        rx="2"
        fill="currentColor"
        opacity="0.76"
      />
      <path
        className="military-arm-a"
        d="M16.5 15.5 11.5 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path
        className="military-arm-b"
        d="M24 15.5 29 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path
        className="military-leg-a"
        d="M18 22 14.5 27"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        className="military-leg-b"
        d="M23 22 27 27"
        stroke="currentColor"
        strokeWidth="2.1"
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
        aria-label="군복무 응원 행군 애니메이션"
      >
        <path
          d="M8 27.5h112"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.18"
        />
        <g className="military-march">
          <MarchingSoldier x={0} />
          <MarchingSoldier x={30} />
        </g>
      </svg>
    </div>
  );
}
