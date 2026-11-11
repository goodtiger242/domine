import type { PetState } from "./pet";

export function fallingNeeds(previous: PetState, next: PetState, seen: Set<string>) {
  const keys = { fullness: "idle_hungry", mood: "idle_sad", clean: "idle_dirty" } as const;
  return (Object.keys(keys) as (keyof typeof keys)[]).flatMap((stat) => {
    let crossed = false;
    for (const boundary of [20, 40, 60, 80]) {
      const key = `${stat}:${boundary}`;
      if (previous[stat] >= boundary && next[stat] < boundary && !seen.has(key)) {
        seen.add(key); crossed = true;
      }
    }
    return crossed ? [keys[stat]] : [];
  });
}
