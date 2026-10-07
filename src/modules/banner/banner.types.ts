import type { HydratedDocument } from "mongoose";
import type { BannerDoc, BannerSection, BannerTextStyle, TextAlign } from "./banner.model";

export interface BannerDTO {
  id: string;
  section: BannerSection;
  title: string;
  titleAccent?: string;
  subtitle?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  imagePath?: string;
  imageUrl?: string;
  imageAlt?: string;
  style: BannerTextStyle;
  sortOrder: number;
  isActive: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBannerInput {
  section: BannerSection;
  title: string;
  titleAccent?: string;
  subtitle?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  imageAlt?: string;
  style?: BannerTextStyle;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateBannerInput {
  title?: string;
  titleAccent?: string;
  subtitle?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  imageAlt?: string;
  style?: BannerTextStyle;
  sortOrder?: number;
  isActive?: boolean;
}

export type { BannerSection, BannerTextStyle, TextAlign };

export const toBannerDTO = (doc: HydratedDocument<BannerDoc>): BannerDTO => {
  const dto: BannerDTO = {
    id: doc._id.toString(),
    section: doc.section,
    title: doc.title,
    style: doc.style ?? {},
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.titleAccent !== undefined) dto.titleAccent = doc.titleAccent;
  if (doc.subtitle !== undefined) dto.subtitle = doc.subtitle;
  if (doc.eyebrow !== undefined) dto.eyebrow = doc.eyebrow;
  if (doc.ctaLabel !== undefined) dto.ctaLabel = doc.ctaLabel;
  if (doc.ctaHref !== undefined) dto.ctaHref = doc.ctaHref;
  if (doc.ctaSecondaryLabel !== undefined) dto.ctaSecondaryLabel = doc.ctaSecondaryLabel;
  if (doc.ctaSecondaryHref !== undefined) dto.ctaSecondaryHref = doc.ctaSecondaryHref;
  if (doc.imagePath !== undefined) dto.imagePath = doc.imagePath;
  if (doc.imageUrl !== undefined) dto.imageUrl = doc.imageUrl;
  if (doc.imageAlt !== undefined) dto.imageAlt = doc.imageAlt;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};
