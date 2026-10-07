import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { SchoolTripChecklistController } from "../school-trip-checklist.controller";
import { SchoolTripChecklistRoutes } from "../school-trip-checklist.routes";
import type { SchoolTripChecklistService } from "../school-trip-checklist.service";
import { env } from "../../../config/env";

jest.mock("../../../core/utils/geo.util", () => ({
  lookupGeo: jest.fn(() => ({ country: "NP", city: "Kathmandu" })),
}));

const ID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  listPublic: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue({ id: ID }),
  create: jest.fn().mockResolvedValue({ id: ID }),
  update: jest.fn().mockResolvedValue({ id: ID }),
  uploadPdf: jest.fn(),
  removePdf: jest.fn().mockResolvedValue({ id: ID }),
  archive: jest.fn().mockResolvedValue({ id: ID }),
  unarchive: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
  recordDownload: jest.fn(),
  listLogs: jest.fn().mockResolvedValue(page),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new SchoolTripChecklistController(
    svc as unknown as SchoolTripChecklistService,
  );
  const api = Router();
  api.use("/checklists", new SchoolTripChecklistRoutes(controller).getRouter());
  return new App(api).express;
};

describe("SchoolTripChecklist routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/checklists/public")).status).toBe(200);
      expect(svc.listPublic).toHaveBeenCalled();
    });

    it("POST /:id/download logs with IP-derived geo and returns the URL", async () => {
      svc.recordDownload.mockResolvedValue({ pdfUrl: "https://cdn/x.pdf" });
      const res = await request(makeApp(svc))
        .post(`/api/v1/checklists/${ID}/download`)
        .set("User-Agent", "UA")
        .send({ name: "Ram", phone: "9800000000" });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ pdfUrl: "https://cdn/x.pdf" });
      const arg = svc.recordDownload.mock.calls[0][0];
      expect(arg).toMatchObject({
        checklistId: ID,
        name: "Ram",
        phone: "9800000000",
        geo: { country: "NP", city: "Kathmandu", userAgent: "UA" },
      });
      expect(typeof arg.geo.ip).toBe("string");
    });

    it("POST /:id/download 404s when unavailable and 422s on bad input", async () => {
      svc.recordDownload.mockResolvedValue(null);
      const app = makeApp(svc);
      const missing = await request(app)
        .post(`/api/v1/checklists/${ID}/download`)
        .send({ name: "Ram", phone: "9800000000" });
      expect(missing.status).toBe(404);
      const bad = await request(app)
        .post(`/api/v1/checklists/${ID}/download`)
        .send({ name: "Ram", phone: "12" });
      expect(bad.status).toBe(422);
    });
  });

  describe("staff", () => {
    it("401 without token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/checklists/logs")).status).toBe(401);
    });

    it("GET /logs is not swallowed by /:id and filters by status", async () => {
      const app = makeApp(svc);
      await request(app).get("/api/v1/checklists/logs?status=failed").set("Authorization", AUTH);
      await request(app).get("/api/v1/checklists/logs?status=weird").set("Authorization", AUTH);
      expect(svc.listLogs.mock.calls[0][1]).toBe("failed");
      expect(svc.listLogs.mock.calls[1][1]).toBeUndefined();
      expect(svc.findById).not.toHaveBeenCalled();
    });

    it("CRUD, pdf and archive endpoints", async () => {
      const app = makeApp(svc);
      const a = AUTH;
      await request(app).get("/api/v1/checklists?state=all").set("Authorization", a);
      expect(svc.list.mock.calls[0][1]).toBe("all");
      expect(
        (await request(app).get(`/api/v1/checklists/${ID}`).set("Authorization", a)).status,
      ).toBe(200);
      const created = await request(app)
        .post("/api/v1/checklists")
        .set("Authorization", a)
        .field("type", "Primary")
        .field("isActive", "false");
      expect(created.status).toBe(201);
      expect(svc.create.mock.calls[0][0]).toEqual({ type: "Primary", isActive: false });
      const patched = await request(app)
        .patch(`/api/v1/checklists/${ID}`)
        .set("Authorization", a)
        .send({ isActive: "false" });
      expect(patched.status).toBe(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { isActive: false });
      expect(
        (await request(app).post(`/api/v1/checklists/${ID}/pdf`).set("Authorization", a)).status,
      ).toBe(400);
      expect(
        (await request(app).delete(`/api/v1/checklists/${ID}/pdf`).set("Authorization", a)).status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/checklists/${ID}/archive`).set("Authorization", a))
          .status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/checklists/${ID}/unarchive`).set("Authorization", a))
          .status,
      ).toBe(200);
      expect(
        (await request(app).delete(`/api/v1/checklists/${ID}`).set("Authorization", a)).status,
      ).toBe(204);
    });
  });
});
