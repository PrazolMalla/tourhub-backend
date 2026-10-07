import { SeoService } from "../seo.service";
import type { SeoRepository } from "../seo.repository";
import { toSeoDTO } from "../seo.types";
import { NotFoundError } from "../../../core/errors";

jest.mock("../../../core/utils/uploads", () => ({ hardDeleteFile: jest.fn() }));
import { hardDeleteFile } from "../../../core/utils/uploads";

const del = hardDeleteFile as jest.Mock;
const OID = "507f1f77bcf86cd799439099";
const robots = {
  index: true,
  follow: true,
  noArchive: false,
  noImageIndex: false,
  noSnippet: false,
};

const makeDoc = (o: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => "s1" },
    entityType: "trip",
    entityId: OID,
    keywords: [],
    robots,
    twitterCard: "summary_large_image",
    structuredDataEnabled: true,
    openInNewTab: false,
    archivedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...o,
  }) as never;

const makeRepo = () => ({
  findByEntity: jest.fn(),
  listByEntityType: jest.fn().mockResolvedValue([]),
  upsertByEntity: jest.fn(),
  setImage: jest.fn(),
  updateImageAlt: jest.fn(),
  deleteByEntity: jest.fn(),
});

describe("SeoService (listing, clearing, images)", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SeoService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new SeoService(repo as unknown as SeoRepository);
  });

  it("listPublicByEntityType drops archived records", async () => {
    repo.listByEntityType.mockResolvedValue([
      makeDoc(),
      makeDoc({ _id: { toString: () => "s2" }, archivedAt: new Date() }),
    ]);
    const res = await service.listPublicByEntityType("trip");
    expect(repo.listByEntityType).toHaveBeenCalledWith("trip");
    expect(res.map((d) => d.id)).toEqual(["s1"]);
  });

  it("admin reads include archived and fall back to an empty shape", async () => {
    repo.listByEntityType.mockResolvedValue([makeDoc({ archivedAt: new Date() })]);
    expect(await service.listAdmin()).toHaveLength(1);
    repo.findByEntity.mockResolvedValueOnce(null).mockResolvedValueOnce(makeDoc());
    await expect(service.getAdmin("blog", OID)).resolves.toMatchObject({ id: "default" });
    await expect(service.getAdmin("trip", OID)).resolves.toMatchObject({ id: "s1" });
  });

  describe("upsert", () => {
    it("writes null for cleared fields so they are actually removed", async () => {
      repo.findByEntity.mockResolvedValue(makeDoc({ metaTitle: "Old" }));
      repo.upsertByEntity.mockResolvedValue(makeDoc({ metaTitle: null, canonicalUrl: null }));
      const dto = await service.upsert("trip", OID, { metaTitle: null, canonicalUrl: null });
      expect(repo.upsertByEntity).toHaveBeenCalledWith("trip", OID, {
        metaTitle: null,
        canonicalUrl: null,
      });
      expect(dto).not.toHaveProperty("metaTitle");
      expect(dto).not.toHaveProperty("canonicalUrl");
    });

    it("merges partial robots onto defaults when no record exists", async () => {
      repo.findByEntity.mockResolvedValue(null);
      repo.upsertByEntity.mockResolvedValue(makeDoc());
      await service.upsert("static_page", "home", { robots: { index: false } });
      expect(repo.upsertByEntity.mock.calls[0][2].robots).toEqual({ ...robots, index: false });
    });

    it("forwards every supported field", async () => {
      repo.findByEntity.mockResolvedValue(null);
      repo.upsertByEntity.mockResolvedValue(makeDoc());
      const input = {
        metaTitle: "T",
        metaDescription: "D",
        keywords: ["k"],
        canonicalUrl: "https://x.com",
        ogTitle: "OT",
        ogDescription: "OD",
        twitterCard: "summary" as const,
        twitterTitle: "TT",
        twitterDescription: "TD",
        structuredDataEnabled: false,
        openInNewTab: true,
      };
      await service.upsert("trip", OID, input);
      expect(repo.upsertByEntity).toHaveBeenCalledWith("trip", OID, input);
    });
  });

  describe.each([
    ["og", "ogImage", "setOgImage", "removeOgImage", "updateOgImageAlt", "No OG image"],
    [
      "twitter",
      "twitterImage",
      "setTwitterImage",
      "removeTwitterImage",
      "updateTwitterImageAlt",
      "No Twitter image",
    ],
  ] as const)("%s image", (_label, field, setFn, removeFn, altFn, noImageMsg) => {
    const img = { url: "https://cdn/n.jpg", path: "seo/new" };

    it("set replaces (and deletes) the previous asset", async () => {
      repo.findByEntity.mockResolvedValue(makeDoc({ [field]: { url: "u", path: "seo/old" } }));
      repo.setImage.mockResolvedValue(makeDoc({ [field]: img }));
      const dto = await service[setFn]("trip", OID, img);
      expect(del).toHaveBeenCalledWith("seo/old");
      expect(repo.setImage).toHaveBeenCalledWith("trip", OID, field, img);
      expect(dto[field]).toEqual(img);
    });

    it("set without a previous image deletes nothing; 404 if the write returns nothing", async () => {
      repo.findByEntity.mockResolvedValue(null);
      repo.setImage.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await service[setFn]("trip", OID, img);
      expect(del).not.toHaveBeenCalled();
      await expect(service[setFn]("trip", OID, img)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("remove deletes the asset and unsets the field", async () => {
      repo.findByEntity.mockResolvedValue(makeDoc({ [field]: { url: "u", path: "seo/old" } }));
      repo.setImage.mockResolvedValue(makeDoc());
      await service[removeFn]("trip", OID);
      expect(del).toHaveBeenCalledWith("seo/old");
      expect(repo.setImage).toHaveBeenCalledWith("trip", OID, field, null);
    });

    it("remove 404s without a record", async () => {
      repo.findByEntity.mockResolvedValue(null);
      await expect(service[removeFn]("trip", OID)).rejects.toBeInstanceOf(NotFoundError);
      repo.findByEntity.mockResolvedValue(makeDoc());
      repo.setImage.mockResolvedValue(null);
      await expect(service[removeFn]("trip", OID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("alt distinguishes a missing record from a missing image", async () => {
      repo.updateImageAlt
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(makeDoc());
      await expect(service[altFn]("trip", OID, "a")).rejects.toThrow("SEO record not found");
      await expect(service[altFn]("trip", OID, "a")).rejects.toThrow(noImageMsg);
      await expect(service[altFn]("trip", OID, "a")).resolves.toMatchObject({ id: "s1" });
      expect(repo.updateImageAlt).toHaveBeenCalledWith("trip", OID, field, "a");
    });
  });

  it("toSeoDTO treats null (cleared) fields as unset", () => {
    const dto = toSeoDTO(
      makeDoc({ metaTitle: null, ogImage: null, twitterDescription: null, ogTitle: "Kept" }),
    );
    expect(dto).not.toHaveProperty("metaTitle");
    expect(dto).not.toHaveProperty("ogImage");
    expect(dto).not.toHaveProperty("twitterDescription");
    expect(dto.ogTitle).toBe("Kept");
    expect(dto.robotsString).toBe("index,follow");
  });
});
