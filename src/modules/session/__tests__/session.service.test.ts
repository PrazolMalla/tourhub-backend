import { Types } from "mongoose";
import { SessionService, type CreateSessionInput } from "../session.service";
import type { SessionRepository } from "../session.repository";
import { NotFoundError, UnauthorizedError } from "../../../core/errors";

const USER_ID = "507f1f77bcf86cd799439011";
const NOW = new Date("2026-06-01T00:00:00Z");

const makeRepo = () => ({
  create: jest.fn((d) => Promise.resolve({ ...d, _id: new Types.ObjectId() })),
  findActiveBySessionId: jest.fn(),
  findBySessionId: jest.fn(),
  findAllActiveForUser: jest.fn(),
  revokeBySessionId: jest.fn(),
  revokeAllForUser: jest.fn(),
  rotateRefreshHash: jest.fn(),
  touch: jest.fn(),
});

const input = (o: Partial<CreateSessionInput> = {}): CreateSessionInput => ({
  userId: USER_ID,
  userKind: "admin",
  deviceId: "dev",
  refreshTokenHash: "hash",
  expiresAt: new Date("2026-06-08T00:00:00Z"),
  ...o,
});

describe("SessionService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SessionService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    repo = makeRepo();
    service = new SessionService(repo as unknown as SessionRepository);
  });

  afterEach(() => jest.useRealTimers());

  describe("createAndEnforceSingleDevice", () => {
    it("creates a row with a random 48-hex sessionId", async () => {
      await service.createAndEnforceSingleDevice(input({ ip: "1.2.3.4", browser: "Chrome" }));
      const row = repo.create.mock.calls[0]![0];
      expect(row.sessionId).toMatch(/^[0-9a-f]{48}$/);
      expect(row.userId).toBeInstanceOf(Types.ObjectId);
      expect(row.userId.toString()).toBe(USER_ID);
      expect(row).toMatchObject({ userKind: "admin", ip: "1.2.3.4", browser: "Chrome" });
      expect(row).not.toHaveProperty("os");
      expect(row).not.toHaveProperty("userAgent");
    });

    it("generates a different sessionId each time and does not revoke others", async () => {
      await service.createAndEnforceSingleDevice(input());
      await service.createAndEnforceSingleDevice(input());
      const [a, b] = repo.create.mock.calls.map((c) => c[0].sessionId);
      expect(a).not.toBe(b);
      expect(repo.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  it("validateActive returns or 404s", async () => {
    repo.findActiveBySessionId
      .mockResolvedValueOnce({ sessionId: "s" })
      .mockResolvedValueOnce(null);
    await expect(service.validateActive("s")).resolves.toEqual({ sessionId: "s" });
    await expect(service.validateActive("s")).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("validateOrRehydrate", () => {
    it("rejects a revoked session", async () => {
      repo.findBySessionId.mockResolvedValue({ revokedAt: new Date(), expiresAt: NOW });
      await expect(service.validateOrRehydrate("s", input())).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it("returns an active session untouched", async () => {
      const row = { expiresAt: new Date("2026-06-02T00:00:00Z"), refreshTokenHash: "h" };
      repo.findBySessionId.mockResolvedValue(row);
      await expect(service.validateOrRehydrate("s", input())).resolves.toBe(row);
      expect(repo.rotateRefreshHash).not.toHaveBeenCalled();
    });

    it("extends an expired session keeping its refresh hash", async () => {
      const row = { expiresAt: new Date("2026-05-01T00:00:00Z"), refreshTokenHash: "old" };
      repo.findBySessionId.mockResolvedValue(row);
      const hydrate = input();
      await service.validateOrRehydrate("s", hydrate);
      expect(repo.rotateRefreshHash).toHaveBeenCalledWith("s", "old", hydrate.expiresAt);
    });

    it("rehydrates a missing row under the same sessionId", async () => {
      repo.findBySessionId.mockResolvedValue(null);
      await service.validateOrRehydrate("jwt-sid", input({ userAgent: "UA", os: "Linux" }));
      expect(repo.create.mock.calls[0]?.[0]).toMatchObject({
        sessionId: "jwt-sid",
        userKind: "admin",
        deviceId: "dev",
        userAgent: "UA",
        os: "Linux",
      });
    });
  });

  it("listForUser maps DTOs with only the set optional fields", async () => {
    const _id = new Types.ObjectId();
    repo.findAllActiveForUser.mockResolvedValue([
      {
        _id,
        sessionId: "s1",
        userKind: "user",
        deviceId: "d",
        browser: "Firefox",
        loginAt: NOW,
        lastActivityAt: NOW,
        expiresAt: NOW,
        refreshTokenHash: "secret",
      },
    ]);
    const [dto] = await service.listForUser(USER_ID, "user");
    expect(repo.findAllActiveForUser).toHaveBeenCalledWith(USER_ID, "user");
    expect(dto).toEqual({
      id: _id.toString(),
      sessionId: "s1",
      userKind: "user",
      deviceId: "d",
      browser: "Firefox",
      loginAt: NOW,
      lastActivityAt: NOW,
      expiresAt: NOW,
    });
    expect(dto).not.toHaveProperty("refreshTokenHash");
  });

  it("delegates revoke / revokeAllForUser / rotateRefresh / touch", async () => {
    repo.revokeAllForUser.mockResolvedValue(3);
    await service.revoke("s");
    await service.revoke("s2", "admin-banned");
    await expect(service.revokeAllForUser(USER_ID, "admin", "why")).resolves.toBe(3);
    await service.rotateRefresh("s", "h2", NOW);
    await service.touch("s");
    expect(repo.revokeBySessionId.mock.calls).toEqual([
      ["s", "user-logout"],
      ["s2", "admin-banned"],
    ]);
    expect(repo.revokeAllForUser).toHaveBeenCalledWith(USER_ID, "admin", "why");
    expect(repo.rotateRefreshHash).toHaveBeenCalledWith("s", "h2", NOW);
    expect(repo.touch).toHaveBeenCalledWith("s");
  });
});
