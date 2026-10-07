import mongoose from "mongoose";
import { BaseService } from "../../core/base/base.service";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { AdminRepository } from "../admin/admin.repository";
import { SessionModule } from "../session/session.module";
import {
  toAdminDTO,
  type Admin,
  type CreateAdminInput,
  type UpdateAdminInput,
} from "../admin/admin.types";
import { env } from "../../config/env";
import { Seeder } from "../../bootstrap/seed";
import { wipeAllUploads } from "../../core/utils/uploads";

export type { CreateAdminInput, UpdateAdminInput };

export class AdminManagementService extends BaseService<AdminRepository> {
  /** Lists all admins (both `role=admin` and `role=superadmin`). */
  async listAdmins(options: PaginationOptions): Promise<PaginatedResult<Admin>> {
    const filter: Record<string, unknown> = {};
    if (options.search) {
      const safe = escapeRegex(options.search);
      filter.$or = [
        { email: { $regex: safe, $options: "i" } },
        { name: { $regex: safe, $options: "i" } },
      ];
    }
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toAdminDTO), total, options);
  }

  /**
   * Invite a new admin by email. No password is stored — the invitee signs in
   * via Google OAuth on the admin portal, which links their Google account to
   * this email on first successful login.
   */
  async createAdmin(input: CreateAdminInput): Promise<Admin> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.repository.findByEmail(email);
    if (existing) throw new ConflictError("Email already in use");

    const payload: Record<string, unknown> = {
      email,
      role: input.role ?? "admin",
      isActive: true,
      isBanned: false,
    };
    const doc = await this.repository.create(payload as never);
    return toAdminDTO(doc);
  }

  async updateAdmin(id: string, input: UpdateAdminInput): Promise<Admin> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Admin ${id} not found`);
    if (doc.role === "superadmin") {
      throw new ForbiddenError("Cannot modify SuperAdmin via this endpoint");
    }
    const updated = await this.repository.update(id, input);
    if (!updated) throw new NotFoundError(`Admin ${id} not found`);
    return toAdminDTO(updated);
  }

  async deleteAdmin(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Admin ${id} not found`);
    if (doc.role === "superadmin") {
      throw new ForbiddenError("Cannot delete SuperAdmin");
    }
    await this.repository.delete(id);
    await SessionModule.service().revokeAllForUser(id, "admin", "admin-account-deleted");
  }

  /**
   * Nuke every collection in the active Mongo database, then re-run the
   * boot-time seeder so the SuperAdmin + default content come back.
   *
   * Why: requested as a SuperAdmin-only "factory reset" button. The
   * confirmation code is stored in env (`DB_CLEAR_CONFIRMATION_CODE`) so the
   * value can be rotated per environment without redeploying the validator.
   *
   * Caveat: the calling SuperAdmin's session is wiped along with everything
   * else, so the next request from that token will 401. They must re-login
   * with the env-seeded SuperAdmin credentials.
   */
  async clearDatabase(confirmationCode: string): Promise<{
    collectionsDropped: number;
    collections: string[];
    filesDeleted: number;
    uploadSubdirsWiped: string[];
  }> {
    if (confirmationCode !== env.DB_CLEAR_CONFIRMATION_CODE) {
      throw new ForbiddenError("Invalid confirmation code");
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("No active database connection");
    }

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const dropped: string[] = [];
    for (const { name } of collections) {
      if (name.startsWith("system.")) continue;
      await db.dropCollection(name);
      dropped.push(name);
    }

    // Sweep Cloudinary as well. If we leave uploads in place, the freshly
    // re-seeded products/banners/etc. will reference assets that no longer
    // have a DB row, and orphaned assets accumulate forever.
    const uploads = await wipeAllUploads();

    this.logger.warn("Database cleared by SuperAdmin", {
      collectionsDropped: dropped.length,
      collections: dropped,
      filesDeleted: uploads.filesDeleted,
      uploadSubdirsWiped: uploads.subdirs,
    });

    await Seeder.run();

    return {
      collectionsDropped: dropped.length,
      collections: dropped,
      filesDeleted: uploads.filesDeleted,
      uploadSubdirsWiped: uploads.subdirs,
    };
  }

  /**
   * SuperAdmin-only: block or unblock an admin account so they can / cannot
   * sign in to the admin panel. `bannedBy` is the SuperAdmin's id, recorded
   * for audit and shown on the admin list.
   */
  async setBanned(
    id: string,
    isBanned: boolean,
    reason: string | undefined,
    bannedBy: string,
  ): Promise<Admin> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Admin ${id} not found`);
    if (doc.role === "superadmin") {
      throw new ForbiddenError("Cannot block SuperAdmin");
    }
    await this.repository.setBanned(id, isBanned, reason, bannedBy);
    if (isBanned) {
      await SessionModule.service().revokeAllForUser(id, "admin", "admin-banned");
    }
    const updated = await this.repository.findById(id);
    if (!updated) throw new NotFoundError(`Admin ${id} not found`);
    return toAdminDTO(updated);
  }
}
