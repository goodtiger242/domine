"use client";
import { useState } from "react";
import { SHOP, type CatalogEntry } from "@/lib/domine/pet-catalog";
import type { PetCommand, V6Result } from "@/lib/domine/pet-rpc";
import type { PetId } from "@/lib/domine/pet-photos";
import PetSheet from "./PetSheet";
import PetItemIcon from "./PetItemIcon";
export default function PetShopSheet({ state, petId, disabled, notice, execute, onClose }: {
  state: V6Result | null; petId: PetId; disabled: boolean; notice: string; execute: (c: PetCommand) => Promise<void>; onClose: () => void;
}) {
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const owned = (item: CatalogEntry) => state?.inventory?.includes(item.id);
  const equipped = (item: CatalogEntry) => state?.equipment?.some((e) => e.pet_id === petId && e.item_id === item.id);
  return <PetSheet title={selected?.name ?? "상점"} onClose={onClose} onBack={() => { if (!selected) return false; setSelected(null); return true; }}>
    <p className="pet-sheet-note" role="status">{notice || `함께 모은 코인 ${state?.player?.coins ?? 0} · 구매와 착용은 모두에게 적용돼요.`}</p>
    {selected ? <div className="pet-product-detail">
      <button type="button" onClick={() => setSelected(null)}>‹ 목록으로</button>
      <PetItemIcon item={selected} />
      <h3>{selected.name}</h3><p>{selected.price} 코인 · {selected.category}</p>
      {owned(selected) && <span className="pet-purchase-check" role="status">✓ 함께 모은 소지품</span>}
      {owned(selected) ? <button type="button" disabled={disabled} onClick={() => void execute({ kind: "equip", pet: petId, slot: selected.slot!, item: equipped(selected) ? null : selected.id, requestId: crypto.randomUUID() })}>
        {equipped(selected) ? "✓ 착용 중 · 해제" : "착용하기"}
      </button> : <button type="button" disabled={disabled} onClick={() => void execute({ kind: "purchase", item: selected.id, requestId: crypto.randomUUID() })}>구매 · {selected.price} 코인</button>}
    </div> : <div className="pet-catalog-grid">{SHOP.map((item) => <button type="button" key={item.id} className="pet-catalog-card" onClick={() => setSelected(item)}>
      <PetItemIcon item={item} /><strong>{item.name}</strong><span>{equipped(item) ? "✓ 착용 중" : owned(item) ? "✓ 보유" : `${item.price} 코인`}</span>
    </button>)}</div>}
  </PetSheet>;
}
