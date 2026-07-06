/**
 * 배포 반영 여부를 눈으로 확인하기 위한 스탬프입니다.
 *
 * Cursor 에이전트는 코드 작업 완료 시 이 숫자를 자동으로 +1 하고 커밋·푸시합니다.
 *
 * 과거에는 NEXT_PUBLIC_DEPLOY_INDEX 로 덮어쓸 수 있었는데, Vercel 등에 값이 남으면
 * 재배포해도 숫자가 갱신되지 않는 문제가 있어, 이제는 이 상수만 사용합니다.
 * (호스팅에 남아 있는 NEXT_PUBLIC_DEPLOY_INDEX 는 무시됩니다. 삭제해도 됩니다.)
 */
export const DEPLOYMENT_INDEX = 41;

export function getDeploymentIndex(): number {
  return DEPLOYMENT_INDEX;
}
