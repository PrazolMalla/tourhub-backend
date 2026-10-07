import { TeamMemberValidator as V } from "../team-member.validator";

const base = { name: "Pemba", role: "Guide", description: "Bio" };

describe("TeamMemberValidator", () => {
  it("create requires name, role and description; location is optional", () => {
    expect(V.create.safeParse(base).success).toBe(true);
    expect(V.create.safeParse({ ...base, location: "KTM" }).success).toBe(true);
    for (const key of ["name", "role", "description"] as const) {
      const { [key]: _omit, ...rest } = base;
      expect(V.create.safeParse(rest).success).toBe(false);
    }
  });

  it("rejects blank strings and unknown keys", () => {
    expect(V.create.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(V.create.safeParse({ ...base, location: "" }).success).toBe(false);
    expect(V.create.safeParse({ ...base, profilePhotoPublicId: "x" }).success).toBe(false);
  });

  it("update needs one field", () => {
    expect(V.update.safeParse({}).success).toBe(false);
    expect(V.update.safeParse({ role: "Porter" }).success).toBe(true);
  });

  it("validates id params", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "x" }).success).toBe(false);
  });
});
