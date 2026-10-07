import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { HolidayController } from "../holiday.controller";
import { HolidayRoutes } from "../holiday.routes";
import type { HolidayService } from "../holiday.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  listPublic: jest.fn().mockResolvedValue(page),
  findPublicBySlug: jest.fn().mockResolvedValue({ slug: "dashain" }),
  findById: jest.fn().mockResolvedValue({ id: ID }),
  create: jest.fn().mockResolvedValue({ id: ID }),
  update: jest.fn().mockResolvedValue({ id: ID }),
  archive: jest.fn().mockResolvedValue({ id: ID }),
  unarchive: jest.fn().mockResolvedValue({ id: ID }),
  uploadImage: jest.fn(),
  removeImage: jest.fn().mockResolvedValue({ id: ID }),
  updateImageAlt: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new HolidayController(svc as unknown as HolidayService);
  const api = Router();
  api.use("/holidays", new HolidayRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Holiday routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public accepts snake_case sort and repeated regions", async () => {
      const res = await request(makeApp(svc)).get(
        "/api/v1/holidays/public?sortBy=start_date&sortOrder=desc&region=everest&region=langtang",
      );
      expect(res.status).toBe(200);
      const [pagination, filters] = svc.listPublic.mock.calls[0];
      expect(pagination).toMatchObject({ sortBy: "start_date", sortOrder: "desc" });
      expect(filters).toEqual({ regions: ["everest", "langtang"] });
    });

    it("GET /public with a single region / none", async () => {
      await request(makeApp(svc)).get("/api/v1/holidays/public?region=everest");
      await request(makeApp(svc)).get("/api/v1/holidays/public");
      expect(svc.listPublic.mock.calls[0][1]).toEqual({ regions: ["everest"] });
      expect(svc.listPublic.mock.calls[1][1]).toEqual({ regions: [] });
    });

    it("GET /public/slug/:slug", async () => {
      const res = await request(makeApp(svc)).get("/api/v1/holidays/public/slug/dashain");
      expect(res.status).toBe(200);
      expect(svc.findPublicBySlug).toHaveBeenCalledWith("dashain");
    });
  });

  describe("staff", () => {
    it("401 without token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/holidays")).status).toBe(401);
    });

    it("GET / maps state and defaults to live", async () => {
      const app = makeApp(svc);
      await request(app).get("/api/v1/holidays?state=archived").set("Authorization", AUTH);
      await request(app).get("/api/v1/holidays?state=weird").set("Authorization", AUTH);
      expect(svc.list.mock.calls[0][1]).toBe("archived");
      expect(svc.list.mock.calls[1][1]).toBe("live");
    });

    it("POST / validates dates before reaching the service", async () => {
      const app = makeApp(svc);
      const bad = await request(app)
        .post("/api/v1/holidays")
        .set("Authorization", AUTH)
        .send({ name: "D", startDate: "banana", endDate: "2026-10-01" });
      expect(bad.status).toBe(422);
      const inverted = await request(app)
        .post("/api/v1/holidays")
        .set("Authorization", AUTH)
        .send({ name: "D", startDate: "2026-10-10", endDate: "2026-10-01" });
      expect(inverted.status).toBe(422);
      expect(svc.create).not.toHaveBeenCalled();

      const ok = await request(app)
        .post("/api/v1/holidays")
        .set("Authorization", AUTH)
        .send({ name: "D", startDate: "2026-10-01", endDate: "2026-10-10" });
      expect(ok.status).toBe(201);
    });

    it("CRUD + archive endpoints", async () => {
      const app = makeApp(svc);
      expect(
        (await request(app).get(`/api/v1/holidays/${ID}`).set("Authorization", AUTH)).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .patch(`/api/v1/holidays/${ID}`)
            .set("Authorization", AUTH)
            .send({ name: "N" })
        ).status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/holidays/${ID}/archive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/holidays/${ID}/unarchive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).delete(`/api/v1/holidays/${ID}`).set("Authorization", AUTH)).status,
      ).toBe(204);
    });

    it("POST /:id/image 400s without a file", async () => {
      const res = await request(makeApp(svc))
        .post(`/api/v1/holidays/${ID}/image`)
        .set("Authorization", AUTH);
      expect(res.status).toBe(400);
      expect(svc.uploadImage).not.toHaveBeenCalled();
    });

    it("DELETE /:id/image and PATCH /:id/image/alt", async () => {
      const app = makeApp(svc);
      await request(app).delete(`/api/v1/holidays/${ID}/image`).set("Authorization", AUTH);
      await request(app)
        .patch(`/api/v1/holidays/${ID}/image/alt`)
        .set("Authorization", AUTH)
        .send({ alt: "Festival" });
      expect(svc.removeImage).toHaveBeenCalledWith(ID);
      expect(svc.updateImageAlt).toHaveBeenCalledWith(ID, "Festival");
    });
  });
});
