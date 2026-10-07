import { SiteContentValidator as V } from "../site-content.validator";
import { SiteContentModel } from "../site-content.model";
import { SiteContentRepository } from "../site-content.repository";

describe("SiteContentValidator", () => {
  it.each(["hero", "about_hero", "seo-defaults", "Hero2"])("accepts section %p", (section) => {
    expect(V.sectionParam.safeParse({ section }).success).toBe(true);
  });

  it.each(["", "_hero", "-x", "has space", "x".repeat(41), "a.b", "$where"])(
    "rejects section %p",
    (section) => {
      expect(V.sectionParam.safeParse({ section }).success).toBe(false);
    },
  );

  it("upsert needs at least one known field", () => {
    expect(V.upsert.safeParse({}).success).toBe(false);
    expect(V.upsert.safeParse({ data: { title: "x" } }).success).toBe(true);
    expect(V.upsert.safeParse({ isPublished: false }).success).toBe(true);
    expect(V.upsert.safeParse({ images: [] }).success).toBe(false);
    expect(V.upsert.safeParse({ data: "not-an-object" }).success).toBe(false);
  });

  it("reorder requires 1..50 non-empty paths", () => {
    expect(V.reorder.safeParse({ order: ["a"] }).success).toBe(true);
    expect(V.reorder.safeParse({ order: [] }).success).toBe(false);
    expect(V.reorder.safeParse({ order: [""] }).success).toBe(false);
    expect(V.reorder.safeParse({ order: Array(51).fill("a") }).success).toBe(false);
  });

  it("imageMeta and removeImage require imagePath", () => {
    expect(V.imageMeta.safeParse({ imagePath: "a", alt: "x" }).success).toBe(true);
    expect(V.imageMeta.safeParse({ alt: "x" }).success).toBe(false);
    expect(V.removeImage.safeParse({ imagePath: "a" }).success).toBe(true);
    expect(V.removeImage.safeParse({}).success).toBe(false);
  });
});

describe("SiteContentRepository", () => {
  const repo = new SiteContentRepository();
  afterEach(() => jest.restoreAllMocks());

  it("findBySection lowercases the key", async () => {
    const spy = jest.spyOn(SiteContentModel, "findOne").mockResolvedValue(null as never);
    await repo.findBySection("HERO");
    expect(spy).toHaveBeenCalledWith({ section: "hero" });
  });

  it("upsertBySection upserts with defaults on the lowercased key", async () => {
    const spy = jest.spyOn(SiteContentModel, "findOneAndUpdate").mockResolvedValue({} as never);
    await repo.upsertBySection("FAQ", { isPublished: true });
    expect(spy).toHaveBeenCalledWith(
      { section: "faq" },
      { $set: { isPublished: true, section: "faq" } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  });

  it("listAllPublished excludes unpublished and archived", async () => {
    const spy = jest.spyOn(SiteContentModel, "find").mockResolvedValue([] as never);
    await repo.listAllPublished();
    await repo.listAll();
    expect(spy.mock.calls).toEqual([[{ isPublished: true, archivedAt: null }], [{}]]);
  });
});
