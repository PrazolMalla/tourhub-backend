import { SeoService } from "../seo.service";
import type { SeoRepository } from "../seo.repository";
import { NotFoundError } from "../../../core/errors";
import { computeRobotsString, computeSeoScore } from "../seo.types";
import type { SeoDoc } from "../seo.model";

jest.mock("../../../core/utils/uploads", () => ({
  hardDeleteFile: jest.fn().mockResolvedValue(true),
  fileToRecord: jest.fn(),
}));

const makeDoc = (overrides: Partial<SeoDoc> & { _id?: unknown } = {}) => ({
  _id: { toString: () => "507f1f77bcf86cd799439011" },
  entityType: "trip" as const,
  entityId: "507f1f77bcf86cd799439099",
  keywords: [],
  robots: { index: true, follow: true, noArchive: false, noImageIndex: false, noSnippet: false },
  twitterCard: "summary_large_image" as const,
  structuredDataEnabled: true,
  archivedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeRepo = () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  findByEntity: jest.fn(),
  listByEntityType: jest.fn(),
  upsertByEntity: jest.fn(),
  setImage: jest.fn(),
  deleteByEntity: jest.fn(),
});

describe("computeRobotsString", () => {
  it("builds index,follow for the default toggles", () => {
    expect(
      computeRobotsString({
        index: true,
        follow: true,
        noArchive: false,
        noImageIndex: false,
        noSnippet: false,
      }),
    ).toBe("index,follow");
  });

  it("builds noindex,nofollow plus advanced directives", () => {
    expect(
      computeRobotsString({
        index: false,
        follow: false,
        noArchive: true,
        noImageIndex: true,
        noSnippet: true,
      }),
    ).toBe("noindex,nofollow,noarchive,noimageindex,nosnippet");
  });
});

describe("computeSeoScore", () => {
  it("is 0 for a fully empty record", () => {
    expect(computeSeoScore(makeDoc({ structuredDataEnabled: false }) as unknown as SeoDoc)).toBe(0);
  });

  it("increases as recommended fields are filled in", () => {
    const empty = computeSeoScore(makeDoc({ structuredDataEnabled: false }) as unknown as SeoDoc);
    const filled = computeSeoScore(
      makeDoc({
        metaTitle: "A well sized trek title for Nepal",
        metaDescription:
          "A meta description sitting comfortably inside the 50-160 character recommended range for search engines.",
        canonicalUrl: "https://example.com/trek/everest",
        ogImage: { url: "https://example.com/img.jpg", alt: "Everest Base Camp trek" },
        ogTitle: "OG title",
        ogDescription: "OG description",
      }) as unknown as SeoDoc,
    );
    expect(filled).toBeGreaterThan(empty);
    expect(filled).toBe(100);
  });
});

describe("SeoService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SeoService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SeoService(repo as unknown as SeoRepository);
  });

  describe("getPublic", () => {
    it("returns a neutral, indexable default when no record exists", async () => {
      repo.findByEntity.mockResolvedValue(null);
      const dto = await service.getPublic("trip", "abc");
      expect(dto.robotsString).toBe("index,follow");
      expect(dto.metaTitle).toBeUndefined();
    });

    it("falls back to default when the record is archived", async () => {
      repo.findByEntity.mockResolvedValue(makeDoc({ archivedAt: new Date() }));
      const dto = await service.getPublic("trip", "abc");
      expect(dto.id).toBe("default");
    });

    it("returns the stored record when present and active", async () => {
      repo.findByEntity.mockResolvedValue(makeDoc({ metaTitle: "Everest Base Camp Trek" }));
      const dto = await service.getPublic("trip", "abc");
      expect(dto.metaTitle).toBe("Everest Base Camp Trek");
    });
  });

  describe("upsert", () => {
    it("merges partial robots onto existing values instead of overwriting", async () => {
      repo.findByEntity.mockResolvedValue(
        makeDoc({
          robots: {
            index: true,
            follow: false,
            noArchive: true,
            noImageIndex: false,
            noSnippet: false,
          },
        }),
      );
      repo.upsertByEntity.mockImplementation((_t, _id, update) => Promise.resolve(makeDoc(update)));

      await service.upsert("trip", "abc", { robots: { follow: true } });

      expect(repo.upsertByEntity).toHaveBeenCalledWith(
        "trip",
        "abc",
        expect.objectContaining({
          robots: {
            index: true,
            follow: true,
            noArchive: true,
            noImageIndex: false,
            noSnippet: false,
          },
        }),
      );
    });

    it("only forwards fields that were actually provided", async () => {
      repo.findByEntity.mockResolvedValue(null);
      repo.upsertByEntity.mockResolvedValue(makeDoc({ metaTitle: "Title" }));

      await service.upsert("trip", "abc", { metaTitle: "Title" });

      expect(repo.upsertByEntity).toHaveBeenCalledWith("trip", "abc", { metaTitle: "Title" });
    });
  });

  describe("delete", () => {
    it("throws NotFoundError when no record exists", async () => {
      repo.findByEntity.mockResolvedValue(null);
      await expect(service.delete("trip", "missing")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("removes uploaded images before deleting the record", async () => {
      const { hardDeleteFile } = jest.requireMock("../../../core/utils/uploads") as {
        hardDeleteFile: jest.Mock;
      };
      repo.findByEntity.mockResolvedValue(
        makeDoc({
          ogImage: { url: "u", path: "seo/og-1" },
          twitterImage: { url: "u2", path: "seo/tw-1" },
        }),
      );
      repo.deleteByEntity.mockResolvedValue(true);

      await service.delete("trip", "abc");

      expect(hardDeleteFile).toHaveBeenCalledWith("seo/og-1");
      expect(hardDeleteFile).toHaveBeenCalledWith("seo/tw-1");
      expect(repo.deleteByEntity).toHaveBeenCalledWith("trip", "abc");
    });
  });
});
