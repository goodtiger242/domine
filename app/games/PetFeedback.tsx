import { rewardDisplay } from "@/lib/domine/pet-progress";
import type { V6Result } from "@/lib/domine/pet-rpc";
import { CATALOG, ACHIEVEMENTS } from "@/lib/domine/pet-catalog";
import PetItemIcon from "./PetItemIcon";
export default function PetFeedback({ result, previousLevel }: { result: V6Result; previousLevel: number }) {
  const r = rewardDisplay(result.reward), leveled = (result.player?.level ?? 1) > previousLevel;
  const discovery = CATALOG.find((item) => item.id === result.reward?.newEntries[0]);
  return <div className="pet-feedback" aria-live="polite" role="status">
    <span className={`pet-reward ${r.quiet && !r.notice ? "pet-reward-quiet" : ""}`}>{r.notice || <>+{r.coins} 코인{r.xp ? ` · +${r.xp} XP` : ""}</>}</span>
    {Array.from({ length: Math.min(5, r.coins) }, (_, i) => <i key={i} className="pet-coin-flight" style={{ left: `${35 + i * 5}%`, animationDelay: `${i * 25}ms` }} aria-hidden="true">●</i>)}
    {leveled && <><strong className="pet-level-up">Lv. {result.player?.level} · 함께 자랐어요!</strong>{Array.from({ length: 12 }, (_, i) => <i key={i} className="pet-level-particle" style={{ left: `${8 + i * 7}%`, animationDelay: `${i * 35}ms` }} aria-hidden="true">✦</i>)}</>}
    {discovery && <span className="pet-discovery"><PetItemIcon item={discovery} /> {discovery.name} · 기록했어요</span>}
    {!!result.reward?.newBadges.length && <span className="pet-new-badge">✦ {ACHIEVEMENTS.find((a) => a.id === result.reward?.newBadges[0])?.name ?? "새 업적"}</span>}
  </div>;
}
