import type { PetFace, PetStage } from "@/lib/domine/pet";

/**
 * 도미(공동 반려견). 실사 사진(public/pet/*.png, 배경 제거)을 쓴다.
 * 발바닥이 (0,0)이고 오른쪽을 본다. 자세가 한 장뿐이라 사진을 눌러 찌그러뜨리고
 * 뒤집고 흔들어서 엎드림·앉기·털기·공중제비 등을 흉내 낸다 (스타일은 globals.css 의 .pet-*).
 * 이 파일만 바꾸면 그림을 통째로 교체할 수 있다.
 */
export const DOG_W: Record<PetStage, number> = { baby: 50, young: 66, adult: 76 };
const HREF: Record<PetStage, string> = {
  baby: "/pet/puppy.webp",
  young: "/pet/puppy.webp",
  adult: "/pet/adult.webp",
};
export const RATIO = 622 / 900;

type Props = {
  stage: PetStage;
  face: PetFace;
  /** 연출 중인 동작 클래스 (없으면 상태에 맞는 기본 자세) */
  motion: string | null;
  /** 밤에는 어둡게 (0.55 ~ 1) */
  light: number;
  /** 전례색 목줄 */
  collar: string;
  onTap?: () => void;
};

export function PetDog({ stage, face, motion, light, collar, onTap }: Props) {
  const width = DOG_W[stage];
  const height = width * RATIO;
  const sad = face === "hungry" || face === "sad";
  const dirty = face === "dirty" && motion !== "pet-shake";
  const filter = `brightness(${light}) saturate(${sad ? 0.8 : 1})${dirty ? " sepia(0.35)" : ""}`;
  const cls =
    motion ?? (face === "sleepy" ? "pet-lie" : sad ? "pet-sag" : "pet-bob");
  return (
    <g
      className={cls}
      style={{ ["--oy" as string]: `${-height * 0.5}px`, cursor: "pointer" }}
      onClick={onTap}
    >
      <image
        href={HREF[stage]}
        x={-width / 2}
        y={-height + 1.5}
        width={width}
        height={height}
        style={{ filter }}
      />
      {/* 사진의 목줄 위치(900px 기준 좌표)에 전례색 목줄을 덧그린다 */}
      <g
        transform={`translate(${-width / 2} ${-height + 1.5}) scale(${width / 900})`}
        style={{ filter }}
      >
        <path d="M641 143 Q692 168 736 214" stroke={collar} strokeWidth="15" strokeLinecap="round" fill="none" />
        <path d="M641 150 Q690 174 730 218" stroke="#00000030" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

/** 밥그릇 */
export function PetBowl() {
  return (
    <g>
      <path d="M-11 -6 Q0 -14 11 -6 L9 0 L-9 0 Z" fill="#7c93a8" />
      <ellipse cx="0" cy="-6" rx="11" ry="2.4" fill="#a9bccd" />
    </g>
  );
}
