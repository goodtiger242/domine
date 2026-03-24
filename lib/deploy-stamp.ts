/**
 * 배포 반영 여부를 눈으로 확인하기 위한 스탬프입니다.
 *
 * Cursor 에이전트는 코드 작업 완료 시 이 숫자를 자동으로 +1 하고 커밋·푸시합니다.
 * (선택) 호스팅에서 NEXT_PUBLIC_DEPLOY_INDEX 를 쓰면 이 상수보다 env가 우선합니다.
 */
export const DEPLOYMENT_INDEX = 16;

export function getDeploymentIndex(): number {
  const raw = process.env.NEXT_PUBLIC_DEPLOY_INDEX;
  if (raw === undefined || raw === "") {
    return DEPLOYMENT_INDEX;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEPLOYMENT_INDEX;
  }
  return parsed;
}
