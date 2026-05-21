import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import test from "node:test";

const source = readFileSync("apps/desktop/src/components/grid/DataGrid.vue", "utf8");

test("data grid uses lazy transpose rows and Tab keyboard toggle", () => {
  assert.match(source, /buildVisibleTransposeRows/);
  assert.match(source, /nextKeyboardTransposeState/);
  assert.match(source, /isToggleTransposeShortcut/);
  assert.match(source, /settingsStore\.editorSettings\.shortcuts/);
});
