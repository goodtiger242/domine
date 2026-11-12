// Prints how level gaps and element matchups trade off: win rate and HP the player loses.
// node scripts/pet-balance-report.mjs  (no assertions; the balance test in pet-battle.test.mjs pins the bands)
import { loadTS } from "./pet-test-loader.mjs";

const { buildFighter, createBattle, stepRound, availableActions } = loadTS("lib/domine/battle/engine.ts");
const { matchup, previewDamage, moveFor } = loadTS("lib/domine/battle/rules.ts");
const { ELEMENTS } = loadTS("lib/domine/battle/moves.ts");
const { BREEDS } = loadTS("lib/domine/battle/data.ts");

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
export function duel({ level, gap, relation, samples = 12 }) {
  let wins = 0, lost = 0, n = 0;
  for (let i = 0; i < BREEDS.length; i++) {
    const element = ELEMENTS[i % 6], rate = { good: x => x > 1, normal: x => x === 1, weak: x => x < 1 }[relation];
    // "weak" means the opponent's element beats ours in both directions.
    const other = ELEMENTS.find(g => relation === "normal" ? matchup(element, g) === 1 && matchup(g, element) === 1 : rate(matchup(element, g)) && rate(1 / matchup(g, element)));
    if (!other) continue;
    const player = buildFighter(BREEDS[i].id, level, [], { element });
    const opponent = buildFighter(BREEDS[(i + 5) % BREEDS.length].id, Math.max(1, level - gap), [], { element: other, aiTier: "normal" });
    for (let seed = 0; seed < samples; seed++) {
      let state = createBattle({ seed: 70000 + seed * 101 + i * 17, player, opponent });
      while (!state.outcome) state = stepRound(state, policy(state)).state;
      n++; wins += state.outcome === "player"; lost += 1 - Math.max(0, state.player.hp) / state.player.stats.hp;
    }
  }
  return { win: Math.round(wins / n * 100), hpLost: Math.round(lost / n * 100), n };
}
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("pet-balance-report.mjs")) {
  const rows = [];
  for (const level of [16, 40]) for (const relation of ["weak", "normal", "good"]) for (const gap of [0, 3, 6, 12])
    rows.push({ level, relation, gap, ...duel({ level, gap, relation }) });
  console.log("| 내 레벨 | 상성 | 레벨 차 | 승률 | 잃은 체력 |\n|---:|---|---:|---:|---:|");
  for (const r of rows) console.log(`| ${r.level} | ${{ weak: "불리", normal: "보통", good: "유리" }[r.relation]} | +${r.gap} | ${r.win}% | ${r.hpLost}% |`);
}
