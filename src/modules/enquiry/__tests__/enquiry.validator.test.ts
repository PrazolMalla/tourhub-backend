import { EnquiryValidator as V } from "../enquiry.validator";

describe("EnquiryValidator", () => {
  describe("create", () => {
    it.each([{ name: "Sita" }, { email: "a@b.com" }, { phone: "9800000000" }])(
      "accepts %p with a source",
      (contact) => {
        expect(V.create.safeParse({ ...contact, source: "contact" }).success).toBe(true);
      },
    );

    it("requires at least one contact field", () => {
      expect(V.create.safeParse({ source: "contact", message: "hi" }).success).toBe(false);
      expect(V.create.safeParse({ source: "contact", name: "   ", email: "" }).success).toBe(false);
    });

    it("requires a source", () => {
      expect(V.create.safeParse({ name: "x" }).success).toBe(false);
      expect(V.create.safeParse({ name: "x", source: " " }).success).toBe(false);
    });

    it("allows a blank email but not an invalid one", () => {
      expect(V.create.safeParse({ name: "x", email: "", source: "c" }).success).toBe(true);
      expect(V.create.safeParse({ name: "x", email: "nope", source: "c" }).success).toBe(false);
    });

    it("rejects internal fields a public caller must not set", () => {
      for (const extra of [{ status: "converted" }, { isRead: true }, { adminNotes: "x" }]) {
        expect(V.create.safeParse({ name: "x", source: "c", ...extra }).success).toBe(false);
      }
    });

    it("caps message length", () => {
      expect(
        V.create.safeParse({ name: "x", source: "c", message: "a".repeat(5001) }).success,
      ).toBe(false);
    });
  });

  describe("update", () => {
    it("rejects an empty body and unknown status", () => {
      expect(V.update.safeParse({}).success).toBe(false);
      expect(V.update.safeParse({ status: "archived" }).success).toBe(false);
    });

    it.each(["new", "contacted", "converted", "closed", "spam"])("accepts status %s", (status) => {
      expect(V.update.safeParse({ status }).success).toBe(true);
    });

    it.each([
      [true, true],
      [false, false],
      ["true", true],
      ["false", false],
    ])("isRead %p parses to %p", (input, expected) => {
      expect(V.update.parse({ isRead: input }).isRead).toBe(expected);
    });

    it("rejects a blank newNote", () => {
      expect(V.update.safeParse({ newNote: "  " }).success).toBe(false);
    });
  });

  it("validates id params", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "1" }).success).toBe(false);
  });
});
