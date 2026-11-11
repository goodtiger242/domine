import assert from "node:assert/strict";
import { loadTS } from "./pet-test-loader.mjs";
const { travelEdge, actorBounds } = loadTS("lib/domine/pet-geometry.ts");
const { travelDirection } = loadTS("lib/domine/pet-world.ts");
const { fallingNeeds } = loadTS("lib/domine/pet-signals.ts");
const { CATALOG, catalogHint } = loadTS("lib/domine/pet-catalog.ts");
const { buildScenePlan } = loadTS("lib/domine/pet-scene-plan.ts");
const tap = buildScenePlan({action:"tap",id:1},{map:"field",width:26,ratio:.7,origin:{x:95,y:80}},()=>.5);
assert.equal(tap.keyframes[0].pose.x,95); assert.equal(tap.keyframes[0].pose.y,80);
assert.equal(tap.keyframes[0].at,0); assert.equal(tap.keyframes[0].pose.motion,"pet-hop");
const opposite = { e: "w", w: "e", n: "s", s: "n" };
for (const direction of Object.keys(opposite)) {
  const out = travelEdge(direction), entry = travelEdge(direction, true), reverse = travelEdge(opposite[direction]);
  for (const key of ["x", "y", "scale", "opacity"]) assert.equal(entry[key], reverse[key]);
  assert.equal(entry.dir, out.dir, "entry keeps the direction of travel");
  const bounds = actorBounds(26 * 2);
  for (const edge of [out, entry]) assert.ok(
    edge.x + bounds.right * edge.scale < 0 || edge.x + bounds.left * edge.scale > 160 ||
    edge.y + bounds.bottom * edge.scale < 6 || edge.y + bounds.top * edge.scale > 96,
    "the entire actor leaves the 160 x 90 view, including its outfit",
  );
}
assert.equal(travelEdge("n").scale, .55); assert.equal(travelEdge("n").opacity, 0);
assert.equal(travelEdge("s").scale, 1.35);
for (const [to, direction] of [["F5","e"],["D5","w"],["E4","n"],["E6","s"],["J6","e"],["A6","w"],["F1","n"],["F10","s"],["F6","e"]]) {
  assert.equal(travelDirection("E5",to),direction);
}
const state = (n) => ({ fullness:n, mood:n, clean:n });
const seen = new Set();
assert.deepEqual(fallingNeeds(state(81),state(80),seen),[]);
assert.deepEqual(fallingNeeds(state(80),state(79),seen),["idle_hungry","idle_sad","idle_dirty"]);
assert.deepEqual(fallingNeeds(state(79),state(65),seen),[]);
assert.deepEqual(fallingNeeds(state(100),state(79),seen),[],"already signalled bands do not repeat after refilling");
assert.deepEqual(fallingNeeds(state(79),state(19),seen),["idle_hungry","idle_sad","idle_dirty"]);
assert.equal(seen.size,12);
assert.deepEqual(fallingNeeds(state(19),state(100),seen),[]);
for (const [map,name] of [["church","성당 마당"],["field","들판"],["street","상가 거리"],["park","공원 숲길"],["home","집 마당"]]) {
  assert.ok(catalogHint(CATALOG.find(i=>i.map===map)).startsWith(`${name} · `));
}
assert.match(catalogHint(CATALOG.find(i=>i.id==="024")),/밤 발견/);
console.log("Pet motion geometry, need boundaries, reward goals and album hints passed.");

// Rolling around the body center keeps the enlarged dog and hat above the bottom edge.
for (const base of [18,22,26]) for (const breed of [1,.8]) for (const church of [1,.85]) {
  const width = base * 2 * breed * church, height = width * .76;
  const scale = 2 * church * (breed === .8 ? .8/.72 : 1);
  const centerY = -height * .57 + 1.5 * scale;
  for (const x of [-width/2,width/2]) for (const y of [-height*.57,height*.57]) {
    const angle = -150 * Math.PI / 180;
    const rolledY = centerY - 8 + x * Math.sin(angle) + y * .9 * Math.cos(angle);
    assert.ok(82 + rolledY < 96 && 82 + rolledY > 6, "belly animation stays in the scene");
  }
}
