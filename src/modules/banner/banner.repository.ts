import type { HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { BannerModel, type BannerDoc, type BannerSection } from "./banner.model";

/**
 * State filter conventions:
 *   live      → archivedAt = null
 *   archived  → archivedAt != null
 *   all       → no filter
 */
export type BannerState = "live" | "archived" | "all";

const stateFilter = (state: BannerState): Record<string, unknown> => {
  if (state === "live") return { archivedAt: null };
  if (state === "archived") return { archivedAt: { $ne: null } };
  return {};
};

export class BannerRepository extends BaseRepository<BannerDoc> {
  constructor() {
    super(BannerModel);
  }

  async listBySection(
    section: BannerSection,
    state: BannerState = "live",
  ): Promise<HydratedDocument<BannerDoc>[]> {
    return this.model.find({ section, ...stateFilter(state) }).sort({ sortOrder: 1, createdAt: 1 });
  }

  async listAll(state: BannerState = "all"): Promise<HydratedDocument<BannerDoc>[]> {
    return this.model.find(stateFilter(state)).sort({ section: 1, sortOrder: 1 });
  }

  async listPublic(section: BannerSection): Promise<HydratedDocument<BannerDoc>[]> {
    return this.model
      .find({ section, isActive: true, archivedAt: null })
      .sort({ sortOrder: 1, createdAt: 1 });
  }
}
