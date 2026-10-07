import { VehicleValidator as V } from "../vehicle.validator";

describe("VehicleValidator", () => {
  it("create requires a name", () => {
    expect(V.create.safeParse({ name: "Jeep" }).success).toBe(true);
    expect(V.create.safeParse({}).success).toBe(false);
    expect(V.create.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates slug characters", () => {
    expect(V.create.safeParse({ name: "J", slug: "land-cruiser-2" }).success).toBe(true);
    expect(V.create.safeParse({ name: "J", slug: "land cruiser" }).success).toBe(false);
  });

  it("validates nested specs and facts", () => {
    expect(
      V.create.safeParse({
        name: "J",
        specs: [{ icon: "users", label: "7 seats" }],
        facts: [{ label: "Seats", value: "7", icon: "users" }],
      }).success,
    ).toBe(true);
    expect(V.create.safeParse({ name: "J", specs: [{ icon: "users" }] }).success).toBe(false);
    expect(
      V.create.safeParse({ name: "J", facts: [{ label: "x", value: "", icon: "a" }] }).success,
    ).toBe(false);
  });

  it("caps array sizes", () => {
    expect(V.create.safeParse({ name: "J", gallery: Array(31).fill("u") }).success).toBe(false);
  });

  it("update is partial but not empty, and strict", () => {
    expect(V.update.safeParse({}).success).toBe(false);
    expect(V.update.safeParse({ isActive: false }).success).toBe(true);
    expect(V.update.safeParse({ images: [] }).success).toBe(false);
  });

  it("validates params and alt body", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "x" }).success).toBe(false);
    expect(V.slugParam.safeParse({ slug: "jeep" }).success).toBe(true);
    expect(V.imageAltBody.safeParse({ alt: "Front" }).success).toBe(true);
    expect(V.imageAltBody.safeParse({ alt: "x".repeat(301) }).success).toBe(false);
  });
});
