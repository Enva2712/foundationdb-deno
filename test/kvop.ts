import { assert } from "jsr:@std/assert";
import FDB from "@enva2712/fdb";

Deno.test('basic usage', async () => {
  const db = new FDB();
  const tx1 = db.createTransaction();
  const fst = await tx1.get("foo");
  await tx1.commit();
  assert(!fst);
  const tx2 = db.createTransaction();
  tx2.set("foo", new TextEncoder().encode("bar"));
  const snd = await tx2.get("foo");
  assert(snd);
  await tx2.commit();
  const tx3 = db.createTransaction();
  const thd = await tx3.get("foo");
  assert(thd);
  await tx3.commit();
  const sndStr = new TextDecoder().decode(snd);
  const thdStr = new TextDecoder().decode(thd);
  assert("bar" === sndStr && sndStr === thdStr);
});

// TODO: watches
