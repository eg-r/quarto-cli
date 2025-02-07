/*
* error.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// deno-lint-ignore-file no-explicit-any

export class ErrorEx extends Error {
  constructor(
    name: string,
    message: string,
    printName = true,
    printStack = true,
  ) {
    super(message);
    this.name = name;
    this.printName = printName;
    this.printStack = printStack;
  }

  public readonly printName: boolean;
  public readonly printStack: boolean;
}

export function asErrorEx(e: unknown) {
  if (e instanceof ErrorEx) {
    return e;
  } else if (e instanceof Error) {
    // ammend this error rather than creating a new ErrorEx
    // so that the stack trace survivies
    (e as any).printName = e.name !== "Error";
    (e as any).printStack = !!e.message;
    return e as ErrorEx;
  } else {
    return new ErrorEx("Error", String(e), false, true);
  }
}
