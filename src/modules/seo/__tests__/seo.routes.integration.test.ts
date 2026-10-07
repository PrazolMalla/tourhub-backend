import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { SeoController } from "../seo.controller";
import { SeoRoutes } from "../seo.routes";
import type { SeoService } from "../seo.service";
import { SeoModel } from "../seo.model";
import { SeoRepository } from "../seo.repository";
import { env } from "../../../config/env";

const OID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const dto = { id: "s1" };

const makeSvc = () => ({
  getPublic: jest.fn().mockResolvedValue(dto),
  listPublicByEntityType: jest.fn().mockResolvedValue([dto]),
  getAdmin: jest.fn().mockResolvedValue(dto),
  listAdmin: jest.fn().mockResolvedValue([dto]),
  upsert: jest.fn().mockResolvedValue(dto),
  delete: jest.fn(),
  setOgImage: jest.fn(),
  removeOgImage: jest.fn().mockResolvedValue(dto),
  updateOgImageAlt: jest.fn().mockResolvedValue(dto),
  setTwitterImage: jest.fn(),
  removeTwitterImage: jest.fn().mockResolvedValue(dto),
  updateTwitterImageAlt: jest.fn().mockResolvedValue(dto),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new SeoController(svc as unknown as SeoService);
  const api = Router();
  api.use("/seo", new SeoRoutes(controller).getRouter());
  return new App(api).express;
};

describe("SEO routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  describe("public", () => {
    it("GET /public lists by entity type and validates the query", async () => {
      const app = makeApp(svc);
      const ok = await request(app).get("/api/v1/seo/public?entityType=trip");
      expect(ok.status).toBe(200);
      expect(ok.headers["cache-control"]).toContain("max-age=60");
      expect(svc.listPublicByEntityType).toHaveBeenCalledWith("trip");
      expect((await request(app).get("/api/v1/seo/public?entityType=user")).status).toBe(422);
    });

    it("GET /public/:type/:id validates static keys and ObjectIds", async () => {
      const app = makeApp(svc);
      expect((await request(app).get("/api/v1/seo/public/static_page/home")).status).toBe(200);
      expect((await request(app).get(`/api/v1/seo/public/blog/${OID}`)).status).toBe(200);
      expect((await request(app).get("/api/v1/seo/public/static_page/nope")).status).toBe(422);
      expect((await request(app).get("/api/v1/seo/public/trip/home")).status).toBe(422);
      expect(svc.getPublic.mock.calls).toEqual([
        ["static_page", "home"],
        ["blog", OID],
      ]);
    });
  });

  describe("staff", () => {
    it("401 without token", async () => {
      expect((await request(makeApp(svc)).get("/api/v1/seo")).status).toBe(401);
    });

    it("list / get / upsert / delete", async () => {
      const app = makeApp(svc);
      const a = AUTH;
      expect(
        (await request(app).get("/api/v1/seo?entityType=blog").set("Authorization", a)).status,
      ).toBe(200);
      expect(svc.listAdmin).toHaveBeenCalledWith("blog");
      expect(
        (await request(app).get(`/api/v1/seo/trip/${OID}`).set("Authorization", a)).status,
      ).toBe(200);
      const put = await request(app)
        .put(`/api/v1/seo/trip/${OID}`)
        .set("Authorization", a)
        .send({ metaTitle: "", keywords: ["ebc"] });
      expect(put.status).toBe(200);
      expect(svc.upsert.mock.calls[0][2]).toMatchObject({ metaTitle: null, keywords: ["ebc"] });
      expect(
        (await request(app).delete(`/api/v1/seo/trip/${OID}`).set("Authorization", a)).status,
      ).toBe(204);
    });

    it("image endpoints", async () => {
      const app = makeApp(svc);
      const a = AUTH;
      for (const kind of ["og-image", "twitter-image"]) {
        expect(
          (await request(app).post(`/api/v1/seo/trip/${OID}/${kind}`).set("Authorization", a))
            .status,
        ).toBe(400);
        expect(
          (await request(app).delete(`/api/v1/seo/trip/${OID}/${kind}`).set("Authorization", a))
            .status,
        ).toBe(200);
        await request(app)
          .patch(`/api/v1/seo/trip/${OID}/${kind}/alt`)
          .set("Authorization", a)
          .send({ alt: "A" });
        await request(app)
          .patch(`/api/v1/seo/trip/${OID}/${kind}/alt`)
          .set("Authorization", a)
          .send({});
      }
      expect(svc.updateOgImageAlt.mock.calls).toEqual([
        ["trip", OID, "A"],
        ["trip", OID, ""],
      ]);
      expect(svc.updateTwitterImageAlt).toHaveBeenCalledWith("trip", OID, "A");
      expect(svc.removeTwitterImage).toHaveBeenCalledWith("trip", OID);
    });
  });
});

describe("SeoRepository", () => {
  const repo = new SeoRepository();
  afterEach(() => jest.restoreAllMocks());

  it("findByEntity / listByEntityType", async () => {
    const findOne = jest.spyOn(SeoModel, "findOne").mockResolvedValue(null as never);
    const sort = jest.fn().mockResolvedValue([]);
    const find = jest.spyOn(SeoModel, "find").mockReturnValue({ sort } as never);
    await repo.findByEntity("trip", OID);
    await repo.listByEntityType("blog");
    await repo.listByEntityType();
    expect(findOne).toHaveBeenCalledWith({ entityType: "trip", entityId: OID });
    expect(find.mock.calls).toEqual([[{ entityType: "blog" }], [{}]]);
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it("upsertByEntity and setImage use upserts; null image unsets", async () => {
    const spy = jest.spyOn(SeoModel, "findOneAndUpdate").mockResolvedValue({} as never);
    await repo.upsertByEntity("trip", OID, { metaTitle: "T" });
    await repo.setImage("trip", OID, "ogImage", { url: "u", path: "p" });
    await repo.setImage("trip", OID, "twitterImage", null);
    const opts = { new: true, upsert: true, setDefaultsOnInsert: true };
    expect(spy.mock.calls).toEqual([
      [
        { entityType: "trip", entityId: OID },
        { $set: { metaTitle: "T" }, $setOnInsert: { entityType: "trip", entityId: OID } },
        opts,
      ],
      [{ entityType: "trip", entityId: OID }, { $set: { ogImage: { url: "u", path: "p" } } }, opts],
      [{ entityType: "trip", entityId: OID }, { $unset: { twitterImage: "" } }, opts],
    ]);
  });

  it("updateImageAlt returns null / undefined / the saved doc", async () => {
    const save = jest.fn();
    const doc = { ogImage: { url: "u", path: "p", alt: "" }, save };
    jest
      .spyOn(SeoModel, "findOne")
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ save } as never)
      .mockResolvedValueOnce(doc as never);
    await expect(repo.updateImageAlt("trip", OID, "ogImage", "A")).resolves.toBeNull();
    await expect(repo.updateImageAlt("trip", OID, "ogImage", "A")).resolves.toBeUndefined();
    await expect(repo.updateImageAlt("trip", OID, "ogImage", "A")).resolves.toBe(doc);
    expect(doc.ogImage.alt).toBe("A");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("deleteByEntity reports whether anything was deleted", async () => {
    jest
      .spyOn(SeoModel, "deleteOne")
      .mockResolvedValueOnce({ deletedCount: 1 } as never)
      .mockResolvedValueOnce({ deletedCount: 0 } as never);
    await expect(repo.deleteByEntity("trip", OID)).resolves.toBe(true);
    await expect(repo.deleteByEntity("trip", OID)).resolves.toBe(false);
  });
});
