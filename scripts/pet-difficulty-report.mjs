// Calibrates the difficulty colors: simulated win rate of real map animals against our dog, grouped by power ratio.
// node scripts/pet-difficulty-report.mjs [samples]   (prints a table; the cut points live in lib/domine/pet-difficulty.ts)
import { loadTS } from "./pet-test-loader.mjs";

const { createBattle, stepRound, availableActions } = loadTS("lib/domine/battle/engine.ts");
const { moveFor, previewDamage } = loadTS("lib/domine/battle/rules.ts");
const { spawnsFor } = loadTS("lib/domine/pet-battle-view.ts");
const { battlePlayer } = loadTS("lib/domine/pet-battle-view.ts");
const { powerRatio, foeDifficulty, DIFFICULTIES } = loadTS("lib/domine/pet-difficulty.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");

const rest = { kind: "rest" };
const expected = (action, actor, target, round) => {
  const move = moveFor(action); if (!move || move.kind !== "attack") return 0;
  const p = previewDamage(move, actor, target, round);
  return (p.min + p.max) / 2 * p.hitChance / 100 / (1 + p.preparationRounds);
};
function policy(state) {
  const actions = availableActions(state, "player"), actor = state.player, target = state.opponent;
  if (actor.charging) return actions[0];
  const attacks = actions.filter(a => moveFor(a)?.kind === "attack").sort((a, b) => expected(b, actor, target, state.round) - expected(a, actor, target, state.round));
  const best = attacks[0] ?? rest;
  return (actor.energy < 2 || !attacks.some(a => moveFor(a)?.energy >= 2)) && expected(best, actor, target, state.round) < target.hp && !moveFor(best)?.finisher ? rest : best;
}
const growth = (level, job) => ({ pet: 1, xp: 0, streak: 0, level, allocation: { hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 }, unspent: 0, allocationMode: "auto", job, jobTier: job ? 1 : 0, jobChangedAt: null, moves: [], version: 1, mastery: {}, inventory: {} });
const profile = { day: "x", levels: [3, 8, 14, 22, 36] };

export function sample({ levels = [5, 10, 16, 25, 40, 60], perLevel = 220, seeds = 4 } = {}) {
  const rows = [];
  for (const level of levels) for (const pet of [1, 2]) {
    const me = battlePlayer(pet, level, undefined, [], undefined, { ...growth(level, level >= 10 ? "striker" : null), pet });
    let n = 0;
    for (let slot = 9000; n < perLevel / 2 && slot < 9400; slot++) for (const cell of PET_WORLD) {
      for (const foe of spawnsFor(cell.id, level, slot, [], { profile })) {
        if (n >= perLevel / 2) break; n++;
        let wins = 0;
        for (let seed = 0; seed < seeds; seed++) {
          let state = createBattle({ seed: 31000 + seed * 101 + n * 7, player: me, opponent: foe.fighter });
          while (!state.outcome) state = stepRound(state, policy(state)).state;
          wins += state.outcome === "player";
        }
        rows.push({ level, ratio: powerRatio(me, foe.fighter), win: wins / seeds, difficulty: foeDifficulty(me, foe.fighter) });
      }
    }
  }
  return rows;
}
if (process.argv[1]?.endsWith("pet-difficulty-report.mjs")) {
  const rows = sample({ perLevel: Number(process.argv[2] ?? 220) });
  const pct = x => Math.round(x * 100);
  console.log(`samples ${rows.length}`);
  console.log("| 단계 | 개수 | 평균 승률 | 승률 범위(10~90%) |\n|---|---:|---:|---|");
  for (const d of DIFFICULTIES) {
    const g = rows.filter(r => r.difficulty === d).map(r => r.win).sort((a, b) => a - b);
    if (g.length) console.log(`| ${d} | ${g.length} | ${pct(g.reduce((a, b) => a + b, 0) / g.length)}% | ${pct(g[Math.floor(g.length * .1)])}~${pct(g[Math.floor(g.length * .9)])}% |`);
  }
  console.log("\nratio buckets:");
  const edges = [0, .3, .45, .65, .85, 1.05, 1.3, 1.75, 2.5, 4, 99];
  for (let i = 0; i < edges.length - 1; i++) {
    const g = rows.filter(r => r.ratio >= edges[i] && r.ratio < edges[i + 1]);
    if (g.length) console.log(`  ${edges[i]}~${edges[i + 1]}: n=${g.length} win ${pct(g.reduce((a, r) => a + r.win, 0) / g.length)}%`);
  }
  console.log("\nby player level (share of each color):");
  for (const level of [...new Set(rows.map(r => r.level))]) {
    const g = rows.filter(r => r.level === level);
    console.log(`  Lv.${level}: ` + DIFFICULTIES.map(d => `${d} ${pct(g.filter(r => r.difficulty === d).length / g.length)}%`).join("  "));
  }
}
