import request from "supertest";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { App } from "../../../app";
import { DashboardController } from "../dashboard.controller";
import { DashboardRoutes } from "../dashboard.routes";
import type { DashboardService } from "../dashboard.service";
import { env } from "../../../config/env";

const tok = (payload: Record<string, unknown>) => `Bearer ${jwt.sign(payload, env.JWT_SECRET)}`;
const STAFF = tok({ id: "a1", kind: "admin", role: "admin" });

const makeApp = (summary: jest.Mock) => {
  const controller = new DashboardController({ summary } as unknown as DashboardService);
  const api = Router();
  api.use("/dashboard", new DashboardRoutes(controller).getRouter());
  return new App(api).express;
};

describe("Dashboard routes (integration)", () => {
  let summary: jest.Mock;
  beforeEach(() => {
    summary = jest.fn().mockResolvedValue({ range: "30d" });
  });

  it("401 without a token", async () => {
    expect((await request(makeApp(summary)).get("/api/v1/dashboard/summary")).status).toBe(401);
  });

  it("403 for a customer", async () => {
    const res = await request(makeApp(summary))
      .get("/api/v1/dashboard/summary")
      .set("Authorization", tok({ id: "u1", kind: "user" }));
    expect(res.status).toBe(403);
  });

  it.each(["7d", "30d", "90d", "all"])("passes range=%s through", async (range) => {
    const res = await request(makeApp(summary))
      .get(`/api/v1/dashboard/summary?range=${range}`)
      .set("Authorization", STAFF);
    expect(res.status).toBe(200);
    expect(summary).toHaveBeenCalledWith(range);
  });

  it.each(["", "?range=1y", "?range=7D"])("falls back to 30d for %p", async (qs) => {
    await request(makeApp(summary))
      .get(`/api/v1/dashboard/summary${qs}`)
      .set("Authorization", STAFF);
    expect(summary).toHaveBeenCalledWith("30d");
  });

  it("allows superadmins", async () => {
    const res = await request(makeApp(summary))
      .get("/api/v1/dashboard/summary")
      .set("Authorization", tok({ id: "s1", kind: "admin", role: "superadmin" }));
    expect(res.status).toBe(200);
  });
});
