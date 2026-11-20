// Guest daily limits, counted on the phone (signed-in limits are tested in supabase/security-tests).
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { countUse, usesLeft, leftHint } from "@/frontend/core/pro/dailyLimits";
import AsyncStorage from "@react-native-async-storage/async-storage";

test("guest limits: 3 budget suggestions, repeats free, 4th refused", async () => {
  AsyncStorage._clear();
  for (const s of ["a", "b", "c"]) assert.equal(await countUse("budget", s, 3), true);
  assert.equal(await countUse("budget", "a", 3), true, "repeat free");
  assert.equal(await countUse("budget", "d", 3), false);
  assert.equal(await usesLeft("budget", 3), 0);
  assert.equal(leftHint(1, "search", "searches"), "1 search left today");
});
test("guest limits: clearing app storage resets the count (soft limit)", async () => {
  AsyncStorage._clear();
  assert.equal(await usesLeft("search", 3), 3);
});

test("guest search refinements: judged against the last counted search, 3+ letters", async () => {
  AsyncStorage._clear();
  const sig = (q) => JSON.stringify([q, "[]"]);
  const refines = (a, n) => {
    const [aq, af] = JSON.parse(a); const [nq, nf] = JSON.parse(n);
    if (aq === nq) return true; if (af !== nf) return false;
    return Math.min(aq.length, nq.length) >= 3 && (nq.startsWith(aq) || aq.startsWith(nq));
  };
  await countUse("search", sig("p"), 3, refines);
  await countUse("search", sig("pork"), 3, refines);
  await countUse("search", sig("pancit"), 3, refines);
  assert.equal(await usesLeft("search", 3), 0, "p, pork, pancit each count");
  assert.equal(await countUse("search", sig("pancit canton"), 3, refines), true, "refines the last counted");
  assert.equal(await countUse("search", sig("adobo"), 3, refines), false, "new search refused at the limit");
});
