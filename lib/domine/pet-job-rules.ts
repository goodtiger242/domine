import { JOBS, JOB_LEVELS, jobBonus } from "./battle/jobs";
import { MOVES } from "./battle/data";
import type { JobId, Move, Stat, Stats } from "./battle/types";
import type { KingJob, KingProgress } from "./pet-king-rpc";

/** Server job names and the battle engine's job ids. */
export const KING_JOB_IDS = { striker: "rush", defender: "guard", trickster: "trick", tracker: "track", empath: "bond" } as const satisfies Record<KingJob, JobId>;
export const KING_JOBS = Object.keys(KING_JOB_IDS) as KingJob[];
export const JOB_INFO: Record<KingJob, { icon: string; line: string }> = {
  striker: { icon: "⚡", line: "먼저 움직이고 세게 밀어요" },
  defender: { icon: "🛡", line: "버티다가 받아쳐요" },
  trickster: { icon: "🌀", line: "빠르게 흔들고 피해요" },
  tracker: { icon: "🎯", line: "움직임을 읽고 정확히 쳐요" },
  empath: { icon: "🤝", line: "마음을 가라앉히고 회복해요" },
};
// Mirrors domine_pet_king_v17 'chooseJob'; the server stays the authority.
export const JOB_COSTS = [0, 120, 300] as const, JOB_SWITCH_COST = 300, JOB_MARKS = [1, 3, 6] as const, FIRST_REGION = "R01";
export type JobBlock = { kind: "level"; need: number } | { kind: "boss" } | { kind: "marks"; have: number; need: number }
  | { kind: "coins"; have: number; need: number } | { kind: "cooldown"; hours: number };
export type JobPlan = { tier: 1 | 2 | 3; step: "start" | "promote" | "switch" | "max"; cost: number; blocks: JobBlock[] };

/** What choosing `job` would do right now and what still blocks it. `regions` are this dog's region certificates. */
export function jobPlan(growth: Pick<KingProgress, "level" | "job" | "jobTier" | "jobChangedAt"> | undefined, job: KingJob,
  have: { coins: number; regions: readonly string[]; now?: number }): JobPlan {
  const current = growth?.job ?? null, held = Math.max(0, Math.min(3, growth?.jobTier ?? 0)), level = growth?.level ?? 1;
  const blocks: JobBlock[] = [];
  if (current && current !== job) {
    const tier = Math.max(1, held) as 1 | 2 | 3, since = growth?.jobChangedAt ? Date.parse(growth.jobChangedAt) : NaN;
    const left = Number.isFinite(since) ? since + 86400000 - (have.now ?? Date.now()) : 0;
    if (left > 0) blocks.push({ kind: "cooldown", hours: Math.ceil(left / 3600000) });
    if (have.coins < JOB_SWITCH_COST) blocks.push({ kind: "coins", have: have.coins, need: JOB_SWITCH_COST });
    return { tier, step: "switch", cost: JOB_SWITCH_COST, blocks };
  }
  if (current && held >= 3) return { tier: 3, step: "max", cost: 0, blocks };
  const tier = (current ? held + 1 : 1) as 1 | 2 | 3, cost = JOB_COSTS[tier - 1];
  if (level < JOB_LEVELS[tier - 1]) blocks.push({ kind: "level", need: JOB_LEVELS[tier - 1] });
  if (tier === 1 ? !have.regions.includes(FIRST_REGION) : have.regions.length < JOB_MARKS[tier - 1])
    blocks.push(tier === 1 ? { kind: "boss" } : { kind: "marks", have: have.regions.length, need: JOB_MARKS[tier - 1] });
  if (have.coins < cost) blocks.push({ kind: "coins", have: have.coins, need: cost });
  return { tier, step: current ? "promote" : "start", cost, blocks };
}

export const jobName = (job: KingJob, tier: number) => JOBS[KING_JOB_IDS[job]].names[Math.max(1, Math.min(3, tier)) - 1];
/** Percent changes of a job at a tier, strongest gain first. */
export function jobChanges(job: KingJob, tier: 1 | 2 | 3): { stat: Stat; percent: number }[] {
  return Object.entries(jobBonus(KING_JOB_IDS[job], tier)).map(([stat, rate]) => ({ stat: stat as Stat, percent: Math.round(Number(rate) * 100) }))
    .sort((a, b) => b.percent - a.percent);
}
/** The six skills of a job in the order they open. */
export const jobMoves = (job: KingJob): Move[] => MOVES.filter(m => m.learn?.job === KING_JOB_IDS[job]).sort((a, b) => a.learn!.level - b.learn!.level);
/** The job whose gains match this dog's strongest stats and whose loss hits its weakest. */
export function recommendedJob(stats: Stats): KingJob {
  const keys = (Object.keys(stats) as Stat[]).filter(k => k !== "hp"), mean = keys.reduce((sum, k) => sum + stats[k], 0) / keys.length || 1;
  const score = (job: KingJob) => Object.entries(JOBS[KING_JOB_IDS[job]].bonus).reduce((sum, [stat, rate]) => sum + Math.sign(rate) * (stat === "hp" ? 1 : stats[stat as Stat] / mean), 0);
  return [...KING_JOBS].sort((a, b) => score(b) - score(a))[0];
}
