import { BREED_BY_ID, MOVES } from "./data";
import { ELEMENTS, SPECIES } from "./moves";
import { JOB_LEVELS, jobBonus, selectedJob, skillPoints } from "./jobs";
import type { FighterOptions, Group, Job, Move, Species } from "./types";

export const moveSlots = (level: number) => Math.min(8, 4 + Math.floor(level / 25));
/** A job adds two extra slots that only its own skills can fill. */
export const JOB_SLOTS = 2;
/** The job skills used in battle: the newest attack and the newest non-attack (or the newest two of one kind). */
export function jobSkills(learned: readonly string[]): string[] {
  const own = learned.map(id => MOVES.find(m => m.id === id)!).filter(m => m?.learn?.job).sort((a, b) => b.learn!.level - a.learn!.level);
  const attack = own.find(m => m.kind === "attack"), other = own.find(m => m.kind !== "attack");
  return (attack && other ? [attack, other] : own.slice(0, JOB_SLOTS)).map(m => m.id);
}
export function validateJob(job: Job, level: number) {
  jobBonus(job.id,job.tier);
  if (level < JOB_LEVELS[job.tier - 1]) throw new Error("전직 레벨이 부족합니다.");
  if (!job.nodes) return;
  let points = 0;
  for (const [id,rank] of Object.entries(job.nodes)) {
    const move = MOVES.find(m => m.id === id), rule = move?.learn;
    if (!rule || rule.job !== job.id || rule.level > level || (rule.tier ?? 1) > job.tier || ![1,2].includes(rank)
      || rule.prerequisite && !job.nodes[rule.prerequisite]) throw new Error("직업 노드·선행 기술을 확인해 주세요.");
    points += rank === 2 ? 3 : 1;
  }
  if (points > skillPoints(level)) throw new Error("기술 포인트가 부족합니다.");
}
const basic: Record<Group, string[]> = {
  rush: ["T03","T43","T14","T26","T60","T18"], trick: ["T13","T19","T37","T50","T21","T18"],
  track: ["T25","T31","T34","T03","T28","T26"], guard: ["T37","T43","T49","T26","T60","T51"],
  bond: ["T50","T43","T58","T01","T21","T49"], endure: ["T61","T67","T60","T28","T63","T65"],
};
export function learnset(species: Species, breedId: string, element: Group, level: number, job?: FighterOptions["job"]): string[] {
  if (!SPECIES.includes(species) || !ELEMENTS.includes(element) || !Number.isInteger(level) || level < 1 || level > 999) throw new Error("학습 대상·기운·레벨을 확인해 주세요.");
  const selected = selectedJob(job);
  if (selected) validateJob(selected,level);
  const old = species === "dog" && BREED_BY_ID[breedId] ? BREED_BY_ID[breedId].learn : basic[element].map((move,i) => ({ move, level: [1,1,5,10,18,26][i] }));
  return [...new Set([...old.filter(l => l.level <= level).map(l => l.move), ...MOVES.filter(move => {
    const rule = move.learn;
    if (!move.id.startsWith("M")) return move.common;
    if (!rule || rule.level > level || rule.species && rule.species !== species || rule.breedId && rule.breedId !== breedId) return false;
    if (rule.job) return selected?.id === rule.job && selected.tier >= rule.tier! && (!selected.nodes || !!selected.nodes[move.id]);
    return move.source !== "element" || move.group === element;
  }).map(m => m.id)])];
}

export function autoMoves(pool: readonly string[], level: number): string[] {
  const moves = pool.map(id => MOVES.find(m => m.id === id)!).filter(Boolean);
  const chosen: string[] = [];
  const pick = (predicate: (m: Move) => boolean, score: (m: Move) => number = m => m.learn?.level ?? 1) => {
    const candidate = moves.filter(m => !chosen.includes(m.id) && predicate(m)).sort((a,b) => score(b)-score(a) || a.id.localeCompare(b.id))[0];
    if (candidate) chosen.push(candidate.id);
  };
  pick(m => m.kind === "attack" && m.energy >= 2 && m.energy <= 4 && !m.breaksDefense && m.mode === "normal", m => m.power + (m.contact ? .01 : 0));
  pick(m => m.kind === "defense" && m.defense === "guard");
  pick(m => m.source === "breed" || m.source === "species");
  const primary = moves.find(m => m.id === chosen[0]);
  pick(m => m.kind === "attack" && !m.breaksDefense && m.mode === "normal" && m.contact !== primary?.contact, m => m.power + (m.group === "neutral" ? 4 : 0));
  if (level >= 25) pick(m => m.defense === "counter");
  if (level >= 50) pick(m => m.kind === "attack" && m.energy >= 5);
  if (level >= 75) pick(m => !!m.breaksDefense);
  if (level >= 100) pick(m => m.kind === "support");
  for (const move of moves) if (chosen.length < moveSlots(level) && !chosen.includes(move.id)) chosen.push(move.id);
  return chosen.slice(0,moveSlots(level));
}
