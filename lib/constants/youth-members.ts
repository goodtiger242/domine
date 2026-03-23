/** 청년회 멤버 이름 (가나다순 정렬로 표시) */
export const YOUTH_MEMBER_NAMES = [
  "김슬기",
  "김윤서",
  "김지우",
  "성현",
  "이승원",
  "유이진",
  "유태원",
  "이정우",
  "이제창",
  "최지수",
] as const;

export function sortedYouthMembers(): string[] {
  return [...YOUTH_MEMBER_NAMES].sort((a, b) => a.localeCompare(b, "ko"));
}

export function isYouthMemberName(name: string): boolean {
  return (YOUTH_MEMBER_NAMES as readonly string[]).includes(name.trim());
}
