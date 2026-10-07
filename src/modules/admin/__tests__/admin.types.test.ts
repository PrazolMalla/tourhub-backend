import { Types, type HydratedDocument } from "mongoose";
import { ADMIN_ROLES as MODEL_ADMIN_ROLES, AdminModel, type AdminDoc } from "../admin.model";
import { ADMIN_ROLES, toAdminDTO } from "../admin.types";

const ID = "507f1f77bcf86cd799439011";
const BANNER_ID = "507f1f77bcf86cd799439022";
const CREATED = new Date("2026-01-01T00:00:00.000Z");
const UPDATED = new Date("2026-01-02T00:00:00.000Z");

const makeDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: new Types.ObjectId(ID),
    email: "admin@example.com",
    role: "admin",
    isActive: true,
    isBanned: false,
    createdAt: CREATED,
    updatedAt: UPDATED,
    ...overrides,
  }) as unknown as HydratedDocument<AdminDoc>;

describe("ADMIN_ROLES", () => {
  it("lists superadmin and admin", () => {
    expect(ADMIN_ROLES).toEqual(["superadmin", "admin"]);
  });

  it("is the same list the model exports", () => {
    expect(ADMIN_ROLES).toBe(MODEL_ADMIN_ROLES);
  });

  it("stays in sync with the schema enum", () => {
    const enumValues = (AdminModel.schema.path("role") as unknown as { enumValues: string[] })
      .enumValues;
    expect([...enumValues].sort()).toEqual([...ADMIN_ROLES].sort());
  });
});

describe("toAdminDTO", () => {
  it("maps the required fields and stringifies _id", () => {
    expect(toAdminDTO(makeDoc())).toEqual({
      id: ID,
      email: "admin@example.com",
      role: "admin",
      isActive: true,
      isBanned: false,
      createdAt: CREATED,
      updatedAt: UPDATED,
    });
  });

  it("omits every optional field when absent", () => {
    const dto = toAdminDTO(makeDoc());
    for (const key of ["name", "phone", "bannedReason", "bannedBy", "bannedAt", "lastLoginAt"]) {
      expect(dto).not.toHaveProperty(key);
    }
  });

  it("includes optional profile fields when present", () => {
    const lastLoginAt = new Date("2026-03-01T10:00:00.000Z");
    const dto = toAdminDTO(makeDoc({ name: "Ram", phone: "9800000000", lastLoginAt }));
    expect(dto).toMatchObject({ name: "Ram", phone: "9800000000", lastLoginAt });
  });

  it("includes ban details and stringifies bannedBy", () => {
    const bannedAt = new Date("2026-02-01T00:00:00.000Z");
    const dto = toAdminDTO(
      makeDoc({
        isBanned: true,
        bannedReason: "abuse",
        bannedBy: new Types.ObjectId(BANNER_ID),
        bannedAt,
      }),
    );
    expect(dto).toMatchObject({
      isBanned: true,
      bannedReason: "abuse",
      bannedBy: BANNER_ID,
      bannedAt,
    });
    expect(typeof dto.bannedBy).toBe("string");
  });

  it("omits ban details that were cleared to null on unban", () => {
    // AdminRepository.setBanned(false) writes nulls, not $unset.
    const dto = toAdminDTO(makeDoc({ bannedReason: null, bannedBy: null, bannedAt: null }));
    expect(dto).not.toHaveProperty("bannedReason");
    expect(dto).not.toHaveProperty("bannedBy");
    expect(dto).not.toHaveProperty("bannedAt");
  });

  it("omits name, phone and lastLoginAt when stored as null", () => {
    const dto = toAdminDTO(makeDoc({ name: null, phone: null, lastLoginAt: null }));
    expect(dto).not.toHaveProperty("name");
    expect(dto).not.toHaveProperty("phone");
    expect(dto).not.toHaveProperty("lastLoginAt");
  });

  it("keeps empty-string name and phone (only null/undefined are dropped)", () => {
    const dto = toAdminDTO(makeDoc({ name: "", phone: "" }));
    expect(dto).toMatchObject({ name: "", phone: "" });
  });

  it("never leaks secrets or internal fields", () => {
    const dto = toAdminDTO(
      makeDoc({
        password: "hash",
        resetOtp: "otp-hash",
        otpExpiry: new Date(),
        googleId: "google-sub",
        lastLoginIp: "1.2.3.4",
      }),
    );
    for (const key of ["password", "resetOtp", "otpExpiry", "googleId", "lastLoginIp", "_id"]) {
      expect(dto).not.toHaveProperty(key);
    }
  });

  it("works on a real hydrated document", () => {
    const doc = new AdminModel({ email: "Real@Example.com", name: "Sita" });
    const dto = toAdminDTO(doc);
    expect(dto.id).toBe(doc._id.toString());
    expect(dto).toMatchObject({
      email: "real@example.com",
      name: "Sita",
      role: "admin",
      isActive: true,
      isBanned: false,
    });
  });
});
