"use client";
import { useState } from "react";
import type { CatalogEntry } from "@/lib/domine/pet-catalog";
export default function PetItemIcon({ item, discovered = true }: { item: CatalogEntry; discovered?: boolean }) {
  const [failed, setFailed] = useState(false);
  const glyph = item.category.includes("자연") ? "♣" : item.category.includes("만남") ? "♟" : item.category.includes("옷") ? "◆" : item.category.includes("장난감") ? "●" : item.category.includes("장소") ? "⌂" : "✦";
  return item.asset && discovered && !failed
    // Optimized transparent WebP is shared with SVG equipment; loaded only inside an open sheet.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={item.asset} width={96} height={96} loading="lazy" decoding="async" alt="" onError={() => setFailed(true)} />
    : <span className="pet-silhouette" aria-label={`${item.category} 실루엣`}>{glyph}</span>;
}
