import type { HydratedDocument } from "mongoose";
import type { PartnerDoc } from "./partner.model";

export interface Partner {
  id: string;
  name: string;
  url?: string;
  logoUrl?: string;
  logoPath?: string;
  isActive: boolean;
  sortOrder: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePartnerInput {
  name: string;
  url?: string;
  logoUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdatePartnerInput {
  name?: string;
  url?: string;
  logoUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export const toPartnerDTO = (doc: HydratedDocument<PartnerDoc>): Partner => {
  const dto: Partner = {
    id: doc._id.toString(),
    name: doc.name,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.url !== undefined) dto.url = doc.url;
  if (doc.logoUrl !== undefined) dto.logoUrl = doc.logoUrl;
  if (doc.logoPath !== undefined) dto.logoPath = doc.logoPath;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};
