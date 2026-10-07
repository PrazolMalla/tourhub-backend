import { SchoolTripChecklistService } from "../school-trip-checklist.service";
import type { SchoolTripChecklistRepository } from "../school-trip-checklist.repository";
import type { ChecklistDownloadLogRepository } from "../checklist-download-log.repository";
import { HttpError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn(),
  docFileToRecord: jest.fn(() => ({
    publicId: "checklists/new",
    url: "https://cdn/new.pdf",
    originalName: "list.pdf",
  })),
}));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const ID = "507f1f77bcf86cd799439011";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  type: "Primary School",
  slug: "primary-school",
  isActive: true,
  sortOrder: 0,
  archivedAt: null as Date | null,
  pdfPath: "checklists/old" as string | undefined,
  pdfUrl: "https://cdn/old.pdf" as string | undefined,
  pdfOriginalName: "old.pdf" as string | undefined,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  filterForState: jest.fn((s: string) =>
    s === "live" ? { archivedAt: null } : s === "archived" ? { archivedAt: { $ne: null } } : {},
  ),
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  findById: jest.fn(),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const makeLogs = () => ({
  create: jest.fn(),
  findAll: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
});

const opts = (o: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 10,
  skip: 0,
  sortBy: "sortOrder",
  sortOrder: "asc",
  ...o,
});

describe("SchoolTripChecklistService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let logs: ReturnType<typeof makeLogs>;
  let service: SchoolTripChecklistService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    logs = makeLogs();
    service = new SchoolTripChecklistService(
      repo as unknown as SchoolTripChecklistRepository,
      logs as unknown as ChecklistDownloadLogRepository,
    );
  });

  it("list uses the repository state filter", async () => {
    await service.list(opts({ sortOrder: "desc" }), "archived");
    expect(repo.findAll).toHaveBeenCalledWith(
      { archivedAt: { $ne: null } },
      { skip: 0, limit: 10, sort: { sortOrder: -1 } },
    );
  });

  it("listPublic returns active checklists without internal paths", async () => {
    repo.findAll.mockResolvedValue([makeDoc()]);
    const [pub] = await service.listPublic();
    expect(repo.findAll).toHaveBeenCalledWith(
      { isActive: true, archivedAt: null },
      { sort: { sortOrder: 1 } },
    );
    expect(pub).toEqual({
      id: ID,
      type: "Primary School",
      slug: "primary-school",
      pdfUrl: "https://cdn/old.pdf",
    });
  });

  it("findById returns or 404s", async () => {
    repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await expect(service.findById(ID)).resolves.toMatchObject({ pdfPath: "checklists/old" });
    await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("create", () => {
    it("slugifies the type and attaches an uploaded PDF", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ type: " High School " }, {} as Express.Multer.File);
      expect(repo.create).toHaveBeenCalledWith({
        type: "High School",
        slug: "high-school",
        isActive: true,
        sortOrder: 0,
        pdfPath: "checklists/new",
        pdfUrl: "https://cdn/new.pdf",
        pdfOriginalName: "list.pdf",
      });
    });

    it("de-duplicates slugs with a numeric suffix", async () => {
      repo.findOne
        .mockResolvedValueOnce(makeDoc())
        .mockResolvedValueOnce(makeDoc())
        .mockResolvedValueOnce(null);
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ type: "Primary School", isActive: false, sortOrder: 2 });
      expect(repo.findOne.mock.calls.map((c) => c[0].slug)).toEqual([
        "primary-school",
        "primary-school-2",
        "primary-school-3",
      ]);
      expect(repo.create.mock.calls[0][0]).toMatchObject({
        slug: "primary-school-3",
        isActive: false,
        sortOrder: 2,
      });
      expect(repo.create.mock.calls[0][0]).not.toHaveProperty("pdfPath");
    });

    it("400 when the type cannot produce a slug", async () => {
      await expect(service.create({ type: "विद्यालय" })).rejects.toBeInstanceOf(HttpError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  it("update trims type and 404s when missing", async () => {
    repo.update.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
    await service.update(ID, { type: " New ", isActive: false });
    expect(repo.update).toHaveBeenCalledWith(ID, { type: "New", isActive: false });
    await expect(service.update(ID, { sortOrder: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("pdf", () => {
    const file = {} as Express.Multer.File;

    it("uploadPdf replaces the old raw asset", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.uploadPdf(ID, file);
      expect(del).toHaveBeenCalledWith("checklists/old", "raw");
      expect(doc).toMatchObject({ pdfPath: "checklists/new", pdfOriginalName: "list.pdf" });
    });

    it("uploadPdf cleans up when the checklist is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.uploadPdf(ID, file)).rejects.toBeInstanceOf(NotFoundError);
      expect(del).toHaveBeenCalledWith("checklists/new", "raw");
    });

    it("removePdf clears fields", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      const dto = await service.removePdf(ID);
      expect(del).toHaveBeenCalledWith("checklists/old", "raw");
      expect(dto).not.toHaveProperty("pdfUrl");
    });
  });

  describe("archive / delete", () => {
    it("archive + unarchive", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.archive(ID);
      expect(doc.isActive).toBe(false);
      await service.unarchive(ID);
      expect(doc.archivedAt).toBeNull();
    });

    it.each(["archive", "unarchive", "removePdf", "hardDelete"] as const)("%s 404s", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(service[m](ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("hardDelete removes the PDF and the doc", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await service.hardDelete(ID);
      expect(del).toHaveBeenCalledWith("checklists/old", "raw");
      expect(repo.delete).toHaveBeenCalledWith(ID);
    });
  });

  describe("recordDownload", () => {
    const geo = { ip: "1.2.3.4", country: "NP", city: "Kathmandu" };
    const input = { checklistId: ID, name: "Ram", phone: "9800000000", geo };

    it("logs a success and returns the PDF URL", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await expect(service.recordDownload(input)).resolves.toEqual({
        pdfUrl: "https://cdn/old.pdf",
      });
      expect(logs.create).toHaveBeenCalledWith({
        checklistType: "Primary School",
        name: "Ram",
        phone: "9800000000",
        status: "success",
        ...geo,
        checklistId: doc._id,
      });
    });

    it.each([
      ["missing checklist", null, "Checklist not found", "Unknown"],
      ["inactive", makeDoc({ isActive: false }), "Checklist inactive", "Primary School"],
      ["archived", makeDoc({ archivedAt: new Date() }), "Checklist inactive", "Primary School"],
      ["no PDF", makeDoc({ pdfUrl: undefined }), "No PDF attached", "Primary School"],
    ])("logs a failure for a %s and returns null", async (_l, doc, reason, type) => {
      repo.findById.mockResolvedValue(doc);
      await expect(service.recordDownload(input)).resolves.toBeNull();
      expect(logs.create.mock.calls[0][0]).toMatchObject({
        status: "failed",
        failureReason: reason,
        checklistType: type,
      });
    });
  });

  it("listLogs filters by status", async () => {
    logs.findAll.mockResolvedValue([
      {
        _id: { toString: () => "l1" },
        checklistType: "T",
        name: "N",
        phone: "P",
        status: "failed",
        createdAt: new Date(0),
      },
    ]);
    logs.count.mockResolvedValue(1);
    const res = await service.listLogs(opts({ sortBy: "createdAt", sortOrder: "desc" }), "failed");
    expect(logs.findAll).toHaveBeenCalledWith(
      { status: "failed" },
      { skip: 0, limit: 10, sort: { createdAt: -1 } },
    );
    expect(res.data[0]).toEqual({
      id: "l1",
      checklistType: "T",
      name: "N",
      phone: "P",
      status: "failed",
      createdAt: new Date(0),
    });
    await service.listLogs(opts());
    expect(logs.findAll.mock.calls[1][0]).toEqual({});
  });
});
