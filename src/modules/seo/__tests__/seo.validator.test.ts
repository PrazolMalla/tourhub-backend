import { SeoValidator as V } from "../seo.validator";

const OID = "507f1f77bcf86cd799439011";

describe("SeoValidator", () => {
  describe("entityParam", () => {
    it.each(["trip", "blog", "holiday", "vehicle"])("accepts %s with an ObjectId", (entityType) => {
      expect(V.entityParam.safeParse({ entityType, entityId: OID }).success).toBe(true);
    });

    it("rejects a non-ObjectId id for DB-backed entities", () => {
      expect(V.entityParam.safeParse({ entityType: "trip", entityId: "home" }).success).toBe(false);
    });

    it("accepts known static page keys only", () => {
      expect(V.entityParam.safeParse({ entityType: "static_page", entityId: "home" }).success).toBe(
        true,
      );
      expect(V.entityParam.safeParse({ entityType: "static_page", entityId: "hom" }).success).toBe(
        false,
      );
      expect(V.entityParam.safeParse({ entityType: "static_page", entityId: OID }).success).toBe(
        false,
      );
    });

    it("rejects unknown entity types", () => {
      expect(V.entityParam.safeParse({ entityType: "user", entityId: OID }).success).toBe(false);
    });
  });

  describe("upsert", () => {
    it("leaves absent fields undefined (untouched)", () => {
      const r = V.upsert.parse({ keywords: ["trek"] });
      expect(r.metaTitle).toBeUndefined();
      expect(r.canonicalUrl).toBeUndefined();
      expect(r.keywords).toEqual(["trek"]);
    });

    it("maps empty strings to null so a cleared field is actually cleared", () => {
      const r = V.upsert.parse({
        metaTitle: "",
        metaDescription: "",
        canonicalUrl: "",
        ogTitle: "",
        ogDescription: "",
        twitterTitle: "",
        twitterDescription: "",
      });
      expect(r).toMatchObject({
        metaTitle: null,
        metaDescription: null,
        canonicalUrl: null,
        ogTitle: null,
        ogDescription: null,
        twitterTitle: null,
        twitterDescription: null,
      });
    });

    it("keeps real values", () => {
      const r = V.upsert.parse({ metaTitle: " Everest ", canonicalUrl: "https://x.com/a" });
      expect(r).toMatchObject({ metaTitle: "Everest", canonicalUrl: "https://x.com/a" });
    });

    it("enforces lengths, URL shape, twitterCard and strictness", () => {
      expect(V.upsert.safeParse({ metaTitle: "x".repeat(71) }).success).toBe(false);
      expect(V.upsert.safeParse({ metaDescription: "x".repeat(301) }).success).toBe(false);
      expect(V.upsert.safeParse({ canonicalUrl: "not a url" }).success).toBe(false);
      expect(V.upsert.safeParse({ twitterCard: "player" }).success).toBe(false);
      expect(V.upsert.safeParse({ keywords: Array(21).fill("k") }).success).toBe(false);
      expect(V.upsert.safeParse({ robots: { index: false, bogus: true } }).success).toBe(false);
      expect(V.upsert.safeParse({ seoScore: 100 }).success).toBe(false);
    });
  });

  it("listQuery and imageAlt", () => {
    expect(V.listQuery.safeParse({}).success).toBe(true);
    expect(V.listQuery.safeParse({ entityType: "blog" }).success).toBe(true);
    expect(V.listQuery.safeParse({ entityType: "x" }).success).toBe(false);
    expect(V.imageAlt.safeParse({ alt: "A" }).success).toBe(true);
    expect(V.imageAlt.safeParse({ alt: "x".repeat(201) }).success).toBe(false);
  });
});
