export class FullChainLandingGraphError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "FullChainLandingGraphError";
  }
}

export function landingGraphError(code: string): never {
  throw new FullChainLandingGraphError(code);
}
