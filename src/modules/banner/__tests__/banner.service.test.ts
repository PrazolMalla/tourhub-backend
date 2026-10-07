import { BannerService } from "../banner.service";
import type { BannerRepository } from "../banner.repository";
import { NotFoundError } from "../../../core/errors";

jest.mock("../../../core/utils/cloudinary.util", () => ({ uploadImageToCloudinary: jest.fn() }));
jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  subDirForKind: (kind: string) => `dir:${kind}`,
}));

import { uploadImageToCloudinary } from "../../../core/utils/cloudinary.util";
import { hardDeleteFile } from "../../../core/utils/uploads";

const ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439022";
const upload = uploadImageToCloudinary as jest.Mock;
const del = hardDeleteFile as jest.Mock;

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  section: "landing",
  title: "Hello",
  style: {},
  sortOrder: 0,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  archivedAt: undefined as Date | null | undefined,
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  listPublic: jest.fn(),
  listBySection: jest.fn(),
  listAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const file = { buffer: Buffer.from("img") } as Express.Multer.File;

describe("BannerService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: BannerService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new BannerService(repo as unknown as BannerRepository);
    upload.mockResolvedValue({ publicId: "new/pid", secureUrl: "https://cdn/new.jpg" });
  });

  it("listPublic maps docs to DTOs", async () => {
    repo.listPublic.mockResolvedValue([makeDoc()]);
    const res = await service.listPublic("landing");
    expect(repo.listPublic).toHaveBeenCalledWith("landing");
    expect(res[0]).toMatchObject({ id: ID, section: "landing", title: "Hello" });
    expect(res[0]).not.toHaveProperty("save");
  });

  describe("listAdmin", () => {
    it("defaults to live state across all sections", async () => {
      repo.listAll.mockResolvedValue([]);
      await service.listAdmin({});
      expect(repo.listAll).toHaveBeenCalledWith("live");
    });

    it("filters by section when given", async () => {
      repo.listBySection.mockResolvedValue([]);
      await service.listAdmin({ section: "about", state: "archived" });
      expect(repo.listBySection).toHaveBeenCalledWith("about", "archived");
      expect(repo.listAll).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("returns the DTO", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    });

    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("create", () => {
    it("trims title, copies only provided fields and records createdBy", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create(
        { section: "landing", title: "  Hi  ", subtitle: "sub", sortOrder: 2 },
        undefined,
        ADMIN_ID,
      );
      const payload = repo.create.mock.calls[0][0];
      expect(payload).toMatchObject({
        section: "landing",
        title: "Hi",
        subtitle: "sub",
        sortOrder: 2,
      });
      expect(payload.createdBy.toString()).toBe(ADMIN_ID);
      expect(payload).not.toHaveProperty("eyebrow");
      expect(payload).not.toHaveProperty("imagePath");
      expect(upload).not.toHaveBeenCalled();
    });

    it("omits createdBy when unknown", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ section: "landing", title: "Hi" }, undefined);
      expect(repo.create.mock.calls[0][0]).not.toHaveProperty("createdBy");
    });

    it.each([
      ["landing", "dir:landing-banner"],
      ["about", "dir:about-banner"],
      ["gallery", "dir:site-content"],
    ] as const)("uploads a %s image into %s", async (section, folder) => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ section, title: "Hi" }, file);
      expect(upload).toHaveBeenCalledWith(file.buffer, { folder });
      expect(repo.create.mock.calls[0][0]).toMatchObject({
        imagePath: "new/pid",
        imageUrl: "https://cdn/new.jpg",
      });
    });
  });

  describe("update", () => {
    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update(ID, { title: "x" }, undefined)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("updates only provided fields", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(makeDoc({ title: "New" }));
      await service.update(ID, { title: " New ", isActive: false }, undefined);
      expect(repo.update).toHaveBeenCalledWith(ID, { title: "New", isActive: false });
      expect(del).not.toHaveBeenCalled();
    });

    it("replaces the image in the existing section folder and deletes the old one", async () => {
      repo.findById.mockResolvedValue(makeDoc({ section: "about", imagePath: "old/pid" }));
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, {}, file);
      expect(upload).toHaveBeenCalledWith(file.buffer, { folder: "dir:about-banner" });
      expect(del).toHaveBeenCalledWith("old/pid", "image");
      expect(repo.update).toHaveBeenCalledWith(ID, {
        imagePath: "new/pid",
        imageUrl: "https://cdn/new.jpg",
      });
    });

    it("skips deletion when there was no previous image", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(makeDoc());
      await service.update(ID, {}, file);
      expect(del).not.toHaveBeenCalled();
    });

    it("404 when the document disappears before the write", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(null);
      await expect(service.update(ID, { title: "x" }, undefined)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("archive / unarchive", () => {
    it("archive sets archivedAt, deactivates and saves", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      const res = await service.archive(ID);
      expect(doc.archivedAt).toBeInstanceOf(Date);
      expect(doc.isActive).toBe(false);
      expect(doc.save).toHaveBeenCalled();
      expect(res.archivedAt).toBeInstanceOf(Date);
    });

    it("unarchive clears archivedAt", async () => {
      const doc = makeDoc({ archivedAt: new Date() });
      repo.findById.mockResolvedValue(doc);
      const res = await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
      expect(doc.save).toHaveBeenCalled();
      expect(res).not.toHaveProperty("archivedAt");
    });

    it.each(["archive", "unarchive"] as const)("%s 404s when missing", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("hardDelete", () => {
    it("deletes the image and the document", async () => {
      repo.findById.mockResolvedValue(makeDoc({ imagePath: "old/pid" }));
      await service.hardDelete(ID);
      expect(del).toHaveBeenCalledWith("old/pid", "image");
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });

    it("deletes a document with no image", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await service.hardDelete(ID);
      expect(del).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });

    it("404 when missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.hardDelete(ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
