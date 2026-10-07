import { parseDurationToMs } from "../duration.util";

describe("parseDurationToMs", () => {
  it.each([
    ["30s", 30_000],
    ["15m", 15 * 60_000],
    ["2h", 2 * 60 * 60_000],
    ["7d", 7 * 24 * 60 * 60_000],
    ["1d", 24 * 60 * 60_000],
  ])("parses %s -> %d ms", (input, expected) => {
    expect(parseDurationToMs(input)).toBe(expected);
  });

  it.each(["", "abc", "10", "10x", " 1m", "-1m", "1.5m", "1ms"])(
    "throws on invalid input %s",
    (input) => {
      expect(() => parseDurationToMs(input)).toThrow();
    },
  );
});
