import type { HydratedDocument } from "mongoose";
import type { AdminDoc, AdminRole } from "./admin.model";

export { ADMIN_ROLES } from "./admin.model";
export type { AdminRole };

export interface Admin {
  id: string;
  email: string;
  name?: string;
  role: AdminRole;
  isActive: boolean;
  isBanned: boolean;
  bannedReason?: string;
  bannedBy?: string;
  bannedAt?: Date;
  phone?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminInput {
  email: string;
  role?: AdminRole;
}

export interface UpdateAdminInput {
  name?: string;
  phone?: string;
  isActive?: boolean;
}

export const toAdminDTO = (doc: HydratedDocument<AdminDoc>): Admin => {
  const dto: Admin = {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role,
    isActive: doc.isActive,
    isBanned: doc.isBanned,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.name != null) dto.name = doc.name;
  if (doc.phone != null) dto.phone = doc.phone;
  if (doc.bannedReason != null) dto.bannedReason = doc.bannedReason;
  if (doc.bannedBy != null) dto.bannedBy = doc.bannedBy.toString();
  if (doc.bannedAt != null) dto.bannedAt = doc.bannedAt;
  if (doc.lastLoginAt != null) dto.lastLoginAt = doc.lastLoginAt;
  return dto;
};
