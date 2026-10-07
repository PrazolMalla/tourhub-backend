import { RegionService } from "../region.service";
import type { RegionRepository } from "../region.repository";
import { ConflictError, HttpError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  fileToRecord: jest.fn(() => ({ publicId: "regions/new", url: "https://cdn/new.jpg" })),
}));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  name: "Everest",
  slug: "everest",
  key: "everest",
  type: "trek-region",
  isActive: true,
  sortOrder: 0,
  archivedAt: null as Date | null,
  imagePath: undefined as string | undefined,
  imageUrl: undefined as string | undefined,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const opts = (o: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 10,
  skip: 0,
  sortBy: "sortOrder",
  sortOrder: "asc",
  ...o,
});

describe("RegionService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: RegionService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new RegionService(repo as unknown as RegionRepository);
  });

  describe("listing", () => {
    it.each([
      ["live", { archivedAt: null }],
      ["archived", { archivedAt: { $ne: null } }],
      ["all", {}],
    ] as const)("list state=%s", async (state, filter) => {
      await service.list(opts(), state);
      expect(repo.findAll.mock.calls[0][0]).toEqual(filter);
    });

    it("list escapes search", async () => {
      await service.list(opts({ search: "(ev" }));
      expect(repo.findAll.mock.calls[0][0].name).toEqual({ $regex: "\\(ev", $options: "i" });
    });

    it("listPublic excludes inactive and archived regions", async () => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);
      const res = await service.listPublic(opts({ sortBy: "name", sortOrder: "desc" }));
      expect(repo.findAll).toHaveBeenCalledWith(
        { isActive: true, archivedAt: null },
        { skip: 0, limit: 10, sort: { name: -1 } },
      );
      expect(res.meta.total).toBe(1);
    });

    it("listAll returns active regions by sortOrder", async () => {
      await service.listAll();
      expect(repo.findAll).toHaveBeenCalledWith(
        { isActive: true, archivedAt: null },
        { sort: { sortOrder: 1 } },
      );
    });
  });

  describe("lookups", () => {
    it("admin findById / findBySlug return any region", async () => {
      repo.findById.mockResolvedValue(makeDoc({ isActive: false }));
      repo.findBySlug.mockResolvedValue(makeDoc({ archivedAt: new Date() }));
      await expect(service.findById(ID)).resolves.toMatchObject({ isActive: false });
      await expect(service.findBySlug("everest")).resolves.toMatchObject({ id: ID });
    });

    it("admin lookups 404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      repo.findBySlug.mockResolvedValue(null);
      await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.findBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("published lookups return active, live regions", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.findPublishedById(ID)).resolves.toMatchObject({ id: ID });
      await expect(service.findPublishedBySlug("everest")).resolves.toMatchObject({ id: ID });
    });

    it.each([
      ["missing", null],
      ["inactive", makeDoc({ isActive: false })],
      ["archived", makeDoc({ archivedAt: new Date() })],
    ])("published lookups 404 when %s", async (_l, doc) => {
      repo.findById.mockResolvedValue(doc);
      repo.findBySlug.mockResolvedValue(doc);
      await expect(service.findPublishedById(ID)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.findPublishedBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("create", () => {
    it("derives the slug from the name and trims fields", async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ name: " Upper Mustang ", key: " mustang ", type: "trek-region" });
      expect(repo.create).toHaveBeenCalledWith({
        name: "Upper Mustang",
        slug: "upper-mustang",
        key: "mustang",
        type: "trek-region",
      });
    });

    it("uses an explicit slug", async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ name: "X", slug: "My Region", key: "x" });
      expect(repo.create.mock.calls[0][0].slug).toBe("my-region");
    });

    it("409 on a duplicate slug", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.create({ name: "Everest", key: "e" })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it("400 when no slug can be derived", async () => {
      await expect(service.create({ name: "सगरमाथा", key: "s" })).rejects.toBeInstanceOf(HttpError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("normalises slug/name/key", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { slug: "New Slug", name: " N ", key: " k " });
      expect(repo.update).toHaveBeenCalledWith(ID, { slug: "new-slug", name: "N", key: "k" });
    });

    it("400 for an empty slug result and 404 when missing", async () => {
      await expect(service.update(ID, { slug: "!!!" })).rejects.toBeInstanceOf(HttpError);
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("archive / image / delete", () => {
    const file = {} as Express.Multer.File;

    it("archive + unarchive", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc).toMatchObject({ isActive: false });
      expect(doc.archivedAt).toBeInstanceOf(Date);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
    });

    it.each(["archive", "unarchive", "removeImage", "hardDelete"] as const)(
      "%s 404s",
      async (m) => {
        repo.findById.mockResolvedValue(null);
        await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
      },
    );

    it("uploadImage swaps the image; cleans up when missing", async () => {
      const doc = makeDoc({ imagePath: "regions/old" });
      repo.findById.mockResolvedValueOnce(doc).mockResolvedValueOnce(null);
      await service.uploadImage(ID, file);
      expect(del).toHaveBeenCalledWith("regions/old", "image");
      expect(doc).toMatchObject({ imagePath: "regions/new", imageUrl: "https://cdn/new.jpg" });
      await expect(service.uploadImage(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenLastCalledWith("regions/new", "image");
    });

    it("removeImage clears the image", async () => {
      const doc = makeDoc({ imagePath: "regions/old", imageUrl: "u" });
      repo.findById.mockResolvedValue(doc);
      await service.removeImage(ID);
      expect(del).toHaveBeenCalledWith("regions/old", "image");
      expect(doc.imagePath).toBeUndefined();
      expect(doc.imageUrl).toBeUndefined();
    });

    it("hardDelete removes image + doc", async () => {
      repo.findById.mockResolvedValue(makeDoc({ imagePath: "regions/old" }));
      await service.hardDelete(ID);
      expect(del).toHaveBeenCalledWith("regions/old", "image");
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });

    it("deprecated delete() 404s when nothing was deleted", async () => {
      repo.delete.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.delete(ID)).resolves.toBeUndefined();
      await expect(service.delete(ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("ensureDefaultSeed", () => {
    it("creates all 10 defaults on an empty DB with stable sort order", async () => {
      repo.findBySlug.mockResolvedValue(null);
      await service.ensureDefaultSeed();
      expect(repo.create).toHaveBeenCalledTimes(10);
      const payloads = repo.create.mock.calls.map((c) => c[0]);
      expect(payloads[0]).toEqual({
        name: "Everest",
        slug: "everest",
        key: "everest",
        type: "trek-region",
        isActive: true,
        sortOrder: 0,
        longLabel: "Everest Region · Khumbu",
      });
      expect(payloads[5]).toMatchObject({ key: "trekking", type: "tour-category", sortOrder: 5 });
      expect(payloads[5]).not.toHaveProperty("longLabel");
    });

    it("is idempotent — skips existing slugs but keeps positions", async () => {
      repo.findBySlug.mockImplementation((slug: string) =>
        Promise.resolve(slug === "everest" ? makeDoc() : null),
      );
      await service.ensureDefaultSeed();
      expect(repo.create).toHaveBeenCalledTimes(9);
      expect(repo.create.mock.calls[0][0]).toMatchObject({ key: "annapurna", sortOrder: 1 });
    });
  });
});
