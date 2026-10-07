import type { HydratedDocument } from "mongoose";
import type { SchoolTripChecklistDoc } from "./school-trip-checklist.model";
import type {
  ChecklistDownloadLogDoc,
  ChecklistDownloadStatus,
} from "./checklist-download-log.model";

export interface SchoolTripChecklist {
  id: string;
  type: string;
  slug: string;
  pdfPath?: string;
  pdfUrl?: string;
  pdfOriginalName?: string;
  isActive: boolean;
  sortOrder: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSchoolTripChecklistInput {
  type: string;
  slug?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateSchoolTripChecklistInput {
  type?: string;
  slug?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** Shape the public site needs — no internal file path, just the servable URL. */
export interface PublicSchoolTripChecklist {
  id: string;
  type: string;
  slug: string;
  pdfUrl?: string;
}

export const toSchoolTripChecklistDTO = (
  doc: HydratedDocument<SchoolTripChecklistDoc>,
): SchoolTripChecklist => {
  const dto: SchoolTripChecklist = {
    id: doc._id.toString(),
    type: doc.type,
    slug: doc.slug,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.pdfPath !== undefined) dto.pdfPath = doc.pdfPath;
  if (doc.pdfUrl !== undefined) dto.pdfUrl = doc.pdfUrl;
  if (doc.pdfOriginalName !== undefined) dto.pdfOriginalName = doc.pdfOriginalName;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};

export const toPublicSchoolTripChecklist = (
  doc: HydratedDocument<SchoolTripChecklistDoc>,
): PublicSchoolTripChecklist => {
  const dto: PublicSchoolTripChecklist = {
    id: doc._id.toString(),
    type: doc.type,
    slug: doc.slug,
  };
  if (doc.pdfUrl !== undefined) dto.pdfUrl = doc.pdfUrl;
  return dto;
};

export interface ChecklistDownloadLog {
  id: string;
  checklistId?: string;
  checklistType: string;
  name: string;
  phone: string;
  status: ChecklistDownloadStatus;
  failureReason?: string;
  ip?: string;
  country?: string;
  countryName?: string;
  region?: string;
  city?: string;
  userAgent?: string;
  createdAt: Date;
}

export const toChecklistDownloadLogDTO = (
  doc: HydratedDocument<ChecklistDownloadLogDoc>,
): ChecklistDownloadLog => {
  const dto: ChecklistDownloadLog = {
    id: doc._id.toString(),
    checklistType: doc.checklistType,
    name: doc.name,
    phone: doc.phone,
    status: doc.status,
    createdAt: doc.createdAt,
  };
  if (doc.checklistId) dto.checklistId = doc.checklistId.toString();
  if (doc.failureReason !== undefined) dto.failureReason = doc.failureReason;
  if (doc.ip !== undefined) dto.ip = doc.ip;
  if (doc.country !== undefined) dto.country = doc.country;
  if (doc.countryName !== undefined) dto.countryName = doc.countryName;
  if (doc.region !== undefined) dto.region = doc.region;
  if (doc.city !== undefined) dto.city = doc.city;
  if (doc.userAgent !== undefined) dto.userAgent = doc.userAgent;
  return dto;
};
