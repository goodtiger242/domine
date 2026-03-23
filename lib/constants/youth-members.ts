/** 청년회 멤버 이름 (추가 예정 — 가나다순 정렬로 표시) */
export const YOUTH_MEMBER_NAMES = [
  "김경석",
  "김보영",
  "김지우",
  "김혜수",
  "안제오",
  "이태원",
  "이현아",
  "최비호",
  "최선호",
] as const;

export function sortedYouthMembers(): string[] {
  return [...YOUTH_MEMBER_NAMES].sort((a, b) => a.localeCompare(b, "ko"));
}

export function isYouthMemberName(name: string): boolean {
  return (YOUTH_MEMBER_NAMES as readonly string[]).includes(name.trim());
}
