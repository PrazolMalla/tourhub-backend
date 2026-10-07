import { TeamMemberService } from "../team-member.service";
import type { TeamMemberRepository } from "../team-member.repository";
import { NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  fileToRecord: jest.fn(() => ({ publicId: "team/new", url: "https://cdn/new.jpg" })),
}));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  name: "Pemba",
  role: "Lead Guide",
  location: "Solukhumbu",
  description: "Summited 10 times",
  deletedAt: null as Date | null,
  profilePhoto: undefined as string | undefined,
  profilePhotoPublicId: undefined as string | undefined,
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
  sortBy: "createdAt",
  sortOrder: "desc",
  ...o,
});

describe("TeamMemberService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: TeamMemberService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new TeamMemberService(repo as unknown as TeamMemberRepository);
  });

  describe("list", () => {
    it.each([
      [undefined, { deletedAt: null }],
      ["live", { deletedAt: null }],
      ["trash", { deletedAt: { $ne: null } }],
      ["all", {}],
    ] as const)("state=%s", async (state, filter) => {
      await service.list(opts(), state ? { state } : {});
      expect(repo.findAll.mock.calls[0][0]).toEqual(filter);
    });

    it("searches across name/role/location/description", async () => {
      await service.list(opts({ search: "guide?" }));
      const rx = { $regex: "guide\\?", $options: "i" };
      expect(repo.findAll.mock.calls[0][0].$or).toEqual([
        { name: rx },
        { role: rx },
        { location: rx },
        { description: rx },
      ]);
    });

    it("maps DTOs without internal fields", async () => {
      repo.findAll.mockResolvedValue([makeDoc({ profilePhotoPublicId: "team/x" })]);
      repo.count.mockResolvedValue(1);
      const res = await service.list(opts());
      expect(res.data[0]).toMatchObject({ id: ID, name: "Pemba" });
      expect(res.data[0]).not.toHaveProperty("profilePhotoPublicId");
      expect(res.data[0]).not.toHaveProperty("deletedAt");
    });
  });

  it("findById returns or 404s", async () => {
    repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("create", () => {
    it("trims fields", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({
        name: " Pemba ",
        role: " Guide ",
        location: "KTM",
        description: " Bio ",
      });
      expect(repo.create).toHaveBeenCalledWith({
        name: "Pemba",
        role: "Guide",
        location: "KTM",
        description: "Bio",
      });
    });

    it("includes profilePhoto when given", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({
        name: "P",
        role: "R",
        location: "L",
        description: "D",
        profilePhoto: "https://x/p.jpg",
      });
      expect(repo.create.mock.calls[0][0].profilePhoto).toBe("https://x/p.jpg");
    });
  });

  describe("update", () => {
    it("trims provided text fields only", async () => {
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { name: " N ", location: " L " });
      expect(repo.update).toHaveBeenCalledWith(ID, { name: "N", location: "L" });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it("pasting a new photo URL deletes the orphaned uploaded asset", async () => {
      repo.findById.mockResolvedValue(
        makeDoc({ profilePhoto: "https://cdn/old.jpg", profilePhotoPublicId: "team/old" }),
      );
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { profilePhoto: "https://ext/new.jpg" });
      expect(del).toHaveBeenCalledWith("team/old", "image");
      expect(repo.update).toHaveBeenCalledWith(ID, {
        profilePhoto: "https://ext/new.jpg",
        profilePhotoPublicId: null,
      });
    });

    it("keeps the asset when the photo URL is unchanged or was external", async () => {
      repo.findById
        .mockResolvedValueOnce(
          makeDoc({ profilePhoto: "https://cdn/old.jpg", profilePhotoPublicId: "team/old" }),
        )
        .mockResolvedValueOnce(makeDoc({ profilePhoto: "https://ext/a.jpg" }));
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, { profilePhoto: "https://cdn/old.jpg" });
      await service.update(ID, { profilePhoto: "https://ext/b.jpg" });
      expect(del).not.toHaveBeenCalled();
    });

    it("404 when missing", async () => {
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("trash", () => {
    it("sendToTrash and restoreFromTrash toggle deletedAt", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.sendToTrash(ID);
      expect(doc.deletedAt).toBeInstanceOf(Date);
      await service.restoreFromTrash(ID);
      expect(doc.deletedAt).toBeNull();
      expect(doc.save).toHaveBeenCalledTimes(2);
    });

    it.each(["sendToTrash", "restoreFromTrash", "removeImage"] as const)("%s 404s", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("photo", () => {
    const file = {} as Express.Multer.File;

    it("uploadImage replaces an uploaded photo", async () => {
      const doc = makeDoc({ profilePhotoPublicId: "team/old" });
      repo.findById.mockResolvedValue(doc);
      await service.uploadImage(ID, file);
      expect(del).toHaveBeenCalledWith("team/old", "image");
      expect(doc).toMatchObject({
        profilePhoto: "https://cdn/new.jpg",
        profilePhotoPublicId: "team/new",
      });
    });

    it("uploadImage cleans up the upload when the member is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.uploadImage(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenCalledWith("team/new", "image");
    });

    it("removeImage clears the photo", async () => {
      const doc = makeDoc({ profilePhoto: "u", profilePhotoPublicId: "team/old" });
      repo.findById.mockResolvedValue(doc);
      const res = await service.removeImage(ID);
      expect(del).toHaveBeenCalledWith("team/old", "image");
      expect(res).not.toHaveProperty("profilePhoto");
    });

    it("removeImage with an external photo deletes nothing", async () => {
      repo.findById.mockResolvedValue(makeDoc({ profilePhoto: "https://ext/a.jpg" }));
      await service.removeImage(ID);
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe("hardDelete", () => {
    it("removes the uploaded photo and the doc", async () => {
      repo.findById.mockResolvedValue(makeDoc({ profilePhotoPublicId: "team/old" }));
      repo.delete.mockResolvedValue(makeDoc());
      await service.hardDelete(ID);
      expect(del).toHaveBeenCalledWith("team/old", "image");
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });

    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      repo.delete.mockResolvedValue(null);
      await expect(service.hardDelete(ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).not.toHaveBeenCalled();
    });
  });
});
