const PATTERN = /^(\d+)([smhd])$/;

/**
 * Parses a short-form duration string (e.g. "15m", "7d") into milliseconds.
 * Supports `s` (seconds), `m` (minutes), `h` (hours), `d` (days). Throws on
 * any other input — there are no implicit conversions.
 */
export const parseDurationToMs = (input: string): number => {
  const match = PATTERN.exec(input);
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const [, n, unit] = match;
  const num = Number.parseInt(n!, 10);
  switch (unit) {
    case "s":
      return num * 1_000;
    case "m":
      return num * 60 * 1_000;
    case "h":
      return num * 60 * 60 * 1_000;
    case "d":
      return num * 24 * 60 * 60 * 1_000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
};
