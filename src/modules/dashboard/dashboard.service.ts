import { TripModel } from "../trip/trip.model";
import { EnquiryModel } from "../enquiry/enquiry.model";
import { BlogModel } from "../blog/blog.model";
import { TestimonialModel } from "../testimonial/testimonial.model";
import { PartnerModel } from "../partner/partner.model";
import { RegionModel } from "../region/region.model";
import { UserModel } from "../user/user.model";
import { AdminModel } from "../admin/admin.model";
import { BannerModel } from "../banner/banner.model";
import { AppConstants } from "../../constants";

export type DashboardRange = "7d" | "30d" | "90d" | "all";

export interface DashboardSummary {
  range: DashboardRange;
  generatedAt: string;
  enquiries: {
    total: number;
    inRange: number;
    unread: number;
    statusCounts: Record<string, number>;
    bySource: Record<string, number>;
    recent: Array<{
      id: string;
      name: string;
      email: string;
      trip: string;
      source: string;
      status: string;
      isRead: boolean;
      createdAt: string;
    }>;
  };
  trips: {
    total: number;
    active: number;
    archived: number;
    featured: number;
    byKind: Record<string, number>;
    byRegion: Record<string, number>;
  };
  blog: {
    total: number;
    published: number;
    featured: number;
  };
  testimonials: { total: number; active: number };
  partners: { total: number; active: number };
  regions: { total: number; active: number };
  customers: {
    total: number;
    active: number;
    banned: number;
    inRange: number;
    recent: Array<{ id: string; name: string; email: string; createdAt: string }>;
  };
  admins: {
    total: number;
    superadmins: number;
    admins: number;
    active: number;
  };
  banners: {
    total: number;
    active: number;
    bySection: Record<string, number>;
  };
}

function rangeStart(range: DashboardRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function toCountMap(rows: Array<{ _id: string; count: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (r._id) out[r._id] = r.count;
  return out;
}

export class DashboardService {
  async summary(range: DashboardRange = "30d"): Promise<DashboardSummary> {
    const since = rangeStart(range);
    const sinceMatch = since ? { createdAt: { $gte: since } } : {};

    const [
      enquiryTotal,
      enquiriesInRange,
      enquiryUnread,
      enquiryStatusAgg,
      enquirySourceAgg,
      recentEnquiriesRaw,
      tripTotal,
      tripActive,
      tripArchived,
      tripFeatured,
      tripByKindAgg,
      tripByRegionAgg,
      blogTotal,
      blogPublished,
      blogFeatured,
      testimonialTotal,
      testimonialActive,
      partnerTotal,
      partnerActive,
      regionTotal,
      regionActive,
      customerTotal,
      customerActive,
      customerBanned,
      customersInRange,
      recentCustomers,
      adminTotal,
      adminSuper,
      adminAdmin,
      adminActive,
      bannerTotal,
      bannerActive,
      bannerBySectionAgg,
    ] = await Promise.all([
      EnquiryModel.countDocuments({}),
      EnquiryModel.countDocuments({ ...sinceMatch }),
      EnquiryModel.countDocuments({ isRead: false }),
      EnquiryModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      EnquiryModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      EnquiryModel.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      TripModel.countDocuments({}),
      TripModel.countDocuments({ archivedAt: null, isActive: true }),
      TripModel.countDocuments({ archivedAt: { $ne: null } }),
      TripModel.countDocuments({ archivedAt: null, isFeatured: true }),
      TripModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$kind", count: { $sum: 1 } } },
      ]),
      TripModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$region", count: { $sum: 1 } } },
      ]),
      BlogModel.countDocuments({}),
      BlogModel.countDocuments({ archivedAt: null, isActive: true }),
      BlogModel.countDocuments({ archivedAt: null, featured: true }),
      TestimonialModel.countDocuments({}),
      TestimonialModel.countDocuments({ archivedAt: null, isActive: true }),
      PartnerModel.countDocuments({}),
      PartnerModel.countDocuments({ archivedAt: null, isActive: true }),
      RegionModel.countDocuments({}),
      RegionModel.countDocuments({ archivedAt: null, isActive: true }),
      UserModel.estimatedDocumentCount(),
      UserModel.countDocuments({ isActive: true, isBanned: false }),
      UserModel.countDocuments({ isBanned: true }),
      since ? UserModel.countDocuments(sinceMatch) : UserModel.estimatedDocumentCount(),
      UserModel.find().sort({ createdAt: -1 }).limit(6).select("name email createdAt").lean(),
      AdminModel.estimatedDocumentCount(),
      AdminModel.countDocuments({ role: AppConstants.ROLE_SUPERADMIN }),
      AdminModel.countDocuments({ role: AppConstants.ROLE_ADMIN }),
      AdminModel.countDocuments({ isActive: true, isBanned: false }),
      BannerModel.countDocuments({}),
      BannerModel.countDocuments({ isActive: true }),
      BannerModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$section", count: { $sum: 1 } } },
      ]),
    ]);

    const recentEnquiries = recentEnquiriesRaw.map((e) => ({
      id: String(e._id),
      name: e.name ?? "",
      email: e.email ?? "",
      trip: e.trip ?? "",
      source: e.source,
      status: e.status,
      isRead: e.isRead,
      createdAt: new Date(e.createdAt).toISOString(),
    }));

    return {
      range,
      generatedAt: new Date().toISOString(),
      enquiries: {
        total: enquiryTotal,
        inRange: enquiriesInRange,
        unread: enquiryUnread,
        statusCounts: toCountMap(enquiryStatusAgg),
        bySource: toCountMap(enquirySourceAgg),
        recent: recentEnquiries,
      },
      trips: {
        total: tripTotal,
        active: tripActive,
        archived: tripArchived,
        featured: tripFeatured,
        byKind: toCountMap(tripByKindAgg),
        byRegion: toCountMap(tripByRegionAgg),
      },
      blog: {
        total: blogTotal,
        published: blogPublished,
        featured: blogFeatured,
      },
      testimonials: { total: testimonialTotal, active: testimonialActive },
      partners: { total: partnerTotal, active: partnerActive },
      regions: { total: regionTotal, active: regionActive },
      customers: {
        total: customerTotal,
        active: customerActive,
        banned: customerBanned,
        inRange: customersInRange,
        recent: recentCustomers.map((u) => ({
          id: String(u._id),
          name: u.name ?? "",
          email: u.email,
          createdAt: new Date(u.createdAt).toISOString(),
        })),
      },
      admins: {
        total: adminTotal,
        superadmins: adminSuper,
        admins: adminAdmin,
        active: adminActive,
      },
      banners: {
        total: bannerTotal,
        active: bannerActive,
        bySection: toCountMap(bannerBySectionAgg),
      },
    };
  }
}
