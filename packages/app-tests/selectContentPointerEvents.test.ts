import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("select content preserves Reka outside pointer-event lock by default", () => {
  const source = readFileSync("apps/desktop/src/components/ui/select/SelectContent.vue", "utf8");

  assert.match(source, /disableOutsidePointerEvents\?: boolean/);
  assert.match(source, /disableOutsidePointerEvents:\s*true/);
});
