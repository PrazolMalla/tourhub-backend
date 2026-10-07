import type { HydratedDocument } from "mongoose";
import type { RegionDoc, RegionType } from "./region.model";

export interface Region {
  id: string;
  name: string;
  slug: string;
  key: string;
  type: RegionType;
  longLabel?: string;
  description?: string;
  imageUrl?: string;
  imagePath?: string;
  isActive: boolean;
  sortOrder: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRegionInput {
  name: string;
  slug?: string;
  key: string;
  type?: RegionType;
  longLabel?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateRegionInput {
  name?: string;
  slug?: string;
  key?: string;
  type?: RegionType;
  longLabel?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export const toRegionDTO = (doc: HydratedDocument<RegionDoc>): Region => {
  const dto: Region = {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    key: doc.key,
    type: doc.type,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.longLabel !== undefined) dto.longLabel = doc.longLabel;
  if (doc.description !== undefined) dto.description = doc.description;
  if (doc.imageUrl !== undefined) dto.imageUrl = doc.imageUrl;
  if (doc.imagePath !== undefined) dto.imagePath = doc.imagePath;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};
