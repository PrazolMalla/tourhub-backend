import { RegionValidator as V } from "../region.validator";

describe("RegionValidator", () => {
  it("create requires name and key", () => {
    expect(V.create.safeParse({ name: "Everest", key: "everest" }).success).toBe(true);
    expect(V.create.safeParse({ name: "Everest" }).success).toBe(false);
    expect(V.create.safeParse({ key: "everest" }).success).toBe(false);
  });

  it("treats an empty slug as absent (create and update)", () => {
    expect(V.create.parse({ name: "E", key: "e", slug: "" }).slug).toBeUndefined();
    expect(V.update.parse({ name: "E", slug: "" }).slug).toBeUndefined();
  });

  it("restricts type to the two kinds", () => {
    expect(V.create.safeParse({ name: "E", key: "e", type: "tour-category" }).success).toBe(true);
    expect(V.create.safeParse({ name: "E", key: "e", type: "city" }).success).toBe(false);
  });

  it("update rejects empty body and unknown keys", () => {
    expect(V.update.safeParse({}).success).toBe(false);
    expect(V.update.safeParse({ imagePath: "x" }).success).toBe(false);
    expect(V.update.safeParse({ sortOrder: 4 }).success).toBe(true);
  });

  it("validates params", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "zz" }).success).toBe(false);
    expect(V.slugParam.safeParse({ slug: "everest" }).success).toBe(true);
    expect(V.slugParam.safeParse({ slug: "x".repeat(81) }).success).toBe(false);
  });
});
