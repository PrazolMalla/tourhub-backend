import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { RegionController } from "../region.controller";
import { RegionRoutes } from "../region.routes";
import type { RegionService } from "../region.service";
import { env } from "../../../config/env";
import { NotFoundError } from "../../../core/errors";

const ID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  listPublic: jest.fn().mockResolvedValue(page),
  listAll: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue({ id: ID }),
  findBySlug: jest.fn().mockResolvedValue({ id: ID }),
  findPublishedById: jest.fn().mockResolvedValue({ id: ID }),
  findPublishedBySlug: jest.fn().mockResolvedValue({ id: ID }),
  create: jest.fn().mockResolvedValue({ id: ID }),
  update: jest.fn().mockResolvedValue({ id: ID }),
  archive: jest.fn().mockResolvedValue({ id: ID }),
  unarchive: jest.fn().mockResolvedValue({ id: ID }),
  uploadImage: jest.fn(),
  removeImage: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new RegionController(svc as unknown as RegionService);
  const api = Router();
  api.use("/regions", new RegionRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Region routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public uses the active-only listing", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/regions/public")).status).toBe(200);
      expect(svc.listPublic).toHaveBeenCalled();
      expect(svc.list).not.toHaveBeenCalled();
    });

    it("GET /public/:id and /public/slug/:slug use published-only lookups", async () => {
      const app = makeApp(svc);
      expect((await request(app).get(`/api/v1/regions/public/${ID}`)).status).toBe(200);
      expect((await request(app).get("/api/v1/regions/public/slug/everest")).status).toBe(200);
      expect(svc.findPublishedById).toHaveBeenCalledWith(ID);
      expect(svc.findPublishedBySlug).toHaveBeenCalledWith("everest");
      expect(svc.findById).not.toHaveBeenCalled();
      expect(svc.findBySlug).not.toHaveBeenCalled();
    });

    it("inactive regions 404 publicly", async () => {
      svc.findPublishedBySlug.mockRejectedValue(new NotFoundError("x"));
      expect((await request(makeApp(svc)).get("/api/v1/regions/public/slug/hidden")).status).toBe(
        404,
      );
    });
  });

  describe("staff", () => {
    it("401 without token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/regions")).status).toBe(401);
    });

    it("GET / maps state", async () => {
      await request(makeApp(svc)).get("/api/v1/regions?state=archived").set("Authorization", AUTH);
      expect(svc.list.mock.calls[0][1]).toBe("archived");
    });

    it("GET /:id uses the admin lookup (sees inactive)", async () => {
      await request(makeApp(svc)).get(`/api/v1/regions/${ID}`).set("Authorization", AUTH);
      expect(svc.findById).toHaveBeenCalledWith(ID);
    });

    it("POST / validates and creates", async () => {
      const app = makeApp(svc);
      expect(
        (await request(app).post("/api/v1/regions").set("Authorization", AUTH).send({ name: "E" }))
          .status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .post("/api/v1/regions")
            .set("Authorization", AUTH)
            .send({ name: "E", key: "e" })
        ).status,
      ).toBe(201);
    });

    it("update, archive, images, delete", async () => {
      const app = makeApp(svc);
      expect(
        (
          await request(app)
            .patch(`/api/v1/regions/${ID}`)
            .set("Authorization", AUTH)
            .send({ name: "N" })
        ).status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/regions/${ID}/archive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/regions/${ID}/unarchive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/regions/${ID}/image`).set("Authorization", AUTH)).status,
      ).toBe(400);
      expect(
        (await request(app).delete(`/api/v1/regions/${ID}/image`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).delete(`/api/v1/regions/${ID}`).set("Authorization", AUTH)).status,
      ).toBe(204);
      expect(svc.hardDelete).toHaveBeenCalledWith(ID);
    });
  });
});
