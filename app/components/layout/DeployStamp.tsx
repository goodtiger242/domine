import { getDeploymentIndex } from "@/lib/deploy-stamp";

type Props = {
  className?: string;
};

/**
 * 푸터 하단에만 보이는 배포 스탬프입니다.
 * 의미가 없는 짧은 문자열로 두어 방문자에게는 눈에 잘 안 띄게 합니다.
 */
export function DeployStamp({ className = "" }: Props) {
  const n = getDeploymentIndex();
  return (
    <p
      className={`mt-6 text-center text-[10px] font-mono tabular-nums tracking-[0.2em] text-[var(--lit-ink-subtle)] opacity-60 ${className}`}
      aria-hidden
    >
      d·{n}
    </p>
  );
}
