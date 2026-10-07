import type { HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { SeoModel, type SeoDoc, type SeoEntityType, type SeoImage } from "./seo.model";

export class SeoRepository extends BaseRepository<SeoDoc> {
  constructor() {
    super(SeoModel);
  }

  async findByEntity(
    entityType: SeoEntityType,
    entityId: string,
  ): Promise<HydratedDocument<SeoDoc> | null> {
    return this.model.findOne({ entityType, entityId });
  }

  async listByEntityType(entityType?: SeoEntityType): Promise<HydratedDocument<SeoDoc>[]> {
    const filter = entityType ? { entityType } : {};
    return this.model.find(filter).sort({ updatedAt: -1 });
  }

  /** Create-or-update keyed by (entityType, entityId) — the natural key for this collection. */
  async upsertByEntity(
    entityType: SeoEntityType,
    entityId: string,
    update: Record<string, unknown>,
  ): Promise<HydratedDocument<SeoDoc>> {
    const doc = await this.model.findOneAndUpdate(
      { entityType, entityId },
      { $set: update, $setOnInsert: { entityType, entityId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    // findOneAndUpdate with upsert always returns a document in Mongoose.
    return doc as HydratedDocument<SeoDoc>;
  }

  async setImage(
    entityType: SeoEntityType,
    entityId: string,
    field: "ogImage" | "twitterImage",
    image: SeoImage | null,
  ): Promise<HydratedDocument<SeoDoc> | null> {
    return this.model.findOneAndUpdate(
      { entityType, entityId },
      image ? { $set: { [field]: image } } : { $unset: { [field]: "" as const } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  /**
   * Update the alt text of the OG/Twitter image. Returns `null` for a
   * missing SEO record, `undefined` when that record has no image in
   * `field` yet — kept distinct so the service can raise the right
   * NotFoundError message for each case.
   */
  async updateImageAlt(
    entityType: SeoEntityType,
    entityId: string,
    field: "ogImage" | "twitterImage",
    alt: string,
  ): Promise<HydratedDocument<SeoDoc> | null | undefined> {
    const doc = await this.model.findOne({ entityType, entityId });
    if (!doc) return null;
    const image = doc[field];
    if (!image) return undefined;
    image.alt = alt;
    await doc.save();
    return doc;
  }

  async deleteByEntity(entityType: SeoEntityType, entityId: string): Promise<boolean> {
    const res = await this.model.deleteOne({ entityType, entityId });
    return res.deletedCount > 0;
  }
}
