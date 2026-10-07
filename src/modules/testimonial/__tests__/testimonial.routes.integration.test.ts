import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { TestimonialController } from "../testimonial.controller";
import { TestimonialRoutes } from "../testimonial.routes";
import type { TestimonialService } from "../testimonial.service";
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
  uploadVideo: jest.fn(),
  removeVideo: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new TestimonialController(svc as unknown as TestimonialService);
  const api = Router();
  api.use("/testimonials", new TestimonialRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Testimonial routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  it("GET /public uses the active-only listing", async () => {
    const res = await request(makeApp(svc)).get("/api/v1/testimonials/public");
    expect(res.status).toBe(200);
    expect(svc.listPublic).toHaveBeenCalled();
    expect(svc.list).not.toHaveBeenCalled();
  });

  it("staff routes need auth", async () => {
    expect((await request(makeApp(svc)).get("/api/v1/testimonials")).status).toBe(401);
  });

  it("POST / rejects a javascript: videoUrl", async () => {
    const res = await request(makeApp(svc))
      .post("/api/v1/testimonials")
      .set("Authorization", AUTH)
      .send({ name: "A", quote: "Q", videoUrl: "javascript:alert(1)" });
    expect(res.status).toBe(422);
  });

  it("CRUD, archive and media endpoints", async () => {
    const app = makeApp(svc);
    const a = AUTH;
    expect(
      (await request(app).get("/api/v1/testimonials?state=all").set("Authorization", a)).status,
    ).toBe(200);
    expect(svc.list.mock.calls[0][1]).toBe("all");
    expect(
      (await request(app).get(`/api/v1/testimonials/${ID}`).set("Authorization", a)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/v1/testimonials")
          .set("Authorization", a)
          .send({ name: "A", quote: "Q" })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .patch(`/api/v1/testimonials/${ID}`)
          .set("Authorization", a)
          .send({ rating: 4 })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/testimonials/${ID}/archive`).set("Authorization", a))
        .status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/testimonials/${ID}/unarchive`).set("Authorization", a))
        .status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/testimonials/${ID}/image`).set("Authorization", a)).status,
    ).toBe(400);
    expect(
      (await request(app).post(`/api/v1/testimonials/${ID}/video`).set("Authorization", a)).status,
    ).toBe(400);
    expect(
      (await request(app).delete(`/api/v1/testimonials/${ID}/image`).set("Authorization", a))
        .status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/testimonials/${ID}/video`).set("Authorization", a))
        .status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/testimonials/${ID}`).set("Authorization", a)).status,
    ).toBe(204);
  });
});
