"use client";
import { ACHIEVEMENTS } from "@/lib/domine/pet-catalog";
import PetSheet from "./PetSheet";
export default function PetAchievementSheet({ badges, notice, onClose }: { badges: string[]; notice: string; onClose: () => void }) {
  return <PetSheet title={`업적 · ${badges.length}/30`} onClose={onClose}>
    {notice && <p className="pet-sheet-note">{notice}</p>}
    <div className="pet-achievements">{[...ACHIEVEMENTS].sort((a, b) => Number(badges.includes(b.id)) - Number(badges.includes(a.id))).map((a) => <div key={a.id} className="pet-achievement-row" data-found={badges.includes(a.id)}>
      <span className="pet-badge" aria-hidden="true">{badges.includes(a.id) ? "✦" : "◇"}</span><div><strong>{a.name}</strong><span>{a.condition}</span></div><small>{badges.includes(a.id) ? "✓ 달성" : "도전 중"}</small>
    </div>)}</div>
  </PetSheet>;
}
