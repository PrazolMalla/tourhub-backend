import { Types } from "mongoose";
import { BaseService } from "../../core/base/base.service";
import { ConflictError, NotFoundError } from "../../core/errors";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import { requireSlug } from "../../core/utils/slug.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { BlogRepository } from "./blog.repository";
import { toBlogDTO, type BlogPost, type CreateBlogInput, type UpdateBlogInput } from "./blog.types";
import type { BlogImage } from "./blog.model";
import { hardDeleteFile } from "../../core/utils/uploads";

export interface BlogListFilters {
  category?: string;
  featured?: boolean;
  isActive?: boolean;
  /** "live" (default), "archived", or "all" — gates by archive state. */
  state?: "live" | "archived" | "all";
}

const isPublished = (doc: { isActive: boolean; archivedAt?: Date | null }): boolean =>
  doc.isActive && !doc.archivedAt;

const STATE_FILTER: Record<NonNullable<BlogListFilters["state"]>, Record<string, unknown>> = {
  live: { archivedAt: null },
  archived: { archivedAt: { $ne: null } },
  all: {},
};

export class BlogService extends BaseService<BlogRepository> {
  async list(
    options: PaginationOptions,
    filters: BlogListFilters = {},
  ): Promise<PaginatedResult<BlogPost>> {
    const state = filters.state ?? "live";
    const filter: Record<string, unknown> = { ...STATE_FILTER[state] };
    if (filters.category) filter.category = filters.category;
    if (filters.featured !== undefined) filter.featured = filters.featured;
    if (filters.isActive !== undefined) filter.isActive = filters.isActive;
    if (options.search) {
      const safe = escapeRegex(options.search);
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
        { excerpt: { $regex: safe, $options: "i" } },
      ];
    }

    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };

    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);

    return PaginationBuilder.build(docs.map(toBlogDTO), total, options);
  }

  async findById(id: string): Promise<BlogPost> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    return toBlogDTO(doc);
  }

  async findBySlug(slug: string): Promise<BlogPost> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc) throw new NotFoundError(`Blog ${slug} not found`);
    return toBlogDTO(doc);
  }

  /** Public lookup — drafts and archived posts are indistinguishable from missing ones. */
  async findPublishedById(id: string): Promise<BlogPost> {
    const doc = await this.repository.findById(id);
    if (!doc || !isPublished(doc)) throw new NotFoundError(`Blog ${id} not found`);
    return toBlogDTO(doc);
  }

  async findPublishedBySlug(slug: string): Promise<BlogPost> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc || !isPublished(doc)) throw new NotFoundError(`Blog ${slug} not found`);
    return toBlogDTO(doc);
  }

  async create(input: CreateBlogInput, createdBy?: string): Promise<BlogPost> {
    const slug = requireSlug(input.slug || input.title);
    const existing = await this.repository.findBySlug(slug);
    if (existing) throw new ConflictError(`Blog with slug "${slug}" already exists`);

    const payload: Record<string, unknown> = {
      title: input.title.trim(),
      slug,
      body: input.body,
    };
    if (input.description !== undefined) payload.description = input.description;
    if (input.category !== undefined) payload.category = input.category;
    if (input.dateLabel !== undefined) payload.dateLabel = input.dateLabel;
    if (input.datePublished !== undefined) payload.datePublished = input.datePublished;
    if (input.readTime !== undefined) payload.readTime = input.readTime;
    if (input.heroAlt !== undefined) payload.heroAlt = input.heroAlt;
    if (input.heroImage !== undefined) payload.heroImage = input.heroImage;
    if (input.excerpt !== undefined) payload.excerpt = input.excerpt;
    if (input.exploreText !== undefined) payload.exploreText = input.exploreText;
    if (input.exploreHref !== undefined) payload.exploreHref = input.exploreHref;
    if (input.featured !== undefined) payload.featured = input.featured;
    if (input.related !== undefined) payload.related = input.related;
    if (input.isActive !== undefined) payload.isActive = input.isActive;
    if (createdBy) payload.createdBy = new Types.ObjectId(createdBy);

    const doc = await this.repository.create(payload as never);
    return toBlogDTO(doc);
  }

  async update(id: string, input: UpdateBlogInput): Promise<BlogPost> {
    const next: Record<string, unknown> = {};
    if (input.title) next.title = input.title.trim();
    if (input.slug) {
      const slug = requireSlug(input.slug);
      const clash = await this.repository.findBySlug(slug);
      if (clash && clash._id.toString() !== id) {
        throw new ConflictError(`Blog with slug "${slug}" already exists`);
      }
      next.slug = slug;
    }
    if (input.description !== undefined) next.description = input.description;
    if (input.category !== undefined) next.category = input.category;
    if (input.dateLabel !== undefined) next.dateLabel = input.dateLabel;
    if (input.datePublished !== undefined) next.datePublished = input.datePublished;
    if (input.readTime !== undefined) next.readTime = input.readTime;
    if (input.heroAlt !== undefined) next.heroAlt = input.heroAlt;
    if (input.heroImage !== undefined) next.heroImage = input.heroImage;
    if (input.body !== undefined) next.body = input.body;
    if (input.excerpt !== undefined) next.excerpt = input.excerpt;
    if (input.exploreText !== undefined) next.exploreText = input.exploreText;
    if (input.exploreHref !== undefined) next.exploreHref = input.exploreHref;
    if (input.featured !== undefined) next.featured = input.featured;
    if (input.related !== undefined) next.related = input.related;
    if (input.isActive !== undefined) next.isActive = input.isActive;

    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    return toBlogDTO(doc);
  }

  /**
   * Archive — hides from public site, can be restored via unarchive().
   */
  async archive(id: string): Promise<BlogPost> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toBlogDTO(doc);
  }

  async unarchive(id: string): Promise<BlogPost> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toBlogDTO(doc);
  }

  /**
   * Hard delete — permanently remove the doc and its image files.
   */
  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    for (const img of doc.images) {
      const removed = await hardDeleteFile(img.path, "image");
      if (!removed) {
        this.logger.warn("Failed to delete blog image from Cloudinary", {
          blogId: id,
          publicId: img.path,
        });
      }
    }
    await this.repository.delete(id);
  }

  /** @deprecated Alias for hardDelete(). Kept for back-compat. */
  async delete(id: string): Promise<void> {
    await this.hardDelete(id);
  }

  async addImages(id: string, images: BlogImage[]): Promise<BlogPost> {
    const doc = await this.repository.addImages(id, images);
    if (!doc) {
      // Files were uploaded but no blog matched — clean up so we don't leak storage.
      for (const img of images) await hardDeleteFile(img.path, "image");
      throw new NotFoundError(`Blog ${id} not found`);
    }
    return toBlogDTO(doc);
  }

  async removeImage(id: string, imagePath: string): Promise<BlogPost> {
    // Verify ownership first — otherwise any Cloudinary public_id (another
    // module's asset) could be passed in and permanently deleted.
    await this.requireImage(id, imagePath);
    const doc = await this.repository.removeImage(id, imagePath);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    await hardDeleteFile(imagePath, "image");
    return toBlogDTO(doc);
  }

  async setPrimaryImage(id: string, imagePath: string): Promise<BlogPost> {
    await this.requireImage(id, imagePath);
    const doc = await this.repository.setPrimaryImage(id, imagePath);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    return toBlogDTO(doc);
  }

  async updateImageAlt(id: string, imagePath: string, alt: string): Promise<BlogPost> {
    const doc = await this.repository.updateImageAlt(id, imagePath, alt);
    if (doc === null) throw new NotFoundError(`Blog ${id} not found`);
    if (doc === undefined) throw new NotFoundError(`Image not found on blog post ${id}`);
    return toBlogDTO(doc);
  }

  private async requireImage(id: string, imagePath: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    if (!doc.images.some((img) => img.path === imagePath)) {
      throw new NotFoundError(`Image not found on blog post ${id}`);
    }
  }

  async getRaw(id: string) {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Blog ${id} not found`);
    return doc;
  }
}
