import { EnquiryService } from "../enquiry.service";
import type { EnquiryRepository } from "../enquiry.repository";
import { NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

jest.mock("../../../core/email/email.service", () => ({
  EmailService: {
    sendEnquiryAdminNotification: jest.fn(),
    sendEnquiryAcknowledgement: jest.fn(),
  },
}));
jest.mock("../../admin/admin.model", () => ({ AdminModel: { findById: jest.fn() } }));

import { EmailService } from "../../../core/email/email.service";
import { AdminModel } from "../../admin/admin.model";

const adminMail = EmailService.sendEnquiryAdminNotification as jest.Mock;
const ackMail = EmailService.sendEnquiryAcknowledgement as jest.Mock;
const findAdmin = AdminModel.findById as jest.Mock;

const ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439022";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  name: "Sita",
  email: "sita@example.com",
  source: "contact",
  status: "new",
  isRead: false,
  noteHistory: [] as unknown[],
  activityHistory: [] as Array<Record<string, unknown>>,
  adminEmailSent: false,
  customerEmailSent: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  save: jest.fn(),
  ...overrides,
});

const makeRepo = () => ({
  create: jest.fn(),
  update: jest.fn().mockResolvedValue(null),
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
});

const opts = (o: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 20,
  skip: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
  ...o,
});

/** Let the fire-and-forget email promise chains settle. */
const flush = () => new Promise((r) => setImmediate(r));

describe("EnquiryService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: EnquiryService;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new EnquiryService(repo as unknown as EnquiryRepository);
    adminMail.mockResolvedValue(true);
    ackMail.mockResolvedValue(true);
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  describe("create", () => {
    it("stores a new unread enquiry with request meta", async () => {
      repo.create.mockResolvedValue(makeDoc());
      const dto = await service.create(
        { name: "Sita", email: "sita@example.com", source: "  contact ", message: "Hi" },
        { ip: "1.2.3.4", userAgent: "UA" },
      );
      expect(repo.create).toHaveBeenCalledWith({
        name: "Sita",
        email: "sita@example.com",
        message: "Hi",
        source: "contact",
        status: "new",
        isRead: false,
        ip: "1.2.3.4",
        userAgent: "UA",
      });
      expect(dto).toMatchObject({ id: ID, status: "new" });
      expect(dto).not.toHaveProperty("ip");
    });

    it("omits meta and absent optional fields", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ phone: "98", source: "hire" });
      expect(repo.create).toHaveBeenCalledWith({
        phone: "98",
        source: "hire",
        status: "new",
        isRead: false,
      });
    });

    it("sends both emails and records delivery status", async () => {
      repo.create.mockResolvedValue(makeDoc());
      await service.create({ email: "a@b.com", source: "contact" });
      await flush();
      expect(adminMail).toHaveBeenCalledWith(expect.objectContaining({ id: ID }));
      expect(ackMail).toHaveBeenCalledWith(expect.objectContaining({ id: ID }));
      expect(repo.update).toHaveBeenCalledWith(ID, { adminEmailSent: true });
      expect(repo.update).toHaveBeenCalledWith(ID, { customerEmailSent: true });
    });

    it("records false when an email is not delivered", async () => {
      repo.create.mockResolvedValue(makeDoc());
      ackMail.mockResolvedValue(false);
      await service.create({ name: "x", source: "contact" });
      await flush();
      expect(repo.update).toHaveBeenCalledWith(ID, { customerEmailSent: false });
    });

    it("never fails the request when an email throws", async () => {
      repo.create.mockResolvedValue(makeDoc());
      adminMail.mockRejectedValue(new Error("SMTP down"));
      await expect(service.create({ name: "x", source: "contact" })).resolves.toBeDefined();
      await flush();
      expect(repo.update).toHaveBeenCalledWith(ID, { adminEmailSent: false });
    });

    it("swallows a failure writing the delivery status", async () => {
      repo.create.mockResolvedValue(makeDoc());
      repo.update.mockRejectedValue(new Error("db down"));
      await expect(service.create({ name: "x", source: "contact" })).resolves.toBeDefined();
      await flush();
    });
  });

  describe("list", () => {
    beforeEach(() => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);
    });

    it("lists with no filter by default", async () => {
      const res = await service.list(opts());
      expect(repo.findAll).toHaveBeenCalledWith(
        {},
        { skip: 0, limit: 20, sort: { createdAt: -1 } },
      );
      expect(res.meta.total).toBe(1);
    });

    it("applies status/source/isRead and an escaped search", async () => {
      await service.list(opts({ search: "a+b", sortBy: "status", sortOrder: "asc" }), {
        status: "spam",
        source: "hire",
        isRead: false,
      });
      const [filter, o] = repo.findAll.mock.calls[0];
      const rx = { $regex: "a\\+b", $options: "i" };
      expect(filter).toEqual({
        status: "spam",
        source: "hire",
        isRead: false,
        $or: [{ name: rx }, { email: rx }, { message: rx }, { trip: rx }],
      });
      expect(o.sort).toEqual({ status: 1 });
    });
  });

  describe("findById / markRead / updateStatus / hardDelete", () => {
    it("findById returns or 404s", async () => {
      repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
      await expect(service.findById(ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("markRead toggles and saves", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.markRead(ID, true);
      expect(doc.isRead).toBe(true);
      expect(doc.save).toHaveBeenCalled();
    });

    it("updateStatus sets status and optional notes", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.updateStatus(ID, "contacted", "called");
      expect(doc).toMatchObject({ status: "contacted", adminNotes: "called" });
    });

    it.each(["markRead", "updateStatus"] as const)("%s 404s", async (m) => {
      repo.findById.mockResolvedValue(null);
      await expect(
        m === "markRead" ? service.markRead(ID, true) : service.updateStatus(ID, "closed"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("hardDelete deletes or 404s", async () => {
      repo.delete.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.hardDelete(ID)).resolves.toBeUndefined();
      await expect(service.hardDelete(ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("unreadCount counts isRead=false", async () => {
      repo.count.mockResolvedValue(7);
      await expect(service.unreadCount()).resolves.toBe(7);
      expect(repo.count).toHaveBeenCalledWith({ isRead: false });
    });
  });

  describe("update (inbox edits with audit trail)", () => {
    const leanAdmin = (admin: unknown) =>
      findAdmin.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(admin) }) });

    it("404s when missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update(ID, { status: "closed" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("records status and read-state changes with the acting admin", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      leanAdmin({ name: "Hari", email: "hari@x.com" });
      await service.update(ID, { status: "contacted", isRead: true }, ADMIN_ID);
      expect(doc.status).toBe("contacted");
      expect(doc.isRead).toBe(true);
      expect(doc.activityHistory).toHaveLength(1);
      expect(doc.activityHistory[0]).toMatchObject({
        actor: { id: ADMIN_ID, name: "Hari", email: "hari@x.com" },
        changes: [
          { field: "Status", from: "new", to: "contacted" },
          { field: "Read state", from: "Unread", to: "Read" },
        ],
      });
      expect(doc.save).toHaveBeenCalled();
    });

    it("does not log no-op changes", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.update(ID, { status: "new", isRead: false }, ADMIN_ID);
      expect(doc.activityHistory).toHaveLength(0);
      expect(findAdmin).not.toHaveBeenCalled();
      expect(doc.save).toHaveBeenCalled();
    });

    it("adminNotes alone is saved without an activity entry", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.update(ID, { adminNotes: "vip" }, ADMIN_ID);
      expect(doc).toMatchObject({ adminNotes: "vip" });
      expect(doc.activityHistory).toHaveLength(0);
    });

    it("appends a note to both histories", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      leanAdmin(null);
      await service.update(ID, { newNote: "Called back" }, ADMIN_ID);
      expect(doc.noteHistory).toEqual([
        expect.objectContaining({ text: "Called back", createdBy: ADMIN_ID }),
      ]);
      expect(doc.activityHistory[0]).toMatchObject({
        actor: { id: ADMIN_ID },
        changes: [],
        note: "Called back",
      });
      expect(doc.activityHistory[0]?.actor).not.toHaveProperty("name");
    });

    it("falls back to an unknown actor without an admin id", async () => {
      const doc = makeDoc();
      repo.findById.mockResolvedValue(doc);
      await service.update(ID, { newNote: "x" });
      expect(findAdmin).not.toHaveBeenCalled();
      expect(doc.activityHistory[0]).toMatchObject({ actor: { id: "unknown" } });
      expect(doc.noteHistory[0]).not.toHaveProperty("createdBy");
    });
  });
});
