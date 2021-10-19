/*
* format-reveal.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { kFrom, kTheme } from "../../config/constants.ts";
import { mergeConfigs } from "../../core/config.ts";
import { createHtmlPresentationFormat } from "../formats-shared.ts";

const kRevealOptions = [
  "controls",
  "controlsTutorial",
  "controlsLayout",
  "controlsBackArrows",
  "progress",
  "slideNumber",
  "showSlideNumber",
  "hash",
  "hashOneBasedIndex",
  "respondToHashChanges",
  "history",
  "keyboard",
  "overview",
  "disableLayout",
  "center",
  "touch",
  "loop",
  "rtl",
  "navigationMode",
  "shuffle",
  "fragments",
  "fragmentInURL",
  "embedded",
  "help",
  "pause",
  "showNotes",
  "autoPlayMedia",
  "preloadIframes",
  "autoSlide",
  "autoSlideStoppable",
  "autoSlideMethod",
  "defaultTiming",
  "mouseWheel",
  "display",
  "hideInactiveCursor",
  "hideCursorTime",
  "previewLinks",
  "transition",
  "transitionSpeed",
  "backgroundTransition",
  "viewDistance",
  "mobileViewDistance",
  "parallaxBackgroundImage",
  "parallaxBackgroundSize",
  "parallaxBackgroundHorizontal",
  "parallaxBackgroundVertical",
  "width",
  "height",
  "margin",
  "minScale",
  "maxScale",
  "mathjax",
];

const kRevealThemes = [
  "black",
  "white",
  "league",
  "beige",
  "sky",
  "night",
  "serif",
  "simple",
  "solarized",
  "blood",
  "moon",
];

const kHashType = "hash-type";

const kRevealKebabOptions = kRevealOptions.reduce(
  (options: string[], option: string) => {
    const kebab = camelToKebab(option);
    if (kebab !== option) {
      options.push(kebab);
    }
    return options;
  },
  [],
);

export function revealjsFormat() {
  return mergeConfigs(
    createHtmlPresentationFormat(9, 5),
    {
      metadata: revealMetadataFilter({
        [kHashType]: "number",
      }),
      metadataFilter: revealMetadataFilter,
      formatExtras: (_input: string, _flags: PandocFlags, format: Format) => {
        const extras: FormatExtras = {};
        // Only tweak when no reveal built-in theme is used
        if (
          format.metadata[kTheme] ||
          !kRevealThemes.includes(format.metadata[kTheme] as string)
        ) {
          if (format.pandoc[kFrom] != undefined) {
            throw new Error("from can't be changed in reveal format.");
          }

          extras.pandoc = format.metadata[kHashType] === "number"
            ? {
              from: "markdown-auto_identifiers",
            }
            : {
              from: "markdown",
            };

          extras.metadata = revealMetadataFilter({
            theme: "white",
            center: false,
            controlsTutorial: false,
            hash: true,
            hashOneBasedIndex: true,
            transition: "none",
            backgroundTransition: "none",
          });
        }

        extras.html = {
          [kHtmlPostprocessors]: [revealHtmlPostprocessor()],
        };

        return extras;
      },
    },
  );
}

function revealMetadataFilter(metadata: Metadata) {
  // convert kebab case to camel case for reveal options
  const filtered: Metadata = {};
  Object.keys(metadata).forEach((key) => {
    const value = metadata[key];
    if (
      kRevealKebabOptions.includes(key)
    ) {
      filtered[kebabToCamel(key)] = value;
    } else {
      filtered[key] = value;
    }
  });
  return filtered;
}

function revealHtmlPostprocessor() {
  return (doc: Document): Promise<string[]> => {
    // find reveal initializatio and perform fixups
    const scripts = doc.querySelectorAll("script");
    for (const script of scripts) {
      const scriptEl = script as Element;
      if (
        scriptEl.innerText &&
        scriptEl.innerText.indexOf("Reveal.initialize({") !== -1
      ) {
        // quote slideNumber
        scriptEl.innerText = scriptEl.innerText.replace(
          /slideNumber: (h[\.\/]v|c(?:\/t)?)/,
          "slideNumber: '$1'",
        );
      }
    }

    return Promise.resolve([]);
  };
}

function camelToKebab(camel: string) {
  const kebab: string[] = [];
  for (let i = 0; i < camel.length; i++) {
    const ch = camel.charAt(i);
    if (ch === ch.toUpperCase()) {
      kebab.push("-");
      kebab.push(ch.toLowerCase());
    } else {
      kebab.push(ch);
    }
  }
  return kebab.join("");
}

function kebabToCamel(kebab: string) {
  const camel: string[] = [];
  for (let i = 0; i < kebab.length; i++) {
    const ch = kebab.charAt(i);
    if (ch === "-") {
      camel.push(kebab.charAt(++i).toUpperCase());
    } else {
      camel.push(ch);
    }
  }
  return camel.join("");
}
