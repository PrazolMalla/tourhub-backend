import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { TeamMemberController } from "../team-member.controller";
import { TeamMemberRoutes } from "../team-member.routes";
import type { TeamMemberService } from "../team-member.service";
import { env } from "../../../config/env";

const ID = "507f1f77bcf86cd799439011";
const AUTH = `Bearer ${jwt.sign({ id: "a1", kind: "admin", role: "admin" }, env.JWT_SECRET)}`;
const page = { data: [], meta: { total: 0 } };

const makeSvc = () => ({
  list: jest.fn().mockResolvedValue(page),
  findById: jest.fn().mockResolvedValue({ id: ID }),
  create: jest.fn().mockResolvedValue({ id: ID }),
  update: jest.fn().mockResolvedValue({ id: ID }),
  uploadImage: jest.fn(),
  removeImage: jest.fn().mockResolvedValue({ id: ID }),
  hardDelete: jest.fn(),
});

const makeApp = (svc: ReturnType<typeof makeSvc>) => {
  const controller = new TeamMemberController(svc as unknown as TeamMemberService);
  const api = Router();
  api.use("/team-members", new TeamMemberRoutes(controller).getRouter());
  return new App(api).express;
};

describe("TeamMember routes (integration)", () => {
  let svc: ReturnType<typeof makeSvc>;
  beforeEach(() => {
    svc = makeSvc();
  });

  it("GET /public lists live members without auth", async () => {
    const res = await request(makeApp(svc)).get("/api/v1/team-members/public");
    expect(res.status).toBe(200);
    expect(svc.list.mock.calls[0][1]).toEqual({ state: "live" });
  });

  it("staff routes need auth", async () => {
    expect((await request(makeApp(svc)).get("/api/v1/team-members")).status).toBe(401);
  });

  it("CRUD and photo endpoints", async () => {
    const app = makeApp(svc);
    expect((await request(app).get("/api/v1/team-members").set("Authorization", AUTH)).status).toBe(
      200,
    );
    expect(
      (await request(app).get(`/api/v1/team-members/${ID}`).set("Authorization", AUTH)).status,
    ).toBe(200);
    const created = await request(app)
      .post("/api/v1/team-members")
      .set("Authorization", AUTH)
      .send({ name: "P", role: "R", description: "D" });
    expect(created.status).toBe(201);
    const bad = await request(app)
      .post("/api/v1/team-members")
      .set("Authorization", AUTH)
      .send({ name: "P" });
    expect(bad.status).toBe(422);
    expect(
      (
        await request(app)
          .patch(`/api/v1/team-members/${ID}`)
          .set("Authorization", AUTH)
          .send({ role: "X" })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/api/v1/team-members/${ID}/image`).set("Authorization", AUTH))
        .status,
    ).toBe(400);
    expect(
      (await request(app).delete(`/api/v1/team-members/${ID}/image`).set("Authorization", AUTH))
        .status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/team-members/${ID}`).set("Authorization", AUTH)).status,
    ).toBe(204);
    expect(svc.hardDelete).toHaveBeenCalledWith(ID);
  });
});
