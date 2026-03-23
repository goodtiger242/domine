/** 청년회 멤버 — 청년회 멤버1·2 이미지 명단 기준 (성명 + 세례명) */

export type YouthMember = {
  legalName: string;
  /** 한글 세례명 (표시용, 영어 별칭은 생략) */
  baptismalNameKo: string;
};

/** 명단 (가나다순 정렬은 sortedYouthMemberLegalNames에서) */
export const YOUTH_MEMBERS: readonly YouthMember[] = [
  { legalName: "김경석", baptismalNameKo: "리노" },
  { legalName: "김보영", baptismalNameKo: "안젤라 메리치" },
  { legalName: "김슬기", baptismalNameKo: "마리아" },
  { legalName: "김윤서", baptismalNameKo: "님파" },
  { legalName: "김지우", baptismalNameKo: "안토니오" },
  { legalName: "김혜수", baptismalNameKo: "로사" },
  { legalName: "도화정", baptismalNameKo: "엘리사벳" },
  { legalName: "성현", baptismalNameKo: "토마스" },
  { legalName: "안제오", baptismalNameKo: "루카" },
  { legalName: "유이진", baptismalNameKo: "노엘라" },
  { legalName: "유태원", baptismalNameKo: "아이다노" },
  { legalName: "이승원", baptismalNameKo: "빈첸시오" },
  { legalName: "이정우", baptismalNameKo: "안드레아" },
  { legalName: "이제창", baptismalNameKo: "토마스" },
  { legalName: "이학준", baptismalNameKo: "라파엘" },
  { legalName: "이현아", baptismalNameKo: "마리아 도미니카" },
  { legalName: "임효진", baptismalNameKo: "수산나" },
  { legalName: "최비호", baptismalNameKo: "비오" },
  { legalName: "최선호", baptismalNameKo: "프란치스코" },
  { legalName: "최지수", baptismalNameKo: "스텔라" },
] as const;

const byLegal = new Map<string, YouthMember>(
  YOUTH_MEMBERS.map((m) => [m.legalName, m])
);

/** 예전에 저장된 문자열 → 성명 (표시·매칭용) */
const LEGACY_TO_LEGAL: Readonly<Record<string, string>> = {
  "안제오 루카": "안제오",
  이태원: "유태원",
};

export function sortedYouthMemberLegalNames(): string[] {
  return [...YOUTH_MEMBERS]
    .map((m) => m.legalName)
    .sort((a, b) => a.localeCompare(b, "ko"));
}

/** @deprecated 성명만 필요할 때는 sortedYouthMemberLegalNames와 동일 */
export function sortedYouthMembers(): string[] {
  return sortedYouthMemberLegalNames();
}

/** 저장값에서 성명 후보를 꺼냄 (멤버면 성명, 아니면 null) */
export function resolveYouthMemberLegalName(stored: string): string | null {
  const t = stored.trim();
  if (!t) {
    return null;
  }
  if (byLegal.has(t)) {
    return t;
  }
  const legacy = LEGACY_TO_LEGAL[t];
  if (legacy && byLegal.has(legacy)) {
    return legacy;
  }
  const first = t.split(/\s+/)[0] ?? "";
  if (byLegal.has(first)) {
    return first;
  }
  return null;
}

export function isYouthMemberName(name: string): boolean {
  return resolveYouthMemberLegalName(name) !== null;
}

/** 직접 입력: 한글 성명만 2~4자 (공백·세례명 불가) */
export function isValidCustomLiturgicalName(s: string): boolean {
  const t = s.trim();
  if (!t) {
    return true;
  }
  return /^[가-힣]{2,4}$/.test(t);
}

/** 메인 등 조회 화면: 성명 + 세례명 (멤버가 아니면 원문 그대로) */
export function formatYouthMemberDisplay(stored: string): string {
  const t = stored.trim();
  if (!t) {
    return t;
  }
  const legal = resolveYouthMemberLegalName(t);
  if (!legal) {
    return t;
  }
  const m = byLegal.get(legal);
  if (!m) {
    return t;
  }
  return `${m.legalName} ${m.baptismalNameKo}`;
}
