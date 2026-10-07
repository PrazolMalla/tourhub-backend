import { TripService } from "../trip.service";
import type { TripRepository } from "../trip.repository";
import { ConflictError, HttpError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({ hardDeleteFile: jest.fn() }));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439033";
const ADMIN = "507f1f77bcf86cd799439022";

type Img = { path: string; url: string; isPrimary?: boolean };

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  title: "Everest Base Camp",
  slug: "everest-base-camp",
  kind: "trek",
  country: "nepal",
  region: "everest",
  cats: ["trekking"],
  days: 14,
  isActive: true,
  isFeatured: false,
  archivedAt: null as Date | null,
  images: [] as Img[],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  aggregateFacets: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn(),
  setPrimaryImage: jest.fn(),
  updateImageAlt: jest.fn(),
  reorderImages: jest.fn(),
});

const opts = (o: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 20,
  skip: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
  ...o,
});

describe("TripService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: TripService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new TripService(repo as unknown as TripRepository);
  });

  describe("list (admin)", () => {
    it("defaults to live and applies filters", async () => {
      await service.list(opts({ search: "base.camp" }), {
        kind: "trek",
        country: "malaysia",
        region: "everest",
        cat: "trekking",
        isActive: false,
      });
      const filter = repo.findAll.mock.calls[0][0];
      expect(filter).toMatchObject({
        archivedAt: null,
        kind: "trek",
        country: "malaysia",
        region: "everest",
        cats: { $in: ["trekking"] },
        isActive: false,
      });
      expect(filter.$or[0]).toEqual({ title: { $regex: "base\\.camp", $options: "i" } });
    });

    it("treats nepal as including legacy docs without a country", async () => {
      await service.list(opts(), { country: "nepal", state: "all" });
      expect(repo.findAll.mock.calls[0][0]).toEqual({ country: { $in: ["nepal", null] } });
    });

    it("archived state", async () => {
      await service.list(opts(), { state: "archived" });
      expect(repo.findAll.mock.calls[0][0]).toEqual({ archivedAt: { $ne: null } });
    });
  });

  describe("listWithFacets (public)", () => {
    it("builds base / region / duration / price matches", async () => {
      await service.listWithFacets(opts(), {
        isActive: true,
        cats: ["trekking", "adventure"],
        regions: ["everest", "annapurna"],
        durationBuckets: ["d1", "d3", "bogus"],
        minPrice: 500,
        maxPrice: 1500,
      });
      const p = repo.aggregateFacets.mock.calls[0][0];
      expect(p.base).toEqual({
        archivedAt: null,
        cats: { $in: ["trekking", "adventure"] },
        isActive: true,
      });
      expect(p.regionMatch).toEqual({ region: { $in: ["everest", "annapurna"] } });
      expect(p.durationMatch).toEqual({
        $or: [{ days: { $gte: 0, $lte: 3 } }, { days: { $gte: 8 } }],
      });
      expect(p.priceMatch).toEqual({ _priceNum: { $gte: 500, $lte: 1500 } });
      expect(p).toMatchObject({ skip: 0, limit: 20, sort: { createdAt: -1 } });
    });

    it("falls back to single region/cat and min/max days", async () => {
      await service.listWithFacets(opts(), {
        region: "langtang",
        cat: "tours",
        minDays: 5,
        maxDays: 10,
      });
      const p = repo.aggregateFacets.mock.calls[0][0];
      expect(p.regionMatch).toEqual({ region: "langtang" });
      expect(p.base.cats).toEqual({ $in: ["tours"] });
      expect(p.durationMatch).toEqual({ days: { $gte: 5, $lte: 10 } });
      expect(p.priceMatch).toEqual({});
    });

    it("ignores durationBuckets that are all unknown", async () => {
      await service.listWithFacets(opts(), { durationBuckets: ["nope"] });
      expect(repo.aggregateFacets.mock.calls[0][0].durationMatch).toEqual({});
    });

    it("sorts price numerically, not as a string", async () => {
      await service.listWithFacets(opts({ sortBy: "price", sortOrder: "asc" }));
      expect(repo.aggregateFacets.mock.calls[0][0].sort).toEqual({ _priceNum: 1 });
    });

    it("maps results, totals and facets", async () => {
      repo.aggregateFacets.mockResolvedValue([
        {
          data: [makeDoc()],
          totalCount: [{ count: 7 }],
          regionFacet: [
            { _id: "everest", count: 4 },
            { _id: "annapurna", count: 3 },
          ],
          durationFacet: [
            { _id: 0, count: 1 },
            { _id: 4, count: 2 },
            { _id: 8, count: 4 },
            { _id: "other", count: 1 },
          ],
        },
      ]);
      const res = await service.listWithFacets(opts());
      expect(res.data[0]).toMatchObject({ id: ID, slug: "everest-base-camp" });
      expect(res.meta.total).toBe(7);
      expect(res.facets).toEqual({
        regions: { everest: 4, annapurna: 3 },
        durations: { d1: 1, d2: 2, d3: 4, other: 1 },
      });
    });

    it("handles an empty aggregation result", async () => {
      repo.aggregateFacets.mockResolvedValue([]);
      const res = await service.listWithFacets(opts());
      expect(res).toMatchObject({ data: [], facets: { regions: {}, durations: {} } });
      expect(res.meta.total).toBe(0);
    });
  });

  describe("lookups", () => {
    it("admin lookups return drafts; 404 when missing", async () => {
      repo.findById.mockResolvedValueOnce(makeDoc({ isActive: false })).mockResolvedValueOnce(null);
      repo.findBySlug.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.findById(ID)).resolves.toMatchObject({ isActive: false });
      await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.findBySlug("x")).resolves.toMatchObject({ id: ID });
      await expect(service.findBySlug("x")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("published lookups return live trips", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.findPublishedById(ID)).resolves.toMatchObject({ id: ID });
      await expect(service.findPublishedBySlug("everest-base-camp")).resolves.toMatchObject({
        id: ID,
      });
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
    const input = {
      title: " Annapurna Circuit ",
      kind: "trek" as const,
      country: " Nepal ",
      region: " annapurna ",
      days: 13,
    };

    it("normalises and records createdBy", async () => {
      repo.findBySlug.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ ...input, price: "1,290", isFeatured: true }, ADMIN);
      const payload = repo.create.mock.calls[0][0];
      expect(payload).toMatchObject({
        title: "Annapurna Circuit",
        slug: "annapurna-circuit",
        kind: "trek",
        country: "nepal",
        region: "annapurna",
        days: 13,
        price: "1,290",
        isFeatured: true,
      });
      expect(payload.createdBy.toString()).toBe(ADMIN);
      expect(payload).not.toHaveProperty("overview");
    });

    it("409 on a taken slug; 400 when no slug can be derived", async () => {
      repo.findBySlug.mockResolvedValue(makeDoc());
      await expect(service.create(input)).rejects.toBeInstanceOf(ConflictError);
      await expect(service.create({ ...input, title: "अन्नपूर्ण" })).rejects.toBeInstanceOf(
        HttpError,
      );
    });
  });

  describe("update", () => {
    it("normalises provided fields only", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { title: " T ", country: " Malaysia ", region: " x ", days: 3 });
      expect(repo.update).toHaveBeenCalledWith(ID, {
        title: "T",
        country: "malaysia",
        region: "x",
        days: 3,
      });
    });

    it("allows keeping its own slug, rejects another trip's", async () => {
      repo.update.mockResolvedValue(makeDoc());
      repo.findBySlug.mockResolvedValueOnce(makeDoc());
      await service.update(ID, { slug: "Everest Base Camp" });
      expect(repo.update).toHaveBeenCalledWith(ID, { slug: "everest-base-camp" });

      repo.findBySlug.mockResolvedValueOnce(makeDoc({ _id: { toString: () => OTHER } }));
      await expect(service.update(ID, { slug: "taken" })).rejects.toBeInstanceOf(ConflictError);
    });

    it("400 for an empty slug; 404 when missing", async () => {
      await expect(service.update(ID, { slug: "!!" })).rejects.toBeInstanceOf(HttpError);
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { days: 1 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("lifecycle", () => {
    it("archive + unarchive", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.isActive).toBe(false);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
    });

    it.each(["archive", "unarchive", "hardDelete", "getRaw"] as const)("%s 404s", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("hardDelete removes every image even if one fails, then the doc", async () => {
      repo.findById.mockResolvedValue(
        makeDoc({
          images: [
            { path: "a", url: "" },
            { path: "b", url: "" },
          ],
        }),
      );
      del.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      await service.delete(ID);
      expect(del).toHaveBeenCalledTimes(2);
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });
  });

  describe("images", () => {
    const img = { path: "trips/a", url: "https://cdn/a.jpg" };

    it("addImages; cleans up when the trip is missing", async () => {
      repo.addImages.mockResolvedValueOnce(makeDoc({ images: [img] })).mockResolvedValueOnce(null);
      await expect(service.addImages(ID, [img])).resolves.toMatchObject({ img: img.url });
      await expect(service.addImages(ID, [img])).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenCalledWith(img.path, "image");
    });

    it("removeImage only deletes assets the trip owns", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [img] }));
      repo.removeImage.mockResolvedValue(makeDoc());
      await service.removeImage(ID, img.path);
      expect(del).toHaveBeenCalledWith(img.path, "image");

      del.mockClear();
      await expect(service.removeImage(ID, "blog/someone-else")).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it("setPrimaryImage requires an owned image", async () => {
      repo.findById.mockResolvedValue(makeDoc({ images: [img] }));
      repo.setPrimaryImage.mockResolvedValue(makeDoc({ images: [{ ...img, isPrimary: true }] }));
      await service.setPrimaryImage(ID, img.path);
      await expect(service.setPrimaryImage(ID, "nope")).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.setPrimaryImage).toHaveBeenCalledTimes(1);
    });

    it("updateImageAlt distinguishes missing trip from missing image", async () => {
      repo.updateImageAlt
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(makeDoc());
      await expect(service.updateImageAlt(ID, "p", "a")).rejects.toThrow(`Trip ${ID} not found`);
      await expect(service.updateImageAlt(ID, "p", "a")).rejects.toThrow("Image not found");
      await expect(service.updateImageAlt(ID, "p", "a")).resolves.toMatchObject({ id: ID });
    });

    it("reorderImages returns the DTO or 404s", async () => {
      repo.reorderImages.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.reorderImages(ID, ["a"])).resolves.toMatchObject({ id: ID });
      await expect(service.reorderImages(ID, ["a"])).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
