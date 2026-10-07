import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { TripController } from "../trip.controller";
import { TripRoutes } from "../trip.routes";
import type { TripService } from "../trip.service";
import { env } from "../../../config/env";
import { NotFoundError } from "../../../core/errors";

const ID = "507f1f77bcf86cd799439011";
const ADMIN = "507f1f77bcf86cd799439022";
const AUTH = `Bearer ${jwt.sign({ id: ADMIN, kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  listWithFacets: jest.fn().mockResolvedValue({ ...page, facets: { regions: {}, durations: {} } }),
  findById: jest.fn().mockResolvedValue({ id: ID }),
  findBySlug: jest.fn().mockResolvedValue({ id: ID }),
  findPublishedById: jest.fn().mockResolvedValue({ id: ID }),
  findPublishedBySlug: jest.fn().mockResolvedValue({ id: ID }),
  create: jest.fn().mockResolvedValue({ id: ID }),
  update: jest.fn().mockResolvedValue({ id: ID }),
  archive: jest.fn().mockResolvedValue({ id: ID }),
  unarchive: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn().mockResolvedValue({ id: ID }),
  setPrimaryImage: jest.fn().mockResolvedValue({ id: ID }),
  reorderImages: jest.fn().mockResolvedValue({ id: ID }),
  updateImageAlt: jest.fn().mockResolvedValue({ id: ID }),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new TripController(svc as unknown as TripService);
  const api = Router();
  api.use("/trips", new TripRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Trip routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public parses every filter and returns facets in meta", async () => {
      svc.listWithFacets.mockResolvedValue({
        data: [],
        meta: { total: 0 },
        facets: { regions: { everest: 2 }, durations: {} },
      });
      const res = await request(makeApp(svc)).get(
        "/api/v1/trips/public?kind=trek&country=nepal&regions=everest,%20annapurna,&cats=trekking" +
          "&durations=d1,d3&minDays=2&maxDays=10&minPrice=100&maxPrice=2000&sortBy=price&limit=200",
      );
      expect(res.status).toBe(200);
      expect(res.body.meta.facets).toEqual({ regions: { everest: 2 }, durations: {} });
      const [pagination, filters] = svc.listWithFacets.mock.calls[0];
      expect(pagination).toMatchObject({ sortBy: "price", limit: 200 });
      expect(filters).toEqual({
        isActive: true,
        kind: "trek",
        country: "nepal",
        regions: ["everest", "annapurna"],
        cats: ["trekking"],
        durationBuckets: ["d1", "d3"],
        minDays: 2,
        maxDays: 10,
        minPrice: 100,
        maxPrice: 2000,
      });
    });

    it("GET /public ignores an unknown kind and empty numbers", async () => {
      await request(makeApp(svc)).get(
        "/api/v1/trips/public?kind=cruise&minDays=&region=everest&cat=tours",
      );
      expect(svc.listWithFacets.mock.calls[0][1]).toEqual({
        isActive: true,
        region: "everest",
        cat: "tours",
      });
    });

    it("detail endpoints use published-only lookups", async () => {
      const app = makeApp(svc);
      expect((await request(app).get("/api/v1/trips/public/slug/ebc")).status).toBe(200);
      expect((await request(app).get(`/api/v1/trips/public/${ID}`)).status).toBe(200);
      expect(svc.findPublishedBySlug).toHaveBeenCalledWith("ebc");
      expect(svc.findPublishedById).toHaveBeenCalledWith(ID);
      expect(svc.findBySlug).not.toHaveBeenCalled();
      expect(svc.findById).not.toHaveBeenCalled();
    });

    it("draft trips 404 publicly", async () => {
      svc.findPublishedBySlug.mockRejectedValue(new NotFoundError("x"));
      expect((await request(makeApp(svc)).get("/api/v1/trips/public/slug/draft")).status).toBe(404);
    });
  });

  describe("staff", () => {
    it("401 without token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/trips")).status).toBe(401);
    });

    it("GET / parses admin filters", async () => {
      await request(makeApp(svc))
        .get("/api/v1/trips?kind=tour&country=malaysia&region=kl&cat=city&isActive=false&state=all")
        .set("Authorization", AUTH);
      expect(svc.list.mock.calls[0][1]).toEqual({
        kind: "tour",
        country: "malaysia",
        region: "kl",
        cat: "city",
        isActive: false,
        state: "all",
      });
    });

    it("POST / creates with caller id and parses booleans correctly", async () => {
      const res = await request(makeApp(svc))
        .post("/api/v1/trips")
        .set("Authorization", AUTH)
        .send({
          title: "T",
          kind: "trek",
          country: "nepal",
          region: "e",
          days: 3,
          isActive: "false",
        });
      expect(res.status).toBe(201);
      expect(svc.create.mock.calls[0][0].isActive).toBe(false);
      expect(svc.create.mock.calls[0][1]).toBe(ADMIN);
    });

    it("POST / rejects a javascript: videoUrl", async () => {
      const res = await request(makeApp(svc))
        .post("/api/v1/trips")
        .set("Authorization", AUTH)
        .send({
          title: "T",
          kind: "trek",
          country: "n",
          region: "e",
          days: 3,
          videoUrl: "javascript:alert(1)",
        });
      expect(res.status).toBe(422);
    });

    it("update / archive / delete", async () => {
      const app = makeApp(svc);
      const a = AUTH;
      expect((await request(app).get(`/api/v1/trips/${ID}`).set("Authorization", a)).status).toBe(
        200,
      );
      expect(
        (await request(app).patch(`/api/v1/trips/${ID}`).set("Authorization", a).send({ days: 4 }))
          .status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/trips/${ID}/archive`).set("Authorization", a)).status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/trips/${ID}/unarchive`).set("Authorization", a)).status,
      ).toBe(200);
      expect(
        (await request(app).delete(`/api/v1/trips/${ID}`).set("Authorization", a)).status,
      ).toBe(204);
    });

    it("image endpoints", async () => {
      const app = makeApp(svc);
      const a = AUTH;
      expect(
        (await request(app).post(`/api/v1/trips/${ID}/images`).set("Authorization", a)).status,
      ).toBe(400);
      await request(app)
        .delete(`/api/v1/trips/${ID}/images`)
        .set("Authorization", a)
        .send({ path: "p" });
      await request(app)
        .post(`/api/v1/trips/${ID}/images/primary`)
        .set("Authorization", a)
        .send({ path: "p" });
      await request(app)
        .patch(`/api/v1/trips/${ID}/images/reorder`)
        .set("Authorization", a)
        .send({ order: ["b", "a"] });
      await request(app)
        .patch(`/api/v1/trips/${ID}/images/meta`)
        .set("Authorization", a)
        .send({ path: "p", alt: "Alt" });
      expect(svc.removeImage).toHaveBeenCalledWith(ID, "p");
      expect(svc.setPrimaryImage).toHaveBeenCalledWith(ID, "p");
      expect(svc.reorderImages).toHaveBeenCalledWith(ID, ["b", "a"]);
      expect(svc.updateImageAlt).toHaveBeenCalledWith(ID, "p", "Alt");
    });
  });
});
