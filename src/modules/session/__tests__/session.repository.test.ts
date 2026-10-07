import { SessionModel } from "../session.model";
import { SessionRepository } from "../session.repository";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("SessionRepository", () => {
  const repo = new SessionRepository();
  let findOne: jest.SpyInstance;
  let find: jest.SpyInstance;
  let updateMany: jest.SpyInstance;
  let updateOne: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    findOne = jest.spyOn(SessionModel, "findOne").mockResolvedValue(null as never);
    find = jest.spyOn(SessionModel, "find").mockResolvedValue([] as never);
    updateMany = jest
      .spyOn(SessionModel, "updateMany")
      .mockResolvedValue({ modifiedCount: 2 } as never);
    updateOne = jest.spyOn(SessionModel, "updateOne").mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const active = { revokedAt: { $exists: false }, expiresAt: { $gt: NOW } };

  it("findActiveBySessionId filters out revoked and expired rows", async () => {
    await repo.findActiveBySessionId("s");
    expect(findOne).toHaveBeenCalledWith({ sessionId: "s", ...active });
  });

  it("findBySessionId has no activity filter", async () => {
    await repo.findBySessionId("s");
    expect(findOne).toHaveBeenCalledWith({ sessionId: "s" });
  });

  it("findActiveByRefreshHash", async () => {
    await repo.findActiveByRefreshHash("h");
    expect(findOne).toHaveBeenCalledWith({ refreshTokenHash: "h", ...active });
  });

  it("findAllActiveForUser", async () => {
    await repo.findAllActiveForUser("u", "admin");
    expect(find).toHaveBeenCalledWith({ userId: "u", userKind: "admin", ...active });
  });

  it("revokeAllForUser revokes only un-revoked rows and returns the count", async () => {
    await expect(repo.revokeAllForUser("u", "user", "pw-reset")).resolves.toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      { userId: "u", userKind: "user", revokedAt: { $exists: false } },
      { revokedAt: NOW, revokedReason: "pw-reset" },
    );
  });

  it("revokeAllForUserExcept keeps the current session", async () => {
    await repo.revokeAllForUserExcept("u", "user", "keep", "logout-others");
    expect(updateMany.mock.calls[0][0]).toMatchObject({ sessionId: { $ne: "keep" } });
  });

  it("returns 0 when the driver reports no modifiedCount", async () => {
    updateMany.mockResolvedValue({} as never);
    await expect(repo.revokeAllForUser("u", "user", "x")).resolves.toBe(0);
  });

  it("revokeBySessionId / rotateRefreshHash / touch", async () => {
    const exp = new Date("2026-06-08T00:00:00Z");
    await repo.revokeBySessionId("s", "logout");
    await repo.rotateRefreshHash("s", "h2", exp);
    await repo.touch("s");
    expect(updateOne.mock.calls).toEqual([
      [
        { sessionId: "s", revokedAt: { $exists: false } },
        { revokedAt: NOW, revokedReason: "logout" },
      ],
      [{ sessionId: "s" }, { refreshTokenHash: "h2", expiresAt: exp, lastActivityAt: NOW }],
      [{ sessionId: "s" }, { lastActivityAt: NOW }],
    ]);
  });
});
