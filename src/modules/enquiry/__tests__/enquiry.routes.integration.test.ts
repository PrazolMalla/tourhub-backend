import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { EnquiryController } from "../enquiry.controller";
import { EnquiryRoutes } from "../enquiry.routes";
import type { EnquiryService } from "../enquiry.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439022";
const AUTH = `Bearer ${jwt.sign({ id: ADMIN_ID, kind: "admin", role: "admin" }, env.JWT_SECRET)}`;

const makeSvc = () => ({
  create: jest.fn().mockResolvedValue({ id: ID, status: "new", ip: "x" }),
  list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  unreadCount: jest.fn().mockResolvedValue(3),
  findById: jest.fn(),
  update: jest.fn(),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new EnquiryController(svc as unknown as EnquiryService);
  const api = Router();
  api.use("/enquiries", new EnquiryRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Enquiry routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("POST / (public)", () => {
    it("creates without auth and returns only a bare message", async () => {
      const res = await request(makeApp(svc))
        .post("/api/v1/enquiries")
        .set("User-Agent", "jest-UA")
        .send({ name: "Sita", source: "contact" });
      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({ message: "Enquiry submitted successfully" });
      const [body, meta] = svc.create.mock.calls[0];
      expect(body).toEqual({ name: "Sita", source: "contact" });
      expect(meta.userAgent).toBe("jest-UA");
      expect(typeof meta.ip).toBe("string");
    });

    it("422 for an invalid payload", async () => {
      const res = await request(makeApp(svc)).post("/api/v1/enquiries").send({ source: "contact" });
      expect(res.status).toBe(422);
      expect(svc.create).not.toHaveBeenCalled();
    });
  });

  describe("staff inbox", () => {
    it("401 without a token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/enquiries")).status).toBe(401);
    });

    it("GET / parses filters and ignores unknown values", async () => {
      await request(makeApp(svc))
        .get("/api/v1/enquiries?status=spam&source=hire&isRead=false")
        .set("Authorization", AUTH);
      expect(svc.list.mock.calls[0][1]).toEqual({
        status: "spam",
        source: "hire",
        isRead: false,
        state: "live",
      });

      await request(makeApp(svc))
        .get("/api/v1/enquiries?status=bogus&isRead=maybe&state=all")
        .set("Authorization", AUTH);
      expect(svc.list.mock.calls[1][1]).toEqual({ state: "all" });
    });

    it("GET /unread-count is not shadowed by /:id", async () => {
      const res = await request(makeApp(svc))
        .get("/api/v1/enquiries/unread-count")
        .set("Authorization", AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ count: 3 });
    });

    it("GET /:id", async () => {
      svc.findById.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc))
        .get(`/api/v1/enquiries/${ID}`)
        .set("Authorization", AUTH);
      expect(res.status).toBe(200);
    });

    it("PATCH /:id passes the acting admin id", async () => {
      svc.update.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc))
        .patch(`/api/v1/enquiries/${ID}`)
        .set("Authorization", AUTH)
        .send({ status: "contacted", isRead: "false" });
      expect(res.status).toBe(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { status: "contacted", isRead: false }, ADMIN_ID);
    });

    it("DELETE /:id", async () => {
      const res = await request(makeApp(svc))
        .delete(`/api/v1/enquiries/${ID}`)
        .set("Authorization", AUTH);
      expect(res.status).toBe(204);
      expect(svc.hardDelete).toHaveBeenCalledWith(ID);
    });
  });
});
