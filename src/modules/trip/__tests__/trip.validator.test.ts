import { TripValidator as V } from "../trip.validator";

const base = { title: "EBC", kind: "trek", country: "nepal", region: "everest", days: 14 };

describe("TripValidator", () => {
  describe("create", () => {
    it("accepts a minimal trip and coerces days", () => {
      expect(V.create.parse({ ...base, days: "14" }).days).toBe(14);
    });

    it("requires core fields", () => {
      for (const key of ["title", "kind", "country", "region", "days"] as const) {
        const { [key]: _omit, ...rest } = base;
        expect(V.create.safeParse(rest).success).toBe(false);
      }
      expect(V.create.safeParse({ ...base, kind: "cruise" }).success).toBe(false);
      expect(V.create.safeParse({ ...base, days: -1 }).success).toBe(false);
    });

    it("treats an empty slug as absent", () => {
      expect(V.create.parse({ ...base, slug: "" }).slug).toBeUndefined();
    });

    it.each([
      [true, true],
      [false, false],
      ["true", true],
      ["false", false],
    ])("isActive/isFeatured %p → %p", (input, expected) => {
      const r = V.create.parse({ ...base, isActive: input, isFeatured: input });
      expect(r.isActive).toBe(expected);
      expect(r.isFeatured).toBe(expected);
      expect(V.update.parse({ isActive: input }).isActive).toBe(expected);
    });

    it("parses list fields from arrays or JSON strings", () => {
      const r = V.create.parse({
        ...base,
        cats: '["trekking","adventure"]',
        highlights: ["A", "B"],
        altitude: JSON.stringify([{ l: "Lukla", m: "2860" }]),
        itin: [{ d: "Day 1", t: "Fly to Lukla", meta: ["2,860m"] }],
      });
      expect(r.cats).toEqual(["trekking", "adventure"]);
      expect(r.altitude).toEqual([{ l: "Lukla", m: 2860 }]);
      expect(r.itin?.[0]?.t).toBe("Fly to Lukla");
    });

    it("rejects malformed nested items", () => {
      expect(V.create.safeParse({ ...base, itin: [{ d: "Day 1" }] }).success).toBe(false);
      expect(V.create.safeParse({ ...base, altitude: [{ l: "x", m: 1, z: 2 }] }).success).toBe(
        false,
      );
      expect(V.create.safeParse({ ...base, cats: "[broken" }).success).toBe(false);
    });

    describe("videoUrl", () => {
      it.each(["https://www.youtube.com/embed/abc", "https://vimeo.com/1", ""])(
        "accepts %p",
        (v) => {
          expect(V.create.safeParse({ ...base, videoUrl: v }).success).toBe(true);
        },
      );

      it.each(["javascript:alert(1)", "data:text/html,x", "not a url"])("rejects %p", (v) => {
        expect(V.create.safeParse({ ...base, videoUrl: v }).success).toBe(false);
        expect(V.update.safeParse({ videoUrl: v }).success).toBe(false);
      });
    });
  });

  describe("update and image bodies", () => {
    it("update is non-empty and strict", () => {
      expect(V.update.safeParse({}).success).toBe(false);
      expect(V.update.safeParse({ images: [] }).success).toBe(false);
      expect(V.update.safeParse({ price: "990" }).success).toBe(true);
    });

    it("image bodies", () => {
      expect(V.imagePathBody.safeParse({ path: "trips/a" }).success).toBe(true);
      expect(V.imageReorderBody.safeParse({ order: [] }).success).toBe(false);
      expect(V.imageReorderBody.safeParse({ order: ["a", "b"] }).success).toBe(true);
      expect(V.imageMetaBody.safeParse({ path: "a", alt: "" }).success).toBe(true);
    });

    it("params", () => {
      expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
      expect(V.idParam.safeParse({ id: "x" }).success).toBe(false);
      expect(V.slugParam.safeParse({ slug: "ebc" }).success).toBe(true);
    });
  });
});
