import { BannerValidator as V } from "../banner.validator";

const base = { section: "landing", title: "Welcome" };

describe("BannerValidator", () => {
  describe("create", () => {
    it("accepts a minimal banner", () => {
      expect(V.create.safeParse(base).success).toBe(true);
    });

    it("requires section and a non-blank title", () => {
      expect(V.create.safeParse({ title: "x" }).success).toBe(false);
      expect(V.create.safeParse({ ...base, title: "   " }).success).toBe(false);
      expect(V.create.safeParse({ ...base, section: "home" }).success).toBe(false);
    });

    it("rejects unknown fields", () => {
      expect(V.create.safeParse({ ...base, imagePath: "x" }).success).toBe(false);
    });

    describe("hrefs", () => {
      it.each([
        "/trips",
        "#faq",
        "https://x.com/a",
        "http://x.com",
        "mailto:a@b.com",
        "tel:+977",
        "",
      ])("accepts %p", (ctaHref) => {
        expect(V.create.safeParse({ ...base, ctaHref }).success).toBe(true);
      });

      it.each([
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html,<script>",
        "vbscript:x",
        "//evil.com",
        "/\\\\evil.com",
        "evil.com",
        "/path with space",
      ])("rejects %p", (ctaHref) => {
        expect(V.create.safeParse({ ...base, ctaHref }).success).toBe(false);
        expect(V.create.safeParse({ ...base, ctaSecondaryHref: ctaHref }).success).toBe(false);
      });
    });

    describe("multipart coercion", () => {
      it("coerces isActive strings", () => {
        const t = V.create.parse({ ...base, isActive: "true" });
        const f = V.create.parse({ ...base, isActive: "false" });
        expect(t.isActive).toBe(true);
        expect(f.isActive).toBe(false);
      });

      it("coerces sortOrder strings and treats empty as absent", () => {
        expect(V.create.parse({ ...base, sortOrder: "3" }).sortOrder).toBe(3);
        expect(V.create.parse({ ...base, sortOrder: "" }).sortOrder).toBeUndefined();
      });

      it.each(["-1", "1.5", "abc"])("rejects sortOrder %p", (sortOrder) => {
        expect(V.create.safeParse({ ...base, sortOrder }).success).toBe(false);
      });

      it("parses style from a JSON string", () => {
        const r = V.create.parse({
          ...base,
          style: JSON.stringify({ align: "center", overlayOpacity: "0.5" }),
        });
        expect(r.style).toEqual({ align: "center", overlayOpacity: 0.5 });
      });

      it("rejects invalid JSON style, unknown style keys and out-of-range opacity", () => {
        expect(V.create.safeParse({ ...base, style: "{not json" }).success).toBe(false);
        expect(V.create.safeParse({ ...base, style: { evil: "x" } }).success).toBe(false);
        expect(V.create.safeParse({ ...base, style: { overlayOpacity: 2 } }).success).toBe(false);
        expect(V.create.safeParse({ ...base, style: { align: "justify" } }).success).toBe(false);
      });
    });
  });

  describe("update", () => {
    it("accepts a single field and rejects an empty body", () => {
      expect(V.update.safeParse({ subtitle: "x" }).success).toBe(true);
      expect(V.update.safeParse({}).success).toBe(false);
    });

    it("does not allow changing section", () => {
      expect(V.update.safeParse({ section: "about" }).success).toBe(false);
    });
  });

  describe("params", () => {
    it("validates id and section", () => {
      expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
      expect(V.idParam.safeParse({ id: "x" }).success).toBe(false);
      expect(V.sectionParam.safeParse({ section: "gallery" }).success).toBe(true);
      expect(V.sectionParam.safeParse({ section: "nope" }).success).toBe(false);
    });
  });

  describe("listQuery", () => {
    it.each(["live", "archived", "all"])("accepts state=%s", (state) => {
      expect(V.listQuery.safeParse({ state }).success).toBe(true);
    });

    it("rejects states the repository does not understand", () => {
      expect(V.listQuery.safeParse({ state: "trash" }).success).toBe(false);
      expect(V.listQuery.safeParse({ state: "bogus" }).success).toBe(false);
    });

    it("rejects unknown sections and extra keys", () => {
      expect(V.listQuery.safeParse({ section: "nope" }).success).toBe(false);
      expect(V.listQuery.safeParse({ foo: "1" }).success).toBe(false);
    });
  });
});
