import { TestimonialValidator as V } from "../testimonial.validator";

const base = { name: "Anna", quote: "Great trek" };

describe("TestimonialValidator", () => {
  it("create requires name and quote", () => {
    expect(V.create.safeParse(base).success).toBe(true);
    expect(V.create.safeParse({ name: "Anna" }).success).toBe(false);
    expect(V.create.safeParse({ quote: "q" }).success).toBe(false);
  });

  it("rating is coerced and bounded 1..5", () => {
    expect(V.create.parse({ ...base, rating: "4" }).rating).toBe(4);
    expect(V.create.safeParse({ ...base, rating: 0 }).success).toBe(false);
    expect(V.create.safeParse({ ...base, rating: 6 }).success).toBe(false);
  });

  it("source is limited to known platforms", () => {
    expect(V.create.safeParse({ ...base, source: "trip advisor" }).success).toBe(true);
    expect(V.create.safeParse({ ...base, source: "facebook" }).success).toBe(false);
  });

  it.each(["https://youtube.com/embed/x", "/uploads/v.mp4", ""])(
    "accepts videoUrl %p",
    (videoUrl) => {
      expect(V.create.safeParse({ ...base, videoUrl }).success).toBe(true);
    },
  );

  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.com"])(
    "rejects unsafe media url %p",
    (url) => {
      expect(V.create.safeParse({ ...base, videoUrl: url }).success).toBe(false);
      expect(V.create.safeParse({ ...base, avatarUrl: url }).success).toBe(false);
      expect(V.update.safeParse({ videoUrl: url }).success).toBe(false);
    },
  );

  it("update needs one field and rejects internal fields", () => {
    expect(V.update.safeParse({}).success).toBe(false);
    expect(V.update.safeParse({ isFeatured: true }).success).toBe(true);
    expect(V.update.safeParse({ videoPublicId: "x" }).success).toBe(false);
  });

  it("validates id params", () => {
    expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    expect(V.idParam.safeParse({ id: "x" }).success).toBe(false);
  });
});
