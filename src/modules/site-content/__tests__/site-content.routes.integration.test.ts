import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { SiteContentController } from "../site-content.controller";
import { SiteContentRoutes } from "../site-content.routes";
import type { SiteContentService } from "../site-content.service";
import { env } from "../../../config/env";

const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const dto = { id: "sc1", section: "hero" };

const makeSvc = () => ({
  getPublic: jest.fn().mockResolvedValue(dto),
  listAllPublic: jest.fn().mockResolvedValue([dto]),
  getAdmin: jest.fn().mockResolvedValue(dto),
  listAllAdmin: jest.fn().mockResolvedValue([dto]),
  upsert: jest.fn().mockResolvedValue(dto),
  addImages: jest.fn(),
  reorderImages: jest.fn().mockResolvedValue(dto),
  updateImageMeta: jest.fn().mockResolvedValue(dto),
  archive: jest.fn().mockResolvedValue(dto),
  unarchive: jest.fn().mockResolvedValue(dto),
  hardDelete: jest.fn(),
  removeImage: jest.fn().mockResolvedValue(dto),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new SiteContentController(svc as unknown as SiteContentService);
  const api = Router();
  api.use("/site-content", new SiteContentRoutes(controller).getRouter());
  return new App(api).express;
};

describe("SiteContent routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  it("public reads are open, cached and lowercase the section", async () => {
    const app = makeApp(svc);
    const all = await request(app).get("/api/v1/site-content/public");
    expect(all.status).toBe(200);
    expect(all.headers["cache-control"]).toContain("max-age=60");
    expect((await request(app).get("/api/v1/site-content/public/HERO")).status).toBe(200);
    expect(svc.getPublic).toHaveBeenCalledWith("hero");
  });

  it("rejects malformed section keys", async () => {
    expect((await request(makeApp(svc)).get("/api/v1/site-content/public/bad.key")).status).toBe(
      422,
    );
  });

  it("admin routes need auth", async () => {
    expect((await request(makeApp(svc)).get("/api/v1/site-content")).status).toBe(401);
  });

  it("admin read/write endpoints", async () => {
    const app = makeApp(svc);
    const a = AUTH;
    expect((await request(app).get("/api/v1/site-content").set("Authorization", a)).status).toBe(
      200,
    );
    expect(
      (await request(app).get("/api/v1/site-content/hero").set("Authorization", a)).status,
    ).toBe(200);
    const put = await request(app)
      .put("/api/v1/site-content/hero")
      .set("Authorization", a)
      .send({ data: { title: "New" } });
    expect(put.status).toBe(200);
    expect(svc.upsert).toHaveBeenCalledWith("hero", { data: { title: "New" } });
    expect(
      (await request(app).put("/api/v1/site-content/hero").set("Authorization", a).send({})).status,
    ).toBe(422);
  });

  it("image endpoints", async () => {
    const app = makeApp(svc);
    const a = AUTH;
    expect(
      (await request(app).post("/api/v1/site-content/gallery/images").set("Authorization", a))
        .status,
    ).toBe(400);
    await request(app)
      .patch("/api/v1/site-content/gallery/images/reorder")
      .set("Authorization", a)
      .send({ order: ["b", "a"] });
    expect(svc.reorderImages).toHaveBeenCalledWith("gallery", ["b", "a"]);
    await request(app)
      .patch("/api/v1/site-content/gallery/images/meta")
      .set("Authorization", a)
      .send({ imagePath: "a", caption: "C" });
    expect(svc.updateImageMeta).toHaveBeenCalledWith("gallery", "a", { caption: "C" });
    await request(app)
      .delete("/api/v1/site-content/gallery/images")
      .set("Authorization", a)
      .send({ imagePath: "a" });
    expect(svc.removeImage).toHaveBeenCalledWith("gallery", "a");
  });

  it("archive / unarchive / hard delete", async () => {
    const app = makeApp(svc);
    const a = AUTH;
    expect(
      (await request(app).post("/api/v1/site-content/hero/archive").set("Authorization", a)).status,
    ).toBe(200);
    expect(
      (await request(app).post("/api/v1/site-content/hero/unarchive").set("Authorization", a))
        .status,
    ).toBe(200);
    expect(
      (await request(app).delete("/api/v1/site-content/hero").set("Authorization", a)).status,
    ).toBe(204);
    expect(svc.hardDelete).toHaveBeenCalledWith("hero");
  });
});
