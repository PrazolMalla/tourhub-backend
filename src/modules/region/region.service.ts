import { BaseService } from "../../core/base/base.service";
import { ConflictError, NotFoundError } from "../../core/errors";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import { requireSlug, slugify } from "../../core/utils/slug.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { RegionRepository } from "./region.repository";
import {
  toRegionDTO,
  type Region,
  type CreateRegionInput,
  type UpdateRegionInput,
} from "./region.types";
import type { RegionType } from "./region.model";

interface RegionSeed {
  key: string;
  name: string;
  type: RegionType;
  longLabel?: string;
}

const TREK_REGION_SEEDS: RegionSeed[] = [
  { key: "everest", name: "Everest", type: "trek-region", longLabel: "Everest Region · Khumbu" },
  { key: "annapurna", name: "Annapurna", type: "trek-region", longLabel: "Annapurna Region" },
  { key: "langtang", name: "Langtang", type: "trek-region", longLabel: "Langtang Region" },
  { key: "manaslu", name: "Manaslu", type: "trek-region", longLabel: "Manaslu Region" },
  { key: "mustang", name: "Mustang", type: "trek-region", longLabel: "Mustang Region" },
];

const TOUR_CATEGORY_SEEDS: RegionSeed[] = [
  { key: "trekking", name: "Trekking", type: "tour-category" },
  { key: "tours", name: "Tours", type: "tour-category" },
  { key: "helicopter", name: "Helicopter", type: "tour-category" },
  { key: "religious", name: "Religious", type: "tour-category" },
  { key: "adventure", name: "Adventure", type: "tour-category" },
];

export class RegionService extends BaseService<RegionRepository> {
  async list(
    options: PaginationOptions,
    state: "live" | "archived" | "all" = "live",
  ): Promise<PaginatedResult<Region>> {
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
    return PaginationBuilder.build(docs.map(toRegionDTO), total, options);
  }

  /** Public listing — only active, non-archived regions. */
  async listPublic(options: PaginationOptions): Promise<PaginatedResult<Region>> {
    const filter = { isActive: true, archivedAt: null };
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toRegionDTO), total, options);
  }

  /** Public lookups — inactive/archived regions are indistinguishable from missing ones. */
  async findPublishedById(id: string): Promise<Region> {
    const doc = await this.repository.findById(id);
    if (!doc || !doc.isActive || doc.archivedAt) throw new NotFoundError(`Region ${id} not found`);
    return toRegionDTO(doc);
  }

  async findPublishedBySlug(slug: string): Promise<Region> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc || !doc.isActive || doc.archivedAt) {
      throw new NotFoundError(`Region ${slug} not found`);
    }
    return toRegionDTO(doc);
  }

  async listAll(): Promise<Region[]> {
    const docs = await this.repository.findAll(
      { isActive: true, archivedAt: null },
      { sort: { sortOrder: 1 } },
    );
    return docs.map(toRegionDTO);
  }

  async findById(id: string): Promise<Region> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
    return toRegionDTO(doc);
  }

  async findBySlug(slug: string): Promise<Region> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc) throw new NotFoundError(`Region ${slug} not found`);
    return toRegionDTO(doc);
  }

  async create(input: CreateRegionInput): Promise<Region> {
    const slug = requireSlug(input.slug || input.name);
    const existing = await this.repository.findBySlug(slug);
    if (existing) throw new ConflictError(`Region with slug "${slug}" already exists`);
    const payload: Partial<CreateRegionInput> & { slug: string } = {
      name: input.name.trim(),
      slug,
      key: input.key.trim(),
    };
    if (input.type !== undefined) payload.type = input.type;
    if (input.longLabel !== undefined) payload.longLabel = input.longLabel;
    if (input.description !== undefined) payload.description = input.description;
    if (input.imageUrl !== undefined) payload.imageUrl = input.imageUrl;
    if (input.isActive !== undefined) payload.isActive = input.isActive;
    if (input.sortOrder !== undefined) payload.sortOrder = input.sortOrder;
    const doc = await this.repository.create(payload);
    return toRegionDTO(doc);
  }

  async update(id: string, input: UpdateRegionInput): Promise<Region> {
    const next: Record<string, unknown> = { ...input };
    if (input.slug) next.slug = requireSlug(input.slug);
    if (input.name) next.name = input.name.trim();
    if (input.key) next.key = input.key.trim();
    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
    return toRegionDTO(doc);
  }

  async archive(id: string): Promise<Region> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toRegionDTO(doc);
  }

  async unarchive(id: string): Promise<Region> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toRegionDTO(doc);
  }

  async uploadImage(id: string, file: Express.Multer.File): Promise<Region> {
    const record = fileToRecord("region", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "image");
      throw new NotFoundError(`Region ${id} not found`);
    }
    // If a previous image exists, permanently remove it before swapping in the new one.
    if (doc.imagePath) await hardDeleteFile(doc.imagePath, "image");
    doc.imagePath = record.publicId;
    doc.imageUrl = record.url;
    await doc.save();
    return toRegionDTO(doc);
  }

  async removeImage(id: string): Promise<Region> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
    if (doc.imagePath) await hardDeleteFile(doc.imagePath, "image");
    doc.imagePath = undefined as unknown as string;
    doc.imageUrl = undefined as unknown as string;
    await doc.save();
    return toRegionDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
    if (doc.imagePath) await hardDeleteFile(doc.imagePath, "image");
    await this.repository.delete(id);
  }

  /** @deprecated Alias for hardDelete(). Kept for back-compat. */
  async delete(id: string): Promise<void> {
    const doc = await this.repository.delete(id);
    if (!doc) throw new NotFoundError(`Region ${id} not found`);
  }

  /** Ensure the default trek regions & tour categories exist (idempotent). Called at boot. */
  async ensureDefaultSeed(): Promise<void> {
    const seeds = [...TREK_REGION_SEEDS, ...TOUR_CATEGORY_SEEDS];
    let sortOrder = 0;
    for (const seed of seeds) {
      const slug = slugify(seed.key);
      const order = sortOrder;
      sortOrder += 1;
      const existing = await this.repository.findBySlug(slug);
      if (existing) continue;
      const payload: Partial<CreateRegionInput> & { slug: string } = {
        name: seed.name,
        slug,
        key: seed.key,
        type: seed.type,
        isActive: true,
        sortOrder: order,
      };
      if (seed.longLabel !== undefined) payload.longLabel = seed.longLabel;
      await this.repository.create(payload);
    }
  }
}
