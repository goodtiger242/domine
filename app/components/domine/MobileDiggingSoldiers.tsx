/**
 * 행군하는 군인 둘과 강아지. 발바닥이 y=0인 로컬 좌표에서 그리고,
 * 팔·다리는 관절(0,0)을 기준으로 회전한다 (스타일은 globals.css 의 .mil-*).
 */
function Soldier({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 40)`}>
      <ellipse cx="0" cy="0.4" rx="6" ry="1" fill="currentColor" opacity="0.1" />
      <g className="mil-bob">
        {/* 뒤쪽 팔·다리 (어둡게 눌러 깊이감) */}
        <g transform="translate(0 -23)">
          <g className="mil-swing-b" opacity="0.4">
            <path d="M0 0 L0 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(0 -13)">
          <g className="mil-swing-a" opacity="0.45">
            <path d="M0 0 L0 12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M-1 12.6 L2.6 12.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>
        {/* 배낭 + 몸통 */}
        <rect x="-7.4" y="-23.5" width="4.6" height="10.5" rx="1.8" fill="currentColor" opacity="0.5" />
        <path
          d="M-3.6 -24 Q0 -25.4 3.6 -24 L3.2 -12.6 Q0 -11.8 -3.2 -12.6 Z"
          fill="currentColor"
          opacity="0.85"
        />
        {/* 머리 + 군모 */}
        <circle cx="0.4" cy="-27.4" r="3.2" fill="currentColor" opacity="0.9" />
        <path
          d="M-3.1 -28.2 a3.5 3.3 0 0 1 7 0 L6.6 -28 L6.6 -27.2 L-3.1 -27.2 Z"
          fill="currentColor"
        />
        {/* 앞쪽 다리·팔 */}
        <g transform="translate(0 -13)">
          <g className="mil-swing-b">
            <path d="M0 0 L0 12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M-1 12.6 L2.6 12.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(0 -23)">
          <g className="mil-swing-a">
            <path d="M0 0 L0 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Dog({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 40)`}>
      <ellipse cx="1" cy="0.4" rx="8" ry="1" fill="currentColor" opacity="0.1" />
      <g className="mil-bob-fast">
        {/* 뒤쪽 다리 */}
        <g transform="translate(-3.6 -6.6)">
          <g className="mil-swing-b" opacity="0.4">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(3.4 -6.6)">
          <g className="mil-swing-a" opacity="0.4">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
        {/* 꼬리 */}
        <g transform="translate(-6.4 -10)">
          <g className="mil-wag">
            <path d="M0 0 Q-2.6 -1 -3.4 -4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.7" />
          </g>
        </g>
        {/* 몸통·머리 */}
        <ellipse cx="0" cy="-9.4" rx="6.6" ry="3.5" fill="currentColor" opacity="0.8" />
        <circle cx="7.4" cy="-12.6" r="2.8" fill="currentColor" opacity="0.88" />
        <ellipse cx="10.4" cy="-11.9" rx="2.1" ry="1.3" fill="currentColor" opacity="0.88" />
        <path d="M5.6 -14.2 L6.2 -17.2 L8.4 -14.8 Z" fill="currentColor" />
        {/* 앞쪽 다리 */}
        <g transform="translate(-3.4 -6.6)">
          <g className="mil-swing-a">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          </g>
        </g>
        <g transform="translate(3.6 -6.6)">
          <g className="mil-swing-b">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          </g>
        </g>
      </g>
    </g>
  );
}

export function MobileDiggingSoldiers() {
  return (
    <div className="border-t border-[var(--lit-border)] px-3 pb-2 pt-3 text-[var(--lit-ink-subtle)] md:pb-3">
      <svg
        viewBox="0 0 200 44"
        className="mx-auto block h-11 w-full max-w-[18rem] md:h-12"
        role="img"
        aria-label="군복무 중인 청년들을 응원하며 행군하는 군인과 강아지"
      >
        <defs>
          <linearGradient id="mil-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.16" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.84" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="mil-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="44">
            <rect width="200" height="44" fill="url(#mil-fade)" />
          </mask>
        </defs>
        <g mask="url(#mil-mask)">
          <path d="M0 40.5H200" stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
          <g className="mil-march">
            <Soldier x={0} />
            <Soldier x={22} />
            <Dog x={50} />
          </g>
        </g>
      </svg>
    </div>
  );
}
