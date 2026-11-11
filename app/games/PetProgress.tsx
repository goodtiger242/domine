import { progressOf } from "@/lib/domine/pet-progress";
export default function PetProgress({ xp, coins }: { xp: number; coins: number }) {
  const p = progressOf(xp);
  return <div className="pet-progress" aria-label={`함께 모은 레벨 ${p.level}, 경험치 ${p.value}, 코인 ${coins}`}>
    <strong>Lv. {p.level}</strong><span className="pet-xp" role="progressbar" aria-label="레벨 경험치" aria-valuemin={0} aria-valuemax={p.needed || 1} aria-valuenow={p.needed ? p.current : 1}>
      <i style={{ width: `${p.needed ? p.current / p.needed * 100 : 100}%` }} /></span><small>{p.needed ? `${p.current}/${p.needed}` : "MAX"}</small><strong className="pet-coin-total">● {coins}</strong>
  </div>;
}
