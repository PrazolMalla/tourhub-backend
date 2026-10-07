import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { UserModel } from "../modules/user/user.model";
import { AdminModel } from "../modules/admin/admin.model";
import { RegionModule } from "../modules/region/region.module";
import { SiteContentModule } from "../modules/site-content/site-content.module";

/**
 * Idempotent boot-time seeding:
 *  - Migrates any pre-split docs in `users` with role=admin|superadmin into
 *    the `admins` collection so we never have staff hiding in the users table.
 *  - Ensures the SuperAdmin admin from SUPERADMIN_EMAIL exists in `admins`.
 *  - Seeds the default trekking regions & tour categories, and default
 *    site-content sections.
 */
export class Seeder {
  static async run(): Promise<void> {
    await this.migrateLegacyAdmins();
    await this.seedSuperAdmin();
    await RegionModule.service().ensureDefaultSeed();
    await SiteContentModule.service().ensureDefaults();
  }

  /**
   * Pre-split, all roles lived in `users` (with a `role` field). Move any
   * doc with role=admin|superadmin into the `admins` collection. Runs once
   * per boot; safe to re-run because we skip emails already present in
   * `admins` and delete the legacy user doc after copy.
   */
  private static async migrateLegacyAdmins(): Promise<void> {
    const legacy = await UserModel.collection
      .find({ role: { $in: ["admin", "superadmin"] } })
      .toArray();
    if (legacy.length === 0) return;

    let migrated = 0;
    for (const doc of legacy) {
      const email = (doc.email as string | undefined)?.toLowerCase();
      if (!email) continue;
      const existing = await AdminModel.findOne({ email });
      if (!existing) {
        const adminDoc: Record<string, unknown> = {
          email,
          role: doc.role,
          isActive: doc.isActive ?? true,
          isBanned: doc.isBanned ?? false,
        };
        if (doc.name) adminDoc.name = doc.name;
        if (doc.password) adminDoc.password = doc.password;
        if (doc.googleId) adminDoc.googleId = doc.googleId;
        if (doc.bannedReason) adminDoc.bannedReason = doc.bannedReason;
        if (doc.lastLoginAt) adminDoc.lastLoginAt = doc.lastLoginAt;
        if (doc.lastLoginIp) adminDoc.lastLoginIp = doc.lastLoginIp;
        if (doc.phone) adminDoc.phone = doc.phone;
        await AdminModel.create(adminDoc);
        migrated += 1;
      }
      await UserModel.collection.deleteOne({ _id: doc._id });
    }
    if (migrated > 0) {
      logger.info("Admin migration: moved legacy admin docs from users → admins", {
        migrated,
        total: legacy.length,
      });
    }
  }

  private static async seedSuperAdmin(): Promise<void> {
    const email = env.SUPERADMIN_EMAIL.toLowerCase();
    const existing = await AdminModel.findOne({ email });

    if (existing) {
      if (existing.role !== "superadmin") {
        existing.role = "superadmin";
        existing.isActive = true;
        existing.isBanned = false;
        await existing.save();
        logger.info("SuperAdmin: existing admin promoted", { email });
      } else {
        logger.info("SuperAdmin: already present", { email });
      }
      return;
    }

    const password = await bcrypt.hash(env.SUPERADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);
    await AdminModel.create({
      email,
      password,
      name: env.SUPERADMIN_NAME,
      role: "superadmin",
      isActive: true,
      isBanned: false,
    });
    logger.warn("SuperAdmin: seeded — change the default password immediately", {
      email,
    });
  }
}
