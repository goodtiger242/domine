import assert from "node:assert/strict";
import { loadTS } from "./pet-test-loader.mjs";
const { chooseTap, TAP_REACTIONS, tapRegion, tapCount } = loadTS("lib/domine/pet-tap.ts");
const input = { point:{x:.5,y:.5}, needs:{fullness:70,mood:70,clean:80}, count:1, recent:[], previousLine:"", seed:42 };
assert.ok(Object.keys(TAP_REACTIONS).length >= 8);
assert.deepEqual(chooseTap(input), chooseTap(input));
assert.equal(tapRegion({x:.9,y:.1}), "head"); assert.equal(tapRegion({x:.1,y:.8}), "tail"); assert.equal(tapRegion({x:.8,y:.8}), "body");
assert.equal(tapCount({at:10,count:2},2010), 3); assert.equal(tapCount({at:10,count:2},2011), 1);
assert.equal(chooseTap({...input,count:3}).kind,"tickle"); assert.match(chooseTap({...input,count:3}).text,/간지러워/);
assert.equal(chooseTap({...input,count:6}).kind,"belly");
let recent = [], previousLine = "";
for (let i=1; i<=500; i++) {
  const result = chooseTap({...input, count:(i-1)%8+1, seed:i*17929, recent, previousLine});
  assert.ok(!recent.includes(result.kind), `recent ${recent}, selected ${result.kind}`);
  assert.notEqual(result.text,previousLine); assert.ok(result.duration >= 600 && result.duration <= 1400);
  recent = [...recent,result.kind].slice(-2); previousLine = result.text;
}
const frequencies = (patch) => {
  const counts = {};
  for (let seed=1; seed<=1000; seed++) {
    const {kind} = chooseTap({...input,...patch,seed:seed*719}); counts[kind]=(counts[kind]??0)+1;
  }
  return counts;
};
const base = frequencies({});
assert.ok(frequencies({point:{x:.8,y:.1}}).tilt > base.tilt);
assert.ok(frequencies({point:{x:.1,y:.8}}).spin > base.spin);
assert.ok(frequencies({needs:{...input.needs,clean:10}}).shake > base.shake);
assert.ok(frequencies({needs:{...input.needs,mood:10}}).yawn > base.yawn);
assert.ok(frequencies({needs:{...input.needs,fullness:10}}).hungry > 0);
console.log("Pet taps: seeded choice, location/state weights, recent exclusions, dialogue variation and 3/6 streaks passed.");
