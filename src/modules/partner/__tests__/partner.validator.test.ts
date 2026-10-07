import { PartnerValidator as V } from "../partner.validator";

describe("PartnerValidator", () => {
  it("create requires a name and rejects unknown keys", () => {
    expect(V.create.safeParse({ name: "Acme" }).success).toBe(true);
    expect(V.create.safeParse({ name: " " }).success).toBe(false);
    expect(V.create.safeParse({ name: "Acme", logoPath: "x" }).success).toBe(false);
  });

  it.each(["https://acme.com", "http://acme.com/x", "/partners/acme", ""])(
    "accepts url %p",
    (url) => {
      expect(V.create.safeParse({ name: "Acme", url }).success).toBe(true);
    },
  );

  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.com", "acme.com"])(
    "rejects unsafe url %p on create and update",
    (url) => {
      expect(V.create.safeParse({ name: "Acme", url }).success).toBe(false);
      expect(V.update.safeParse({ url }).success).toBe(false);
      expect(V.update.safeParse({ logoUrl: url }).success).toBe(false);
    },
  );

  it("update needs at least one field", () => {
    expect(V.update.safeParse({}).success).toBe(false);
    expect(V.update.safeParse({ sortOrder: 2 }).success).toBe(true);
    expect(V.update.safeParse({ sortOrder: 1.5 }).success).toBe(false);
  });

  it("validates id params", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "nope" }).success).toBe(false);
  });
});
