import { PartnerService } from "../partner.service";
import type { PartnerRepository } from "../partner.repository";
import { NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  fileToRecord: jest.fn(() => ({ publicId: "partners/new", url: "https://cdn/new.png" })),
}));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  name: "Acme",
  isActive: true,
  sortOrder: 0,
  archivedAt: null as Date | null,
  logoPath: undefined as string | undefined,
  logoUrl: undefined as string | undefined,
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

describe("PartnerService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: PartnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new PartnerService(repo as unknown as PartnerRepository);
  });

  describe("list", () => {
    it.each([
      ["live", { archivedAt: null }],
      ["archived", { archivedAt: { $ne: null } }],
      ["all", {}],
    ] as const)("state=%s", async (state, filter) => {
      await service.list(opts(), state);
      expect(repo.findAll.mock.calls[0][0]).toEqual(filter);
    });

    it("escapes search and forwards sort", async () => {
      await service.list(opts({ search: "a.c", sortBy: "name", sortOrder: "desc" }));
      const [filter, o] = repo.findAll.mock.calls[0];
      expect(filter.name).toEqual({ $regex: "a\\.c", $options: "i" });
      expect(o.sort).toEqual({ name: -1 });
    });
  });

  it("listPublic only returns active, live partners", async () => {
    repo.findAll.mockResolvedValue([makeDoc()]);
    repo.count.mockResolvedValue(1);
    const res = await service.listPublic(opts());
    expect(repo.findAll).toHaveBeenCalledWith(
      { isActive: true, archivedAt: null },
      { skip: 0, limit: 10, sort: { sortOrder: 1 } },
    );
    expect(repo.count).toHaveBeenCalledWith({ isActive: true, archivedAt: null });
    expect(res.data[0]).toMatchObject({ id: ID, name: "Acme" });
  });

  it("listAll returns active partners by sortOrder", async () => {
    await service.listAll();
    expect(repo.findAll).toHaveBeenCalledWith(
      { isActive: true, archivedAt: null },
      { sort: { sortOrder: 1 } },
    );
  });

  it("findById returns or 404s", async () => {
    repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("create trims name and copies provided fields only", async () => {
    repo.create.mockResolvedValue(makeDoc());
    await service.create({ name: "  Acme ", url: "https://acme.com", sortOrder: 3 });
    expect(repo.create).toHaveBeenCalledWith({
      name: "Acme",
      url: "https://acme.com",
      sortOrder: 3,
    });
  });

  it("update trims name and 404s when missing", async () => {
    repo.update.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await service.update(ID, { name: " New ", isActive: false });
    expect(repo.update).toHaveBeenCalledWith(ID, { name: "New", isActive: false });
    await expect(service.update(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("archive / unarchive", () => {
    it("archive hides and deactivates; unarchive restores", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.archivedAt).toBeInstanceOf(Date);
      expect(doc.isActive).toBe(false);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
      expect(doc.save).toHaveBeenCalledTimes(2);
    });

    it.each(["archive", "unarchive", "removeImage", "hardDelete"] as const)(
      "%s 404s when missing",
      async (m) => {
        repo.findById.mockResolvedValue(null);
        await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
      },
    );
  });

  describe("logo", () => {
    const file = {} as Express.Multer.File;

    it("uploadImage replaces an existing logo", async () => {
      const doc = makeDoc({ logoPath: "partners/old" });
      repo.findById.mockResolvedValue(doc);
      await service.uploadImage(ID, file);
      expect(del).toHaveBeenCalledWith("partners/old", "image");
      expect(doc).toMatchObject({ logoPath: "partners/new", logoUrl: "https://cdn/new.png" });
    });

    it("uploadImage without a previous logo deletes nothing", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await service.uploadImage(ID, file);
      expect(del).not.toHaveBeenCalled();
    });

    it("uploadImage cleans up the upload when the partner is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.uploadImage(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenCalledWith("partners/new", "image");
    });

    it("removeImage deletes the asset and clears fields", async () => {
      const doc = makeDoc({ logoPath: "partners/old", logoUrl: "u" });
      repo.findById.mockResolvedValue(doc);
      const res = await service.removeImage(ID);
      expect(del).toHaveBeenCalledWith("partners/old", "image");
      expect(doc.logoPath).toBeUndefined();
      expect(res).not.toHaveProperty("logoUrl");
    });
  });

  it("hardDelete removes the logo and the doc", async () => {
    repo.findById.mockResolvedValue(makeDoc({ logoPath: "partners/old" }));
    await service.hardDelete(ID);
    expect(del).toHaveBeenCalledWith("partners/old", "image");
    expect(repo.delete).toHaveBeenCalledWith(ID);
  });
});
