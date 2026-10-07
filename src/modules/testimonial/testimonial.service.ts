import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { TestimonialRepository } from "./testimonial.repository";
import {
  toTestimonialDTO,
  type Testimonial,
  type CreateTestimonialInput,
  type UpdateTestimonialInput,
} from "./testimonial.types";

export class TestimonialService extends BaseService<TestimonialRepository> {
  async list(
    options: PaginationOptions,
    state: "live" | "archived" | "all" = "live",
  ): Promise<PaginatedResult<Testimonial>> {
    const filter: Record<string, unknown> = {};
    if (state === "live") {
      filter.archivedAt = null;
    } else if (state === "archived") {
      filter.archivedAt = { $ne: null };
    }
    if (options.search) filter.name = { $regex: escapeRegex(options.search), $options: "i" };
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toTestimonialDTO), total, options);
  }

  /** Public listing — only active, non-archived testimonials. */
  async listPublic(options: PaginationOptions): Promise<PaginatedResult<Testimonial>> {
    const filter = { isActive: true, archivedAt: null };
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toTestimonialDTO), total, options);
  }

  async listAll(): Promise<Testimonial[]> {
    const docs = await this.repository.findAll(
      { isActive: true, archivedAt: null },
      { sort: { sortOrder: 1 } },
    );
    return docs.map(toTestimonialDTO);
  }

  async findById(id: string): Promise<Testimonial> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    return toTestimonialDTO(doc);
  }

  async create(input: CreateTestimonialInput): Promise<Testimonial> {
    const payload: Partial<CreateTestimonialInput> = {
      name: input.name.trim(),
      quote: input.quote.trim(),
    };
    if (input.location !== undefined) payload.location = input.location;
    if (input.role !== undefined) payload.role = input.role;
    if (input.rating !== undefined) payload.rating = input.rating;
    if (input.tripTitle !== undefined) payload.tripTitle = input.tripTitle;
    if (input.avatarUrl !== undefined) payload.avatarUrl = input.avatarUrl;
    if (input.isActive !== undefined) payload.isActive = input.isActive;
    if (input.isFeatured !== undefined) payload.isFeatured = input.isFeatured;
    if (input.sortOrder !== undefined) payload.sortOrder = input.sortOrder;
    if (input.videoUrl !== undefined) payload.videoUrl = input.videoUrl;
    if (input.source !== undefined) payload.source = input.source;
    const doc = await this.repository.create(payload);
    return toTestimonialDTO(doc);
  }

  async update(id: string, input: UpdateTestimonialInput): Promise<Testimonial> {
    const next: Record<string, unknown> = { ...input };
    if (input.name) next.name = input.name.trim();
    if (input.quote) next.quote = input.quote.trim();

    // If videoUrl is being changed directly (bypassing the upload endpoint)
    // while a Cloudinary-uploaded video is still on record, that asset is
    // about to become unreferenced — delete it and clear the bookkeeping so
    // videoPublicId never lies about what videoUrl currently points to.
    if (input.videoUrl !== undefined) {
      const existing = await this.repository.findById(id);
      if (existing && input.videoUrl !== existing.videoUrl && existing.videoPublicId) {
        await hardDeleteFile(existing.videoPublicId, "video");
        // `null` (not `undefined`) — findByIdAndUpdate drops undefined-valued
        // keys before building the update op, so this is the only way to
        // actually clear the field via the repository's plain update().
        next.videoPublicId = null;
      }
    }

    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    return toTestimonialDTO(doc);
  }

  async archive(id: string): Promise<Testimonial> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toTestimonialDTO(doc);
  }

  async unarchive(id: string): Promise<Testimonial> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toTestimonialDTO(doc);
  }

  async uploadImage(id: string, file: Express.Multer.File): Promise<Testimonial> {
    const record = fileToRecord("testimonial", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "image");
      throw new NotFoundError(`Testimonial ${id} not found`);
    }
    // If a previous image exists, permanently delete it before replacing.
    if (doc.avatarPath) await hardDeleteFile(doc.avatarPath, "image");
    doc.avatarPath = record.publicId;
    doc.avatarUrl = record.url;
    await doc.save();
    return toTestimonialDTO(doc);
  }

  async removeImage(id: string): Promise<Testimonial> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    if (doc.avatarPath) await hardDeleteFile(doc.avatarPath, "image");
    doc.avatarPath = undefined as unknown as string;
    doc.avatarUrl = undefined as unknown as string;
    await doc.save();
    return toTestimonialDTO(doc);
  }

  async uploadVideo(id: string, file: Express.Multer.File): Promise<Testimonial> {
    const record = fileToRecord("testimonial", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "video");
      throw new NotFoundError(`Testimonial ${id} not found`);
    }
    // If a previously uploaded video exists, permanently delete it before replacing.
    // (A pasted external videoUrl has no videoPublicId — nothing to clean up.)
    if (doc.videoPublicId) await hardDeleteFile(doc.videoPublicId, "video");
    doc.videoUrl = record.url;
    doc.videoPublicId = record.publicId;
    await doc.save();
    return toTestimonialDTO(doc);
  }

  async removeVideo(id: string): Promise<Testimonial> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    if (doc.videoPublicId) await hardDeleteFile(doc.videoPublicId, "video");
    doc.videoUrl = undefined as unknown as string;
    doc.videoPublicId = undefined as unknown as string;
    await doc.save();
    return toTestimonialDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Testimonial ${id} not found`);
    if (doc.avatarPath) await hardDeleteFile(doc.avatarPath, "image");
    if (doc.videoPublicId) await hardDeleteFile(doc.videoPublicId, "video");
    await this.repository.delete(id);
  }
}
