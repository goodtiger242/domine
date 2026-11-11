import { chooseOpponentAction } from "./ai";
import { BREED_BY_ID, ITEM_BY_ID } from "./data";
import { actionOrder, availableActions, buildFighter, clamp, critChance, damageAt, defenseMultiplier, effectHint, growthScale, hitChance, matchup, MAX_ENERGY, MAX_ROUNDS, moveFor, normalizedStat, recoveryLeft, REST_ENERGY, sameAction, START_ENERGY, statusChance, turnOrder } from "./rules";
import { random } from "./rng";
import type { Action, Actor, BattleEvent, BattleState, Difficulty, Fighter, Outcome, RoundInput, Side } from "./types";

export { availableActions, buildFighter, effectHint, previewDamage, cumulativeXp, levelFromXp, xpToNext, growthQ, growthScale, recommendedAllocation, conditionPenalty, critChance, MAX_LEVEL } from "./rules";
export { opponentFor } from "./opponents";
export { turnOrder, MAX_ENERGY, START_ENERGY, REST_ENERGY } from "./rules";

function cloneActor(actor: Actor): Actor {
  return { ...actor, stats: { ...actor.stats }, moves: [...actor.moves], equipment: [...actor.equipment],
    items: actor.items && [...actor.items], usedItems: [...(actor.usedItems ?? [])], defense: actor.defense && { ...actor.defense },
    allocation: actor.allocation && { ...actor.allocation }, job: actor.job && { ...actor.job }, condition: actor.condition && { ...actor.condition }, mastery: actor.mastery && { ...actor.mastery },
    habitats: actor.habitats && [...actor.habitats], activeBands: actor.activeBands && [...actor.activeBands], environment: actor.environment && { ...actor.environment }, recoil: actor.recoil && { ...actor.recoil },
    statuses: actor.statuses.map(s => ({ ...s })), buffs: actor.buffs.map(b => ({ ...b })),
    shield: actor.shield && { ...actor.shield }, lastAction: actor.lastAction && { ...actor.lastAction } };
}
function newActor(fighter: Fighter, energy: number): Actor {
  const canonical = buildFighter(fighter.breedId, fighter.level, fighter.equipment, {
    moves: fighter.moves, consumable: fighter.consumable, allocation: fighter.allocation, job: fighter.job,
    condition: fighter.condition, mastery: fighter.mastery, movementType: fighter.movementType,
    habitats: fighter.habitats, activeBands: fighter.activeBands, environment: fighter.environment,
    items: fighter.items, owned: fighter.owned, boss: fighter.boss, equipmentStats: fighter.equipmentStats, finisher: fighter.finisher,
  });
  if (Object.entries(canonical.stats).some(([key,value]) => fighter.stats[key as keyof Fighter["stats"]] !== value)) throw new Error("출전 스탯이 견종·레벨·장비와 다릅니다.");
  return { ...canonical, hp: canonical.stats.hp, energy, healed: 0, itemUsed: false, usedItems: [], momentum: 0, statuses: [], buffs: [], lastDefense: -1, traitUsed: false, rested: false };
}
export function createBattle(input: { seed: number; player: Fighter; opponent: Fighter; startEnergyBonus?: 0 | 1; difficulty?: Difficulty; criticals?: boolean }): BattleState {
  if (!Number.isSafeInteger(input.seed)) throw new Error("시드는 안전한 정수여야 합니다.");
  if (input.startEnergyBonus !== undefined && input.startEnergyBonus !== 0 && input.startEnergyBonus !== 1) throw new Error("시작 기력 보너스는 0 또는 1입니다.");
  if (input.difficulty && input.difficulty !== "normal" && input.difficulty !== "hard") throw new Error("올바른 난이도가 아닙니다.");
  if (input.criticals !== undefined && typeof input.criticals !== "boolean") throw new Error("크리티컬 설정은 참/거짓입니다.");
  const state: BattleState = { round: 1, rng: input.seed >>> 0,
    player: newActor(input.player,Math.min(MAX_ENERGY,START_ENERGY + (input.startEnergyBonus ?? 0))), opponent: newActor(input.opponent,START_ENERGY),
    difficulty: input.difficulty ?? "normal", criticals: input.criticals ?? true, opponentAction: { kind: "rest" } };
  const forecast = chooseOpponentAction(state);
  return { ...state, opponentAction: forecast.action, rng: forecast.rng };
}

type EventPayload = BattleEvent extends infer E ? E extends BattleEvent ? Omit<E, "round"> : never : never;
export function stepRound(previous: BattleState, playerAction: Action, input: RoundInput = {}): { state: BattleState; events: BattleEvent[] } {
  if (previous.outcome) throw new Error("이미 끝난 대결입니다.");
  for (const timing of [input.attackTiming,input.guardTiming]) if (timing !== undefined && !["miss","good","perfect"].includes(timing)) throw new Error("타이밍은 miss/good/perfect입니다.");
  for (const [side,action] of [["player",playerAction],["opponent",previous.opponentAction]] as const) {
    if (!availableActions(previous,side).some(a => sameAction(a,action))) throw new Error("사용할 수 없는 행동입니다.");
  }
  const state: BattleState = { ...previous, player: cloneActor(previous.player), opponent: cloneActor(previous.opponent), opponentAction: { ...previous.opponentAction } };
  const events: BattleEvent[] = [];
  const emit = (event: EventPayload) => events.push({ ...event, round: state.round } as BattleEvent);
  const draw = () => { const next = random(state.rng); state.rng = next.seed; return next.value; };
  const finish = (outcome: Outcome, reason: "hp" | "limit" | "quit") => { state.outcome = outcome; emit({ type: "end", outcome, reason }); };
  const cancelled = new Set<Side>();
  const momentum = (side: Side, amount: number) => {
    const actor = state[side], before = actor.momentum ?? 0;
    actor.momentum = clamp(before + amount,0,100);
    emit({ type: "momentum", side, amount: actor.momentum - before, momentum: actor.momentum });
  };
  const hurt = (side: Side, targetSide: Side, damage: number, critical = false) => {
    const target = state[targetSide];
    let amount = Math.min(target.hp,damage);
    if (amount >= target.hp && target.survival && !target.survivalUsed) {
      amount = target.hp - 1; target.survival = false; target.survivalUsed = true;
      emit({ type: "survive", side: targetSide });
    }
    target.hp -= amount;
    emit({ type: "damage", side, target: targetSide, amount, hp: target.hp, ...(critical ? { critical: true as const } : {}) });
    if (amount > 0) momentum(targetSide,8);
  };
  const energy = (side: Side, amount: number, reason: Extract<BattleEvent,{ type: "energy" }>["reason"]) => {
    const actor = state[side], before = actor.energy;
    actor.energy = clamp(actor.energy + amount,0,MAX_ENERGY);
    emit({ type: "energy", side, amount: actor.energy - before, energy: actor.energy, reason });
  };
  const heal = (side: Side, ratio: number) => {
    const actor = state[side], amount = Math.min(Math.floor(actor.stats.hp * ratio),recoveryLeft(actor));
    actor.hp += amount; actor.healed += amount;
    emit({ type: "heal", side, amount, hp: actor.hp });
  };
  const removeShield = (side: Side) => {
    const actor = state[side];
    if (actor.shield) emit({ type: "shield", side, multiplier: actor.shield.multiplier, change: "removed" });
    delete actor.shield;
  };
  const applyStatus = (side: Side, id: NonNullable<ReturnType<typeof moveFor>>["status"], forced = false) => {
    if (!id) return;
    const actor = state[side];
    if (!forced && actor.defense?.kind === "stance" && actor.defense.expires >= state.round) {
      emit({ type: "status", side, status: id, change: "blocked" }); return;
    }
    if (!forced && BREED_BY_ID[actor.breedId].trait === "statusImmune" && !actor.traitUsed) {
      actor.traitUsed = true; emit({ type: "status", side, status: id, change: "blocked" }); return;
    }
    const existing = actor.statuses.find(s => s.id === id);
    if (existing) existing.expires = state.round + 1;
    else {
      if (actor.statuses.length === 2) {
        actor.statuses.sort((a,b) => a.applied - b.applied || (a.id < b.id ? -1 : 1));
        emit({ type: "status", side, status: actor.statuses.shift()!.id, change: "removed" });
      }
      actor.statuses.push({ id, applied: state.round, expires: state.round + 1 });
    }
    emit({ type: "status", side, status: id, change: "applied" });
  };
  const execute = (side: Side, action: Action) => {
    const targetSide: Side = side === "player" ? "opponent" : "player";
    const actor = state[side], target = state[targetSide], trait = BREED_BY_ID[actor.breedId].trait;
    if (cancelled.has(side)) { delete actor.charging; return; }
    if (moveFor(action)?.kind === "defense" && actor.statuses.some(s => s.id === "stagger" && s.expires >= state.round)) return;
    if (action.kind === "move" && moveFor(action)?.mode === "charge") action = { ...action, phase: actor.charging ? "release" : "prepare" };
    emit({ type: "action", side, action: { ...action } });
    const lastAction = actor.lastAction;
    actor.lastAction = { ...action };
    if (action.kind === "quit") { finish("quit","quit"); return; }
    if (action.kind === "rest") { actor.rested = true; energy(side,REST_ENERGY - (actor.statuses.some(s => s.id === "winded") ? 1 : 0),"rest"); return; }
    if (action.kind === "item") {
      const item = ITEM_BY_ID[action.itemId]; actor.itemUsed = true;
      (actor.usedItems ??= []).push(item.id);
      if (item.energy) energy(side,item.energy,"item");
      if (item.heal) heal(side,item.heal);
      if (item.buff) {
        actor.buffs.push({ stat: item.buff, rate: .20, item: true, expires: state.round + 2 });
        emit({ type: "buff", side, stat: item.buff, change: "applied" });
      }
      if (item.category === "cleanse") {
        for (const status of actor.statuses) emit({ type: "status", side, status: status.id, change: "removed" });
        actor.statuses = []; delete actor.exposedUntil;
      }
      if (item.category === "protect") {
        actor.shield = { multiplier: .5, expires: MAX_ROUNDS };
        emit({ type: "shield", side, multiplier: .5, change: "applied" });
      }
      if (item.category === "critical") actor.guaranteedCritical = true;
      if (item.category === "survive") actor.survival = true;
      if (item.category === "cancel" && !target.boss) { cancelled.add(targetSide); emit({ type: "cancel", side, target: targetSide }); }
      return;
    }
    const move = moveFor(action)!;
    if (move.finisher) { momentum(side,-100); emit({ type: "finisher", side, moveId: move.id }); }
    if (actor.charging === move.id) delete actor.charging;
    else {
      energy(side,-move.energy,"cost");
      if (move.mode === "charge") { actor.charging = move.id; return; }
    }
    if (move.mode === "recoil") actor.recoil = { ...move.recoil, expires: state.round + 1 };
    if (move.kind === "attack") {
      const hits = move.mode === "multi" ? move.hits ?? 2 : 1;
      const guaranteedCritical = actor.guaranteedCritical;
      actor.guaranteedCritical = false;
      let connected = false;
      for (let hit = 0; hit < hits; hit++) {
        if (Math.floor(draw() * 10000) >= hitChance(move,actor,target,state.round) * 100) {
          emit({ type: "miss", side, target: targetSide, moveId: move.id }); continue;
        }
        emit({ type: "hit", side, target: targetSide, moveId: move.id });
        connected = true;
        // Consume the same draw with criticals disabled so simulation pairs share their RNG stream.
        const criticalRoll = draw();
        const defense = target.defense && target.defense.expires >= state.round ? target.defense : undefined;
        const defending = !!defense || moveFor(targetSide === "player" ? playerAction : state.opponentAction)?.kind === "defense";
        const critical = state.criticals !== false && !defending && (guaranteedCritical || criticalRoll * 100 < critChance(actor));
        const timing = side === "player" ? input.attackTiming === "perfect" ? 1.1 : input.attackTiming === "good" ? 1.05 : 1 : 1;
        const guardTiming = targetSide === "player" && defense ? input.guardTiming === "perfect" ? .8 : input.guardTiming === "good" ? .9 : 1 : 1;
        const amount = Math.floor(damageAt(move,actor,target,[.95,1,1.05][Math.floor(draw() * 3)],state.round) * (critical ? 1.5 : 1) * timing * guardTiming);
        emit({ type: "effectiveness", side, target: targetSide, hint: effectHint(move,actor,target), multiplier: matchup(move.group,BREED_BY_ID[target.breedId].group,actor,target) });
        hurt(side,targetSide,amount,critical);
        if (!move.finisher && amount > 0 && effectHint(move,actor,target) === "good") momentum(side,15);
        if (!move.finisher && critical) momentum(side,20);
        actor.rested = false;
        if ((trait === "firstTrack" && move.group === "track") || (trait === "firstBond" && move.group === "bond") || (trait === "firstRush" && move.group === "rush")) actor.traitUsed = true;
        if (amount > 0 && BREED_BY_ID[target.breedId].trait === "firstShield") target.traitUsed = true;
        if (amount > 0) removeShield(targetSide);
        if (target.hp === 0) { finish(side,"hp"); return; }
        if (move.breaksDefense && defense) {
          delete target.defense; removeShield(targetSide);
          emit({ type: "shield", side: targetSide, multiplier: 1, change: "removed" });
          emit({ type: "break", side, target: targetSide });
          applyStatus(targetSide,"stagger",true);
          emit({ type: "stagger", side, target: targetSide });
        } else if (defense && !defense.triggered && defenseMultiplier(move,target,state.round) < 1) {
          defense.triggered = true;
          if (targetSide === "player" && input.guardTiming === "perfect") energy(targetSide,1,"trait");
          if (defense.kind === "guard") { energy(targetSide,1,"trait"); momentum(targetSide,10); }
          if (defense.kind === "counter" && move.contact) {
            momentum(targetSide,30); emit({ type: "counter", side: targetSide, target: side });
            const retaliation = Math.max(1,Math.floor((10 + .45 * normalizedStat(target,"defense",state.round)) * growthScale(target.level) * defense.strength));
            const stance = actor.defense?.kind === "stance" && actor.defense.expires >= state.round ? 1 - .3 * actor.defense.strength : 1;
            hurt(targetSide,side,Math.floor(retaliation * (actor.shield?.multiplier ?? 1) * stance * (actor.exposedUntil === state.round ? 1.25 : 1)));
            removeShield(side);
            if (actor.hp === 0) { finish(targetSide,"hp"); return; }
          }
          if (defense.kind === "evade" && (move.mode === "charge" || move.finisher || move.mode === "multi")) {
            energy(side,-Math.max(1,Math.floor((move.mode === "multi" ? 1 : 2) * defense.strength)),"cost"); emit({ type: "evade", side: targetSide, target: side });
          }
        }
        if (amount > 0 && move.status && Math.floor(draw() * 10000) < statusChance(move,actor,target) * 100) applyStatus(targetSide,move.status);
      }
      if (!connected) return;
    }
    if (move.kind === "defense") {
      const strength = actor.lastDefense === state.round - 1 && lastAction && moveFor(lastAction)?.defense === move.defense ? .5 : 1;
      actor.defense = { kind: move.defense ?? "guard", expires: state.round + (move.defense === "stance" ? 1 : 0), strength };
      actor.lastDefense = state.round;
      emit({ type: "shield", side, multiplier: 1 - (move.defense === "stance" ? .3 : .6) * strength, change: "applied" });
      const targetAction = targetSide === "player" ? playerAction : state.opponentAction;
      const targetMove = moveFor(targetAction);
      if (move.defense === "counter" && (!targetMove || targetMove.kind !== "attack" || targetMove.mode === "charge" && !previous[targetSide].charging || cancelled.has(targetSide))) {
        actor.exposedUntil = state.round + 1;
        emit({ type: "status", side, status: "open", change: "applied" });
      }
    }
    if (move.buff) {
      const extra = trait === "longBuff" && !actor.traitUsed ? 1 : 0;
      if (extra) actor.traitUsed = true;
      const existing = actor.buffs.find(b => b.stat === move.buff);
      if (existing && !existing.item) existing.expires = state.round + 1 + extra;
      else if (!existing) actor.buffs.push({ stat: move.buff, expires: state.round + 1 + extra });
      emit({ type: "buff", side, stat: move.buff, change: "applied" });
    }
    if (move.heal) heal(side,move.heal);
  };
  const order = turnOrder(state,playerAction);
  if (actionOrder(state,playerAction) === 0) draw();
  const turns: [Side,Action][] = order.map(side => [side,side === "player" ? playerAction : state.opponentAction]);
  for (const [side,action] of turns) { execute(side,action); if (state.outcome) return { state, events }; }
  for (const side of ["player","opponent"] as const) {
    const actor = state[side];
    for (const status of actor.statuses) if (status.expires <= state.round) emit({ type: "status", side, status: status.id, change: "removed" });
    actor.statuses = actor.statuses.filter(s => s.expires > state.round);
    for (const buff of actor.buffs) if (buff.expires <= state.round) emit({ type: "buff", side, stat: buff.stat, change: "removed" });
    actor.buffs = actor.buffs.filter(b => b.expires > state.round);
    if (actor.shield && actor.shield.expires <= state.round) removeShield(side);
    if (actor.defense && actor.defense.expires <= state.round) { delete actor.defense; emit({ type: "shield", side, multiplier: 1, change: "removed" }); }
    if (actor.exposedUntil !== undefined && actor.exposedUntil <= state.round) { delete actor.exposedUntil; emit({ type: "status", side, status: "open", change: "removed" }); }
    if (state.round === 3 && BREED_BY_ID[actor.breedId].trait === "thirdEnergy") energy(side,2,"trait");
    if (actor.recoil) {
      if (actor.recoil.expires <= state.round) delete actor.recoil;
      else if (actor.recoil.energy) { energy(side,-actor.recoil.energy,"cost"); delete actor.recoil.energy; }
    }
  }
  if (state.round === MAX_ROUNDS) {
    // Integer cross-products keep the inclusive 5 percentage-point boundary exact.
    const difference = state.player.hp * state.opponent.stats.hp - state.opponent.hp * state.player.stats.hp;
    finish(Math.abs(difference) * 20 <= state.player.stats.hp * state.opponent.stats.hp ? "draw" : difference > 0 ? "player" : "opponent","limit");
  } else {
    state.round++;
    const forecast = chooseOpponentAction(state);
    state.opponentAction = forecast.action; state.rng = forecast.rng;
  }
  return { state, events };
}
