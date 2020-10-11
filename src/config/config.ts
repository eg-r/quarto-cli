import { dirname, join } from "path/mod.ts";
import { exists } from "fs/exists.ts";
import { parse } from "encoding/yaml.ts";

import type { Format } from "../api/format.ts";

import { metadataFromFile, metadataFromMarkdown } from "./metadata.ts";
import { mergeConfigs } from "./merge.ts";

export interface Config {
  [key: string]: Format;
}

export async function configFromMarkdown(
  markdown: string,
): Promise<Config> {
  return (await metadataFromMarkdown(markdown)).quarto || {};
}

export async function configFromMarkdownFile(
  file: string,
): Promise<Config> {
  return (await metadataFromFile(file)).quarto || {};
}

export async function projectConfig(file: string): Promise<Config> {
  file = await Deno.realPath(file);
  let dir: string | undefined;
  while (true) {
    // determine next directory to inspect (terminate if we can't go any higher)
    if (!dir) {
      dir = dirname(file);
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        return {};
      } else {
        dir = nextDir;
      }
    }

    // see if there is a quarto yml file there
    const quartoYml = join(dir, "_quarto.yml");
    if (await exists(quartoYml)) {
      const decoder = new TextDecoder("utf-8");
      const yml = await Deno.readFile(quartoYml);
      const config = parse(decoder.decode(yml)) as Config;
      return resolveConfig(config);
    }
  }
}

// resolve 'default' configs and merge common options
export function resolveConfig(config: Config) {
  // config to return
  const newConfig = { ...config };

  // resolve 'default'
  Object.keys(newConfig).forEach((key) => {
    if (typeof newConfig[key] === "string") {
      newConfig[key] = {};
    }
  });

  if (newConfig.common) {
    // pull out common
    const common = newConfig.common;
    delete newConfig.common;

    // merge with each format
    Object.keys(newConfig).forEach((key) => {
      newConfig[key] = mergeConfigs(common, newConfig[key]);
    });
  }

  return newConfig;
}
