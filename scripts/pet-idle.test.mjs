import assert from "node:assert/strict";
import { loadTS } from "./pet-test-loader.mjs";
const { routinePeriod, chooseNeedGoal, idleWeights, chooseIdleAction } = loadTS("lib/domine/pet-idle.ts");
const { buildIdlePlan } = loadTS("lib/domine/pet-scene-plan.ts");
const { PET_MAPS } = loadTS("lib/domine/pet-maps.ts");
const { PETS } = loadTS("lib/domine/pet-photos.ts");
const { LINES } = loadTS("lib/domine/pet-lines.ts");
for (const [hour, period] of [[0,"night"],[5,"night"],[6,"morning"],[9,"morning"],[10,"day"],[11,"day"],[12,"noon"],[14,"noon"],[15,"afternoon"],[17,"afternoon"],[18,"evening"],[21,"evening"],[22,"night"],[23,"night"]]) {
  assert.equal(routinePeriod(hour),period); assert.ok(LINES[`greeting_${period}`].length >= 3);
}
const healthy = { fullness:100, clean:100, mood:100 }, noise=[0,0,0,0,0];
assert.equal(chooseNeedGoal(healthy,[],noise),"play");
for (const [need, goal] of [["fullness","food"],["clean","clean"],["mood","company"]]) {
  assert.equal(chooseNeedGoal({...healthy,[need]:10},[],noise),goal);
  assert.equal(chooseNeedGoal({...healthy,[need]:10},[goal],noise),goal);
  assert.notEqual(chooseNeedGoal({...healthy,[need]:10},[goal,goal],noise),goal);
}
assert.equal(chooseNeedGoal(healthy,["play","play"],noise),"rest");
assert.equal(chooseNeedGoal({...healthy,clean:50,mood:50},[],[0,0,1,0,0]),"company");
assert.equal(chooseNeedGoal({...healthy,clean:50,mood:50},[],[0,1,0,0,0]),"clean");
const base=idleWeights(11,"play");
for (const [hour, action] of [[6,"stretch"],[9,"yawn"],[13,"nap"],[16,"snack"],[19,"fetch"],[23,"sleepwalk"],[2,"dream"]]) {
  assert.ok(idleWeights(hour,"play")[action] > (base[action]??0));
  let count=0;
  for(let i=0;i<1000;i++) if(chooseIdleAction(hour,"play",i/1000)===action) count++;
  assert.ok(count>250,`${action} is weighted at ${hour}`);
}
const actions=new Set();
for(let hour=0;hour<24;hour++) for(const goal of ["food","clean","company","play","rest"]) {
  for(let roll=0;roll<100;roll++) actions.add(chooseIdleAction(hour,goal,roll/100));
}
for(const action of actions) for(const {id:map} of PET_MAPS) for(const pet of Object.values(PETS)) {
  const plan=buildIdlePlan(action,{map,width:26*pet.scale*(map==="church"?.85:1),ratio:pet.ratio});
  for(const frame of plan.keyframes) {
    assert.ok(frame.at<plan.durationMs);
    assert.ok(frame.pose.x>=20&&frame.pose.x<=140);
    if(frame.pose.ball) assert.ok(frame.pose.ball.x>=3.2&&frame.pose.ball.x<=156.8);
    if(frame.say) assert.ok(LINES[frame.say]?.length, frame.say);
  }
  if(action==="nap") assert.equal(plan.keyframes[0].pose.motion,"pet-lie");
  if(action==="fetch") assert.ok(plan.keyframes.some(f=>f.pose.carry==="mouth"));
  if(action==="food") { assert.ok(plan.keyframes[0].pose.bowl>plan.keyframes[0].pose.x); assert.equal(plan.keyframes[0].pose.motion,"pet-trot"); }
}
console.log("Pet idle: time boundaries, weights, need priority, repetition cap, poses and dialogue passed.");
