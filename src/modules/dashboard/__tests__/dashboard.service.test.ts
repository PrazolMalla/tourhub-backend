interface Chain {
  sort: jest.Mock;
  limit: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
}

const chain = (result: unknown): Chain => {
  const q: Chain = {
    sort: jest.fn(() => q),
    limit: jest.fn(() => q),
    select: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return q;
};

const modelMock = () => ({
  countDocuments: jest.fn(),
  estimatedDocumentCount: jest.fn(),
  aggregate: jest.fn(),
  find: jest.fn(),
});

jest.mock("../../trip/trip.model", () => ({ TripModel: modelMock() }));
jest.mock("../../enquiry/enquiry.model", () => ({ EnquiryModel: modelMock() }));
jest.mock("../../blog/blog.model", () => ({ BlogModel: modelMock() }));
jest.mock("../../testimonial/testimonial.model", () => ({ TestimonialModel: modelMock() }));
jest.mock("../../partner/partner.model", () => ({ PartnerModel: modelMock() }));
jest.mock("../../region/region.model", () => ({ RegionModel: modelMock() }));
jest.mock("../../user/user.model", () => ({ UserModel: modelMock() }));
jest.mock("../../admin/admin.model", () => ({ AdminModel: modelMock() }));
jest.mock("../../banner/banner.model", () => ({ BannerModel: modelMock() }));

import { DashboardService } from "../dashboard.service";
import { TripModel } from "../../trip/trip.model";
import { EnquiryModel } from "../../enquiry/enquiry.model";
import { BlogModel } from "../../blog/blog.model";
import { TestimonialModel } from "../../testimonial/testimonial.model";
import { PartnerModel } from "../../partner/partner.model";
import { RegionModel } from "../../region/region.model";
import { UserModel } from "../../user/user.model";
import { AdminModel } from "../../admin/admin.model";
import { BannerModel } from "../../banner/banner.model";

type M = ReturnType<typeof modelMock>;
const m = (x: unknown) => x as unknown as M;
const NOW = new Date("2026-06-30T00:00:00.000Z");

/** Answer countDocuments by matching the filter shape. */
const countBy = (model: M, table: Array<[Record<string, unknown>, number]>, fallback = 0) =>
  model.countDocuments.mockImplementation((filter: Record<string, unknown>) => {
    const hit = table.find(([f]) => JSON.stringify(f) === JSON.stringify(filter));
    return Promise.resolve(hit ? hit[1] : fallback);
  });

describe("DashboardService.summary", () => {
  const service = new DashboardService();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    for (const model of [
      TripModel,
      EnquiryModel,
      BlogModel,
      TestimonialModel,
      PartnerModel,
      RegionModel,
      UserModel,
      AdminModel,
      BannerModel,
    ]) {
      const mm = m(model);
      mm.countDocuments.mockReset().mockResolvedValue(0);
      mm.estimatedDocumentCount.mockReset().mockResolvedValue(0);
      mm.aggregate.mockReset().mockResolvedValue([]);
      mm.find.mockReset().mockImplementation(() => chain([]));
    }
  });

  afterEach(() => jest.useRealTimers());

  it("assembles every section from the model counts", async () => {
    countBy(m(EnquiryModel), [
      [{}, 50],
      [{ isRead: false }, 4],
    ]);
    m(EnquiryModel)
      .aggregate.mockResolvedValueOnce([
        { _id: "new", count: 3 },
        { _id: "closed", count: 47 },
      ])
      .mockResolvedValueOnce([
        { _id: "contact", count: 40 },
        { _id: null, count: 10 },
      ]);
    m(EnquiryModel).find.mockImplementation(() =>
      chain([
        {
          _id: "e1",
          name: "Ram",
          email: "r@x.com",
          trip: "EBC",
          source: "contact",
          status: "new",
          isRead: false,
          createdAt: NOW,
        },
        { _id: "e2", source: "trip", status: "new", isRead: true, createdAt: NOW },
      ]),
    );
    countBy(m(TripModel), [
      [{}, 20],
      [{ archivedAt: null, isActive: true }, 15],
      [{ archivedAt: { $ne: null } }, 3],
      [{ archivedAt: null, isFeatured: true }, 5],
    ]);
    m(TripModel)
      .aggregate.mockResolvedValueOnce([
        { _id: "trek", count: 12 },
        { _id: "tour", count: 8 },
      ])
      .mockResolvedValueOnce([{ _id: "everest", count: 7 }]);
    countBy(m(BlogModel), [
      [{}, 9],
      [{ archivedAt: null, isActive: true }, 6],
      [{ archivedAt: null, featured: true }, 2],
    ]);
    countBy(m(TestimonialModel), [
      [{}, 8],
      [{ archivedAt: null, isActive: true }, 7],
    ]);
    countBy(m(PartnerModel), [
      [{}, 4],
      [{ archivedAt: null, isActive: true }, 3],
    ]);
    countBy(m(RegionModel), [
      [{}, 6],
      [{ archivedAt: null, isActive: true }, 6],
    ]);
    m(UserModel).estimatedDocumentCount.mockResolvedValue(100);
    countBy(
      m(UserModel),
      [
        [{ isActive: true, isBanned: false }, 90],
        [{ isBanned: true }, 2],
      ],
      11,
    );
    m(UserModel).find.mockImplementation(() =>
      chain([{ _id: "u1", email: "u@x.com", createdAt: NOW }]),
    );
    m(AdminModel).estimatedDocumentCount.mockResolvedValue(3);
    countBy(m(AdminModel), [
      [{ role: "superadmin" }, 1],
      [{ role: "admin" }, 2],
      [{ isActive: true, isBanned: false }, 3],
    ]);
    countBy(m(BannerModel), [
      [{}, 5],
      [{ isActive: true }, 4],
    ]);
    m(BannerModel).aggregate.mockResolvedValue([{ _id: "landing", count: 5 }]);

    const res = await service.summary("30d");

    expect(res.range).toBe("30d");
    expect(res.generatedAt).toBe(NOW.toISOString());
    expect(res.enquiries).toMatchObject({
      total: 50,
      unread: 4,
      statusCounts: { new: 3, closed: 47 },
      bySource: { contact: 40 },
    });
    expect(res.enquiries.recent).toEqual([
      {
        id: "e1",
        name: "Ram",
        email: "r@x.com",
        trip: "EBC",
        source: "contact",
        status: "new",
        isRead: false,
        createdAt: NOW.toISOString(),
      },
      {
        id: "e2",
        name: "",
        email: "",
        trip: "",
        source: "trip",
        status: "new",
        isRead: true,
        createdAt: NOW.toISOString(),
      },
    ]);
    expect(res.trips).toEqual({
      total: 20,
      active: 15,
      archived: 3,
      featured: 5,
      byKind: { trek: 12, tour: 8 },
      byRegion: { everest: 7 },
    });
    expect(res.blog).toEqual({ total: 9, published: 6, featured: 2 });
    expect(res.testimonials).toEqual({ total: 8, active: 7 });
    expect(res.partners).toEqual({ total: 4, active: 3 });
    expect(res.regions).toEqual({ total: 6, active: 6 });
    expect(res.customers).toEqual({
      total: 100,
      active: 90,
      banned: 2,
      inRange: 11,
      recent: [{ id: "u1", name: "", email: "u@x.com", createdAt: NOW.toISOString() }],
    });
    expect(res.admins).toEqual({ total: 3, superadmins: 1, admins: 2, active: 3 });
    expect(res.banners).toEqual({ total: 5, active: 4, bySection: { landing: 5 } });
  });

  it("drops null group keys from count maps", async () => {
    m(BannerModel).aggregate.mockResolvedValue([
      { _id: null, count: 2 },
      { _id: "", count: 1 },
      { _id: "about", count: 3 },
    ]);
    const res = await service.summary("all");
    expect(res.banners.bySection).toEqual({ about: 3 });
  });

  it.each([
    ["7d", "2026-06-23"],
    ["30d", "2026-05-31"],
    ["90d", "2026-04-01"],
  ] as const)("range %s counts enquiries/customers since %s", async (range, day) => {
    await service.summary(range);
    const enquiryFilters = m(EnquiryModel).countDocuments.mock.calls.map((c) => c[0]);
    const since = enquiryFilters.find((f) => f.createdAt)?.createdAt.$gte as Date;
    expect(since.toISOString().slice(0, 10)).toBe(day);
    const userFilters = m(UserModel).countDocuments.mock.calls.map((c) => c[0]);
    expect(userFilters.some((f) => f.createdAt?.$gte?.getTime() === since.getTime())).toBe(true);
  });

  it("range all uses no date filter and the estimated customer count", async () => {
    m(UserModel).estimatedDocumentCount.mockResolvedValue(42);
    const res = await service.summary("all");
    const enquiryFilters = m(EnquiryModel).countDocuments.mock.calls.map((c) => c[0]);
    expect(enquiryFilters.every((f) => !("createdAt" in f))).toBe(true);
    expect(res.customers.inRange).toBe(42);
  });

  it("defaults to 30d", async () => {
    expect((await service.summary()).range).toBe("30d");
  });
});
