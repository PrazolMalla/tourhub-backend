import { BlogService } from "../blog.service";
import type { BlogRepository } from "../blog.repository";
import { ConflictError, HttpError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({ hardDeleteFile: jest.fn() }));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439033";
const ADMIN_ID = "507f1f77bcf86cd799439022";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  slug: "everest-guide",
  title: "Everest Guide",
  body: "<p>hi</p>",
  featured: false,
  related: [],
  isActive: true,
  archivedAt: null,
  images: [] as { path: string; url: string; isPrimary?: boolean }[],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn(),
  setPrimaryImage: jest.fn(),
  updateImageAlt: jest.fn(),
});

const opts = (overrides: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 10,
  skip: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
  ...overrides,
});

describe("BlogService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: BlogService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new BlogService(repo as unknown as BlogRepository);
  });

  describe("list", () => {
    beforeEach(() => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);
    });

    it("defaults to live posts and maps DTOs", async () => {
      const res = await service.list(opts());
      expect(repo.findAll.mock.calls[0][0]).toEqual({ archivedAt: null });
      expect(res.data[0]).toMatchObject({ id: ID, slug: "everest-guide" });
      expect(res.meta.total).toBe(1);
    });

    it.each([
      ["archived", { archivedAt: { $ne: null } }],
      ["all", {}],
    ] as const)("state=%s", async (state, expected) => {
      await service.list(opts(), { state });
      expect(repo.findAll.mock.calls[0][0]).toEqual(expected);
    });

    it("applies category/featured/isActive filters, escaped search and sort", async () => {
      await service.list(opts({ search: "a(b", sortBy: "title", sortOrder: "asc" }), {
        category: "Trek",
        featured: false,
        isActive: true,
      });
      const [filter, options] = repo.findAll.mock.calls[0];
      expect(filter).toMatchObject({ category: "Trek", featured: false, isActive: true });
      expect(filter.$or[0]).toEqual({ title: { $regex: "a\\(b", $options: "i" } });
      expect(options).toEqual({ skip: 0, limit: 10, sort: { title: 1 } });
      expect(repo.count).toHaveBeenCalledWith(filter);
    });
  });

  describe("findById / findBySlug", () => {
    it("return DTOs", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
      await expect(service.findBySlug("everest-guide")).resolves.toMatchObject({ id: ID });
    });

    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      repo.findBySlug.mockResolvedValue(null);
      await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.findBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("admin lookups still return drafts", async () => {
      repo.findById.mockResolvedValue(makeDoc({ isActive: false }));
      await expect(service.findById(ID)).resolves.toMatchObject({ isActive: false });
    });
  });

  describe("findPublishedById / findPublishedBySlug", () => {
    it("return live, active posts", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.findPublishedById(ID)).resolves.toMatchObject({ id: ID });
      await expect(service.findPublishedBySlug("everest-guide")).resolves.toMatchObject({ id: ID });
    });

    it.each([
      ["a draft", { isActive: false }],
      ["an archived post", { archivedAt: new Date() }],
    ])("hide %s behind a 404", async (_label, overrides) => {
      repo.findById.mockResolvedValue(makeDoc(overrides));
      repo.findBySlug.mockResolvedValue(makeDoc(overrides));
      await expect(service.findPublishedById(ID)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.findPublishedBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      repo.findBySlug.mockResolvedValue(null);
      await expect(service.findPublishedById(ID)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.findPublishedBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("create", () => {
    beforeEach(() => repo.create.mockResolvedValue(makeDoc()));

    it("slugifies the title when no slug is given", async () => {
      repo.findBySlug.mockResolvedValue(null);
      await service.create({ title: "  Everest Base Camp: A Guide! ", body: "b" }, ADMIN_ID);
      expect(repo.findBySlug).toHaveBeenCalledWith("everest-base-camp-a-guide");
      const payload = repo.create.mock.calls[0][0];
      expect(payload).toMatchObject({
        title: "Everest Base Camp: A Guide!",
        slug: "everest-base-camp-a-guide",
        body: "b",
      });
      expect(payload.createdBy.toString()).toBe(ADMIN_ID);
    });

    it("slugifies an explicit slug and copies only provided fields", async () => {
      repo.findBySlug.mockResolvedValue(null);
      await service.create({ title: "T", slug: "My Slug", body: "b", featured: true });
      const payload = repo.create.mock.calls[0][0];
      expect(payload.slug).toBe("my-slug");
      expect(payload.featured).toBe(true);
      expect(payload).not.toHaveProperty("description");
      expect(payload).not.toHaveProperty("createdBy");
    });

    it("409 when the slug exists", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.create({ title: "Everest Guide", body: "b" })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it.each(["नेपाल यात्रा", "!!!"])("400 when title %p cannot produce a slug", async (title) => {
      const err = await service.create({ title, body: "b" }).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err.statusCode).toBe(400);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("accepts a Nepali title with an explicit Latin slug", async () => {
      repo.findBySlug.mockResolvedValue(null);
      await service.create({ title: "नेपाल यात्रा", slug: "nepal-yatra", body: "b" });
      expect(repo.create.mock.calls[0][0].slug).toBe("nepal-yatra");
    });
  });

  describe("update", () => {
    it("updates only provided fields", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { title: " New ", featured: false, excerpt: "" });
      expect(repo.update).toHaveBeenCalledWith(ID, { title: "New", featured: false, excerpt: "" });
      expect(repo.findBySlug).not.toHaveBeenCalled();
    });

    it("allows keeping the same slug", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { slug: "Everest Guide" });
      expect(repo.update).toHaveBeenCalledWith(ID, { slug: "everest-guide" });
    });

    it("409 when the new slug belongs to another post", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc({ _id: { toString: () => OTHER_ID } }));
      await expect(service.update(ID, { slug: "taken" })).rejects.toBeInstanceOf(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("400 when the slug slugifies to empty", async () => {
      await expect(service.update(ID, { slug: "---" })).rejects.toBeInstanceOf(HttpError);
    });

    it("404 when missing", async () => {
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("archive / unarchive", () => {
    it("archive hides the post", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.archivedAt).toBeInstanceOf(Date);
      expect(doc.isActive).toBe(false);
      expect(doc.save).toHaveBeenCalled();
    });

    it("unarchive clears archivedAt", async () => {
      const doc = makeDoc({ archivedAt: new Date() });
      repo.findById.mockResolvedValue(doc);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
      expect(doc.save).toHaveBeenCalled();
    });

    it.each(["archive", "unarchive"] as const)("%s 404s when missing", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("hardDelete / delete", () => {
    it("removes every image then the document", async () => {
      repo.findById.mockResolvedValue(
        makeDoc({
          images: [
            { path: "p1", url: "u1" },
            { path: "p2", url: "u2" },
          ],
        }),
      );
      del.mockResolvedValue(true);
      await service.hardDelete(ID);
      expect(del.mock.calls).toEqual([
        ["p1", "image"],
        ["p2", "image"],
      ]);
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });

    it("still deletes the document when Cloudinary removal fails", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [{ path: "p1", url: "u1" }] }));
      del.mockResolvedValue(false);
      await service.delete(ID);
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });

    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.hardDelete(ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("images", () => {
    const img = { path: "blog/p1", url: "https://cdn/p1.jpg" };

    it("addImages returns the updated post", async () => {
      repo.addImages.mockResolvedValue(makeDoc({ images: [img] }));
      const res = await service.addImages(ID, [img]);
      expect(res.images).toEqual([img]);
      expect(res.heroImage).toBe(img.url);
    });

    it("addImages cleans up uploads when the post is missing", async () => {
      repo.addImages.mockResolvedValue(null);
      await expect(service.addImages(ID, [img])).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenCalledWith(img.path, "image");
    });

    it("removeImage pulls the image and deletes the asset", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [img] }));
      repo.removeImage.mockResolvedValue(makeDoc());
      await service.removeImage(ID, img.path);
      expect(repo.removeImage).toHaveBeenCalledWith(ID, img.path);
      expect(del).toHaveBeenCalledWith(img.path, "image");
    });

    it("removeImage refuses to delete an asset the post does not own", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [img] }));
      await expect(service.removeImage(ID, "trips/someone-else")).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repo.removeImage).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    });

    it("removeImage 404s for a missing post", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.removeImage(ID, img.path)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).not.toHaveBeenCalled();
    });

    it("setPrimaryImage works for an owned image and 404s otherwise", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [img] }));
      repo.setPrimaryImage.mockResolvedValue(makeDoc({ images: [{ ...img, isPrimary: true }] }));
      await expect(service.setPrimaryImage(ID, img.path)).resolves.toMatchObject({ id: ID });
      await expect(service.setPrimaryImage(ID, "nope")).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.setPrimaryImage).toHaveBeenCalledTimes(1);
    });

    it("updateImageAlt distinguishes a missing post from a missing image", async () => {
      repo.updateImageAlt.mockResolvedValueOnce(null).mockResolvedValueOnce(undefined);
      await expect(service.updateImageAlt(ID, "p", "a")).rejects.toThrow(`Blog ${ID} not found`);
      await expect(service.updateImageAlt(ID, "p", "a")).rejects.toThrow("Image not found");
    });

    it("updateImageAlt returns the DTO", async () => {
      repo.updateImageAlt.mockResolvedValue(makeDoc());
      await expect(service.updateImageAlt(ID, "p", "a")).resolves.toMatchObject({ id: ID });
    });
  });

  describe("getRaw", () => {
    it("returns the raw document or 404s", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValueOnce(doc).mockResolvedValueOnce(null);
      await expect(service.getRaw(ID)).resolves.toBe(doc);
      await expect(service.getRaw(ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
