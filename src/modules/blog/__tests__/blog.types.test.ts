import type { HydratedDocument } from "mongoose";
import type { BlogDoc } from "../blog.model";
import { toBlogDTO } from "../blog.types";

const makeDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => "id1" },
    slug: "s",
    title: "T",
    body: "B",
    isActive: true,
    images: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  }) as unknown as HydratedDocument<BlogDoc>;

describe("toBlogDTO", () => {
  it("defaults featured/related and omits empty optionals", () => {
    const dto = toBlogDTO(makeDoc());
    expect(dto).toMatchObject({ id: "id1", featured: false, related: [], images: [] });
    expect(dto).not.toHaveProperty("heroImage");
    expect(dto).not.toHaveProperty("imageUrls");
    expect(dto).not.toHaveProperty("archivedAt");
    expect(dto).not.toHaveProperty("description");
  });

  it("falls back to the external heroImage when nothing is uploaded", () => {
    expect(toBlogDTO(makeDoc({ heroImage: "https://ext/x.jpg" })).heroImage).toBe(
      "https://ext/x.jpg",
    );
  });

  it("prefers the primary uploaded image over the first and the external one", () => {
    const dto = toBlogDTO(
      makeDoc({
        heroImage: "https://ext/x.jpg",
        images: [
          { path: "a", url: "https://cdn/a.jpg" },
          { path: "b", url: "https://cdn/b.jpg", isPrimary: true },
        ],
      }),
    );
    expect(dto.heroImage).toBe("https://cdn/b.jpg");
    expect(dto.imageUrls).toEqual(["https://cdn/a.jpg", "https://cdn/b.jpg"]);
  });

  it("uses the first image when none is primary", () => {
    const dto = toBlogDTO(makeDoc({ images: [{ path: "a", url: "https://cdn/a.jpg" }] }));
    expect(dto.heroImage).toBe("https://cdn/a.jpg");
  });

  it("copies archivedAt and optional text fields when set", () => {
    const archivedAt = new Date();
    const dto = toBlogDTO(makeDoc({ archivedAt, description: "d", category: "c", excerpt: "e" }));
    expect(dto).toMatchObject({ archivedAt, description: "d", category: "c", excerpt: "e" });
  });
});
