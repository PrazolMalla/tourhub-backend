import { SchoolTripChecklistValidator as V } from "../school-trip-checklist.validator";
import { SchoolTripChecklistRepository } from "../school-trip-checklist.repository";

describe("SchoolTripChecklistValidator", () => {
  describe("create (multipart)", () => {
    it("requires a type of at least 2 chars", () => {
      expect(V.create.safeParse({ type: "Primary" }).success).toBe(true);
      expect(V.create.safeParse({ type: "P" }).success).toBe(false);
      expect(V.create.safeParse({}).success).toBe(false);
    });

    it.each([
      ["true", true],
      ["false", false],
      ["0", false],
      ["", false],
      ["1", true],
      [true, true],
    ])("isActive %p → %p", (isActive, expected) => {
      expect(V.create.parse({ type: "Primary", isActive }).isActive).toBe(expected);
    });

    it("coerces sortOrder and bounds it", () => {
      expect(V.create.parse({ type: "Primary", sortOrder: "3" }).sortOrder).toBe(3);
      expect(V.create.safeParse({ type: "Primary", sortOrder: "-1" }).success).toBe(false);
      expect(V.create.safeParse({ type: "Primary", sortOrder: "10000" }).success).toBe(false);
    });
  });

  describe("update", () => {
    it("parses the string 'false' as false (not true)", () => {
      expect(V.update.parse({ isActive: "false" }).isActive).toBe(false);
      expect(V.update.parse({ isActive: false }).isActive).toBe(false);
      expect(V.update.parse({ isActive: "true" }).isActive).toBe(true);
    });

    it("rejects empty and unknown fields", () => {
      expect(V.update.safeParse({}).success).toBe(false);
      expect(V.update.safeParse({ pdfUrl: "x" }).success).toBe(false);
    });
  });

  describe("download", () => {
    it.each(["9800000000", "+977 980-000-0000", "+14155552671"])("accepts phone %p", (phone) => {
      expect(V.download.safeParse({ name: "Ram", phone }).success).toBe(true);
    });

    it.each(["123", "abcdefghij", "+97798000000000000000", "98000-", ""])(
      "rejects phone %p",
      (phone) => {
        expect(V.download.safeParse({ name: "Ram", phone }).success).toBe(false);
      },
    );

    it("requires a real name and no extra fields", () => {
      expect(V.download.safeParse({ name: "R", phone: "9800000000" }).success).toBe(false);
      expect(V.download.safeParse({ name: "Ram", phone: "9800000000", x: 1 }).success).toBe(false);
    });
  });
});

describe("SchoolTripChecklistRepository.filterForState", () => {
  const repo = new SchoolTripChecklistRepository();
  it.each([
    ["live", { archivedAt: null }],
    ["archived", { archivedAt: { $ne: null } }],
    ["all", {}],
  ] as const)("%s", (state, expected) => {
    expect(repo.filterForState(state)).toEqual(expected);
  });
});
