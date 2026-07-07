function MarchingSoldier({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path
        d="M13 7.5 28 22.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.58"
      />
      <path
        d="M11.5 6 15 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.58"
      />
      <path
        d="M26.5 21 31 21"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.58"
      />
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

function MarchingDog({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="military-dog">
        <ellipse
          cx="10"
          cy="22.2"
          rx="5.4"
          ry="3"
          fill="currentColor"
          opacity="0.52"
        />
        <circle
          cx="16.8"
          cy="20.2"
          r="2.7"
          fill="currentColor"
          opacity="0.58"
        />
        <path
          d="M15.2 18.2 13.8 15.8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.52"
        />
        <path
          d="M18.4 18.3 20.2 16.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.52"
        />
        <circle
          cx="18.6"
          cy="20.1"
          r="0.45"
          fill="var(--lit-bg-elevated)"
          opacity="0.9"
        />
        <path
          className="military-dog-tail"
          d="M5 21.5 1 18.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.56"
        />
        <path
          className="military-leg-a"
          d="M7.5 24.4 6.2 26.8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.56"
        />
        <path
          className="military-leg-b"
          d="M13.5 24.5 14.8 26.8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.56"
        />
      </g>
    </g>
  );
}

export function MobileDiggingSoldiers() {
  return (
    <div className="border-t border-[var(--lit-border)] px-3 py-1.5 text-[var(--lit-ink-subtle)] md:py-2">
      <svg
        viewBox="0 0 128 30"
        className="mx-auto h-7 w-full max-w-[13rem] md:h-8 md:max-w-[16rem]"
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
          <MarchingSoldier x={38} />
          <MarchingDog x={76} />
        </g>
      </svg>
    </div>
  );
}
