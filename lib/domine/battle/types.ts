export type Group = "rush" | "trick" | "track" | "guard" | "bond" | "endure";
export type Temperament = "lively" | "careful" | "kind" | "steady";
export type Size = "small" | "medium" | "large";
export type Stat = "hp" | "attack" | "defense" | "speed" | "focus" | "calm";
export type Stats = Record<Stat, number>;
export type Condition = { fullness: number; mood: number; clean: number };
export type MovementType = "companion" | "agile" | "flying" | "runner" | "heavy" | "waterside";
export type Habitat = "H" | "U" | "G" | "F" | "W";
export type TimeBand = "morning" | "day" | "evening" | "night";
export interface BattleEnvironment { habitat?: Habitat; time?: TimeBand; weather?: "clear" | "rain" | "wind" | "snow" }
export interface FighterOptions {
  moves?: readonly string[]; consumable?: string;
  items?: readonly string[]; owned?: boolean; boss?: boolean; equipmentStats?: boolean; finisher?: string;
  allocation?: Partial<Stats>; job?: Partial<Stats>; condition?: Condition; mastery?: Readonly<Record<string, number>>;
  movementType?: MovementType; habitats?: readonly Habitat[]; activeBands?: readonly TimeBand[];
  environment?: BattleEnvironment;
}
export type Status = "stagger" | "blur" | "slow" | "tense" | "winded" | "open";
export type Trait = "restDamage" | "earlySpeed" | "firstTrack" | "firstShield" | "thirdEnergy" | "longBuff" | "firstBond" | "firstRush" | "trackDamage" | "statusImmune";
export interface Breed {
  id: string; name: string; group: Group; temperament: Temperament; size: Size;
  base: Stats; growth: string; trait: Trait; learn: readonly { level: number; move: string }[];
}
export interface Move {
  id: string; name: string; kind: "attack" | "defense" | "support";
  group: Group | "neutral"; power: number; accuracy: number; energy: number; priority: number;
  buff?: Exclude<Stat, "hp">; heal?: number; status?: Status; chance?: number;
  mode?: "normal" | "charge" | "multi" | "recoil";
  hits?: 2 | 3; recoil?: { energy?: number; stat?: Exclude<Stat, "hp">; rate?: number };
  common?: boolean;
  defense?: "guard" | "counter" | "evade" | "stance";
  contact?: boolean; breaksDefense?: boolean; finisher?: boolean;
}
export interface Item {
  id: string; name: string; slot: "collar" | "harness" | "charm" | "bag";
  rates?: Partial<Stats>; energy?: number; heal?: number;
  category?: "heal" | "energy" | "buff" | "cleanse" | "protect" | "critical" | "cancel" | "survive";
  buff?: Exclude<Stat, "hp" | "calm">; price?: number;
}
export interface Fighter extends FighterOptions {
  breedId: string; level: number; stats: Stats; moves: readonly string[];
  equipment: readonly string[]; consumable?: string;
}
export interface Actor extends Fighter {
  hp: number; energy: number; healed: number; itemUsed: boolean;
  statuses: { id: Status; applied: number; expires: number }[];
  buffs: { stat: Exclude<Stat, "hp">; expires: number; rate?: number; item?: boolean }[];
  shield?: { multiplier: number; expires: number };
  lastAction?: Action; lastDefense: number; traitUsed: boolean; rested: boolean;
  charging?: string;
  momentum?: number; usedItems?: string[]; guaranteedCritical?: boolean; survival?: boolean; survivalUsed?: boolean;
  defense?: { kind: NonNullable<Move["defense"]>; expires: number; strength: number; triggered?: boolean };
  exposedUntil?: number;
  recoil?: { energy?: number; stat?: Exclude<Stat, "hp">; rate?: number; expires: number };
}
export type Side = "player" | "opponent";
export type Action = { kind: "move"; moveId: string; phase?: "prepare" | "release" } | { kind: "push" | "rest" | "quit" } | { kind: "item"; itemId: string };
export type Difficulty = "normal" | "hard";
export type Outcome = "player" | "opponent" | "draw" | "quit";
export type Hint = "good" | "normal" | "weak";
export type Timing = "miss" | "good" | "perfect";
export interface RoundInput { attackTiming?: Timing; guardTiming?: Timing }
export interface BattleState {
  round: number; rng: number; player: Actor; opponent: Actor; difficulty: Difficulty;
  opponentAction: Action; outcome?: Outcome;
  criticals?: boolean;
}
export type BattleEvent = { round: number } & (
  | { type: "action"; side: Side; action: Action }
  | { type: "hit" | "miss"; side: Side; target: Side; moveId: string }
  | { type: "effectiveness"; side: Side; target: Side; hint: Hint; multiplier: number }
  | { type: "damage"; side: Side; target: Side; amount: number; hp: number; critical?: true }
  | { type: "status"; side: Side; status: Status; change: "applied" | "removed" | "blocked" }
  | { type: "buff"; side: Side; stat: Exclude<Stat, "hp">; change: "applied" | "removed" }
  | { type: "shield"; side: Side; multiplier: number; change: "applied" | "removed" }
  | { type: "energy"; side: Side; amount: number; energy: number; reason: "cost" | "rest" | "round" | "item" | "trait" }
  | { type: "heal"; side: Side; amount: number; hp: number }
  | { type: "end"; outcome: Outcome; reason: "hp" | "limit" | "quit" }
  | { type: "counter" | "evade" | "break" | "stagger" | "cancel"; side: Side; target: Side }
  | { type: "momentum"; side: Side; amount: number; momentum: number }
  | { type: "finisher"; side: Side; moveId: string }
  | { type: "survive"; side: Side }
);
