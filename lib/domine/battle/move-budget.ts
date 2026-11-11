import type { Move } from "./types";

export const POWER_DEDUCTIONS = { status: .10, priority: .10, buff: .10, multi: .05, charge: .05, breaksDefense: .10 } as const;
export function powerBudget(energy: number, extra: Partial<Move> = {}): number {
  const deduction = (extra.status ? POWER_DEDUCTIONS.status : 0) + (extra.priority ? POWER_DEDUCTIONS.priority : 0)
    + (extra.buff ? POWER_DEDUCTIONS.buff : 0) + (extra.breaksDefense ? POWER_DEDUCTIONS.breaksDefense : 0)
    + (extra.mode === "multi" ? POWER_DEDUCTIONS.multi : extra.mode === "charge" ? POWER_DEDUCTIONS.charge : 0);
  const adjustment = deduction === 0 && energy > 0 ? energy <= 2 ? .9 : 1.09 : 1;
  return Math.round((10 + 4 * energy) * (1 - deduction) * adjustment * 100) / 100;
}
