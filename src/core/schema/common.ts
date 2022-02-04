/*
* common.ts
*
* Common JSON Schema objects that make up a schema combinator library.
*
* These are not strictly JSON Schemas (they have extra fields for
* auto-completions, etc) but core/lib/schema.ts includes a
* `normalizeSchema()` call that takes a schema produced here and
* returns a valid JSON Schema object.
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  Completion,
  getSchemaDefinition,
  hasSchemaDefinition,
  Schema,
} from "../lib/yaml-validation/schema.ts";

import { resolveSchema } from "../lib/yaml-validation/schema-utils.ts";

import { mergeConfigs } from "../config.ts";

import { CaseConvention, resolveCaseConventionRegex } from "../lib/text.ts";

export const BooleanSchema = {
  "type": "boolean",
  "description": "be `true` or `false`",
  "completions": ["true", "false"],
  "exhaustiveCompletions": true,
};

export const NumberSchema = {
  "type": "number",
  "description": "be a number",
};

export const IntegerSchema = {
  "type": "integer",
  "description": "be an integral number",
};

// deno-lint-ignore no-explicit-any
export function tagSchema(schema: Schema, tags: Record<string, any>): Schema {
  return {
    ...schema,
    tags: mergeConfigs(schema?.tags ?? {}, tags),
  };
}

export function numericSchema(obj: {
  "type": "integer" | "number";
  "minimum"?: number;
  "maximum"?: number;
  "exclusiveMinimum"?: number;
  "exclusiveMaximum"?: number;
  "multipleOf"?: number;
  "description"?: string;
}) {
  return Object.assign({
    description: "be a number",
  }, obj);
}

export const StringSchema = {
  "type": "string",
  "description": "be a string",
};

export const anySchema = {
  "description": "be anything",
};

// NB this is different from a schema that accepts nothing
// this schema accepts `null`
export const NullSchema = {
  "type": "null",
  "description": "be the null value",
  "completions": ["null"],
  "exhaustiveCompletions": true,
};

export function enumSchema(...args: string[]) {
  if (args.length === 0) {
    throw new Error("Internal Error: Empty enum schema not supported.");
  }
  return {
    "enum": args,
    "description": args.length > 1
      ? `be one of: ${args.map((x) => "`" + x + "`").join(", ")}`
      : `be '${args[0]}'`,
    "completions": args,
    "exhaustiveCompletions": true,
  };
}

export function regexSchema(arg: string, description?: string) {
  const result: Schema = {
    "type": "string",
    "pattern": arg,
  };
  if (description) {
    result.description = description;
  } else {
    result.description = `be a string that satisfies regex "${arg}"`;
  }
  return result;
}

export function oneOfSchema(...args: Schema[]) {
  return {
    "oneOf": args,
    "description": `be exactly one of: ${
      args.map((x) => x.description.slice(3)).join(", ")
    }`,
  };
}

export function anyOfSchema(...args: Schema[]) {
  return {
    "anyOf": args,
    "description": `be at least one of: ${
      args.map((x) => x.description.slice(3)).join(", ")
    }`,
  };
}

export function allOfSchema(...args: Schema[]) {
  return {
    "allOf": args,
    "description": `be all of: ${
      args.map((x) => x.description.slice(3)).join(", ")
    }`,
  };
}

// TODO add dynamic check for requiredProps being a subset of the
// keys in properties
export function objectSchema(params: {
  properties?: { [k: string]: Schema };
  patternProperties?: { [k: string]: Schema };
  required?: string[];
  exhaustive?: boolean;
  additionalProperties?: Schema;
  description?: string;
  // deno-lint-ignore no-explicit-any
  baseSchema?: any; // TODO this should have the type of the result of objectSchema()
  completions?: { [k: string]: string };
  namingConvention?: CaseConvention[] | "ignore";
} = {}) {
  let {
    properties,
    patternProperties,
    required,
    additionalProperties,
    description,
    baseSchema,
    exhaustive,
    completions: completionsParam,
    namingConvention,
  } = params;

  required = required || [];
  properties = properties || {};
  patternProperties = patternProperties || {};
  const tags: Record<string, any> = {};
  let tagsAreSet = false;
  let propertyNames: Schema | undefined;

  const objectKeys = Object.getOwnPropertyNames(completionsParam || properties);

  if (namingConvention !== "ignore") {
    const { pattern, list } = resolveCaseConventionRegex(
      objectKeys,
      namingConvention,
    );
    if (pattern !== undefined) {
      propertyNames = {
        "type": "string",
        pattern,
      };
      tags["case-convention"] = list;
      tagsAreSet = true;
    }
  }
  if (completionsParam) {
    tags["completions"] = completionsParam;
    tagsAreSet = true;
  }

  const hasDescription = description !== undefined;
  description = description || "be an object";
  let result: Schema | undefined = undefined;

  if (baseSchema) {
    if (baseSchema.type !== "object") {
      throw new Error("Internal Error: can only extend other object Schema");
    }
    result = Object.assign({}, baseSchema);
    // remove $id from base schema to avoid names from getting multiplied
    if (result.$id) {
      delete result.$id;
    }

    if (exhaustive && baseSchema.exhaustiveCompletions) {
      result.exhaustiveCompletions = true;
    }

    if (hasDescription) {
      result.description = description;
    }

    result.properties = Object.assign({}, result.properties, properties);
    result.patternProperties = Object.assign(
      {},
      result.patternProperties,
      patternProperties,
    );

    if (required) {
      result.required = (result.required ?? []).slice();
      result.required.push(...required);
    }

    // if (
    //   (result.completions && result.completions.length) ||
    //   completions.length
    // ) {
    //   result.completions = (result.completions || []).slice();
    //   result.completions.push(...completions);
    //   result.completions = uniqueValues(result.completions);
    // }

    if (additionalProperties !== undefined) {
      // TODO Review. This is likely to be confusing, but I think
      // it's the correct semantics for subclassing
      if (result.additionalProperties === false) {
        throw new Error(
          "Internal Error: don't know how to subclass object schema with additionalProperties === false",
        );
      }
      if (result.additionalProperties) {
        result.additionalProperties = allOfSchema(
          result.additionalProperties,
          additionalProperties,
        );
      } else {
        result.additionalProperties = additionalProperties;
      }
    }

    if (propertyNames !== undefined) {
      if (result.propertyNames !== undefined) {
        // this is a convoluted-but-unavoidable way to say "create a regexp that is
        // the conjunction of these two regexps" using javascript-allowed regexes.
        // by de morgan's laws, A AND B = !(!A or !B)

        const not = (s: string) => `^(?!${s})`;
        const or = (s1: string, s2: string) => `(${s1}|${s2})`;
        const and = (s1: string, s2: string) => not(or(not(s1), not(s2)));

        result.propertyNames = {
          type: "string",
          pattern: and(propertyNames.pattern, result.propertyNames.pattern),
        };
      } else {
        result.propertyNames = propertyNames;
      }
    }
  } else {
    result = {
      "type": "object",
      description,
    };

    if (exhaustive) {
      result.exhaustiveCompletions = true;
    }

    if (properties) {
      result.properties = properties;
    }

    if (patternProperties) {
      result.patternProperties = patternProperties;
    }

    if (required && required.length > 0) {
      result.required = required;
    }

    // if (completions.length) {
    //   result.completions = completions;
    // }

    // this is useful to characterize Record<string, foo> types: use
    // objectSchema({}, [], foo)
    //
    // additionalProperties can be either a schema or "false", so
    // we need to check for undefined instead of a simple truthy check
    if (additionalProperties !== undefined) {
      result.additionalProperties = additionalProperties;
    }

    if (propertyNames !== undefined) {
      result.propertyNames = propertyNames;
    }
  }

  if (tagsAreSet) {
    result.tags = tags;
  }
  return result;
}

export function arraySchema(items?: Schema) {
  if (items) {
    return {
      "type": "array",
      "description": `be an array of values, where each element should ` +
        items.description,
      items,
    };
  } else {
    return {
      "type": "array",
      "description": `be an array of values`,
    };
  }
}

export function documentSchema(schema: Schema, doc: string) {
  const result = Object.assign({}, schema);
  result.documentation = doc;
  return result;
}

// this overrides the automatic description
export function describeSchema(schema: Schema, description: string) {
  const result = Object.assign({}, schema);
  result.description = `be ${description}`;
  return result;
}

export function completeSchema(schema: Schema, ...completions: Completion[]) {
  const result = Object.assign({}, schema);
  const prevCompletions = (schema.completions ?? []).slice();
  prevCompletions.push(...completions);
  result.completions = prevCompletions;
  return result;
}

export function completeSchemaOverwrite(
  schema: Schema,
  ...completions: Completion[]
) {
  const result = Object.assign({}, schema);
  result.completions = completions;
  return result;
}

export function idSchema(schema: Schema, id: string) {
  const result = Object.assign({}, schema);
  result["$id"] = id;
  return result;
}

export function errorMessageSchema(schema: Schema, errorMessage: string) {
  return {
    ...schema,
    errorMessage,
  };
}

// JSON schemas don't even allow $ref to have descriptions,
// but we use it here to allow our automatic description creation
export function refSchema($ref: string, description: string) {
  return {
    $ref,
    description,
  };
}

export function valueSchema(
  val: number | boolean | string,
  description?: string,
) {
  return {
    "enum": [val], // enum takes non-strings too (!)
    "description": description ?? `be ${JSON.stringify(val)}`,
  };
}
