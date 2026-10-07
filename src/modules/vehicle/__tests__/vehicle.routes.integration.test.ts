import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { VehicleController } from "../vehicle.controller";
import { VehicleRoutes } from "../vehicle.routes";
import type { VehicleService } from "../vehicle.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  listPublic: jest.fn().mockResolvedValue(page),
  findPublicBySlug: jest.fn().mockResolvedValue({ slug: "jeep" }),
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
  const controller = new VehicleController(svc as unknown as VehicleService);
  const api = Router();
  api.use("/vehicles", new VehicleRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Vehicle routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  it("public list and slug lookup need no auth", async () => {
    const app = makeApp(svc);
    const list = await request(app).get("/api/v1/vehicles/public?sortBy=name");
    expect(list.status).toBe(200);
    expect(list.headers["cache-control"]).toContain("max-age=60");
    expect(svc.listPublic.mock.calls[0][0]).toMatchObject({ sortBy: "name" });
    expect((await request(app).get("/api/v1/vehicles/public/slug/jeep")).status).toBe(200);
    expect(svc.findPublicBySlug).toHaveBeenCalledWith("jeep");
  });

  it("staff routes need auth", async () => {
    expect((await request(makeApp(svc)).get("/api/v1/vehicles")).status).toBe(401);
  });

  it("staff CRUD, archive and image endpoints", async () => {
    const app = makeApp(svc);
    const a = AUTH;
    await request(app).get("/api/v1/vehicles?state=archived").set("Authorization", a);
    expect(svc.list.mock.calls[0][1]).toBe("archived");
    expect((await request(app).get(`/api/v1/vehicles/${ID}`).set("Authorization", a)).status).toBe(
      200,
    );
    expect(
      (await request(app).post("/api/v1/vehicles").set("Authorization", a).send({})).status,
    ).toBe(422);
    expect(
      (await request(app).post("/api/v1/vehicles").set("Authorization", a).send({ name: "Jeep" }))
        .status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .patch(`/api/v1/vehicles/${ID}`)
          .set("Authorization", a)
          .send({ tag: "4x4" })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/vehicles/${ID}/archive`).set("Authorization", a)).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/vehicles/${ID}/unarchive`).set("Authorization", a)).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/vehicles/${ID}/image`).set("Authorization", a)).status,
    ).toBe(400);
    expect(
      (await request(app).delete(`/api/v1/vehicles/${ID}/image`).set("Authorization", a)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .patch(`/api/v1/vehicles/${ID}/image/alt`)
          .set("Authorization", a)
          .send({ alt: "F" })
      ).status,
    ).toBe(200);
    expect(svc.updateImageAlt).toHaveBeenCalledWith(ID, "F");
    expect(
      (await request(app).delete(`/api/v1/vehicles/${ID}`).set("Authorization", a)).status,
    ).toBe(204);
  });
});
