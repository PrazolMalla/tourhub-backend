import { VehicleService } from "../vehicle.service";
import type { VehicleRepository } from "../vehicle.repository";
import { HttpError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  fileToRecord: jest.fn(() => ({
    publicId: "vehicles/new",
    url: "https://cdn/new.jpg",
    sizeBytes: 5,
    mimeType: "image/png",
  })),
}));
jest.mock("../../../core/utils/cloudinary.util", () => ({
  cloudinaryAutoUrl: (id: string) => `auto:${id}`,
}));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  slug: "land-cruiser",
  name: "Land Cruiser",
  tag: "4x4",
  desc: "Rugged",
  specs: [],
  overview: [],
  features: [],
  facts: [],
  gallery: [] as string[],
  images: [] as Array<{ path: string; url: string; alt?: string; isPrimary?: boolean }>,
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  archivedAt: null as Date | null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  findBySlug: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
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

const file = {} as Express.Multer.File;

describe("VehicleService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: VehicleService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new VehicleService(repo as unknown as VehicleRepository);
  });

  describe("listing", () => {
    it.each([
      ["live", { archivedAt: null }],
      ["archived", { archivedAt: { $ne: null } }],
      ["all", {}],
    ] as const)("admin list state=%s", async (state, filter) => {
      await service.list(opts(), state);
      expect(repo.findAll.mock.calls[0][0]).toEqual(filter);
    });

    it("listPublic only shows active live vehicles, with escaped search", async () => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);
      const res = await service.listPublic(opts({ search: "4x4+" }));
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        isActive: true,
        archivedAt: null,
        name: { $regex: "4x4\\+", $options: "i" },
      });
      expect(res.data[0]).toMatchObject({ slug: "land-cruiser", img: "" });
      expect(res.data[0]).not.toHaveProperty("id");
    });
  });

  describe("findPublicBySlug", () => {
    it("returns a live vehicle", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.findPublicBySlug("land-cruiser")).resolves.toMatchObject({
        name: "Land Cruiser",
      });
    });

    it.each([
      ["missing", null],
      ["inactive", makeDoc({ isActive: false })],
      ["archived", makeDoc({ archivedAt: new Date() })],
    ])("404 when %s", async (_l, doc) => {
      repo.findBySlug.mockResolvedValue(doc);
      await expect(service.findPublicBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it("findById returns or 404s", async () => {
    repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("create", () => {
    it("derives slug and fills defaults", async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ name: " Hiace Van " });
      expect(repo.findOne).toHaveBeenCalledWith({ slug: "hiace-van" });
      expect(repo.create).toHaveBeenCalledWith({
        slug: "hiace-van",
        name: "Hiace Van",
        tag: "",
        desc: "",
        specs: [],
        overview: [],
        features: [],
        facts: [],
        gallery: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
      });
    });

    it("keeps an explicit slug and img", async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ name: "X", slug: "My-Car", img: "https://x/y.jpg" });
      expect(repo.create.mock.calls[0][0]).toMatchObject({
        slug: "my-car",
        img: "https://x/y.jpg",
      });
    });

    it("409 on duplicate slug; 400 when no slug can be derived", async () => {
      repo.findOne.mockResolvedValue(makeDoc());
      expect((await service.create({ name: "Land Cruiser" }).catch((e) => e)).statusCode).toBe(409);
      const err = await service.create({ name: "जीप" }).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err.statusCode).toBe(400);
    });
  });

  describe("update", () => {
    it("normalises name and slug", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { name: " N ", slug: "New Slug", isFeatured: true });
      expect(repo.update).toHaveBeenCalledWith(ID, {
        name: "N",
        slug: "new-slug",
        isFeatured: true,
      });
    });

    it("400 for an empty slug result; 404 when missing", async () => {
      await expect(service.update(ID, { slug: "--" })).rejects.toBeInstanceOf(HttpError);
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("archive / images / delete", () => {
    it("archive + unarchive", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.isActive).toBe(false);
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

    it("uploadImage replaces the image; cleans up when missing", async () => {
      const doc = makeDoc({ images: [{ path: "vehicles/old", url: "u" }] });
      repo.findById.mockResolvedValueOnce(doc).mockResolvedValueOnce(null);
      const dto = await service.uploadImage(ID, file);
      expect(del).toHaveBeenCalledWith("vehicles/old", "image");
      expect(doc.images).toHaveLength(1);
      expect(doc.images[0]).toMatchObject({ path: "vehicles/new", isPrimary: true });
      expect(dto.img).toBe("auto:vehicles/new");
      await expect(service.uploadImage(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenLastCalledWith("vehicles/new", "image");
    });

    it("removeImage clears images", async () => {
      const doc = makeDoc({ images: [{ path: "p", url: "u" }] });
      repo.findById.mockResolvedValue(doc);
      await service.removeImage(ID);
      expect(doc.images).toEqual([]);
      expect(del).toHaveBeenCalledWith("p", "image");
    });

    it("updateImageAlt", async () => {
      const doc = makeDoc({ images: [{ path: "p", url: "u" }] });
      repo.findById
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce(makeDoc())
        .mockResolvedValueOnce(null);
      await service.updateImageAlt(ID, "Front view");
      expect(doc.images[0]?.alt).toBe("Front view");
      await expect(service.updateImageAlt(ID, "x")).rejects.toThrow("has no image");
      await expect(service.updateImageAlt(ID, "x")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("hardDelete removes images and the doc", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [{ path: "p", url: "u" }] }));
      await service.hardDelete(ID);
      expect(del).toHaveBeenCalledWith("p", "image");
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });
  });
});
