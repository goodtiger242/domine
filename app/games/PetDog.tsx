import type { PetFace, PetStage } from "@/lib/domine/pet";

/**
 * 도미(공동 반려견). 실사 사진(public/pet/*.png, 배경 제거)을 쓴다.
 * 발바닥이 (0,0)이고 오른쪽을 본다. 자세가 한 장뿐이라 사진을 눌러 찌그러뜨리고
 * 뒤집어서 엎드림·배 보이기·공중제비를 흉내 낸다 (스타일은 globals.css 의 .pet-*).
 * 이 파일만 바꾸면 그림을 통째로 교체할 수 있다.
 */
const SRC: Record<PetStage, { href: string; width: number }> = {
  baby: { href: "/pet/puppy.png", width: 62 },
  young: { href: "/pet/puppy.png", width: 84 },
  adult: { href: "/pet/adult.png", width: 96 },
};
const RATIO = 622 / 900;

type Props = {
  stage: PetStage;
  face: PetFace;
  eating: boolean;
  petting: boolean;
  walking: boolean;
  /** 공중제비 */
  flip: boolean;
  /** 밤에는 어둡게 (0.55 ~ 1) */
  light: number;
  /** 전례색 목줄 */
  collar: string;
  onTap?: () => void;
};

function Bubble({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <g transform={`translate(${x} ${y})`} className="fade-in">
      <path
        d="M-7 -7 h14 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 h-8 l-4 4 v-4 h-2 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 z"
        fill="#fff"
        opacity="0.92"
      />
      <text x="0" y="3.4" textAnchor="middle" fontSize="9">
        {children}
      </text>
    </g>
  );
}

export function PetDog({ stage, face, eating, petting, walking, flip, light, collar, onTap }: Props) {
  const { href, width } = SRC[stage];
  const height = width * RATIO;
  const sad = face === "hungry" || face === "sad";
  const filter = `brightness(${light}) saturate(${sad ? 0.8 : 1})`;
  const motion = flip
    ? "pet-flip"
    : walking
      ? "pet-trot"
      : eating
        ? "pet-eatnod"
        : petting
          ? "pet-roll"
          : face === "sleepy"
            ? "pet-lie"
            : sad
              ? "pet-sag"
              : "pet-bob";
  const top = -height - 2;
  return (
    <g>
      <ellipse cx="0" cy="1" rx={width * 0.42} ry="3.2" fill="#000" opacity="0.28" />
      <g
        className={motion}
        style={{ ["--oy" as string]: `${-height * 0.5}px`, cursor: "pointer" }}
        onClick={onTap}
      >
        <image href={href} x={-width / 2} y={-height + 1.5} width={width} height={height} style={{ filter }} />
        {/* 사진의 목줄 위치(900px 기준 좌표)에 전례색 목줄을 덧그린다 */}
        <g transform={`translate(${-width / 2} ${-height + 1.5}) scale(${width / 900})`} style={{ filter }}>
          <path d="M641 143 Q692 168 736 214" stroke={collar} strokeWidth="15" strokeLinecap="round" fill="none" />
          <path d="M641 150 Q690 174 730 218" stroke="#00000030" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      </g>

      {/* 하트·말풍선은 뒤집히지 않게 따로 둔다 */}
      {petting ? (
        <g>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              className="pet-heart"
              style={{ animationDelay: `${i * 0.35}s` }}
              d={`M${width * 0.2 + i * 9} ${top - 2} c-3 -5 -9 -1 -5 4 l5 5 l5 -5 c4 -5 -2 -9 -5 -4 Z`}
              fill="#ef5b7b"
            />
          ))}
        </g>
      ) : flip || eating ? null : face === "hungry" ? (
        <Bubble x={width * 0.42} y={top}>
          🍖
        </Bubble>
      ) : face === "sad" ? (
        <Bubble x={width * 0.42} y={top}>
          💧
        </Bubble>
      ) : face === "sleepy" ? (
        <Bubble x={width * 0.44} y={-height * 0.6 - 8}>
          💤
        </Bubble>
      ) : null}
    </g>
  );
}

/** 밥그릇 (밥 줄 때만 보임) */
export function PetBowl() {
  return (
    <g className="fade-in">
      <path d="M-14 -7 Q0 -17 14 -7 L11 0 L-11 0 Z" fill="#7c93a8" />
      <ellipse cx="0" cy="-7" rx="14" ry="3" fill="#a9bccd" />
      <path d="M-9 -7 Q0 -15 9 -7 Z" fill="#a8693a" />
    </g>
  );
}
