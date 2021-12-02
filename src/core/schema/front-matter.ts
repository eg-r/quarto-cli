/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  describeSchema,
  enumSchema as enumS,
  idSchema as withId,
  NullSchema as nullS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  anyOfSchema as anyOfS,
  StringSchema as StringS,
  regexSchema as regexS,
  completeSchema
} from "./common.ts";

import {
  Schema,
  normalizeSchema
} from "../lib/schema.ts";

import { formatExecuteOptionsSchema as execute } from "./types.ts";
import { getFormatSchema } from "./format-schemas.ts";

export const htmlOptionsSchema = oneOfS(execute, enumS("default"));

export async function getHtmlFormatSchema()
{
  return objectS({
    properties: {
      "html": await getFormatSchema("html"),
    },
    description: "be an HTML format object",
  });
}

const schemaCache: Record<string, Schema> = {};
const schemaCacheNormalized: Record<string, Schema> = {};

function cacheSchemaFunction(name: string, maker: () => Promise<Schema>):
((normalized?: boolean) => Promise<Schema>)
{
  const getter = async (normalized?: boolean) => {
    if (normalized) {
      if (schemaCacheNormalized[name]) {
        return schemaCacheNormalized[name];
      }
      const schema = await getter();
      schemaCacheNormalized[name] = normalizeSchema(schema);
      return schemaCacheNormalized[name];
    } else {
      if (schemaCache[name]) {
        return schemaCache[name];
      }
      const schema = await maker();
      schemaCache[name] = schema;
      return schema;
    }
  }
  return getter;
}

// FIXME this should be autogenerated from pandoc --list-output-formats
const pandocOutputFormats = [
  "asciidoc",
  "asciidoctor",
  "beamer",
  "biblatex",
  "bibtex",
  "commonmark",
  "commonmark_x",
  "context",
  "csljson",
  "docbook",
  "docbook4",
  "docbook5",
  "docx",
  "dokuwiki",
  "dzslides",
  "epub",
  "epub2",
  "epub3",
  "fb2",
  "gfm",
  "haddock",
  "html",
  "html4",
  "html5",
  "icml",
  "ipynb",
  "jats",
  "jats_archiving",
  "jats_articleauthoring",
  "jats_publishing",
  "jira",
  "json",
  "latex",
  "man",
  "markdown",
  "markdown_github",
  "markdown_mmd",
  "markdown_phpextra",
  "markdown_strict",
  "mediawiki",
  "ms",
  "muse",
  "native",
  "odt",
  "opendocument",
  "opml",
  "org",
  "pdf",
  "plain",
  "pptx",
  "revealjs",
  "rst",
  "rtf",
  "s5",
  "slideous",
  "slidy",
  "tei",
  "texinfo",
  "textile",
  "xwiki",
  "zimwiki",
];

export async function makeFrontMatterFormatSchema()
{
  const formatSchemaDescriptorList = await Promise.all(
    pandocOutputFormats.map(async (x) => {
      return {
        regex: `^${x}(\\+.+)?$`,
        schema: await getFormatSchema(x),
        name: x
      };
    }));
  const formatSchemas =
    formatSchemaDescriptorList.map(
      ({ regex, schema }) => [regex, schema]);
  const plusFormatStringSchemas =
    formatSchemaDescriptorList.map(
      ({ regex, name }) => completeSchema(
        regexS(regex, `be '${name}'`),
        {
          type: "value",
          display: name,
          suggest_on_accept: true,
          value: name,
          description: name
        }));
  const completionsObject =
    Object.fromEntries(formatSchemaDescriptorList.map(
      ({ name }) => [name, name]));
  
  return oneOfS(
    describeSchema(oneOfS(...plusFormatStringSchemas), "the name of a pandoc-supported output format"),
    regexS("^hugo(\\+.+)?$", "be 'hugo'"),
    objectS({
      patternProperties: Object.fromEntries(formatSchemas),
      completions: completionsObject,
      additionalProperties: false
    })
  );
}
export const getFrontMatterFormatSchema = cacheSchemaFunction(
  "front-matter-format", makeFrontMatterFormatSchema);

export async function makeFrontMatterSchema()
{
  return withId(
    oneOfS(
      nullS,
      objectS({
        properties: {
          title: StringS,
          // execute,
          // format: (await getFrontMatterFormatSchema()),
          //
          // NOTE: we are temporarily disabling format validation
          // because it's way too strict
        },
        description: "be a Quarto YAML front matter object",
      }),
    ),
    "front-matter",
  );
}
export const getFrontMatterSchema = cacheSchemaFunction(
  "front-matter", makeFrontMatterSchema);

