"use client";
import { useState } from "react";
import { SHOP, type CatalogEntry } from "@/lib/domine/pet-catalog";
import type { PetCommand, V6Result } from "@/lib/domine/pet-rpc";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import PetSheet from "./PetSheet";
import PetItemIcon from "./PetItemIcon";
export default function PetShopSheet({ state, petId, disabled, notice, execute, onClose, bag = false }: {
  bag?: boolean; state: V6Result | null; petId: PetId; disabled: boolean; notice: string; execute: (c: PetCommand) => Promise<void>; onClose: () => void;
}) {
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [done, setDone] = useState("");
  const [asked, setAsked] = useState<{ id: string; on: boolean } | null>(null);
  const dog = PETS[petId].name;
  async function buy(item: CatalogEntry) {
    const coins = state?.player?.coins ?? 0, price = item.price ?? 0;
    if (coins < price) { setDone(`코인이 부족해요 · 보유 ${coins} / 필요 ${price} (${price - coins}코인 더 필요)`); return; }
    setDone("");
    await execute({ kind: "purchase", pet: petId, item: item.id, requestId: crypto.randomUUID() });
  }
  async function wear(item: CatalogEntry) {
    const on = !equipped(item);
    setDone("");
    setAsked({ id: item.id, on });
    await execute({ kind: "equip", pet: petId, slot: item.slot!, item: on ? item.id : null, requestId: crypto.randomUUID() });
  }
  const owned = (item: CatalogEntry) => state?.inventory?.includes(item.id);
  const equipped = (item: CatalogEntry) => state?.equipment?.some((e) => e.pet_id === petId && e.item_id === item.id);
  return <PetSheet title={selected?.name ?? (bag ? `${dog}의 가방` : "상점")} onClose={onClose} onBack={() => { if (!selected) return false; setSelected(null); return true; }}>
    <p className="pet-sheet-note">우리 코인(공용) {state?.coins ?? state?.player?.coins ?? 0} · {dog}의 상점</p>
    {notice && <p className="pet-sheet-note" role="status">{notice}</p>}
    {selected ? <div className="pet-product-detail">
      <button type="button" onClick={() => setSelected(null)}>‹ 목록으로</button>
      <PetItemIcon item={selected} />
      <h3>{selected.name}</h3><p>{selected.price} 코인 · {selected.category}</p>
      {owned(selected) && <span className="pet-purchase-check" role="status">✓ {dog} 보유</span>}
      {owned(selected) && <span className="pet-purchase-check" role="status">{equipped(selected) ? `✓ ${dog}가 착용 중이에요` : `${dog}는 아직 안 입었어요`}</span>}
      {asked?.id === selected.id && owned(selected) && (!!equipped(selected) === asked.on
        ? <span className="pet-purchase-check" role="status">{asked.on ? `${dog}에게 착용했어요` : `${dog}의 착용을 해제했어요`}</span>
        : <span className="pet-purchase-check" role="alert">{disabled ? "적용하는 중이에요…" : "아직 적용되지 않았어요. 잠시 뒤 다시 눌러 주세요."}</span>)}
      {owned(selected) ? <button type="button" disabled={disabled} onClick={() => void wear(selected)}>
        {equipped(selected) ? "착용 해제" : `${dog}에게 착용하기`}
      </button> : <button type="button" disabled={disabled} onClick={() => buy(selected)}>{dog}용 구매 · {selected.price} 코인</button>}
      {!owned(selected) && done && <span className="pet-purchase-check" role="alert">{done}</span>}
    </div> : <div className="pet-catalog-grid">{bag && !SHOP.some(owned) && <p className="pet-sheet-note">아직 가진 물건이 없어요. 상점에서 코인으로 살 수 있어요.</p>}{SHOP.filter((item) => !bag || owned(item)).map((item) => <button type="button" key={item.id} className="pet-catalog-card" onClick={() => { setSelected(item); setDone(""); setAsked(null); }}>
      <PetItemIcon item={item} /><strong>{item.name}</strong><span>{equipped(item) ? `✓ ${dog} 착용 중` : owned(item) ? `✓ ${dog} 보유` : `${dog}용 구매 · ${item.price} 코인`}</span>
    </button>)}</div>}
  </PetSheet>;
}
