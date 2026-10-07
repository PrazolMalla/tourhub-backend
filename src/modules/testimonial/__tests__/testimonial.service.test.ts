import { TestimonialService } from "../testimonial.service";
import type { TestimonialRepository } from "../testimonial.repository";
import { NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  fileToRecord: jest.fn(() => ({ publicId: "testimonials/new", url: "https://cdn/new" })),
}));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  name: "Anna",
  rating: 5,
  quote: "Amazing trek",
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  archivedAt: null as Date | null,
  avatarPath: undefined as string | undefined,
  avatarUrl: undefined as string | undefined,
  videoUrl: undefined as string | undefined,
  videoPublicId: undefined as string | undefined,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
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

describe("TestimonialService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: TestimonialService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new TestimonialService(repo as unknown as TestimonialRepository);
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
      await service.list(opts({ search: "a|b" }));
      expect(repo.findAll.mock.calls[0][0].name).toEqual({ $regex: "a\\|b", $options: "i" });
    });

    it("listPublic excludes inactive and archived", async () => {
      await service.listPublic(opts({ sortBy: "rating", sortOrder: "desc" }));
      expect(repo.findAll).toHaveBeenCalledWith(
        { isActive: true, archivedAt: null },
        { skip: 0, limit: 10, sort: { rating: -1 } },
      );
    });

    it("listAll returns active testimonials", async () => {
      await service.listAll();
      expect(repo.findAll).toHaveBeenCalledWith(
        { isActive: true, archivedAt: null },
        { sort: { sortOrder: 1 } },
      );
    });
  });

  it("findById returns or 404s", async () => {
    repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("create trims and copies only provided fields", async () => {
    repo.create.mockResolvedValue(makeDoc());
    await service.create({ name: " Anna ", quote: " Great ", rating: 4, source: "google" });
    expect(repo.create).toHaveBeenCalledWith({
      name: "Anna",
      quote: "Great",
      rating: 4,
      source: "google",
    });
  });

  describe("update", () => {
    it("trims name/quote", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { name: " B ", quote: " Q ", isFeatured: true });
      expect(repo.update).toHaveBeenCalledWith(ID, { name: "B", quote: "Q", isFeatured: true });
    });

    it("pasting a new videoUrl deletes the uploaded video and clears its id", async () => {
      repo.findById.mockResolvedValue(
        makeDoc({ videoUrl: "https://cdn/v.mp4", videoPublicId: "testimonials/v" }),
      );
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { videoUrl: "https://youtube.com/embed/x" });
      expect(del).toHaveBeenCalledWith("testimonials/v", "video");
      expect(repo.update).toHaveBeenCalledWith(ID, {
        videoUrl: "https://youtube.com/embed/x",
        videoPublicId: null,
      });
    });

    it("leaves the video alone when the URL is unchanged or external", async () => {
      repo.findById
        .mockResolvedValueOnce(makeDoc({ videoUrl: "https://cdn/v.mp4", videoPublicId: "t/v" }))
        .mockResolvedValueOnce(makeDoc({ videoUrl: "https://youtube.com/a" }));
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { videoUrl: "https://cdn/v.mp4" });
      await service.update(ID, { videoUrl: "https://youtube.com/b" });
      expect(del).not.toHaveBeenCalled();
    });

    it("404 when missing", async () => {
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("archive", () => {
    it("archive + unarchive", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.isActive).toBe(false);
      expect(doc.archivedAt).toBeInstanceOf(Date);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
    });

    it.each(["archive", "unarchive", "removeImage", "removeVideo", "hardDelete"] as const)(
      "%s 404s",
      async (m) => {
        repo.findById.mockResolvedValue(null);
        await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
      },
    );
  });

  describe("media", () => {
    it("uploadImage replaces the avatar", async () => {
      const doc = makeDoc({ avatarPath: "testimonials/old" });
      repo.findById.mockResolvedValue(doc);
      await service.uploadImage(ID, file);
      expect(del).toHaveBeenCalledWith("testimonials/old", "image");
      expect(doc).toMatchObject({ avatarPath: "testimonials/new", avatarUrl: "https://cdn/new" });
    });

    it("uploadImage / uploadVideo clean up when the testimonial is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.uploadImage(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenLastCalledWith("testimonials/new", "image");
      await expect(service.uploadVideo(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenLastCalledWith("testimonials/new", "video");
    });

    it("uploadVideo replaces an uploaded video", async () => {
      const doc = makeDoc({ videoPublicId: "testimonials/oldv" });
      repo.findById.mockResolvedValue(doc);
      await service.uploadVideo(ID, file);
      expect(del).toHaveBeenCalledWith("testimonials/oldv", "video");
      expect(doc).toMatchObject({ videoUrl: "https://cdn/new", videoPublicId: "testimonials/new" });
    });

    it("removeImage and removeVideo clear fields", async () => {
      const doc = makeDoc({ avatarPath: "a", avatarUrl: "u", videoUrl: "v", videoPublicId: "vp" });
      repo.findById.mockResolvedValue(doc);
      await service.removeImage(ID);
      await service.removeVideo(ID);
      expect(del).toHaveBeenCalledWith("a", "image");
      expect(del).toHaveBeenCalledWith("vp", "video");
      expect(doc.avatarUrl).toBeUndefined();
      expect(doc.videoUrl).toBeUndefined();
    });

    it("hardDelete removes both assets", async () => {
      repo.findById.mockResolvedValue(makeDoc({ avatarPath: "a", videoPublicId: "vp" }));
      await service.hardDelete(ID);
      expect(del).toHaveBeenCalledWith("a", "image");
      expect(del).toHaveBeenCalledWith("vp", "video");
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });
  });
});
