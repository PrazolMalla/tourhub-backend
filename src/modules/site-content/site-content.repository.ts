import type { HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { SiteContentModel, type SiteContentDoc } from "./site-content.model";

export class SiteContentRepository extends BaseRepository<SiteContentDoc> {
  constructor() {
    super(SiteContentModel);
  }

  async findBySection(section: string): Promise<HydratedDocument<SiteContentDoc> | null> {
    return this.model.findOne({ section: section.toLowerCase() });
  }

  async upsertBySection(
    section: string,
    update: Partial<SiteContentDoc>,
  ): Promise<HydratedDocument<SiteContentDoc>> {
    const key = section.toLowerCase();
    const doc = await this.model.findOneAndUpdate(
      { section: key },
      { $set: { ...update, section: key } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return doc as HydratedDocument<SiteContentDoc>;
  }

  async listAllPublished(): Promise<HydratedDocument<SiteContentDoc>[]> {
    // Mirror getPublic(): require published AND not archived.
    return this.model.find({ isPublished: true, archivedAt: null });
  }

  async listAll(): Promise<HydratedDocument<SiteContentDoc>[]> {
    return this.model.find({});
  }
}
