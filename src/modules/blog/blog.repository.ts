import type { HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { BlogModel, type BlogDoc, type BlogImage } from "./blog.model";

export class BlogRepository extends BaseRepository<BlogDoc> {
  constructor() {
    super(BlogModel);
  }

  async findBySlug(slug: string): Promise<HydratedDocument<BlogDoc> | null> {
    return this.model.findOne({ slug });
  }

  async addImages(id: string, images: BlogImage[]): Promise<HydratedDocument<BlogDoc> | null> {
    return this.model.findByIdAndUpdate(
      id,
      { $push: { images: { $each: images } } },
      { new: true },
    );
  }

  async removeImage(id: string, path: string): Promise<HydratedDocument<BlogDoc> | null> {
    return this.model.findByIdAndUpdate(id, { $pull: { images: { path } } }, { new: true });
  }

  async setPrimaryImage(id: string, path: string): Promise<HydratedDocument<BlogDoc> | null> {
    const doc = await this.model.findById(id);
    if (!doc) return null;
    doc.images = doc.images.map((img) => ({ ...img, isPrimary: img.path === path }));
    await doc.save();
    return doc;
  }

  /**
   * Update the alt text of a single image, addressed by its `path`. Returns
   * `null` for a missing post, `undefined` for a post whose images don't
   * include `path` — kept distinct so the service can raise the right
   * NotFoundError message for each case.
   */
  async updateImageAlt(
    id: string,
    path: string,
    alt: string,
  ): Promise<HydratedDocument<BlogDoc> | null | undefined> {
    const doc = await this.model.findById(id);
    if (!doc) return null;
    const img = doc.images.find((i) => i.path === path);
    if (!img) return undefined;
    img.alt = alt;
    await doc.save();
    return doc;
  }
}
