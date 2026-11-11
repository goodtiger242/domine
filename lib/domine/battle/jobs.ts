import type { Job, JobId, Stats } from "./types";

export const JOBS = {
  rush: { names: ["돌격수", "선봉수", "선봉대장"], bonus: { attack: .04, speed: .04, calm: -.04 } },
  guard: { names: ["수비수", "보루지기", "마당수호자"], bonus: { hp: .04, defense: .04, speed: -.04 } },
  trick: { names: ["기교가", "발놀림꾼", "흐름지배자"], bonus: { speed: .04, focus: .04, defense: -.04 } },
  track: { names: ["추적자", "길잡이", "길목지기"], bonus: { focus: .04, attack: .04, hp: -.04 } },
  bond: { names: ["교감사", "호흡지기", "동네연결자"], bonus: { calm: .04, focus: .04, attack: -.04 } },
} as const;
export const JOB_LEVELS = [10, 30, 60] as const;
export function jobBonus(job: JobId, tier: number): Partial<Stats> {
  if (!Object.hasOwn(JOBS, job) || ![1, 2, 3].includes(tier)) throw new Error("직업·전직 단계를 확인해 주세요.");
  return Object.fromEntries(Object.entries(JOBS[job].bonus).map(([stat, value]) => [stat, value * [1, 1.5, 2][tier - 1]]));
}
export function selectedJob(job?: Partial<Stats> | Job | JobId): Job | undefined {
  return typeof job === "string" ? { id: job, tier: 1 } : job && "id" in job ? job : undefined;
}
export function skillPoints(level: number): number {
  return [10,15,20,25,30,35,40,45,50,60,70,80].filter(l => l <= level).length;
}
