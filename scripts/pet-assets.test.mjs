import assert from "node:assert/strict";
import test from "node:test";
import { prepareImage } from "../lib/domine/pet-assets.ts";

test("image readiness waits for decode, cleans up and permits retries", async t => {
  const images = [], timers = new Map();
  const OriginalImage = globalThis.Image;
  globalThis.Image = class {
    constructor() { images.push(this); }
    decode() { return new Promise((resolve, reject) => { this.decoded = resolve; this.decodeFailed = reject; }); }
  };
  t.after(() => { globalThis.Image = OriginalImage; });
  t.mock.method(globalThis, "setTimeout", (fn, ms) => { const id = {}; timers.set(id, { fn, ms }); return id; });
  t.mock.method(globalThis, "clearTimeout", id => timers.delete(id));
  const start = () => {
    const controller = new AbortController();
    const promise = prepareImage("/pet/cell/F5.webp", controller.signal);
    return { controller, promise, image: images.at(-1) };
  };
  const success = start();
  let ready = false;
  void success.promise.then(value => { ready = value; });
  success.image.onload();
  await Promise.resolve();
  assert.equal(ready, false, "load without decode must not commit travel");
  success.image.decoded();
  assert.equal(await success.promise, true);
  assert.equal(success.image.onload, null);
  assert.equal(success.image.onerror, null);
  assert.equal(timers.size, 0);

  const network = start();
  network.image.onerror();
  assert.equal(await network.promise, false);
  const decode = start();
  decode.image.onload(); decode.image.decodeFailed(new Error("invalid WebP"));
  assert.equal(await decode.promise, false);

  const timeout = start();
  timeout.image.onload();
  const deadline = [...timers.values()][0];
  assert.ok(deadline.ms < 2500, "image decode finishes before the travel safety deadline");
  deadline.fn();
  assert.equal(await timeout.promise, false);
  timeout.image.decoded();
  assert.equal(await timeout.promise, false, "late decode cannot reverse failure");

  const aborted = start();
  aborted.image.onload(); aborted.controller.abort(); aborted.image.decoded();
  assert.equal(await aborted.promise, false);
  const count = images.length;
  assert.equal(await prepareImage("/unused.webp", aborted.controller.signal), false);
  assert.equal(images.length, count, "already cancelled work never creates an image");

  const retry = start();
  retry.image.onload(); retry.image.decoded();
  assert.equal(await retry.promise, true, "an error never poisons later attempts");
  assert.equal(timers.size, 0);
});
