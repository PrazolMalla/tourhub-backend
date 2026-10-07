import { BaseService } from "../../core/base/base.service";
import { HttpError, NotFoundError } from "../../core/errors";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import { requireSlug } from "../../core/utils/slug.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { HolidayRepository } from "./holiday.repository";
import {
  toHolidayDTO,
  toPublicHoliday,
  type Holiday,
  type CreateHolidayInput,
  type PublicHoliday,
  type UpdateHolidayInput,
} from "./holiday.types";

const asDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

export class HolidayService extends BaseService<HolidayRepository> {
  async list(
    options: PaginationOptions,
    state: "live" | "archived" | "all" = "live",
  ): Promise<PaginatedResult<Holiday>> {
    const filter: Record<string, unknown> = {};
    if (state === "live") {
      filter.archivedAt = null;
    } else if (state === "archived") {
      filter.archivedAt = { $ne: null };
    }
    if (options.search) filter.name = { $regex: escapeRegex(options.search), $options: "i" };
    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === "asc" ? 1 : -1 };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toHolidayDTO), total, options);
  }

  /** Public listing — active, live holidays serialized to the frontend shape.
   *  Supports `search` (name/description/keywords) and `regions` filtering so
   *  the landing's sidebar filters + search box query the backend directly. */
  async listPublic(
    options: PaginationOptions,
    filters: { regions?: string[] } = {},
  ): Promise<PaginatedResult<PublicHoliday>> {
    const filter: Record<string, unknown> = { isActive: true, archivedAt: null };
    if (filters.regions?.length) filter.regions = { $in: filters.regions };
    if (options.search) {
      const rx = { $regex: escapeRegex(options.search), $options: "i" };
      filter.$or = [{ name: rx }, { description: rx }, { seoKeywords: rx }];
    }
    // The landing sends snake_case sort fields (?sortBy=start_date); map them to
    // the real Mongo (camelCase) columns.
    const SORT_MAP: Record<string, string> = {
      start_date: "startDate",
      end_date: "endDate",
      discount_percentage: "discountPercentage",
    };
    const sortField = SORT_MAP[options.sortBy] ?? options.sortBy;
    const sort: Record<string, 1 | -1> = { [sortField]: options.sortOrder === "asc" ? 1 : -1 };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toPublicHoliday), total, options);
  }

  async findPublicBySlug(slug: string): Promise<PublicHoliday> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc || !doc.isActive || doc.archivedAt)
      throw new NotFoundError(`Holiday "${slug}" not found`);
    return toPublicHoliday(doc);
  }

  async findById(id: string): Promise<Holiday> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    return toHolidayDTO(doc);
  }

  async create(input: CreateHolidayInput): Promise<Holiday> {
    const slug = requireSlug(input.slug || input.name);
    const existing = await this.repository.findOne({ slug });
    if (existing) throw HttpError.conflict(`A holiday with slug "${slug}" already exists`);
    // Build conditionally so we never pass explicit `undefined`
    // (exactOptionalPropertyTypes) for optional fields.
    const payload: Record<string, unknown> = {
      name: input.name.trim(),
      slug,
      startDate: asDate(input.startDate),
      endDate: asDate(input.endDate),
      discountPercentage: input.discountPercentage ?? 0,
      isFeatured: input.isFeatured ?? false,
      isActive: input.isActive ?? true,
      seoKeywords: input.seoKeywords ?? [],
      recommendedTreks: input.recommendedTreks ?? [],
      regions: input.regions ?? [],
      body: input.body ?? [],
      faqs: input.faqs ?? [],
      sortOrder: input.sortOrder ?? 0,
    };
    if (input.description !== undefined) payload.description = input.description;
    if (input.bannerImage !== undefined) payload.bannerImage = input.bannerImage;
    if (input.seoTitle !== undefined) payload.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) payload.seoDescription = input.seoDescription;
    const doc = await this.repository.create(
      payload as Parameters<typeof this.repository.create>[0],
    );
    return toHolidayDTO(doc);
  }

  async update(id: string, input: UpdateHolidayInput): Promise<Holiday> {
    const next: Record<string, unknown> = { ...input };
    if (input.name) next.name = input.name.trim();
    if (input.slug) next.slug = requireSlug(input.slug);
    if (input.startDate) next.startDate = asDate(input.startDate);
    if (input.endDate) next.endDate = asDate(input.endDate);

    // Only one side of the range changing can still invert it — compare with
    // the stored value (the validator covers the both-provided case).
    if ((input.startDate === undefined) !== (input.endDate === undefined)) {
      const existing = await this.repository.findById(id);
      if (!existing) throw new NotFoundError(`Holiday ${id} not found`);
      const start = (next.startDate as Date | undefined) ?? existing.startDate;
      const end = (next.endDate as Date | undefined) ?? existing.endDate;
      if (end.getTime() < start.getTime()) {
        throw HttpError.badRequest("endDate must be on or after startDate");
      }
    }
    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    return toHolidayDTO(doc);
  }

  async archive(id: string): Promise<Holiday> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toHolidayDTO(doc);
  }

  async unarchive(id: string): Promise<Holiday> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toHolidayDTO(doc);
  }

  async uploadImage(id: string, file: Express.Multer.File): Promise<Holiday> {
    const record = fileToRecord("holiday", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "image");
      throw new NotFoundError(`Holiday ${id} not found`);
    }
    // Replacing the banner — delete the previous asset so it doesn't leak.
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    doc.images = [
      {
        path: record.publicId,
        url: record.url,
        isPrimary: true,
        sizeBytes: record.sizeBytes,
        mimeType: record.mimeType,
      },
    ];
    await doc.save();
    return toHolidayDTO(doc);
  }

  async removeImage(id: string): Promise<Holiday> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    doc.images = [];
    await doc.save();
    return toHolidayDTO(doc);
  }

  /** Only ever one image (upload replaces it), so no `path` needed to address it. */
  async updateImageAlt(id: string, alt: string): Promise<Holiday> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    const img = doc.images[0];
    if (!img) throw new NotFoundError(`Holiday ${id} has no image`);
    img.alt = alt;
    await doc.save();
    return toHolidayDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Holiday ${id} not found`);
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    await this.repository.delete(id);
  }
}
