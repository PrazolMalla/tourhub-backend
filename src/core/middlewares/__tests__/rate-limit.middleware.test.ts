import { RateLimitMiddleware } from "../rate-limit.middleware";

describe("RateLimitMiddleware factories", () => {
  it("create() returns a function", () => {
    const handler = RateLimitMiddleware.create({ windowMs: 1000, max: 5 });
    expect(typeof handler).toBe("function");
  });

  it("create() accepts a custom message", () => {
    const handler = RateLimitMiddleware.create({
      windowMs: 1000,
      max: 5,
      message: "slow down",
    });
    expect(typeof handler).toBe("function");
  });

  it("global() returns a function", () => {
    expect(typeof RateLimitMiddleware.global()).toBe("function");
  });

  it("auth() returns a function", () => {
    expect(typeof RateLimitMiddleware.auth()).toBe("function");
  });

  it("publicSubmit() returns a function", () => {
    expect(typeof RateLimitMiddleware.publicSubmit()).toBe("function");
  });

  it("publicApi() returns a function", () => {
    expect(typeof RateLimitMiddleware.publicApi()).toBe("function");
  });
});
