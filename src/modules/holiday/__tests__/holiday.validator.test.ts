import { HolidayValidator as V } from "../holiday.validator";

const base = { name: "Dashain", startDate: "2026-10-01", endDate: "2026-10-15" };

describe("HolidayValidator", () => {
  describe("create", () => {
    it("accepts a minimal holiday and coerces dates", () => {
      const r = V.create.parse(base);
      expect(r.startDate).toBeInstanceOf(Date);
      expect(r.endDate).toBeInstanceOf(Date);
    });

    it("accepts a one-day holiday", () => {
      expect(V.create.safeParse({ ...base, endDate: "2026-10-01" }).success).toBe(true);
    });

    it.each(["banana", "", "2026-13-45"])("rejects an invalid startDate %p", (startDate) => {
      expect(V.create.safeParse({ ...base, startDate }).success).toBe(false);
    });

    it("rejects endDate before startDate", () => {
      const r = V.create.safeParse({ ...base, endDate: "2026-09-30" });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["endDate"]);
    });

    it("requires name and both dates", () => {
      expect(V.create.safeParse({ startDate: base.startDate, endDate: base.endDate }).success).toBe(
        false,
      );
      expect(V.create.safeParse({ name: "x", startDate: base.startDate }).success).toBe(false);
    });

    it("validates slug characters and discount range", () => {
      expect(V.create.safeParse({ ...base, slug: "ok-slug-1" }).success).toBe(true);
      expect(V.create.safeParse({ ...base, slug: "bad slug" }).success).toBe(false);
      expect(V.create.safeParse({ ...base, discountPercentage: "25" }).success).toBe(true);
      expect(V.create.safeParse({ ...base, discountPercentage: 101 }).success).toBe(false);
      expect(V.create.safeParse({ ...base, discountPercentage: -1 }).success).toBe(false);
    });

    it("validates faqs and rejects unknown keys", () => {
      expect(V.create.safeParse({ ...base, faqs: [{ q: "Q", a: "A" }] }).success).toBe(true);
      expect(V.create.safeParse({ ...base, faqs: [{ q: "", a: "A" }] }).success).toBe(false);
      expect(V.create.safeParse({ ...base, images: [] }).success).toBe(false);
    });
  });

  describe("update", () => {
    it("accepts a partial update and rejects empty", () => {
      expect(V.update.safeParse({ name: "New" }).success).toBe(true);
      expect(V.update.safeParse({}).success).toBe(false);
    });

    it("accepts a single date", () => {
      expect(V.update.safeParse({ endDate: "2026-10-20" }).success).toBe(true);
    });

    it("rejects an invalid date and an inverted range", () => {
      expect(V.update.safeParse({ startDate: "nope" }).success).toBe(false);
      expect(V.update.safeParse({ startDate: "2026-10-10", endDate: "2026-10-01" }).success).toBe(
        false,
      );
    });
  });

  it("validates params and alt body", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "x" }).success).toBe(false);
    expect(V.slugParam.safeParse({ slug: "dashain" }).success).toBe(true);
    expect(V.imageAltBody.safeParse({ alt: "" }).success).toBe(true);
    expect(V.imageAltBody.safeParse({}).success).toBe(false);
  });
});
