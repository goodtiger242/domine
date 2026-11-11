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

