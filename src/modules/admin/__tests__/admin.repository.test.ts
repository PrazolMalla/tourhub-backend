import { Types } from "mongoose";
import { ValidationError } from "../../../core/errors";
import { AdminModel } from "../admin.model";
import { AdminRepository } from "../admin.repository";

const ID = "507f1f77bcf86cd799439011";
const BANNER_ID = "507f1f77bcf86cd799439022";
const NOW = new Date("2026-05-01T12:00:00.000Z");

describe("AdminRepository", () => {
  let repo: AdminRepository;
  let findOne: jest.SpyInstance;
  let findByIdAndUpdate: jest.SpyInstance;
  let select: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    repo = new AdminRepository();
    select = jest.fn().mockResolvedValue({ email: "a@b.com", password: "hash" });
    findOne = jest.spyOn(AdminModel, "findOne").mockImplementation((() => {
      const q = Promise.resolve({ email: "a@b.com" }) as Promise<unknown> & { select: jest.Mock };
      q.select = select;
      return q;
    }) as never);
    findByIdAndUpdate = jest
      .spyOn(AdminModel, "findByIdAndUpdate")
      .mockResolvedValue(null as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("findByEmailWithSecrets", () => {
    it("queries by email and opts into the secret fields", async () => {
      const res = await repo.findByEmailWithSecrets("a@b.com");
      expect(findOne).toHaveBeenCalledWith({ email: "a@b.com" });
      expect(select).toHaveBeenCalledWith("+password +resetOtp +otpExpiry");
      expect(res).toEqual({ email: "a@b.com", password: "hash" });
    });

    it("returns null when not found", async () => {
      select.mockResolvedValueOnce(null);
      await expect(repo.findByEmailWithSecrets("x@y.com")).resolves.toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("queries by email without selecting secrets", async () => {
      const res = await repo.findByEmail("a@b.com");
      expect(findOne).toHaveBeenCalledWith({ email: "a@b.com" });
      expect(select).not.toHaveBeenCalled();
      expect(res).toEqual({ email: "a@b.com" });
    });
  });

  describe("findByGoogleId", () => {
    it("queries by googleId", async () => {
      await repo.findByGoogleId("sub-123");
      expect(findOne).toHaveBeenCalledWith({ googleId: "sub-123" });
    });
  });

  describe("linkGoogleId", () => {
    it("sets googleId on the admin", async () => {
      await expect(repo.linkGoogleId(ID, "sub-123")).resolves.toBeUndefined();
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, { googleId: "sub-123" });
    });
  });

  describe("setOtp", () => {
    it("stores the OTP hash and expiry", async () => {
      const expiry = new Date("2026-05-01T12:10:00.000Z");
      await repo.setOtp(ID, "otp-hash", expiry);
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, {
        resetOtp: "otp-hash",
        otpExpiry: expiry,
      });
    });

    it("clears the OTP with nulls", async () => {
      await repo.setOtp(ID, null, null);
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, { resetOtp: null, otpExpiry: null });
    });
  });

  describe("setPassword", () => {
    it("stores the hash and invalidates any pending OTP", async () => {
      await repo.setPassword(ID, "new-hash");
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, {
        password: "new-hash",
        resetOtp: null,
        otpExpiry: null,
      });
    });
  });

  describe("updateLastLogin", () => {
    it("records time and IP", async () => {
      await repo.updateLastLogin(ID, "1.2.3.4");
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, {
        lastLoginAt: NOW,
        lastLoginIp: "1.2.3.4",
      });
    });

    it("records only time when IP is missing", async () => {
      await repo.updateLastLogin(ID);
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, { lastLoginAt: NOW });
    });

    it("does not overwrite the IP with an empty string", async () => {
      await repo.updateLastLogin(ID, "");
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, { lastLoginAt: NOW });
    });
  });

  describe("setBanned", () => {
    it("bans with reason, bannedBy as ObjectId and timestamp", async () => {
      await repo.setBanned(ID, true, "abuse", BANNER_ID);
      const [id, update] = findByIdAndUpdate.mock.calls[0];
      expect(id).toBe(ID);
      expect(update).toEqual({
        isBanned: true,
        bannedReason: "abuse",
        bannedBy: new Types.ObjectId(BANNER_ID),
        bannedAt: NOW,
      });
      expect(update.bannedBy).toBeInstanceOf(Types.ObjectId);
    });

    it("bans with null reason / bannedBy when not provided (system block)", async () => {
      await repo.setBanned(ID, true, undefined, undefined);
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, {
        isBanned: true,
        bannedReason: null,
        bannedBy: null,
        bannedAt: NOW,
      });
    });

    it("unban clears all ban metadata even if reason/bannedBy are passed", async () => {
      await repo.setBanned(ID, false, "ignored", BANNER_ID);
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, {
        isBanned: false,
        bannedReason: null,
        bannedBy: null,
        bannedAt: null,
      });
    });

    it("throws a 422 ValidationError (not a raw BSON 500) for an invalid bannedBy", async () => {
      const err = await repo.setBanned(ID, true, "x", "not-an-object-id").catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.statusCode).toBe(422);
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("ignores an invalid bannedBy on unban, since it is not stored", async () => {
      await repo.setBanned(ID, false, undefined, "not-an-object-id");
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, {
        isBanned: false,
        bannedReason: null,
        bannedBy: null,
        bannedAt: null,
      });
    });
  });

  describe("inherited BaseRepository methods", () => {
    it("findById delegates to the Admin model", async () => {
      const spy = jest.spyOn(AdminModel, "findById").mockResolvedValue(null as never);
      await repo.findById(ID);
      expect(spy).toHaveBeenCalledWith(ID);
    });

    it("update returns the new document", async () => {
      await repo.update(ID, { name: "Ram" });
      expect(findByIdAndUpdate).toHaveBeenCalledWith(ID, { name: "Ram" }, { new: true });
    });
  });
});
