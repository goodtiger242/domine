/**
 * 도미 게임 소품 사진 (public/pet/art/*.webp, scripts/cut_sheet.py 로 만든 투명 배경 WebP).
 * 대본(PetScene)은 이모지로 소품을 고르고, 여기에 사진이 있으면 사진으로, 없으면 이모지로 그린다.
 */
const A = (name: string) => `/pet/art/${name}.webp`;

export const ART: Record<string, string> = {
  "🍖": A("meatbone"),
  "🍗": A("drumstick"),
  "🥩": A("steak"),
  "🥓": A("bacon"),
  "🍚": A("rice"),
  "🥕": A("carrot"),
  "🐟": A("fish"),
  "🦴": A("biscuit"),
  "🍪": A("cookie"),
  "🧀": A("cheese"),
  "🍩": A("donut"),
  "🪮": A("brush"),
  "🚿": A("shower"),
  "🪣": A("bucket"),
  "🧴": A("shampoo"),
  "🤚": A("hand_pet"),
  "🖐️": A("hand_pet"),
  "✋": A("hand_open"),
  "☝️": A("hand_point"),
  "🦋": A("butterfly"),
  "🐦": A("bird"),
  sponge: A("sponge"),
  towel: A("towel"),
};

export const BALL = A("ball");
export const BOWL = A("bowl");

/** 첫 화면에는 필요 없으니, 브라우저가 한가할 때 미리 받아 둔다 (한 번 받으면 브라우저가 저장해 둔다) */
export function preloadArt(extra: string[] = [], onLoad?: (src: string) => void) {
  const urls = Array.from(new Set([...Object.values(ART), BALL, BOWL, ...extra]));
  let cancelled = false;
  const go = () =>
    urls.forEach((u) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { if (!cancelled) onLoad?.(u); };
      img.src = u;
    });
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const idle = !!w.requestIdleCallback;
  const id = idle ? w.requestIdleCallback!(go, { timeout: 4000 }) : window.setTimeout(go, 2500);
  return () => {
    cancelled = true;
    if (idle) window.cancelIdleCallback(id);
    else window.clearTimeout(id);
  };
}
