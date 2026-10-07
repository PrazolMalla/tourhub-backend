import type { HydratedDocument } from "mongoose";
import { TripModel, type TripDoc } from "../trip.model";
import { TripRepository } from "../trip.repository";
import { toTripDTO } from "../trip.types";

const makeDoc = (o: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => "t1" },
    title: "T",
    slug: "t",
    kind: "trek",
    region: "everest",
    days: 5,
    isActive: true,
    isFeatured: false,
    images: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...o,
  }) as unknown as HydratedDocument<TripDoc>;

describe("toTripDTO", () => {
  it("defaults country to nepal and cats to []", () => {
    expect(toTripDTO(makeDoc())).toMatchObject({ country: "nepal", cats: [] });
  });

  it("falls back to external img and gallery without uploads", () => {
    const dto = toTripDTO(makeDoc({ img: "https://ext/a.jpg", gallery: ["g1"] }));
    expect(dto).toMatchObject({ img: "https://ext/a.jpg", gallery: ["g1"] });
    expect(dto).not.toHaveProperty("imageUrls");
    expect(dto).not.toHaveProperty("primaryImageUrl");
  });

  it("uploaded images override img/gallery; primary wins", () => {
    const dto = toTripDTO(
      makeDoc({
        img: "https://ext/a.jpg",
        gallery: ["g1"],
        images: [
          { path: "a", url: "ua" },
          { path: "b", url: "ub", isPrimary: true },
        ],
      }),
    );
    expect(dto).toMatchObject({
      img: "ub",
      primaryImageUrl: "ub",
      imageUrls: ["ua", "ub"],
      gallery: ["ua", "ub"],
    });
  });

  it("copies optional content fields and archivedAt", () => {
    const archivedAt = new Date();
    const dto = toTripDTO(
      makeDoc({ price: "1,390", itin: [{ d: "Day 1", t: "Fly" }], archivedAt, videoUrl: "v" }),
    );
    expect(dto).toMatchObject({ price: "1,390", itin: [{ d: "Day 1", t: "Fly" }], archivedAt });
  });
});

describe("TripRepository", () => {
  const repo = new TripRepository();
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [0, "d1"],
    [4, "d2"],
    [8, "d3"],
    ["other", "other"],
    [99, "other"],
  ] as const)("durationBucketKey(%p) = %s", (b, key) => {
    expect(TripRepository.durationBucketKey(b)).toBe(key);
  });

  it("aggregateFacets builds the faceted pipeline", async () => {
    const spy = jest.spyOn(TripModel, "aggregate").mockResolvedValue([] as never);
    await repo.aggregateFacets({
      base: { archivedAt: null },
      priceMatch: { _priceNum: { $lte: 1000 } },
      regionMatch: { region: "everest" },
      durationMatch: { days: { $gte: 4 } },
      sort: { _priceNum: 1 },
      skip: 10,
      limit: 5,
    });
    const pipeline = spy.mock.calls[0]![0] as unknown as Array<Record<string, any>>;
    expect(pipeline[0]).toEqual({ $match: { archivedAt: null } });
    expect(pipeline[1]!.$addFields._priceNum.$convert.to).toBe("double");
    expect(pipeline[2]).toEqual({ $match: { _priceNum: { $lte: 1000 } } });
    const facet = pipeline[3]!.$facet;
    expect(facet.data).toEqual([
      { $match: { region: "everest", days: { $gte: 4 } } },
      { $sort: { _priceNum: 1 } },
      { $skip: 10 },
      { $limit: 5 },
    ]);
    // Each facet excludes its own dimension.
    expect(facet.regionFacet[0]).toEqual({ $match: { days: { $gte: 4 } } });
    expect(facet.durationFacet[0]).toEqual({ $match: { region: "everest" } });
  });

  it("omits the price $match stage when no price filter is set", async () => {
    const spy = jest.spyOn(TripModel, "aggregate").mockResolvedValue([] as never);
    await repo.aggregateFacets({
      base: {},
      priceMatch: {},
      regionMatch: {},
      durationMatch: {},
      sort: { createdAt: -1 },
      skip: 0,
      limit: 10,
    });
    const pipeline = spy.mock.calls[0]![0] as unknown as Array<Record<string, unknown>>;
    expect(pipeline).toHaveLength(3);
    expect(pipeline[2]).toHaveProperty("$facet");
  });

  describe("image helpers (on hydrated docs)", () => {
    const hydrated = () => {
      const doc = TripModel.hydrate({
        _id: "507f1f77bcf86cd799439011",
        title: "T",
        slug: "t",
        kind: "trek",
        region: "r",
        days: 1,
        images: [
          { path: "a", url: "ua" },
          { path: "b", url: "ub", isPrimary: true },
          { path: "c", url: "uc" },
        ],
      });
      jest.spyOn(doc, "save").mockResolvedValue(doc);
      jest.spyOn(TripModel, "findById").mockResolvedValue(doc as never);
      return doc;
    };

    it("reorderImages applies the order, keeps unlisted images, and makes the first primary", async () => {
      const doc = hydrated();
      await repo.reorderImages("id", ["c", "a", "zzz"]);
      expect(doc.images.map((i) => [i.path, i.isPrimary])).toEqual([
        ["c", true],
        ["a", false],
        ["b", false],
      ]);
      expect(doc.save).toHaveBeenCalled();
    });

    it("setPrimaryImage flags exactly one image", async () => {
      const doc = hydrated();
      await repo.setPrimaryImage("id", "c");
      expect(doc.images.map((i) => i.isPrimary)).toEqual([false, false, true]);
      expect(doc.images.map((i) => i.url)).toEqual(["ua", "ub", "uc"]);
    });

    it("updateImageAlt returns undefined for an unknown path, null for a missing trip", async () => {
      const doc = hydrated();
      await expect(repo.updateImageAlt("id", "zzz", "x")).resolves.toBeUndefined();
      await repo.updateImageAlt("id", "b", "Alt B");
      expect(doc.images[1]?.alt).toBe("Alt B");
      jest.spyOn(TripModel, "findById").mockResolvedValue(null as never);
      await expect(repo.updateImageAlt("id", "b", "x")).resolves.toBeNull();
      await expect(repo.setPrimaryImage("id", "b")).resolves.toBeNull();
      await expect(repo.reorderImages("id", [])).resolves.toBeNull();
    });
  });
});
