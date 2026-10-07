import type { HydratedDocument } from "mongoose";
import type { HolidayDoc } from "../holiday.model";
import { toHolidayDTO, toPublicHoliday } from "../holiday.types";

jest.mock("../../../core/utils/cloudinary.util", () => ({
  cloudinaryAutoUrl: (id: string) => `auto:${id}`,
}));

const makeDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => "h1" },
    name: "Dashain",
    slug: "dashain",
    startDate: new Date("2026-10-01T18:00:00Z"),
    endDate: new Date("2026-10-15T00:00:00Z"),
    isFeatured: true,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  }) as unknown as HydratedDocument<HolidayDoc>;

describe("holiday DTOs", () => {
  describe("toHolidayDTO", () => {
    it("fills array/number defaults for sparse docs", () => {
      expect(toHolidayDTO(makeDoc())).toMatchObject({
        id: "h1",
        images: [],
        discountPercentage: 0,
        seoKeywords: [],
        faqs: [],
        sortOrder: 0,
      });
    });

    it("uses the primary uploaded image over the external banner", () => {
      const dto = toHolidayDTO(
        makeDoc({
          bannerImage: "https://ext/b.jpg",
          images: [
            { path: "a", url: "ua" },
            { path: "b", url: "ub", isPrimary: true },
          ],
        }),
      );
      expect(dto.bannerImage).toBe("auto:b");
    });

    it("falls back to the external banner, else omits it", () => {
      expect(toHolidayDTO(makeDoc({ bannerImage: "https://ext/b.jpg" })).bannerImage).toBe(
        "https://ext/b.jpg",
      );
      expect(toHolidayDTO(makeDoc())).not.toHaveProperty("bannerImage");
    });

    it("includes archivedAt only when set", () => {
      expect(toHolidayDTO(makeDoc({ archivedAt: null }))).not.toHaveProperty("archivedAt");
      const at = new Date();
      expect(toHolidayDTO(makeDoc({ archivedAt: at })).archivedAt).toBe(at);
    });
  });

  describe("toPublicHoliday", () => {
    it("serialises to the snake_case landing contract", () => {
      expect(toPublicHoliday(makeDoc({ description: "Big festival" }))).toEqual({
        id: "h1",
        holiday_name: "Dashain",
        slug: "dashain",
        description: "Big festival",
        start_date: "2026-10-01",
        end_date: "2026-10-15",
        banner_image: "",
        discount_percentage: 0,
        is_featured: true,
        is_active: true,
        seo_title: "Dashain",
        seo_description: "Big festival",
        seo_keywords: [],
        recommended_treks: [],
        regions: [],
        body: [],
        faqs: [],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      });
    });

    it("prefers explicit SEO fields", () => {
      const pub = toPublicHoliday(makeDoc({ seoTitle: "T", seoDescription: "D" }));
      expect(pub).toMatchObject({ seo_title: "T", seo_description: "D" });
    });

    it("throws on an Invalid Date — which is why the validator must reject bad dates", () => {
      expect(() => toPublicHoliday(makeDoc({ startDate: new Date("banana") }))).toThrow(RangeError);
    });
  });
});
