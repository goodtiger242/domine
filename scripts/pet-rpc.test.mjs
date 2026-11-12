import assert from "node:assert/strict";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";

const { createPetApi } = loadTS("lib/domine/pet-rpc.ts");

test("state and both legacy RPC variants preserve the caller's AbortSignal", async () => {
  const controller = new AbortController(), calls = [];
  const api = createPetApi(async (name, args, signal) => {
    calls.push({ name, args, signal });
    return name.endsWith("_for")
      ? { data: null, error: { code: "PGRST202", message: "missing" } }
      : { data: { ok: true }, error: null };
  });
  await api.state({ nickname: "test", secret: "test" }, 1, controller.signal);
  await api.legacy(1, "test", undefined, false, controller.signal);
  assert.deepEqual(calls.map(c => c.name), ["domine_pet_state_v6", "domine_pet_state_for", "domine_pet_state"]);
  assert.ok(calls.every(c => c.signal === controller.signal));
  controller.abort();
  assert.ok(calls.every(c => c.signal.aborted));
});
