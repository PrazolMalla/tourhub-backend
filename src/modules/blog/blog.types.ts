import type { HydratedDocument } from "mongoose";
import type { BlogDoc, BlogImage, BlogRelated } from "./blog.model";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  dateLabel?: string;
  datePublished?: Date;
  readTime?: string;
  heroAlt?: string;
  body: string;
  excerpt?: string;
  exploreText?: string;
  exploreHref?: string;
  featured: boolean;
  related: BlogRelated[];
  isActive: boolean;
  archivedAt?: Date;
  images: BlogImage[];
  /** Derived hero: primary/first uploaded image URL, else the external fallback. */
  heroImage?: string;
  /** Public-facing (Cloudinary) image URLs. */
  imageUrls?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogInput {
  title: string;
  slug?: string;
  description?: string;
  category?: string;
  dateLabel?: string;
  datePublished?: Date;
  readTime?: string;
  heroAlt?: string;
  heroImage?: string;
  body: string;
  excerpt?: string;
  exploreText?: string;
  exploreHref?: string;
  featured?: boolean;
  related?: BlogRelated[];
  isActive?: boolean;
}

export interface UpdateBlogInput {
  title?: string;
  slug?: string;
  description?: string;
  category?: string;
  dateLabel?: string;
  datePublished?: Date;
  readTime?: string;
  heroAlt?: string;
  heroImage?: string;
  body?: string;
  excerpt?: string;
  exploreText?: string;
  exploreHref?: string;
  featured?: boolean;
  related?: BlogRelated[];
  isActive?: boolean;
}

export const toBlogDTO = (doc: HydratedDocument<BlogDoc>): BlogPost => {
  const dto: BlogPost = {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    body: doc.body,
    featured: doc.featured ?? false,
    related: doc.related ?? [],
    isActive: doc.isActive,
    images: doc.images,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.description !== undefined) dto.description = doc.description;
  if (doc.category !== undefined) dto.category = doc.category;
  if (doc.dateLabel !== undefined) dto.dateLabel = doc.dateLabel;
  if (doc.datePublished !== undefined) dto.datePublished = doc.datePublished;
  if (doc.readTime !== undefined) dto.readTime = doc.readTime;
  if (doc.heroAlt !== undefined) dto.heroAlt = doc.heroAlt;
  if (doc.excerpt !== undefined) dto.excerpt = doc.excerpt;
  if (doc.exploreText !== undefined) dto.exploreText = doc.exploreText;
  if (doc.exploreHref !== undefined) dto.exploreHref = doc.exploreHref;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;

  // Derived hero: prefer an uploaded primary/first image, fall back to the
  // external heroImage URL stored on the doc.
  let heroImage = doc.heroImage;
  if (doc.images.length) {
    dto.imageUrls = doc.images.map((img) => img.url);
    const primary = doc.images.find((i) => i.isPrimary) ?? doc.images[0];
    if (primary) heroImage = primary.url;
  }
  if (heroImage !== undefined) dto.heroImage = heroImage;

  return dto;
};
