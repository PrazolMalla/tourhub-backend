import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { AdminManagementController } from "../admin-management.controller";
import { AdminManagementRoutes } from "../admin-management.routes";
import type { AdminManagementService } from "../admin-management.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const SUPER_ID = "507f1f77bcf86cd799439099";

const makeSvc = () => ({
  listAdmins: jest.fn(),
  createAdmin: jest.fn(),
  updateAdmin: jest.fn(),
  deleteAdmin: jest.fn(),
  setBanned: jest.fn(),
  clearDatabase: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new AdminManagementController(svc as unknown as AdminManagementService);
  const api = Router();
  api.use("/admins", new AdminManagementRoutes(controller).getRouter());
  return new App(api).express;
};

const token = (role: string, kind = "admin") =>
  jwt.sign({ id: SUPER_ID, kind, role }, env.JWT_SECRET);
const SUPER = `Bearer ${token("superadmin")}`;

describe("AdminManagement routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("auth", () => {
    it("401 without a token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/admins")).status).toBe(401);
    });

    it("403 for a plain admin", async () => {
      const res = await request(makeApp(svc))
        .get("/api/v1/admins")
        .set("Authorization", `Bearer ${token("admin")}`);
      expect(res.status).toBe(403);
    });

    it("403 for a customer token even with a superadmin role claim", async () => {
      const res = await request(makeApp(svc))
        .get("/api/v1/admins")
        .set("Authorization", `Bearer ${token("superadmin", "user")}`);
      expect(res.status).toBe(403);
    });
  });

  it("GET / lists admins with pagination meta", async () => {
    svc.listAdmins.mockResolvedValue({ data: [{ id: ID }], meta: { total: 1 } });
    const res = await request(makeApp(svc))
      .get("/api/v1/admins?sortBy=email")
      .set("Authorization", SUPER);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: ID }]);
    expect(svc.listAdmins.mock.calls[0][0]).toMatchObject({ sortBy: "email" });
  });

  it("POST / creates an admin (201) with validated body", async () => {
    svc.createAdmin.mockResolvedValue({ id: ID, email: "a@b.com" });
    const res = await request(makeApp(svc))
      .post("/api/v1/admins")
      .set("Authorization", SUPER)
      .send({ email: "a@b.com" });
    expect(res.status).toBe(201);
    expect(svc.createAdmin).toHaveBeenCalledWith({ email: "a@b.com", role: "admin" });
  });

  it("POST / rejects an invalid body", async () => {
    const res = await request(makeApp(svc))
      .post("/api/v1/admins")
      .set("Authorization", SUPER)
      .send({ email: "nope" });
    expect(res.status).toBe(422);
    expect(svc.createAdmin).not.toHaveBeenCalled();
  });

  it("PATCH /:id updates", async () => {
    svc.updateAdmin.mockResolvedValue({ id: ID, name: "Ram" });
    const res = await request(makeApp(svc))
      .patch(`/api/v1/admins/${ID}`)
      .set("Authorization", SUPER)
      .send({ name: "Ram" });
    expect(res.status).toBe(200);
    expect(svc.updateAdmin).toHaveBeenCalledWith(ID, { name: "Ram" });
  });

  it("PATCH /:id rejects a bad id", async () => {
    const res = await request(makeApp(svc))
      .patch("/api/v1/admins/bad")
      .set("Authorization", SUPER)
      .send({ name: "Ram" });
    expect(res.status).toBe(422);
  });

  it("PATCH /:id cannot be used to ban (ban must go through /:id/ban)", async () => {
    const res = await request(makeApp(svc))
      .patch(`/api/v1/admins/${ID}`)
      .set("Authorization", SUPER)
      .send({ isBanned: true, bannedReason: "sneaky" });
    expect(res.status).toBe(422);
    expect(svc.updateAdmin).not.toHaveBeenCalled();
  });

  it("DELETE /:id returns 204", async () => {
    const res = await request(makeApp(svc))
      .delete(`/api/v1/admins/${ID}`)
      .set("Authorization", SUPER);
    expect(res.status).toBe(204);
    expect(svc.deleteAdmin).toHaveBeenCalledWith(ID);
  });

  it("POST /:id/ban passes reason and the caller id", async () => {
    svc.setBanned.mockResolvedValue({ id: ID, isBanned: true });
    const res = await request(makeApp(svc))
      .post(`/api/v1/admins/${ID}/ban`)
      .set("Authorization", SUPER)
      .send({ reason: "abuse" });
    expect(res.status).toBe(200);
    expect(svc.setBanned).toHaveBeenCalledWith(ID, true, "abuse", SUPER_ID);
  });

  it("POST /:id/unban", async () => {
    svc.setBanned.mockResolvedValue({ id: ID, isBanned: false });
    const res = await request(makeApp(svc))
      .post(`/api/v1/admins/${ID}/unban`)
      .set("Authorization", SUPER);
    expect(res.status).toBe(200);
    expect(svc.setBanned).toHaveBeenCalledWith(ID, false, undefined, SUPER_ID);
  });

  it("POST /clear-database is not swallowed by the /:id matcher", async () => {
    svc.clearDatabase.mockResolvedValue({ collectionsDropped: 0 });
    const res = await request(makeApp(svc))
      .post("/api/v1/admins/clear-database")
      .set("Authorization", SUPER)
      .send({ confirmationCode: "code" });
    expect(res.status).toBe(200);
    expect(svc.clearDatabase).toHaveBeenCalledWith("code");
  });

  it("POST /clear-database requires a confirmationCode", async () => {
    const res = await request(makeApp(svc))
      .post("/api/v1/admins/clear-database")
      .set("Authorization", SUPER)
      .send({});
    expect(res.status).toBe(422);
    expect(svc.clearDatabase).not.toHaveBeenCalled();
  });
});
