import type { HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { RegionModel, type RegionDoc } from "./region.model";

export class RegionRepository extends BaseRepository<RegionDoc> {
  constructor() {
    super(RegionModel);
  }

  async findBySlug(slug: string): Promise<HydratedDocument<RegionDoc> | null> {
    return this.model.findOne({ slug });
  }
}
