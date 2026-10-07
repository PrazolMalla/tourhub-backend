import { SiteContentService } from "../site-content.service";
import type { SiteContentRepository } from "../site-content.repository";
import { SITE_CONTENT_DEFAULTS } from "../site-content.types";
import { NotFoundError } from "../../../core/errors";

jest.mock("../../../core/utils/uploads", () => ({ hardDeleteFile: jest.fn() }));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;

type Img = { path: string; url: string; alt?: string; caption?: string; sortOrder?: number };

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => "sc1" },
  section: "hero",
  data: { title: "Hi" },
  images: [] as Img[],
  isPublished: true,
  notes: "internal: rotate hero before Dashain",
  archivedAt: null as Date | null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  save: jest.fn(),
  deleteOne: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findBySection: jest.fn(),
  upsertBySection: jest.fn(),
  listAllPublished: jest.fn().mockResolvedValue([]),
  listAll: jest.fn().mockResolvedValue([]),
});

describe("SiteContentService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SiteContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new SiteContentService(repo as unknown as SiteContentRepository);
  });

  describe("getPublic", () => {
    it("returns a published section without admin notes", async () => {
      repo.findBySection.mockResolvedValue(makeDoc());
      const dto = await service.getPublic("hero");
      expect(dto).toMatchObject({ id: "sc1", section: "hero", data: { title: "Hi" } });
      expect(dto).not.toHaveProperty("notes");
    });

    it.each([
      ["missing", null],
      ["unpublished", makeDoc({ isPublished: false })],
      ["archived", makeDoc({ archivedAt: new Date() })],
    ])("falls back to bundled defaults when %s", async (_l, doc) => {
      repo.findBySection.mockResolvedValue(doc);
      const dto = await service.getPublic("HERO");
      expect(dto).toEqual({
        id: "default",
        section: "hero",
        data: SITE_CONTENT_DEFAULTS.hero,
        images: [],
        isPublished: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
    });

    it("falls back to an empty object for unknown sections", async () => {
      repo.findBySection.mockResolvedValue(null);
      expect((await service.getPublic("nope")).data).toEqual({});
    });
  });

  it("listAllPublic strips notes", async () => {
    repo.listAllPublished.mockResolvedValue([makeDoc(), makeDoc({ section: "faq" })]);
    const list = await service.listAllPublic();
    expect(list).toHaveLength(2);
    for (const dto of list) expect(dto).not.toHaveProperty("notes");
  });

  it("admin reads keep notes", async () => {
    repo.findBySection.mockResolvedValue(makeDoc());
    repo.listAll.mockResolvedValue([makeDoc()]);
    expect(await service.getAdmin("hero")).toHaveProperty("notes");
    expect((await service.listAllAdmin())[0]).toHaveProperty("notes");
  });

  it("getAdmin creates an unpublished placeholder seeded from defaults", async () => {
    repo.findBySection.mockResolvedValue(null);
    repo.upsertBySection.mockResolvedValue(makeDoc({ isPublished: false }));
    await service.getAdmin("faq");
    expect(repo.upsertBySection).toHaveBeenCalledWith("faq", {
      data: SITE_CONTENT_DEFAULTS.faq,
      images: [],
      isPublished: false,
    });
  });

  it("upsert only sends provided fields", async () => {
    repo.upsertBySection.mockResolvedValue(makeDoc());
    await service.upsert("hero", { isPublished: false });
    expect(repo.upsertBySection).toHaveBeenCalledWith("hero", { isPublished: false });
    await service.upsert("hero", { data: { a: 1 }, notes: "n" });
    expect(repo.upsertBySection).toHaveBeenLastCalledWith("hero", { data: { a: 1 }, notes: "n" });
  });

  it("addImages appends to existing images (or starts fresh)", async () => {
    const a = { path: "a", url: "ua" };
    const b = { path: "b", url: "ub" };
    repo.findBySection.mockResolvedValueOnce(makeDoc({ images: [a] })).mockResolvedValueOnce(null);
    repo.upsertBySection.mockResolvedValue(makeDoc());
    await service.addImages("gallery", [b]);
    expect(repo.upsertBySection).toHaveBeenCalledWith("gallery", { images: [a, b] });
    await service.addImages("gallery", [b]);
    expect(repo.upsertBySection).toHaveBeenLastCalledWith("gallery", { images: [b] });
  });

  describe("reorderImages", () => {
    it("orders by the given paths, unknowns last, and renumbers sortOrder", async () => {
      const doc = makeDoc({
        images: [
          { path: "a", url: "" },
          { path: "b", url: "" },
          { path: "c", url: "" },
          { path: "x", url: "" },
        ],
      });
      repo.findBySection.mockResolvedValue(doc);
      await service.reorderImages("gallery", ["c", "a", "b"]);
      expect(doc.images.map((i) => [i.path, i.sortOrder])).toEqual([
        ["c", 0],
        ["a", 1],
        ["b", 2],
        ["x", 3],
      ]);
      expect(doc.save).toHaveBeenCalled();
    });

    it("404 for a missing section", async () => {
      repo.findBySection.mockResolvedValue(null);
      await expect(service.reorderImages("x", ["a"])).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("updateImageMeta", () => {
    it("updates alt and caption independently", async () => {
      const doc = makeDoc({ images: [{ path: "a", url: "", alt: "old", caption: "keep" }] });
      repo.findBySection.mockResolvedValue(doc);
      await service.updateImageMeta("gallery", "a", { alt: "new" });
      expect(doc.images[0]).toMatchObject({ alt: "new", caption: "keep" });
    });

    it("404 for missing section or image", async () => {
      repo.findBySection.mockResolvedValueOnce(null).mockResolvedValueOnce(makeDoc());
      await expect(service.updateImageMeta("x", "a", {})).rejects.toThrow("not found");
      await expect(service.updateImageMeta("x", "a", {})).rejects.toThrow("Image not found");
    });
  });

  describe("removeImage", () => {
    it("saves the section before destroying the asset", async () => {
      const order: string[] = [];
      const doc = makeDoc({
        images: [
          { path: "a", url: "" },
          { path: "b", url: "" },
        ],
      });
      doc.save.mockImplementation(async () => void order.push("save"));
      del.mockImplementation(async () => {
        order.push("delete");
        return true;
      });
      repo.findBySection.mockResolvedValue(doc);
      await service.removeImage("gallery", "a");
      expect(doc.images.map((i) => i.path)).toEqual(["b"]);
      expect(order).toEqual(["save", "delete"]);
    });

    it("does not delete the asset when saving fails", async () => {
      const doc = makeDoc({ images: [{ path: "a", url: "" }] });
      doc.save.mockRejectedValue(new Error("db down"));
      repo.findBySection.mockResolvedValue(doc);
      await expect(service.removeImage("gallery", "a")).rejects.toThrow("db down");
      expect(del).not.toHaveBeenCalled();
    });

    it("tolerates an asset already gone from Cloudinary", async () => {
      del.mockResolvedValue(false);
      repo.findBySection.mockResolvedValue(makeDoc({ images: [{ path: "a", url: "" }] }));
      await expect(service.removeImage("gallery", "a")).resolves.toBeDefined();
    });

    it("404 for missing section or image", async () => {
      repo.findBySection.mockResolvedValueOnce(null).mockResolvedValueOnce(makeDoc());
      await expect(service.removeImage("x", "a")).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.removeImage("x", "a")).rejects.toThrow("Image not found");
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    it("archive unpublishes; unarchive clears archivedAt", async () => {
      const doc = makeDoc();
      repo.findBySection.mockResolvedValue(doc);
      await service.archive("hero");
      expect(doc.isPublished).toBe(false);
      expect(doc.archivedAt).toBeInstanceOf(Date);
      await service.unarchive("hero");
      expect(doc.archivedAt).toBeNull();
    });

    it("hardDelete removes all images then the doc", async () => {
      const doc = makeDoc({
        images: [
          { path: "a", url: "" },
          { path: "b", url: "" },
        ],
      });
      repo.findBySection.mockResolvedValue(doc);
      await service.hardDelete("gallery");
      expect(del.mock.calls).toEqual([
        ["a", "image"],
        ["b", "image"],
      ]);
      expect(doc.deleteOne).toHaveBeenCalled();
    });

    it.each(["archive", "unarchive", "hardDelete"] as const)("%s 404s", async (m) => {
      repo.findBySection.mockResolvedValue(null);
      await expect(service[m]("x")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it("ensureDefaults seeds only missing sections, published", async () => {
    const keys = Object.keys(SITE_CONTENT_DEFAULTS);
    repo.findBySection.mockImplementation(async (s: string) => (s === "hero" ? makeDoc() : null));
    await service.ensureDefaults();
    expect(repo.upsertBySection).toHaveBeenCalledTimes(keys.length - 1);
    expect(repo.upsertBySection).toHaveBeenCalledWith("faq", {
      data: SITE_CONTENT_DEFAULTS.faq,
      images: [],
      isPublished: true,
    });
    expect(repo.upsertBySection.mock.calls.map((c) => c[0])).not.toContain("hero");
  });
});
