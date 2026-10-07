import type { HydratedDocument } from "mongoose";
import type { VehicleDoc } from "../vehicle.model";
import { toPublicVehicle, toVehicleDTO } from "../vehicle.types";

jest.mock("../../../core/utils/cloudinary.util", () => ({
  cloudinaryAutoUrl: (id: string) => `auto:${id}`,
}));

const makeDoc = (o: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => "v1" },
    slug: "jeep",
    name: "Jeep",
    isActive: true,
    isFeatured: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...o,
  }) as unknown as HydratedDocument<VehicleDoc>;

describe("vehicle DTOs", () => {
  it("toVehicleDTO fills defaults for sparse docs", () => {
    expect(toVehicleDTO(makeDoc())).toMatchObject({
      id: "v1",
      tag: "",
      desc: "",
      specs: [],
      gallery: [],
      images: [],
      sortOrder: 0,
    });
    expect(toVehicleDTO(makeDoc())).not.toHaveProperty("img");
  });

  it("prefers the primary uploaded image over img", () => {
    const doc = makeDoc({
      img: "https://ext/a.jpg",
      images: [
        { path: "a", url: "ua" },
        { path: "b", url: "ub", isPrimary: true },
      ],
    });
    expect(toVehicleDTO(doc).img).toBe("auto:b");
    expect(toPublicVehicle(doc).img).toBe("auto:b");
  });

  it("falls back to the external img and gallery", () => {
    const pub = toPublicVehicle(makeDoc({ img: "https://ext/a.jpg", gallery: ["g1"] }));
    expect(pub).toMatchObject({ img: "https://ext/a.jpg", gallery: ["g1"] });
  });

  it("uploaded images replace the external gallery publicly", () => {
    const pub = toPublicVehicle(makeDoc({ gallery: ["g1"], images: [{ path: "a", url: "ua" }] }));
    expect(pub.gallery).toEqual(["auto:a"]);
  });

  it("public shape has no admin-only fields", () => {
    const pub = toPublicVehicle(makeDoc({ archivedAt: new Date() }));
    for (const k of ["id", "isActive", "archivedAt", "images", "sortOrder"]) {
      expect(pub).not.toHaveProperty(k);
    }
  });
});
