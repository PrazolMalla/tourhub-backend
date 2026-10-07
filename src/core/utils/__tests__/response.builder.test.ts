import { ResponseBuilder } from "../response.builder";

describe("ResponseBuilder", () => {
  it("success() without meta", () => {
    expect(ResponseBuilder.success({ a: 1 })).toEqual({ success: true, data: { a: 1 } });
  });

  it("success() with meta", () => {
    expect(ResponseBuilder.success({ a: 1 }, { total: 2 })).toEqual({
      success: true,
      data: { a: 1 },
      meta: { total: 2 },
    });
  });

  it("created() emits an envelope without meta", () => {
    expect(ResponseBuilder.created({ id: "x" })).toEqual({ success: true, data: { id: "x" } });
  });

  it("noContent() returns success without data", () => {
    expect(ResponseBuilder.noContent()).toEqual({ success: true });
  });

  it("error() without details", () => {
    expect(ResponseBuilder.error("CODE", "msg")).toEqual({
      success: false,
      error: { code: "CODE", message: "msg" },
    });
  });

  it("error() with details", () => {
    expect(ResponseBuilder.error("CODE", "msg", { field: "x" })).toEqual({
      success: false,
      error: { code: "CODE", message: "msg", details: { field: "x" } },
    });
  });
});
