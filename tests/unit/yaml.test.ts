/*
* yaml.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";
import { Metadata } from "../../src/config/types.ts";
import { readYamlFromString } from "../../src/core/yaml.ts";

import { readAnnotatedYamlFromString } from "../../src/core/schema/annotated-yaml.ts";

const yamlStr = `
project:
  type: website
other:
  array:
    - foo
    - bar
`;

// deno-lint-ignore require-await
unitTest("yaml", async () => {
  const yaml = readYamlFromString(yamlStr) as Metadata;

  // Tests of the result
  assert(
    (yaml.project as Metadata).type === "website",
    "Project type not read properly",
  );
  assert(
    Array.isArray((yaml.other as Metadata).array) &&
      ((yaml.other as Metadata).array as string[]).length === 2,
    "Other array key not read properly",
  );
});

const circularYml = "foo: &foo\n  bar: *foo";

// deno-lint-ignore require-await
unitTest("yaml-circular-should-fail", async () => {
  try {
    readYamlFromString(circularYml);
    assert(false, "circular structure should have raised");
  } catch (_e) {
    // we expect to raise
  }
  try {
    readAnnotatedYamlFromString(circularYml);
    assert(false, "circular structure should have raised");
  } catch (_e) {
    // we expect to raise
  }
});

const sharedYml = "foo:\n  bar: &bar\n    baz: bah\n  baz: *bar";
// deno-lint-ignore require-await
unitTest("yaml-shared-should-pass", async () => {
  readYamlFromString(sharedYml);
  readYamlFromString(circularYml);
});
