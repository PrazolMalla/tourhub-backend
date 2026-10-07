import { HolidayService } from "../holiday.service";
import type { HolidayRepository } from "../holiday.repository";
import { HttpError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  fileToRecord: jest.fn(() => ({
    publicId: "holidays/new",
    url: "https://cdn/new.jpg",
    sizeBytes: 10,
    mimeType: "image/jpeg",
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
  name: "Dashain",
  slug: "dashain",
  startDate: new Date("2026-10-01"),
  endDate: new Date("2026-10-15"),
  images: [] as Array<{ path: string; url: string; alt?: string; isPrimary?: boolean }>,
  discountPercentage: 10,
  isFeatured: false,
  isActive: true,
  archivedAt: null as Date | null,
  seoKeywords: [],
  recommendedTreks: [],
  regions: ["everest"],
  body: [],
  faqs: [],
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  findBySlug: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const opts = (o: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 10,
  skip: 0,
  sortBy: "startDate",
  sortOrder: "asc",
  ...o,
});

const file = {} as Express.Multer.File;

describe("HolidayService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: HolidayService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new HolidayService(repo as unknown as HolidayRepository);
  });

  describe("list (admin)", () => {
    it.each([
      ["live", { archivedAt: null }],
      ["archived", { archivedAt: { $ne: null } }],
      ["all", {}],
    ] as const)("state=%s", async (state, filter) => {
      await service.list(opts(), state);
      expect(repo.findAll.mock.calls[0][0]).toEqual(filter);
    });

    it("searches by escaped name", async () => {
      await service.list(opts({ search: "tihar*" }));
      expect(repo.findAll.mock.calls[0][0].name).toEqual({ $regex: "tihar\\*", $options: "i" });
    });
  });

  describe("listPublic", () => {
    it("only active, live holidays with region + search filters", async () => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);
      const res = await service.listPublic(opts({ search: "fest" }), { regions: ["everest"] });
      const [filter] = repo.findAll.mock.calls[0];
      expect(filter).toMatchObject({
        isActive: true,
        archivedAt: null,
        regions: { $in: ["everest"] },
      });
      expect(filter.$or).toHaveLength(3);
      expect(res.data[0]).toMatchObject({ holiday_name: "Dashain", start_date: "2026-10-01" });
    });

    it.each([
      ["start_date", "startDate"],
      ["end_date", "endDate"],
      ["discount_percentage", "discountPercentage"],
      ["name", "name"],
    ])("maps sortBy=%s to %s", async (sortBy, field) => {
      await service.listPublic(opts({ sortBy, sortOrder: "desc" }));
      expect(repo.findAll.mock.calls[0][1].sort).toEqual({ [field]: -1 });
    });

    it("omits the region filter when empty", async () => {
      await service.listPublic(opts(), { regions: [] });
      expect(repo.findAll.mock.calls[0][0]).not.toHaveProperty("regions");
    });
  });

  describe("findPublicBySlug", () => {
    it("returns a live holiday", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.findPublicBySlug("dashain")).resolves.toMatchObject({ slug: "dashain" });
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
    const input = { name: " Tihar 2026 ", startDate: "2026-11-01", endDate: "2026-11-05" };

    it("derives a slug, applies defaults and converts dates", async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create(input);
      expect(repo.findOne).toHaveBeenCalledWith({ slug: "tihar-2026" });
      const payload = repo.create.mock.calls[0][0];
      expect(payload).toMatchObject({
        name: "Tihar 2026",
        slug: "tihar-2026",
        discountPercentage: 0,
        isFeatured: false,
        isActive: true,
        seoKeywords: [],
        sortOrder: 0,
      });
      expect(payload.startDate).toEqual(new Date("2026-11-01"));
      expect(payload).not.toHaveProperty("description");
    });

    it("prefers an explicit slug", async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ ...input, slug: "Custom-Slug" });
      expect(repo.create.mock.calls[0][0].slug).toBe("custom-slug");
    });

    it("409 on a duplicate slug", async () => {
      repo.findOne.mockResolvedValue(makeDoc());
      const err = await service.create(input).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err.statusCode).toBe(409);
    });

    it("400 when no slug can be derived (Devanagari name, no slug)", async () => {
      const err = await service.create({ ...input, name: "दशैं" }).catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("normalises name/slug/dates", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, {
        name: " New ",
        slug: "New Slug",
        startDate: "2026-10-02",
        endDate: "2026-10-03",
      });
      expect(repo.update).toHaveBeenCalledWith(ID, {
        name: "New",
        slug: "new-slug",
        startDate: new Date("2026-10-02"),
        endDate: new Date("2026-10-03"),
      });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it("400 for a slug that slugifies to empty", async () => {
      await expect(service.update(ID, { slug: "---" })).rejects.toBeInstanceOf(HttpError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejects moving only endDate before the stored startDate", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      const err = await service.update(ID, { endDate: "2026-09-01" }).catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejects moving only startDate after the stored endDate", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await expect(service.update(ID, { startDate: "2026-12-01" })).rejects.toBeInstanceOf(
        HttpError,
      );
    });

    it("accepts a single-date change that keeps the range valid", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { endDate: "2026-10-20" });
      expect(repo.update).toHaveBeenCalled();
    });

    it("404 when missing (single-date path and plain path)", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update(ID, { endDate: "2026-10-20" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("archive / unarchive", () => {
    it("archive deactivates", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.archivedAt).toBeInstanceOf(Date);
      expect(doc.isActive).toBe(false);
    });

    it("unarchive clears archivedAt", async () => {
      const doc = makeDoc({ archivedAt: new Date() });
      repo.findById.mockResolvedValue(doc);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
    });

    it.each(["archive", "unarchive"] as const)("%s 404s", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("image", () => {
    it("uploadImage replaces the old image", async () => {
      const doc = makeDoc({ images: [{ path: "holidays/old", url: "u" }] });
      repo.findById.mockResolvedValue(doc);
      const res = await service.uploadImage(ID, file);
      expect(del).toHaveBeenCalledWith("holidays/old", "image");
      expect(doc.images).toEqual([
        {
          path: "holidays/new",
          url: "https://cdn/new.jpg",
          isPrimary: true,
          sizeBytes: 10,
          mimeType: "image/jpeg",
        },
      ]);
      expect(res.bannerImage).toBe("auto:holidays/new");
    });

    it("uploadImage cleans up the new asset when the holiday is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.uploadImage(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenCalledWith("holidays/new", "image");
    });

    it("removeImage deletes assets and clears images", async () => {
      const doc = makeDoc({ images: [{ path: "p", url: "u" }] });
      repo.findById.mockResolvedValue(doc);
      await service.removeImage(ID);
      expect(del).toHaveBeenCalledWith("p", "image");
      expect(doc.images).toEqual([]);
    });

    it("updateImageAlt sets alt or 404s without an image", async () => {
      const doc = makeDoc({ images: [{ path: "p", url: "u" }] });
      repo.findById.mockResolvedValueOnce(doc).mockResolvedValueOnce(makeDoc());
      await service.updateImageAlt(ID, "Festival");
      expect(doc.images[0]?.alt).toBe("Festival");
      await expect(service.updateImageAlt(ID, "x")).rejects.toThrow("has no image");
    });

    it.each(["removeImage", "hardDelete"] as const)("%s 404s", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("updateImageAlt 404s for a missing holiday", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateImageAlt(ID, "x")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it("hardDelete removes images then the doc", async () => {
    repo.findById.mockResolvedValue(makeDoc({ images: [{ path: "p", url: "u" }] }));
    await service.hardDelete(ID);
    expect(del).toHaveBeenCalledWith("p", "image");
    expect(repo.delete).toHaveBeenCalledWith(ID);
  });
});
