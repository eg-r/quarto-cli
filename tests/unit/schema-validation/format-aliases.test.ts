import { yamlValidationUnitTest } from "./utils.ts";
import { getExpandedFormatAliases } from "../../../src/core/schema/format-aliases.ts";
import { assert } from "testing/asserts.ts";

// deno-lint-ignore require-await
yamlValidationUnitTest("format-alias-expansion", async () => {
  const expandedAliases = getExpandedFormatAliases();
  for (const [_key, value] of Object.entries(expandedAliases)) {
    for (const entry of value) {
      assert(!entry.startsWith("$"));
    }
  }
});
