/**
 * Escape every regex-special character in a user-supplied string so it can be
 * safely interpolated into a `RegExp` / Mongo `$regex` filter.
 *
 * Reason: passing raw user input into `$regex` opens two doors —
 *
 *   1. **Regex injection**: the user can change the meaning of the query
 *      (e.g. search for `"a|b"` and get an OR instead of a literal).
 *   2. **ReDoS** (catastrophic backtracking): patterns like `^((a+)+)+$`
 *      hang Node's single-threaded event loop, blocking the entire API.
 *
 * Use everywhere we feed `options.search` into Mongoose. See qa-test.md#H-1.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
