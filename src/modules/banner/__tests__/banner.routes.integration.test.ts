import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { BannerController } from "../banner.controller";
import { BannerRoutes } from "../banner.routes";
import type { BannerService } from "../banner.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439022";

const makeSvc = () => ({
  listPublic: jest.fn().mockResolvedValue([]),
  listAdmin: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
  unarchive: jest.fn(),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new BannerController(svc as unknown as BannerService);
  const api = Router();
  api.use("/banners", new BannerRoutes(controller).getRouter());
  return new App(api).express;
};

const AUTH = `Bearer ${jwt.sign({ id: ADMIN_ID, kind: "admin", role: "admin" }, env.JWT_SECRET)}`;

describe("Banner routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public/:section is open and cacheable", async () => {
      svc.listPublic.mockResolvedValue([{ id: ID }]);
      const res = await request(makeApp(svc)).get("/api/v1/banners/public/landing");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: ID }]);
      expect(res.headers["cache-control"]).toContain("max-age=60");
      expect(svc.listPublic).toHaveBeenCalledWith("landing");
    });

    it("422 for an unknown section", async () => {
      const res = await request(makeApp(svc)).get("/api/v1/banners/public/nope");
      expect(res.status).toBe(422);
    });

    it("405 for non-GET on /public/:section", async () => {
      const res = await request(makeApp(svc)).post("/api/v1/banners/public/landing");
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe("GET");
    });

    it("404 (not 401) for /public without a section", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/banners/public")).status).toBe(404);
    });
  });

  describe("admin", () => {
    it("401 without a token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/banners")).status).toBe(401);
    });

    it("403 for a customer token", async () => {
      const t = jwt.sign({ id: ADMIN_ID, kind: "user" }, env.JWT_SECRET);
      const res = await request(makeApp(svc))
        .get("/api/v1/banners")
        .set("Authorization", `Bearer ${t}`);
      expect(res.status).toBe(403);
    });

    it("GET / defaults to live state", async () => {
      const res = await request(makeApp(svc)).get("/api/v1/banners").set("Authorization", AUTH);
      expect(res.status).toBe(200);
      expect(svc.listAdmin).toHaveBeenCalledWith({ state: "live" });
    });

    it("GET / forwards section and state", async () => {
      await request(makeApp(svc))
        .get("/api/v1/banners?section=about&state=archived")
        .set("Authorization", AUTH);
      expect(svc.listAdmin).toHaveBeenCalledWith({ section: "about", state: "archived" });
    });

    it.each(["state=trash", "state=bogus", "section=nope"])(
      "GET /?%s is rejected instead of leaking every banner",
      async (qs) => {
        const res = await request(makeApp(svc))
          .get(`/api/v1/banners?${qs}`)
          .set("Authorization", AUTH);
        expect(res.status).toBe(422);
        expect(svc.listAdmin).not.toHaveBeenCalled();
      },
    );

    it("POST / creates from multipart fields with coercion", async () => {
      svc.create.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc))
        .post("/api/v1/banners")
        .set("Authorization", AUTH)
        .field("section", "landing")
        .field("title", "Hi")
        .field("isActive", "false")
        .field("sortOrder", "2");
      expect(res.status).toBe(201);
      const [body, fileArg, createdBy] = svc.create.mock.calls[0];
      expect(body).toMatchObject({
        section: "landing",
        title: "Hi",
        isActive: false,
        sortOrder: 2,
      });
      expect(fileArg).toBeUndefined();
      expect(createdBy).toBe(ADMIN_ID);
    });

    it("POST / rejects a javascript: CTA", async () => {
      const res = await request(makeApp(svc))
        .post("/api/v1/banners")
        .set("Authorization", AUTH)
        .send({ section: "landing", title: "Hi", ctaHref: "javascript:alert(1)" });
      expect(res.status).toBe(422);
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("PATCH /:id updates", async () => {
      svc.update.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc))
        .patch(`/api/v1/banners/${ID}`)
        .set("Authorization", AUTH)
        .send({ title: "New" });
      expect(res.status).toBe(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { title: "New" }, undefined);
    });

    it("archive / unarchive / delete", async () => {
      const app = makeApp(svc);
      svc.archive.mockResolvedValue({ id: ID });
      svc.unarchive.mockResolvedValue({ id: ID });
      expect(
        (await request(app).post(`/api/v1/banners/${ID}/archive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/banners/${ID}/unarchive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).delete(`/api/v1/banners/${ID}`).set("Authorization", AUTH)).status,
      ).toBe(204);
      expect(svc.hardDelete).toHaveBeenCalledWith(ID);
    });

    it("422 for a malformed id", async () => {
      const res = await request(makeApp(svc)).get("/api/v1/banners/abc").set("Authorization", AUTH);
      expect(res.status).toBe(422);
    });
  });
});
