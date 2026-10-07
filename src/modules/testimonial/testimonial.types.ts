import type { HydratedDocument } from "mongoose";
import type { TestimonialDoc } from "./testimonial.model";

export interface Testimonial {
  id: string;
  name: string;
  location?: string;
  role?: string;
  rating: number;
  quote: string;
  tripTitle?: string;
  avatarUrl?: string;
  avatarPath?: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  videoUrl?: string;
  videoPublicId?: string;
  source?: string;
}

export interface CreateTestimonialInput {
  name: string;
  location?: string;
  role?: string;
  rating?: number;
  quote: string;
  tripTitle?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  videoUrl?: string;
  source?: string;
}

export interface UpdateTestimonialInput {
  name?: string;
  location?: string;
  role?: string;
  rating?: number;
  quote?: string;
  tripTitle?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  videoUrl?: string;
  source?: string;
}

export const toTestimonialDTO = (doc: HydratedDocument<TestimonialDoc>): Testimonial => {
  const dto: Testimonial = {
    id: doc._id.toString(),
    name: doc.name,
    rating: doc.rating,
    quote: doc.quote,
    isActive: doc.isActive,
    isFeatured: doc.isFeatured,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.location !== undefined) dto.location = doc.location;
  if (doc.role !== undefined) dto.role = doc.role;
  if (doc.tripTitle !== undefined) dto.tripTitle = doc.tripTitle;
  if (doc.avatarUrl !== undefined) dto.avatarUrl = doc.avatarUrl;
  if (doc.avatarPath !== undefined) dto.avatarPath = doc.avatarPath;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  if (doc.videoUrl !== undefined) dto.videoUrl = doc.videoUrl;
  if (doc.videoPublicId != null) dto.videoPublicId = doc.videoPublicId;
  if (doc.source !== undefined) dto.source = doc.source;
  return dto;
};
