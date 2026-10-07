import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { BlogController } from "../blog.controller";
import { BlogRoutes } from "../blog.routes";
import type { BlogService } from "../blog.service";
import { env } from "../../../config/env";
import { NotFoundError } from "../../../core/errors";

const ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439022";
const AUTH = `Bearer ${jwt.sign({ id: ADMIN_ID, kind: "admin", role: "admin" }, env.JWT_SECRET)}`;

const page = { data: [], meta: { total: 0 } };
const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findPublishedById: jest.fn(),
  findPublishedBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
  unarchive: jest.fn(),
  hardDelete: jest.fn(),
  addImages: jest.fn(),
  removeImage: jest.fn(),
  setPrimaryImage: jest.fn(),
  updateImageAlt: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new BlogController(svc as unknown as BlogService);
  const api = Router();
  api.use("/blogs", new BlogRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Blog routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public forces isActive=true and ignores admin-only filters", async () => {
      const res = await request(makeApp(svc)).get(
        "/api/v1/blogs/public?category=Trek&featured=true&isActive=false&state=all",
      );
      expect(res.status).toBe(200);
      const [pagination, filters] = svc.list.mock.calls[0];
      expect(filters).toEqual({ isActive: true, category: "Trek", featured: true });
      expect(pagination).toMatchObject({ sortBy: "datePublished", sortOrder: "desc" });
    });

    it("GET /public/slug/:slug uses the published-only lookup", async () => {
      svc.findPublishedBySlug.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc)).get("/api/v1/blogs/public/slug/everest");
      expect(res.status).toBe(200);
      expect(svc.findPublishedBySlug).toHaveBeenCalledWith("everest");
      expect(svc.findBySlug).not.toHaveBeenCalled();
    });

    it("GET /public/:id uses the published-only lookup", async () => {
      svc.findPublishedById.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc)).get(`/api/v1/blogs/public/${ID}`);
      expect(res.status).toBe(200);
      expect(svc.findPublishedById).toHaveBeenCalledWith(ID);
      expect(svc.findById).not.toHaveBeenCalled();
    });

    it("draft posts 404 publicly", async () => {
      svc.findPublishedById.mockRejectedValue(new NotFoundError("nope"));
      const res = await request(makeApp(svc)).get(`/api/v1/blogs/public/${ID}`);
      expect(res.status).toBe(404);
    });
  });

  describe("staff", () => {
    it("401 without token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/blogs")).status).toBe(401);
    });

    it("GET / parses admin filters", async () => {
      await request(makeApp(svc))
        .get("/api/v1/blogs?featured=false&isActive=true&state=archived&category=News")
        .set("Authorization", AUTH);
      expect(svc.list.mock.calls[0][1]).toEqual({
        category: "News",
        featured: false,
        isActive: true,
        state: "archived",
      });
    });

    it("GET / ignores an unknown state", async () => {
      await request(makeApp(svc)).get("/api/v1/blogs?state=bogus").set("Authorization", AUTH);
      expect(svc.list.mock.calls[0][1]).toEqual({});
    });

    it("GET /:id returns drafts to staff", async () => {
      svc.findById.mockResolvedValue({ id: ID, isActive: false });
      const res = await request(makeApp(svc)).get(`/api/v1/blogs/${ID}`).set("Authorization", AUTH);
      expect(res.status).toBe(200);
      expect(svc.findById).toHaveBeenCalledWith(ID);
    });

    it("POST / creates with caller id", async () => {
      svc.create.mockResolvedValue({ id: ID });
      const res = await request(makeApp(svc))
        .post("/api/v1/blogs")
        .set("Authorization", AUTH)
        .send({ title: "T", body: "B", featured: "false" });
      expect(res.status).toBe(201);
      expect(svc.create).toHaveBeenCalledWith({ title: "T", body: "B", featured: false }, ADMIN_ID);
    });

    it("POST / rejects a javascript: exploreHref", async () => {
      const res = await request(makeApp(svc))
        .post("/api/v1/blogs")
        .set("Authorization", AUTH)
        .send({ title: "T", body: "B", exploreHref: "javascript:alert(1)" });
      expect(res.status).toBe(422);
    });

    it("PATCH, archive, unarchive, DELETE", async () => {
      const app = makeApp(svc);
      svc.update.mockResolvedValue({ id: ID });
      svc.archive.mockResolvedValue({ id: ID });
      svc.unarchive.mockResolvedValue({ id: ID });
      const p = await request(app)
        .patch(`/api/v1/blogs/${ID}`)
        .set("Authorization", AUTH)
        .send({ title: "N" });
      expect(p.status).toBe(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { title: "N" });
      expect(
        (await request(app).post(`/api/v1/blogs/${ID}/archive`).set("Authorization", AUTH)).status,
      ).toBe(200);
      expect(
        (await request(app).post(`/api/v1/blogs/${ID}/unarchive`).set("Authorization", AUTH))
          .status,
      ).toBe(200);
      expect(
        (await request(app).delete(`/api/v1/blogs/${ID}`).set("Authorization", AUTH)).status,
      ).toBe(204);
      expect(svc.hardDelete).toHaveBeenCalledWith(ID);
    });

    it("POST /:id/images 400s with no files", async () => {
      const res = await request(makeApp(svc))
        .post(`/api/v1/blogs/${ID}/images`)
        .set("Authorization", AUTH);
      expect(res.status).toBe(400);
      expect(svc.addImages).not.toHaveBeenCalled();
    });

    it("image path endpoints forward the path", async () => {
      const app = makeApp(svc);
      svc.removeImage.mockResolvedValue({ id: ID });
      svc.setPrimaryImage.mockResolvedValue({ id: ID });
      svc.updateImageAlt.mockResolvedValue({ id: ID });
      await request(app)
        .delete(`/api/v1/blogs/${ID}/images`)
        .set("Authorization", AUTH)
        .send({ path: "blog/a" });
      await request(app)
        .post(`/api/v1/blogs/${ID}/images/primary`)
        .set("Authorization", AUTH)
        .send({ path: "blog/a" });
      await request(app)
        .patch(`/api/v1/blogs/${ID}/images/meta`)
        .set("Authorization", AUTH)
        .send({ path: "blog/a", alt: "Alt" });
      expect(svc.removeImage).toHaveBeenCalledWith(ID, "blog/a");
      expect(svc.setPrimaryImage).toHaveBeenCalledWith(ID, "blog/a");
      expect(svc.updateImageAlt).toHaveBeenCalledWith(ID, "blog/a", "Alt");
    });

    it("image path endpoints validate the body", async () => {
      const res = await request(makeApp(svc))
        .delete(`/api/v1/blogs/${ID}/images`)
        .set("Authorization", AUTH)
        .send({});
      expect(res.status).toBe(422);
    });
  });
});
