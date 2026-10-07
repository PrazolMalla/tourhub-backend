import { BlogValidator as V } from "../blog.validator";

const base = { title: "Hello", body: "<p>x</p>" };

describe("BlogValidator", () => {
  describe("create", () => {
    it("accepts a minimal post", () => {
      expect(V.create.safeParse(base).success).toBe(true);
    });

    it("requires title and body", () => {
      expect(V.create.safeParse({ title: "x" }).success).toBe(false);
      expect(V.create.safeParse({ body: "x" }).success).toBe(false);
      expect(V.create.safeParse({ ...base, title: "  " }).success).toBe(false);
    });

    it("treats an empty slug as absent", () => {
      const r = V.create.parse({ ...base, slug: "" });
      expect(r.slug).toBeUndefined();
    });

    it("rejects unknown fields", () => {
      expect(V.create.safeParse({ ...base, images: [] }).success).toBe(false);
    });

    it("rejects a non-URL heroImage", () => {
      expect(V.create.safeParse({ ...base, heroImage: "not a url" }).success).toBe(false);
    });

    it("coerces datePublished", () => {
      const r = V.create.parse({ ...base, datePublished: "2026-01-15" });
      expect(r.datePublished).toBeInstanceOf(Date);
    });

    describe("booleans", () => {
      it.each([
        [true, true],
        [false, false],
        ["true", true],
        ["false", false],
      ])("featured=%p parses to %p", (input, expected) => {
        expect(V.create.parse({ ...base, featured: input }).featured).toBe(expected);
        expect(V.create.parse({ ...base, isActive: input }).isActive).toBe(expected);
      });

      it("rejects garbage booleans", () => {
        expect(V.create.safeParse({ ...base, isActive: "yes" }).success).toBe(false);
      });
    });

    describe("exploreHref", () => {
      it.each(["/trips/everest", "https://x.com", ""])("accepts %p", (exploreHref) => {
        expect(V.create.safeParse({ ...base, exploreHref }).success).toBe(true);
      });

      it.each(["javascript:alert(1)", "data:text/html,x", "//evil.com"])("rejects %p", (h) => {
        expect(V.create.safeParse({ ...base, exploreHref: h }).success).toBe(false);
        expect(V.update.safeParse({ exploreHref: h }).success).toBe(false);
      });
    });

    describe("related", () => {
      const rel = { slug: "a", category: "c", title: "t" };

      it("accepts an array or a JSON string", () => {
        expect(V.create.parse({ ...base, related: [rel] }).related).toEqual([rel]);
        expect(V.create.parse({ ...base, related: JSON.stringify([rel]) }).related).toEqual([rel]);
      });

      it("caps at 12 and validates entries", () => {
        expect(V.create.safeParse({ ...base, related: Array(13).fill(rel) }).success).toBe(false);
        expect(V.create.safeParse({ ...base, related: [{ slug: "a" }] }).success).toBe(false);
        expect(V.create.safeParse({ ...base, related: "[broken" }).success).toBe(false);
      });
    });
  });

  describe("update", () => {
    it("accepts a single field, rejects empty", () => {
      expect(V.update.safeParse({ excerpt: "x" }).success).toBe(true);
      expect(V.update.safeParse({}).success).toBe(false);
    });

    it("allows clearing heroImage with an empty string", () => {
      expect(V.update.safeParse({ heroImage: "" }).success).toBe(true);
    });
  });

  describe("params and image bodies", () => {
    it("validates ids and slugs", () => {
      expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
      expect(V.idParam.safeParse({ id: "abc" }).success).toBe(false);
      expect(V.slugParam.safeParse({ slug: "x" }).success).toBe(true);
      expect(V.slugParam.safeParse({ slug: "" }).success).toBe(false);
    });

    it("validates image path and meta bodies", () => {
      expect(V.imagePathBody.safeParse({ path: "blog/a" }).success).toBe(true);
      expect(V.imagePathBody.safeParse({ path: "" }).success).toBe(false);
      expect(V.imageMetaBody.safeParse({ path: "blog/a", alt: "" }).success).toBe(true);
      expect(V.imageMetaBody.safeParse({ path: "blog/a" }).success).toBe(false);
    });
  });
});
