import type { HydratedDocument } from "mongoose";
import type { TripAltitude, TripDoc, TripImage, TripItinDay } from "./trip.model";

export interface Trip {
  id: string;
  title: string;
  slug: string;
  kind: "trek" | "tour";
  country: string;
  region: string;
  regionL?: string;
  cats: string[];
  days: number;
  maxAlt?: string;
  diff?: string;
  season?: string;
  group?: string;
  price?: string;
  was?: string;
  rating?: string;
  reviews?: string;
  badge?: string;
  sub?: string;
  overview?: string[];
  highlights?: string[];
  videoUrl?: string;
  inc?: string[];
  exc?: string[];
  altitude?: TripAltitude[];
  itin?: TripItinDay[];
  isActive: boolean;
  isFeatured: boolean;
  archivedAt?: Date;
  images: TripImage[];
  /** Public-facing (Cloudinary) image URLs from uploaded images. */
  imageUrls?: string[];
  /** Convenience field — the primary image URL or first image. */
  primaryImageUrl?: string;
  /** Always-usable main image: primary uploaded image, else the external `img` fallback. */
  img?: string;
  /** Uploaded image URLs when present, else the external gallery URLs. */
  gallery?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripInput {
  title: string;
  slug?: string;
  kind: "trek" | "tour";
  country: string;
  region: string;
  regionL?: string;
  cats?: string[];
  days: number;
  maxAlt?: string;
  diff?: string;
  season?: string;
  group?: string;
  price?: string;
  was?: string;
  rating?: string;
  reviews?: string;
  badge?: string;
  sub?: string;
  img?: string;
  overview?: string[];
  highlights?: string[];
  videoUrl?: string;
  inc?: string[];
  exc?: string[];
  gallery?: string[];
  altitude?: TripAltitude[];
  itin?: TripItinDay[];
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface UpdateTripInput {
  title?: string;
  slug?: string;
  kind?: "trek" | "tour";
  country?: string;
  region?: string;
  regionL?: string;
  cats?: string[];
  days?: number;
  maxAlt?: string;
  diff?: string;
  season?: string;
  group?: string;
  price?: string;
  was?: string;
  rating?: string;
  reviews?: string;
  badge?: string;
  sub?: string;
  img?: string;
  overview?: string[];
  highlights?: string[];
  videoUrl?: string;
  inc?: string[];
  exc?: string[];
  gallery?: string[];
  altitude?: TripAltitude[];
  itin?: TripItinDay[];
  isActive?: boolean;
  isFeatured?: boolean;
}

export const toTripDTO = (doc: HydratedDocument<TripDoc>): Trip => {
  const dto: Trip = {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    kind: doc.kind,
    country: doc.country ?? "nepal",
    region: doc.region,
    cats: doc.cats ?? [],
    days: doc.days,
    isActive: doc.isActive,
    isFeatured: doc.isFeatured,
    images: doc.images,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.regionL !== undefined) dto.regionL = doc.regionL;
  if (doc.maxAlt !== undefined) dto.maxAlt = doc.maxAlt;
  if (doc.diff !== undefined) dto.diff = doc.diff;
  if (doc.season !== undefined) dto.season = doc.season;
  if (doc.group !== undefined) dto.group = doc.group;
  if (doc.price !== undefined) dto.price = doc.price;
  if (doc.was !== undefined) dto.was = doc.was;
  if (doc.rating !== undefined) dto.rating = doc.rating;
  if (doc.reviews !== undefined) dto.reviews = doc.reviews;
  if (doc.badge !== undefined) dto.badge = doc.badge;
  if (doc.sub !== undefined) dto.sub = doc.sub;
  if (doc.overview !== undefined) dto.overview = doc.overview;
  if (doc.highlights !== undefined) dto.highlights = doc.highlights;
  if (doc.videoUrl !== undefined) dto.videoUrl = doc.videoUrl;
  if (doc.inc !== undefined) dto.inc = doc.inc;
  if (doc.exc !== undefined) dto.exc = doc.exc;
  if (doc.altitude !== undefined) dto.altitude = doc.altitude;
  if (doc.itin !== undefined) dto.itin = doc.itin;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;

  // Derived image fields — uploaded images take precedence over external URLs.
  let primaryImageUrl: string | undefined;
  if (doc.images.length) {
    const imageUrls = doc.images.map((img) => img.url);
    dto.imageUrls = imageUrls;
    const primary = doc.images.find((i) => i.isPrimary) ?? doc.images[0];
    primaryImageUrl = primary?.url;
    if (primaryImageUrl) dto.primaryImageUrl = primaryImageUrl;
    dto.gallery = imageUrls;
  } else if (doc.gallery !== undefined) {
    dto.gallery = doc.gallery;
  }

  // The frontend always gets a usable main image.
  const mainImg = primaryImageUrl ?? doc.img;
  if (mainImg !== undefined) dto.img = mainImg;

  return dto;
};
