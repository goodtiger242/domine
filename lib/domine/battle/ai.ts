import { ITEM_BY_ID, MOVE_BY_ID } from "./data";
import { availableActions, damageAt, hitChance, moveFor, previewDamage, recoveryLeft } from "./rules";
import { random } from "./rng";
import type { Action, BattleState } from "./types";

export function chooseOpponentAction(state: BattleState): { action: Action; rng: number } {
  const actor = state.opponent, target = state.player;
  const actions = availableActions(state, "opponent");
  if (actor.charging) return { action: actions[0], rng: state.rng };
  const attacks = actor.moves.filter(id => MOVE_BY_ID[id].kind === "attack");
  if (attacks.length && !attacks.some(id => actions.some(a => a.kind === "move" && a.moveId === id))) return { action: { kind: "rest" }, rng: state.rng };
  const ranked = actions.map(action => {
    const move = moveFor(action);
    let score = action.kind === "rest" && actor.energy <= 2 ? 20 : 0;
    if (move?.kind === "attack") {
      const preparation = move.mode === "charge" ? 1 : 0;
      const preview = move.mode === "multi" ? previewDamage(move,actor,target,state.round) : undefined;
      const damage = (preview ? (preview.min + preview.max) / 2 : damageAt(move,actor,target,1,state.round)) * hitChance(move,actor,target,state.round) / 100;
      score = damage / target.stats.hp * 100 / (1 + preparation) + (!preparation && damage >= target.hp ? 40 : 0);
      if (preparation && (state.round === 12 || actor.hp < actor.stats.hp * .25)) score = 0;
      if (move.mode === "recoil") score -= (move.recoil?.energy ?? 0) + (move.recoil?.rate ?? 0) * 20;
    }
    const item = action.kind === "item" ? ITEM_BY_ID[action.itemId] : undefined;
    if ((move?.heal || item?.heal) && recoveryLeft(actor) && actor.hp < actor.stats.hp * .4) score += 25;
    if (item?.energy && actor.energy <= 2) score += 20;
    if (move?.kind === "defense") {
      if ((target.lastAction && (moveFor(target.lastAction)?.power ?? 0) >= 22) || actor.hp < actor.stats.hp * .4) score += 15;
      if (actor.lastDefense === state.round - 1) score -= 15;
    }
    if (move?.buff && !actor.buffs.some(b => b.stat === move.buff)) score += 8;
    const id = action.kind === "move" ? action.moveId : action.kind === "item" ? action.itemId : action.kind;
    return { action, score, id };
  }).filter(a => a.score > 0).sort((a,b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const weights = state.difficulty === "hard" ? [.9,.1] : [.6,.3,.1];
  const candidates = ranked.slice(0, weights.length);
  const draw = random(state.rng);
  let pick = draw.value * weights.slice(0,candidates.length).reduce((sum,w) => sum+w,0);
  for (let i = 0; i < candidates.length; i++) {
    pick -= weights[i];
    if (pick < 0) return { action: candidates[i].action, rng: draw.seed };
  }
  return { action: { kind: "rest" }, rng: draw.seed };
}
