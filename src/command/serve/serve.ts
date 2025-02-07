/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProcessResult, processSuccessResult } from "../../core/process.ts";
import { createTempContext } from "../../core/temp.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";
import { RunOptions } from "../../execute/types.ts";

import { render } from "../render/render-shared.ts";

export async function serve(options: RunOptions): Promise<ProcessResult> {
  const engine = await fileExecutionEngine(options.input);
  if (engine?.run) {
    const target = await engine.target(options.input, options.quiet);
    if (target) {
      const temp = createTempContext();
      try {
        if (options.render) {
          const result = await render(target.input, { temp });
          if (result.error) {
            throw result.error;
          }
        }
        await engine.run({ ...options, input: target.input });
        return processSuccessResult();
      } finally {
        temp.cleanup();
      }
    }
  }

  return Promise.reject(
    new Error("Unable to run computations for input file"),
  );
}
