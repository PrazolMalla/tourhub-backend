import type { HydratedDocument } from "mongoose";
import type { UserDoc } from "./user.model";

export interface User {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  isBanned: boolean;
  bannedReason?: string;
  bannedAt?: Date;
  phone?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface UpdateUserInput {
  name?: string;
  isActive?: boolean;
  isBanned?: boolean;
  bannedReason?: string;
  phone?: string;
}

export const toUserDTO = (doc: HydratedDocument<UserDoc>): User => {
  const dto: User = {
    id: doc._id.toString(),
    email: doc.email,
    isActive: doc.isActive,
    isBanned: doc.isBanned,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  // `!= null` — unban writes nulls, which must read as "unset".
  if (doc.name != null) dto.name = doc.name;
  if (doc.phone != null) dto.phone = doc.phone;
  if (doc.bannedReason != null) dto.bannedReason = doc.bannedReason;
  if (doc.bannedAt != null) dto.bannedAt = doc.bannedAt;
  if (doc.lastLoginAt != null) dto.lastLoginAt = doc.lastLoginAt;
  return dto;
};
