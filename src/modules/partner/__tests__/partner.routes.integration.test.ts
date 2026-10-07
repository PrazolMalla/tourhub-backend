import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { PartnerController } from "../partner.controller";
import { PartnerRoutes } from "../partner.routes";
import type { PartnerService } from "../partner.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  listPublic: jest.fn().mockResolvedValue(page),
  findById: jest.fn().mockResolvedValue({ id: ID }),
  create: jest.fn().mockResolvedValue({ id: ID }),
  update: jest.fn().mockResolvedValue({ id: ID }),
  archive: jest.fn().mockResolvedValue({ id: ID }),
  unarchive: jest.fn().mockResolvedValue({ id: ID }),
  uploadImage: jest.fn(),
  removeImage: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new PartnerController(svc as unknown as PartnerService);
  const api = Router();
  api.use("/partners", new PartnerRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Partner routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  it("GET /public uses the active-only listing", async () => {
    const res = await request(makeApp(svc)).get("/api/v1/partners/public");
    expect(res.status).toBe(200);
    expect(svc.listPublic).toHaveBeenCalledTimes(1);
    expect(svc.list).not.toHaveBeenCalled();
    expect(svc.listPublic.mock.calls[0][0]).toMatchObject({
      sortBy: "sortOrder",
      sortOrder: "asc",
    });
  });

  it("staff routes need auth", async () => {
    expect((await request(makeApp(svc)).get("/api/v1/partners")).status).toBe(401);
  });

  it("GET / maps state", async () => {
    const app = makeApp(svc);
    await request(app).get("/api/v1/partners?state=all").set("Authorization", AUTH);
    await request(app).get("/api/v1/partners").set("Authorization", AUTH);
    expect(svc.list.mock.calls[0][1]).toBe("all");
    expect(svc.list.mock.calls[1][1]).toBe("live");
  });

  it("POST / rejects a javascript: url", async () => {
    const res = await request(makeApp(svc))
      .post("/api/v1/partners")
      .set("Authorization", AUTH)
      .send({ name: "Acme", url: "javascript:alert(1)" });
    expect(res.status).toBe(422);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it("CRUD, archive and image endpoints", async () => {
    const app = makeApp(svc);
    const post = await request(app)
      .post("/api/v1/partners")
      .set("Authorization", AUTH)
      .send({ name: "Acme", url: "https://acme.com" });
    expect(post.status).toBe(201);
    expect(
      (await request(app).get(`/api/v1/partners/${ID}`).set("Authorization", AUTH)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .patch(`/api/v1/partners/${ID}`)
          .set("Authorization", AUTH)
          .send({ name: "B" })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/partners/${ID}/archive`).set("Authorization", AUTH)).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/partners/${ID}/unarchive`).set("Authorization", AUTH))
        .status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/partners/${ID}/image`).set("Authorization", AUTH)).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/partners/${ID}/image`).set("Authorization", AUTH)).status,
    ).toBe(400);
    expect(
      (await request(app).delete(`/api/v1/partners/${ID}`).set("Authorization", AUTH)).status,
    ).toBe(204);
    expect(svc.hardDelete).toHaveBeenCalledWith(ID);
  });
});
