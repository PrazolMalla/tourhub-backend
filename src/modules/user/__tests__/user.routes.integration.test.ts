import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { UserController } from "../user.controller";
import { UserRoutes } from "../user.routes";
import { UserService } from "../user.service";
import type { UserRepository } from "../user.repository";
import { env } from "../../../config/env";

const revokeAllForUser = jest.fn();
jest.mock("../../session/session.module", () => ({
  SessionModule: { service: () => ({ revokeAllForUser }) },
}));

type RepoMock = Record<keyof UserRepository, jest.Mock>;

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => "507f1f77bcf86cd799439011" },
  email: "alice@example.com",
  role: "user" as const,
  name: "Alice",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeRepo = (overrides: Partial<RepoMock> = {}): RepoMock => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByEmail: jest.fn(),
  setBanned: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  ...overrides,
});

const makeApp = (repo: RepoMock) => {
  const service = new UserService(repo as unknown as UserRepository);
  const controller = new UserController(service);
  const userRouter = new UserRoutes(controller).getRouter();
  const apiRouter = Router();
  apiRouter.use("/users", userRouter);
  return new App(apiRouter).express;
};

// /users routes are admin-gated (STAFF_ROLES). Mint a token that satisfies
// both the AuthMiddleware (decodes the JWT) and the AuthorizeMiddleware
// (`kind === "admin"` per qa-test.md#H-5 + role in the allow list).
const tokenFor = (id: string): string =>
  jwt.sign({ id, kind: "admin", role: "admin" }, env.JWT_SECRET);
const ID = "507f1f77bcf86cd799439011";

describe("User routes (integration)", () => {
  describe("auth", () => {
    it("401 when no token", async () => {
      const res = await request(makeApp(makeRepo())).get("/api/v1/users");
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "UNAUTHORIZED" },
      });
    });

    it("401 when token invalid", async () => {
      const res = await request(makeApp(makeRepo()))
        .get("/api/v1/users")
        .set("Authorization", "Bearer not.a.real.token");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/users", () => {
    it("returns paginated list with success envelope and meta", async () => {
      const repo = makeRepo({
        findAll: jest.fn().mockResolvedValue([makeDoc()]),
        count: jest.fn().mockResolvedValue(1),
      });

      const res = await request(makeApp(repo))
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        // No `role` — customers no longer carry roles after the user/admin split.
        data: [{ id: ID, email: "alice@example.com" }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1, isFirstPage: true, isLastPage: true },
      });
    });

    it("422 on invalid pagination query", async () => {
      const res = await request(makeApp(makeRepo()))
        .get("/api/v1/users?page=-1")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("falls back to default sortBy when not in whitelist", async () => {
      const findAll = jest.fn().mockResolvedValue([]);
      const repo = makeRepo({ findAll, count: jest.fn().mockResolvedValue(0) });

      await request(makeApp(repo))
        .get("/api/v1/users?sortBy=password")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);

      const sortArg = (findAll.mock.calls[0]?.[1] as { sort: Record<string, number> }).sort;
      expect(sortArg).toEqual({ createdAt: -1 });
    });

    it("caps oversized limit at maxLimit (100)", async () => {
      const findAll = jest.fn().mockResolvedValue([]);
      const repo = makeRepo({ findAll, count: jest.fn().mockResolvedValue(0) });

      const res = await request(makeApp(repo))
        .get("/api/v1/users?limit=500")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(100);
    });
  });

  describe("GET /api/v1/users/:id", () => {
    it("200 when found", async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeDoc()) });
      const res = await request(makeApp(repo))
        .get(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(ID);
    });

    it("404 when not found", async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const res = await request(makeApp(repo))
        .get(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("422 on invalid id format", async () => {
      const res = await request(makeApp(makeRepo()))
        .get("/api/v1/users/not-a-real-id")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(422);
    });
  });

  describe("PATCH /api/v1/users/:id", () => {
    it("200 with updated DTO", async () => {
      const repo = makeRepo({
        update: jest.fn().mockResolvedValue(makeDoc({ name: "Bob" })),
      });
      const res = await request(makeApp(repo))
        .patch(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ name: "Bob" });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Bob");
    });

    it("422 when body is empty", async () => {
      const res = await request(makeApp(makeRepo()))
        .patch(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({});
      expect(res.status).toBe(422);
    });

    it("422 when body has unknown fields", async () => {
      const res = await request(makeApp(makeRepo()))
        .patch(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ password: "newpass" });
      expect(res.status).toBe(422);
    });
  });

  describe("DELETE /api/v1/users/:id", () => {
    it("204 when deleted", async () => {
      const repo = makeRepo({ delete: jest.fn().mockResolvedValue(makeDoc()) });
      const res = await request(makeApp(repo))
        .delete(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(204);
    });

    it("404 when not found", async () => {
      const repo = makeRepo({ delete: jest.fn().mockResolvedValue(null) });
      const res = await request(makeApp(repo))
        .delete(`/api/v1/users/${ID}`)
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST/DELETE /users/:id/ban", () => {
    const ADMIN_ID = "507f1f77bcf86cd799439022";

    it("bans with reason and the acting admin, revoking sessions", async () => {
      revokeAllForUser.mockClear();
      const repo = makeRepo({
        findById: jest
          .fn()
          .mockResolvedValueOnce(makeDoc())
          .mockResolvedValueOnce(makeDoc({ isBanned: true, bannedReason: "spam" })),
      });
      const res = await request(makeApp(repo))
        .post(`/api/v1/users/${ID}/ban`)
        .set("Authorization", `Bearer ${tokenFor(ADMIN_ID)}`)
        .send({ reason: "spam" });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ isBanned: true, bannedReason: "spam" });
      expect(repo.setBanned).toHaveBeenCalledWith(ID, true, "spam", ADMIN_ID);
      expect(revokeAllForUser).toHaveBeenCalledWith(ID, "user", "customer-banned");
    });

    it("rejects an empty reason", async () => {
      const res = await request(makeApp(makeRepo()))
        .post(`/api/v1/users/${ID}/ban`)
        .set("Authorization", `Bearer ${tokenFor(ADMIN_ID)}`)
        .send({ reason: "" });
      expect(res.status).toBe(422);
    });

    it("unbans", async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeDoc()) });
      const res = await request(makeApp(repo))
        .delete(`/api/v1/users/${ID}/ban`)
        .set("Authorization", `Bearer ${tokenFor(ADMIN_ID)}`);
      expect(res.status).toBe(200);
      expect(repo.setBanned).toHaveBeenCalledWith(ID, false, undefined, ADMIN_ID);
    });

    it("404 for an unknown user", async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const res = await request(makeApp(repo))
        .post(`/api/v1/users/${ID}/ban`)
        .set("Authorization", `Bearer ${tokenFor(ADMIN_ID)}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe("404", () => {
    it("returns envelope on unknown route", async () => {
      const res = await request(makeApp(makeRepo()))
        .get("/api/v1/nonexistent")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "NOT_FOUND" },
      });
    });
  });
});
