/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  rgb24
} from "fmt/colors.ts";

import {
  formatExecuteOptionsSchema as execute
} from "./types.ts";

import {
  StringSchema as StringS,
  oneOfSchema as oneOfS,
  anySchema as anyS,
  objectSchema as objectS,
  enumSchema as enumS,
} from "./common.ts";

import {
  RenderContext
} from "../../command/render/types.ts";

import {
  breakQuartoMd
} from "../break-quarto-md.ts";

import {
  mappedString,
  asMappedString,
  mappedLineNumbers
} from "../mapped-text.ts";

import {
  rangedLines
} from "../ranged-text.ts";

import {
  formatLineRange,
  lines,
} from "../text.ts";

import {
  YAMLSchema
} from "./yaml-schema.ts";

import {
  error
} from "log/mod.ts";

import { formatExecuteOptionsSchema } from "./types.ts";

export const htmlOptionsSchema = formatExecuteOptionsSchema;

export const htmlFormatSchema = objectS({
  properties: {
    "html": htmlOptionsSchema
  },
  description: "be an HTML format object"
});

export const frontMatterFormatSchema = oneOfS(
  enumS("html"),
  htmlFormatSchema
);

export const frontMatterSchema = {
  "type": "object",
  properties: {
    title: StringS,
    execute,
    format: frontMatterFormatSchema
  }
};

const frontMatter = new YAMLSchema(frontMatterSchema);

export function validateYAMLFrontMatter(context: RenderContext)
{
  const source = asMappedString(Deno.readTextFileSync(context.target.source));
  const nb = breakQuartoMd(source);
  if (nb.cells.length < 1) {
    throw new Error("Couldn't find YAML front matter");
  }
  const firstCell = nb.cells[0];
  if (!firstCell.source.value.startsWith("---")) {
    throw new Error("Expected front matter to start with '---'");
  }
  if (!firstCell.source.value.endsWith("---")) {
    throw new Error("Expected front matter to end with '---'");
  }
  const lineRanges = rangedLines(firstCell.source.value);
  const frontMatterText = mappedString(
    firstCell.source,
    [{ start: lineRanges[1].range.start, end: lineRanges[lineRanges.length - 2].range.end }]
  );

  return frontMatter.parseAndValidateWithErrors(frontMatterText, "Validation of YAML front matter failed.");
}
