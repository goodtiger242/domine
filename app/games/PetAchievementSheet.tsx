"use client";
import { ACHIEVEMENTS } from "@/lib/domine/pet-catalog";
import PetSheet from "./PetSheet";
export default function PetAchievementSheet({ badges, notice, onClose }: { badges: string[]; notice: string; onClose: () => void }) {
  return <PetSheet title={`업적 · ${badges.length}/30`} onClose={onClose}>
    <p className="pet-sheet-note">{notice || "개인 보상을 받은 돌봄과 탐색으로 기록해요. 배지만 지급하며 재화 보상은 없어요."}</p>
    <div className="pet-catalog-grid">{ACHIEVEMENTS.map((a) => <div key={a.id} className="pet-catalog-card" data-found={badges.includes(a.id)}>
      <span className="pet-badge" aria-hidden="true">{badges.includes(a.id) ? "✦" : "◇"}</span><strong>{a.name}</strong><span>{a.condition}</span><small>{badges.includes(a.id) ? "✓ 달성" : "도전 중"}</small>
    </div>)}</div>
  </PetSheet>;
}
