import type { PetFace, PetStage } from "@/lib/domine/pet";
import { useState } from "react";
import { PETS, poseAt, type PetId } from "@/lib/domine/pet-photos";

/**
 * 도미(공동 반려견). 발바닥이 (0,0)이고 오른쪽을 본다.
 * 자세 사진이 준비되면 교체하고, 못 받았으면 기존 사진·CSS 연출을 쓴다.
 * 이 파일만 바꾸면 그림을 통째로 교체할 수 있다.
 */
export const DOG_W: Record<PetStage, number> = { baby: 32, young: 42, adult: 48 };
export const RATIO = 622 / 900;

type Props = {
  petId?: PetId;
  scale?: number;
  stage: PetStage;
  face: PetFace;
  /** 연출 중인 동작 클래스 (없으면 상태에 맞는 기본 자세) */
  motion: string | null;
  /** 밤에는 어둡게 (0.55 ~ 1) */
  light: number;
  /** 전례색 목줄 */
  collar: string;
  photos: Record<string, boolean>;
  onTap?: () => void;
};

export function PetDog({ petId = 1, scale = 1, stage, face, motion, light, collar, photos, onTap }: Props) {
  const config = PETS[petId];
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const pose = poseAt(motion, face);
  const photo = pose && photos[config.poses[pose].src] && !failed[config.poses[pose].src] ? config.poses[pose] : null;
  const src = photo?.src ?? config.standing[stage];
  const width = DOG_W[stage] * config.scale * scale * (photo?.width ?? 1);
  const height = width * (photo?.ratio ?? config.ratio);
  const sad = face === "hungry" || face === "sad";
  const dirty = face === "dirty" && motion !== "pet-shake";
  const filter = `brightness(${light}) saturate(${sad ? 0.8 : 1})${dirty ? " sepia(0.35)" : ""}`;
  const cls =
    photo ? "pet-bob" : motion === "pet-sleep" ? "pet-lie" : motion ?? (face === "sleepy" ? "pet-lie" : sad ? "pet-sag" : "pet-bob");
  return (
    <g
      className={cls}
      style={{ ["--oy" as string]: `${-height * 0.5}px`, cursor: "pointer" }}
      onClick={onTap}
      role="button" tabIndex={0} aria-label={`${config.name} 쓰다듬어 인사하기`}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onTap?.(); } }}
    >
      {failed[src] ? <text y={-height / 3} textAnchor="middle" fontSize={width * 0.6}>🐕</text> : <image
        href={src}
        x={-width / 2}
        y={-height + 1.5 * scale}
        width={width}
        height={height}
        style={{ filter }}
        onError={() => setFailed((prev) => ({ ...prev, [src]: true }))}
      />}
      {/* 사진의 목줄 위치(900px 기준 좌표)에 전례색 목줄을 덧그린다 */}
      {!photo && !failed[src] && config.collar && <g
        transform={`translate(${-width / 2} ${-height + 1.5 * scale}) scale(${width / 900})`}
        style={{ filter }}
      >
        <path d={config.collar} stroke={collar} strokeWidth="15" strokeLinecap="round" fill="none" />
        <path d="M641 150 Q690 174 730 218" stroke="#00000030" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>}
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
