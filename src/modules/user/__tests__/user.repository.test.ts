import { Types } from "mongoose";
import { UserModel } from "../user.model";
import { UserRepository } from "../user.repository";
import { ValidationError } from "../../../core/errors";

const ID = "507f1f77bcf86cd799439011";
const ADMIN = "507f1f77bcf86cd799439022";
const NOW = new Date("2026-05-01T00:00:00Z");

describe("UserRepository", () => {
  const repo = new UserRepository();
  let update: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    update = jest.spyOn(UserModel, "findByIdAndUpdate").mockResolvedValue(null as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("findByEmail", async () => {
    const spy = jest.spyOn(UserModel, "findOne").mockResolvedValue(null as never);
    await repo.findByEmail("a@b.com");
    expect(spy).toHaveBeenCalledWith({ email: "a@b.com" });
  });

  it("ban records reason, admin and time", async () => {
    await repo.setBanned(ID, true, "spam", ADMIN);
    expect(update).toHaveBeenCalledWith(ID, {
      isBanned: true,
      bannedReason: "spam",
      bannedBy: new Types.ObjectId(ADMIN),
      bannedAt: NOW,
    });
  });

  it("ban without reason/admin stores nulls", async () => {
    await repo.setBanned(ID, true, undefined, undefined);
    expect(update).toHaveBeenCalledWith(ID, {
      isBanned: true,
      bannedReason: null,
      bannedBy: null,
      bannedAt: NOW,
    });
  });

  it("unban clears everything", async () => {
    await repo.setBanned(ID, false, "ignored", ADMIN);
    expect(update).toHaveBeenCalledWith(ID, {
      isBanned: false,
      bannedReason: null,
      bannedBy: null,
      bannedAt: null,
    });
  });

  it("422 (not 500) for a malformed bannedBy id", async () => {
    await expect(repo.setBanned(ID, true, "x", "nope")).rejects.toBeInstanceOf(ValidationError);
    expect(update).not.toHaveBeenCalled();
  });
});
