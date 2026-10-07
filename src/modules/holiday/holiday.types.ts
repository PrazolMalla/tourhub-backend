import type { HydratedDocument } from "mongoose";
import type { HolidayDoc, HolidayFaq, HolidayImage } from "./holiday.model";
import { cloudinaryAutoUrl } from "../../core/utils/cloudinary.util";

/** camelCase DTO used by the admin panel. */
export interface Holiday {
  id: string;
  name: string;
  slug: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  bannerImage?: string;
  images: HolidayImage[];
  discountPercentage: number;
  isFeatured: boolean;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  recommendedTreks: string[];
  regions: string[];
  body: string[];
  faqs: HolidayFaq[];
  sortOrder: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHolidayInput {
  name: string;
  slug?: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
  bannerImage?: string;
  discountPercentage?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  recommendedTreks?: string[];
  regions?: string[];
  body?: string[];
  faqs?: HolidayFaq[];
  sortOrder?: number;
}

export type UpdateHolidayInput = Partial<CreateHolidayInput>;

const YMD = (d: Date): string => new Date(d).toISOString().slice(0, 10);

/** Derive the live banner: Cloudinary auto-format/quality URL of the primary
 *  uploaded image, else the external banner URL. */
const bannerOf = (doc: HydratedDocument<HolidayDoc>): string | undefined => {
  if (doc.images?.length) {
    const primary = doc.images.find((i) => i.isPrimary) ?? doc.images[0];
    if (primary) return cloudinaryAutoUrl(primary.path);
  }
  return doc.bannerImage;
};

/** Admin-facing DTO (camelCase). */
export const toHolidayDTO = (doc: HydratedDocument<HolidayDoc>): Holiday => {
  const dto: Holiday = {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    startDate: doc.startDate,
    endDate: doc.endDate,
    images: doc.images ?? [],
    discountPercentage: doc.discountPercentage ?? 0,
    isFeatured: doc.isFeatured,
    isActive: doc.isActive,
    seoKeywords: doc.seoKeywords ?? [],
    recommendedTreks: doc.recommendedTreks ?? [],
    regions: doc.regions ?? [],
    body: doc.body ?? [],
    faqs: doc.faqs ?? [],
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  const banner = bannerOf(doc);
  if (banner !== undefined) dto.bannerImage = banner;
  if (doc.description !== undefined) dto.description = doc.description;
  if (doc.seoTitle !== undefined) dto.seoTitle = doc.seoTitle;
  if (doc.seoDescription !== undefined) dto.seoDescription = doc.seoDescription;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};

/**
 * Public snake_case shape consumed by the landing site's `@/lib/cms`
 * (`ApiHoliday`). Kept snake_case to match the existing frontend contract.
 */
export interface PublicHoliday {
  id: string;
  holiday_name: string;
  slug: string;
  description: string;
  start_date: string;
  end_date: string;
  banner_image: string;
  discount_percentage: number;
  is_featured: boolean;
  is_active: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  recommended_treks: string[];
  regions: string[];
  body: string[];
  faqs: HolidayFaq[];
  created_at: string;
  updated_at: string;
}

export const toPublicHoliday = (doc: HydratedDocument<HolidayDoc>): PublicHoliday => ({
  id: doc._id.toString(),
  holiday_name: doc.name,
  slug: doc.slug,
  description: doc.description ?? "",
  start_date: YMD(doc.startDate),
  end_date: YMD(doc.endDate),
  banner_image: bannerOf(doc) ?? "",
  discount_percentage: doc.discountPercentage ?? 0,
  is_featured: Boolean(doc.isFeatured),
  is_active: Boolean(doc.isActive),
  seo_title: doc.seoTitle ?? doc.name,
  seo_description: doc.seoDescription ?? doc.description ?? "",
  seo_keywords: doc.seoKeywords ?? [],
  recommended_treks: doc.recommendedTreks ?? [],
  regions: doc.regions ?? [],
  body: doc.body ?? [],
  faqs: doc.faqs ?? [],
  created_at: doc.createdAt?.toISOString?.() ?? "",
  updated_at: doc.updatedAt?.toISOString?.() ?? "",
});
