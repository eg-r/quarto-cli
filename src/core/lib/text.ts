/*
* text.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { glb } from "./binary-search.ts";
import { quotedStringColor } from "./errors.ts";

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

// NB we can't use JS matchAll or replaceAll here because we need to support old
// Chromium in the IDE
//
// NB this mutates the regexp.
export function* matchAll(text: string, regexp: RegExp) {
  if (!regexp.global) {
    throw new Error("matchAll requires global regexps");
  }
  let match;
  while ((match = regexp.exec(text)) !== null) {
    yield match;
  }
}

export function* lineOffsets(text: string) {
  yield 0;
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index + match[0].length;
  }
}

export function* lineBreakPositions(text: string) {
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index;
  }
}

export function indexToRowCol(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (offset: number) {
    if (offset === 0) {
      return {
        line: 0,
        column: 0,
      };
    }

    const startIndex = glb(offsets, offset);
    return {
      line: startIndex,
      column: offset - offsets[startIndex],
    };
  };
}

export function rowColToIndex(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (position: { row: number; column: number }) {
    return offsets[position.row] + position.column;
  };
}

// just like the version on core/text.ts, but without the
// sprintf dependency
export function formatLineRange(
  text: string,
  firstLine: number,
  lastLine: number,
) {
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length,
  );
  const pad = " ".repeat(lineWidth);

  const ls = lines(text);

  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = `${pad}${i + 1}: `.slice(-(lineWidth + 2));
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + quotedStringColor(lineStr),
      rawLine: ls[i],
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result,
  };
}

// O(n1 * n2) naive edit string distance, don't use this on big texts!
export function editDistance(w1: string, w2: string): number {
  const cost = (c: string): number => {
    if ("_-".indexOf(c) !== -1) {
      return 1;
    }
    return 10;
  };
  const cost2 = (c1: string, c2: string): number => {
    if (c1 === c2) {
      return 0;
    }
    if ("_-".indexOf(c1) !== -1 && "_-".indexOf(c2) !== -1) {
      return 1;
    }
    if (c1.toLocaleLowerCase() === c2.toLocaleLowerCase()) {
      return 1;
    }
    const cc1 = c1.charCodeAt(0);
    const cc2 = c2.charCodeAt(0);

    if (cc1 >= 48 && cc1 <= 57 && cc2 >= 48 && cc2 <= 57) {
      return 1;
    }

    return 10;
  };

  const s1 = w1.length + 1;
  const s2 = w2.length + 1;
  let v = new Int32Array(s1 * s2);
  for (let i = 0; i < s1; ++i) {
    for (let j = 0; j < s2; ++j) {
      if (i === 0 && j === 0) {
        continue;
      } else if (i === 0) {
        v[i * s2 + j] = v[i * s2 + (j - 1)] + cost(w2[j - 1]);
      } else if (j === 0) {
        v[i * s2 + j] = v[(i - 1) * s2 + j] + cost(w1[i - 1]);
      } else {
        v[i * s2 + j] = Math.min(
          v[(i - 1) * s2 + (j - 1)] + cost2(w1[i - 1], w2[j - 1]),
          v[i * s2 + (j - 1)] + cost(w2[j - 1]),
          v[(i - 1) * s2 + j] + cost(w1[i - 1]),
        );
      }
    }
  }

  return v[(w1.length + 1) * (w2.length + 1) - 1];
}

// we have to allow trailing underscores in the regexes below. They're
// used by Pandoc to pass fields to downstream processors external
// to Pandoc.
const kebabCase = "^[a-z0-9]+[a-z0-9]*(-[a-z0-9]+)*_?$";
const snakeCase = "^[a-z0-9]+[a-z0-9]*(_[a-z0-9]+)*_?$";
const camelCase = "^[a-z0-9]+[a-z0-9]*([A-Z][a-z0-9]+)*_?$";

export type CaseConvention =
  | "camelCase"
  | "capitalizationCase"
  | "underscore_case"
  | "snake_case"
  | "dash-case"
  | "kebab-case";

export function detectCaseConvention(
  key: string,
): CaseConvention | undefined {
  if (key.toLocaleLowerCase() !== key) {
    return "capitalizationCase";
  }
  if (key.indexOf("_") !== -1) {
    return "underscore_case";
  }
  if (key.indexOf("-") !== -1) {
    return "dash-case";
  }
  return undefined;
}

export function resolveCaseConventionRegex(
  keys: string[],
  conventions?: CaseConvention[],
): {
  pattern?: string;
  list: string[];
} {
  const regexMap: Record<CaseConvention, string> = {
    "camelCase": camelCase,
    "capitalizationCase": camelCase,
    "underscore_case": snakeCase,
    "snake_case": snakeCase,
    "dash-case": kebabCase,
    "kebab-case": kebabCase,
  };

  if (conventions !== undefined) {
    if (conventions.length === 0) {
      throw new Error(
        "Internal Error: resolveCaseConventionRegex requires nonempty `conventions`",
      );
    }
    // conventions were specified, we use them
    return {
      pattern: conventions.map((c) => `(${c})`).join("|"),
      list: conventions,
    };
  }

  // no conventions were specified, we sniff all keys to disallow near-misses
  const disallowedNearMisses: string[] = [];
  const foundConventions: Set<CaseConvention> = new Set();
  for (const key of keys) {
    let found = detectCaseConvention(key);
    if (found) {
      foundConventions.add(found);
    }
    switch (found) {
      case "capitalizationCase":
        disallowedNearMisses.push(toUnderscoreCase(key), toDashCase(key));
        break;
      case "dash-case":
        disallowedNearMisses.push(
          toUnderscoreCase(key),
          toCapitalizationCase(key),
        );
        break;
      case "underscore_case":
        disallowedNearMisses.push(
          toDashCase(key),
          toCapitalizationCase(key),
        );
        break;
    }
  }

  if (foundConventions.size === 0) {
    // if no evidence of any keys was found, return undefined so
    // that no required names regex is set.
    return {
      pattern: undefined,
      list: [],
    };
  }

  return {
    pattern: `^(?!(${disallowedNearMisses.join("|")}))`,
    list: Array.from(foundConventions),
  };
}

export function toDashCase(str: string): string {
  return toUnderscoreCase(str).replace(/_/g, "-");
}

export function toUnderscoreCase(str: string): string {
  return str.replace(
    /([A-Z]+)/g,
    (_match: string, p1: string) => `-${p1}`,
  ).replace(/-/g, "_").split("_").filter((x) => x.length).join("_")
    .toLocaleLowerCase();
}

export function toCapitalizationCase(str: string): string {
  return toUnderscoreCase(str).replace(
    /_(.)/g,
    (_match: string, p1: string) => p1.toLocaleUpperCase(),
  );
}

export function normalizeCaseConvention(str: string): CaseConvention {
  const map: Record<string, CaseConvention> = {
    "capitalizationCase": "capitalizationCase",
    "camelCase": "capitalizationCase",
    "underscore_case": "underscore_case",
    "snake_case": "underscore_case",
    "dash-case": "dash-case",
    "kebab-case": "dash-case",
  };
  const result = map[str];
  if (result === undefined) {
    throw new Error(`Internal Error: ${str} is not a valid case convention`);
  }
  return result;
}
